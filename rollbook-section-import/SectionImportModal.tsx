'use client'

import React, { useState, useEffect } from 'react'
import { X, GraduationCap, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'

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

  // Load available sections whenever the modal opens (not just on first mount)
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Import Official Timetable</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seeds your subjects and weekly schedule from the department timetable — no manual entry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {result && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              {result}
            </div>
          )}

          {step === 'pick' && !result && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Select your section
              </label>
              {sections.length === 0 && (
                <p className="text-xs text-slate-500">Loading sections...</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sections.map((s) => (
                  <button
                    key={s.code}
                    disabled={isLoading}
                    onClick={() => handlePreview(s.code)}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/50 hover:bg-slate-900 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="font-bold text-sm text-slate-100">{s.code}</div>
                    <div className="text-[10px] text-slate-500 truncate">{s.coordinator}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'review' && !result && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Reviewing <span className="font-bold text-blue-400">{selected}</span>. Existing subjects will be
                merged by code/name match; anything unmatched is created new. This will replace the weekly
                timetable slots for these {diff.length} subjects only — nothing else is touched.
              </p>
              {diff.map((item) => (
                <div
                  key={item.officialCode}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">{item.officialName}</div>
                    <div className="text-[10px] text-slate-500">{item.officialCode}</div>
                  </div>
                  {item.matchType === 'exact' && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ✓ Merge (exact)
                    </span>
                  )}
                  {item.matchType === 'suggested' && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      ⚡ Merge: {item.matchedCourseName}
                    </span>
                  )}
                  {item.matchType === 'none' && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      ➕ New subject
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between gap-3">
          {step === 'review' && !result ? (
            <>
              <button
                onClick={() => setStep('pick')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={isApplying}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
                {isApplying ? 'Applying...' : `Confirm Import for ${selected}`}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              {result ? 'Done' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
