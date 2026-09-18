'use client'

import React, { useState, useRef } from 'react'
import {
  BookOpen,
  Calendar,
  Upload,
  Download,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Terminal,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Database,
  AlertTriangle,
  RotateCcw,
  GraduationCap,
  Palmtree,
  FileText,
} from 'lucide-react'
import { CourseWithStats, TimetableSlot, Holiday } from '@/types'
import { WEEKDAYS } from '@/lib/attendance'
import { CourseModal } from './CourseModal'
import { SlotModal } from './SlotModal'
import { SyncModal, SyncDiffItem, DbCourseSummary, CourseMergeDecision } from './SyncModal'
import { SectionImportModal } from './SectionImportModal'

interface SettingsViewProps {
  courses: CourseWithStats[]
  slots: TimetableSlot[]
  holidays?: Holiday[]
  onSaveCourse: (courseData: any) => Promise<void>
  onDeleteCourse: (courseId: string) => Promise<void>
  onSaveSlot: (slotData: any) => Promise<void>
  onDeleteSlot: (slotId: string) => Promise<void>
  onSaveHoliday?: (holidayData: { date: string; label: string; type?: string }) => Promise<void>
  onDeleteHoliday?: (id: string) => Promise<void>
  onRefreshAll: () => Promise<void>
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  courses,
  slots,
  holidays = [],
  onSaveCourse,
  onDeleteCourse,
  onSaveSlot,
  onDeleteSlot,
  onSaveHoliday,
  onDeleteHoliday,
  onRefreshAll,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sync' | 'courses' | 'timetable' | 'holidays' | 'backup'>('sync')

