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
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  Copy,
  Check,
} from 'lucide-react'
import { CourseWithStats, TimetableSlot, Holiday } from '@/types'
import { WEEKDAYS } from '@/lib/attendance'
import { CourseModal } from './CourseModal'
import { SlotModal } from './SlotModal'
import { SyncModal, SyncDiffItem, DbCourseSummary, CourseMergeDecision } from './SyncModal'
import { SectionImportModal } from './SectionImportModal'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

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
  const prefersReducedMotion = useReducedMotion()

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

  // 1-Click Sync Agent State
  const [isAgentSyncing, setIsAgentSyncing] = useState(false)
  const [agentOffline, setAgentOffline] = useState(false)
  const [agentStatusNote, setAgentStatusNote] = useState<string | null>(null)
  const [copiedCmd, setCopiedCmd] = useState(false)

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

  // Process Sync Payload directly
  const processSyncPayload = async (json: any) => {
    if (!json.courses || !Array.isArray(json.courses)) {
      throw new Error('Invalid sync format: "courses" array missing.')
    }

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
  }

  // 1-Click Sync Trigger
  const handleOneClickSync = async () => {
    setIsAgentSyncing(true)
    setSyncError(null)
    setAgentOffline(false)
    setAgentStatusNote('Checking local scraper agent (http://localhost:4747)...')

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2500)

      let statusRes
      try {
        statusRes = await fetch('http://localhost:4747/status', {
          signal: controller.signal,
        })
      } catch {
        setAgentOffline(true)
        setIsAgentSyncing(false)
        setAgentStatusNote(null)
        return
      } finally {
        clearTimeout(timeoutId)
      }

      if (!statusRes.ok) {
        setAgentOffline(true)
        setIsAgentSyncing(false)
        setAgentStatusNote(null)
        return
      }

      setAgentStatusNote('Fetching portal attendance (a browser window will open if MFA is required)...')
      const syncRes = await fetch('http://localhost:4747/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const json = await syncRes.json()
      if (!syncRes.ok) {
        throw new Error(json.error || 'Scraper failed to capture portal attendance.')
      }

      setAgentStatusNote('Reconciling subjects with local database...')
      await processSyncPayload(json)
    } catch (err: any) {
      setSyncError(err.message || 'Sync error')
    } finally {
      setIsAgentSyncing(false)
      setAgentStatusNote(null)
    }
  }

  // Handle Sync Output JSON Upload (Fallback)
  const handleSyncFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsingSync(true)
    setSyncError(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await processSyncPayload(json)
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

  const copyAgentCommand = () => {
    navigator.clipboard.writeText('cd scraper && node agent.js')
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-black text-[var(--foreground)] tracking-tight">
          Command & System Bridge
        </h1>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1">
          Synchronize portal attendance, configure timetable slots, declare holidays, and manage backups.
        </p>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center p-1 rounded-full bg-[var(--card)] border-2 border-[var(--border)] shadow-[4px_4px_0px_var(--shadow-color)] overflow-x-auto gap-1">
        <button
          onClick={() => setActiveSubTab('sync')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'sync' ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {activeSubTab === 'sync' && (
            <motion.div
              layoutId="activeSettingsSubTab"
              className="absolute inset-0 rounded-full bg-teal-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <RefreshCw className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">SLCM Sync Bridge</span>
        </button>

        <button
          onClick={() => setActiveSubTab('courses')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'courses' ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {activeSubTab === 'courses' && (
            <motion.div
              layoutId="activeSettingsSubTab"
              className="absolute inset-0 rounded-full bg-teal-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <BookOpen className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Subjects ({courses.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('timetable')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'timetable' ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {activeSubTab === 'timetable' && (
            <motion.div
              layoutId="activeSettingsSubTab"
              className="absolute inset-0 rounded-full bg-teal-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <Calendar className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Weekly Timetable ({slots.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('holidays')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'holidays' ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {activeSubTab === 'holidays' && (
            <motion.div
              layoutId="activeSettingsSubTab"
              className="absolute inset-0 rounded-full bg-teal-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <Palmtree className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Holidays & Exams ({holidays.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('backup')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'backup' ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {activeSubTab === 'backup' && (
            <motion.div
              layoutId="activeSettingsSubTab"
              className="absolute inset-0 rounded-full bg-teal-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <Database className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Backup & Danger Zone</span>
        </button>
      </div>

      {/* SUB TAB 1: SLCM Sync Bridge */}
      {activeSubTab === 'sync' && (
        <div className="space-y-6">
          {/* 1. Official Department Timetable Import */}
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] text-indigo-600 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-heading font-black text-[var(--foreground)]">
                    Import Official Department Timetable
                  </h2>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Select your section (C01 – C22) to auto-populate subjects and weekly timetable slots directly from the MIT Bengaluru official database.
                </p>
              </div>

              <motion.button
                whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                onClick={() => setIsSectionModalOpen(true)}
                className="pill-btn flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-transform shrink-0 font-mono"
              >
                <GraduationCap className="w-4 h-4" />
                Select My Section
              </motion.button>
            </div>
          </div>

          {/* 2. 1-Click SLCM Sync Hub */}
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-heading font-black text-[var(--foreground)] flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  1-Click Live SLCM Attendance Sync
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Synchronize your verified portal attendance in one step without managing manual files.
                </p>
              </div>

              <motion.button
                whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                onClick={handleOneClickSync}
                disabled={isAgentSyncing}
                className="pill-btn flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-transform disabled:opacity-50 font-mono shadow-[3px_3px_0px_var(--shadow-color)]"
              >
                <RefreshCw className={`w-4 h-4 ${isAgentSyncing ? 'animate-spin' : ''}`} />
                {isAgentSyncing ? 'Syncing...' : 'Sync Now (1-Click)'}
              </motion.button>
            </div>

            {agentStatusNote && (
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border-2 border-teal-500/40 text-teal-800 dark:text-teal-300 text-xs flex items-center gap-2 font-mono font-bold animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>{agentStatusNote}</span>
              </div>
            )}

            {syncError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}

            {/* Agent Offline Quick Setup Card */}
            {agentOffline && (
              <div className="p-5 rounded-2xl bg-amber-400/15 border-2 border-[var(--border)] shadow-[4px_4px_0px_var(--shadow-color)] space-y-3">
                <div className="flex items-center gap-2 font-heading font-black text-sm text-[var(--foreground)]">
                  <Terminal className="w-4 h-4 text-amber-600" />
                  Local Scraper Agent Offline
                </div>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Start the local scraper agent once in your terminal to enable 1-Click Sync:
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[var(--background)] p-2.5 rounded-xl font-mono text-xs text-[var(--foreground)] border-2 border-[var(--border)] font-bold">
                    cd scraper && node agent.js
                  </div>
                  <button
                    onClick={copyAgentCommand}
                    className="pill-btn px-3.5 py-2.5 bg-[var(--card)] hover:bg-[var(--muted)] text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCmd ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleOneClickSync}
                    className="pill-btn px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-transform"
                  >
                    Retry Sync
                  </button>
                </div>
              </div>
            )}

            {/* Advanced Manual JSON Fallback Link */}
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
              <span>Looking for manual file import?</span>
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
                className="text-teal-600 dark:text-teal-400 font-bold hover:underline font-mono"
              >
                {isParsingSync ? 'Parsing...' : 'Advanced: upload sync-output.json manually'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: Subjects Management */}
      {activeSubTab === 'courses' && (
        <div className="space-y-6">
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-heading font-black text-[var(--foreground)]">Manage Registered Subjects</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Configure attendance thresholds and subject identifiers.
                </p>
              </div>
              <motion.button
                whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                onClick={() => {
                  setEditingCourse(null)
                  setIsCourseModalOpen(true)
                }}
                className="pill-btn flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-transform"
              >
                <Plus className="w-4 h-4" /> Add Subject
              </motion.button>
            </div>

            <div className="space-y-2.5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4 transition-transform hover:translate-y-[-1px] shadow-[3px_3px_0px_var(--shadow-color)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-[var(--border)] shrink-0"
                      style={{ backgroundColor: course.color || '#0D9488' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]">
                          {course.code}
                        </span>
                        <span className="font-heading font-bold text-sm text-[var(--foreground)]">
                          {course.name}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono">
                        Required: <strong className="text-[var(--foreground)]">{course.requiredPercent}%</strong>
                        {' • '}
                        {course.stats.present} Present / {course.stats.absent} Absent ({course.stats.percentage}%)
                        {course.syncedAt && (
                          <span className="text-teal-600 dark:text-teal-400 ml-2 font-bold">
                            [Synced: {course.syncedPresent}P/{course.syncedAbsent}A]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingCourse(course)
                        setIsCourseModalOpen(true)
                      }}
                      className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                      title="Edit subject"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete subject ${course.name} and all records?`)) {
                          onDeleteCourse(course.id)
                        }
                      }}
                      className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-[var(--muted)] transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-heading font-black text-[var(--foreground)]">Weekly Timetable Schedule</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Configure the recurring schedule that drives future planning mode.
                </p>
              </div>
              <motion.button
                whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                onClick={() => {
                  setEditingSlot(null)
                  setIsSlotModalOpen(true)
                }}
                className="pill-btn flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-transform"
              >
                <Plus className="w-4 h-4" /> Add Slot
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6, 0].map((weekdayNum) => {
                const daySlots = slots.filter((s) => s.weekday === weekdayNum)
                return (
                  <div
                    key={weekdayNum}
                    className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 space-y-3 shadow-[3px_3px_0px_var(--shadow-color)]"
                  >
                    <div className="flex items-center justify-between border-b-2 border-[var(--border)] pb-2">
                      <span className="font-heading font-black text-sm text-[var(--foreground)]">
                        {WEEKDAYS[weekdayNum]}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)] font-mono font-bold">
                        {daySlots.length} lecture{daySlots.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {daySlots.length === 0 ? (
                      <div className="text-xs text-[var(--muted-foreground)] py-3 text-center font-mono">
                        No lectures scheduled
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {daySlots.map((slot) => {
                          const course = courses.find((c) => c.id === slot.courseId)
                          return (
                            <div
                              key={slot.id}
                              className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs shadow-[2px_2px_0px_var(--shadow-color)]"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 font-bold text-[var(--foreground)] truncate">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: course?.color || '#0D9488',
                                    }}
                                  />
                                  <span className="truncate">{course?.name}</span>
                                </div>
                                <div className="text-[var(--muted-foreground)] text-[11px] flex items-center gap-2 font-mono">
                                  <span>{slot.label}</span>
                                  {slot.room && (
                                    <>
                                      <span>•</span>
                                      <span className="font-bold text-[var(--foreground)]">{slot.room}</span>
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
                                  className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteSlot(slot.id)}
                                  className="p-1 rounded text-[var(--muted-foreground)] hover:text-rose-500 transition-colors"
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
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-6">
            <div>
              <h2 className="text-base font-heading font-black text-[var(--foreground)] flex items-center gap-2">
                <Palmtree className="w-5 h-5 text-amber-500" />
                Declared Holidays & Exam Days
              </h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Mark holidays and exam days so they are automatically excluded from past audits and future planning projections.
              </p>
            </div>

            {/* Add Holiday Form */}
            <form
              onSubmit={handleCreateHoliday}
              className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4.5 space-y-3.5 shadow-[3px_3px_0px_var(--shadow-color)]"
            >
              <div className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5 font-mono">
                <Plus className="w-3.5 h-3.5 text-teal-600" /> Declare Holiday or Exam Date
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1">Date</label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    required
                    className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1">Reason / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Diwali Break, Mid-Term Exam"
                    value={newHolidayLabel}
                    onChange={(e) => setNewHolidayLabel(e.target.value)}
                    required
                    className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1">Type</label>
                  <select
                    value={newHolidayType}
                    onChange={(e) => setNewHolidayType(e.target.value as any)}
                    className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-bold"
                  >
                    <option value="holiday">🌴 Holiday / Recess</option>
                    <option value="exam">📝 Exam Day / Assessment</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <motion.button
                  whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                  type="submit"
                  disabled={isSubmittingHoliday || !newHolidayDate || !newHolidayLabel.trim()}
                  className="pill-btn px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  {isSubmittingHoliday ? 'Saving...' : 'Add Date'}
                </motion.button>
              </div>
            </form>

            {/* List of Declared Holidays */}
            <div className="space-y-3">
              <div className="text-xs font-heading font-black uppercase tracking-wider text-[var(--foreground)] font-mono">
                Registered Holidays & Exams ({holidays.length})
              </div>

              {holidays.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] p-6 bg-[var(--background)] rounded-2xl border-2 border-dashed border-[var(--border)] text-center font-mono">
                  No holidays or exam days registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-3 text-xs shadow-[2px_2px_0px_var(--shadow-color)]"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                              h.type === 'exam'
                                ? 'bg-purple-400 text-slate-900 border-[var(--border)]'
                                : 'bg-amber-400 text-slate-900 border-[var(--border)]'
                            }`}
                          >
                            {h.type === 'exam' ? 'Exam' : 'Holiday'}
                          </span>
                          <span className="font-mono text-[var(--foreground)] font-bold">{h.date}</span>
                        </div>
                        <div className="text-[var(--foreground)] font-heading font-bold truncate">{h.label}</div>
                      </div>

                      {onDeleteHoliday && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove holiday for ${h.date} (${h.label})?`)) {
                              onDeleteHoliday(h.id)
                            }
                          }}
                          className="p-1.5 rounded-full text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-[var(--muted)] transition-colors"
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
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5">
            <div>
              <h2 className="text-base font-heading font-black text-[var(--foreground)] flex items-center gap-2.5">
                <Database className="w-5 h-5 text-teal-600" />
                Data Portability & Backup
              </h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Download your complete attendance archive in CSV or JSON format.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* CSV Export */}
              <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-[3px_3px_0px_var(--shadow-color)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-heading font-bold text-[var(--foreground)] text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    CSV Export
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Export all subjects and verified attendance logs as spreadsheet CSV.
                  </p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="pill-btn w-full py-2.5 bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold flex items-center justify-center gap-2 transition-colors font-mono"
                >
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
              </div>

              {/* JSON Backup */}
              <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-[3px_3px_0px_var(--shadow-color)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-heading font-bold text-[var(--foreground)] text-sm">
                    <Download className="w-4 h-4 text-teal-600" />
                    Full JSON Backup
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Complete schema backup including timetable slots and configurations.
                  </p>
                </div>
                <button
                  onClick={handleExportJSON}
                  className="pill-btn w-full py-2.5 bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold flex items-center justify-center gap-2 transition-colors font-mono"
                >
                  <Download className="w-3.5 h-3.5" /> Download JSON
                </button>
              </div>

              {/* Restore Backup */}
              <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-[3px_3px_0px_var(--shadow-color)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-heading font-bold text-[var(--foreground)] text-sm">
                    <Upload className="w-4 h-4 text-amber-500" />
                    Restore Backup
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
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
                  className="pill-btn w-full py-2.5 bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold flex items-center justify-center gap-2 transition-colors font-mono"
                >
                  <Upload className="w-3.5 h-3.5" /> Restore Backup
                </button>
              </div>
            </div>
          </div>

          {/* DANGER ZONE */}
          <div className="bg-rose-500/10 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-500/20 text-rose-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-heading font-black text-rose-600 dark:text-rose-400">
                  Danger Zone: Database Reset
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
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
                className="pill-btn px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Reset All Data (Empty Database)
              </button>
              <button
                onClick={() => {
                  setIsResetWithSeed(true)
                  setResetConfirmationText('')
                  setIsResetModalOpen(true)
                }}
                className="pill-btn px-5 py-2.5 bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-teal-600" /> Reset & Reload Sample Subjects
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
          <div className="bg-[var(--card)] border-2 border-rose-500 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_var(--shadow-color)] p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-heading font-black text-[var(--foreground)]">
                Confirm Full Database Reset
              </h3>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              This action will permanently delete all registered subjects, weekly schedule slots, and verified attendance logs.
              {isResetWithSeed && ' It will then reload default sample courses.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--foreground)] block font-mono">
                Type <strong className="text-rose-500">RESET</strong> to confirm:
              </label>
              <input
                type="text"
                placeholder="RESET"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl px-3.5 py-2 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:border-rose-500 uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="pill-btn px-4 py-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-bold hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting || resetConfirmationText.trim() !== 'RESET'}
                className="pill-btn px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-2"
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
