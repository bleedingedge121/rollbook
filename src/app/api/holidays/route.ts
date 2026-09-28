import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, requireAdmin } from '@/lib/session'
import { addDays, isBefore, isSameDay } from 'date-fns'
import { getOfficialCalendarDates } from '@/lib/academicCalendar'

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

export async function GET(req?: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  try {
    let holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    })

    // Only seed initial official calendar if the Holiday table is completely empty!
    // What an admin deletes stays deleted, and what an admin adds stays added.
    if (holidays.length === 0) {
      const officialDates = getOfficialCalendarDates('2026-09-20')
      try {
        await prisma.holiday.createMany({
          data: officialDates.map((m) => ({
            date: m.date,
            label: m.label,
            type: m.type,
          })),
          skipDuplicates: true,
        })
        holidays = await prisma.holiday.findMany({
          orderBy: { date: 'asc' },
        })
      } catch (dbErr) {
        console.warn('Could not auto-seed official calendar events into DB:', dbErr)
        return NextResponse.json(
          officialDates.map((m, idx) => ({
            id: `official-${idx}-${m.date}`,
            date: m.date,
            label: m.label,
            type: m.type,
            createdAt: new Date().toISOString(),
          }))
        )
      }
    }

    return NextResponse.json(holidays)
  } catch (error) {
    console.error('Failed to fetch holidays:', error)
    // Resilient fallback returning official calendar dates directly with stable identifiers
    const fallback = getOfficialCalendarDates('2026-09-20').map((m, idx) => ({
      id: `official-${idx}-${m.date}`,
      date: m.date,
      label: m.label,
      type: m.type,
      createdAt: new Date().toISOString(),
    }))
    return NextResponse.json(fallback)
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { date, startDate, endDate, label, type } = body

    const holidayLabel = (label || 'Holiday / No Class').trim()
    const holidayType = type === 'exam' ? 'exam' : 'holiday'

    const dateList: string[] = []

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

      while (isBefore(current, end) || isSameDay(current, end)) {
        dateList.push(formatIsoDate(current))
        current = addDays(current, 1)
      }
    } else if (date) {
      const d = parseIsoDate(date)
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid date format (use YYYY-MM-DD)' }, { status: 400 })
      }
      dateList.push(formatIsoDate(d))
    } else {
      return NextResponse.json({ error: 'Either "date" or "startDate" and "endDate" are required' }, { status: 400 })
    }

    if (dateList.length === 0) {
      return NextResponse.json({ error: 'No valid dates provided' }, { status: 400 })
    }

    // Clear any existing entries for these dates first to ensure idempotent replacement
    await prisma.holiday.deleteMany({
      where: { date: { in: dateList } },
    }).catch(() => {})

    // Create new holiday rows
    await prisma.holiday.createMany({
      data: dateList.map((d) => ({
        date: d,
        label: holidayLabel,
        type: holidayType,
      })),
      skipDuplicates: true,
    })

    const createdHolidays = await prisma.holiday.findMany({
      where: { date: { in: dateList } },
      orderBy: { date: 'asc' },
    })

    if (dateList.length === 1 && createdHolidays.length > 0) {
      return NextResponse.json(createdHolidays[0], { status: 201 })
    }

    return NextResponse.json(
      { success: true, count: createdHolidays.length, holidays: createdHolidays },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Failed to save holiday:', error)
    return NextResponse.json({ error: error?.message || 'Failed to save holiday' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const url = new URL(req.url)
    const queryIds = url.searchParams.get('ids')
    const queryDates = url.searchParams.get('dates')
    const queryStartDate = url.searchParams.get('startDate')
    const queryEndDate = url.searchParams.get('endDate')

    let idsToDelete: string[] = []
    let datesToDelete: string[] = []

    if (queryIds) {
      idsToDelete.push(...queryIds.split(',').map((id) => id.trim()).filter(Boolean))
    }
    if (queryDates) {
      datesToDelete.push(...queryDates.split(',').map((d) => d.trim()).filter(Boolean))
    }

    try {
      const body = await req.json()
      if (Array.isArray(body.ids)) {
        idsToDelete.push(...body.ids.map((id: any) => String(id).trim()).filter(Boolean))
      }
      if (Array.isArray(body.dates)) {
        datesToDelete.push(...body.dates.map((d: any) => String(d).trim()).filter(Boolean))
      }
      if (body.startDate && body.endDate) {
        let current = parseIsoDate(body.startDate)
        const end = parseIsoDate(body.endDate)
        if (!isNaN(current.getTime()) && !isNaN(end.getTime())) {
          while (isBefore(current, end) || isSameDay(current, end)) {
            datesToDelete.push(formatIsoDate(current))
            current = addDays(current, 1)
          }
        }
      }
    } catch {}

    // Check query start/end date range
    if (queryStartDate && queryEndDate) {
      let current = parseIsoDate(queryStartDate)
      const end = parseIsoDate(queryEndDate)
      if (!isNaN(current.getTime()) && !isNaN(end.getTime())) {
        while (isBefore(current, end) || isSameDay(current, end)) {
          datesToDelete.push(formatIsoDate(current))
          current = addDays(current, 1)
        }
      }
    }

    // Extract any embedded ISO dates from synthetic IDs (e.g. "official-0-2026-09-20")
    for (const id of idsToDelete) {
      const match = id.match(/(\d{4}-\d{2}-\d{2})/)
      if (match) {
        datesToDelete.push(match[1])
      }
    }

    // Deduplicate
    idsToDelete = Array.from(new Set(idsToDelete))
    datesToDelete = Array.from(new Set(datesToDelete))

    if (idsToDelete.length === 0 && datesToDelete.length === 0) {
      return NextResponse.json({ error: 'No holiday IDs or dates provided for deletion' }, { status: 400 })
    }

    const whereConditions: any[] = []
    if (idsToDelete.length > 0) {
      whereConditions.push({ id: { in: idsToDelete } })
    }
    if (datesToDelete.length > 0) {
      whereConditions.push({ date: { in: datesToDelete } })
    }

    const result = await prisma.holiday.deleteMany({
      where: {
        OR: whereConditions,
      },
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error: any) {
    console.error('Failed to delete holidays:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete holidays' }, { status: 500 })
  }
}