  // Modals state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseWithStats | null>(null)

  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null)

  // Sync diff state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false)
  const [syncDiff, setSyncDiff] = useState<SyncDiffItem[]>([])
  const [availableDbCourses, setAvailableDbCourses] = useState<DbCourseSummary[]>([])
  const [syncedAtTime, setSyncedAtTime] = useState<string | undefined>()
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isParsingSync, setIsParsingSync] = useState(false)

  // Add Holiday Form State
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayLabel, setNewHolidayLabel] = useState('')
  const [newHolidayType, setNewHolidayType] = useState<'holiday' | 'exam'>('holiday')
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false)

  // Reset confirmation state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState('')
  const [isResetWithSeed, setIsResetWithSeed] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)

  // Handle Sync Output JSON Upload
  const handleSyncFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsingSync(true)
    setSyncError(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      if (!json.courses || !Array.isArray(json.courses)) {
        throw new Error('Invalid sync-output.json format: "courses" array missing.')
      }

      // Reconcile via backend API
      const res = await fetch('/api/sync/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reconcile data')

      setSyncDiff(data.diff)
      setAvailableDbCourses(data.availableDbCourses || [])
      setSyncedAtTime(data.syncedAt)
      setIsSyncModalOpen(true)
    } catch (err: any) {
      setSyncError(err.message || 'Error parsing file')
    } finally {
      setIsParsingSync(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Handle Apply Sync
  const handleApplySync = async (merges: CourseMergeDecision[]) => {
    const res = await fetch('/api/sync/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courses: syncDiff.map((d) => ({
          name: d.syncedName,
          code: d.syncedCode,
          present: d.synced.present,
          absent: d.synced.absent,
        })),
        syncedAt: syncedAtTime,
        apply: true,
        merges,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to apply sync')

    alert(data.message || 'Attendance synchronized successfully!')
    await onRefreshAll()
  }

  // Handle Create Holiday
  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHolidayDate || !newHolidayLabel.trim() || !onSaveHoliday) return

    setIsSubmittingHoliday(true)
    try {
      await onSaveHoliday({
        date: newHolidayDate,
        label: newHolidayLabel.trim(),
        type: newHolidayType,
      })
      setNewHolidayDate('')
      setNewHolidayLabel('')
    } finally {
      setIsSubmittingHoliday(false)
    }
  }

  // Handle Reset Execution
  const handleExecuteReset = async () => {
    if (resetConfirmationText.trim() !== 'RESET') {
      alert('Please type RESET in capital letters to confirm.')
      return
    }

    setIsResetting(true)
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedSample: isResetWithSeed }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset database')

      alert(data.message || 'Database reset successfully.')
      setIsResetModalOpen(false)
      setResetConfirmationText('')
      await onRefreshAll()
    } catch (err: any) {
      alert(`Error resetting data: ${err.message}`)
    } finally {
      setIsResetting(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    window.open('/api/export?format=csv', '_blank')
  }

  // Export JSON
  const handleExportJSON = async () => {
    const res = await fetch('/api/export?format=json')
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rollbook-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import JSON Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to restore backup')

      alert(data.message || 'Backup restored successfully!')
      await onRefreshAll()
    } catch (err: any) {
      alert(`Error importing backup: ${err.message}`)
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Settings & Data Bridge
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Synchronize portal attendance, configure timetable slots, declare holidays, and manage backups.
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('sync')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'sync'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> SLCM Sync Bridge
        </button>
        <button
          onClick={() => setActiveSubTab('courses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'courses'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Subjects ({courses.length})
        </button>
        <button
          onClick={() => setActiveSubTab('timetable')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'timetable'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Weekly Timetable ({slots.length})
        </button>
        <button
          onClick={() => setActiveSubTab('holidays')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'holidays'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Palmtree className="w-3.5 h-3.5" /> Holidays & Exams ({holidays.length})
        </button>
        <button
          onClick={() => setActiveSubTab('backup')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'backup'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> Backup & Danger Zone
        </button>
      </div>

      {/* SUB TAB 1: SLCM Sync Bridge */}
      {activeSubTab === 'sync' && (
        <div className="space-y-6">
          {/* Official Department Timetable Import */}
          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-100">
                    Import Official Department Timetable
                  </h2>
                </div>
                <p className="text-xs text-slate-400">
                  Select your section (C01 – C22) to auto-populate subjects and weekly timetable slots directly from the 2026-27 MIT Bengaluru schedule.
                </p>
              </div>

              <button
                onClick={() => setIsSectionModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 shrink-0"
              >
                <GraduationCap className="w-4 h-4" />
                Select My Section
              </button>
            </div>
          </div>

          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-400" />
                  Import Synced SLCM Attendance Data
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload the <code className="text-blue-300">sync-output.json</code> generated by your local scraper.
                </p>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleSyncFileUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingSync}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {isParsingSync ? 'Parsing File...' : 'Load Synced Data (JSON)'}
              </button>
            </div>

            {syncError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}

            {/* Step by Step Scraper Instructions */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Terminal className="w-4 h-4 text-blue-400" />
                How to run the local SLCM scraper
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Step 1 */}
                <div className="bg-[#0e1422] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 text-[11px] flex items-center justify-center font-mono">
                      1
                    </span>
                    One-time Interactive Login
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Opens a real browser to log in with your MAHE Microsoft SSO + MFA and saves the session to <code>auth.json</code>:
                  </p>
                  <div className="bg-slate-950 p-2 rounded-lg font-mono text-[11px] text-blue-300 border border-slate-800">
                    cd scraper && node login.js
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-[#0e1422] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 text-[11px] flex items-center justify-center font-mono">
                      2
                    </span>
                    Sync Attendance Figures
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Headlessly intercepts the Apex response and writes <code>sync-output.json</code>:
                  </p>
                  <div className="bg-slate-950 p-2 rounded-lg font-mono text-[11px] text-emerald-300 border border-slate-800">
                    node sync.js
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: Subjects Management */}
      {activeSubTab === 'courses' && (
        <div className="space-y-6">
          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Manage Registered Subjects</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure attendance thresholds and subject identifiers.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingCourse(null)
                  setIsCourseModalOpen(true)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Subject
              </button>
            </div>

            <div className="space-y-2.5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all hover:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: course.color || '#3b82f6' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {course.code}
                        </span>
                        <span className="font-bold text-sm text-slate-100">
                          {course.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Required: <strong className="text-slate-300">{course.requiredPercent}%</strong>
                        {' • '}
                        {course.stats.present} Present / {course.stats.absent} Absent ({course.stats.percentage}%)
                        {course.syncedAt && (
                          <span className="text-blue-400 ml-2">
                            [Synced Baseline: {course.syncedPresent}P/{course.syncedAbsent}A]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingCourse(course)
                        setIsCourseModalOpen(true)
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Edit subject"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete subject ${course.name} and all records?`)) {
                          onDeleteCourse(course.id)
                        }
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: Timetable Management */}
      {activeSubTab === 'timetable' && (
        <div className="space-y-6">
          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Weekly Timetable Schedule</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure the recurring schedule that drives future planning mode.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSlot(null)
                  setIsSlotModalOpen(true)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Slot
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6, 0].map((weekdayNum) => {
                const daySlots = slots.filter((s) => s.weekday === weekdayNum)
                return (
                  <div
                    key={weekdayNum}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="font-bold text-sm text-slate-200">
                        {WEEKDAYS[weekdayNum]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {daySlots.length} lecture{daySlots.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {daySlots.length === 0 ? (
                      <div className="text-xs text-slate-600 py-3 text-center">
                        No lectures scheduled
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {daySlots.map((slot) => {
                          const course = courses.find((c) => c.id === slot.courseId)
                          return (
                            <div
                              key={slot.id}
                              className="bg-[#0e1422] border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-200 truncate">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: course?.color || '#3b82f6',
                                    }}
                                  />
                                  <span className="truncate">{course?.name}</span>
                                </div>
                                <div className="text-slate-400 text-[11px] flex items-center gap-2">
                                  <span>{slot.label}</span>
                                  {slot.room && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-300">{slot.room}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingSlot(slot)
                                    setIsSlotModalOpen(true)
                                  }}
                                  className="p-1 rounded text-slate-500 hover:text-white transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteSlot(slot.id)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: Holidays & Exams */}
      {activeSubTab === 'holidays' && (
        <div className="space-y-6">
          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Palmtree className="w-5 h-5 text-amber-400" />
                Declared Holidays & Exam Days
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Mark holidays and exam days so they are never flagged as unlogged past classes and excluded from planning.
              </p>
            </div>

            {/* Add Holiday Form */}
            <form
              onSubmit={handleCreateHoliday}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 space-y-3.5"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-400" /> Declare Holiday or Exam Date
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Reason / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Diwali Break, Mid-Term Exam"
                    value={newHolidayLabel}
                    onChange={(e) => setNewHolidayLabel(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Type</label>
                  <select
                    value={newHolidayType}
                    onChange={(e) => setNewHolidayType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="holiday">🌴 Holiday / Recess</option>
                    <option value="exam">📝 Exam Day / Assessment</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingHoliday || !newHolidayDate || !newHolidayLabel.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 disabled:opacity-50 transition-colors"
                >
                  {isSubmittingHoliday ? 'Saving...' : 'Add Date'}
                </button>
              </div>
            </form>

            {/* List of Declared Holidays */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Registered Holidays & Exams ({holidays.length})
              </div>

              {holidays.length === 0 ? (
                <div className="text-xs text-slate-500 p-6 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
                  No holidays or exam days registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              h.type === 'exam'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {h.type === 'exam' ? 'Exam' : 'Holiday'}
                          </span>
                          <span className="font-mono text-slate-200 font-semibold">{h.date}</span>
                        </div>
                        <div className="text-slate-300 font-medium truncate">{h.label}</div>
                      </div>

                      {onDeleteHoliday && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove holiday for ${h.date} (${h.label})?`)) {
                              onDeleteHoliday(h.id)
                            }
                          }}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete holiday"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 5: Backup & Danger Zone */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                Data Portability & Backup
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Download your complete attendance archive in CSV or JSON format.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* CSV Export */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    CSV Export
                  </div>
                  <p className="text-xs text-slate-400">
                    Export all subjects and verified attendance logs as spreadsheet CSV.
                  </p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
              </div>

              {/* JSON Backup */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                    <Download className="w-4 h-4 text-blue-400" />
                    Full JSON Backup
                  </div>
                  <p className="text-xs text-slate-400">
                    Complete schema backup including timetable slots and configurations.
                  </p>
                </div>
                <button
                  onClick={handleExportJSON}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download JSON
                </button>
              </div>

              {/* Restore Backup */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                    <Upload className="w-4 h-4 text-amber-400" />
                    Restore Backup
                  </div>
                  <p className="text-xs text-slate-400">
                    Restore database state from a previously saved JSON backup file.
                  </p>
                </div>
                <input
                  type="file"
                  ref={backupInputRef}
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
                <button
                  onClick={() => backupInputRef.current?.click()}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Restore Backup
                </button>
              </div>
            </div>
          </div>

          {/* DANGER ZONE: RESET ALL DATA */}
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-400">
                  Danger Zone: Database Reset
                </h3>
                <p className="text-xs text-slate-400">
                  Clear all subjects, timetable slots, and attendance logs to start completely fresh.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setIsResetWithSeed(false)
                  setResetConfirmationText('')
                  setIsResetModalOpen(true)
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Reset All Data (Empty Database)
              </button>
              <button
                onClick={() => {
                  setIsResetWithSeed(true)
                  setResetConfirmationText('')
                  setIsResetModalOpen(true)
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-blue-400" /> Reset & Reload Sample Subjects
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => {
          setIsCourseModalOpen(false)
          setEditingCourse(null)
        }}
        onSave={onSaveCourse}
        initialData={editingCourse}
      />

      <SlotModal
        isOpen={isSlotModalOpen}
        onClose={() => {
          setIsSlotModalOpen(false)
          setEditingSlot(null)
        }}
        onSave={onSaveSlot}
        courses={courses}
        initialData={editingSlot}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        diff={syncDiff}
        availableDbCourses={availableDbCourses}
        syncedAt={syncedAtTime}
        onApplySync={handleApplySync}
      />

      <SectionImportModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        onImported={onRefreshAll}
      />

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-rose-500/40 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-100">
                Confirm Full Database Reset
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action will permanently delete all registered subjects, weekly schedule slots, and verified attendance logs.
              {isResetWithSeed && ' It will then reload default sample courses.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Type <strong className="text-rose-400 font-mono">RESET</strong> to confirm:
              </label>
              <input
                type="text"
                placeholder="RESET"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-rose-500 uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting || resetConfirmationText.trim() !== 'RESET'}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
