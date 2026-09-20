/**
 * src/lib/semesterForecast.ts
 *
 * Official MIT Bengaluru Odd Semester 2026 Attendance Forecasting Engine.
 *
 * Rules & Schedule:
 * - Semester Timeline: Starts Sep 20, 2026 -> Instruction ends Dec 5, 2026.
 * - Winter Vacation: Dec 6, 2026 to Jan 3, 2027 (College holiday / recess).
 * - Even Semester starts Jan 4, 2027 (Cycles rotate: new timetables, new subjects).
 *
 * Calculates:
 * 1. Total classes to be held across the semester per course and overall.
 * 2. Total classes you can afford to miss across the entire semester (Max Semester Skips).
 * 3. Remaining skips allowed between today and semester end.
 * 4. "Cruise Date" (Safe-to-Bunk Milestone): The exact calendar date until which a student
 *    must attend all upcoming classes so that they can safely skip ALL remaining classes
 *    until Dec 5 and still maintain >= 75% attendance.
 */

import { toDateString } from './attendance'
import { formatDate } from './formatters'
import { getOfficialCalendarDates, FlatCalendarEvent } from './academicCalendar'

export const SEMESTER_START_DATE = '2026-09-20'
export const SEMESTER_INSTRUCTION_END_DATE = '2026-12-05' // Odd Semester ends Dec 5, 2026
export const WINTER_VACATION_START_DATE = '2026-12-06'
export const WINTER_VACATION_END_DATE = '2027-01-03'

export interface FutureClassInstance {
  date: string // YYYY-MM-DD
  courseId: string
  weekday: number
  slotLabel: string
}

export interface CourseSemesterForecast {
  courseId: string
  courseName: string
  courseCode: string
  requiredPercent: number
  pastPresent: number
  pastAbsent: number
  pastHeld: number
  currentPercentage: number
  futureClassesCount: number
  totalSemesterClasses: number
  minPresentRequired: number
  maxSemesterSkips: number
  remainingSkipsAllowed: number
  isAlreadySecured: boolean
  isImpossible: boolean
  maxAchievablePercentage: number
  safeToBunkDate: string | null // YYYY-MM-DD
  safeToBunkDateFormatted: string | null // e.g. "24 Oct 2026"
  classesToAttendUntilCruise: number
  statusText: string
}

export interface SemesterForecastResult {
  semesterEndDate: string
  semesterEndDateFormatted: string
  winterVacationStartDate: string
  winterVacationEndDate: string
  totalSemesterClasses: number
  totalPastHeld: number
  totalPastPresent: number
  totalPastAbsent: number
  totalFutureClasses: number
  overallCurrentPct: number
  overallMinPresentRequired: number
  overallMaxSemesterSkips: number
  overallRemainingSkipsAllowed: number
  overallIsAlreadySecured: boolean
  overallSafeToBunkDate: string | null
  overallSafeToBunkDateFormatted: string | null
  overallClassesToAttendUntilCruise: number
  courses: CourseSemesterForecast[]
}

export interface CourseInput {
  id: string
  name: string
  code: string
  requiredPercent?: number
  stats?: {
    present: number
    absent: number
    total: number
    percentage: number
  }
  syncedPresent?: number | null
  syncedAbsent?: number | null
  simpleAttended?: number | null
  simpleHeld?: number | null
  trackingMode?: string
}

export interface SlotInput {
  id?: string
  courseId: string
  weekday: number
  label: string
}

export interface AttendanceInput {
  courseId: string
  date: string
  status: string
}

export interface HolidayInput {
  date: string
  label: string
  type: string
}

/**
 * Calculates complete semester projections for each subject and aggregate overall.
 */
