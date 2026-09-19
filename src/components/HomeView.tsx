'use client'

import React, { useState, useMemo } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Minus,
  CheckCheck,
  Trash2,
  Palmtree,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Flame,
  Shield,
  TrendingUp,
} from 'lucide-react'
import { CourseWithStats, TimetableSlot, AttendanceRecord, Holiday } from '@/types'
import { toDateString, WEEKDAYS } from '@/lib/attendance'
import { formatDate } from '@/lib/formatters'
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion'

interface HomeViewProps {
  courses: CourseWithStats[]
  allSlots: TimetableSlot[]
  allAttendance: AttendanceRecord[]
  holidays?: Holiday[]
  onLogAttendance: (courseId: string, date: string, status: 'present' | 'absent', note?: string) => Promise<void>
  onDeleteAttendance: (recordId: string) => Promise<void>
  onBatchLogAttendance?: (records: { courseId: string; date: string; status: 'present' | 'absent'; note?: string }[]) => Promise<void>
  onClearDateAttendance?: (date: string) => Promise<void>
  onSaveHoliday?: (data: { date: string; label: string; type?: string }) => Promise<void>
  onNavigateToSubjects: () => void
  onNavigateToCalendar: () => void
}

export const HomeView: React.FC<HomeViewProps> = ({
  courses,
  allSlots,
  allAttendance,
  holidays = [],
  onLogAttendance,
  onDeleteAttendance,
  onBatchLogAttendance,
  onClearDateAttendance,
  onSaveHoliday,
  onNavigateToSubjects,
  onNavigateToCalendar,
}) => {
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [isBatchBusy, setIsBatchBusy] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateString(today), [today])
  const currentWeekday = today.getDay() // 0 = Sun, 1 = Mon ...

  // Check if today is a declared holiday or exam
  const todayHoliday = useMemo(
    () => holidays.find((h) => h.date === todayStr),
    [holidays, todayStr]
  )

  // Today's scheduled slots (memoized)
  const todaySlots = useMemo(
    () => allSlots.filter((s) => s.weekday === currentWeekday),
    [allSlots, currentWeekday]
  )

  // Calculate overall actual attendance (memoized)
  const { totalPresent, totalAbsent, totalHeld, overallPct, isOverallSafe } = useMemo(() => {
    let present = 0
    let absent = 0
    courses.forEach((c) => {
      present += c.stats.present
      absent += c.stats.absent
    })
    const held = present + absent
    const pct = held > 0 ? Number(((present / held) * 100).toFixed(1)) : 100
    return {
      totalPresent: present,
      totalAbsent: absent,
      totalHeld: held,
      overallPct: pct,
      isOverallSafe: pct >= 75,
    }
  }, [courses])

  // Find unlogged past classes from the last 7 days (memoized, excludes simple mode courses)
  const unloggedPastItems = useMemo(() => {
    const items: {
      date: string
      slot: TimetableSlot
      courseName: string
      courseCode: string
    }[] = []

    for (let i = 1; i <= 7; i++) {
      const pastDate = new Date()
      pastDate.setDate(today.getDate() - i)
      const pastDateStr = toDateString(pastDate)
      const pastWeekday = pastDate.getDay()

      // Skip if date was marked as a declared Holiday or Exam day
      if (holidays.some((h) => h.date === pastDateStr)) {
        continue
      }

      const scheduled = allSlots.filter((s) => s.weekday === pastWeekday)
      for (const slot of scheduled) {
        const course = courses.find((c) => c.id === slot.courseId)
        if (!course || course.trackingMode === 'simple') continue

        // If course has a synced snapshot and the past date is on or before syncedAt date, skip it
        if (course.syncedAt) {
          const syncedDateStr = toDateString(new Date(course.syncedAt))
          if (pastDateStr <= syncedDateStr) {
            continue
          }
        }

        const isLogged = allAttendance.some(
          (a) => a.courseId === slot.courseId && a.date === pastDateStr
        )
        if (!isLogged) {
          items.push({
            date: pastDateStr,
            slot,
            courseName: course.name,
            courseCode: course.code,
          })
        }
      }
    }
    return items
  }, [today, holidays, allSlots, courses, allAttendance])

  // Find today's existing records per course
  const getTodayRecord = (courseId: string) => {
    return allAttendance.find((a) => a.courseId === courseId && a.date === todayStr)
  }

  const todayLoggedCount = todaySlots.filter((s) => getTodayRecord(s.courseId)).length

  const handleQuickLog = async (
    courseId: string,
    status: 'present' | 'absent',
    date: string = todayStr
  ) => {
    const key = `${courseId}-${date}-${status}`
    setLoggingId(key)
    try {
      await onLogAttendance(courseId, date, status)
    } finally {
      setLoggingId(null)
    }
  }

  const handleRemoveLog = async (recordId: string) => {
    setLoggingId(recordId)
    try {
      await onDeleteAttendance(recordId)
    } finally {
      setLoggingId(null)
    }
  }

  // Batch actions for Today
  const handleBatchMarkToday = async (status: 'present' | 'absent') => {
    if (todaySlots.length === 0) return
    setIsBatchBusy(true)
    try {
      const records = todaySlots.map((s) => ({
        courseId: s.courseId,
        date: todayStr,
        status,
        note: 'Marked all via Today logger',
      }))
      if (onBatchLogAttendance) {
        await onBatchLogAttendance(records)
      } else {
        for (const r of records) {
          await onLogAttendance(r.courseId, r.date, r.status, r.note)
        }
      }
    } finally {
      setIsBatchBusy(false)
    }
  }

  const handleClearAllToday = async () => {
    if (todayLoggedCount === 0) return
    if (!confirm('Clear all attendance logs for today?')) return
    setIsBatchBusy(true)
    try {
      if (onClearDateAttendance) {
        await onClearDateAttendance(todayStr)
      } else {
        const todayRecs = allAttendance.filter((a) => a.date === todayStr)
        for (const r of todayRecs) {
          await onDeleteAttendance(r.id)
        }
      }
    } finally {
      setIsBatchBusy(false)
    }
  }

  // Batch actions for Unlogged Past Sessions
  const handleBatchMarkUnlogged = async (status: 'present' | 'absent') => {
    if (unloggedPastItems.length === 0) return
    setIsBatchBusy(true)
    try {
      const records = unloggedPastItems.map((item) => ({
        courseId: item.slot.courseId,
        date: item.date,
        status,
        note: 'Confirmed past batch',
      }))
      if (onBatchLogAttendance) {
        await onBatchLogAttendance(records)
      } else {
        for (const r of records) {
          await onLogAttendance(r.courseId, r.date, r.status, r.note)
        }
      }
    } finally {
      setIsBatchBusy(false)
    }
  }

  const handleMarkDateAsHoliday = async (dateStr: string) => {
    if (!onSaveHoliday) return
    setIsBatchBusy(true)
    try {
      await onSaveHoliday({
        date: dateStr,
        label: 'Declared Holiday / No Class',
        type: 'holiday',
      })
    } finally {
      setIsBatchBusy(false)
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.07,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* 1. Playful Hero Card (Standing Radar & Buffers) */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl bg-[var(--card)] border-2 border-[var(--border)] p-4 sm:p-6 lg:p-8 shadow-[6px_6px_0px_var(--shadow-color)]"
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
          {/* Main Standing Display */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="45"
                  className="stroke-[var(--muted)]"
                  strokeWidth="10"
                  fill="transparent"
                />
                <motion.circle
                  cx="56"
                  cy="56"
                  r="45"
                  stroke={isOverallSafe ? '#10B981' : '#F43F5E'}
                  strokeWidth="10"
                  strokeDasharray={282.7}
                  initial={{ strokeDashoffset: 282.7 }}
                  animate={{
                    strokeDashoffset: 282.7 - (282.7 * Math.min(overallPct, 100)) / 100,
                  }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-heading font-black text-2xl text-[var(--foreground)] tracking-tight">
                  {overallPct}%
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Standing
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-3xl font-heading font-black text-[var(--foreground)] tracking-tight">
                  Attendance Command
                </h1>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] ${
                    isOverallSafe
                      ? 'bg-emerald-400/25 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-400/25 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {isOverallSafe ? 'Target Maintained' : 'Attention Required'}
                </span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] max-w-md leading-relaxed">
                Strictly confirmed actual records. No hypothetical assumptions or fake attendance stamps.
              </p>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full lg:w-auto">
            <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-2.5 sm:px-4 sm:py-3 min-w-[70px] sm:min-w-[100px] shadow-[3px_3px_0px_var(--shadow-color)] text-center">
              <div className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase">
                Held
              </div>
              <div className="text-lg sm:text-xl font-heading font-black text-[var(--foreground)] mt-0.5">
                {totalHeld}
              </div>
            </div>
            <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-2.5 sm:px-4 sm:py-3 min-w-[70px] sm:min-w-[100px] shadow-[3px_3px_0px_var(--shadow-color)] text-center">
              <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                Attended
              </div>
              <div className="text-lg sm:text-xl font-heading font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {totalPresent}
              </div>
            </div>
            <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-2.5 sm:px-4 sm:py-3 min-w-[70px] sm:min-w-[100px] shadow-[3px_3px_0px_var(--shadow-color)] text-center">
              <div className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase">
                Missed
              </div>
              <div className="text-lg sm:text-xl font-heading font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {totalAbsent}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. Today's Flight Schedule & Immediate Actions */}
      <motion.div
        variants={itemVariants}
        className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-4 sm:p-6 lg:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-700 dark:text-teal-300 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-heading font-black text-[var(--foreground)] flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>Today’s Flight Schedule</span>
                <span className="text-xs font-mono font-normal text-[var(--muted-foreground)]">
                  ({WEEKDAYS[currentWeekday]}, {formatDate(today)})
                </span>
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                {todaySlots.length} lecture{todaySlots.length === 1 ? '' : 's'} scheduled for today
              </p>
            </div>
          </div>

          {/* 1-Click Batch Controls for Today */}
          {todaySlots.length > 0 && !todayHoliday && (
            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleBatchMarkToday('present')}
                disabled={isBatchBusy || loggingId !== null}
                className="pill-btn flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
                title="Mark all today's classes as Present"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                All Present
              </button>
              <button
                onClick={() => handleBatchMarkToday('absent')}
                disabled={isBatchBusy || loggingId !== null}
                className="pill-btn flex-1 sm:flex-none px-3.5 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
                title="Mark all today's classes as Absent"
              >
                <X className="w-3.5 h-3.5" />
                All Absent
              </button>
              {todayLoggedCount > 0 && (
                <button
                  onClick={handleClearAllToday}
                  disabled={isBatchBusy || loggingId !== null}
                  className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-rose-500 bg-[var(--background)] border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] transition-colors disabled:opacity-50 shrink-0"
                  title="Clear today's logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Holiday Banner if Today is Holiday */}
        {todayHoliday ? (
          <div className="p-5 bg-amber-400/15 border-2 border-[var(--border)] rounded-2xl shadow-[3px_3px_0px_var(--shadow-color)] flex items-center gap-3">
            <Palmtree className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <div className="font-heading font-black text-sm text-[var(--foreground)]">
                Today is a Declared {todayHoliday.type === 'exam' ? 'Exam Day' : 'Holiday'}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5 font-medium">
                {todayHoliday.label} — no lectures scheduled for attendance tracking.
              </div>
            </div>
          </div>
        ) : todaySlots.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted-foreground)] bg-[var(--background)] rounded-2xl border-2 border-dashed border-[var(--border)]">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold text-[var(--foreground)]">No classes scheduled for today.</p>
            <p className="text-xs mt-1">Enjoy your day off!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {todaySlots.map((slot) => {
              const course = courses.find((c) => c.id === slot.courseId)
              const existing = getTodayRecord(slot.courseId)
              const isBusy = loggingId !== null || isBatchBusy

              return (
                <div
                  key={slot.id}
                  className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-[3px_3px_0px_var(--shadow-color)] transition-transform hover:translate-y-[-1px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-[var(--border)] shrink-0"
                          style={{ backgroundColor: course?.color || '#0D9488' }}
                        />
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]">
                          {course?.code}
                        </span>
                        <span className="font-heading font-bold text-sm text-[var(--foreground)] truncate">
                          {course?.name || 'Unknown Course'}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 pl-5 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{slot.label}</span>
                        {slot.room && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-[var(--foreground)]">{slot.room}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {existing && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border-2 border-[var(--border)] shadow-[1px_1px_0px_var(--shadow-color)] flex items-center gap-1 ${
                          existing.status === 'present'
                            ? 'bg-emerald-400 text-slate-900'
                            : 'bg-rose-400 text-slate-900'
                        }`}
                      >
                        {existing.status === 'present' ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <X className="w-3.5 h-3.5 stroke-[3]" />
                        )}
                        {existing.status}
                      </span>
                    )}
                  </div>

                  {/* Logging Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                    <button
                      onClick={() => handleQuickLog(slot.courseId, 'present')}
                      disabled={isBusy}
                      className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-2 border-[var(--border)] ${
                        existing?.status === 'present'
                          ? 'bg-emerald-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                          : 'bg-[var(--card)] text-emerald-600 hover:bg-emerald-400/20 shadow-[2px_2px_0px_var(--shadow-color)]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Present
                    </button>
                    <button
                      onClick={() => handleQuickLog(slot.courseId, 'absent')}
                      disabled={isBusy}
                      className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-2 border-[var(--border)] ${
                        existing?.status === 'absent'
                          ? 'bg-rose-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                          : 'bg-[var(--card)] text-rose-600 hover:bg-rose-400/20 shadow-[2px_2px_0px_var(--shadow-color)]'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      Absent
                    </button>
                    {existing && (
                      <button
                        onClick={() => handleRemoveLog(existing.id)}
                        disabled={isBusy}
                        className="p-1.5 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                        title="Reset status"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* 3. Unlogged Past Sessions Backlog Resolver */}
      {unloggedPastItems.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--border)] pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-400/25 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-base font-heading font-black text-[var(--foreground)] flex items-center gap-2">
                  Unlogged Past Sessions ({unloggedPastItems.length})
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Scheduled classes from the past 7 days needing attendance confirmation.
                </p>
              </div>
            </div>

            {/* Quick Bulk Resolution */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatchMarkUnlogged('present')}
                disabled={isBatchBusy}
                className="pill-btn px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark All Present ({unloggedPastItems.length})
              </button>
              <button
                onClick={() => handleBatchMarkUnlogged('absent')}
                disabled={isBatchBusy}
                className="pill-btn px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Mark All Absent ({unloggedPastItems.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unloggedPastItems.slice(0, 9).map((item, idx) => (
              <div
                key={`${item.slot.id}-${item.date}-${idx}`}
                className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5 shadow-[3px_3px_0px_var(--shadow-color)]"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono">
                    <span className="font-bold text-amber-600 dark:text-amber-400">{formatDate(item.date)}</span>
                    <span>{item.slot.label}</span>
                  </div>
                  <div className="font-heading font-bold text-xs text-[var(--foreground)] truncate">
                    {item.courseName} ({item.courseCode})
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => handleQuickLog(item.slot.courseId, 'present', item.date)}
                    className="flex-1 py-1 rounded-full bg-emerald-500 text-white border-2 border-[var(--border)] text-[11px] font-bold text-center shadow-[1px_1px_0px_var(--shadow-color)]"
                  >
                    Present
                  </button>
                  <button
                    onClick={() => handleQuickLog(item.slot.courseId, 'absent', item.date)}
                    className="flex-1 py-1 rounded-full bg-rose-500 text-white border-2 border-[var(--border)] text-[11px] font-bold text-center shadow-[1px_1px_0px_var(--shadow-color)]"
                  >
                    Absent
                  </button>
                  <button
                    onClick={() => handleMarkDateAsHoliday(item.date)}
                    className="py-1 px-2.5 rounded-full bg-amber-400 text-slate-900 border-2 border-[var(--border)] text-[11px] font-bold text-center shadow-[1px_1px_0px_var(--shadow-color)] flex items-center gap-1"
                    title="Mark entire day as Holiday / No Class"
                  >
                    <Palmtree className="w-3 h-3" /> Holiday
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 4. Subject Standing Matrix */}
      <motion.div
        variants={itemVariants}
        className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-heading font-black text-[var(--foreground)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Subjects Overview & Buffers
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Exact calculations for safe-zone skips and recovery requirements.
            </p>
          </div>

          <button
            onClick={onNavigateToSubjects}
            className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 transition-colors font-mono"
          >
            All Subjects <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {courses.map((course) => {
            const { stats } = course
            return (
              <div
                key={course.id}
                onClick={onNavigateToSubjects}
                className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 transition-all cursor-pointer space-y-3 shadow-[3px_3px_0px_var(--shadow-color)] hover:translate-y-[-2px] hover:rotate-[-0.5deg]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]">
                      {course.code}
                    </span>
                    <h4 className="font-heading font-black text-sm text-[var(--foreground)] truncate max-w-[180px]">
                      {course.name}
                    </h4>
                  </div>
                  <span
                    className={`font-mono font-black text-sm px-2.5 py-1 rounded-full border-2 border-[var(--border)] shadow-[1px_1px_0px_var(--shadow-color)] ${
                      stats.isSafe
                        ? 'bg-emerald-400/25 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-400/25 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {stats.percentage}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)] font-mono">
                  <span>
                    {stats.present}P / {stats.absent}A ({stats.total} Held)
                  </span>
                  <span className={stats.isSafe ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                    {stats.isSafe
                      ? stats.maxSkippable > 0
                        ? `+${stats.maxSkippable} skippable`
                        : 'No buffer'
                      : `Must attend ${stats.mustAttendNext}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
