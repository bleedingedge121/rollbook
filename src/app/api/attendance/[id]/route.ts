import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { status, note, date } = body

    const updated = await prisma.attendanceRecord.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    await prisma.attendanceRecord.delete({
      where: { id: params.id },
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
