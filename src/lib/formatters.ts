// src/lib/formatters.ts — Standardized date & time formatting across Roll Book

export function toValidDate(date: Date | string): Date {
  if (date instanceof Date) return date
  if (typeof date === 'string') {
    // If format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number)
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
