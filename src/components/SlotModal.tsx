'use client'

import React, { useState, useEffect } from 'react'
import { Course, TimetableSlot } from '@/types'
import { WEEKDAYS } from '@/lib/attendance'
import { formatSlotTime } from '@/lib/formatters'
import { motion } from 'framer-motion'

interface SlotModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (slotData: {
    id?: string
    courseId: string
    weekday: number
    label: string
    room?: string
  }) => Promise<void>
  courses: Course[]
  initialData?: TimetableSlot | null
}

const COMMON_TIME_SLOTS = [
  '9:00 am - 10:00 am',
  '10:00 am - 11:00 am',
  '11:00 am - 12:00 pm',
  '12:00 pm - 1:00 pm',
  '2:00 pm - 3:00 pm',
  '3:00 pm - 4:00 pm',
  '4:00 pm - 5:00 pm',
  '9:00 am - 12:00 pm (Lab/Workshop)',
  '2:00 pm - 5:00 pm (Lab/Workshop)',
]

export const SlotModal: React.FC<SlotModalProps> = ({
  isOpen,
  onClose,
  onSave,
  courses,
  initialData,
}) => {
  const [courseId, setCourseId] = useState('')
  const [weekday, setWeekday] = useState<number>(1) // Monday default
  const [label, setLabel] = useState('9:00 am - 10:00 am')
  const [room, setRoom] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setCourseId(initialData.courseId)
      setWeekday(initialData.weekday)
      setLabel(formatSlotTime(initialData.label))
      setRoom(initialData.room || '')
    } else {
      if (courses.length > 0) setCourseId(courses[0].id)
      setWeekday(1)
      setLabel('9:00 am - 10:00 am')
      setRoom('')
    }
    setError(null)
  }, [initialData, isOpen, courses])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || !label.trim()) {
      setError('Please select a subject and specify a time slot.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({
        id: initialData?.id,
        courseId,
        weekday: Number(weekday),
        label: formatSlotTime(label.trim()),
        room: room.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save timetable slot')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl w-full max-w-md shadow-[8px_8px_0px_var(--shadow-color)] overflow-hidden"
      >
        <div className="p-6 border-b-2 border-[var(--border)] flex items-center justify-between">
          <h3 className="text-lg font-heading font-black text-[var(--foreground)]">
            {initialData ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors font-mono"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Subject
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-bold"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Day of Week
            </label>
            <select
              value={weekday}
              onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
              required
              className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-bold"
            >
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
              <option value={0}>Sunday</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Time / Session Label
            </label>
            <input
              type="text"
              list="time-slot-presets"
              placeholder="e.g. 9:00 am - 10:00 am"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-mono"
            />
            <datalist id="time-slot-presets">
              {COMMON_TIME_SLOTS.map((ts) => (
                <option key={ts} value={ts} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--foreground)] block mb-1.5 font-mono">
              Room / Location (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. AB4 403 or CS Lab"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="pill-btn px-4 py-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-bold hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="pill-btn px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update Slot' : 'Add Slot'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
