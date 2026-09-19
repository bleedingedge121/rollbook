import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OFFICIAL_SECTIONS } from '@/lib/officialTimetable'
import { findBestMatch, normalizeCode } from '@/lib/courseMatch'
import { requireUser } from '@/lib/session'
import { formatSlotTime } from '@/lib/formatters'

interface ApplyRequest {
  section: string
  apply?: boolean
  // Optional per-course override: incoming course code -> existing courseId | 'NEW' | 'SKIP'
  merges?: Record<string, string>
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const body: ApplyRequest = await req.json()
    const { section, apply, merges } = body

    const sectionData = OFFICIAL_SECTIONS[section]
    if (!sectionData) {
      return NextResponse.json({ error: `Unknown section "${section}"` }, { status: 400 })
    }

    const existingCourses = await prisma.course.findMany({
      where: { userId },
      select: { id: true, name: true, code: true },
    })

    // Build a diff: for each course in the section, is it an exact match,
    // a suggested (fuzzy) match, or new?
    const diff = sectionData.courses.map((c) => {
      const match = findBestMatch(c.name, c.code, existingCourses)
      return {
        officialCode: c.code,
        officialName: c.name,
        short: c.short,
        matchType: match ? match.matchType : 'none',
        matchedCourseId: match ? match.course.id : null,
        matchedCourseName: match ? match.course.name : null,
        confidence: match ? match.confidence : 0,
      }
    })

    if (!apply) {
      return NextResponse.json({
        section,
        coordinator: sectionData.coordinator,
        defaultRoom: sectionData.defaultRoom,
        diff,
      })
    }

    // Apply: resolve each course to a target courseId (existing or newly created),
    // then replace timetable slots for exactly those courses with the official schedule.
    const shortToCourseId: Record<string, string> = {}

    for (const c of sectionData.courses) {
      const decision = merges?.[c.code] // 'NEW' | 'SKIP' | existing courseId | undefined
      if (decision === 'SKIP') continue

      let targetId: string | null = null

      if (decision && decision !== 'NEW' && decision !== 'SKIP') {
        // Ensure the specified course belongs to this user
        const isUserCourse = existingCourses.some((ec) => ec.id === decision)
        targetId = isUserCourse ? decision : null
      } else if (decision === 'NEW') {
        targetId = null // force create below
      } else {
        // No explicit decision: use the auto-match from diff
        const match = findBestMatch(c.name, c.code, existingCourses)
        targetId = match ? match.course.id : null
      }

      if (!targetId) {
        const created = await prisma.course.create({
          data: {
            userId,
            name: c.name,
            code: normalizeCode(c.code),
            requiredPercent: 75.0,
          },
        })
        targetId = created.id
        existingCourses.push({ id: created.id, name: created.name, code: created.code })
      }

      shortToCourseId[c.short] = targetId
    }

    // Replace timetable slots ONLY for the courses touched by this section import,
    // ensuring they belong to this user.
    const touchedCourseIds = Array.from(new Set(Object.values(shortToCourseId)))
    if (touchedCourseIds.length > 0) {
      await prisma.timetableSlot.deleteMany({
        where: {
          courseId: { in: touchedCourseIds },
          course: { userId },
        },
      })
    }

    const slotsToCreate = sectionData.slots
      .filter((s) => shortToCourseId[courseCodeToShort(sectionData, s.courseCode)])
      .map((s) => ({
        courseId: shortToCourseId[courseCodeToShort(sectionData, s.courseCode)],
        weekday: s.weekday,
        label: formatSlotTime(s.label),
        room: s.room || sectionData.defaultRoom,
      }))

    if (slotsToCreate.length > 0) {
      await prisma.timetableSlot.createMany({ data: slotsToCreate })
    }

    return NextResponse.json({
      success: true,
      message: `Applied official timetable for ${section}: ${touchedCourseIds.length} subject(s), ${slotsToCreate.length} weekly slot(s).`,
      coursesTouched: touchedCourseIds.length,
      slotsCreated: slotsToCreate.length,
    })
  } catch (error) {
    console.error('Section apply error:', error)
    return NextResponse.json({ error: 'Failed to apply section timetable' }, { status: 500 })
  }
}

function courseCodeToShort(section: (typeof OFFICIAL_SECTIONS)[string], code: string): string {
  const c = section.courses.find((x) => x.code === code)
  return c?.short || code
}
