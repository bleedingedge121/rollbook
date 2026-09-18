'use client'

import React, { useState } from 'react'
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
import { motion, AnimatePresence, Variants } from 'framer-motion'

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

  const today = new Date()
  const todayStr = toDateString(today)
  const currentWeekday = today.getDay() // 0 = Sun, 1 = Mon ...

  // Check if today is a declared holiday or exam
  const todayHoliday = holidays.find((h) => h.date === todayStr)

  // Today's scheduled slots
  const todaySlots = allSlots.filter((s) => s.weekday === currentWeekday)

  // Calculate overall actual attendance
  let totalPresent = 0
  let totalAbsent = 0
  let totalCoursesSafe = 0

  courses.forEach((c) => {
    totalPresent += c.stats.present
    totalAbsent += c.stats.absent
    if (c.stats.isSafe) totalCoursesSafe++
  })

  const totalHeld = totalPresent + totalAbsent
  const overallPct = totalHeld > 0 ? Number(((totalPresent / totalHeld) * 100).toFixed(1)) : 100
  const isOverallSafe = overallPct >= 75

  // Find unlogged past classes from the last 7 days
  const unloggedPastItems: {
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
      if (!course) continue

      // If course has a synced snapshot and the past date is on or before syncedAt date,
      // it's already accounted for in the baseline count — skip it
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
        unloggedPastItems.push({
          date: pastDateStr,
          slot,
          courseName: course.name,
          courseCode: course.code,
        })
      }
    }
  }

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
        staggerChildren: 0.08,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* 1. Tactical Flight Deck (Hero KPI Hub) */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c121e] via-[#090e18] to-[#070a12] border border-slate-800/80 p-6 sm:p-8 shadow-2xl"
      >
        {/* Ambient background aura */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Main Status & Gauge */}
          <div className="flex items-center gap-6">
            {/* Radial Attendance Meter */}
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  className="stroke-slate-800/80"
                  strokeWidth="8"
                  fill="transparent"
                />
                <motion.circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke={isOverallSafe ? '#10b981' : '#f43f5e'}
                  strokeWidth="8"
                  strokeDasharray={289}
                  initial={{ strokeDashoffset: 289 }}
                  animate={{
                    strokeDashoffset: 289 - (289 * Math.min(overallPct, 100)) / 100,
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono font-black text-2xl text-slate-100 tracking-tight">
                  {overallPct}%
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Standing
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight font-sans">
                  Attendance Command Deck
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-wide uppercase border ${
                    isOverallSafe
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {isOverallSafe ? 'Target Secured' : 'Critical Deficit'}
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Strictly confirmed actual records. No theoretical assumptions.
              </p>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-3 min-w-[110px]">
              <div className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
                Held
              </div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-0.5">{totalHeld}</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-3 min-w-[110px]">
              <div className="text-[11px] font-mono font-medium text-emerald-400 uppercase tracking-wider">
                Attended
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {totalPresent}
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-3 min-w-[110px]">
              <div className="text-[11px] font-mono font-medium text-rose-400 uppercase tracking-wider">
                Missed
              </div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">{totalAbsent}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. Today's Flight Schedule */}
      <motion.div
        variants={itemVariants}
        className="bg-[#0c121e] border border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Today’s Schedule
                <span className="text-xs font-mono font-normal text-slate-400">
                  ({WEEKDAYS[currentWeekday]}, {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {todaySlots.length} lecture{todaySlots.length === 1 ? '' : 's'} scheduled for today
              </p>
            </div>
          </div>

          {/* 1-Click Batch Controls for Today */}
          {todaySlots.length > 0 && !todayHoliday && (
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleBatchMarkToday('present')}
                disabled={isBatchBusy || loggingId !== null}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                title="Mark all of today's classes as Present in 1 click"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                All Present
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleBatchMarkToday('absent')}
                disabled={isBatchBusy || loggingId !== null}
                className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                title="Mark all of today's classes as Absent in 1 click"
              >
                <X className="w-3.5 h-3.5" />
                All Absent
              </motion.button>
              {todayLoggedCount > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClearAllToday}
                  disabled={isBatchBusy || loggingId !== null}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 transition-colors disabled:opacity-50"
                  title="Clear today's logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </div>
          )}
        </div>

        {/* Holiday Banner if Today is Holiday */}
        {todayHoliday ? (
          <div className="p-5 bg-amber-950/20 border border-amber-500/30 rounded-2xl flex items-center gap-3">
            <Palmtree className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-sm text-amber-300">
                Today is a Declared {todayHoliday.type === 'exam' ? 'Exam Day' : 'Holiday'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {todayHoliday.label} — no regular lectures scheduled for attendance tracking.
              </div>
            </div>
          </div>
        ) : todaySlots.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-600" />
            <p className="text-sm font-medium">No classes scheduled for today.</p>
            <p className="text-xs text-slate-600 mt-1">Enjoy your free day!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {todaySlots.map((slot) => {
              const course = courses.find((c) => c.id === slot.courseId)
              const existing = getTodayRecord(slot.courseId)
              const isBusy = loggingId !== null || isBatchBusy

              return (
                <motion.div
                  key={slot.id}
                  whileHover={{ y: -2 }}
                  className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: course?.color || '#06b6d4' }}
                        />
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {course?.code}
                        </span>
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {course?.name || 'Unknown Course'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 pl-4">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{slot.label}</span>
                        {slot.room && (
                          <>
                            <span>•</span>
                            <span className="text-slate-300 font-mono">{slot.room}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {existing && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          existing.status === 'present'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {existing.status === 'present' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        {existing.status}
                      </span>
                    )}
                  </div>

                  {/* Logging Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleQuickLog(slot.courseId, 'present')}
                      disabled={isBusy}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        existing?.status === 'present'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 border border-emerald-500/20'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Present
                    </button>
                    <button
                      onClick={() => handleQuickLog(slot.courseId, 'absent')}
                      disabled={isBusy}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        existing?.status === 'absent'
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                          : 'bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 border border-rose-500/20'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      Absent
                    </button>
                    {existing && (
                      <button
                        onClick={() => handleRemoveLog(existing.id)}
                        disabled={isBusy}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="Reset status"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* 3. Unlogged Past Classes Backlog Resolver */}
      {unloggedPastItems.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-[#0c121e] border border-amber-500/30 rounded-3xl p-6 shadow-xl space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Unlogged Past Sessions ({unloggedPastItems.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Scheduled classes from the past 7 days needing attendance confirmation.
                </p>
              </div>
            </div>

            {/* Quick Bulk Resolution */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatchMarkUnlogged('present')}
                disabled={isBatchBusy}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark All Present ({unloggedPastItems.length})
              </button>
              <button
                onClick={() => handleBatchMarkUnlogged('absent')}
                disabled={isBatchBusy}
                className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-amber-400 font-semibold">{item.date}</span>
                    <span className="font-mono">{item.slot.label}</span>
                  </div>
                  <div className="font-semibold text-xs text-slate-200 truncate">
                    {item.courseName} ({item.courseCode})
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => handleQuickLog(item.slot.courseId, 'present', item.date)}
                    className="flex-1 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold text-center transition-colors"
                  >
                    Present
                  </button>
                  <button
                    onClick={() => handleQuickLog(item.slot.courseId, 'absent', item.date)}
                    className="flex-1 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-[11px] font-semibold text-center transition-colors"
                  >
                    Absent
                  </button>
                  <button
                    onClick={() => handleMarkDateAsHoliday(item.date)}
                    className="py-1 px-2.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold text-center transition-colors flex items-center gap-1"
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
        className="bg-[#0c121e] border border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-sans">
              <Layers className="w-4 h-4 text-cyan-400" />
              Subjects Overview & Buffers
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic calculations for safe-zone skips and recovery requirements.
            </p>
          </div>

          <button
            onClick={onNavigateToSubjects}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            All Subjects <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {courses.map((course) => {
            const { stats } = course
            return (
              <motion.div
                key={course.id}
                whileHover={{ y: -2 }}
                onClick={onNavigateToSubjects}
                className="bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {course.code}
                    </span>
                    <h4 className="font-bold text-sm text-slate-100 truncate max-w-[180px]">
                      {course.name}
                    </h4>
                  </div>
                  <span
                    className={`font-mono font-black text-sm px-2.5 py-1 rounded-xl border ${
                      stats.isSafe
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {stats.percentage}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                  <span>
                    {stats.present}P / {stats.absent}A ({stats.total} Held)
                  </span>
                  <span className={stats.isSafe ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {stats.isSafe
                      ? stats.maxSkippable > 0
                        ? `+${stats.maxSkippable} skippable`
                        : 'No buffer'
                      : `Must attend ${stats.mustAttendNext}`}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
