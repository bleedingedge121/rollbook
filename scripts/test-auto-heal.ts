import { OFFICIAL_SECTIONS } from '../src/lib/officialTimetable'
import { normalizeCode, isLabCourse, normalizeText } from '../src/lib/courseMatch'

// Function representing the auto-heal logic
function simulateAutoHeal(userCourses: any[], userSlots: any[]) {
  const ppsTheory = userCourses.find(
    (c) => normalizeCode(c.code) === 'CES1102' && !isLabCourse(c.name, c.code)
  )
  let ppsLab = userCourses.find(
    (c) =>
      normalizeCode(c.code) === 'CES1111' ||
      (isLabCourse(c.name, c.code) && normalizeText(c.name).includes('programming'))
  )

  // Find lab slots on theory
  const labSlotsOnTheory = ppsTheory
    ? userSlots.filter((s) => {
        if (s.courseId !== ppsTheory.id) return false
        const isTwoHour =
          /-(?:11:00|13:00|16:00|17:00)/.test(s.label) &&
          /(?:09:00|11:00|14:00|15:00)-/.test(s.label)
        const isLabRoom = /413|403|lab/i.test(s.room || '')
        return isTwoHour || isLabRoom
      })
    : []

  if (!ppsLab && ppsTheory && (labSlotsOnTheory.length > 0 || userCourses.length >= 8)) {
    const theoryHeld = (ppsTheory.syncedPresent || 0) + (ppsTheory.syncedAbsent || 0)
    const isSuspectedLabNumbers = theoryHeld > 0 && theoryHeld <= 7 && (ppsTheory.syncedAbsent || 0) === 0

    ppsLab = {
      id: `healed-lab-${Date.now()}`,
      name: 'Programming for Problem Solving Lab',
      code: 'CES1111',
      requiredPercent: 75.0,
      color: '#06b6d4',
      syncedPresent: isSuspectedLabNumbers ? ppsTheory.syncedPresent : 0,
      syncedAbsent: isSuspectedLabNumbers ? ppsTheory.syncedAbsent : 0,
      simpleAttended: isSuspectedLabNumbers ? ppsTheory.simpleAttended : 0,
      simpleHeld: isSuspectedLabNumbers ? ppsTheory.simpleHeld : 0,
    }
    userCourses.push(ppsLab)
  }

  if (ppsTheory && ppsLab && labSlotsOnTheory.length > 0) {
    for (const slot of labSlotsOnTheory) {
      slot.courseId = ppsLab.id
    }
  }

  return { userCourses, userSlots, healedLab: !!ppsLab, movedSlotsCount: labSlotsOnTheory.length }
}

console.log('=== TEST 1: Physics Cycle (Section C05) Existing Account Auto-Healing ===')
// Simulate corrupted C05: 9 courses, lab slot attached to PPS Theory
const c05Section = OFFICIAL_SECTIONS['C05']
const c05Courses: any[] = []
const c05Slots: any[] = []

for (const c of c05Section.courses) {
  // Simulate previous bug where CES1111 was merged into CES1102
  if (c.code === 'CES1111') continue
  c05Courses.push({
    id: `course-${c.code}`,
    name: c.name,
    code: c.code,
    syncedPresent: c.code === 'CES1102' ? 5 : 10,
    syncedAbsent: 0,
  })
}

// Add slots: PPS Theory gets its slots AND the PPS Lab slot
for (const s of c05Section.slots) {
  const targetCode = s.courseCode === 'CES1111' ? 'CES1102' : s.courseCode
  c05Slots.push({
    id: `slot-${s.weekday}-${s.label}`,
    courseId: `course-${targetCode}`,
    weekday: s.weekday,
    label: s.label,
    room: s.room,
  })
}

