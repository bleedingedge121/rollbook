'use client'

import React, { useState, useEffect } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  GitMerge,
  PlusCircle,
  XCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface DbCourseSummary {
  id: string
  name: string
  code: string
}

export interface SyncDiffItem {
  matchType: 'exact' | 'suggested' | 'none'
  matchedCourseId: string | null
  confidence: number
  syncedName: string
  syncedCode: string
  synced: {
    present: number
    absent: number
    total: number
    pct: number
  }
  current: {
    present: number
    absent: number
    total: number
    pct: number
  }
  hasDiff: boolean
}

export interface CourseMergeDecision {
  incomingCode: string
  incomingName: string
  present: number
  absent: number
  targetCourseId: string | 'NEW' | 'SKIP'
}

interface SyncModalProps {
  isOpen: boolean
  onClose: () => void
  diff: SyncDiffItem[]
  availableDbCourses: DbCourseSummary[]
  syncedAt?: string
  onApplySync: (merges: CourseMergeDecision[]) => Promise<void>
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  diff,
  availableDbCourses,
  syncedAt,
  onApplySync,
}) => {
  const [targetMappings, setTargetMappings] = useState<Record<string, string>>({})

  useEffect(() => {
    const initial: Record<string, string> = {}
    diff.forEach((item) => {
      if (item.matchedCourseId) {
        initial[item.syncedCode] = item.matchedCourseId
      } else {
        initial[item.syncedCode] = 'NEW'
      }
    })
    setTargetMappings(initial)
  }, [diff])

  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleTargetChange = (incomingCode: string, targetId: string) => {
    setTargetMappings((prev) => ({
      ...prev,
      [incomingCode]: targetId,
    }))
  }

  const handleConfirmApply = async () => {
    const merges: CourseMergeDecision[] = diff.map((item) => ({
      incomingCode: item.syncedCode,
      incomingName: item.syncedName,
      present: item.synced.present,
      absent: item.synced.absent,
      targetCourseId: (targetMappings[item.syncedCode] || item.matchedCourseId || 'NEW') as any,
    }))

    const activeMerges = merges.filter((m) => m.targetCourseId !== 'SKIP')
    if (activeMerges.length === 0) {
      setError('All courses are set to Skip. Select at least one course to synchronize.')
      return
    }

    setIsApplying(true)
    setError(null)
    try {
      await onApplySync(merges)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to apply synced attendance data')
    } finally {
      setIsApplying(false)
    }
  }

  const activeCount = diff.filter(
    (item) => (targetMappings[item.syncedCode] || item.matchedCourseId || 'NEW') !== 'SKIP'
  ).length

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[8px_8px_0px_var(--shadow-color)] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b-2 border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/20 text-violet-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-heading font-black text-[var(--foreground)]">
                SLCM Sync & Reconciliation
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono">
                {syncedAt
                  ? `Portal data from ${new Date(syncedAt).toLocaleString()}`
                  : 'Portal Snapshot'}
                {' • '}
                <span className="font-bold text-violet-600 dark:text-violet-400">
                  {diff.length} course(s) in sync file
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors font-mono"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-dot-grid">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-violet-500/10 border-2 border-[var(--border)] rounded-2xl p-4 flex items-start gap-3 shadow-[3px_3px_0px_var(--shadow-color)]">
            <GitMerge className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-[var(--foreground)]">
              <p className="font-heading font-bold text-violet-600 dark:text-violet-400">
                Verified Portal Snapshot
              </p>
              <p className="text-[var(--muted-foreground)] leading-relaxed">
                Synced attendance numbers are saved as a verified baseline count. Review course mappings below to prevent duplicate subject entries.
              </p>
            </div>
          </div>

          {/* Courses diff & merge list */}
          <div className="space-y-3 pt-1">
            {diff.map((item) => {
              const currentTarget = targetMappings[item.syncedCode] || 'NEW'
              const matchedDbCourse = availableDbCourses.find((c) => c.id === currentTarget)

              return (
                <div
                  key={item.syncedCode}
                  className={`p-4 rounded-2xl border-2 transition-all shadow-[3px_3px_0px_var(--shadow-color)] ${
                    currentTarget === 'SKIP'
                      ? 'bg-[var(--background)] border-[var(--border)] opacity-50'
                      : 'bg-[var(--background)] border-[var(--border)]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Incoming Course Info */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-violet-600 dark:text-violet-400">
                          {item.syncedCode}
                        </span>
                        <span className="font-heading font-bold text-sm text-[var(--foreground)] truncate">
                          {item.syncedName}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-3 font-mono">
                        <span>
                          Portal Figures:{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {item.synced.present}P / {item.synced.absent}A ({item.synced.pct}%)
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Merge Target Dropdown Selector */}
                    <div className="shrink-0 w-full sm:w-auto">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">
                        Map / Merge Action
                      </label>
                      <select
                        value={currentTarget}
                        onChange={(e) => handleTargetChange(item.syncedCode, e.target.value)}
                        className="w-full sm:w-64 text-xs font-bold rounded-full px-3.5 py-2 border-2 border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-violet-500 transition-colors shadow-[2px_2px_0px_var(--shadow-color)]"
                      >
                        {item.matchType === 'exact' && item.matchedCourseId && (
                          <option value={item.matchedCourseId}>
                            ✓ Merge into: {item.syncedName} (Exact)
                          </option>
                        )}
                        {item.matchType === 'suggested' && item.matchedCourseId && (
                          <option value={item.matchedCourseId}>
                            ⚡ Merge into: {availableDbCourses.find((c) => c.id === item.matchedCourseId)?.name} (Suggested)
                          </option>
                        )}
                        <option value="NEW">➕ Create as New Subject</option>
                        <option value="SKIP">🚫 Skip (Do not import)</option>
                        {availableDbCourses.length > 0 && (
                          <optgroup label="── Merge with Existing Subject ──">
                            {availableDbCourses.map((dbC) => (
                              <option key={dbC.id} value={dbC.id}>
                                Merge: {dbC.code} — {dbC.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Diff Comparison if merged with DB course */}
                  {matchedDbCourse && currentTarget !== 'NEW' && currentTarget !== 'SKIP' && (
                    <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)] font-mono">
                      <div className="flex items-center gap-2">
                        <span>Current DB:</span>
                        <span className="font-bold text-[var(--foreground)]">
                          {item.current.present}P / {item.current.absent}A ({item.current.pct}%)
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-violet-500" />
                      <div className="flex items-center gap-2">
                        <span>New Baseline:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {item.synced.present}P / {item.synced.absent}A ({item.synced.pct}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--card)] border-t-2 border-[var(--border)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="pill-btn px-4 py-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-bold hover:bg-[var(--muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmApply}
            disabled={isApplying || activeCount === 0}
            className="pill-btn px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2 transition-transform"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
            {isApplying
              ? 'Synchronizing...'
              : `Confirm & Apply ${activeCount} Subject(s)`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
