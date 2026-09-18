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
} from 'lucide-react'
import { CourseWithStats, TimetableSlot, AttendanceRecord } from '@/types'
import { StatsCard } from './StatsCard'
import { toDateString, WEEKDAYS, calculateAttendance } from '@/lib/attendance'

interface HomeViewProps {
  courses: CourseWithStats[]
  allSlots: TimetableSlot[]
  allAttendance: AttendanceRecord[]
  onLogAttendance: (courseId: string, date: string, status: 'present' | 'absent', note?: string) => Promise<void>
  onDeleteAttendance: (recordId: string) => Promise<void>
  onBatchLogAttendance?: (records: { courseId: string; date: string; status: 'present' | 'absent'; note?: string }[]) => Promise<void>
  onClearDateAttendance?: (date: string) => Promise<void>
  onNavigateToSubjects: () => void
  onNavigateToCalendar: () => void
}

export const HomeView: React.FC<HomeViewProps> = ({
  courses,
  allSlots,
  allAttendance,
  onLogAttendance,
  onDeleteAttendance,
  onBatchLogAttendance,
  onClearDateAttendance,
  onNavigateToSubjects,
  onNavigateToCalendar,
}) => {
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [isBatchBusy, setIsBatchBusy] = useState(false)

  const today = new Date()
  const todayStr = toDateString(today)
  const currentWeekday = today.getDay() // 0 = Sun, 1 = Mon ...

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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#131b2e] via-[#101728] to-[#0d1322] border border-slate-800/90 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>
                {WEEKDAYS[currentWeekday]}, {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Attendance Command Center
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Strictly confirmed actual records. No theoretical assumptions.
            </p>
          </div>

          {/* Big Gauge Card */}
          <div className="flex items-center gap-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-inner">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={isOverallSafe ? 'text-emerald-500' : 'text-rose-500'}
                  strokeDasharray={`${overallPct}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-slate-100">{overallPct}%</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Overall Standing
              </div>
              <div
                className={`text-sm font-bold ${
                  isOverallSafe ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isOverallSafe ? 'Above Target (Safe)' : 'Action Required'}
              </div>
              <div className="text-xs text-slate-500">
                {totalCoursesSafe} of {courses.length} courses compliant
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Overall Attendance"
          value={`${overallPct}%`}
          subtitle={`${totalPresent} present / ${totalHeld} held`}
          icon={<ShieldCheck className="w-6 h-6" />}
          variant={isOverallSafe ? 'emerald' : 'rose'}
        />
        <StatsCard
          title="Total Classes Attended"
          value={totalPresent}
          subtitle={`Across ${courses.length} registered subjects`}
          icon={<CheckCircle2 className="w-6 h-6" />}
          variant="blue"
        />
        <StatsCard
          title="Missed Classes"
          value={totalAbsent}
          subtitle={`${totalHeld > 0 ? ((totalAbsent / totalHeld) * 100).toFixed(1) : 0}% absence rate`}
          icon={<XCircle className="w-6 h-6" />}
          variant="amber"
        />
        <StatsCard
          title="Today's Classes"
          value={todaySlots.length}
          subtitle={`${todayLoggedCount} logged so far`}
          icon={<Clock className="w-6 h-6" />}
          variant="slate"
        />
      </div>

      {/* Today's Schedule & Quick Logger */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Today's Schedule ({WEEKDAYS[currentWeekday]})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Confirm lecture attendance with individual buttons or 1-click batch actions.
            </p>
          </div>

          {/* Batch Actions Bar for Today */}
          {todaySlots.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleBatchMarkToday('present')}
                disabled={isBatchBusy || loggingId !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                title="Mark all today's classes as Present"
              >
                <CheckCheck className="w-3.5 h-3.5" /> All Present
              </button>
              <button
                onClick={() => handleBatchMarkToday('absent')}
                disabled={isBatchBusy || loggingId !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                title="Mark all today's classes as Absent"
              >
                <X className="w-3.5 h-3.5" /> All Absent
              </button>
              {todayLoggedCount > 0 && (
                <button
                  onClick={handleClearAllToday}
                  disabled={isBatchBusy || loggingId !== null}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-slate-800 transition-colors"
                  title="Clear all today's logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {todaySlots.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No classes scheduled for today.</p>
            <p className="text-xs text-slate-600 mt-1">
              Enjoy your free day or configure slots in Settings.
            </p>
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
                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 transition-all hover:border-slate-700"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: course?.color || '#3b82f6' }}
                      />
                      <span className="font-semibold text-sm text-slate-200 truncate">
                        {course?.name || 'Unknown Course'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="font-mono text-slate-300 font-medium">
                        {course?.code}
                      </span>
                      <span>•</span>
                      <span>{slot.label}</span>
                      {slot.room && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{slot.room}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions / Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    {existing ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
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
                        <button
                          onClick={() => handleRemoveLog(existing.id)}
                          disabled={isBusy}
                          title="Reset status"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleQuickLog(slot.courseId, 'present')}
                          disabled={isBusy}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Present
                        </button>
                        <button
                          onClick={() => handleQuickLog(slot.courseId, 'absent')}
                          disabled={isBusy}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Absent
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Unlogged Past Classes Prompt */}
      {unloggedPastItems.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Unlogged Past Sessions ({unloggedPastItems.length})</span>
            </div>
            
            {/* Batch buttons for all unlogged */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatchMarkUnlogged('present')}
                disabled={isBatchBusy}
                className="px-3 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark All Present ({unloggedPastItems.length})
              </button>
              <button
                onClick={() => handleBatchMarkUnlogged('absent')}
                disabled={isBatchBusy}
                className="px-3 py-1 rounded-lg bg-rose-600/25 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Mark All Absent ({unloggedPastItems.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            The following scheduled lectures from the past week have not been logged. Did you attend them?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {unloggedPastItems.slice(0, 6).map((item, idx) => (
              <div
                key={`${item.slot.id}-${item.date}-${idx}`}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-slate-300">{item.date}</span>
                    <span>{item.slot.label}</span>
                  </div>
                  <div className="font-semibold text-xs text-slate-200 truncate mt-1">
                    {item.courseName}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleQuickLog(item.slot.courseId, 'present', item.date)}
                    className="flex-1 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold text-center transition-colors"
                  >
                    Present
                  </button>
                  <button
                    onClick={() => handleQuickLog(item.slot.courseId, 'absent', item.date)}
                    className="flex-1 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-[11px] font-semibold text-center transition-colors"
                  >
                    Absent
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Course Overview Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Subjects Summary</h2>
            <p className="text-xs text-slate-400">
              Instant snapshot of your margins and requirements
            </p>
          </div>
          <button
            onClick={onNavigateToSubjects}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            All Subjects <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const { stats } = course
            return (
              <div
                key={course.id}
                className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 space-y-4 transition-all hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {course.code}
                    </span>
                    <h3 className="font-bold text-sm text-slate-100 truncate max-w-[180px]">
                      {course.name}
                    </h3>
                  </div>
                  <div
                    className={`text-lg font-extrabold px-2.5 py-1 rounded-xl border ${
                      stats.isSafe
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {stats.percentage}%
                  </div>
                </div>

                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>
                    Held: <strong className="text-slate-200">{stats.total}</strong> (P: {stats.present}, A: {stats.absent})
                  </span>
                  <span
                    className={`font-semibold ${
                      stats.isSafe ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {stats.isSafe
                      ? stats.maxSkippable > 0
                        ? `Can skip ${stats.maxSkippable}`
                        : 'No skip'
                      : `Must attend ${stats.mustAttendNext}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
