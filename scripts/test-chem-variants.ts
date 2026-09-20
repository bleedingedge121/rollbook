import { findBestMatch, calculateSimilarity } from '../src/lib/courseMatch'
import { CHEM_GROUP_COURSES } from '../src/lib/officialTimetable'

console.log('Testing Name-Only (no code) matching in Chemistry Cycle...')

const chemDb = CHEM_GROUP_COURSES.map((c, i) => ({
  id: `chem-${i}`,
  name: c.name,
  code: c.code,
}))

const nameOnlyCases = [
  { name: 'Computational Mathematics - I', expected: 'SMS1102' },
  { name: 'Applied Chemistry for Engineers', expected: 'SMS1004' },
  { name: 'Fundamentals of Electrical Engineering', expected: 'EES1002' },
  { name: 'Environmental Studies', expected: 'CCS1003' },
  { name: 'Engineering Mechanics and Smart Buildings', expected: 'CCS1002' },
  { name: 'Programming for Problem Solving', expected: 'CES1102' },
  { name: 'Programming for Problem Solving Lab', expected: 'CES1111' },
  { name: 'Computer Aided Engineering Graphics Lab', expected: 'MES1012' },
  { name: 'Universal Human Values & Professional Ethics', expected: 'SMS1006' },
  { name: 'Human Rights and Constitution', expected: 'SMS1007' },
]

for (const c of nameOnlyCases) {
  const match = findBestMatch(c.name, '', chemDb)
  console.log(`"${c.name}" ->`, match ? `[${match.course.code}] "${match.course.name}" (conf: ${match.confidence})` : 'NONE')
  if (match?.course.code !== c.expected) {
    console.error(`❌ Mismatch for "${c.name}"! Expected ${c.expected}, got ${match?.course.code}`)
  }
}
