import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(holidays)
  } catch (error) {
    console.error('Failed to fetch holidays:', error)
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { date, label, type } = body

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const holiday = await prisma.holiday.upsert({
      where: { date },
      update: {
        label: (label || 'Holiday / No Class').trim(),
        type: type || 'holiday',
      },
      create: {
        date,
        label: (label || 'Holiday / No Class').trim(),
        type: type || 'holiday',
      },
    })

    return NextResponse.json(holiday, { status: 201 })
  } catch (error) {
    console.error('Failed to save holiday:', error)
    return NextResponse.json({ error: 'Failed to save holiday' }, { status: 500 })
  }
}
