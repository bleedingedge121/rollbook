import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, verifyCourseOwnership } from '@/lib/session'

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const slots = await prisma.timetableSlot.findMany({
      where: {
        course: { userId },
      },
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
      orderBy: [{ weekday: 'asc' }, { label: 'asc' }],
    })

    return NextResponse.json(slots)
  } catch (error) {
    console.error('Failed to fetch timetable slots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timetable slots' },
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
    const { courseId, weekday, label, room } = body

    if (!courseId || weekday === undefined || !label) {
      return NextResponse.json(
        { error: 'courseId, weekday (0-6), and label are required' },
        { status: 400 }
      )
    }

    const isOwned = await verifyCourseOwnership(courseId, userId)
    if (!isOwned) {
      return NextResponse.json(
        { error: 'Forbidden: Course does not belong to you' },
        { status: 403 }
      )
    }

    const slot = await prisma.timetableSlot.create({
      data: {
        courseId,
        weekday: parseInt(weekday, 10),
        label: label.trim(),
        room: room?.trim() || null,
      },
      include: {
        course: true,
      },
    })

    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    console.error('Failed to create timetable slot:', error)
    return NextResponse.json(
      { error: 'Failed to create timetable slot' },
      { status: 500 }
    )
  }
}
