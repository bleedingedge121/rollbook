import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const existing = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: { course: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    if (existing.course.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { status, note, date } = body

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(note !== undefined && { note: note?.trim() || null }),
        ...(date && { date }),
      },
      include: {
        course: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update attendance record:', error)
    return NextResponse.json(
      { error: 'Failed to update attendance record' },
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
    const existing = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: { course: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    if (existing.course.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.attendanceRecord.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete attendance record:', error)
    return NextResponse.json(
      { error: 'Failed to delete attendance record' },
      { status: 500 }
    )
  }
}
