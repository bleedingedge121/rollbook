import { OFFICIAL_SECTIONS } from '../src/lib/officialTimetable';
import { calculateSemesterForecast } from '../src/lib/semesterForecast';

const section = OFFICIAL_SECTIONS['C01'];
const courses = section.courses.map((c, i) => ({
  id: 'course_' + c.code,
  name: c.name,
  code: c.code,
  requiredPercent: 75,
  stats: {
    present: i === 0 ? 15 : 12,
    absent: i === 0 ? 1 : 0,
    total: i === 0 ? 16 : 12,
    percentage: i === 0 ? 93.8 : 100,
  },
  trackingMode: 'detailed',
}));

const slots = section.slots.map((s, i) => ({
  id: 'slot_' + i,
  courseId: 'course_' + s.courseCode,
  weekday: s.weekday,
  label: s.label,
}));

const result = calculateSemesterForecast({
  courses,
  slots,
  referenceDate: '2026-09-20',
});

console.log('Overall totalSemesterClasses:', result.totalSemesterClasses);
console.log('Overall totalPastHeld:', result.totalPastHeld);
console.log('Overall totalFutureClasses:', result.totalFutureClasses);
console.log('Overall safeToBunkDate:', result.overallSafeToBunkDate, result.overallSafeToBunkDateFormatted);
console.log('Overall remaining skips:', result.overallRemainingSkipsAllowed);
console.log('\nPer-course details:');
result.courses.forEach((c) => {
  console.log(
    `[${c.courseCode}] ${c.courseName.slice(0, 25).padEnd(25)} | Held: ${c.pastHeld}, Future: ${c.futureClassesCount}, Total: ${c.totalSemesterClasses} | MinReq: ${c.minPresentRequired}, MaxSkips: ${c.maxSemesterSkips}, RemSkips: ${c.remainingSkipsAllowed} | Cruise: ${c.safeToBunkDateFormatted || 'N/A'} (need ${c.classesToAttendUntilCruise})`
  );
});
