'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Terminal,
  SkipForward,
  PartyPopper,
} from 'lucide-react'

interface SectionSummary {
  code: string
  coordinator: string
  defaultRoom: string
  group: 'physics' | 'chem'
  courseCount: number
}

interface OnboardingWizardProps {
  onComplete: () => void
  onImported: () => Promise<void>
}

type Step = 'welcome' | 'section' | 'confirm' | 'applying' | 'done'

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onImported }) => {
  const [step, setStep] = useState<Step>('welcome')
  const [sections, setSections] = useState<SectionSummary[]>([])
  const [selected, setSelected] = useState<SectionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sections')
      .then((r) => r.json())
      .then((data) => setSections(data.sections || []))
      .catch(() => setError('Could not load the section list. You can still set things up manually later.'))
  }, [])

  const skipOnboarding = () => {
    try {
      localStorage.setItem('rollbook_onboarding_skipped', 'true')
    } catch {}
    onComplete()
  }

  const handleApply = async () => {
    if (!selected) return
    setStep('applying')
    setError(null)
    try {
      const res = await fetch('/api/sections/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: selected.code, apply: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong setting up your timetable')
      setResultMessage(data.message)
      await onImported()
      setStep('done')
    } catch (err: any) {
      setError(err?.message || 'Something went wrong setting up your timetable')
      setStep('confirm')
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">Welcome to Roll Book</h1>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl">
          {error && (
            <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {step === 'welcome' && (
            <div className="text-center space-y-5">
              <p className="text-sm text-slate-300">
                Let's set up your subjects and timetable. It takes about 10 seconds — just pick your section
                and we'll fill in everything from the official department timetable.
              </p>
              <button
                onClick={() => setStep('section')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={skipOnboarding}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 mx-auto transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" /> I'll set it up manually
              </button>
            </div>
          )}

          {step === 'section' && (
            <div className="space-y-4">
              <div className="text-center">
                <GraduationCap className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <h2 className="text-sm font-bold text-slate-100">Which section are you in?</h2>
                <p className="text-xs text-slate-500 mt-1">B.Tech I Semester, CSE Stream</p>
              </div>
              {sections.length === 0 && !error && (
                <p className="text-xs text-slate-500 text-center">Loading sections...</p>
              )}
              <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                {sections.map((s) => (
                  <button
                    key={s.code}
                    onClick={() => {
                      setSelected(s)
                      setStep('confirm')
                    }}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/50 hover:bg-slate-900 text-center transition-colors"
                  >
                    <div className="font-bold text-sm text-slate-100">{s.code}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={skipOnboarding}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 mx-auto transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip, I'll set it up manually
              </button>
            </div>
          )}

          {step === 'confirm' && selected && (
            <div className="text-center space-y-5">
              <div>
                <div className="text-3xl font-bold text-blue-400 mb-1">{selected.code}</div>
                <p className="text-xs text-slate-500">Section coordinator: {selected.coordinator}</p>
              </div>
              <p className="text-sm text-slate-300">
                We'll add your <strong className="text-slate-100">{selected.courseCount} subjects</strong> and
                your full weekly timetable, ready to use.
              </p>
              <button
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
              >
                Set Up My Timetable <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStep('section')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Choose a different section
              </button>
            </div>
          )}

          {step === 'applying' && (
            <div className="text-center py-6 space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 mx-auto animate-spin" />
              <p className="text-sm text-slate-300">Setting up your timetable...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center space-y-5">
              <PartyPopper className="w-10 h-10 text-emerald-400 mx-auto" />
              <div>
                <h2 className="text-sm font-bold text-slate-100">You're all set!</h2>
                <p className="text-xs text-slate-500 mt-1">{resultMessage}</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Optional: auto-sync your real attendance
                </div>
                <p className="text-[11px] text-slate-500">
                  You can pull your actual attendance numbers from the MAHE portal any time from
                  Settings → Sync. No rush — you can start logging attendance manually right now instead.
                </p>
              </div>

              <button
                onClick={onComplete}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
              >
                Go to My Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
