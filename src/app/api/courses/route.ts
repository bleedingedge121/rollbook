import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
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
        { error: 'A course with this code already exists' },
        { status: 400 }
      )
    }
    console.error('Failed to create course:', error)
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
  }
}