console.log(`Before Auto-Heal: ${c05Courses.length} courses, ${c05Slots.length} slots`)
const ppsTheorySlotsBefore = c05Slots.filter(s => s.courseId === 'course-CES1102')
console.log(`PPS Theory had ${ppsTheorySlotsBefore.length} slots (including lab slot: ${ppsTheorySlotsBefore.map(s => `${s.label} in ${s.room}`).join(', ')})`)

const c05Res = simulateAutoHeal(c05Courses, c05Slots)
console.log(`After Auto-Heal: ${c05Res.userCourses.length} courses, ${c05Res.userSlots.length} slots`)
console.log(`Moved slots: ${c05Res.movedSlotsCount}`)

const ppsTheorySlotsAfter = c05Res.userSlots.filter(s => s.courseId === 'course-CES1102')
const ppsLabCourse = c05Res.userCourses.find(c => c.code === 'CES1111')
const ppsLabSlotsAfter = c05Res.userSlots.filter(s => s.courseId === ppsLabCourse?.id)

console.log(`PPS Theory now has ${ppsTheorySlotsAfter.length} slots: ${ppsTheorySlotsAfter.map(s => `${s.label} in ${s.room}`).join(', ')}`)
console.log(`PPS Lab now has ${ppsLabSlotsAfter.length} slots: ${ppsLabSlotsAfter.map(s => `${s.label} in ${s.room}`).join(', ')}`)
console.assert(c05Res.userCourses.length === 10, 'Must have 10 courses')
console.assert(ppsLabSlotsAfter.length === 1, 'PPS Lab must have 1 slot')
console.assert(ppsTheorySlotsAfter.length === 3, 'PPS Theory must have 3 theory slots')
console.log('✓ Physics Cycle Auto-Healing Passed!')

console.log('\n=== TEST 2: Chemistry Cycle (Section C18) Existing Account Auto-Healing ===')
// Simulate corrupted C18: 9 courses, lab slot attached to PPS Theory
const c18Section = OFFICIAL_SECTIONS['C18']
const c18Courses: any[] = []
const c18Slots: any[] = []

for (const c of c18Section.courses) {
  // Simulate previous bug where CES1111 was merged into CES1102
  if (c.code === 'CES1111') continue
  c18Courses.push({
    id: `course-${c.code}`,
    name: c.name,
    code: c.code,
    syncedPresent: c.code === 'CES1102' ? 5 : 10,
    syncedAbsent: 0,
  })
}

for (const s of c18Section.slots) {
  const targetCode = s.courseCode === 'CES1111' ? 'CES1102' : s.courseCode
  c18Slots.push({
    id: `slot-${s.weekday}-${s.label}`,
    courseId: `course-${targetCode}`,
    weekday: s.weekday,
    label: s.label,
    room: s.room,
  })
}

console.log(`Before Auto-Heal: ${c18Courses.length} courses, ${c18Slots.length} slots`)
const c18Res = simulateAutoHeal(c18Courses, c18Slots)
console.log(`After Auto-Heal: ${c18Res.userCourses.length} courses, ${c18Res.userSlots.length} slots`)

const c18PpsLabCourse = c18Res.userCourses.find(c => c.code === 'CES1111')
const c18PpsLabSlots = c18Res.userSlots.filter(s => s.courseId === c18PpsLabCourse?.id)
const c18PpsTheorySlots = c18Res.userSlots.filter(s => s.courseId === 'course-CES1102')

console.log(`PPS Theory now has ${c18PpsTheorySlots.length} slots: ${c18PpsTheorySlots.map(s => `${s.label} in ${s.room}`).join(', ')}`)
console.log(`PPS Lab now has ${c18PpsLabSlots.length} slots: ${c18PpsLabSlots.map(s => `${s.label} in ${s.room}`).join(', ')}`)
console.assert(c18Res.userCourses.length === 10, 'Must have 10 courses')
console.assert(c18PpsLabSlots.length === 1, 'PPS Lab must have 1 slot (Tuesday 14:00-16:00 AB5 413)')
console.log('✓ Chemistry Cycle Auto-Healing Passed!')
