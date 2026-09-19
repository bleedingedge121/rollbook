import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const course = await prisma.course.findFirst({
      where: { id, userId },
      include: {
        timetableSlots: {
          orderBy: [{ weekday: 'asc' }, { label: 'asc' }],
        },
        attendance: {
          orderBy: { date: 'asc' },
        },
      },
    })

    if (!course) {
      // Check if it exists for another user to return 403
      const existsElsewhere = await prisma.course.findUnique({
        where: { id },
        select: { id: true },
      })
      if (existsElsewhere) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    return NextResponse.json(course)
  } catch (error) {
    console.error('Failed to fetch course:', error)
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { id } = await params

  try {
    const existing = await prisma.course.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, code, requiredPercent, color, trackingMode, simpleHeld, simpleAttended } = body

    const updated = await prisma.course.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase() }),
        ...(requiredPercent !== undefined && {
          requiredPercent: parseFloat(requiredPercent),
        }),
        ...(color && { color }),
        ...(trackingMode && { trackingMode }),
        ...(simpleHeld !== undefined && { simpleHeld: Math.max(0, parseInt(simpleHeld, 10)) }),
        ...(simpleAttended !== undefined && { simpleAttended: Math.max(0, parseInt(simpleAttended, 10)) }),
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A course with this code already exists in your account' },
        { status: 400 }
      )
    }
    console.error('Failed to update course:', error)
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 })
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
    const existing = await prisma.course.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.course.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete course:', error)
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 })
  }
}
