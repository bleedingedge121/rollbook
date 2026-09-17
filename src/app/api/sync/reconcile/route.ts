import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toDateString } from '@/lib/attendance'

interface SyncedCourse {
  name: string
  code: string
  present: number
  absent: number
}

interface ReconcileRequest {
  courses: SyncedCourse[]
  syncedAt?: string
  apply?: boolean
  selectedCourseCodes?: string[] // which courses to apply changes to
}

export async function POST(req: Request) {
  try {
    const body: ReconcileRequest = await req.json()
    const { courses: incomingCourses, syncedAt, apply, selectedCourseCodes } = body

    if (!Array.isArray(incomingCourses)) {
      return NextResponse.json(
        { error: 'Invalid payload: "courses" array is required' },
        { status: 400 }
      )
    }

    const dbCourses = await prisma.course.findMany({
      include: {
        attendance: true,
      },
    })

    const dbCourseMapByCode = new Map<string, typeof dbCourses[0]>()
    const dbCourseMapByName = new Map<string, typeof dbCourses[0]>()

    for (const c of dbCourses) {
      if (c.code) dbCourseMapByCode.set(c.code.toUpperCase().trim(), c)
      if (c.name) dbCourseMapByName.set(c.name.toLowerCase().trim(), c)
    }

    const diff = incomingCourses.map((inc) => {
      const codeUpper = (inc.code || '').toUpperCase().trim()
      const nameLower = (inc.name || '').toLowerCase().trim()

      const match =
        (codeUpper ? dbCourseMapByCode.get(codeUpper) : null) ||
        dbCourseMapByName.get(nameLower)

      const present = Math.max(0, inc.present || 0)
      const absent = Math.max(0, inc.absent || 0)
      const total = present + absent
      const syncedPct = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100

      if (match) {
        const currentPresent = match.attendance.filter((a) => a.status === 'present').length
        const currentAbsent = match.attendance.filter((a) => a.status === 'absent').length
        const currentTotal = currentPresent + currentAbsent
        const currentPct =
          currentTotal > 0 ? Number(((currentPresent / currentTotal) * 100).toFixed(1)) : 100

        const hasDiff = currentPresent !== present || currentAbsent !== absent

        return {
          status: 'match',
          courseId: match.id,
          name: match.name,
          code: match.code,
          syncedName: inc.name,
          syncedCode: inc.code,
          current: {
            present: currentPresent,
            absent: currentAbsent,
            total: currentTotal,
            pct: currentPct,
          },
          synced: {
            present,
            absent,
            total,
            pct: syncedPct,
          },
          hasDiff,
        }
      } else {
        return {
          status: 'new',
          courseId: null,
          name: inc.name,
          code: inc.code || inc.name.slice(0, 7).toUpperCase(),
          syncedName: inc.name,
          syncedCode: inc.code,
          current: {
            present: 0,
            absent: 0,
            total: 0,
            pct: 0,
          },
          synced: {
            present,
            absent,
            total,
            pct: syncedPct,
          },
          hasDiff: true,
        }
      }
    })

    // If apply is requested, execute updates
    if (apply) {
      const appliedCourses: any[] = []
      const today = toDateString(new Date())

      for (const item of diff) {
        // If specific codes selected, filter by them
        if (
          selectedCourseCodes &&
          selectedCourseCodes.length > 0 &&
          !selectedCourseCodes.includes(item.code) &&
          !selectedCourseCodes.includes(item.syncedCode)
        ) {
          continue
        }

        let targetCourseId = item.courseId

        // If new course, create it first
        if (!targetCourseId) {
          const newCourse = await prisma.course.create({
            data: {
              name: item.syncedName,
              code: (item.syncedCode || item.syncedName.slice(0, 6)).toUpperCase(),
              requiredPercent: 75.0,
            },
          })
          targetCourseId = newCourse.id
        }

        // Reconcile attendance records:
        // Delete existing and seed the exact verified count, or adjust delta
        // To maintain clean record counts matching the official portal:
        await prisma.attendanceRecord.deleteMany({
          where: { courseId: targetCourseId },
        })

        const recordsToCreate = []
        // Generate present records
        for (let i = 0; i < item.synced.present; i++) {
          recordsToCreate.push({
            courseId: targetCourseId,
            date: today,
            status: 'present',
            note: `Synced from SLCM (${syncedAt ? new Date(syncedAt).toLocaleDateString() : 'Sync'})`,
          })
        }
        // Generate absent records
        for (let i = 0; i < item.synced.absent; i++) {
          recordsToCreate.push({
            courseId: targetCourseId,
            date: today,
            status: 'absent',
            note: `Synced from SLCM (${syncedAt ? new Date(syncedAt).toLocaleDateString() : 'Sync'})`,
          })
        }

        if (recordsToCreate.length > 0) {
          await prisma.attendanceRecord.createMany({
            data: recordsToCreate,
          })
        }

        appliedCourses.push(item.code || item.syncedCode)
      }

      return NextResponse.json({
        success: true,
        message: `Successfully synchronized ${appliedCourses.length} course(s).`,
        applied: appliedCourses,
      })
    }

    return NextResponse.json({
      syncedAt: syncedAt || new Date().toISOString(),
      totalIncoming: incomingCourses.length,
      diff,
    })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile sync data' },
      { status: 500 }
    )
  }
}
