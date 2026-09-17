import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { courseId, weekday, label, room } = body

    const updated = await prisma.timetableSlot.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    await prisma.timetableSlot.delete({
      where: { id: params.id },
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
