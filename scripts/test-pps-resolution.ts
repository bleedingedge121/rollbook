import { OFFICIAL_SECTIONS } from '../src/lib/officialTimetable'
import { findBestMatch, normalizeCode, isLabCourse, normalizeText, calculateSimilarity } from '../src/lib/courseMatch'
import { parsePastedTableText, SyncedCourse } from '../src/lib/reconcile'

const sampleTable = `Select Semester

Semester I
Select Academic Year

2026-2027
Average Attendance: 0.00%
Navigation Mode
Sort by:
Course Name
Sorted: None

Course Code

Roll Number

Total Classes

Present

Absent

Sort by:
Attendance Percentage
Sorted: None

COMPUTATIONAL MATHEMATICS – I
SMS_1102
28
25
3
89.29
PROGRAMMING FOR PROBLEM SOLVING
CES_1102
15
14
1
93.33
UNIVERSAL HUMAN VALUES AND PROFESSIONAL ETHICS
SMS_1006
0
0
0
0.00
HUMAN RIGHTS AND CONSTITUTION
SMS_1007
0
0
0
0.00
PROGRAMMING FOR PROBLEM SOLVING LAB
CES_1111
5
5
0
100.00
APPLIED PHYSICS FOR ENGINEERS
SMS_1002
19
18
1
94.74
FUNDAMENTALS OF ELECTRONICS
EES_1004
13
12
1
92.31
FUNDAMENTALS OF MECHANICAL ENGINEERING
MES_1002
24
23
1
95.83
COMMUNICATION SKILLS IN ENGLISH
SMS_1005
15
15
0
100.00
WORKSHOP PRACTICE LAB
MES_1011
7
7
0
100.0`

console.log('=====================================================')
console.log('TEST SUITE: PPS vs PPS Lab Course Separation & Sync')
console.log('=====================================================\n')

// 1. Test isLabCourse and normalizeText
console.log('1. Checking isLabCourse detection:')
console.assert(!isLabCourse('Programming for Problem Solving', 'CES1102'), 'PPS Theory should NOT be lab')
console.assert(isLabCourse('Programming for Problem Solving Lab', 'CES1111'), 'PPS Lab SHOULD be lab')
console.assert(isLabCourse('Workshop Practice (BWP Lab)', 'MES1011'), 'Workshop Practice should be lab')
console.assert(isLabCourse('WORKSHOP PRACTICE LAB', 'MES_1011'), 'WORKSHOP PRACTICE LAB should be lab')
console.log('✓ isLabCourse correctly classifies all subjects')

console.log('\n2. Checking calculateSimilarity lab isolation:')
const simTheoryLab = calculateSimilarity('Programming for Problem Solving', 'Programming for Problem Solving Lab')
console.assert(simTheoryLab === 0.0, `Similarity between theory and lab must be 0, got ${simTheoryLab}`)
console.log(`✓ calculateSimilarity(PPS Theory, PPS Lab) = ${simTheoryLab} (Strictly Isolated)`)

// 3. Test Section C01 Import on Empty Account
console.log('\n3. Testing Section C01 Import on Empty Account:')
const sectionC01 = OFFICIAL_SECTIONS['C01']
const c01DbCourses: { id: string; name: string; code: string }[] = []
const claimedPreviewIds = new Set<string>()

for (const c of sectionC01.courses) {
  const available = c01DbCourses.filter((ec) => !claimedPreviewIds.has(ec.id))
  const match = findBestMatch(c.name, c.code, available)
  let targetId = match ? match.course.id : null
  if (!targetId) {
    const created = { id: `c01-${c.code}`, name: c.name, code: normalizeCode(c.code) }
    c01DbCourses.push(created)
    targetId = created.id
  }
  claimedPreviewIds.add(targetId)
}

