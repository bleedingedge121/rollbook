// src/app/api/calendar/export/route.ts
// Generates an RFC 5545 iCalendar (.ics) export containing the student's recurring weekly
// timetable with native 15-minute system alarms (-PT15M VALARM).
// Compatible with Apple Calendar (iOS/macOS), Google Calendar, and Windows/Outlook.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { parseSlotStartTime } from '@/lib/notificationScheduler'

const WEEKDAY_BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function parseSlotTimes(label: string): {
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
} {
  const match = label.trim().match(
    /(\d{1,2}):(\d{2})(?:\s*(am|pm))?\s*-\s*(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i
  )

  if (match) {
    let sH = parseInt(match[1], 10)
    const sM = parseInt(match[2], 10)
    const sAmPm = match[3]?.toLowerCase()

    let eH = parseInt(match[4], 10)
    const eM = parseInt(match[5], 10)
    const eAmPm = match[6]?.toLowerCase()

    if (sAmPm === 'pm' && sH < 12) sH += 12
    if (sAmPm === 'am' && sH === 12) sH = 0

    if (eAmPm === 'pm' && eH < 12) eH += 12
    if (eAmPm === 'am' && eH === 12) eH = 0

    return { startHour: sH, startMinute: sM, endHour: eH, endMinute: eM }
  }

  // Fallback: use parseSlotStartTime and add 50 minutes
  const start = parseSlotStartTime(label) || { hours: 9, minutes: 0 }
  let endHour = start.hours
  let endMinute = start.minutes + 50
  if (endMinute >= 60) {
    endHour += Math.floor(endMinute / 60)
    endMinute = endMinute % 60
  }

  return {
    startHour: start.hours,
    startMinute: start.minutes,
    endHour,
    endMinute,
  }
}

/**
 * Find the next upcoming calendar date matching the given weekday (0-6)
 */
function getNextWeekdayDate(weekday: number): Date {
  const now = new Date()
  const currentDay = now.getDay()
  let daysUntil = weekday - currentDay
  if (daysUntil < 0) {
    daysUntil += 7
  }
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil)
  return target
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function formatIcsDateTime(d: Date, hour: number, minute: number): string {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(hour)
  const min = pad(minute)
  return `${y}${m}${day}T${h}${min}00`
}

export async function GET(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const slots = await prisma.timetableSlot.findMany({
      where: {
        course: { userId },
      },
      include: {
        course: {
          select: {
            name: true,
            code: true,
            color: true,
          },
        },
      },
      orderBy: [{ weekday: 'asc' }, { label: 'asc' }],
    })

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RollBook//Class Timetable//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Roll Book Classes',
      'X-WR-TIMEZONE:Asia/Kolkata',
    ]

    const nowStamp = formatIcsDateTime(new Date(), new Date().getHours(), new Date().getMinutes()) + 'Z'

    for (const slot of slots) {
      const byDay = WEEKDAY_BYDAY[slot.weekday] || 'MO'
      const baseDate = getNextWeekdayDate(slot.weekday)
      const times = parseSlotTimes(slot.label)

      const dtStart = formatIcsDateTime(baseDate, times.startHour, times.startMinute)
      const dtEnd = formatIcsDateTime(baseDate, times.endHour, times.endMinute)
      const summary = `${slot.course?.name || 'Class'}${slot.course?.code ? ` (${slot.course.code})` : ''}`
      const location = slot.room ? slot.room.replace(/[,;]/g, ' ') : ''
      const uid = `rb-slot-${slot.id}@rollbook.app`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTAMP:${nowStamp}`)
      lines.push(`DTSTART:${dtStart}`)
      lines.push(`DTEND:${dtEnd}`)
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`)
      lines.push(`SUMMARY:${summary}`)
      if (location) lines.push(`LOCATION:${location}`)
      lines.push('DESCRIPTION:Class timetable schedule tracked in Roll Book.')
      lines.push('STATUS:CONFIRMED')

      // Native 15-minute alarm (triggers on iOS, Apple Watch, Android, and Windows)
      lines.push('BEGIN:VALARM')
      lines.push('TRIGGER:-PT15M')
      lines.push('ACTION:DISPLAY')
      lines.push(`DESCRIPTION:Reminder: ${summary} in 15 minutes`)
      lines.push('END:VALARM')

      lines.push('END:VEVENT')
    }

    lines.push('END:VCALENDAR')

    const icsContent = lines.join('\r\n')

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="rollbook-classes.ics"',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Failed to export calendar .ics:', error)
    return NextResponse.json({ error: 'Failed to generate calendar export' }, { status: 500 })
  }
}
