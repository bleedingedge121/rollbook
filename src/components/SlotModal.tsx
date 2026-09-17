'use client'

import React, { useState, useEffect } from 'react'
import { Course, TimetableSlot } from '@/types'
import { WEEKDAYS } from '@/lib/attendance'

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
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
  '09:00 - 12:00 (Lab/Workshop)',
  '14:00 - 17:00 (Lab/Workshop)',
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
  const [label, setLabel] = useState('09:00 - 10:00')
  const [room, setRoom] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setCourseId(initialData.courseId)
      setWeekday(initialData.weekday)
      setLabel(initialData.label)
      setRoom(initialData.room || '')
    } else {
      if (courses.length > 0) setCourseId(courses[0].id)
      setWeekday(1)
      setLabel('09:00 - 10:00')
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
        label: label.trim(),
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleUp">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">
            {initialData ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Subject
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Day of Week
            </label>
            <select
              value={weekday}
              onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
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
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Time / Session Label
            </label>
            <input
              type="text"
              list="time-slot-presets"
              placeholder="e.g. 09:00 - 10:00"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <datalist id="time-slot-presets">
              {COMMON_TIME_SLOTS.map((ts) => (
                <option key={ts} value={ts} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Room / Location (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. AB4 403 or CS Lab"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update Slot' : 'Add Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
