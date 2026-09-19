import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const courses = await prisma.course.findMany({
      where: { userId },
      include: {
        timetableSlots: {
          orderBy: [{ weekday: 'asc' }, { label: 'asc' }],
        },
        attendance: {
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(courses)
  } catch (error) {
    console.error('Failed to fetch courses:', error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const body = await req.json()
    const { name, code, requiredPercent, color } = body

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and Code are required' },
        { status: 400 }
      )
    }

    const course = await prisma.course.create({
      data: {
        userId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        requiredPercent: requiredPercent ? parseFloat(requiredPercent) : 75.0,
        color: color || '#3b82f6',
      },
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A course with this code already exists in your account' },
        { status: 400 }
      )
    }
    console.error('Failed to create course:', error)
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
  }
}