export function calculateSemesterForecast(params: {
  courses: CourseInput[]
  slots: SlotInput[]
  attendanceRecords?: AttendanceInput[]
  holidays?: HolidayInput[]
  referenceDate?: string // YYYY-MM-DD (defaults to today or SEMESTER_START_DATE)
  semesterEndDate?: string // YYYY-MM-DD (defaults to SEMESTER_INSTRUCTION_END_DATE)
}): SemesterForecastResult {
  const {
    courses,
    slots,
    attendanceRecords = [],
    holidays = getOfficialCalendarDates('2026-09-20', '2027-01-03'),
    referenceDate = toDateString(new Date()),
    semesterEndDate = SEMESTER_INSTRUCTION_END_DATE,
  } = params

  const startDateStr = referenceDate < SEMESTER_START_DATE ? SEMESTER_START_DATE : referenceDate
  const holidayDateSet = new Set(holidays.map((h) => h.date))

  // Build a set of confirmed attendance keys for reference date check: `${courseId}_${date}`
  const confirmedAttendanceSet = new Set(
    attendanceRecords.map((a) => `${a.courseId}_${a.date}`)
  )

  // 1. Generate all upcoming scheduled class instances between startDate and semesterEndDate
  const futureClassInstances: FutureClassInstance[] = []

  const [startY, startM, startD] = startDateStr.split('-').map(Number)
  const [endY, endM, endD] = semesterEndDate.split('-').map(Number)

  const current = new Date(startY, startM - 1, startD)
  const end = new Date(endY, endM - 1, endD)

  while (current <= end) {
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const weekday = current.getDay()

    // Skip Sundays (no scheduled timetable classes)
    if (weekday !== 0 && !holidayDateSet.has(dateStr)) {
      const daySlots = slots.filter((s) => s.weekday === weekday)
      for (const slot of daySlots) {
        // If reference date is today and this class was already confirmed in attendanceRecords, skip
        if (dateStr === startDateStr && confirmedAttendanceSet.has(`${slot.courseId}_${dateStr}`)) {
          continue
        }

        futureClassInstances.push({
          date: dateStr,
          courseId: slot.courseId,
          weekday,
          slotLabel: slot.label,
        })
      }
    }

    current.setDate(current.getDate() + 1)
  }

  // Sort future class instances chronologically
  futureClassInstances.sort((a, b) => a.date.localeCompare(b.date))

  // 2. Process each course
  const courseForecasts: CourseSemesterForecast[] = courses.map((course) => {
    const reqPct = course.requiredPercent || 75

    // Resolve past numbers
    let pastPresent = 0
    let pastAbsent = 0
    if (course.stats) {
      pastPresent = course.stats.present
      pastAbsent = course.stats.absent
    } else if (course.trackingMode === 'simple') {
      const held = course.simpleHeld || 0
      const att = course.simpleAttended || 0
      pastPresent = att
      pastAbsent = Math.max(0, held - att)
    } else {
      const courseRecs = attendanceRecords.filter((a) => a.courseId === course.id)
      const manualPresent = courseRecs.filter((a) => a.status === 'present').length
      const manualAbsent = courseRecs.filter((a) => a.status === 'absent').length
      pastPresent = (course.syncedPresent || 0) + manualPresent
      pastAbsent = (course.syncedAbsent || 0) + manualAbsent
    }

    const pastHeld = pastPresent + pastAbsent
    const currentPercentage = pastHeld > 0 ? Number(((pastPresent / pastHeld) * 100).toFixed(1)) : 100

    // Future classes for this specific course
    const courseFutureClasses = futureClassInstances.filter((f) => f.courseId === course.id)
    const futureClassesCount = courseFutureClasses.length

    const totalSemesterClasses = pastHeld + futureClassesCount
    const minPresentRequired = Math.ceil(totalSemesterClasses * (reqPct / 100))
    const maxSemesterSkips = Math.max(0, totalSemesterClasses - minPresentRequired)
    const remainingSkipsAllowed = maxSemesterSkips - pastAbsent

    const isAlreadySecured = pastPresent >= minPresentRequired
    const maxAchievablePresent = pastPresent + futureClassesCount
    const maxAchievablePercentage =
      totalSemesterClasses > 0
        ? Number(((maxAchievablePresent / totalSemesterClasses) * 100).toFixed(1))
        : 100
    const isImpossible = maxAchievablePresent < minPresentRequired

    let safeToBunkDate: string | null = null
    let classesToAttendUntilCruise = 0

    if (isAlreadySecured) {
      safeToBunkDate = startDateStr
      classesToAttendUntilCruise = 0
    } else if (!isImpossible) {
      let cumulative = pastPresent
      for (const inst of courseFutureClasses) {
        cumulative++
        classesToAttendUntilCruise++
        if (cumulative >= minPresentRequired) {
          safeToBunkDate = inst.date
          break
        }
      }
    }

    let statusText = ''
    if (isAlreadySecured) {
      statusText = `Target ${reqPct}% attendance is already secured for the semester! You can skip all remaining classes.`
    } else if (isImpossible) {
      statusText = `Even with 100% attendance in all ${futureClassesCount} remaining classes, maximum achievable is ${maxAchievablePercentage}%.`
    } else if (safeToBunkDate) {
      statusText = `Attend the next ${classesToAttendUntilCruise} classes until ${formatDate(
        safeToBunkDate
      )}, then you can skip all remaining classes and finish at ≥${reqPct}%.`
    } else {
      statusText = `Must attend upcoming classes to reach ${minPresentRequired} total attendances.`
    }

    return {
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      requiredPercent: reqPct,
      pastPresent,
      pastAbsent,
      pastHeld,
      currentPercentage,
      futureClassesCount,
      totalSemesterClasses,
      minPresentRequired,
      maxSemesterSkips,
      remainingSkipsAllowed,
      isAlreadySecured,
      isImpossible,
      maxAchievablePercentage,
      safeToBunkDate,
      safeToBunkDateFormatted: safeToBunkDate ? formatDate(safeToBunkDate) : null,
      classesToAttendUntilCruise,
      statusText,
    }
  })

  // 3. Process Aggregate Overall
  let totalPastPresent = 0
  let totalPastAbsent = 0
  courseForecasts.forEach((c) => {
    totalPastPresent += c.pastPresent
    totalPastAbsent += c.pastAbsent
  })

  const totalPastHeld = totalPastPresent + totalPastAbsent
  const totalFutureClasses = futureClassInstances.length
  const totalSemesterClasses = totalPastHeld + totalFutureClasses
  const overallCurrentPct =
    totalPastHeld > 0 ? Number(((totalPastPresent / totalPastHeld) * 100).toFixed(1)) : 100

  const overallMinPresentRequired = Math.ceil(totalSemesterClasses * 0.75)
  const overallMaxSemesterSkips = Math.max(0, totalSemesterClasses - overallMinPresentRequired)
  const overallRemainingSkipsAllowed = overallMaxSemesterSkips - totalPastAbsent
  const overallIsAlreadySecured = totalPastPresent >= overallMinPresentRequired

  let overallSafeToBunkDate: string | null = null
  let overallClassesToAttendUntilCruise = 0

  if (overallIsAlreadySecured) {
    overallSafeToBunkDate = startDateStr
  } else {
    let cumulative = totalPastPresent
    for (const inst of futureClassInstances) {
      cumulative++
      overallClassesToAttendUntilCruise++
      if (cumulative >= overallMinPresentRequired) {
        overallSafeToBunkDate = inst.date
        break
      }
    }
  }

  return {
    semesterEndDate,
    semesterEndDateFormatted: formatDate(semesterEndDate),
    winterVacationStartDate: WINTER_VACATION_START_DATE,
    winterVacationEndDate: WINTER_VACATION_END_DATE,
    totalSemesterClasses,
    totalPastHeld,
    totalPastPresent,
    totalPastAbsent,
    totalFutureClasses,
    overallCurrentPct,
    overallMinPresentRequired,
    overallMaxSemesterSkips,
    overallRemainingSkipsAllowed,
    overallIsAlreadySecured,
    overallSafeToBunkDate,
    overallSafeToBunkDateFormatted: overallSafeToBunkDate ? formatDate(overallSafeToBunkDate) : null,
    overallClassesToAttendUntilCruise,
    courses: courseForecasts,
  }
}
