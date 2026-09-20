// src/hooks/useClassReminders.ts
// React hook managing class reminders, permission state, background heartbeats, and test alerts.

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TimetableSlot, Holiday } from '@/types'
import { formatTime } from '@/lib/formatters'
import {
  ScheduledReminder,
  NotificationSettings,
  getNotificationSettings,
  saveNotificationSettings,
  getRemindersForDate,
  sendSystemNotification,
  isIosDevice,
  isStandalonePwa,
} from '@/lib/notificationScheduler'

export type ClassRemindersReturn = ReturnType<typeof useClassReminders>

export function useClassReminders(slots: TimetableSlot[] = [], holidays: Holiday[] = []) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    leadMinutes: 15,
    sound: true,
  })
  const [isIos, setIsIos] = useState(false)
  const [isPwa, setIsPwa] = useState(false)
  const [nextReminder, setNextReminder] = useState<ScheduledReminder | null>(null)

  const slotsRef = useRef(slots)
  const holidaysRef = useRef(holidays)
  const settingsRef = useRef(settings)

  slotsRef.current = slots
  holidaysRef.current = holidays
  settingsRef.current = settings

  // Initialize permission, settings, and device flags on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('Notification' in window) {
      setPermission(Notification.permission)
    } else {
      setPermission('unsupported')
    }

    setSettings(getNotificationSettings())
    setIsIos(isIosDevice())
    setIsPwa(isStandalonePwa())
  }, [])

  // Check and fire notifications for current time
  const checkAndFireReminders = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!settingsRef.current.enabled) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const now = new Date()
    const nowMs = now.getTime()
    const todayReminders = getRemindersForDate(
      slotsRef.current,
      now,
      settingsRef.current.leadMinutes,
      holidaysRef.current
    )

    let upcoming: ScheduledReminder | null = null

    for (const reminder of todayReminders) {
      const reminderMs = reminder.reminderTime.getTime()
      const classMs = reminder.classTime.getTime()

      // Track the closest next reminder that hasn't fired yet
      if (nowMs < reminderMs) {
        if (!upcoming || reminderMs < upcoming.reminderTime.getTime()) {
          upcoming = reminder
        }
      }

      // Check if current time is within the reminder trigger window:
      // from reminderTime up to the class start time
      if (nowMs >= reminderMs && nowMs < classMs) {
        const alreadySent = localStorage.getItem(reminder.key)
        if (!alreadySent) {
          localStorage.setItem(reminder.key, now.toISOString())

          const timeStr = formatTime(reminder.classTime)
          const roomStr = reminder.room ? ` • ${reminder.room}` : ''
          const title = `📖 ${reminder.courseName} in ${reminder.leadMinutes}m`
          const body = `Your class starts at ${timeStr}${roomStr}. Open Roll Book to check your attendance.`

          sendSystemNotification(title, {
            body,
            tag: `reminder-${reminder.slot.id}`,
            playSound: settingsRef.current.sound,
            vibrate: true,
          })
        }
      }
    }

    setNextReminder(upcoming)
  }, [])

  // Heartbeat timer (checks every 25 seconds) + tab visibility listener
  useEffect(() => {
    checkAndFireReminders()

    const interval = setInterval(checkAndFireReminders, 25_000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndFireReminders()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', checkAndFireReminders)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', checkAndFireReminders)
    }
  }, [checkAndFireReminders])

  // Request system notification permission
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        saveNotificationSettings({ enabled: true })
        setSettings((prev) => ({ ...prev, enabled: true }))
        return true
      }
      return false
    } catch (err) {
      console.error('[RollBook] Failed to request notification permission:', err)
      return false
    }
  }

  // Update settings helper
  const updateSettings = (partial: Partial<NotificationSettings>) => {
    saveNotificationSettings(partial)
    setSettings((prev) => {
      const updated = { ...prev, ...partial }
      settingsRef.current = updated
      return updated
    })
  }

  // Send an instant test notification to verify setup on this device
  const sendTestNotification = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Web Notifications are not supported in this browser.')
      return false
    }

    let currentPerm = Notification.permission
    if (currentPerm !== 'granted') {
      const granted = await requestPermission()
      if (!granted) {
        alert('Notification permission was denied. Please allow notifications in your browser or device settings.')
        return false
      }
      currentPerm = 'granted'
    }

    return sendSystemNotification('🔔 Roll Book Test Alert', {
      body: 'Notifications are working perfectly! You will be alerted 15 minutes before your scheduled classes.',
      tag: 'test-notification',
      playSound: settings.sound,
      vibrate: true,
    })
  }

  return {
    permission,
    settings,
    isIos,
    isPwa,
    nextReminder,
    requestPermission,
    updateSettings,
    sendTestNotification,
  }
}