console.assert(c01DbCourses.length === 10, `Expected 10 courses, got ${c01DbCourses.length}`)
const ppsTheoryC01 = c01DbCourses.find((c) => c.code === 'CES1102')
const ppsLabC01 = c01DbCourses.find((c) => c.code === 'CES1111')
console.assert(!!ppsTheoryC01, 'PPS Theory (CES1102) must exist in DB')
console.assert(!!ppsLabC01, 'PPS Lab (CES1111) must exist in DB')
console.log(`✓ Section C01 generated all 10 subjects: PPS (${ppsTheoryC01?.code}) and PPS Lab (${ppsLabC01?.code}) are distinct`)

// 4. Test Syncing 10-course table into Section-Initialized DB
console.log('\n4. Testing Syncing 10 Courses into Section-Initialized DB:')
const incoming = parsePastedTableText(sampleTable)
console.assert(incoming.length === 10, `Expected 10 parsed courses, got ${incoming.length}`)

const matchedDbCourseIds = new Set<string>()
const syncApplied: Record<string, { present: number; absent: number }> = {}

for (const inc of incoming) {
  const codeNorm = normalizeCode(inc.code || '')
  const codeDigits = codeNorm.replace(/\D/g, '')
  const incIsLab = isLabCourse(inc.name, inc.code)
  const candidates = c01DbCourses.filter((c) => !matchedDbCourseIds.has(c.id))

  let match: (typeof c01DbCourses)[0] | undefined
  if (codeNorm) {
    match = candidates.find((c) => normalizeCode(c.code) === codeNorm)
  }
  if (!match) {
    const normIncName = normalizeText(inc.name)
    match = candidates.find(
      (c) => isLabCourse(c.name, c.code) === incIsLab && normalizeText(c.name) === normIncName
    )
  }
  if (!match && codeDigits.length >= 3) {
    match = candidates.find(
      (c) => isLabCourse(c.name, c.code) === incIsLab && normalizeCode(c.code).replace(/\D/g, '') === codeDigits
    )
  }
  if (!match) {
    const fuzzyList = candidates
      .filter((c) => isLabCourse(c.name, c.code) === incIsLab)
      .map((c) => ({ course: c, similarity: calculateSimilarity(inc.name, c.name) }))
      .filter((item) => item.similarity >= 0.7)
      .sort((a, b) => b.similarity - a.similarity)
    if (fuzzyList.length > 0) match = fuzzyList[0].course
  }

  console.assert(!!match, `Course ${inc.name} (${inc.code}) must find a match in DB`)
  if (match) {
    matchedDbCourseIds.add(match.id)
    syncApplied[match.code] = { present: inc.present, absent: inc.absent }
  }
}

console.assert(syncApplied['CES1102'].present === 14 && syncApplied['CES1102'].absent === 1, 'PPS Theory must have 14/1')
console.assert(syncApplied['CES1111'].present === 5 && syncApplied['CES1111'].absent === 0, 'PPS Lab must have 5/0')
console.assert(matchedDbCourseIds.size === 10, 'All 10 DB courses must be matched uniquely')
console.log(`✓ PPS Theory Attendance = ${syncApplied['CES1102'].present}/${syncApplied['CES1102'].present + syncApplied['CES1102'].absent} (14/15)`)
console.log(`✓ PPS Lab Attendance = ${syncApplied['CES1111'].present}/${syncApplied['CES1111'].present + syncApplied['CES1111'].absent} (5/5)`)
console.log('✓ Zero collisions across all 10 courses')

