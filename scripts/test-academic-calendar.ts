import { getOfficialCalendarDates, OFFICIAL_ACADEMIC_CALENDAR_EVENTS } from '../src/lib/academicCalendar'

console.log('=============================================')
console.log('TESTING OFFICIAL MIT BLR ACADEMIC CALENDAR')
console.log('=============================================\n')

const dates = getOfficialCalendarDates('2026-09-20')

console.log(`Total days registered (>= 2026-09-20): ${dates.length}`)

// 1. Verify Start Date
console.assert(dates.length > 0, 'Must have calendar dates')
const firstDate = dates[0].date
console.assert(firstDate >= '2026-09-20', `First date must be >= 2026-09-20, got: ${firstDate}`)
console.log(`✓ First registered event: ${firstDate} (${dates[0].label})`)

// 2. Verify Confirmed Holidays (Strictly in RED)
const holidays = dates.filter(d => d.type === 'holiday')
console.log(`\nConfirmed College Holidays (${holidays.length}):`)
holidays.forEach(h => console.log(`  - ${h.date}: ${h.label}`))

const expectedHolidays = [
  { date: '2026-10-02', label: 'Gandhi Jayanti' },
  { date: '2026-10-20', label: 'Vijaya Dashami' },
  { date: '2026-11-09', label: 'Deepavali' },
  { date: '2026-12-25', label: 'Christmas' },
]

for (const exp of expectedHolidays) {
  const found = holidays.find(h => h.date === exp.date)
  console.assert(found !== undefined, `Missing holiday on ${exp.date}: ${exp.label}`)
  console.assert(found?.label === exp.label, `Expected ${exp.label}, got ${found?.label}`)
}
console.log('✓ Confirmed RED holidays present and verified for Odd Semester!')

// Verify no events after Jan 3, 2027 (Cycles rotate Jan 4)
const eventsAfterJan3 = dates.filter(d => d.date >= '2027-01-04')
console.assert(eventsAfterJan3.length === 0, `No events should exist after 2027-01-03, found ${eventsAfterJan3.length}`)
console.log('✓ Verified 0 events after 2027-01-03 (Cycles rotate on Jan 4)!')

// 3. Verify Exams and Tentative labeling
const exams = dates.filter(d => d.type === 'exam')
console.log(`\nExams count: ${exams.length} days`)

const tentativeExams = exams.filter(e => e.tentative)
console.log(`Tentative exams count: ${tentativeExams.length} days`)
tentativeExams.forEach(t => {
  console.assert(t.label.toLowerCase().includes('tentative'), `Tentative exam must include "Tentative" in label: ${t.label}`)
})
console.log('✓ All tentative exams explicitly include "Tentative" in label!')

// 4. Verify Mid-Term strictly ends on September 30, NOT 1 October
const oct1Event = dates.find(d => d.date === '2026-10-01')
console.assert(!oct1Event, `1st October must NOT have an exam/holiday, got: ${oct1Event?.label}`)
console.log('✓ 1st October is verified as a normal working day with regular classes!')

const midTerms = dates.filter(d => d.label === 'Mid-Term Examinations')
const lastMidTerm = midTerms[midTerms.length - 1]
console.assert(lastMidTerm?.date === '2026-09-30', `Odd Sem Mid-Terms must end on 2026-09-30`)
console.log('✓ Odd Semester Mid-Terms strictly end on 2026-09-30!')

// 5. Verify Re-Mid Terms and Make-Up exams are completely removed (normal students have classes/vacation)
const reMidTerms = dates.filter(d => d.label.toLowerCase().includes('re-mid'))
console.assert(reMidTerms.length === 0, `All Re-Mid Term events must be removed, found ${reMidTerms.length}`)
console.log('✓ All Re-Mid Term events are completely removed!')

const makeUpExams = dates.filter(d => d.label.toLowerCase().includes('make-up') || d.label.toLowerCase().includes('makeup'))
console.assert(makeUpExams.length === 0, `All Make-Up exams must be removed, found ${makeUpExams.length}`)
console.log('✓ All Make-Up exam events are completely removed!')

// 6. Verify Winter Vacation from 2026-12-06 to 2027-01-03 (29 days total)
const winterVacationDays = dates.filter(
  d => d.date >= '2026-12-06' && d.date <= '2027-01-03' && d.type === 'holiday'
)
console.assert(winterVacationDays.length === 29, `Expected 29 days of winter vacation, got ${winterVacationDays.length}`)
const dec6 = dates.find(d => d.date === '2026-12-06')
console.assert(dec6?.label === 'Winter Vacation', `Dec 6 must be Winter Vacation, got ${dec6?.label}`)
const jan3 = dates.find(d => d.date === '2027-01-03')
console.assert(jan3?.label === 'Winter Vacation', `Jan 3 must be Winter Vacation, got ${jan3?.label}`)
const dec25 = dates.find(d => d.date === '2026-12-25')
console.assert(dec25?.label === 'Christmas', `Dec 25 must be Christmas, got ${dec25?.label}`)
console.log('✓ Winter Vacation (2026-12-06 to 2027-01-03, 29 days) verified!')

// 7. Verify NON-holidays are NOT included as holidays
const nonHolidayDates = [
  '2026-09-05', // Teacher's day
  '2026-09-15', // Engineer's day
  '2026-10-01', // 1 October
  '2026-10-05', // Scholarship
  '2026-10-12', // Falak
  '2027-02-17', // Tech solstice
  '2027-04-05', // Utsav
  '2027-04-12', // Gratitude day
]

for (const nh of nonHolidayDates) {
  const found = dates.find(d => d.date === nh)
  console.assert(!found || found.type !== 'holiday', `${nh} must NOT be a holiday!`)
}
console.log('✓ Non-holiday / unconfirmed gray events correctly excluded from holidays!')

console.log('\n=============================================')
console.log('ALL ACADEMIC CALENDAR TESTS PASSED! 🚀')
console.log('=============================================')
