// src/lib/notificationScheduler.ts
// Engine for class reminder notifications, audio chimes, timetable parsing, and PWA integration.

import { TimetableSlot, Holiday } from '@/types'
import { formatSlotTime } from './formatters'

export interface ScheduledReminder {
  slot: TimetableSlot
  courseName: string
  courseCode: string
  room?: string | null
  classTime: Date
  reminderTime: Date
  leadMinutes: number
  key: string
}

export interface NotificationSettings {
  enabled: boolean
  leadMinutes: number
  sound: boolean
}

export const NOTIF_STORAGE_KEYS = {
  ENABLED: 'rollbook_reminders_enabled',
  LEAD_MINS: 'rollbook_reminders_lead_mins',
  SOUND: 'rollbook_reminders_sound',
  SENT_PREFIX: 'rollbook_notif_sent_',
}

/**
 * Format a Date to YYYY-MM-DD for storage keys & date matching
 */
export function formatIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Extract the start time (hour & minute) from a slot label.
 * Handles formats such as:
 * - "09:00 - 09:50"
 * - "11:00 - 13:00"
 * - "14:00 - 16:00"
 * - "9:00 am - 9:50 am"
 * - "2:00 pm - 4:00 pm"
 */
export function parseSlotStartTime(label: string): { hours: number; minutes: number } | null {
  if (!label) return null
  const match = label.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const ampm = match[3]?.toLowerCase()

  if (ampm === 'pm' && hours < 12) hours += 12
  if (ampm === 'am' && hours === 12) hours = 0

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

/**
 * Checks if a given date is marked as a holiday or exam day
 */
export function isHoliday(date: Date, holidays: Holiday[] = []): boolean {
  if (!holidays || holidays.length === 0) return false
  const dateStr = formatIsoDate(date)
  return holidays.some((h) => h.date === dateStr)
}

/**
 * Calculates upcoming class reminders for a given day
 */
export function getRemindersForDate(
  slots: TimetableSlot[],
  date: Date,
  leadMinutes: number = 15,
  holidays: Holiday[] = []
): ScheduledReminder[] {
  if (!slots || slots.length === 0) return []
  if (isHoliday(date, holidays)) return []

  const weekday = date.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  const daySlots = slots.filter((s) => s.weekday === weekday)
  const reminders: ScheduledReminder[] = []

  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const dateStr = formatIsoDate(date)

  for (const slot of daySlots) {
    const parsed = parseSlotStartTime(slot.label)
    if (!parsed) continue

    const classTime = new Date(y, m, d, parsed.hours, parsed.minutes, 0, 0)
    const reminderTime = new Date(classTime.getTime() - leadMinutes * 60 * 1000)

    const courseName = slot.course?.name || 'Class'
    const courseCode = slot.course?.code || ''
    const key = `${NOTIF_STORAGE_KEYS.SENT_PREFIX}${slot.id}_${dateStr}`

    reminders.push({
      slot,
      courseName,
      courseCode,
      room: slot.room,
      classTime,
      reminderTime,
      leadMinutes,
      key,
    })
  }

  // Sort by reminder time ascending
  return reminders.sort((a, b) => a.reminderTime.getTime() - b.reminderTime.getTime())
}

/**
 * Synthesize a soft 2-tone chime using Web Audio API (880Hz -> 1320Hz)
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime

    // Tone 1: A5 (880 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.18)

    // Tone 2: E6 (1320 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1320, now + 0.12)
    gain2.gain.setValueAtTime(0, now + 0.12)
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.4)
  } catch (err) {
    console.warn('[RollBook] Web Audio chime could not play:', err)
  }
}

/**
 * Trigger device vibration if supported
 */
export function triggerVibration(pattern: number[] = [200, 100, 200]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {}
}

/**
 * Dispatch a system notification via Service Worker or Notification API
 */
export async function sendSystemNotification(
  title: string,
  options: {
    body: string
    tag?: string
    playSound?: boolean
    vibrate?: boolean
  }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  if (options.playSound !== false) {
    playNotificationChime()
  }

  if (options.vibrate !== false) {
    triggerVibration()
  }

  const notificationOptions: any = {
    body: options.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: options.tag || 'rollbook-reminder',
    vibrate: [200, 100, 200],
    renotify: true,
    data: { url: '/' },
  }

  // Try service worker showNotification first (essential on mobile Android / iOS PWA)
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notificationOptions)
        return true
      }
    }
  } catch (swErr) {
    console.warn('[RollBook] Service worker showNotification failed, falling back to window Notification:', swErr)
  }

  // Fallback to desktop Notification constructor
  try {
    const notif = new Notification(title, notificationOptions)
    notif.onclick = () => {
      window.focus()
      notif.close()
    }
    return true
  } catch (notifErr) {
    console.error('[RollBook] Notification constructor failed:', notifErr)
    return false
  }
}

/**
 * Read stored notification settings
 */
export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') {
    return { enabled: true, leadMinutes: 15, sound: true }
  }

  const enabled = localStorage.getItem(NOTIF_STORAGE_KEYS.ENABLED) !== 'false'
  const lead = parseInt(localStorage.getItem(NOTIF_STORAGE_KEYS.LEAD_MINS) || '15', 10)
  const sound = localStorage.getItem(NOTIF_STORAGE_KEYS.SOUND) !== 'false'

  return {
    enabled,
    leadMinutes: isNaN(lead) ? 15 : lead,
    sound,
  }
}

/**
 * Save notification settings
 */
export function saveNotificationSettings(settings: Partial<NotificationSettings>): void {
  if (typeof window === 'undefined') return

  if (settings.enabled !== undefined) {
    localStorage.setItem(NOTIF_STORAGE_KEYS.ENABLED, String(settings.enabled))
  }
  if (settings.leadMinutes !== undefined) {
    localStorage.setItem(NOTIF_STORAGE_KEYS.LEAD_MINS, String(settings.leadMinutes))
  }
  if (settings.sound !== undefined) {
    localStorage.setItem(NOTIF_STORAGE_KEYS.SOUND, String(settings.sound))
  }
}

/**
 * Detect if device is iOS (iPhone/iPad)
 */
export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1
  return isIos || isIpadOs
}

/**
 * Detect if running as an installed Home Screen PWA
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as unknown as { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}