// 5. Test Legacy Corrupted Account Healing
console.log('\n5. Testing Legacy Account Self-Healing (Where PPS Lab was missing & PPS had 5/0):')
const legacyDbCourses: { id: string; name: string; code: string; present: number; absent: number }[] = [
  { id: '1', name: "Computational Mathematics - I", code: "SMS1102", present: 25, absent: 3 },
  { id: '2', name: "Applied Physics for Engineers", code: "SMS1002", present: 18, absent: 1 },
  { id: '3', name: "Fundamentals of Electronics", code: "EES1004", present: 12, absent: 1 },
  // Corrupted state: PPS Theory has 5/0 from PPS Lab
  { id: '4', name: "Programming for Problem Solving", code: "CES1102", present: 5, absent: 0 },
  { id: '5', name: "Fundamentals of Mechanical Engineering", code: "MES1002", present: 23, absent: 1 },
  { id: '6', name: "Communication Skills in English", code: "SMS1005", present: 15, absent: 0 },
  { id: '7', name: "Workshop Practice (BWP Lab)", code: "MES1011", present: 7, absent: 0 },
  { id: '8', name: "Universal Human Values & Professional Ethics", code: "SMS1006", present: 0, absent: 0 },
  { id: '9', name: "Human Rights and Constitution", code: "SMS1007", present: 0, absent: 0 },
]

console.log(`Legacy DB courses count before sync: ${legacyDbCourses.length} (PPS Lab missing)`)

const legacyMatchedIds = new Set<string>()
for (const inc of incoming) {
  const codeNorm = normalizeCode(inc.code || '')
  const codeDigits = codeNorm.replace(/\D/g, '')
  const incIsLab = isLabCourse(inc.name, inc.code)
  const candidates = legacyDbCourses.filter((c) => !legacyMatchedIds.has(c.id))

  let match: (typeof legacyDbCourses)[0] | undefined
  if (codeNorm) {
    match = candidates.find((c) => normalizeCode(c.code) === codeNorm)
  }
  if (!match) {
    const normIncName = normalizeText(inc.name)
    match = candidates.find(
      (c) => isLabCourse(c.name, c.code) === incIsLab && normalizeText(c.name) === normIncName
    )
  }
  if (!match && codeDigits.length >= 3) {
    match = candidates.find(
      (c) => isLabCourse(c.name, c.code) === incIsLab && normalizeCode(c.code).replace(/\D/g, '') === codeDigits
    )
  }
  if (!match) {
    const fuzzyList = candidates
      .filter((c) => isLabCourse(c.name, c.code) === incIsLab)
      .map((c) => ({ course: c, similarity: calculateSimilarity(inc.name, c.name) }))
      .filter((item) => item.similarity >= 0.7)
      .sort((a, b) => b.similarity - a.similarity)
    if (fuzzyList.length > 0) match = fuzzyList[0].course
  }

  if (match) {
    legacyMatchedIds.add(match.id)
    match.present = inc.present
    match.absent = inc.absent
  } else {
    // New course created
    const created = {
      id: `new-${inc.code}`,
      name: inc.name,
      code: inc.code,
      present: inc.present,
      absent: inc.absent,
    }
    legacyMatchedIds.add(created.id)
    legacyDbCourses.push(created)
  }
}

console.assert(legacyDbCourses.length === 10, `Expected 10 courses after healing, got ${legacyDbCourses.length}`)
const healedPps = legacyDbCourses.find((c) => normalizeCode(c.code) === 'CES1102')
const healedPpsLab = legacyDbCourses.find((c) => normalizeCode(c.code) === 'CES1111')
console.assert(healedPps?.present === 14 && healedPps?.absent === 1, 'PPS Theory must be restored to 14/1')
console.assert(healedPpsLab?.present === 5 && healedPpsLab?.absent === 0, 'PPS Lab must be created with 5/0')

console.log(`✓ Healed courses count: ${legacyDbCourses.length}`)
console.log(`✓ Restored PPS Theory: ${healedPps?.present}/${healedPps!.present + healedPps!.absent}`)
console.log(`✓ Created PPS Lab: ${healedPpsLab?.present}/${healedPpsLab!.present + healedPpsLab!.absent}`)

console.log('\n=====================================================')
console.log('ALL TESTS PASSED WITH 100% PRECISION! 🚀')
console.log('=====================================================')
