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
  Sparkles,
  Layers,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
    <div className="min-h-screen bg-[#070a12] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background aurora */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10 space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold text-lg border border-white/10">
            RB
          </div>
          <h1 className="text-xl font-bold text-slate-100 font-sans">Welcome to Roll Book</h1>
          <p className="text-xs text-slate-400">Initialize your academic section timetable</p>
        </div>

        <div className="bg-[#0c121e]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl">
          {error && (
            <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-5"
              >
                <p className="text-xs text-slate-300 leading-relaxed">
                  Let's configure your subjects and timetable. Select your section and Roll Book will auto-populate your entire weekly schedule from the official department timetable.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('section')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all active:scale-95 font-mono"
                >
                  Choose My Section <ArrowRight className="w-4 h-4" />
                </motion.button>
                <button
                  onClick={skipOnboarding}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 mx-auto transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Skip, I'll configure manually
                </button>
              </motion.div>
            )}

            {step === 'section' && (
              <motion.div
                key="section"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <GraduationCap className="w-7 h-7 text-cyan-400 mx-auto mb-2" />
                  <h2 className="text-sm font-bold text-slate-100">Select Section</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">B.Tech I Semester • CSE Stream (C01 – C22)</p>
                </div>
                {sections.length === 0 && !error && (
                  <p className="text-xs text-slate-500 text-center font-mono">Loading sections...</p>
                )}
                <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                  {sections.map((s) => (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      key={s.code}
                      onClick={() => {
                        setSelected(s)
                        setStep('confirm')
                      }}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-cyan-500/50 hover:bg-slate-900 text-center transition-all"
                    >
                      <div className="font-bold text-sm text-slate-100 font-mono">{s.code}</div>
                    </motion.button>
                  ))}
                </div>
                <button
                  onClick={skipOnboarding}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 mx-auto transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Skip
                </button>
              </motion.div>
            )}

            {step === 'confirm' && selected && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-5"
              >
                <div>
                  <div className="text-3xl font-black font-mono text-cyan-400 mb-1">{selected.code}</div>
                  <p className="text-xs text-slate-400">Coordinator: {selected.coordinator}</p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  We'll populate your <strong className="text-slate-100">{selected.courseCount} subjects</strong> and
                  weekly schedule slots automatically.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApply}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all active:scale-95 font-mono"
                >
                  Import Timetable <CheckCircle2 className="w-4 h-4" />
                </motion.button>
                <button
                  onClick={() => setStep('section')}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Choose a different section
                </button>
              </motion.div>
            )}

            {step === 'applying' && (
              <motion.div
                key="applying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-6 space-y-3"
              >
                <RefreshCw className="w-8 h-8 text-cyan-400 mx-auto animate-spin" />
                <p className="text-xs text-slate-300 font-mono">Applying timetable configuration...</p>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-5"
              >
                <PartyPopper className="w-10 h-10 text-emerald-400 mx-auto" />
                <div>
                  <h2 className="text-sm font-bold text-slate-100">Setup Complete!</h2>
                  <p className="text-xs text-slate-400 mt-1">{resultMessage}</p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    Optional Portal Sync
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    You can synchronize live SLCM baseline figures any time via Settings → SLCM Sync Bridge.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onComplete}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all active:scale-95 font-mono"
                >
                  Open Dashboard <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
