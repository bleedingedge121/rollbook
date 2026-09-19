import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { prisma } from '@/lib/prisma'
import { calculateAttendance, toDateString, WEEKDAYS } from '@/lib/attendance'
import { addDays, subDays, format, isBefore, isSameDay } from 'date-fns'

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        reply:
          "Gemini API key is not configured yet. Please add `GEMINI_API_KEY` to your `.env` file (you can get a free key instantly from https://aistudio.google.com with no credit card required).",
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
    ]

    // Tool execution functions
    const executeTool = async (name: string, args: any) => {
      if (name === 'get_attendance_summary') {
        const [courses, attendance] = await Promise.all([
          prisma.course.findMany(),
          prisma.attendanceRecord.findMany(),
        ])

        const summary = courses.map((c) => {
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
          where: { code: { equals: courseCode.trim() } },
          include: { attendance: true, timetableSlots: true },
        })

        if (!course) {
          return { error: `Course with code "${courseCode}" was not found.` }
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
            time: s.label,
            room: s.room,
          })),
          recentHistory: course.attendance
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10)
            .map((a) => ({ date: a.date, status: a.status, note: a.note })),
        }
      }

      if (name === 'get_upcoming_classes') {
        const numDays = args.days || 5
        const today = new Date()
        const [slots, holidays, courses] = await Promise.all([
          prisma.timetableSlot.findMany(),
          prisma.holiday.findMany(),
          prisma.course.findMany(),
        ])

        const schedule: any[] = []
        for (let i = 0; i < numDays; i++) {
          const date = addDays(today, i)
          const dateStr = toDateString(date)
          const weekday = date.getDay()

          const holiday = holidays.find((h) => h.date === dateStr)
          if (holiday) {
            schedule.push({
              date: dateStr,
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
            date: dateStr,
            day: format(date, 'EEEE'),
            isHoliday: false,
            classes: daySlots.map((s) => {
              const c = courses.find((co) => co.id === s.courseId)
              return {
                courseName: c?.name || 'Unknown',
                courseCode: c?.code || 'N/A',
                time: s.label,
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
          prisma.timetableSlot.findMany(),
          prisma.holiday.findMany(),
          prisma.course.findMany(),
          prisma.attendanceRecord.findMany(),
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
            if (!course) continue

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
                date: pastDateStr,
                day: format(pastDate, 'EEEE'),
                courseName: course.name,
                courseCode: course.code,
                time: slot.label,
              })
            }
          }
        }

        return { unloggedSessions: unlogged, count: unlogged.length }
      }

      return { error: 'Unknown tool name' }
    }

    // Prepare message contents for Gemini
    const systemInstruction = `You are Roll Book's intelligent attendance assistant and academic flight advisor.
Your job is to answer the user's questions about their real university attendance, schedule, timetable, safe skip buffers, and recovery streaks.
RULES:
1. NEVER guess or hallucinate attendance numbers, courses, percentages, or dates. ALWAYS call the provided tools to retrieve real verified data.
2. If asked about standing, skip capacity, or recovery, call get_attendance_summary or get_course_detail.
3. Be concise, punchy, clear, and supportive. Use a witty, dignified tone.
4. If asked about something unrelated to the user's attendance, subjects, timetable, or university schedule, politely explain that you are dedicated exclusively to their attendance tracking and schedule management.`

    // Format messages for Gemini
    const contents: any[] = []
    for (const msg of messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })
    }

    // Call Gemini with tools
    let response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations as any }],
      },
    })

    // Handle Function Calls Loop (up to 3 rounds)
    for (let round = 0; round < 3; round++) {
      const candidates = response.candidates
      const firstPart = candidates?.[0]?.content?.parts?.[0]

      if (firstPart && 'functionCall' in firstPart && firstPart.functionCall) {
        const { name, args } = firstPart.functionCall
        if (!name) break

        const toolResult = await executeTool(name, args || {})

        // Append assistant tool call and tool response
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name, args } }],
        })
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
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: toolDeclarations as any }],
          },
        })
      } else {
        break
      }
    }

    const replyText = response.text || 'I checked your records, but could not produce a response.'
    return NextResponse.json({ reply: replyText })
  } catch (err: any) {
    console.error('Chat error:', err)
    if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({
        reply: "I've reached the daily free tier usage limit for Google Gemini. Please try again in a little while!",
      })
    }
    return NextResponse.json(
      { reply: `Encountered an issue processing your request: ${err?.message || 'Unknown error'}` },
      { status: 500 }
    )
  }
}
