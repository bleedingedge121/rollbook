'use client'

import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'

export interface SyncDiffItem {
  status: 'match' | 'new'
  courseId: string | null
  name: string
  code: string
  syncedName: string
  syncedCode: string
  current: {
    present: number
    absent: number
    total: number
    pct: number
  }
  synced: {
    present: number
    absent: number
    total: number
    pct: number
  }
  hasDiff: boolean
}

interface SyncModalProps {
  isOpen: boolean
  onClose: () => void
  diff: SyncDiffItem[]
  syncedAt?: string
  onApplySync: (selectedCodes: string[]) => Promise<void>
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  diff,
  syncedAt,
  onApplySync,
}) => {
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() =>
    diff.map((d) => d.syncedCode || d.code)
  )
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleToggleCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleToggleAll = () => {
    if (selectedCodes.length === diff.length) {
      setSelectedCodes([])
    } else {
      setSelectedCodes(diff.map((d) => d.syncedCode || d.code))
    }
  }

  const handleConfirmApply = async () => {
    if (selectedCodes.length === 0) {
      setError('Please select at least one course to synchronize.')
      return
    }

    setIsApplying(true)
    setError(null)
    try {
      await onApplySync(selectedCodes)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to apply synced attendance data')
    } finally {
      setIsApplying(false)
    }
  }

  const diffCount = diff.filter((d) => d.hasDiff).length

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                SLCM Sync Reconciliation Diff
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {syncedAt
                  ? `Synced at ${new Date(syncedAt).toLocaleString()}`
                  : 'Fresh portal sync'}
                {' • '}
                <span className="text-blue-400 font-semibold">
                  {diffCount} course(s) have updated numbers
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

        {/* Diff Table / List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Warning Banner */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-slate-300">
              <p className="font-bold text-amber-400">
                Confirmation required before applying sync
              </p>
              <p>
                Applying this sync will adjust the confirmed attendance counts for the
                selected courses to match your official SLCM portal figures.
              </p>
            </div>
          </div>

          {/* Select all toggle */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
            <button
              onClick={handleToggleAll}
              className="font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              {selectedCodes.length === diff.length ? 'Deselect All' : 'Select All Courses'}
            </button>
            <span>
              {selectedCodes.length} of {diff.length} courses selected
            </span>
          </div>

          {/* Courses diff list */}
          <div className="space-y-2.5">
            {diff.map((item) => {
              const code = item.syncedCode || item.code
              const isSelected = selectedCodes.includes(code)

              return (
                <div
                  key={code}
                  onClick={() => handleToggleCode(code)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-slate-900/90 border-blue-500/40 ring-1 ring-blue-500/20'
                      : 'bg-slate-900/40 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by row click
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {code}
                        </span>
                        <span className="font-bold text-sm text-slate-100">
                          {item.syncedName || item.name}
                        </span>
                      </div>
                      {item.status === 'new' && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          New Course Found
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Numbers comparison */}
                  <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-center">
                    {/* Current */}
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">
                        Roll Book DB
                      </div>
                      <div className="font-medium text-slate-300">
                        {item.current.present}P / {item.current.absent}A ({item.current.pct}%)
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-600" />

                    {/* Incoming */}
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-blue-400">
                        Portal Sync
                      </div>
                      <div className="font-bold text-emerald-400">
                        {item.synced.present}P / {item.synced.absent}A ({item.synced.pct}%)
                      </div>
                    </div>
                  </div>
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
            disabled={isApplying || selectedCodes.length === 0}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
            {isApplying
              ? 'Synchronizing...'
              : `Confirm & Apply ${selectedCodes.length} Course(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
