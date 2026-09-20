'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  Shield,
  Zap,
  Copy,
  Check,
  Sliders,
  HelpCircle,
  Code,
  ExternalLink,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Smartphone,
  Clock,
} from 'lucide-react'
import { CourseWithStats, TimetableSlot, Holiday } from '@/types'
import { WEEKDAYS } from '@/lib/attendance'
import { formatDate, formatDateTime, formatSlotTime, formatTime } from '@/lib/formatters'
import { generateConsoleSnippet } from '@/lib/bookmarklet'
import { CourseModal } from './CourseModal'
import { SlotModal } from './SlotModal'
import { SyncModal, SyncDiffItem, DbCourseSummary, CourseMergeDecision } from './SyncModal'
import { SectionImportModal } from './SectionImportModal'
import { parsePastedTableText, SyncedCourse } from '@/lib/reconcile'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ClassRemindersReturn } from '@/hooks/useClassReminders'

interface SettingsViewProps {
  courses: CourseWithStats[]
  slots: TimetableSlot[]
  holidays?: Holiday[]
  userRole?: string
  reminders?: ClassRemindersReturn
  onSaveCourse: (courseData: any) => Promise<void>
  onDeleteCourse: (courseId: string) => Promise<void>
  onSaveSlot: (slotData: any) => Promise<void>
  onDeleteSlot: (slotId: string) => Promise<void>
  onSaveHoliday?: (holidayData: { date?: string; startDate?: string; endDate?: string; label: string; type?: string }) => Promise<void>
  onDeleteHoliday?: (id: string) => Promise<void>
  onRefreshAll: () => Promise<void>
}

interface HolidayGroup {
  key: string
  label: string
  type: string
  startDate: string
  endDate: string
  count: number
  ids: string[]
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  courses,
  slots,
  holidays = [],
  userRole = 'user',
  reminders,
  onSaveCourse,
  onDeleteCourse,
  onSaveSlot,
  onDeleteSlot,
  onSaveHoliday,
  onDeleteHoliday,
  onRefreshAll,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sync' | 'courses' | 'timetable' | 'holidays' | 'notifications' | 'backup'>('sync')
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

  // SLCM Sync State
  const [activeSyncToken, setActiveSyncToken] = useState<string | null>(null)
  const [copiedCmd, setCopiedCmd] = useState(false)
  const [copiedConsoleSnippet, setCopiedConsoleSnippet] = useState(false)
  const [isSyncInstructionsOpen, setIsSyncInstructionsOpen] = useState(false)
  const [pasteFallbackText, setPasteFallbackText] = useState('')
  const [isSubmittingPaste, setIsSubmittingPaste] = useState(false)
  const [pasteFallbackResult, setPasteFallbackResult] = useState<string | null>(null)

