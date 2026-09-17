import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'json'

    const courses = await prisma.course.findMany({
      include: {
        timetableSlots: true,
        attendance: true,
      },
    })

    if (format === 'csv') {
      let csv = 'CourseName,CourseCode,RequiredPercent,Date,Status,Note\n'
      for (const course of courses) {
        if (course.attendance.length === 0) {
          csv += `"${course.name}","${course.code}",${course.requiredPercent},"","",""\n`
        } else {
          for (const rec of course.attendance) {
            csv += `"${course.name}","${course.code}",${course.requiredPercent},"${rec.date}","${rec.status}","${rec.note || ''}"\n`
          }
        }
      }
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="rollbook-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    return NextResponse.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      courses,
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.courses || !Array.isArray(body.courses)) {
      return NextResponse.json(
        { error: 'Invalid backup file format' },
        { status: 400 }
      )
    }

    let restoredCount = 0
    for (const item of body.courses) {
      if (!item.name || !item.code) continue

      const course = await prisma.course.upsert({
        where: { code: item.code.toUpperCase() },
        update: {
          name: item.name,
          requiredPercent: item.requiredPercent || 75.0,
          color: item.color || '#3b82f6',
        },
        create: {
          name: item.name,
          code: item.code.toUpperCase(),
          requiredPercent: item.requiredPercent || 75.0,
          color: item.color || '#3b82f6',
        },
      })

      if (Array.isArray(item.timetableSlots)) {
        await prisma.timetableSlot.deleteMany({ where: { courseId: course.id } })
        for (const slot of item.timetableSlots) {
          await prisma.timetableSlot.create({
            data: {
              courseId: course.id,
              weekday: slot.weekday,
              label: slot.label,
              room: slot.room || null,
            },
          })
        }
      }

      if (Array.isArray(item.attendance)) {
        await prisma.attendanceRecord.deleteMany({ where: { courseId: course.id } })
        for (const rec of item.attendance) {
          await prisma.attendanceRecord.create({
            data: {
              courseId: course.id,
              date: rec.date,
              status: rec.status,
              note: rec.note || null,
            },
          })
        }
      }

      restoredCount++
    }

    return NextResponse.json({
      success: true,
      message: `Successfully restored ${restoredCount} course(s).`,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Failed to restore data' }, { status: 500 })
  }
}
