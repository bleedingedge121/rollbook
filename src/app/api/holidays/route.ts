import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { addDays, isBefore, isSameDay } from 'date-fns'

function parseIsoDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const holidays = await prisma.holiday.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(holidays)
  } catch (error) {
    console.error('Failed to fetch holidays:', error)
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const body = await req.json()
    const { date, startDate, endDate, label, type } = body

    const holidayLabel = (label || 'Holiday / No Class').trim()
    const holidayType = type || 'holiday'

    // Multi-day date range support
    if (startDate && endDate) {
      let current = parseIsoDate(startDate)
      const end = parseIsoDate(endDate)

      if (isNaN(current.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid start or end date format (use YYYY-MM-DD)' }, { status: 400 })
      }

      if (isBefore(end, current)) {
        return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
      }

      const dateList: string[] = []
      while (isBefore(current, end) || isSameDay(current, end)) {
        dateList.push(formatIsoDate(current))
        current = addDays(current, 1)
      }

      // Upsert all dates in the range atomically for this user
      const results = await prisma.$transaction(
        dateList.map((d) =>
          prisma.holiday.upsert({
            where: { userId_date: { userId, date: d } },
            update: {
              label: holidayLabel,
              type: holidayType,
            },
            create: {
              userId,
              date: d,
              label: holidayLabel,
              type: holidayType,
            },
          })
        )
      )

      return NextResponse.json({ success: true, count: results.length, holidays: results }, { status: 201 })
    }

    // Single day
    if (!date) {
      return NextResponse.json({ error: 'Either "date" or "startDate" and "endDate" are required' }, { status: 400 })
    }

    const holiday = await prisma.holiday.upsert({
      where: { userId_date: { userId, date } },
      update: {
        label: holidayLabel,
        type: holidayType,
      },
      create: {
        userId,
        date,
        label: holidayLabel,
        type: holidayType,
      },
    })

    return NextResponse.json(holiday, { status: 201 })
  } catch (error) {
    console.error('Failed to save holiday:', error)
    return NextResponse.json({ error: 'Failed to save holiday' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const url = new URL(req.url)
    const queryIds = url.searchParams.get('ids')
    
    let idsToDelete: string[] = []
    if (queryIds) {
      idsToDelete = queryIds.split(',').map((id) => id.trim()).filter(Boolean)
    } else {
      try {
        const body = await req.json()
        if (Array.isArray(body.ids)) {
          idsToDelete = body.ids
        }
      } catch {}
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'No holiday IDs provided for deletion' }, { status: 400 })
    }

    const result = await prisma.holiday.deleteMany({
      where: {
        id: { in: idsToDelete },
        userId,
      },
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Failed to delete holidays:', error)
    return NextResponse.json({ error: 'Failed to delete holidays' }, { status: 500 })
  }
}
