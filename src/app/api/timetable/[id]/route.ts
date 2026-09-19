import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, verifyCourseOwnership } from '@/lib/session'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const existing = await prisma.timetableSlot.findUnique({
      where: { id },
      include: { course: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Timetable slot not found' }, { status: 404 })
    }

    if (existing.course.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { courseId, weekday, label, room } = body

    if (courseId && courseId !== existing.courseId) {
      const isOwned = await verifyCourseOwnership(courseId, userId)
      if (!isOwned) {
        return NextResponse.json(
          { error: 'Forbidden: Target course does not belong to you' },
          { status: 403 }
        )
      }
    }

    const updated = await prisma.timetableSlot.update({
      where: { id },
      data: {
        ...(courseId && { courseId }),
        ...(weekday !== undefined && { weekday: parseInt(weekday, 10) }),
        ...(label && { label: label.trim() }),
        ...(room !== undefined && { room: room?.trim() || null }),
      },
      include: { course: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update timetable slot:', error)
    return NextResponse.json(
      { error: 'Failed to update timetable slot' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const existing = await prisma.timetableSlot.findUnique({
      where: { id },
      include: { course: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Timetable slot not found' }, { status: 404 })
    }

    if (existing.course.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.timetableSlot.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete timetable slot:', error)
    return NextResponse.json(
      { error: 'Failed to delete timetable slot' },
      { status: 500 }
    )
  }
}
