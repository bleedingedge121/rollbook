import { OFFICIAL_SECTIONS, SECTION_LIST } from '../src/lib/officialTimetable'
import { findBestMatch, normalizeCode } from '../src/lib/courseMatch'

console.log('Testing Section Import on All 22 Sections (Physics & Chemistry Cycles)...')

let totalErrors = 0
for (const secCode of SECTION_LIST) {
  const section = OFFICIAL_SECTIONS[secCode]
  const created: { id: string; name: string; code: string }[] = []
  const claimed = new Set<string>()

  for (const c of section.courses) {
    const available = created.filter(x => !claimed.has(x.id))
    const match = findBestMatch(c.name, c.code, available)
    let targetId = match ? match.course.id : null
    if (!targetId) {
      const newCourse = { id: `id-${c.code}`, name: c.name, code: normalizeCode(c.code) }
      created.push(newCourse)
      targetId = newCourse.id
    }
    claimed.add(targetId)
  }

  if (created.length !== 10) {
    console.error(`❌ Section ${secCode} (${section.group}) created ${created.length} courses instead of 10!`)
    totalErrors++
  } else {
    // verify PPS and PPS Lab both exist
    const hasPps = created.some(c => c.code === 'CES1102')
    const hasPpsLab = created.some(c => c.code === 'CES1111')
    if (!hasPps || !hasPpsLab) {
      console.error(`❌ Section ${secCode} missing PPS or PPS Lab!`)
      totalErrors++
    }
  }
}

if (totalErrors === 0) {
  console.log(`✓ All ${SECTION_LIST.length} sections (C01–C22 across Physics and Chem cycles) successfully generated exactly 10 distinct courses each with zero collisions!`)
} else {
  console.error(`Failed with ${totalErrors} errors.`)
}
