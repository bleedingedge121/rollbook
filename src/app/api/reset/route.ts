import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { seedSample } = body

    // Execute atomic deletion of all user records
    await prisma.$transaction([
      prisma.attendanceRecord.deleteMany(),
      prisma.timetableSlot.deleteMany(),
      prisma.course.deleteMany(),
    ])

    if (seedSample) {
      // Re-seed standard initial course baseline if requested
      const coursesData = [
        {
          name: 'Engineering Physics',
          code: 'PHY1001',
          requiredPercent: 75.0,
          color: '#3b82f6',
          slots: [
            { weekday: 1, label: '09:00 - 10:00', room: 'AB4 403' },
            { weekday: 3, label: '11:00 - 12:00', room: 'AB4 403' },
            { weekday: 5, label: '10:00 - 11:00', room: 'AB4 403' },
          ],
        },
        {
          name: 'Linear Algebra & Calculus',
          code: 'MAT1001',
          requiredPercent: 75.0,
          color: '#8b5cf6',
          slots: [
            { weekday: 1, label: '10:00 - 11:00', room: 'AB4 403' },
            { weekday: 2, label: '09:00 - 10:00', room: 'AB4 403' },
            { weekday: 4, label: '14:00 - 15:00', room: 'AB4 403' },
          ],
        },
        {
          name: 'Problem Solving Using Computers',
          code: 'CSE1001',
          requiredPercent: 75.0,
          color: '#10b981',
          slots: [
            { weekday: 2, label: '11:00 - 12:00', room: 'AB4 403' },
            { weekday: 3, label: '14:00 - 16:00', room: 'CS Lab 2' },
            { weekday: 5, label: '09:00 - 10:00', room: 'AB4 403' },
          ],
        },
        {
          name: 'Basic Electrical & Electronics',
          code: 'ELE1001',
          requiredPercent: 75.0,
          color: '#f59e0b',
          slots: [
            { weekday: 1, label: '14:00 - 15:00', room: 'AB4 403' },
            { weekday: 3, label: '09:00 - 10:00', room: 'AB4 403' },
            { weekday: 4, label: '11:00 - 12:00', room: 'AB4 403' },
          ],
        },
        {
          name: 'Workshop Practice',
          code: 'MEC1001',
          requiredPercent: 75.0,
          color: '#ec4899',
          slots: [
            { weekday: 4, label: '09:00 - 12:00', room: 'Central Workshop' },
          ],
        },
      ]

      for (const item of coursesData) {
        const course = await prisma.course.create({
          data: {
            name: item.name,
            code: item.code,
            requiredPercent: item.requiredPercent,
            color: item.color,
          },
        })

        for (const slot of item.slots) {
          await prisma.timetableSlot.create({
            data: {
              courseId: course.id,
              weekday: slot.weekday,
              label: slot.label,
              room: slot.room,
            },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: seedSample
        ? 'All data reset and sample subjects reloaded successfully.'
        : 'All data has been completely cleared.',
    })
  } catch (error) {
    console.error('Reset database error:', error)
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    )
  }
}
