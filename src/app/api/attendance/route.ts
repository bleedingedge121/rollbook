import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, verifyCourseOwnership } from '@/lib/session'

export async function GET(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get('courseId')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const month = searchParams.get('month') // e.g. "2026-09"

    const whereClause: any = {
      course: { userId },
    }
    if (courseId) whereClause.courseId = courseId
    if (date) whereClause.date = date
    if (startDate && endDate) {
      whereClause.date = { gte: startDate, lte: endDate }
    } else if (month) {
      whereClause.date = { startsWith: month }
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
            requiredPercent: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch attendance records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance records' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const body = await req.json()

    // Handle batch logging if passed an array
    if (Array.isArray(body.records)) {
      // Validate all courses belong to this user first
      for (const rec of body.records) {
        if (!rec.courseId) continue
        const isOwned = await verifyCourseOwnership(rec.courseId, userId)
        if (!isOwned) {
          return NextResponse.json(
            { error: `Forbidden: Course "${rec.courseId}" does not belong to you.` },
            { status: 403 }
          )
        }
      }

      const created = []
      for (const rec of body.records) {
        if (!rec.courseId || !rec.date || !rec.status) continue

        // Delete existing record for this course + date to avoid duplicates
        await prisma.attendanceRecord.deleteMany({
          where: {
            courseId: rec.courseId,
            date: rec.date,
          },
        })

        const item = await prisma.attendanceRecord.create({
          data: {
            courseId: rec.courseId,
            date: rec.date,
            status: rec.status, // "present" | "absent"
            note: rec.note || null,
          },
        })
        created.push(item)
      }
      return NextResponse.json({ count: created.length, records: created }, { status: 201 })
    }

    const { courseId, date, status, note } = body
    if (!courseId || !date || !status) {
      return NextResponse.json(
        { error: 'courseId, date, and status (present/absent) are required' },
        { status: 400 }
      )
    }

    if (status !== 'present' && status !== 'absent') {
      return NextResponse.json(
        { error: 'status must be "present" or "absent"' },
        { status: 400 }
      )
    }

    // Verify course ownership
    const isOwned = await verifyCourseOwnership(courseId, userId)
    if (!isOwned) {
      return NextResponse.json(
        { error: 'Forbidden: Course does not belong to you' },
        { status: 403 }
      )
    }

    // Delete existing record for this course + date to avoid duplicates
    await prisma.attendanceRecord.deleteMany({
      where: {
        courseId,
        date,
      },
    })

    const record = await prisma.attendanceRecord.create({
      data: {
        courseId,
        date,
        status,
        note: note?.trim() || null,
      },
      include: {
        course: true,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Failed to create attendance record:', error)
    return NextResponse.json(
      { error: 'Failed to create attendance record' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const courseId = searchParams.get('courseId')

    if (!date && !courseId) {
      return NextResponse.json(
        { error: 'date or courseId query parameter is required' },
        { status: 400 }
      )
    }

    if (courseId) {
      const isOwned = await verifyCourseOwnership(courseId, userId)
      if (!isOwned) {
        return NextResponse.json(
          { error: 'Forbidden: Course does not belong to you' },
          { status: 403 }
        )
      }
    }

    const whereClause: any = {
      course: { userId },
    }
    if (date) whereClause.date = date
    if (courseId) whereClause.courseId = courseId

    const result = await prisma.attendanceRecord.deleteMany({
      where: whereClause,
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Failed to delete attendance records:', error)
    return NextResponse.json(
      { error: 'Failed to delete attendance records' },
      { status: 500 }
    )
  }
}
