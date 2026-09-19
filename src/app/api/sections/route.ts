import { NextResponse } from 'next/server'
import { SECTION_LIST, OFFICIAL_SECTIONS } from '@/lib/officialTimetable'
import { requireUser } from '@/lib/session'

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  const sections = SECTION_LIST.map((code) => {
    const s = OFFICIAL_SECTIONS[code]
    return {
      code: s.code,
      coordinator: s.coordinator,
      defaultRoom: s.defaultRoom,
      group: s.group,
      courseCount: s.courses.length,
    }
  })
  return NextResponse.json({ sections })
}
