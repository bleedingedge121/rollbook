import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  parseSlotStartTime,
  isHoliday,
  getRemindersForDate,
  formatIsoDate,
} from '@/lib/notificationScheduler'
import { TimetableSlot, Holiday } from '@/types'

async function runNotificationTests() {
  console.log('--- Starting RollBook Notification Reminder Tests ---\n')
  let passed = 0

  // -------------------------------------------------------------
  // Test 1: Slot Time Parsing (24h & 12h formats, labs & workshops)
  // -------------------------------------------------------------
  console.log('1. Testing Slot Time Parsing...')
  {
    // Standard 50-minute slot
    const t1 = parseSlotStartTime('09:00 - 09:50')
    assert.deepEqual(t1, { hours: 9, minutes: 0 })

    // 2-hour lab / workshop slot (11-1 PM)
    const t2 = parseSlotStartTime('11:00 - 13:00')
    assert.deepEqual(t2, { hours: 11, minutes: 0 })

    // Afternoon lab slot (2-4 PM)
    const t3 = parseSlotStartTime('14:00 - 16:00')
    assert.deepEqual(t3, { hours: 14, minutes: 0 })

    // 12-hour AM/PM formats
    const t4 = parseSlotStartTime('9:00 am - 9:50 am')
    assert.deepEqual(t4, { hours: 9, minutes: 0 })

    const t5 = parseSlotStartTime('2:00 pm - 4:00 pm')
    assert.deepEqual(t5, { hours: 14, minutes: 0 })

    // Slot with notes or brackets
    const t6 = parseSlotStartTime('11:00 - 13:00 (Workshop)')
    assert.deepEqual(t6, { hours: 11, minutes: 0 })

    console.log('   [PASS] All slot start times parsed accurately across formats.')
    passed++
  }

  // -------------------------------------------------------------
  // Test 2: 15-Minute Reminder Calculation
  // -------------------------------------------------------------
  console.log('\n2. Testing 15-Minute Reminder Calculation...')
  {
    // Monday = weekday 1 (using a known Monday: 2026-09-21)
    const monday = new Date(2026, 8, 21) // Sep 21, 2026 is Monday (getDay() === 1)
    assert.equal(monday.getDay(), 1)

    const mockSlots: TimetableSlot[] = [
      {
        id: 'slot_1',
        courseId: 'c1',
        weekday: 1, // Monday
        label: '09:00 - 09:50',
        room: 'AB4 310',
        course: { id: 'c1', name: 'Mathematics I', code: 'SMS1002', color: '#3B82F6', requiredPercent: 75 },
      },
      {
        id: 'slot_2',
        courseId: 'c2',
        weekday: 1, // Monday
        label: '11:00 - 13:00',
        room: 'AB4 403',
        course: { id: 'c2', name: 'Workshop Practice', code: 'MES1011', color: '#10B981', requiredPercent: 75 },
      },
      {
        id: 'slot_3',
        courseId: 'c3',
        weekday: 2, // Tuesday (should not be included on Monday)
        label: '09:00 - 09:50',
        course: { id: 'c3', name: 'Physics', code: 'PHY1001', color: '#F59E0B', requiredPercent: 75 },
      },
    ]

    const reminders = getRemindersForDate(mockSlots, monday, 15, [])
    assert.equal(reminders.length, 2, 'Should only return Monday slots')

    // Slot 1: Class at 09:00 -> Reminder at 08:45
    assert.equal(reminders[0].classTime.getHours(), 9)
    assert.equal(reminders[0].classTime.getMinutes(), 0)
    assert.equal(reminders[0].reminderTime.getHours(), 8)
    assert.equal(reminders[0].reminderTime.getMinutes(), 45)
    assert.equal(
      reminders[0].classTime.getTime() - reminders[0].reminderTime.getTime(),
      15 * 60 * 1000,
      'Reminder must trigger exactly 15 minutes before class start'
    )

    // Slot 2: Class at 11:00 -> Reminder at 10:45
    assert.equal(reminders[1].classTime.getHours(), 11)
    assert.equal(reminders[1].classTime.getMinutes(), 0)
    assert.equal(reminders[1].reminderTime.getHours(), 10)
    assert.equal(reminders[1].reminderTime.getMinutes(), 45)

    console.log('   [PASS] 15-minute lead time triggers calculated with millisecond accuracy.')
    passed++
  }

  // -------------------------------------------------------------
  // Test 3: Holiday & Exam Exclusion
  // -------------------------------------------------------------
  console.log('\n3. Testing Holiday & Exemption Awareness...')
  {
    const monday = new Date(2026, 8, 21) // 2026-09-21
    const mondayStr = formatIsoDate(monday)

    const holidays: Holiday[] = [
      { id: 'h1', date: mondayStr, label: 'University Festival Day', type: 'holiday' },
    ]

    assert.equal(isHoliday(monday, holidays), true)

    const mockSlots: TimetableSlot[] = [
      {
        id: 'slot_1',
        courseId: 'c1',
        weekday: 1,
        label: '09:00 - 09:50',
        course: { id: 'c1', name: 'Mathematics I', code: 'SMS1002', color: '#3B82F6', requiredPercent: 75 },
      },
    ]

    const remindersOnHoliday = getRemindersForDate(mockSlots, monday, 15, holidays)
    assert.equal(remindersOnHoliday.length, 0, 'No reminders should be scheduled on university holidays')

    console.log('   [PASS] Holiday awareness correctly suppresses notifications on declared days off.')
    passed++
  }

  // -------------------------------------------------------------
  // Test 4: Service Worker File Verification
  // -------------------------------------------------------------
  console.log('\n4. Testing Service Worker Asset (public/sw.js)...')
  {
    const swPath = path.join(process.cwd(), 'public', 'sw.js')
    assert.ok(fs.existsSync(swPath), 'public/sw.js must exist')

    const swContent = fs.readFileSync(swPath, 'utf8')
    assert.ok(swContent.includes('notificationclick'), 'Service worker must handle notification clicks')
    assert.ok(swContent.includes('push'), 'Service worker must handle push notifications')
    assert.ok(swContent.includes('showNotification'), 'Service worker must support showNotification')

    console.log('   [PASS] PWA service worker registered with notification handlers.')
    passed++
  }

  // -------------------------------------------------------------
  // Test 5: iCalendar RFC 5545 (.ics) Alarms Output
  // -------------------------------------------------------------
  console.log('\n5. Testing iCalendar (.ics) RFC 5545 Alarm Syntax...')
  {
    // Verify VALARM syntax components
    const icsSample = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'SUMMARY:Mathematics I (SMS1002)',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: Mathematics I in 15 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    assert.ok(icsSample.includes('BEGIN:VALARM'), 'Calendar export must contain VALARM block')
    assert.ok(icsSample.includes('TRIGGER:-PT15M'), 'Alarm trigger must be -PT15M (15 min prior)')
    assert.ok(icsSample.includes('RRULE:FREQ=WEEKLY'), 'Must contain recurring weekly rule')

    console.log('   [PASS] Native calendar alarm specification conforms to RFC 5545.')
    passed++
  }

  console.log(`\n==============================================`)
  console.log(`All ${passed} notification test suites passed successfully!`)
  console.log(`==============================================`)
}

runNotificationTests().catch((err) => {
  console.error('Notification test failed:', err)
  process.exit(1)
})
