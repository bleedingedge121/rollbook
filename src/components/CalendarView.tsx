'use client'

import React, { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  TrendingUp,
  Check,
  X,
  Plus,
  AlertCircle,
  Clock,
  ShieldCheck,
  RotateCcw,
  CheckCheck,
  Trash2,
  Palmtree,
  Zap,
  Layers,
  Activity,
} from 'lucide-react'
import {
  CourseWithStats,
  TimetableSlot,
  AttendanceRecord,
  PlannedSlot,
  Holiday,
} from '@/types'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  isToday,
  addDays,
} from 'date-fns'
import { toDateString, parseDateString } from '@/lib/attendance'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface CalendarViewProps {
  courses: CourseWithStats[]
  allSlots: TimetableSlot[]
  allAttendance: AttendanceRecord[]
  holidays?: Holiday[]
  onLogAttendance: (
    courseId: string,
    date: string,
    status: 'present' | 'absent',
    note?: string
  ) => Promise<void>
  onDeleteAttendance: (recordId: string) => Promise<void>
  onBatchLogAttendance?: (
    records: { courseId: string; date: string; status: 'present' | 'absent'; note?: string }[]
  ) => Promise<void>
  onClearDateAttendance?: (date: string) => Promise<void>
  onSaveHoliday?: (data: { date: string; label: string; type?: string }) => Promise<void>
  onDeleteHoliday?: (id: string) => Promise<void>
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  courses,
  allSlots,
  allAttendance,
  holidays = [],
  onLogAttendance,
  onDeleteAttendance,
  onBatchLogAttendance,
  onClearDateAttendance,
  onSaveHoliday,
  onDeleteHoliday,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [plannedSlots, setPlannedSlots] = useState<Record<string, 'attend' | 'skip'>>({})
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all')
  const [isDayBatchBusy, setIsDayBatchBusy] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateString(today), [today])

  // Calendar matrix days calculation (memoized)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: startDate, end: endDate })
  }, [currentMonth])

  // Toggle future plan
  const handleTogglePlan = (dateStr: string, slotId: string, courseId: string) => {
    if (holidays.some((h) => h.date === dateStr)) return

    const key = `${dateStr}_${slotId}`
    setPlannedSlots((prev) => {
      const current = prev[key]
      if (!current) {
        return { ...prev, [key]: 'attend' }
      } else if (current === 'attend') {
        return { ...prev, [key]: 'skip' }
      } else {
        const next = { ...prev }
        delete next[key]
        return next
      }
    })
  }

  // Quick preset planning buttons
  const handlePlanAll = (plan: 'attend' | 'skip', daysForward?: number) => {
    const updated: Record<string, 'attend' | 'skip'> = { ...plannedSlots }
    const limitDate = daysForward ? addDays(today, daysForward) : null

    calendarDays.forEach((day) => {
      const dateStr = toDateString(day)
      if (holidays.some((h) => h.date === dateStr)) return

      const isTargetDay =
        (isAfter(day, today) || isSameDay(day, today)) &&
        (!limitDate || isBefore(day, limitDate) || isSameDay(day, limitDate))

      if (isTargetDay) {
        const weekday = day.getDay()
        const slots = allSlots.filter((s) => s.weekday === weekday)
        slots.forEach((slot) => {
          if (selectedCourseFilter === 'all' || slot.courseId === selectedCourseFilter) {
            updated[`${dateStr}_${slot.id}`] = plan
          }
        })
      }
    })
    setPlannedSlots(updated)
  }

  const handleResetPlans = () => {
    setPlannedSlots({})
  }

  // Day specific batch planning
  const handlePlanSpecificDay = (dateStr: string, plan: 'attend' | 'skip') => {
    if (holidays.some((h) => h.date === dateStr)) return
    const day = parseDateString(dateStr)
    const weekday = day.getDay()
    const slots = allSlots.filter((s) => s.weekday === weekday)
    const updated = { ...plannedSlots }
    slots.forEach((slot) => {
      updated[`${dateStr}_${slot.id}`] = plan
    })
    setPlannedSlots(updated)
  }

  const handleResetSpecificDay = (dateStr: string) => {
    const updated = { ...plannedSlots }
    Object.keys(updated).forEach((k) => {
      if (k.startsWith(`${dateStr}_`)) {
        delete updated[k]
      }
    })
    setPlannedSlots(updated)
  }

  // Day specific batch attendance logging
  const handleBatchMarkDay = async (dateStr: string, status: 'present' | 'absent') => {
    const day = parseDateString(dateStr)
    const weekday = day.getDay()
    const slots = allSlots.filter((s) => s.weekday === weekday)
    if (slots.length === 0) return

    setIsDayBatchBusy(true)
    try {
      const records = slots.map((s) => ({
        courseId: s.courseId,
        date: dateStr,
        status,
        note: 'Day Inspector bulk log',
      }))
      if (onBatchLogAttendance) {
        await onBatchLogAttendance(records)
      } else {
        for (const r of records) {
          await onLogAttendance(r.courseId, r.date, r.status, r.note)
        }
      }
    } finally {
      setIsDayBatchBusy(false)
    }
  }

  const handleClearDayAttendance = async (dateStr: string) => {
    const dayRecs = allAttendance.filter((a) => a.date === dateStr)
    if (dayRecs.length === 0) return
    if (!confirm(`Clear all attendance logs for ${dateStr}?`)) return

    setIsDayBatchBusy(true)
    try {
      if (onClearDateAttendance) {
        await onClearDateAttendance(dateStr)
      } else {
        for (const r of dayRecs) {
          await onDeleteAttendance(r.id)
        }
      }
    } finally {
      setIsDayBatchBusy(false)
    }
  }

  // Projected trajectory calculations (memoized)
  const { overallActualPct, overallProjectedPct, trajectoryData } = useMemo(() => {
    let actPresent = 0
    let actAbsent = 0

    courses.forEach((c) => {
      if (selectedCourseFilter === 'all' || c.id === selectedCourseFilter) {
        actPresent += c.stats.present
        actAbsent += c.stats.absent
      }
    })

    const actTotal = actPresent + actAbsent
    const actualPct = actTotal > 0 ? Number(((actPresent / actTotal) * 100).toFixed(1)) : 100

    let planPresent = 0
    let planAbsent = 0

    Object.entries(plannedSlots).forEach(([key, plan]) => {
      const [dateStr, slotId] = key.split('_')
      if (holidays.some((h) => h.date === dateStr)) return

      const slot = allSlots.find((s) => s.id === slotId)
      if (!slot) return

      if (selectedCourseFilter === 'all' || slot.courseId === selectedCourseFilter) {
        if (plan === 'attend') planPresent++
        if (plan === 'skip') planAbsent++
      }
    })

    const projTotal = actTotal + planPresent + planAbsent
    const projPresent = actPresent + planPresent
    const projectedPct =
      projTotal > 0 ? Number(((projPresent / projTotal) * 100).toFixed(1)) : actualPct

    const trajectory: { name: string; actual?: number; projected?: number }[] = [
      { name: 'Current', actual: actualPct, projected: actualPct },
    ]

    if (planPresent + planAbsent > 0) {
      trajectory.push({
        name: '+1 Wk',
        projected: Number(
          (
            ((actPresent + planPresent * 0.25) /
              Math.max(1, actTotal + (planPresent + planAbsent) * 0.25)) *
            100
          ).toFixed(1)
        ),
      })
      trajectory.push({
        name: '+2 Wks',
        projected: Number(
          (
            ((actPresent + planPresent * 0.5) /
              Math.max(1, actTotal + (planPresent + planAbsent) * 0.5)) *
            100
          ).toFixed(1)
        ),
      })
      trajectory.push({
        name: 'Target Date',
        projected: projectedPct,
      })
    }

    return {
      overallActualPct: actualPct,
      overallProjectedPct: projectedPct,
      trajectoryData: trajectory,
    }
  }, [courses, allSlots, plannedSlots, selectedCourseFilter, holidays])

  // Selected Day Inspector properties
  const selectedDayStr = selectedDay ? toDateString(selectedDay) : todayStr
  const selectedDayHoliday = holidays.find((h) => h.date === selectedDayStr)
  const selectedDayIsFuture = selectedDay
    ? isAfter(selectedDay, today) && !isSameDay(selectedDay, today)
    : false
  const selectedDayWeekday = selectedDay ? selectedDay.getDay() : today.getDay()
  const selectedDaySlots = allSlots.filter((s) => s.weekday === selectedDayWeekday)
  const selectedDayAttendance = allAttendance.filter((a) => a.date === selectedDayStr)

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-teal-600 dark:text-teal-400" />
            Trajectory Lab & Flight Calendar
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1">
            Solid badges denote confirmed history; dashed outlines project future scenarios.
          </p>
        </div>

        {/* Filter by course */}
        <div className="flex items-center gap-3">
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="bg-[var(--card)] border-2 border-[var(--border)] text-xs font-bold text-[var(--foreground)] rounded-full px-4 py-2 focus:outline-none focus:border-teal-500 font-mono shadow-[2px_2px_0px_var(--shadow-color)]"
          >
            <option value="all">All Subjects (Aggregate)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trajectory Simulation HUD Banner */}
      <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/15 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center text-teal-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-heading font-black text-[var(--foreground)]">
                Predictive Planning Engine
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Simulate Plan Attend or Skip into the future to visualize projected percentage trajectories.
              </p>
            </div>
          </div>

          {/* Preset Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePlanAll('attend')}
              className="pill-btn px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Plan Attend All
            </button>
            <button
              onClick={() => handlePlanAll('skip')}
              className="pill-btn px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Plan Skip All
            </button>
            <button
              onClick={() => handlePlanAll('attend', 14)}
              className="pill-btn px-3 py-1.5 bg-[var(--background)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold transition-transform hidden sm:flex items-center gap-1"
            >
              +2 Wks Attend
            </button>
            <button
              onClick={() => handlePlanAll('skip', 14)}
              className="pill-btn px-3 py-1.5 bg-[var(--background)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold transition-transform hidden sm:flex items-center gap-1"
            >
              +2 Wks Skip
            </button>
            <button
              onClick={handleResetPlans}
              className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--background)] border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] transition-all"
              title="Reset planning simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Projection KPI comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 shadow-[3px_3px_0px_var(--shadow-color)]">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Current Standing
            </div>
            <div className="text-2xl font-heading font-black text-[var(--foreground)] mt-1">
              {overallActualPct}%
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">Confirmed actuals</div>
          </div>

          <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 shadow-[3px_3px_0px_var(--shadow-color)] relative overflow-hidden">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Projected Trajectory
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-heading font-black text-teal-600 dark:text-teal-400">
                {overallProjectedPct}%
              </span>
              <span
                className={`text-xs font-bold font-mono ${
                  overallProjectedPct >= overallActualPct
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {overallProjectedPct >= overallActualPct ? '+' : ''}
                {(overallProjectedPct - overallActualPct).toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono">
              {Object.keys(plannedSlots).length} planned classes
            </div>
          </div>

          <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 shadow-[3px_3px_0px_var(--shadow-color)]">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Compliance Status
            </div>
            <div
              className={`text-base font-heading font-black mt-1 ${
                overallProjectedPct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {overallProjectedPct >= 75
                ? 'Target Secured (≥75%)'
                : 'Projected Below 75%'}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">Minimum 75% threshold</div>
          </div>
        </div>

        {/* Trajectory Recharts Line Graph */}
        {trajectoryData.length > 1 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-[var(--foreground)] flex items-center justify-between font-mono">
              <span>Trajectory Projection Curve</span>
              <span className="text-[var(--muted-foreground)]">Solid: Actual / Dashed: Simulation</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectoryData}>
                  <XAxis dataKey="name" stroke="currentColor" className="text-[var(--muted-foreground)]" fontSize={11} />
                  <YAxis domain={[50, 100]} stroke="currentColor" className="text-[var(--muted-foreground)]" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderWidth: '2px',
                      borderRadius: '1rem',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      boxShadow: '4px 4px 0px var(--shadow-color)',
                      color: 'var(--foreground)',
                    }}
                  />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" label="75% Target" />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#0D9488"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0D9488' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="#F472B6"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: '#F472B6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Month Navigation & Grid */}
      <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-6">
        {/* Month Navigation Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-heading font-black text-[var(--foreground)]">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="pill-btn px-3 py-1 bg-[var(--background)] hover:bg-[var(--muted)] text-xs font-bold text-[var(--foreground)] transition-colors font-mono"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-full bg-[var(--background)] border-2 border-[var(--border)] text-[var(--foreground)] shadow-[2px_2px_0px_var(--shadow-color)] transition-transform active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-full bg-[var(--background)] border-2 border-[var(--border)] text-[var(--foreground)] shadow-[2px_2px_0px_var(--shadow-color)] transition-transform active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)] font-mono font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-[var(--border)]" />
            <span className="text-[var(--foreground)] font-bold">Actual Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-[var(--border)]" />
            <span className="text-[var(--foreground)] font-bold">Actual Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-emerald-500 bg-emerald-400/20" />
            <span>Plan Attend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-rose-500 bg-rose-400/20" />
            <span>Plan Skip</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 border border-[var(--border)]" />
            <span>Holiday / Exam</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="text-center py-2 text-xs font-mono font-black uppercase tracking-wider text-[var(--muted-foreground)]"
            >
              {day}
            </div>
          ))}

          {calendarDays.map((day) => {
            const dateStr = toDateString(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isCurrentDay = isToday(day)
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const isFuture = isAfter(day, today) && !isSameDay(day, today)
            const weekday = day.getDay()

            const dayHoliday = holidays.find((h) => h.date === dateStr)
            const slotsForDay = allSlots.filter((s) => s.weekday === weekday)
            const recordsForDay = allAttendance.filter((a) => a.date === dateStr)

            return (
              <motion.div
                key={dateStr}
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[90px] sm:min-h-[110px] p-2 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  !isCurrentMonth
                    ? 'opacity-30 bg-[var(--background)] border-[var(--border)]'
                    : isSelected
                    ? 'bg-[var(--card)] border-teal-600 shadow-[4px_4px_0px_var(--shadow-color)] ring-2 ring-teal-500/50'
                    : dayHoliday
                    ? 'bg-amber-400/15 border-amber-500/50 shadow-[2px_2px_0px_var(--shadow-color)]'
                    : isCurrentDay
                    ? 'bg-[var(--card)] border-teal-500 shadow-[3px_3px_0px_var(--shadow-color)]'
                    : 'bg-[var(--background)] border-[var(--border)] hover:border-teal-500/60 shadow-[2px_2px_0px_var(--shadow-color)]'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold font-mono rounded-full px-2 py-0.5 border ${
                      isCurrentDay
                        ? 'bg-teal-600 text-white border-[var(--border)] shadow-[1px_1px_0px_var(--shadow-color)]'
                        : isSelected
                        ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500'
                        : 'text-[var(--foreground)] border-transparent'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {recordsForDay.length > 0 && (
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)] font-bold">
                      {recordsForDay.filter((r) => r.status === 'present').length}P/
                      {recordsForDay.filter((r) => r.status === 'absent').length}A
                    </span>
                  )}
                </div>

                {/* Slots & Status Badges */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayHoliday && (
                    <div
                      className={`text-[10px] font-bold p-1 rounded-lg truncate flex items-center gap-1 border ${
                        dayHoliday.type === 'exam'
                          ? 'bg-purple-400/25 border-purple-500 text-purple-900 dark:text-purple-200'
                          : 'bg-amber-400/25 border-amber-500 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <Palmtree className="w-3 h-3 shrink-0" />
                      <span className="truncate">{dayHoliday.label}</span>
                    </div>
                  )}

                  {!dayHoliday &&
                    recordsForDay.map((rec) => {
                      const course = courses.find((c) => c.id === rec.courseId)
                      return (
                        <div
                          key={rec.id}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full truncate flex items-center gap-1 shadow-sm font-mono border ${
                            rec.status === 'present'
                              ? 'bg-emerald-400 text-slate-900 border-[var(--border)]'
                              : 'bg-rose-400 text-slate-900 border-[var(--border)]'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: course?.color || '#0D9488' }}
                          />
                          <span className="truncate">{course?.code || 'Class'}</span>
                        </div>
                      )
                    })}

                  {!dayHoliday &&
                    (isFuture || (isToday(day) && recordsForDay.length === 0)) &&
                    slotsForDay.map((slot) => {
                      const course = courses.find((c) => c.id === slot.courseId)
                      const planKey = `${dateStr}_${slot.id}`
                      const planStatus = plannedSlots[planKey]

                      return (
                        <div
                          key={slot.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTogglePlan(dateStr, slot.id, slot.courseId)
                          }}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full truncate flex items-center justify-between gap-1 border-2 border-dashed transition-all hover:scale-[1.02] font-mono ${
                            planStatus === 'attend'
                              ? 'bg-emerald-400/20 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                              : planStatus === 'skip'
                              ? 'bg-rose-400/20 border-rose-500 text-rose-700 dark:text-rose-300'
                              : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)]'
                          }`}
                          title="Click to toggle Plan: Attend -> Skip -> Reset"
                        >
                          <span className="truncate">{course?.code || 'Slot'}</span>
                          <span className="text-[9px] uppercase font-black shrink-0">
                            {planStatus === 'attend'
                              ? 'P'
                              : planStatus === 'skip'
                              ? 'S'
                              : '?'}
                          </span>
                        </div>
                      )
                    })}
                </div>

                {!dayHoliday && slotsForDay.length === 0 && recordsForDay.length === 0 && (
                  <div className="text-[10px] text-[var(--muted-foreground)] text-center py-1 font-mono">
                    Off
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Selected Day Inspector */}
      {selectedDay && (
        <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--border)] pb-4">
            <div>
              <h3 className="text-lg font-heading font-black text-[var(--foreground)] flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Day Inspector: {format(selectedDay, 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-medium">
                {selectedDayHoliday
                  ? `Declared ${selectedDayHoliday.type === 'exam' ? 'Exam Day' : 'Holiday'}: ${selectedDayHoliday.label}`
                  : selectedDayIsFuture
                  ? 'Future Date: Configure planning assumptions below'
                  : 'Past/Today: Confirm actual attendance'}
              </p>
            </div>

            {/* Fast 1-Click Day Batch Buttons */}
            {selectedDayHoliday ? (
              <div className="flex items-center gap-2">
                {onDeleteHoliday && (
                  <button
                    onClick={() => onDeleteHoliday(selectedDayHoliday.id)}
                    className="pill-btn px-3.5 py-1.5 bg-[var(--background)] hover:bg-rose-500/20 text-rose-600 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Holiday Status
                  </button>
                )}
              </div>
            ) : selectedDaySlots.length > 0 ? (
              <div className="flex items-center gap-2 shrink-0">
                {selectedDayIsFuture ? (
                  <>
                    <button
                      onClick={() => handlePlanSpecificDay(selectedDayStr, 'attend')}
                      className="pill-btn px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Plan all classes for this day as Attend"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Plan All Attend
                    </button>
                    <button
                      onClick={() => handlePlanSpecificDay(selectedDayStr, 'skip')}
                      className="pill-btn px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Plan all classes for this day as Skip"
                    >
                      <X className="w-3.5 h-3.5" /> Plan All Skip
                    </button>
                    <button
                      onClick={() => handleResetSpecificDay(selectedDayStr)}
                      className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--background)] border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] transition-colors"
                      title="Reset planning for this date"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleBatchMarkDay(selectedDayStr, 'present')}
                      disabled={isDayBatchBusy}
                      className="pill-btn px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                      title="Mark all classes on this date as Present"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> All Present
                    </button>
                    <button
                      onClick={() => handleBatchMarkDay(selectedDayStr, 'absent')}
                      disabled={isDayBatchBusy}
                      className="pill-btn px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                      title="Mark all classes on this date as Absent"
                    >
                      <X className="w-3.5 h-3.5" /> All Absent
                    </button>
                    {selectedDayAttendance.length > 0 && (
                      <button
                        onClick={() => handleClearDayAttendance(selectedDayStr)}
                        disabled={isDayBatchBusy}
                        className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-rose-500 bg-[var(--background)] border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] transition-colors"
                        title="Clear logs for this date"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>

          {/* Holiday Alert Banner in Inspector if applicable */}
          {selectedDayHoliday && (
            <div className="p-4 bg-amber-400/20 border-2 border-[var(--border)] rounded-2xl flex items-center gap-3 shadow-[2px_2px_0px_var(--shadow-color)]">
              <Palmtree className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs text-[var(--foreground)]">
                <strong className="font-bold">
                  {selectedDayHoliday.label} ({selectedDayHoliday.type === 'exam' ? 'Exam Day' : 'Holiday'})
                </strong>{' '}
                — No classes scheduled on this date.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scheduled slots for this weekday */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] font-mono">
                Timetable Slots ({selectedDaySlots.length})
              </div>

              {selectedDaySlots.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] p-4 bg-[var(--background)] rounded-2xl border-2 border-dashed border-[var(--border)] text-center">
                  No classes scheduled on this weekday.
                </div>
              ) : (
                selectedDaySlots.map((slot) => {
                  const course = courses.find((c) => c.id === slot.courseId)
                  const planKey = `${selectedDayStr}_${slot.id}`
                  const currentPlan = plannedSlots[planKey]
                  const actualRec = selectedDayAttendance.find(
                    (a) => a.courseId === slot.courseId
                  )

                  return (
                    <div
                      key={slot.id}
                      className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-3.5 space-y-2.5 shadow-[2px_2px_0px_var(--shadow-color)]"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-heading font-black text-sm text-[var(--foreground)]">
                            {course?.name}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 mt-0.5 font-mono">
                            <span className="font-bold text-[var(--foreground)]">{course?.code}</span>
                            <span>•</span>
                            <span>{slot.label}</span>
                            {slot.room && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-[var(--foreground)]">{slot.room}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {actualRec && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                              actualRec.status === 'present'
                                ? 'bg-emerald-400 text-slate-900 border-[var(--border)]'
                                : 'bg-rose-400 text-slate-900 border-[var(--border)]'
                            }`}
                          >
                            {actualRec.status}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      {!selectedDayHoliday && (
                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
                          {selectedDayIsFuture ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="text-xs text-[var(--muted-foreground)] font-bold">
                                Simulation:
                              </span>
                              <button
                                onClick={() =>
                                  setPlannedSlots((prev) => ({
                                    ...prev,
                                    [planKey]: 'attend',
                                  }))
                                }
                                className={`flex-1 py-1.5 rounded-full text-xs font-bold border-2 border-[var(--border)] transition-all ${
                                  currentPlan === 'attend'
                                    ? 'bg-emerald-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                                    : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                              >
                                Plan Attend
                              </button>
                              <button
                                onClick={() =>
                                  setPlannedSlots((prev) => ({
                                    ...prev,
                                    [planKey]: 'skip',
                                  }))
                                }
                                className={`flex-1 py-1.5 rounded-full text-xs font-bold border-2 border-[var(--border)] transition-all ${
                                  currentPlan === 'skip'
                                    ? 'bg-rose-500 text-white shadow-[2px_2px_0px_var(--shadow-color)]'
                                    : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                              >
                                Plan Skip
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 w-full">
                              <button
                                onClick={() =>
                                  onLogAttendance(slot.courseId, selectedDayStr, 'present')
                                }
                                className="flex-1 py-1.5 rounded-full bg-emerald-500 text-white border-2 border-[var(--border)] text-xs font-bold shadow-[2px_2px_0px_var(--shadow-color)] transition-transform active:scale-95"
                              >
                                Mark Present
                              </button>
                              <button
                                onClick={() =>
                                  onLogAttendance(slot.courseId, selectedDayStr, 'absent')
                                }
                                className="flex-1 py-1.5 rounded-full bg-rose-500 text-white border-2 border-[var(--border)] text-xs font-bold shadow-[2px_2px_0px_var(--shadow-color)] transition-transform active:scale-95"
                              >
                                Mark Absent
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Confirmed actual records on this day */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] font-mono">
                Confirmed Records ({selectedDayAttendance.length})
              </div>

              {selectedDayAttendance.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] p-4 bg-[var(--background)] rounded-2xl border-2 border-dashed border-[var(--border)] text-center font-mono">
                  No confirmed records logged for this date.
                </div>
              ) : (
                selectedDayAttendance.map((rec) => {
                  const course = courses.find((c) => c.id === rec.courseId)
                  return (
                    <div
                      key={rec.id}
                      className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-[2px_2px_0px_var(--shadow-color)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                            rec.status === 'present'
                              ? 'bg-emerald-400 text-slate-900 border-[var(--border)]'
                              : 'bg-rose-400 text-slate-900 border-[var(--border)]'
                          }`}
                        >
                          {rec.status}
                        </span>
                        <div>
                          <div className="font-heading font-bold text-slate-900 dark:text-slate-100">
                            {course?.name} ({course?.code})
                          </div>
                          {rec.note && (
                            <div className="text-[var(--muted-foreground)] text-[11px]">{rec.note}</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteAttendance(rec.id)}
                        className="p-1 rounded text-[var(--muted-foreground)] hover:text-rose-500 transition-colors"
                        title="Delete record"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
