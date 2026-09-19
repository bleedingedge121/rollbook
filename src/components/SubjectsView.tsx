'use client'

import React, { useState, useMemo } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  History,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  Zap,
  Filter,
  Sliders,
  Minus,
} from 'lucide-react'
import { CourseWithStats, AttendanceRecord } from '@/types'
import { formatDate } from '@/lib/formatters'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from 'recharts'
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion'

interface SubjectsViewProps {
  courses: CourseWithStats[]
  onAddCourse: () => void
  onEditCourse: (course: CourseWithStats) => void
  onDeleteCourse: (courseId: string) => Promise<void>
  onLogAttendance: (courseId: string, date: string, status: 'present' | 'absent', note?: string) => Promise<void>
  onDeleteAttendance: (recordId: string) => Promise<void>
  onUpdateCourseDirect?: (courseData: any) => Promise<void>
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  courses,
  onAddCourse,
  onEditCourse,
  onDeleteCourse,
  onLogAttendance,
  onDeleteAttendance,
  onUpdateCourseDirect,
}) => {
  const [selectedCourse, setSelectedCourse] = useState<CourseWithStats | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'safe' | 'critical'>('all')
  const [newLogDate, setNewLogDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [newLogStatus, setNewLogStatus] = useState<'present' | 'absent'>('present')
  const [newLogNote, setNewLogNote] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Filtered courses based on status (memoized)
  const filteredCourses = useMemo(() => {
    if (filterMode === 'safe') return courses.filter((c) => c.stats.isSafe)
    if (filterMode === 'critical') return courses.filter((c) => !c.stats.isSafe)
    return courses
  }, [courses, filterMode])

  // Stepper handlers for Simple Mode
  const handleSimpleCountChange = async (
    course: CourseWithStats,
    field: 'attended' | 'held',
    delta: number
  ) => {
    if (!onUpdateCourseDirect) return
    const currentHeld = course.simpleHeld || 0
    const currentAttended = course.simpleAttended || 0

    let newHeld = currentHeld
    let newAttended = currentAttended

    if (field === 'attended') {
      newAttended = Math.max(0, currentAttended + delta)
      if (newAttended > newHeld) newHeld = newAttended
    } else {
      newHeld = Math.max(0, currentHeld + delta)
      if (newAttended > newHeld) newAttended = newHeld
    }

    await onUpdateCourseDirect({
      id: course.id,
      name: course.name,
      code: course.code,
      requiredPercent: course.requiredPercent,
      color: course.color,
      trackingMode: 'simple',
      simpleHeld: newHeld,
      simpleAttended: newAttended,
    })
  }

  const handleToggleTrackingMode = async (course: CourseWithStats) => {
    if (!onUpdateCourseDirect) return
    const nextMode = course.trackingMode === 'simple' ? 'detailed' : 'simple'
    await onUpdateCourseDirect({
      id: course.id,
      name: course.name,
      code: course.code,
      requiredPercent: course.requiredPercent,
      color: course.color,
      trackingMode: nextMode,
      simpleHeld: course.simpleHeld || course.stats.total,
      simpleAttended: course.simpleAttended || course.stats.present,
    })
  }

  // Generate historical sparkline data for a course (memoized per course)
  const generateTrendData = (records: AttendanceRecord[]) => {
    if (!records || records.length === 0) return []
    const sorted = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    let presentSoFar = 0
    let totalSoFar = 0

    return sorted.map((rec, index) => {
      if (rec.status === 'present') presentSoFar++
      totalSoFar++
      const pct = Number(((presentSoFar / totalSoFar) * 100).toFixed(1))
      return {
        index: index + 1,
        date: formatDate(rec.date),
        percentage: pct,
        status: rec.status,
      }
    })
  }

  const handleCreateManualLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse) return
    setIsSubmitting(true)
    try {
      await onLogAttendance(
        selectedCourse.id,
        newLogDate,
        newLogStatus,
        newLogNote.trim() || undefined
      )
      setNewLogNote('')
      const updated = courses.find((c) => c.id === selectedCourse.id)
      if (updated) setSelectedCourse(updated)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this attendance entry?')) return
    await onDeleteAttendance(recordId)
    if (selectedCourse) {
      const updated = courses.find((c) => c.id === selectedCourse.id)
      if (updated) setSelectedCourse(updated)
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.06 },
    },
  }

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-teal-600 dark:text-teal-400" />
            Registered Subjects
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1">
            Confirmed attendance analytics, safe skip buffers, and flexible tracking modes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter Pills */}
          <div className="flex items-center p-1 rounded-full bg-[var(--card)] border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)] text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-teal-600 text-white shadow-[1px_1px_0px_var(--shadow-color)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              All ({courses.length})
            </button>
            <button
              onClick={() => setFilterMode('safe')}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                filterMode === 'safe'
                  ? 'bg-emerald-500 text-white shadow-[1px_1px_0px_var(--shadow-color)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Safe ({courses.filter((c) => c.stats.isSafe).length})
            </button>
            <button
              onClick={() => setFilterMode('critical')}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                filterMode === 'critical'
                  ? 'bg-rose-500 text-white shadow-[1px_1px_0px_var(--shadow-color)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Deficit ({courses.filter((c) => !c.stats.isSafe).length})
            </button>
          </div>

          <motion.button
            whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
            onClick={onAddCourse}
            className="pill-btn flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-transform shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Subject
          </motion.button>
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="bg-[var(--card)] border-2 border-dashed border-[var(--border)] rounded-3xl p-12 text-center shadow-[4px_4px_0px_var(--shadow-color)]">
          <AlertCircle className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
          <h3 className="text-lg font-heading font-black text-[var(--foreground)]">No subjects registered</h3>
          <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto mt-1 mb-6">
            Add your semester subjects or load your official department section schedule in Settings.
          </p>
          <button
            onClick={onAddCourse}
            className="pill-btn px-5 py-2.5 bg-teal-600 text-white text-xs font-bold"
          >
            Create First Subject
          </button>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredCourses.map((course) => {
            const { stats } = course
            const isSimpleMode = course.trackingMode === 'simple'
            const trendData = generateTrendData(course.attendance || [])

            return (
              <motion.div
                key={course.id}
                variants={cardVariants}
                whileHover={prefersReducedMotion ? {} : { y: -3, rotate: -0.5 }}
                className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-[5px_5px_0px_var(--shadow-color)] relative group transition-all"
              >
                {/* Course Header & Mode Switch */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-[var(--border)]"
                          style={{ backgroundColor: course.color || '#0D9488' }}
                        />
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)]">
                          {course.code}
                        </span>
                        <button
                          onClick={() => handleToggleTrackingMode(course)}
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors ${
                            isSimpleMode
                              ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                              : 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
                          }`}
                          title="Click to toggle between Detailed (Calendar) and Simple (Counter) mode"
                        >
                          {isSimpleMode ? '⚡ Simple Count' : '📅 Detailed Log'}
                        </button>
                      </div>
                      <h2 className="text-base font-heading font-black text-[var(--foreground)] leading-snug truncate max-w-[220px]">
                        {course.name}
                      </h2>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditCourse(course)}
                        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                        title="Edit course"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteCourse(course.id)}
                        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-[var(--muted)] transition-colors"
                        title="Delete course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Percentage & Standing Status */}
                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <div className="text-3xl font-heading font-black text-[var(--foreground)] tracking-tight">
                        {stats.percentage}%
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">
                        Target: <span className="font-bold text-[var(--foreground)]">{course.requiredPercent}%</span>
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 border-2 border-[var(--border)] shadow-[1px_1px_0px_var(--shadow-color)] ${
                        stats.isSafe
                          ? 'bg-emerald-400 text-slate-900'
                          : 'bg-rose-400 text-slate-900'
                      }`}
                    >
                      {stats.isSafe ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Safe Zone</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Critical</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        stats.isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, stats.percentage)}%` }}
                    />
                  </div>

                  {/* SIMPLE MODE: Interactive Direct Stepper Controls */}
                  {isSimpleMode ? (
                    <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-3 space-y-2.5 font-mono shadow-[2px_2px_0px_var(--shadow-color)]">
                      <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase flex items-center justify-between">
                        <span>Total Counter Controls</span>
                        <span className="text-amber-600 dark:text-amber-400">⚡ Live Bunk-Me</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Attended Stepper */}
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-2 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-[var(--muted-foreground)] block">Attended</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              {course.simpleAttended || 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSimpleCountChange(course, 'attended', -1)}
                              className="w-6 h-6 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center font-bold text-xs hover:bg-[var(--muted)] transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleSimpleCountChange(course, 'attended', 1)}
                              className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs hover:bg-emerald-400 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Total Held Stepper */}
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-2 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-[var(--muted-foreground)] block">Total Held</span>
                            <span className="text-sm font-black text-[var(--foreground)]">
                              {course.simpleHeld || 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSimpleCountChange(course, 'held', -1)}
                              className="w-6 h-6 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center font-bold text-xs hover:bg-[var(--muted)] transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleSimpleCountChange(course, 'held', 1)}
                              className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs hover:bg-teal-500 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* DETAILED MODE: Stats Counter Bar */
                    <div className="grid grid-cols-3 gap-2 text-center bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-2.5 font-mono shadow-[2px_2px_0px_var(--shadow-color)]">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                          Attended
                        </div>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {stats.present}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                          Absent
                        </div>
                        <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                          {stats.absent}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                          Held
                        </div>
                        <div className="text-sm font-black text-[var(--foreground)]">
                          {stats.total}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Skip / Recovery Margin Line */}
                  <div
                    className={`p-3 rounded-2xl border-2 border-[var(--border)] text-xs font-medium flex items-start gap-2 shadow-[2px_2px_0px_var(--shadow-color)] ${
                      stats.isSafe
                        ? 'bg-emerald-400/15 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-400/15 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-mono text-[11px] leading-relaxed">{stats.statusText}</span>
                  </div>

                  {/* Mini Sparkline Chart for Detailed Mode */}
                  {!isSimpleMode && trendData.length > 1 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono">
                        <span className="flex items-center gap-1 font-bold">
                          <TrendingUp className="w-3 h-3 text-teal-500" /> Attendance Trend
                        </span>
                        <span className="text-[10px]">{trendData.length} records</span>
                      </div>
                      <div className="h-14 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData}>
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload
                                  return (
                                    <div className="bg-[var(--card)] border-2 border-[var(--border)] text-xs p-2 rounded-xl shadow-[3px_3px_0px_var(--shadow-color)] font-mono">
                                      <p className="text-[var(--foreground)] font-bold">{data.date}</p>
                                      <p className="font-black text-teal-600 dark:text-teal-400">
                                        {data.percentage}% ({data.status})
                                      </p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="percentage"
                              stroke={stats.isSafe ? '#10B981' : '#F43F5E'}
                              strokeWidth={2.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer History Trigger (Detailed Mode only) */}
                {!isSimpleMode && (
                  <motion.button
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    onClick={() => setSelectedCourse(course)}
                    className="w-full py-2.5 px-4 rounded-full bg-[var(--background)] hover:bg-[var(--muted)] border-2 border-[var(--border)] text-xs font-bold text-[var(--foreground)] flex items-center justify-center gap-1.5 transition-all shadow-[2px_2px_0px_var(--shadow-color)]"
                  >
                    <History className="w-3.5 h-3.5 text-teal-600" />
                    View & Edit Attendance Log ({course.attendance?.length || 0})
                  </motion.button>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Course History Drawer / Modal with Framer Motion AnimatePresence */}
      <AnimatePresence>
        {selectedCourse && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.95, y: 15 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.95, y: 15 }
              }
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[8px_8px_0px_var(--shadow-color)] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b-2 border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)]">
                      {selectedCourse.code}
                    </span>
                    <h3 className="text-lg font-heading font-black text-[var(--foreground)]">
                      {selectedCourse.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 font-mono">
                    Confirmed Log ({selectedCourse.stats.present} Present /{' '}
                    {selectedCourse.stats.absent} Absent — {selectedCourse.stats.percentage}%)
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors font-mono"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-dot-grid">
                {/* Add Manual Entry Form */}
                <form
                  onSubmit={handleCreateManualLog}
                  className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 space-y-3 shadow-[3px_3px_0px_var(--shadow-color)]"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5 font-mono">
                    <Plus className="w-3.5 h-3.5 text-teal-600" /> Log Confirmed Attendance
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1">Date</label>
                      <input
                        type="date"
                        value={newLogDate}
                        onChange={(e) => setNewLogDate(e.target.value)}
                        required
                        className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1">Status</label>
                      <select
                        value={newLogStatus}
                        onChange={(e) => setNewLogStatus(e.target.value as any)}
                        className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-bold"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1">Note (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Lab, Quiz"
                        value={newLogNote}
                        onChange={(e) => setNewLogNote(e.target.value)}
                        className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="pill-btn px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-[2px_2px_0px_var(--shadow-color)]"
                    >
                      {isSubmitting ? 'Saving...' : 'Add Record'}
                    </button>
                  </div>
                </form>

                {/* Records List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] font-mono">
                    Confirmed History ({selectedCourse.attendance?.length || 0} entries)
                  </div>

                  {!selectedCourse.attendance || selectedCourse.attendance.length === 0 ? (
                    <div className="text-center py-8 text-[var(--muted-foreground)] text-xs">
                      No confirmed records logged yet for this subject.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {[...selectedCourse.attendance]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((rec) => (
                          <div
                            key={rec.id}
                            className="bg-[var(--background)] border-2 border-[var(--border)] rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-[2px_2px_0px_var(--shadow-color)]"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border border-[var(--border)] ${
                                  rec.status === 'present'
                                    ? 'bg-emerald-400 text-slate-900'
                                    : 'bg-rose-400 text-slate-900'
                                }`}
                              >
                                {rec.status}
                              </span>
                              <span className="font-mono text-[var(--foreground)] font-bold">
                                {formatDate(rec.date)}
                              </span>
                              {rec.note && (
                                <span className="text-[var(--muted-foreground)] truncate max-w-[200px]">
                                  {rec.note}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="p-1 rounded text-[var(--muted-foreground)] hover:text-rose-500 transition-colors"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[var(--card)] border-t-2 border-[var(--border)] flex justify-end">
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="pill-btn px-4 py-2 bg-[var(--background)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
