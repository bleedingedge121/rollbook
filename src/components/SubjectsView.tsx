'use client'

import React, { useState } from 'react'
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
} from 'lucide-react'
import { CourseWithStats, AttendanceRecord } from '@/types'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from 'recharts'

interface SubjectsViewProps {
  courses: CourseWithStats[]
  onAddCourse: () => void
  onEditCourse: (course: CourseWithStats) => void
  onDeleteCourse: (courseId: string) => Promise<void>
  onLogAttendance: (courseId: string, date: string, status: 'present' | 'absent', note?: string) => Promise<void>
  onDeleteAttendance: (recordId: string) => Promise<void>
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  courses,
  onAddCourse,
  onEditCourse,
  onDeleteCourse,
  onLogAttendance,
  onDeleteAttendance,
}) => {
  const [selectedCourse, setSelectedCourse] = useState<CourseWithStats | null>(null)
  const [newLogDate, setNewLogDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [newLogStatus, setNewLogStatus] = useState<'present' | 'absent'>('present')
  const [newLogNote, setNewLogNote] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Generate historical sparkline data for a course
  const generateTrendData = (records: AttendanceRecord[]) => {
    if (!records || records.length === 0) return []
    // Sort records chronologically
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
        date: rec.date,
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
      // Refresh current selected course reference
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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Subjects & Attendance Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Confirmed attendance analytics, skip margins, and audit trails per subject.
          </p>
        </div>
        <button
          onClick={onAddCourse}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="bg-[#131b2e] border border-dashed border-slate-800 rounded-3xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300">No subjects registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            Add your semester subjects or load your SLCM synced data in Settings to get started.
          </p>
          <button
            onClick={onAddCourse}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
          >
            Create First Subject
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const { stats } = course
            const trendData = generateTrendData(course.attendance || [])

            return (
              <div
                key={course.id}
                className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-5 transition-all hover:border-slate-700/80 shadow-lg relative group"
              >
                {/* Course Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: course.color || '#3b82f6' }}
                        />
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {course.code}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-100 leading-snug">
                        {course.name}
                      </h2>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditCourse(course)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="Edit course"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteCourse(course.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Big Percentage & Target */}
                  <div className="flex items-end justify-between pt-2">
                    <div>
                      <div className="text-3xl font-extrabold text-slate-100 tracking-tight">
                        {stats.percentage}%
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Target: <span className="font-semibold text-slate-300">{course.requiredPercent}%</span>
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                        stats.isSafe
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {stats.isSafe ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Safe Zone</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Critical</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        stats.isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, stats.percentage)}%` }}
                    />
                  </div>

                  {/* Stats Counter Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">
                        Attended
                      </div>
                      <div className="text-sm font-bold text-emerald-400">
                        {stats.present}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">
                        Absent
                      </div>
                      <div className="text-sm font-bold text-rose-400">
                        {stats.absent}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400">
                        Held
                      </div>
                      <div className="text-sm font-bold text-slate-200">
                        {stats.total}
                      </div>
                    </div>
                  </div>

                  {/* Skip / Recovery Margin Line */}
                  <div
                    className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                      stats.isSafe
                        ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/25 text-rose-300'
                    }`}
                  >
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{stats.statusText}</span>
                  </div>

                  {/* Mini Sparkline Chart */}
                  {trendData.length > 1 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-medium">
                          <TrendingUp className="w-3 h-3 text-blue-400" /> Historical Trend
                        </span>
                        <span>{trendData.length} records</span>
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
                                    <div className="bg-slate-900 border border-slate-700 text-xs p-2 rounded-lg shadow-lg">
                                      <p className="font-mono text-slate-300">{data.date}</p>
                                      <p className="font-bold text-blue-400">
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
                              stroke={stats.isSafe ? '#10b981' : '#ef4444'}
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer / History trigger */}
                <button
                  onClick={() => setSelectedCourse(course)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-blue-400" />
                  View & Edit Attendance Log ({course.attendance?.length || 0})
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Course History Drawer / Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedCourse.code}
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">
                    {selectedCourse.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Confirmed Attendance Audit Log ({selectedCourse.stats.present} Present /{' '}
                  {selectedCourse.stats.absent} Absent — {selectedCourse.stats.percentage}%)
                </p>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Add Manual Entry Form */}
              <form
                onSubmit={handleCreateManualLog}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-400" /> Log Confirmed Attendance
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Date</label>
                    <input
                      type="date"
                      value={newLogDate}
                      onChange={(e) => setNewLogDate(e.target.value)}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Status</label>
                    <select
                      value={newLogStatus}
                      onChange={(e) => setNewLogStatus(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Lab, Quiz"
                      value={newLogNote}
                      onChange={(e) => setNewLogNote(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? 'Saving...' : 'Add Record'}
                  </button>
                </div>
              </form>

              {/* Records List */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Confirmed History ({selectedCourse.attendance?.length || 0} entries)
                </div>

                {!selectedCourse.attendance || selectedCourse.attendance.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No confirmed records logged yet for this subject.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {[...selectedCourse.attendance]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((rec) => (
                        <div
                          key={rec.id}
                          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                                rec.status === 'present'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {rec.status}
                            </span>
                            <span className="font-mono text-slate-300 font-semibold">
                              {rec.date}
                            </span>
                            {rec.note && (
                              <span className="text-slate-400 truncate max-w-[200px]">
                                {rec.note}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
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
            <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCourse(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
