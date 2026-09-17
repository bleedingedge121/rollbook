'use client'

import React, { useState } from 'react'
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
  // Map incoming code to targetCourseId (or 'NEW' / 'SKIP')
  const [targetMappings, setTargetMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    diff.forEach((item) => {
      if (item.matchedCourseId) {
        initial[item.syncedCode] = item.matchedCourseId
      } else {
        initial[item.syncedCode] = 'NEW'
      }
    })
    return initial
  })

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
      targetCourseId: (targetMappings[item.syncedCode] || 'NEW') as any,
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

  const activeCount = Object.values(targetMappings).filter((t) => t !== 'SKIP').length

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                SLCM Sync & Subject Reconciliation
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {syncedAt
                  ? `Portal data from ${new Date(syncedAt).toLocaleString()}`
                  : 'Portal Snapshot'}
                {' • '}
                <span className="text-blue-400 font-semibold">
                  {diff.length} course(s) detected in sync file
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3">
            <GitMerge className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-slate-300">
              <p className="font-bold text-blue-400">
                Honest Sync: Zero Fabricated Calendar Dates
              </p>
              <p>
                Synced attendance numbers are saved as an authoritative verified snapshot.
                Review the course mappings below to prevent duplicate subject cards.
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
                  className={`p-4 rounded-2xl border transition-all ${
                    currentTarget === 'SKIP'
                      ? 'bg-slate-900/30 border-slate-850 opacity-50'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Incoming Course Info */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {item.syncedCode}
                        </span>
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {item.syncedName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>
                          Portal Attendance:{' '}
                          <strong className="text-emerald-400">
                            {item.synced.present}P / {item.synced.absent}A ({item.synced.pct}%)
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Merge Target Dropdown Selector */}
                    <div className="shrink-0 w-full sm:w-auto">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Map / Merge Action
                      </label>
                      <select
                        value={currentTarget}
                        onChange={(e) => handleTargetChange(item.syncedCode, e.target.value)}
                        className={`w-full sm:w-64 text-xs font-semibold rounded-xl px-3 py-2 border focus:outline-none focus:border-blue-500 transition-colors ${
                          currentTarget === 'NEW'
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                            : currentTarget === 'SKIP'
                            ? 'bg-slate-900 border-slate-750 text-slate-500'
                            : 'bg-blue-950/30 border-blue-500/40 text-blue-300'
                        }`}
                      >
                        {item.matchType === 'exact' && item.matchedCourseId && (
                          <option value={item.matchedCourseId}>
                            ✓ Merge into: {item.syncedName} (Exact Match)
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
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">Current DB:</span>
                        <span className="font-medium text-slate-300">
                          {item.current.present}P / {item.current.absent}A ({item.current.pct}%)
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">New Baseline:</span>
                        <span className="font-bold text-emerald-400">
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
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmApply}
            disabled={isApplying || activeCount === 0}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
            {isApplying
              ? 'Synchronizing...'
              : `Confirm & Apply ${activeCount} Subject(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
