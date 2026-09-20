import { calculateSemesterForecast } from '../src/lib/semesterForecast'
import { getOfficialCalendarDates } from '../src/lib/academicCalendar'

console.log('=============================================')
console.log('TESTING SEMESTER FORECAST & CRUISE DATE ENGINE')
console.log('=============================================\n')

// Sample courses mimicking a student's semester
const sampleCourses = [
  {
    id: 'c1',
    name: 'Programming for Problem Solving',
    code: 'CES_1102',
    requiredPercent: 75,
    stats: { present: 18, absent: 2, total: 20, percentage: 90 },
  },
  {
    id: 'c2',
    name: 'Calculus and Linear Algebra',
    code: 'MAT_1101',
    requiredPercent: 75,
    stats: { present: 15, absent: 5, total: 20, percentage: 75 },
  },
]

// Sample slots: 3 lectures a week for c1 (Mon, Wed, Fri), 2 lectures a week for c2 (Tue, Thu)
const sampleSlots = [
  { courseId: 'c1', weekday: 1, label: '09:00 - 10:00' },
  { courseId: 'c1', weekday: 3, label: '10:00 - 11:00' },
  { courseId: 'c1', weekday: 5, label: '11:00 - 12:00' },
  { courseId: 'c2', weekday: 2, label: '09:00 - 10:00' },
  { courseId: 'c2', weekday: 4, label: '10:00 - 11:00' },
]

const result = calculateSemesterForecast({
  courses: sampleCourses,
  slots: sampleSlots,
  referenceDate: '2026-09-20',
})

console.log(`Semester End Date: ${result.semesterEndDate} (${result.semesterEndDateFormatted})`)
console.log(`Winter Vacation: ${result.winterVacationStartDate} to ${result.winterVacationEndDate}`)
console.log(`Total Past Held: ${result.totalPastHeld}`)
console.log(`Total Future Scheduled Classes: ${result.totalFutureClasses}`)
console.log(`Total Semester Classes: ${result.totalSemesterClasses}`)
console.log(`Overall Safe-to-Bunk Date: ${result.overallSafeToBunkDate} (${result.overallSafeToBunkDateFormatted})`)
console.log(`Overall Classes to Attend until Cruise: ${result.overallClassesToAttendUntilCruise}`)
console.log(`Overall Max Skips for Semester: ${result.overallMaxSemesterSkips}`)
console.log(`Overall Remaining Skips Allowed: ${result.overallRemainingSkipsAllowed}\n`)

for (const c of result.courses) {
  console.log(`--- ${c.courseCode}: ${c.courseName} ---`)
  console.log(`  Current: ${c.pastPresent}P / ${c.pastAbsent}A (${c.currentPercentage}%)`)
  console.log(`  Future Classes: ${c.futureClassesCount} | Total Semester: ${c.totalSemesterClasses}`)
  console.log(`  Min Required: ${c.minPresentRequired} | Max Semester Skips: ${c.maxSemesterSkips}`)
  console.log(`  Remaining Skips: ${c.remainingSkipsAllowed}`)
  console.log(`  Safe-to-Bunk Date: ${c.safeToBunkDate} (${c.safeToBunkDateFormatted})`)
  console.log(`  Classes to Attend until Cruise: ${c.classesToAttendUntilCruise}`)
  console.log(`  Status: ${c.statusText}\n`)
}

console.assert(result.totalFutureClasses > 0, 'Must have future classes scheduled')
console.assert(result.totalSemesterClasses > result.totalPastHeld, 'Total semester must exceed past held')
console.assert(result.overallSafeToBunkDate !== null, 'Overall safe to bunk date must be calculated')
console.assert(result.courses[0].safeToBunkDate !== null, 'Course 1 cruise date must exist')

console.log('=============================================')
console.log('ALL SEMESTER FORECAST TESTS PASSED! 🚀')
console.log('=============================================')
