export interface AttendanceStats {
  present: number
  absent: number
  total: number
  percentage: number
  requiredPercent: number
  isSafe: boolean
  maxSkippable: number
  mustAttendNext: number
  isImpossible: boolean
  statusText: string
  statusType: 'safe' | 'warning' | 'danger' | 'neutral'
}

/**
 * Core attendance formula implementation strictly adhering to Roll Book specifications:
 * - pct = present / (present + absent) * 100
 * - if pct >= required: maxSkippable = floor(present / (required/100) - total)
 * - else: mustAttendNext = ceil((required/100 * total - present) / (1 - required/100))
 */
export function calculateAttendance(
  present: number,
  absent: number,
  requiredPercent: number = 75
): AttendanceStats {
  const safePresent = Math.max(0, present)
  const safeAbsent = Math.max(0, absent)
  const total = safePresent + safeAbsent
  const reqFraction = Math.max(0.01, Math.min(100, requiredPercent)) / 100

  if (total === 0) {
    return {
      present: 0,
      absent: 0,
      total: 0,
      percentage: 100,
      requiredPercent,
      isSafe: true,
      maxSkippable: 0,
      mustAttendNext: 0,
      isImpossible: false,
      statusText: 'No classes held yet',
      statusType: 'neutral',
    }
  }

  const percentage = (safePresent / total) * 100
  const isSafe = percentage >= requiredPercent

  if (isSafe) {
    // maxSkippable = floor(present / (required/100) - total)
    const rawSkippable = Math.floor(safePresent / reqFraction - total)
    const maxSkippable = Math.max(0, rawSkippable)
    
    let statusText = ''
    if (maxSkippable === 0) {
      statusText = 'On the threshold. Cannot skip the next class.'
    } else if (maxSkippable === 1) {
      statusText = 'Can safely skip 1 class.'
    } else {
      statusText = `Can safely skip ${maxSkippable} classes.`
    }

    return {
      present: safePresent,
      absent: safeAbsent,
      total,
      percentage: Number(percentage.toFixed(1)),
      requiredPercent,
      isSafe: true,
      maxSkippable,
      mustAttendNext: 0,
      isImpossible: false,
      statusText,
      statusType: percentage - requiredPercent >= 5 ? 'safe' : 'warning',
    }
  } else {
    // mustAttendNext = ceil((required/100 * total - present) / (1 - required/100))
    if (reqFraction >= 1) {
      // Required is 100%, but absent > 0 -> Mathematically impossible to recover 100%
      return {
        present: safePresent,
        absent: safeAbsent,
        total,
        percentage: Number(percentage.toFixed(1)),
        requiredPercent,
        isSafe: false,
        maxSkippable: 0,
        mustAttendNext: 0,
        isImpossible: true,
        statusText: '100% attendance required; impossible to achieve once missed.',
        statusType: 'danger',
      }
    }

    const rawMustAttend = Math.ceil(
      (reqFraction * total - safePresent) / (1 - reqFraction)
    )
    const mustAttendNext = Math.max(1, rawMustAttend)
    const statusText = `Must attend next ${mustAttendNext} consecutive class${
      mustAttendNext === 1 ? '' : 'es'
    } to reach ${requiredPercent}%.`

    return {
      present: safePresent,
      absent: safeAbsent,
      total,
      percentage: Number(percentage.toFixed(1)),
      requiredPercent,
      isSafe: false,
      maxSkippable: 0,
      mustAttendNext,
      isImpossible: false,
      statusText,
      statusType: 'danger',
    }
  }
}

/**
 * Calculates projected attendance given actual confirmed records + planned future actions
 */
export function calculateProjectedAttendance(
  actualPresent: number,
  actualAbsent: number,
  plannedPresent: number,
  plannedAbsent: number,
  requiredPercent: number = 75
): AttendanceStats & {
  actualPercentage: number
  deltaPercentage: number
} {
  const actualStats = calculateAttendance(actualPresent, actualAbsent, requiredPercent)
  const totalPresent = actualPresent + Math.max(0, plannedPresent)
  const totalAbsent = actualAbsent + Math.max(0, plannedAbsent)
  const projectedStats = calculateAttendance(totalPresent, totalAbsent, requiredPercent)

  const actualPercentage = actualStats.percentage
  const deltaPercentage = Number((projectedStats.percentage - actualPercentage).toFixed(1))

  return {
    ...projectedStats,
    actualPercentage,
    deltaPercentage,
  }
}

/**
 * Helper to generate YYYY-MM-DD strings safely in local timezone
 */
export function toDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
