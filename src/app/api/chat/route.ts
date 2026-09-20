import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { prisma } from '@/lib/prisma'
import { calculateAttendance, toDateString, WEEKDAYS } from '@/lib/attendance'
import { formatDate, formatTime, formatSlotTime } from '@/lib/formatters'
import { addDays, subDays, format, isBefore, isSameDay } from 'date-fns'
import { requireUser } from '@/lib/session'
import { autoApplySync, parsePastedTableText, SyncedCourse, autoHealUserCourses } from '@/lib/reconcile'
import { checkRateLimit } from '@/lib/rateLimit'
import { getOfficialCalendarDates } from '@/lib/academicCalendar'
import { calculateSemesterForecast } from '@/lib/semesterForecast'

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

const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite']
const MAX_DAILY_CHAT_REQUESTS = 50

async function generateWithFallback(
  ai: GoogleGenAI,
  contents: any[],
  systemInstruction: string,
  toolDeclarations: any[]
): Promise<{ response: any; modelUsed: string }> {
  let lastErr: any = null
  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: toolDeclarations as any }],
          },
        })
        return { response, modelUsed: model }
      } catch (err: any) {
        lastErr = err
        const isTransient =
          err?.status === 503 ||
          err?.status === 429 ||
          err?.message?.includes('503') ||
          err?.message?.includes('demand') ||
          err?.message?.includes('UNAVAILABLE') ||
          err?.message?.includes('RESOURCE_EXHAUSTED')
        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 600))
          continue
        }
        break
      }
    }
  }
  throw lastErr
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  // High 3: Rate limit chat requests (20 messages per 1 hour per user)
  const rateLimit = checkRateLimit('chat', userId, 20, 60 * 60 * 1000)
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        reply: `You are asking questions a bit too fast! Rate limit is 20 messages per hour. Please wait ${rateLimit.resetInSeconds} seconds before sending another message.`,
        error: 'Too many requests',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.resetInSeconds),
        },
      }
    )
  }

  try {
    const { messages } = await req.json()
    await autoHealUserCourses(userId)

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
        reply: `You have reached your daily limit of ${MAX_DAILY_CHAT_REQUESTS} AI advisor questions for today. This limit helps keep Roll Book fast and reliable for all users. Please check back tomorrow!`,
      })
    }

    const ai = new GoogleGenAI({ apiKey })

    let didSync = false
    let syncedCourseCount = 0
    let proactiveSyncNotification = ''

    const lastUserMsg = Array.isArray(messages)
      ? messages.filter((m: any) => m.role === 'user').pop()?.content || ''
      : ''

    const parsedFromChat = parsePastedTableText(lastUserMsg)
    if (parsedFromChat && parsedFromChat.length >= 2) {
      try {
        const syncResult = await autoApplySync(userId, parsedFromChat, new Date().toISOString())
        didSync = true
        syncedCourseCount = syncResult.count
        proactiveSyncNotification = `[SYSTEM NOTIFICATION: Roll Book detected and successfully synchronized ${syncResult.count} courses from the user's pasted SLCM attendance table directly into their database account. Updated courses: ${syncResult.applied.join(', ')}. Please confirm to the user that their attendance figures have been updated in Roll Book, and provide a clear, encouraging breakdown of their subjects, present/total classes, and current percentages!]`
      } catch (syncErr) {
        console.error('Proactive table sync error:', syncErr)
      }
    }

    // Define function declarations for tools
    const toolDeclarations = [
      {
        name: 'sync_attendance_data',
        description:
          'Synchronize attendance figures directly into Roll Book database from parsed course attendance records (e.g. when the user pastes raw SLCM attendance data, tables, or asks to update their attendance numbers).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            courses: {
              type: Type.ARRAY,
              description: 'List of courses with name, optional code, present count, and absent count.',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Course name' },
                  code: { type: Type.STRING, description: 'Course code (e.g. SMS_1102)' },
                  present: { type: Type.NUMBER, description: 'Total classes attended/present' },
                  absent: { type: Type.NUMBER, description: 'Total classes missed/absent' },
                },
                required: ['name', 'present', 'absent'],
              },
            },
          },
          required: ['courses'],
        },
      },
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
      {
        name: 'get_semester_forecast',
        description:
          'Calculate full semester projections until instruction ends on Dec 5, 2026. Returns total semester classes, allowed misses, remaining skip budget, and the exact "Cruise Date" (Safe-to-Bunk milestone date until which you must attend classes so you can safely skip all remaining classes until Dec 5 and finish >= 75%).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            courseCode: {
              type: Type.STRING,
              description: 'Optional course code (e.g. CES_1102) to inspect a specific subject. Omit to get full semester forecast for all subjects.',
            },
          },
        },
      },
    ]

    // Helper to retrieve holidays (uses DB holidays if present; otherwise defaults to official calendar)
    const getMergedHolidays = async () => {
      const dbHolidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } }).catch(() => [])
      if (dbHolidays.length > 0) {
        return dbHolidays.filter((h) => {
          if (h.date === '2026-10-01' && h.label.includes('Mid-Term')) return false
          if (h.label.includes('Re-Mid')) return false
          if (h.label.includes('Make-Up') || h.label.includes('Makeup')) return false
          if (h.date > '2027-01-03') return false
          return true
        })
      }

      const official = getOfficialCalendarDates('2026-09-20', '2027-01-03')
      return official.map((off, i) => ({
        id: `official-${off.date}-${i}`,
        date: off.date,
        label: off.label,
        type: off.type,
      }))
    }

    // Tool execution functions scoped to authenticated user
    const executeTool = async (name: string, args: any) => {
      if (name === 'sync_attendance_data') {
        const { courses } = args
        if (!Array.isArray(courses) || courses.length === 0) {
          return { error: 'No course data provided to synchronize.' }
        }
        try {
          const syncResult = await autoApplySync(userId, courses, new Date().toISOString())
          didSync = true
          syncedCourseCount = syncResult.count
          return {
            success: true,
            syncedCount: syncResult.count,
            appliedCourses: syncResult.applied,
            message: `Successfully synchronized ${syncResult.count} courses into Roll Book database.`,
          }
        } catch (syncErr: any) {
          return { error: `Failed to synchronize courses: ${syncErr?.message || syncErr}` }
        }
      }

      if (name === 'get_attendance_summary') {
        const [courses, attendance, slots, holidays] = await Promise.all([
          prisma.course.findMany({ where: { userId } }),
          prisma.attendanceRecord.findMany({ where: { course: { userId } } }),
          prisma.timetableSlot.findMany({ where: { course: { userId } } }),
          getMergedHolidays(),
        ])

        const forecast = calculateSemesterForecast({
          courses,
          slots,
          attendanceRecords: attendance,
          holidays,
          referenceDate: toDateString(new Date()),
        })

        const summary = courses.map((c) => {
          const fc = forecast.courses.find((f) => f.courseId === c.id)
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
              semesterForecast: fc
                ? {
                    totalSemesterClasses: fc.totalSemesterClasses,
                    futureClassesRemaining: fc.futureClassesCount,
                    maxSemesterSkips: fc.maxSemesterSkips,
                    remainingSkipsAllowed: fc.remainingSkipsAllowed,
                    safeToBunkDate: fc.safeToBunkDateFormatted,
                    classesToAttendUntilCruise: fc.classesToAttendUntilCruise,
                    statusText: fc.statusText,
                  }
                : null,
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
            semesterForecast: fc
              ? {
                  totalSemesterClasses: fc.totalSemesterClasses,
                  futureClassesRemaining: fc.futureClassesCount,
                  maxSemesterSkips: fc.maxSemesterSkips,
                  remainingSkipsAllowed: fc.remainingSkipsAllowed,
                  safeToBunkDate: fc.safeToBunkDateFormatted,
                  classesToAttendUntilCruise: fc.classesToAttendUntilCruise,
                  statusText: fc.statusText,
                }
              : null,
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
            semesterTotalClasses: forecast.totalSemesterClasses,
            semesterRemainingSkipsAllowed: forecast.overallRemainingSkipsAllowed,
            semesterCruiseDate: forecast.overallSafeToBunkDateFormatted,
            semesterInstructionEnd: forecast.semesterEndDateFormatted,
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
          getMergedHolidays(),
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
          getMergedHolidays(),
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
        const holidays = await getMergedHolidays()
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

      if (name === 'get_semester_forecast') {
        const [courses, slots, attendanceRecords, holidays] = await Promise.all([
          prisma.course.findMany({ where: { userId } }),
          prisma.timetableSlot.findMany({ where: { course: { userId } } }),
          prisma.attendanceRecord.findMany({ where: { course: { userId } } }),
          getMergedHolidays(),
        ])

        const forecast = calculateSemesterForecast({
          courses,
          slots,
          attendanceRecords,
          holidays,
          referenceDate: toDateString(new Date()),
        })

        if (args?.courseCode) {
          const code = String(args.courseCode).trim().toUpperCase()
          const single = forecast.courses.find((c) => c.courseCode.toUpperCase() === code)
          if (!single) {
            return {
              error: `Course with code "${args.courseCode}" was not found in your account.`,
              availableCourses: forecast.courses.map((c) => c.courseCode),
            }
          }
          return {
            semesterEndDate: forecast.semesterEndDateFormatted,
            winterVacation: `${forecast.winterVacationStartDate} to ${forecast.winterVacationEndDate}`,
            course: single,
          }
        }

        return forecast
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
6. Be concise, punchy, clear, and supportive. Use a witty, dignified tone.
7. NEVER address the user as "Sir", "Ma'am", or similar honorifics. Speak to them directly as a smart, capable peer.
8. If the user pastes attendance data, an SLCM table, or asks to update their attendance from text, call \`sync_attendance_data\` to save it directly to their Roll Book database account if not already synced. If a [SYSTEM NOTIFICATION] indicates Roll Book already synchronized the courses, celebrate the sync, confirm how many courses were updated, and provide an encouraging, organized breakdown of their subjects, present/total classes, and current percentages.
9. When the user sends or uploads one or more screenshots/images of an attendance portal or SLCM table (even if split across multiple screenshots covering the top and bottom of the table), inspect ALL images collectively. Deduplicate any overlapping course rows across multiple screenshots. Extract all course names, course codes (e.g. SMS_1102, CES_1102, CES_1111), total classes, present count, and absent count for every unique course found across all uploaded screenshots. Immediately call \`sync_attendance_data\` with the deduplicated list of courses to save them directly to the user's Roll Book account. Once synchronized, confirm the exact courses and numbers recorded, and provide an encouraging summary of their overall attendance health.
10. CRITICAL COURSE SEPARATION: "PROGRAMMING FOR PROBLEM SOLVING" (PPS theory, code CES_1102) and "PROGRAMMING FOR PROBLEM SOLVING LAB" (PPS Lab practical, code CES_1111) are TWO COMPLETELY SEPARATE SUBJECTS with separate codes and separate attendance records. Always treat and synchronize them as two distinct courses.
11. OFFICIAL ACADEMIC CALENDAR & HOLIDAYS (MIT Bengaluru Odd Semester 2026-2027, Sep 20, 2026 – Jan 3, 2027):
- SEMESTER CYCLE BOUNDARY: This academic calendar strictly covers the current Odd Semester cycle up to January 3, 2027 (end of Winter Vacation). On January 4, 2027, cycles rotate (new timetables, new subjects), so no events after January 3 are included in this cycle!
- Semester Instruction End: 05/12/2026 (Saturday). All regular timetable teaching finishes on Dec 5.
- Winter Vacation: 06/12/2026 – 03/01/2027 (Official college holidays / vacation — NO classes; Even Semester classes start 04/01/2027).
- Confirmed College Holidays (in RED on calendar — NO classes):
  * 02/10/2026: Gandhi Jayanti
  * 20/10/2026: Vijaya Dashami
  * 09/11/2026: Deepavali
  * 06/12/2026 – 03/01/2027: Winter Vacation
  * 25/12/2026: Christmas
- Examination Windows (NO regular timetable classes, exam periods):
  * 23/09/2026 – 30/09/2026: Mid-Term Examinations (strictly 23 to 30 September; on 01/10/2026 regular timetable classes resume as normal!)
  * 30/10/2026 & 02/11/2026 – 06/11/2026: Lab End Semester Examinations
  * 14/11/2026 – 28/11/2026: Tentative End Semester Examinations (Always explicitly label as Tentative)
- RE-MID TERMS & MAKE-UP EXAMS: Re-mid terms and make-up exams are re-assessments only for students with backlogs or re-tests. Normal students have regular scheduled classes (or winter vacation in December) during these periods, so do NOT treat re-mid terms or make-up exams as general student exam periods or holidays.
- CRITICAL CALENDAR FILTER: If an event is NOT in red on the calendar and NOT an exam (such as Teacher's Day, Engineer's Day, Falak, Tech Solstice, Re-quiz, Class Committee meetings, Last Instructional Day, Gratitude Day, Utsav, etc.), DO NOT believe or count it as a holiday! It is a normal instructional working day with regular scheduled classes.
12. MARKDOWN FORMATTING: Always format your answers with clean, beautiful Markdown. Put headings on their own separate lines preceded by blank lines (e.g. \n\n### Heading\n\n). Put bullet points on separate lines (e.g. \n* **Item:** details). Use bold for dates, course codes, and key metrics. Never squish headings, rules, or bullets into a single inline paragraph.
13. SEMESTER FORECAST & SAFE-TO-BUNK "CRUISE DATE" CALCULATIONS:
- Whenever the user asks questions such as "how many total classes will there be this semester", "how many classes can I miss for the semester", "till what day do I have to attend classes so I can skip all remaining classes and stay above 75%", or "when can I cruise/bunk the rest", ALWAYS call \`get_semester_forecast\` (or inspect \`get_attendance_summary.overall\` and \`semesterForecast\`).
- Explain:
  1. The semester timeline: Instruction ends Dec 5, 2026, followed by Winter Vacation Dec 6 to Jan 3.
  2. Future scheduled classes: calculated from their weekly timetable slots minus confirmed holidays and exam windows.
  3. Total classes in the semester (held so far + remaining scheduled).
  4. Total misses allowed for the semester and remaining skips allowed right now.
  5. The exact "Cruise Date" (Safe-to-Bunk Milestone): Explain that if they attend all classes starting today consecutively, by that date they will reach 75% of the total semester classes, meaning they can safely skip EVERY single remaining class from that date until Dec 5 without falling below 75%!`

    // Format messages for Gemini
    const contents: any[] = []
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const isLast = i === messages.length - 1
      let text = msg.content || ''
      if (isLast && msg.role === 'user' && proactiveSyncNotification) {
        text = `${text}\n\n${proactiveSyncNotification}`
      }

      const parts: any[] = []
      if (text) {
        parts.push({ text })
      }

      // Collect all images from array (msg.images) or legacy single object (msg.image)
      const rawImages: any[] = []
      if (Array.isArray(msg.images)) {
        rawImages.push(...msg.images)
      } else if (msg.image) {
        rawImages.push(msg.image)
      }

      for (const img of rawImages) {
        if (img?.data && img?.mimeType) {
          const cleanBase64 = img.data.includes('base64,')
            ? img.data.split('base64,')[1]
            : img.data
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: cleanBase64,
            },
          })
        }
      }

      if (parts.length === 0) {
        parts.push({ text: ' ' })
      }

      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts,
      })
    }

    let { response } = await generateWithFallback(
      ai,
      contents,
      systemInstruction,
      toolDeclarations
    )

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

        // Call Gemini again with function output using resilient fallback
        const followup = await generateWithFallback(
          ai,
          contents,
          systemInstruction,
          toolDeclarations
        )
        response = followup.response
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
    return NextResponse.json({
      reply: replyText,
      synced: didSync,
      syncedCount: syncedCourseCount,
    })
  } catch (err: any) {
    console.error('Chat API error:', err)
    if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({
        reply: "The AI service reached capacity limits. Please wait a moment and try sending your message again.",
      })
    }
    if (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('demand') || err?.message?.includes('UNAVAILABLE')) {
      return NextResponse.json({
        reply: "Google Gemini is currently experiencing a temporary demand spike. Please try sending again in a few seconds.",
      })
    }
    return NextResponse.json({
      reply: `The AI assistant encountered an issue: ${err?.message || 'Connection interrupted'}. Please try again shortly.`,
    })
  }
}
