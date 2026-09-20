/**
 * src/lib/academicCalendar.ts
 *
 * Official MIT Bengaluru Academic Calendar (2026 - 2027)
 * Transcribed from the MAHE department calendar.
 *
 * Rules:
 * 1. Only confirmed holidays (in RED on calendar) are marked as type: 'holiday'.
 * 2. Unconfirmed/gray items (e.g. Teacher's Day, Engineer's Day, Falak, Tech Solstice, Re-quiz,
 *    Class Committee meetings) are NOT holidays.
 * 3. Exam periods are marked as type: 'exam'.
 * 4. Tentative exams (End-Sem, Make-up) explicitly include "Tentative" in their label.
 * 5. Starts strictly from September 20th, 2026 onwards.
 */

export interface CalendarEventDef {
  startDate: string // YYYY-MM-DD
  endDate?: string  // YYYY-MM-DD (inclusive)
  label: string
  type: 'holiday' | 'exam'
  tentative?: boolean
}

export const OFFICIAL_ACADEMIC_CALENDAR_EVENTS: CalendarEventDef[] = [
  // --- ODD SEMESTER (Sep 20, 2026 - Jan 2027) ---
  {
    startDate: '2026-09-23',
    endDate: '2026-09-30',
    label: 'Mid-Term Examinations',
    type: 'exam',
    tentative: false,
  },
  {
    startDate: '2026-10-02',
    label: 'Gandhi Jayanti',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2026-10-20',
    label: 'Vijaya Dashami',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2026-10-30',
    label: 'Lab End Semester Examinations',
    type: 'exam',
    tentative: false,
  },
  {
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    label: 'Lab End Semester Examinations',
    type: 'exam',
    tentative: false,
  },
  {
    startDate: '2026-11-09',
    label: 'Deepavali',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2026-11-14',
    endDate: '2026-11-28',
    label: 'Tentative End Semester Examinations',
    type: 'exam',
    tentative: true,
  },
  {
    startDate: '2026-12-18',
    endDate: '2027-01-02',
    label: 'Tentative Make-Up Examinations',
    type: 'exam',
    tentative: true,
  },
  {
    startDate: '2026-12-25',
    label: 'Christmas',
    type: 'holiday',
    tentative: false,
  },

  // --- EVEN SEMESTER (Jan 2027 - May 2027) ---
  {
    startDate: '2027-01-15',
    label: 'Makara Sankranthi',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2027-01-26',
    label: 'Republic Day',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2027-02-22',
    label: 'Holi',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2027-03-03',
    endDate: '2027-03-09',
    label: 'Mid-Term Examinations',
    type: 'exam',
    tentative: false,
  },
  {
    startDate: '2027-03-10',
    label: 'Ramzan',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2027-03-26',
    label: 'Good Friday',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2027-04-08',
    label: 'Ugadi',
    type: 'holiday',
    tentative: false,
  },
  {
    startDate: '2027-04-13',
    endDate: '2027-04-19',
    label: 'Lab End Semester Examinations',
    type: 'exam',
    tentative: false,
  },
  {
    startDate: '2027-04-24',
    endDate: '2027-05-08',
    label: 'Tentative End Semester Examinations',
    type: 'exam',
    tentative: true,
  },
  {
    startDate: '2027-05-17',
    label: 'Bakrid',
    type: 'holiday',
    tentative: false,
  },

  // --- SUMMER TERM (June - July 2027) ---
  {
    startDate: '2027-06-12',
    endDate: '2027-06-26',
    label: 'Tentative Make-Up Examinations',
    type: 'exam',
    tentative: true,
  },
]

export interface FlatCalendarEvent {
  date: string // YYYY-MM-DD
  label: string
  type: 'holiday' | 'exam'
  tentative?: boolean
}

/**
 * Returns all individual calendar day entries starting from September 20th, 2026.
 * Confirmed holidays strictly take precedence over overlapping exam windows (e.g. Christmas).
 */
export function getOfficialCalendarDates(cutoffDate = '2026-09-20'): FlatCalendarEvent[] {
  const dateMap = new Map<string, FlatCalendarEvent>()

  // 1. Process exam windows first
  const examEvents = OFFICIAL_ACADEMIC_CALENDAR_EVENTS.filter((e) => e.type === 'exam')
  for (const event of examEvents) {
    const start = new Date(`${event.startDate}T00:00:00`)
    const end = event.endDate ? new Date(`${event.endDate}T00:00:00`) : start

    const current = new Date(start)
    while (current <= end) {
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      // Skip Sundays from exam periods (Sundays are off days)
      if (current.getDay() !== 0 && dateStr >= cutoffDate && !dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          date: dateStr,
          label: event.label,
          type: 'exam',
          tentative: event.tentative,
        })
      }

      current.setDate(current.getDate() + 1)
    }
  }

  // 2. Process confirmed holidays second (so they take highest precedence)
  const holidayEvents = OFFICIAL_ACADEMIC_CALENDAR_EVENTS.filter((e) => e.type === 'holiday')
  for (const event of holidayEvents) {
    const start = new Date(`${event.startDate}T00:00:00`)
    const end = event.endDate ? new Date(`${event.endDate}T00:00:00`) : start

    const current = new Date(start)
    while (current <= end) {
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      if (dateStr >= cutoffDate) {
        dateMap.set(dateStr, {
          date: dateStr,
          label: event.label,
          type: 'holiday',
          tentative: false,
        })
      }

      current.setDate(current.getDate() + 1)
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}
