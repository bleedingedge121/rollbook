// src/lib/formatters.ts — Standardized date & time formatting across Roll Book

export function toValidDate(date: Date | string): Date {
  if (date instanceof Date) return date
  if (typeof date === 'string') {
    // If format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    // If format is DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [d, m, y] = date.split('/').map(Number)
      return new Date(y, m - 1, d)
    }
    return new Date(date)
  }
  return new Date()
}

/**
 * Format time in 12-hour am/pm format with lowercase am/pm, no leading zero on hour (e.g. "2:30 pm", "9:15 am")
 */
export function formatTime(date: Date | string): string {
  const d = toValidDate(date)
  if (isNaN(d.getTime())) return ''
  let hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  hours = hours ? hours : 12 // 0 becomes 12
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`
  return `${hours}:${minutesStr} ${ampm}`
}

/**
 * Converts timetable slot labels like "14:00 - 16:00", "09:00 - 09:50",
 * or "09:00 - 12:00 (Lab/Workshop)" into 12-hour am/pm format:
 * "2:00 pm - 4:00 pm", "9:00 am - 9:50 am", "9:00 am - 12:00 pm (Lab/Workshop)".
 */
export function formatSlotTime(slotStr: string | null | undefined): string {
  if (!slotStr) return ''
  return slotStr.replace(/\b(\d{1,2}):(\d{2})(?:\s*(am|pm))?\b/gi, (match, hStr, mStr, existingAmPm) => {
    const h = parseInt(hStr, 10)
    if (existingAmPm) {
      return `${h % 12 === 0 ? 12 : h % 12}:${mStr} ${existingAmPm.toLowerCase()}`
    }
    if (h < 0 || h > 23) return match
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${mStr} ${ampm}`
  })
}

/**
 * Format date in dd/mm/yyyy format (e.g. "19/09/2026")
 */
export function formatDate(date: Date | string): string {
  const d = toValidDate(date)
  if (isNaN(d.getTime())) return ''
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Combines date and time (e.g. "19/09/2026, 2:30 pm")
 */
export function formatDateTime(date: Date | string): string {
  const d = toValidDate(date)
  if (isNaN(d.getTime())) return ''
  return `${formatDate(d)}, ${formatTime(d)}`
}
