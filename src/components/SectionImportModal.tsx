'use client'

import React, { useState, useEffect } from 'react'
import { X, GraduationCap, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SectionSummary {
  code: string
  coordinator: string
  defaultRoom: string
  group: 'physics' | 'chem'
  courseCount: number
}

interface DiffItem {
  officialCode: string
  officialName: string
  short: string
  matchType: 'exact' | 'suggested' | 'none'
  matchedCourseId: string | null
  matchedCourseName: string | null
  confidence: number
}

interface SectionImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => Promise<void>
}

export const SectionImportModal: React.FC<SectionImportModalProps> = ({
  isOpen,
  onClose,
  onImported,
}) => {
  const [sections, setSections] = useState<SectionSummary[]>([])
  const [selected, setSelected] = useState<string>('')
  const [diff, setDiff] = useState<DiffItem[]>([])
  const [step, setStep] = useState<'pick' | 'review'>('pick')
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setStep('pick')
    setSelected('')
    setDiff([])
    setError(null)
    setResult(null)
    fetch('/api/sections')
      .then((r) => r.json())
      .then((data) => setSections(data.sections || []))
      .catch(() => setError('Failed to load section list'))
  }, [isOpen])

  if (!isOpen) return null

  const handlePreview = async (sectionCode: string) => {
    setSelected(sectionCode)
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sections/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load section preview')
      setDiff(data.diff)
      setStep('review')
    } catch (err: any) {
      setError(err?.message || 'Failed to preview section')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    setIsApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/sections/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: selected, apply: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to apply section timetable')
      setResult(data.message)
      await onImported()
    } catch (err: any) {
      setError(err?.message || 'Failed to apply section timetable')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[8px_8px_0px_var(--shadow-color)] overflow-hidden"
      >
        <div className="p-4 sm:p-6 border-b-2 border-[var(--border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-500/15 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] text-indigo-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-heading font-black text-[var(--foreground)] truncate">
                Import Official Timetable
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)] mt-0.5 truncate sm:whitespace-normal">
                Populate your subjects and schedule directly from the official department timetable.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors font-mono shrink-0 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-dot-grid">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {result && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              {result}
            </div>
          )}

          {step === 'pick' && !result && (
            <div className="space-y-3">
              <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                Select your section (C01 – C22)
              </label>
              {sections.length === 0 && (
                <p className="text-xs text-[var(--muted-foreground)] font-mono">Loading sections...</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {sections.map((s) => (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    key={s.code}
                    disabled={isLoading}
                    onClick={() => handlePreview(s.code)}
                    className="p-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-teal-500 text-left transition-all shadow-[2px_2px_0px_var(--shadow-color)] disabled:opacity-50"
                  >
                    <div className="font-mono font-black text-sm text-[var(--foreground)]">{s.code}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)] truncate mt-0.5">{s.coordinator}</div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {step === 'review' && !result && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Reviewing section <span className="font-bold text-teal-600 dark:text-teal-400 font-mono">{selected}</span>. Existing subjects are merged by code/name match; new ones are created. Weekly timetable slots will be updated for these {diff.length} subjects.
              </p>
              {diff.map((item) => (
                <div
                  key={item.officialCode}
                  className="p-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] flex items-center justify-between gap-3 shadow-[2px_2px_0px_var(--shadow-color)]"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-heading font-bold text-[var(--foreground)] truncate">{item.officialName}</div>
                    <div className="text-[10px] font-mono text-[var(--muted-foreground)]">{item.officialCode}</div>
                  </div>
                  {item.matchType === 'exact' && (
                    <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      ✓ Merge (exact)
                    </span>
                  )}
                  {item.matchType === 'suggested' && (
                    <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      ⚡ Merge: {item.matchedCourseName}
                    </span>
                  )}
                  {item.matchType === 'none' && (
                    <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                      ➕ New subject
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-[var(--card)] border-t-2 border-[var(--border)] flex items-center justify-between gap-3">
          {step === 'review' && !result ? (
            <>
              <button
                onClick={() => setStep('pick')}
                className="pill-btn px-4 py-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-bold hover:bg-[var(--muted)] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={isApplying}
                className="pill-btn px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2 transition-transform"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
                {isApplying ? 'Applying...' : `Confirm Import for ${selected}`}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="pill-btn ml-auto px-4 py-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-bold hover:bg-[var(--muted)] transition-colors"
            >
              {result ? 'Done' : 'Cancel'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
