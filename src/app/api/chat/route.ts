import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { prisma } from '@/lib/prisma'
import { calculateAttendance, toDateString, WEEKDAYS } from '@/lib/attendance'
import { formatDate, formatTime, formatSlotTime } from '@/lib/formatters'
import { addDays, subDays, format, isBefore, isSameDay } from 'date-fns'
import { requireUser } from '@/lib/session'

function parseIsoDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

const MODEL_NAME = 'gemini-flash-latest'
const MAX_DAILY_CHAT_REQUESTS = 50

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const { messages } = await req.json()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        reply:
          "Gemini API key is not configured yet. Please add `GEMINI_API_KEY` to your `.env` file (you can get a free key instantly from https://aistudio.google.com with no credit card required).",
      })
    }

    // Rate-limiting check per user (to protect shared API key)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chatRequestCount: true, chatRequestDate: true, role: true },
    })

    const todayStr = formatIsoDate(new Date())
    const currentCount = user?.chatRequestDate === todayStr ? (user.chatRequestCount || 0) : 0

    if (currentCount >= MAX_DAILY_CHAT_REQUESTS) {
      return NextResponse.json({
        reply: `You have reached your daily limit of ${MAX_DAILY_CHAT_REQUESTS} AI advisor questions for today. This shared quota helps keep Roll Book free and reliable for all users. Please try again tomorrow!`,
      })
    }

    const ai = new GoogleGenAI({ apiKey })

    // Define function declarations for tools
    const toolDeclarations = [
      {
        name: 'get_attendance_summary',
        description:
          'Get the full attendance summary for all registered subjects, including required percent, current percent, classes held, present, absent, safe-to-skip count, and recovery streaks.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'get_course_detail',
        description:
          'Get detailed attendance history, records, notes, and metrics for a specific course code (e.g. CSE101, MAT101).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            courseCode: {
              type: Type.STRING,
              description: 'The code of the course, such as CSE101, ECE102, or MAT101.',
            },
          },
          required: ['courseCode'],
        },
      },
      {
        name: 'get_upcoming_classes',
        description:
          'Get scheduled classes for the next N days from the recurring timetable, automatically skipping declared holidays and exam dates.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            days: {
              type: Type.NUMBER,
              description: 'Number of upcoming days to inspect (default: 5).',
            },
          },
        },
      },
      {
        name: 'get_unlogged_sessions',
        description:
          'Find all timetable classes from the past 7 days that do not have a confirmed attendance record yet, skipping declared holidays and dates already captured in portal sync.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'add_holiday',
        description:
          'Add a single holiday or a multi-day holiday date range to the university calendar so classes on those dates are automatically excluded from attendance checks and future planning.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description: 'The date for a single holiday in YYYY-MM-DD format (e.g. 2026-12-25).',
            },
            startDate: {
              type: Type.STRING,
              description: 'The start date for a multi-day holiday range in YYYY-MM-DD format (e.g. 2026-10-20).',
            },
            endDate: {
              type: Type.STRING,
              description: 'The end date for a multi-day holiday range in YYYY-MM-DD format (e.g. 2026-10-24).',
            },
            label: {
              type: Type.STRING,
              description: 'The description or name of the holiday / event (e.g. "Diwali Break", "Christmas", "Mid-term Exam").',
            },
            type: {
              type: Type.STRING,
              description: 'The type of event: "holiday" (for holidays/recess) or "exam" (for exam days). Defaults to "holiday".',
            },
          },
          required: ['label'],
        },
      },
      {
        name: 'delete_holiday',
        description: 'Remove a holiday or exam day declaration from the calendar by date or label.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description: 'The specific date (YYYY-MM-DD) to remove holiday status from.',
            },
            label: {
              type: Type.STRING,
              description: 'Remove all holidays matching this label name (e.g. "Diwali Break").',
            },
          },
        },
      },
      {
        name: 'list_holidays',
        description: 'List all declared holidays and exam dates registered in the database.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
    ]

    // Tool execution functions scoped to authenticated user
    const executeTool = async (name: string, args: any) => {
      if (name === 'get_attendance_summary') {
        const [courses, attendance] = await Promise.all([
          prisma.course.findMany({ where: { userId } }),
          prisma.attendanceRecord.findMany({ where: { course: { userId } } }),
        ])

        const summary = courses.map((c) => {
          if (c.trackingMode === 'simple') {
            const held = c.simpleHeld || 0
            const present = c.simpleAttended || 0
            const absent = Math.max(0, held - present)
            const stats = calculateAttendance(present, absent, c.requiredPercent)
            return {
              name: c.name,
              code: c.code,
              trackingMode: 'simple',
              requiredPercent: c.requiredPercent,
              currentPercent: stats.percentage,
              present: stats.present,
              absent: stats.absent,
              held: stats.total,
              maxSkippable: stats.maxSkippable,
              mustAttendNext: stats.mustAttendNext,
              isSafe: stats.isSafe,
              statusText: stats.statusText,
            }
          }

          const courseRecs = attendance.filter(
            (a) => a.courseId === c.id && !a.note?.includes('Synced from SLCM')
          )
          const manualPresent = courseRecs.filter((a) => a.status === 'present').length
          const manualAbsent = courseRecs.filter((a) => a.status === 'absent').length
          const totalPresent = (c.syncedPresent || 0) + manualPresent
          const totalAbsent = (c.syncedAbsent || 0) + manualAbsent
          const stats = calculateAttendance(totalPresent, totalAbsent, c.requiredPercent)

          return {
            name: c.name,
            code: c.code,
            trackingMode: 'detailed',
            requiredPercent: c.requiredPercent,
            currentPercent: stats.percentage,
            present: stats.present,
            absent: stats.absent,
            held: stats.total,
            maxSkippable: stats.maxSkippable,
            mustAttendNext: stats.mustAttendNext,
            isSafe: stats.isSafe,
            statusText: stats.statusText,
          }
        })

        let overallPresent = 0
        let overallAbsent = 0
        summary.forEach((s) => {
          overallPresent += s.present
          overallAbsent += s.absent
        })
        const overallHeld = overallPresent + overallAbsent
        const overallPct = overallHeld > 0 ? Number(((overallPresent / overallHeld) * 100).toFixed(1)) : 100

        return {
          overall: {
            percentage: overallPct,
            totalPresent: overallPresent,
            totalAbsent: overallAbsent,
            totalHeld: overallHeld,
            isSafe: overallPct >= 75,
          },
          courses: summary,
        }
      }

      if (name === 'get_course_detail') {
        const { courseCode } = args
        const course = await prisma.course.findFirst({
          where: {
            code: { equals: (courseCode || '').trim().toUpperCase() },
            userId,
          },
          include: { attendance: true, timetableSlots: true },
        })

        if (!course) {
          return { error: `Course with code "${courseCode}" was not found in your account.` }
        }

        if (course.trackingMode === 'simple') {
          const held = course.simpleHeld || 0
          const present = course.simpleAttended || 0
          const absent = Math.max(0, held - present)
          const stats = calculateAttendance(present, absent, course.requiredPercent)
          return {
            name: course.name,
            code: course.code,
            trackingMode: 'simple',
            requiredPercent: course.requiredPercent,
            stats,
          }
        }

        const courseRecs = course.attendance.filter((a) => !a.note?.includes('Synced from SLCM'))
        const manualPresent = courseRecs.filter((a) => a.status === 'present').length
        const manualAbsent = courseRecs.filter((a) => a.status === 'absent').length
        const totalPresent = (course.syncedPresent || 0) + manualPresent
        const totalAbsent = (course.syncedAbsent || 0) + manualAbsent
        const stats = calculateAttendance(totalPresent, totalAbsent, course.requiredPercent)

        return {
          name: course.name,
          code: course.code,
          requiredPercent: course.requiredPercent,
          stats,
          timetableSlots: course.timetableSlots.map((s) => ({
            weekday: WEEKDAYS[s.weekday],
            time: formatSlotTime(s.label),
            room: s.room,
          })),
          recentHistory: course.attendance
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10)
            .map((a) => ({ date: formatDate(a.date), status: a.status, note: a.note })),
        }
      }

      if (name === 'get_upcoming_classes') {
        const numDays = args.days || 5
        const today = new Date()
        const [slots, holidays, courses] = await Promise.all([
          prisma.timetableSlot.findMany({ where: { course: { userId } } }),
          prisma.holiday.findMany(),
          prisma.course.findMany({ where: { userId } }),
        ])

        const schedule: any[] = []
        for (let i = 0; i < numDays; i++) {
          const date = addDays(today, i)
          const dateStr = toDateString(date)
          const weekday = date.getDay()

          const holiday = holidays.find((h) => h.date === dateStr)
          if (holiday) {
            schedule.push({
              date: formatDate(date),
              isoDate: dateStr,
              day: format(date, 'EEEE'),
              isHoliday: true,
              holidayLabel: holiday.label,
              holidayType: holiday.type,
              classes: [],
            })
            continue
          }

          const daySlots = slots.filter((s) => s.weekday === weekday)
          schedule.push({
            date: formatDate(date),
            isoDate: dateStr,
            day: format(date, 'EEEE'),
            isHoliday: false,
            classes: daySlots.map((s) => {
              const c = courses.find((co) => co.id === s.courseId)
              return {
                courseName: c?.name || 'Unknown',
                courseCode: c?.code || 'N/A',
                time: formatSlotTime(s.label),
                room: s.room,
              }
            }),
          })
        }

        return { upcomingDays: schedule }
      }

      if (name === 'get_unlogged_sessions') {
        const today = new Date()
        const [slots, holidays, courses, attendance] = await Promise.all([
          prisma.timetableSlot.findMany({ where: { course: { userId } } }),
          prisma.holiday.findMany(),
          prisma.course.findMany({ where: { userId } }),
          prisma.attendanceRecord.findMany({ where: { course: { userId } } }),
        ])

        const unlogged: any[] = []
        for (let i = 1; i <= 7; i++) {
          const pastDate = subDays(today, i)
          const pastDateStr = toDateString(pastDate)
          const pastWeekday = pastDate.getDay()

          if (holidays.some((h) => h.date === pastDateStr)) continue

          const slotsOnDay = slots.filter((s) => s.weekday === pastWeekday)
          for (const slot of slotsOnDay) {
            const course = courses.find((c) => c.id === slot.courseId)
            if (!course || course.trackingMode === 'simple') continue

            if (course.syncedAt) {
              const syncedDateStr = toDateString(new Date(course.syncedAt))
              if (
                isBefore(pastDate, new Date(course.syncedAt)) ||
                isSameDay(pastDate, new Date(course.syncedAt)) ||
                pastDateStr <= syncedDateStr
              ) {
                continue
              }
            }

            const hasRecord = attendance.some(
              (a) => a.courseId === slot.courseId && a.date === pastDateStr
            )

            if (!hasRecord) {
              unlogged.push({
                date: formatDate(pastDate),
                isoDate: pastDateStr,
                day: format(pastDate, 'EEEE'),
                courseName: course.name,
                courseCode: course.code,
                time: formatSlotTime(slot.label),
              })
            }
          }
        }

        return { unloggedSessions: unlogged, count: unlogged.length }
      }

      // Add Holiday Tool (Single date or multi-day range) - Admin only
      if (name === 'add_holiday') {
        if (user?.role !== 'admin') {
          return {
            error: 'Permission denied: Managing university calendar holidays is restricted to administrators. As a regular user, you can view the shared calendar, but only admins can add or change holidays.',
          }
        }

        const { date, startDate, endDate, label, type } = args
        const holidayLabel = (label || 'Holiday / No Class').trim()
        const holidayType = type === 'exam' ? 'exam' : 'holiday'

        if (startDate && endDate) {
          let current = parseIsoDate(startDate)
          const end = parseIsoDate(endDate)
          if (isNaN(current.getTime()) || isNaN(end.getTime())) {
            return { error: 'Invalid start or end date format. Please use YYYY-MM-DD.' }
          }
          if (isBefore(end, current)) {
            return { error: 'End date cannot be before start date.' }
          }

          const dateList: string[] = []
          while (isBefore(current, end) || isSameDay(current, end)) {
            dateList.push(formatIsoDate(current))
            current = addDays(current, 1)
          }

          const results = await prisma.$transaction(
            dateList.map((d) =>
              prisma.holiday.upsert({
                where: { date: d },
                update: { label: holidayLabel, type: holidayType },
                create: { date: d, label: holidayLabel, type: holidayType },
              })
            )
          )

          return {
            success: true,
            message: `Successfully declared ${holidayType === 'exam' ? 'Exam Days' : 'Holiday'} "${holidayLabel}" from ${formatDate(startDate)} to ${formatDate(endDate)} (${results.length} days total) for the entire university calendar.`,
            daysAdded: results.length,
          }
        }

        if (date) {
          const holiday = await prisma.holiday.upsert({
            where: { date },
            update: { label: holidayLabel, type: holidayType },
            create: { date, label: holidayLabel, type: holidayType },
          })
          return {
            success: true,
            message: `Successfully declared ${holidayType === 'exam' ? 'Exam Day' : 'Holiday'} "${holidayLabel}" on ${formatDate(date)} for the entire university calendar.`,
            holiday,
          }
        }

        return { error: 'Please provide either a single date (YYYY-MM-DD) or both startDate and endDate.' }
      }

      if (name === 'delete_holiday') {
        if (user?.role !== 'admin') {
          return {
            error: 'Permission denied: Deleting university calendar holidays is restricted to administrators.',
          }
        }

        const { date, label } = args
        if (date) {
          await prisma.holiday.deleteMany({ where: { date } })
          return { success: true, message: `Removed holiday status for ${formatDate(date)} from the university calendar.` }
        }
        if (label) {
          const res = await prisma.holiday.deleteMany({
            where: {
              label: { contains: label.trim() },
            },
          })
          return { success: true, message: `Removed ${res.count} holiday entries matching "${label}" from the university calendar.` }
        }
        return { error: 'Please specify a date or label name to delete.' }
      }

      if (name === 'list_holidays') {
        const holidays = await prisma.holiday.findMany({
          orderBy: { date: 'asc' },
        })
        return {
          total: holidays.length,
          holidays: holidays.map((h) => ({
            id: h.id,
            date: formatDate(h.date),
            isoDate: h.date,
            label: h.label,
            type: h.type,
          })),
        }
      }

      return { error: 'Unknown tool name' }
    }

    // Prepare message contents for Gemini
    const systemInstruction = `You are Roll Book's intelligent attendance assistant and academic flight advisor.
Your job is to answer the user's questions about their real university attendance, schedule, timetable, safe skip buffers, and recovery streaks, and manage their calendar holidays when requested.
RULES:
1. NEVER guess or hallucinate attendance numbers, courses, percentages, or dates. ALWAYS call the provided tools to retrieve or modify real verified data.
2. If asked about standing, skip capacity, or recovery, call get_attendance_summary or get_course_detail.
3. If the user asks to add or declare a holiday, holiday break, recess, or exam day (e.g. "add a holiday on 25 Dec for Christmas", "add Diwali break from 2026-10-20 to 2026-10-24", "mark tomorrow as a holiday"), ALWAYS call the \`add_holiday\` tool with the corresponding date/dates and label.
4. If asked to list holidays, call \`list_holidays\`. If asked to remove a holiday, call \`delete_holiday\`.
5. All times must be formatted in 12-hour format with lowercase am/pm (e.g. 9:00 am, 2:30 pm), and all dates must be formatted strictly in dd/mm/yyyy (e.g. 19/09/2026).
6. Be concise, punchy, clear, and supportive. Use a witty, dignified tone.`

    // Format messages for Gemini
    const contents: any[] = []
    for (const msg of messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })
    }

    let response: any = null

    try {
      response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations as any }],
        },
      })
    } catch (modelErr: any) {
      if (
        modelErr?.status === 404 ||
        modelErr?.message?.includes('404') ||
        modelErr?.message?.includes('not found') ||
        modelErr?.message?.includes('NOT_FOUND')
      ) {
        return NextResponse.json({
          reply: `The AI model (${MODEL_NAME}) is temporarily unavailable. Please check your Gemini configuration or try again shortly.`,
        })
      }
      throw modelErr
    }

    // Handle Function Calls Loop (up to 4 rounds)
    for (let round = 0; round < 4; round++) {
      const candidates = response.candidates
      const candidate = candidates?.[0]
      const firstPart = candidate?.content?.parts?.find((p: any) => p.functionCall)

      if (firstPart && firstPart.functionCall) {
        const { name, args } = firstPart.functionCall
        if (!name) break

        const toolResult = await executeTool(name, args || {})

        // Append assistant's full content and user function response
        contents.push(candidate.content)
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name,
                response: toolResult,
              },
            },
          ],
        })

        // Call Gemini again with function output
        try {
          response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: toolDeclarations as any }],
            },
          })
        } catch (followupErr: any) {
          if (
            followupErr?.status === 404 ||
            followupErr?.message?.includes('404') ||
            followupErr?.message?.includes('not found') ||
            followupErr?.message?.includes('NOT_FOUND')
          ) {
            return NextResponse.json({
              reply: `The AI model (${MODEL_NAME}) encountered an availability error during tool execution. Please try again shortly.`,
            })
          }
          throw followupErr
        }
      } else {
        break
      }
    }

    // Record request count for user
    await prisma.user.update({
      where: { id: userId },
      data: {
        chatRequestCount: currentCount + 1,
        chatRequestDate: todayStr,
      },
    }).catch(() => {})

    const replyText = response?.text || 'I checked your records, but could not produce a response.'
    return NextResponse.json({ reply: replyText })
  } catch (err: any) {
    console.error('Chat API error:', err)
    if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({
        reply: "I've reached the daily free tier usage limit for Google Gemini. Please try again in a little while!",
      })
    }
    if (
      err?.status === 404 ||
      err?.message?.includes('404') ||
      err?.message?.includes('not found') ||
      err?.message?.includes('NOT_FOUND')
    ) {
      return NextResponse.json({
        reply: `The AI model (${MODEL_NAME}) is currently unavailable or was not found. Please verify your GEMINI_API_KEY or try again shortly.`,
      })
    }
    return NextResponse.json({
      reply: `The AI assistant encountered an issue: ${err?.message || 'Please check server connection'}.`,
    })
  }
}
