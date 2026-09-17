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
  HelpCircle,
  Clock,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'
import {
  CourseWithStats,
  TimetableSlot,
  AttendanceRecord,
  PlannedSlot,
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
import { toDateString, parseDateString, calculateAttendance } from '@/lib/attendance'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'

interface CalendarViewProps {
  courses: CourseWithStats[]
  allSlots: TimetableSlot[]
  allAttendance: AttendanceRecord[]
  onLogAttendance: (
    courseId: string,
    date: string,
    status: 'present' | 'absent',
    note?: string
  ) => Promise<void>
  onDeleteAttendance: (recordId: string) => Promise<void>
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  courses,
  allSlots,
  allAttendance,
  onLogAttendance,
  onDeleteAttendance,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [plannedSlots, setPlannedSlots] = useState<Record<string, 'attend' | 'skip'>>({})
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all')

  const today = new Date()
  const todayStr = toDateString(today)

  // Calendar matrix days calculation
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  // Toggle future plan
  const handleTogglePlan = (dateStr: string, slotId: string, courseId: string) => {
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
  const handlePlanAll = (plan: 'attend' | 'skip') => {
    const updated: Record<string, 'attend' | 'skip'> = { ...plannedSlots }
    calendarDays.forEach((day) => {
      const dateStr = toDateString(day)
      if (isAfter(day, today) || isSameDay(day, today)) {
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

  // Projected trajectory calculations
  const { overallActualPct, overallProjectedPct, projectedByCourse, trajectoryData } =
    useMemo(() => {
      // 1. Calculate actual numbers
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

      // 2. Count planned future attendances / skips
      let planPresent = 0
      let planAbsent = 0
      const plannedCourseMap: Record<string, { present: number; absent: number }> = {}

      courses.forEach((c) => {
        plannedCourseMap[c.id] = { present: 0, absent: 0 }
      })

      Object.entries(plannedSlots).forEach(([key, plan]) => {
        const [dateStr, slotId] = key.split('_')
        const slot = allSlots.find((s) => s.id === slotId)
        if (!slot) return

        if (selectedCourseFilter === 'all' || slot.courseId === selectedCourseFilter) {
          if (plan === 'attend') planPresent++
          if (plan === 'skip') planAbsent++
        }

        if (plannedCourseMap[slot.courseId]) {
          if (plan === 'attend') plannedCourseMap[slot.courseId].present++
          if (plan === 'skip') plannedCourseMap[slot.courseId].absent++
        }
      })

      const projTotal = actTotal + planPresent + planAbsent
      const projPresent = actPresent + planPresent
      const projectedPct =
        projTotal > 0 ? Number(((projPresent / projTotal) * 100).toFixed(1)) : actualPct

      // Course-by-course projections
      const courseProjections = courses.map((course) => {
        const pCounts = plannedCourseMap[course.id] || { present: 0, absent: 0 }
        const totPresent = course.stats.present + pCounts.present
        const totAbsent = course.stats.absent + pCounts.absent
        const tot = totPresent + totAbsent
        const projCoursePct = tot > 0 ? Number(((totPresent / tot) * 100).toFixed(1)) : 100
        const delta = Number((projCoursePct - course.stats.percentage).toFixed(1))

        return {
          id: course.id,
          name: course.name,
          code: course.code,
          actualPct: course.stats.percentage,
          projectedPct: projCoursePct,
          delta,
          plannedPresent: pCounts.present,
          plannedAbsent: pCounts.absent,
          isSafe: projCoursePct >= course.requiredPercent,
        }
      })

      // Generate Trajectory Points (past actual trend + future projection)
      const trajectory: { name: string; actual?: number; projected?: number }[] = []

      // Add baseline actual point
      trajectory.push({
        name: 'Current Actual',
        actual: actualPct,
        projected: actualPct,
      })

      // Project next 4 weeks in increments based on plan
      if (planPresent + planAbsent > 0) {
        trajectory.push({
          name: '+1 Week',
          projected: Number(
            (
              ((actPresent + planPresent * 0.25) /
                Math.max(1, actTotal + (planPresent + planAbsent) * 0.25)) *
              100
            ).toFixed(1)
          ),
        })
        trajectory.push({
          name: '+2 Weeks',
          projected: Number(
            (
              ((actPresent + planPresent * 0.5) /
                Math.max(1, actTotal + (planPresent + planAbsent) * 0.5)) *
              100
            ).toFixed(1)
          ),
        })
        trajectory.push({
          name: 'End of Plan',
          projected: projectedPct,
        })
      }

      return {
        overallActualPct: actualPct,
        overallProjectedPct: projectedPct,
        projectedByCourse: courseProjections,
        trajectoryData: trajectory,
      }
    }, [courses, allSlots, plannedSlots, selectedCourseFilter])

  // Get records and slots for selected inspector day
  const selectedDayStr = selectedDay ? toDateString(selectedDay) : todayStr
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-blue-400" />
            Calendar & Trajectory Planner
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Solid badges represent confirmed actuals; dashed outlines project future scenarios.
          </p>
        </div>

        {/* Filter by course */}
        <div className="flex items-center gap-3">
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Subjects (Aggregated)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trajectory Simulation Banner */}
      <div className="bg-gradient-to-r from-[#131b2e] via-[#11192b] to-[#0e1422] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Live Attendance Projection Matrix
              </h2>
              <p className="text-xs text-slate-400">
                Toggling upcoming classes simulates the impact without altering real data.
              </p>
            </div>
          </div>

          {/* Preset Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePlanAll('attend')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Plan Attend All
            </button>
            <button
              onClick={() => handlePlanAll('skip')}
              className="px-3 py-1.5 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Plan Skip All
            </button>
            <button
              onClick={handleResetPlans}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Reset planning simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Projection KPI comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Current Actual
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {overallActualPct}%
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Based on verified records</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Projected Trajectory
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-blue-400">
                {overallProjectedPct}%
              </span>
              <span
                className={`text-xs font-bold ${
                  overallProjectedPct >= overallActualPct
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {overallProjectedPct >= overallActualPct ? '+' : ''}
                {(overallProjectedPct - overallActualPct).toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {Object.keys(plannedSlots).length} future classes planned
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Compliance Status
            </div>
            <div
              className={`text-base font-bold mt-1 ${
                overallProjectedPct >= 75 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {overallProjectedPct >= 75
                ? 'Target Maintained (≥75%)'
                : 'Projected Below 75% Target'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Minimum 75% requirement</div>
          </div>
        </div>

        {/* Trajectory Recharts Line Graph */}
        {trajectoryData.length > 1 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Projection Curve</span>
              <span className="text-slate-500">Solid: Actual / Dashed: Simulation</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectoryData}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis domain={[50, 100]} stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                  />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" label="75% Target" />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#38bdf8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Month Navigation & Grid */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        {/* Month Navigation Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Actual Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span>Actual Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-dashed border-emerald-400 bg-emerald-500/20" />
            <span>Planned Attend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-dashed border-rose-400 bg-rose-500/20" />
            <span>Planned Skip</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Weekday Headers (Mon - Sun) */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="text-center py-2 text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              {day}
            </div>
          ))}

          {/* Days */}
          {calendarDays.map((day, idx) => {
            const dateStr = toDateString(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isCurrentDay = isToday(day)
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const isPast = isBefore(day, today) && !isSameDay(day, today)
            const isFuture = isAfter(day, today) && !isSameDay(day, today)
            const weekday = day.getDay()

            // Scheduled slots for this weekday
            const slotsForDay = allSlots.filter((s) => s.weekday === weekday)
            // Actual confirmed attendance for this day
            const recordsForDay = allAttendance.filter((a) => a.date === dateStr)

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[90px] sm:min-h-[110px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  !isCurrentMonth
                    ? 'opacity-30 bg-slate-950/20 border-slate-900'
                    : isSelected
                    ? 'bg-slate-800/90 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                    : isCurrentDay
                    ? 'bg-slate-900 border-blue-500/50'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold rounded-lg px-1.5 py-0.5 ${
                      isCurrentDay
                        ? 'bg-blue-600 text-white'
                        : isSelected
                        ? 'text-blue-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {recordsForDay.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {recordsForDay.filter((r) => r.status === 'present').length}P/
                      {recordsForDay.filter((r) => r.status === 'absent').length}A
                    </span>
                  )}
                </div>

                {/* Slots & Status Badges */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {/* Actual confirmed records (Past & Today) */}
                  {recordsForDay.map((rec) => {
                    const course = courses.find((c) => c.id === rec.courseId)
                    return (
                      <div
                        key={rec.id}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate flex items-center gap-1 shadow-sm ${
                          rec.status === 'present'
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-600/30 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: course?.color || '#3b82f6' }}
                        />
                        <span className="truncate">{course?.code || 'Class'}</span>
                      </div>
                    )
                  })}

                  {/* Future Planning Slots */}
                  {(isFuture || (isToday(day) && recordsForDay.length === 0)) &&
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
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate flex items-center justify-between gap-1 border border-dashed transition-all hover:scale-[1.02] ${
                            planStatus === 'attend'
                              ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                              : planStatus === 'skip'
                              ? 'bg-rose-500/15 border-rose-400 text-rose-300'
                              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                          title="Click to toggle Plan: Attend -> Skip -> Reset"
                        >
                          <span className="truncate">{course?.code || 'Slot'}</span>
                          <span className="text-[9px] uppercase font-bold shrink-0">
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

                {/* Footer indicator if day has no slots */}
                {slotsForDay.length === 0 && recordsForDay.length === 0 && (
                  <div className="text-[10px] text-slate-700 text-center py-1">
                    Off
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Day Inspector */}
      {selectedDay && (
        <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-400" />
                Day Inspector: {format(selectedDay, 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDayIsFuture
                  ? 'Future Date: Configure planning assumptions below'
                  : 'Past/Today: Confirm actual attendance'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scheduled slots for this weekday */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Timetable Slots ({selectedDaySlots.length})
              </div>

              {selectedDaySlots.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
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
                      className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm text-slate-200">
                            {course?.name}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-slate-300">{course?.code}</span>
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

                        {actualRec && (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                              actualRec.status === 'present'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            Confirmed {actualRec.status}
                          </span>
                        )}
                      </div>

                      {/* Action buttons depending on whether day is future or past */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                        {selectedDayIsFuture ? (
                          <div className="flex items-center gap-2 w-full">
                            <span className="text-xs text-slate-400 font-medium">
                              Simulation:
                            </span>
                            <button
                              onClick={() =>
                                setPlannedSlots((prev) => ({
                                  ...prev,
                                  [planKey]: 'attend',
                                }))
                              }
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                currentPlan === 'attend'
                                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
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
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                currentPlan === 'skip'
                                  ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-sm'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
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
                              className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
                            >
                              Mark Present
                            </button>
                            <button
                              onClick={() =>
                                onLogAttendance(slot.courseId, selectedDayStr, 'absent')
                              }
                              className="flex-1 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-semibold transition-colors"
                            >
                              Mark Absent
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Confirmed actual records on this day */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Confirmed Records on this Date ({selectedDayAttendance.length})
              </div>

              {selectedDayAttendance.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
                  No confirmed records logged for this date.
                </div>
              ) : (
                selectedDayAttendance.map((rec) => {
                  const course = courses.find((c) => c.id === rec.courseId)
                  return (
                    <div
                      key={rec.id}
                      className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rec.status === 'present'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {rec.status}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-200">
                            {course?.name} ({course?.code})
                          </div>
                          {rec.note && (
                            <div className="text-slate-400 text-[11px]">{rec.note}</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteAttendance(rec.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
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