  const handlePasteFallbackSubmit = async () => {
    setIsSubmittingPaste(true)
    setPasteFallbackResult(null)
    const trimmed = pasteFallbackText.trim()
    if (trimmed.startsWith('rb_sync_')) {
      setPasteFallbackResult('⚠️ That looks like your Personal Sync Token, not attendance data! To sync directly from your browser, use the "Copy Console Script (Laptop)" button above and paste into your browser F12 Console on SLCM.')
      setIsSubmittingPaste(false)
      return
    }
    try {
      let courses: SyncedCourse[] = []

      // 1. Try parsing JSON
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed)
          courses = Array.isArray(parsed) ? parsed : parsed.courses || parsed.data || parsed.records || []
        } catch {
          // fallback to text parser
        }
      }

      // 2. If not JSON or empty, try parsing as raw copied table rows
      if (!courses || courses.length === 0) {
        courses = parsePastedTableText(trimmed)
      }

      if (!courses || courses.length === 0) {
        throw new Error('Could not find course attendance figures. Please paste valid JSON or copy rows directly from your SLCM attendance table.')
      }

      const res = await fetch('/api/sync/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses, syncedAt: new Date().toISOString() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to apply pasted data')
      setPasteFallbackResult(`✅ ${data.message}`)
      setPasteFallbackText('')
      await onRefreshAll()
    } catch (err: any) {
      setPasteFallbackResult(`❌ ${err?.message || 'Could not parse or apply that data. Make sure it is valid JSON or copied table text.'}`)
    } finally {
      setIsSubmittingPaste(false)
    }
  }

  // Add Holiday Form State (Single vs Range)
  const [holidayMode, setHolidayMode] = useState<'single' | 'range'>('single')
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayStartDate, setNewHolidayStartDate] = useState('')
  const [newHolidayEndDate, setNewHolidayEndDate] = useState('')
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('rb_sync_token')
      if (savedToken) {
        setActiveSyncToken(savedToken)
      }
    }
  }, [])

  const latestSyncedAt = useMemo(() => {
    const dates = courses
      .map((c) => c.syncedAt)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
    if (dates.length === 0) return null
    return new Date(Math.max(...dates))
  }, [courses])

  // Group consecutive holidays with identical label/type into date ranges
  const groupedHolidays = useMemo<HolidayGroup[]>(() => {
    if (!holidays || holidays.length === 0) return []
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date))
    const groups: HolidayGroup[] = []

    for (const h of sorted) {
      const last = groups[groups.length - 1]
      if (last && last.label === h.label && last.type === h.type) {
        // Check if consecutive day
        const prevEnd = new Date(last.endDate)
        const current = new Date(h.date)
        const diffDays = Math.round((current.getTime() - prevEnd.getTime()) / (1000 * 3600 * 24))
        if (diffDays === 1) {
          last.endDate = h.date
          last.count += 1
          last.ids.push(h.id)
          continue
        }
      }

      groups.push({
        key: `${h.id}_${h.date}`,
        label: h.label,
        type: h.type,
        startDate: h.date,
        endDate: h.date,
        count: 1,
        ids: [h.id],
      })
    }

    return groups
  }, [holidays])

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

  // Automatically ensure token and copy console script for laptop
  const copyConsoleScript = async () => {
    if (typeof window === 'undefined') return
    let token = activeSyncToken
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('rb_sync_token')
    }
    if (!token) {
      try {
        const res = await fetch('/api/auth/sync-token', { method: 'POST' })
        const data = await res.json()
        if (data?.syncToken && typeof data.syncToken === 'string') {
          const newToken = data.syncToken
          token = newToken
          setActiveSyncToken(newToken)
          localStorage.setItem('rb_sync_token', newToken)
        }
      } catch (err) {
        console.error('Failed to retrieve sync token:', err)
      }
    }
    const finalToken = token || 'rb_sync_default'
    const snippet = generateConsoleSnippet(window.location.origin, finalToken)
    await navigator.clipboard.writeText(snippet)
    setCopiedConsoleSnippet(true)
    setTimeout(() => setCopiedConsoleSnippet(false), 2500)
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

  // Handle Create Holiday / Holiday Range
  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHolidayLabel.trim() || !onSaveHoliday) return

    setIsSubmittingHoliday(true)
    try {
      if (holidayMode === 'range') {
        if (!newHolidayStartDate || !newHolidayEndDate) return
        await onSaveHoliday({
          startDate: newHolidayStartDate,
          endDate: newHolidayEndDate,
          label: newHolidayLabel.trim(),
          type: newHolidayType,
        })
        setNewHolidayStartDate('')
        setNewHolidayEndDate('')
      } else {
        if (!newHolidayDate) return
        await onSaveHoliday({
          date: newHolidayDate,
          label: newHolidayLabel.trim(),
          type: newHolidayType,
        })
        setNewHolidayDate('')
      }
      setNewHolidayLabel('')
      await onRefreshAll()
    } finally {
      setIsSubmittingHoliday(false)
    }
  }

  // Handle Delete Grouped Holiday Range
  const handleDeleteHolidayGroup = async (group: HolidayGroup) => {
    const desc =
      group.count > 1
        ? `${group.label} (${formatDate(group.startDate)} to ${formatDate(group.endDate)}, ${group.count} days)`
        : `${group.label} (${formatDate(group.startDate)})`

    if (!confirm(`Remove ${desc}?`)) return

    try {
      const res = await fetch(`/api/holidays?ids=${group.ids.join(',')}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete holidays')
      }
      await onRefreshAll()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
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
      <div className="flex items-center p-1 rounded-2xl sm:rounded-full bg-[var(--card)] border-2 border-[var(--border)] shadow-[4px_4px_0px_var(--shadow-color)] overflow-x-auto gap-1 no-scrollbar">
        <button
          onClick={() => setActiveSubTab('sync')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
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
          <span className="relative z-10">Sync & Import</span>
        </button>

        <button
          onClick={() => setActiveSubTab('courses')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
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
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
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
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
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
          onClick={() => setActiveSubTab('notifications')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'notifications' ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {activeSubTab === 'notifications' && (
            <motion.div
              layoutId="activeSettingsSubTab"
              className="absolute inset-0 rounded-full bg-teal-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <Bell className="w-3.5 h-3.5 relative z-10" />
          <span className="relative z-10">Reminders ({reminders?.settings.leadMinutes || 15}m)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('backup')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
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

      {/* SUB TAB 1: Sync & Import */}
      {activeSubTab === 'sync' && (
        <div className="space-y-6">
          {/* 1. Official Department Timetable Import */}
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] text-indigo-600 flex items-center justify-center shrink-0">
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
                className="pill-btn flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-transform shrink-0 font-mono w-full sm:w-auto"
              >
                <GraduationCap className="w-4 h-4" />
                Select My Section
              </motion.button>
            </div>
          </div>

          {/* 2. Live SLCM Attendance Push Hub */}
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5 sm:space-y-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 border-b-2 border-[var(--border)] pb-4">
              <div>
                <h2 className="text-base font-heading font-black text-[var(--foreground)] flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Live SLCM Attendance Sync</span>
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Run the scraper on your computer to log in with Microsoft MFA and securely push live attendance directly to your account.
                </p>
              </div>

              {latestSyncedAt ? (
                <div className="px-3 py-1.5 rounded-full bg-emerald-400/20 border-2 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0px_var(--shadow-color)] self-start sm:self-auto">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Synced {formatDateTime(latestSyncedAt)}</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-full bg-amber-400/20 border-2 border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0px_var(--shadow-color)] self-start sm:self-auto">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>No SLCM sync recorded yet</span>
                </div>
              )}
            </div>

            {syncError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}

            {/* Step 1: Direct Browser Sync (Laptop & Desktop) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-mono text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <span className="font-heading font-black text-sm text-[var(--foreground)]">
                    Browser Sync (Laptop & Desktop)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSyncInstructionsOpen(true)}
                  className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1 shrink-0"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>How to Sync</span>
                </button>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--background)] border-2 border-indigo-500/30 shadow-[3px_3px_0px_var(--shadow-color)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-xs text-[var(--foreground)]">
                      Instant 5-Second Console Script
                    </h3>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                      Extracts verified attendance directly from your logged-in SLCM tab.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={copyConsoleScript}
                      className="pill-btn px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_var(--shadow-color)] transition-transform active:scale-95"
                    >
                      {copiedConsoleSnippet ? <Check className="w-3.5 h-3.5 text-white" /> : <Code className="w-3.5 h-3.5" />}
                      <span>{copiedConsoleSnippet ? 'Script Copied to Clipboard!' : '💻 Copy Console Script (Laptop)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSyncInstructionsOpen(true)}
                      className="pill-btn px-3 py-2 bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold border-2 border-[var(--border)] flex items-center gap-1.5 shadow-[2px_2px_0px_var(--shadow-color)] transition-transform active:scale-95"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Instructions</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed pt-1 border-t border-[var(--border)]">
                  💡 Click <strong>Copy Console Script</strong>, go to your SLCM Attendance tab, open Console (<kbd className="px-1.5 py-0.5 bg-[var(--card)] border border-[var(--border)] rounded font-mono text-[10px]">F12</kbd>), paste and hit Enter. Click <strong>Copy JSON</strong> on the banner, then paste below.
                </p>
              </div>

              {/* Step 1 Paste Area: Apply data from SLCM Banner or Mobile Copy */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--background)] border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <span>📋 Paste Attendance Data (JSON or Copied Table Text)</span>
                  </span>
                  {pasteFallbackText && (
                    <button
                      type="button"
                      onClick={() => {
                        setPasteFallbackText('')
                        setPasteFallbackResult(null)
                      }}
                      className="text-[10px] text-[var(--muted-foreground)] hover:text-rose-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                  Paste the JSON from the browser script, or paste text copied directly from your SLCM attendance table on phone or laptop:
                </p>
                <textarea
                  value={pasteFallbackText}
                  onChange={(e) => setPasteFallbackText(e.target.value)}
                  placeholder="Paste JSON or raw attendance table rows here..."
                  className="w-full h-24 bg-[var(--card)] border-2 border-[var(--border)] rounded-xl p-3 text-[11px] font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-[2px_2px_0px_var(--shadow-color)]"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePasteFallbackSubmit}
                    disabled={isSubmittingPaste || !pasteFallbackText.trim()}
                    className="pill-btn px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_var(--shadow-color)] transition-transform active:scale-95"
                  >
                    {isSubmittingPaste ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{isSubmittingPaste ? 'Applying...' : 'Apply Attendance Data'}</span>
                  </button>
                  {pasteFallbackResult && (
                    <p className={`text-xs font-bold ${pasteFallbackResult.startsWith('✅') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                      {pasteFallbackResult}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Run Scraper on Desktop (Alternative) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-mono text-xs font-black flex items-center justify-center">
                  2
                </span>
                <span className="font-heading font-black text-sm text-[var(--foreground)]">
                  Alternative: Automated Desktop Scraper (Node.js)
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 bg-[var(--background)] p-3 rounded-xl font-mono text-xs font-bold text-[var(--foreground)] border-2 border-[var(--border)] select-all truncate"
                    title="cd scraper && npm install && node agent.js"
                  >
                    cd scraper && npm install && node agent.js
                  </div>
                  <button
                    onClick={copyAgentCommand}
                    className="pill-btn px-4 py-3 bg-[var(--card)] hover:bg-[var(--muted)] text-xs font-bold flex items-center gap-1.5 border-2 border-[var(--border)] shrink-0 transition-colors"
                  >
                    {copiedCmd ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copiedCmd ? 'Copied' : 'Copy Command'}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed space-y-1 font-mono">
                  <p>
                    • On first run, it asks for your Roll Book URL (<strong className="text-[var(--foreground)]">{typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'}</strong>) and your Personal Sync Token.
                  </p>
                  <p>
                    • It saves them once in <code className="text-teal-600 dark:text-teal-400 font-bold">scraper/.env</code>.
                  </p>
                  <p>
                    • Run <code className="text-teal-600 dark:text-teal-400 font-bold">node agent.js</code> anytime you want fresh attendance numbers. Refresh this page to see the latest figures!
                  </p>
                </div>
              </div>
            </div>

            {/* Advanced Fallback: Manual File Upload */}
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
              <span>Prefer manual file import?</span>
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
                {isParsingSync ? 'Parsing...' : 'Upload sync-output.json manually'}
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
                        {course.trackingMode === 'simple' && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                            Simple Mode
                          </span>
                        )}
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
                                  <span>{formatSlotTime(slot.label)}</span>
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

            {/* Admin vs Non-Admin Notice & Form */}
            {userRole !== 'admin' ? (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/30 text-xs shadow-[2px_2px_0px_var(--shadow-color)]">
                <Shield className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-heading font-black text-[var(--foreground)]">College-Wide Academic Calendar</div>
                  <p className="text-[var(--muted-foreground)] leading-relaxed">
                    Holidays, recesses, and term exam windows are institution-wide and shared across all college departments and sections. Calendar events are maintained centrally by administrators. Below is your official academic schedule.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/30 text-xs shadow-[2px_2px_0px_var(--shadow-color)]">
                  <div className="flex items-center gap-2 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    <span>Admin Mode: Changes made here apply globally across all college departments and sections.</span>
                  </div>
                  <a
                    href="/admin"
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-[11px] transition-colors self-start sm:self-auto flex-shrink-0"
                  >
                    Open Admin Console →
                  </a>
                </div>

                {/* Add Holiday Form with Range Toggle */}
                <form
                  onSubmit={handleCreateHoliday}
                  className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4.5 space-y-4 shadow-[3px_3px_0px_var(--shadow-color)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5 font-mono">
                      <Plus className="w-3.5 h-3.5 text-teal-600" /> Declare Holiday or Exam Date
                    </div>

                    {/* Single Day vs Date Range Toggle */}
                    <div className="flex items-center p-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setHolidayMode('single')}
                        className={`px-3 py-1 rounded-full transition-colors ${
                          holidayMode === 'single'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        Single Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setHolidayMode('range')}
                        className={`px-3 py-1 rounded-full transition-colors ${
                          holidayMode === 'range'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        Date Range
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {holidayMode === 'single' ? (
                      <div>
                        <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Date</label>
                        <input
                          type="date"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          required
                          className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>
                    ) : (
                      <div className="sm:col-span-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Start Date</label>
                          <input
                            type="date"
                            value={newHolidayStartDate}
                            onChange={(e) => setNewHolidayStartDate(e.target.value)}
                            required
                            className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-2.5 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">End Date</label>
                          <input
                            type="date"
                            value={newHolidayEndDate}
                            onChange={(e) => setNewHolidayEndDate(e.target.value)}
                            required
                            className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-2.5 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Reason / Label</label>
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
                      <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Event Classification</label>
                      <select
                        value={newHolidayType}
                        onChange={(e) => setNewHolidayType(e.target.value as any)}
                        className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-teal-500 font-bold"
                      >
                        <option value="holiday">🌴 College Holiday / Recess (Public Holiday, Festival Break, Off Day)</option>
                        <option value="exam">📝 Term Exams / University Assessments (Mid-Terms, End-Terms, Lab Assessment Week)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <motion.button
                      whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                      type="submit"
                      disabled={
                        isSubmittingHoliday ||
                        !newHolidayLabel.trim() ||
                        (holidayMode === 'single' ? !newHolidayDate : !newHolidayStartDate || !newHolidayEndDate)
                      }
                      className="pill-btn px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                    >
                      {isSubmittingHoliday
                        ? 'Saving...'
                        : holidayMode === 'range'
                        ? 'Add Holiday Range'
                        : 'Add Date'}
                    </motion.button>
                  </div>
                </form>
              </div>
            )}

            {/* List of Declared Holidays (Grouped Range View) */}
            <div className="space-y-3">
              <div className="text-xs font-heading font-black uppercase tracking-wider text-[var(--foreground)] font-mono flex items-center justify-between">
                <span>Registered Calendar Events ({groupedHolidays.length} entries, {holidays.length} days total)</span>
              </div>

              {groupedHolidays.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] p-6 bg-[var(--background)] rounded-2xl border-2 border-dashed border-[var(--border)] text-center font-mono">
                  No holidays or exam days registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupedHolidays.map((group) => (
                    <div
                      key={group.key}
                      className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-3 text-xs shadow-[2px_2px_0px_var(--shadow-color)]"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                              group.type === 'exam'
                                ? 'bg-purple-400 text-slate-900 border-[var(--border)]'
                                : 'bg-amber-400 text-slate-900 border-[var(--border)]'
                            }`}
                          >
                            {group.type === 'exam' ? 'Exam' : 'Holiday'}
                          </span>
                          <span className="font-mono text-[var(--foreground)] font-bold">
                            {group.count > 1
                              ? `${formatDate(group.startDate)} → ${formatDate(group.endDate)}`
                              : formatDate(group.startDate)}
                          </span>
                          {group.count > 1 && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]">
                              {group.count} days
                            </span>
                          )}
                        </div>
                        <div className="text-[var(--foreground)] font-heading font-bold truncate">
                          {group.label}
                        </div>
                      </div>

                      {userRole === 'admin' && (
                        <button
                          onClick={() => handleDeleteHolidayGroup(group)}
                          className="p-1.5 rounded-full text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-[var(--muted)] transition-colors"
                          title={`Delete ${group.label}`}
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

      {/* SUB TAB 5: Notifications & Class Reminders */}
      {activeSubTab === 'notifications' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <BellRing className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-heading font-black text-[var(--foreground)] flex items-center gap-2">
                    Class Reminder Alarms
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-300 font-bold border border-teal-500/30">
                      PC • Android • iOS
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Receive automated notification alerts and chimes before scheduled lectures and labs.
                  </p>
                </div>
              </div>

              {/* Status Badge & Enable Action */}
              <div className="flex items-center gap-2 shrink-0">
                {reminders?.permission === 'granted' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border-2 border-emerald-500/40">
                    <CheckCircle2 className="w-4 h-4" /> Active &amp; Scheduled
                  </span>
                ) : reminders?.permission === 'denied' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold border-2 border-rose-500/40">
                    <AlertCircle className="w-4 h-4" /> Notifications Blocked
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => reminders?.requestPermission()}
                    className="pill-btn px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Enable Notifications</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notification Parameters & Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[var(--border)]">
              {/* Control 1: Master Enable Toggle */}
              <div className="p-4 rounded-2xl bg-[var(--background)] border-2 border-[var(--border)] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-heading text-[var(--foreground)]">Class Reminders</span>
                    <button
                      type="button"
                      onClick={() =>
                        reminders?.updateSettings({ enabled: !reminders.settings.enabled })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        reminders?.settings.enabled ? 'bg-teal-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          reminders?.settings.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Trigger system banners and alerts before each class.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-[var(--muted-foreground)]">
                  Status: {reminders?.settings.enabled ? 'Enabled' : 'Paused'}
                </div>
              </div>

              {/* Control 2: Lead Time Selector */}
              <div className="p-4 rounded-2xl bg-[var(--background)] border-2 border-[var(--border)] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-black font-heading text-[var(--foreground)]">Alert Lead Time</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    How many minutes before class should the alert fire:
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => reminders?.updateSettings({ leadMinutes: mins })}
                      className={`py-1 rounded-xl text-xs font-bold transition-all border ${
                        reminders?.settings.leadMinutes === mins
                          ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                          : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--muted)]'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Control 3: Sound & Test Notification */}
              <div className="p-4 rounded-2xl bg-[var(--background)] border-2 border-[var(--border)] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {reminders?.settings.sound ? (
                        <Volume2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                      )}
                      <span className="text-xs font-black font-heading text-[var(--foreground)]">Audio Chime</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        reminders?.updateSettings({ sound: !reminders.settings.sound })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        reminders?.settings.sound ? 'bg-teal-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          reminders?.settings.sound ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Play a gentle 2-tone chime when the notification fires.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => reminders?.sendTestNotification()}
                  className="pill-btn w-full py-1.5 bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] border-2 border-[var(--border)] text-xs font-bold transition-transform active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Bell className="w-3.5 h-3.5 text-teal-600" />
                  <span>Send Test Notification</span>
                </button>
              </div>
            </div>

            {/* Next Reminder Status Banner */}
            {reminders?.nextReminder ? (
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border-2 border-teal-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--foreground)]">
                      Next Class Today: {reminders.nextReminder.courseName}
                      {reminders.nextReminder.courseCode && ` (${reminders.nextReminder.courseCode})`}
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      Scheduled at {formatTime(reminders.nextReminder.classTime)}
                      {reminders.nextReminder.room ? ` in ${reminders.nextReminder.room}` : ''} • Alert fires at{' '}
                      {formatTime(reminders.nextReminder.reminderTime)}
                    </div>
                  </div>
                </div>
                <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-teal-600 text-white text-[10px] font-bold font-mono">
                  In Queue
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                <span>🗓️</span>
                <span>No pending class reminders remaining for today. You&apos;re all set!</span>
              </div>
            )}
          </div>

          {/* 1-Click Phone Calendar Sync (.ics with -PT15M alarms) */}
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] text-indigo-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-heading font-black text-[var(--foreground)] flex items-center gap-2">
                    1-Click Native Phone Calendar Sync
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-500/30">
                      Apple • Google • Outlook
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Sync your timetable directly into your iPhone or Android calendar with built-in 15-minute alarms.
                  </p>
                </div>
              </div>

              <a
                href="/api/calendar/export"
                download="rollbook-classes.ics"
                className="pill-btn px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Add to Phone Calendar (.ics)</span>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
              <div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-1">
                <div className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <span>🍎</span> Apple Calendar &amp; Watch (iPhone / Mac)
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                  Tap the download button above. iOS will open Calendar and prompt &ldquo;Add All Events&rdquo;. Alarms ring 15 minutes before class with lock screen banners and Apple Watch taps, even in Low Power Mode!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-1">
                <div className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <span>📱</span> Google Calendar &amp; Android
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                  Open Google Calendar on web or mobile, select <em>Settings &rarr; Import &amp; Export</em>, and upload the downloaded <code className="font-mono text-teal-600 font-bold">.ics</code> file. All classes and 15-minute reminders sync instantly.
                </p>
              </div>
            </div>
          </div>

          {/* iOS Setup Guide */}
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] text-amber-600 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-heading font-black text-[var(--foreground)]">
                  Tips for Lock Screen Notifications on iPhone &amp; iPad
                </h4>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Apple requires progressive web apps to be saved to your Home Screen for Web Push notifications.
                </p>
              </div>
            </div>

            <ol className="text-xs text-[var(--foreground)] space-y-2 list-decimal list-inside leading-relaxed bg-[var(--background)] p-4 rounded-2xl border border-[var(--border)]">
              <li>In Safari on your iPhone/iPad, tap the <strong>Share</strong> button (the square with an arrow pointing up ⬆️ in the browser bar).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong> (➕ icon).</li>
              <li>Launch <strong>Roll Book</strong> from your Home Screen like a native app.</li>
              <li>Come back to this Reminders tab and tap <strong>Enable Notifications</strong> to receive lock screen banners!</li>
              <li><em>Alternative:</em> You can also use the <strong>1-Click Phone Calendar Sync</strong> above to get native Apple Calendar alarms without needing Home Screen installation.</li>
            </ol>
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

      {/* Attendance Sync Instructions Modal */}
      {isSyncInstructionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl w-full max-w-lg shadow-[8px_8px_0px_var(--shadow-color)] p-6 space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border-2 border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-heading font-black text-[var(--foreground)]">
                    How to Sync SLCM Attendance
                  </h3>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Fast, reliable sync options for laptop and mobile
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncInstructionsOpen(false)}
                className="w-8 h-8 rounded-full border border-[var(--border)] hover:bg-[var(--muted)] flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Method 1: AI Chat Advisor (Screenshot & Table Paste) */}
            <div className="p-4 rounded-2xl bg-[var(--background)] border-2 border-teal-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase">
                    Option 1: AI Chat Advisor
                  </span>
                  <span className="text-xs font-bold text-teal-600 dark:text-teal-400">Fastest (Mobile &amp; Laptop)</span>
                </div>
              </div>
              <ol className="text-[11px] text-[var(--foreground)] space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Take a screenshot of your SLCM attendance table on your phone or laptop (or copy the table text).</li>
                <li>Tap the <strong>AI Attendance Advisor</strong> floating bubble in the bottom-right corner.</li>
                <li>Tap the <strong>camera/image icon</strong> to attach the screenshot (or press <kbd className="px-1.5 py-0.5 bg-[var(--card)] border border-[var(--border)] rounded font-mono text-[10px]">Ctrl+V</kbd> to paste it).</li>
                <li>Hit <strong>Send</strong>. Gemini automatically reads the courses, updates your database, and refreshes your dashboard live!</li>
              </ol>
            </div>

            {/* Method 2: Laptop Browser Console */}
            <div className="p-4 rounded-2xl bg-[var(--background)] border-2 border-indigo-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase">
                    Option 2: Laptop Browser
                  </span>
                  <span className="text-xs font-bold text-[var(--foreground)]">5 Seconds</span>
                </div>
                <button
                  type="button"
                  onClick={copyConsoleScript}
                  className="pill-btn px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                >
                  {copiedConsoleSnippet ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedConsoleSnippet ? 'Copied' : 'Copy Script'}</span>
                </button>
              </div>
              <ol className="text-[11px] text-[var(--foreground)] space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Log in to SLCM and open the <strong>Attendance</strong> page.</li>
                <li>Press <kbd className="px-1.5 py-0.5 bg-[var(--card)] border border-[var(--border)] rounded font-mono text-[10px]">F12</kbd> (or right click &rarr; <em>Inspect</em>) and click the <strong>Console</strong> tab.</li>
                <li><span className="text-amber-600 dark:text-amber-400 font-medium">If Chrome shows a warning about pasting, type <code className="font-bold">allow pasting</code> into the console and press Enter.</span></li>
                <li>Paste the script (<kbd className="px-1.5 py-0.5 bg-[var(--card)] border border-[var(--border)] rounded font-mono text-[10px]">Ctrl+V</kbd>) and press <kbd className="px-1.5 py-0.5 bg-[var(--card)] border border-[var(--border)] rounded font-mono text-[10px]">Enter</kbd>.</li>
                <li>If you were already on Attendance, click another tab (like <strong>Home</strong>) and click back to <strong>Attendance</strong> so the network request fires.</li>
                <li>Click <strong>Copy JSON</strong> on the captured banner and paste it into the box in Roll Book!</li>
              </ol>
            </div>

            {/* Method 3: Mobile Instant Table Copy */}
            <div className="p-4 rounded-2xl bg-[var(--background)] border-2 border-emerald-500/30 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase">
                  Option 3: Mobile Phone
                </span>
                <span className="text-xs font-bold text-[var(--foreground)]">Direct Table Copy</span>
              </div>
              <ol className="text-[11px] text-[var(--foreground)] space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Open SLCM on your phone&apos;s browser (Safari or Chrome) and view your Attendance table.</li>
                <li>Tap and drag to copy the attendance text rows (subject names, codes, attended, total).</li>
                <li>Switch to Roll Book and paste the copied text into the <strong>Paste Attendance Data</strong> box below.</li>
                <li>Click <strong>Apply Attendance Data</strong>. The smart parser extracts all subjects, attended, and absent counts automatically!</li>
              </ol>
            </div>

            {/* Method 4: Section Template & Cloud Sync */}
            <div className="p-4 rounded-2xl bg-[var(--background)] border-2 border-[var(--border)] space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase">
                  Option 4: Section Template
                </span>
                <span className="text-xs font-bold text-[var(--foreground)]">1-Click Instant Setup</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                Click <strong>Select My Section</strong> at the top to instantly load your official department subjects and weekly timetable slots (C01 – C22).
              </p>
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                  ☁️ <strong>Cloud Sync:</strong> Whenever you update your courses or attendance on laptop or mobile, your records are saved to your cloud account. Any device you use will always stay in sync.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsSyncInstructionsOpen(false)}
                className="pill-btn px-5 py-2 bg-[var(--card)] text-[var(--foreground)] text-xs font-bold border-2 border-[var(--border)] hover:bg-[var(--muted)] shadow-[2px_2px_0px_var(--shadow-color)]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
