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
  Copy,
  Check,
  AlertCircle,
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

type Step = 'welcome' | 'section' | 'confirm' | 'applying' | 'slcm-sync' | 'syncing' | 'done'

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onImported }) => {
  const [step, setStep] = useState<Step>('welcome')
  const [sections, setSections] = useState<SectionSummary[]>([])
  const [selected, setSelected] = useState<SectionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [agentOffline, setAgentOffline] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)

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
      setStep('slcm-sync')
    } catch (err: any) {
      setError(err?.message || 'Something went wrong setting up your timetable')
      setStep('confirm')
    }
  }

  const handleOnboardingSync = async () => {
    setStep('syncing')
    setError(null)
    setAgentOffline(false)

    try {
      // 1. Check agent status
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2500)

      let statusRes
      try {
        statusRes = await fetch('http://localhost:4747/status', {
          signal: controller.signal,
        })
      } catch {
        setAgentOffline(true)
        setStep('slcm-sync')
        return
      } finally {
        clearTimeout(timeoutId)
      }

      if (!statusRes.ok) {
        setAgentOffline(true)
        setStep('slcm-sync')
        return
      }

      // 2. Run sync
      const syncRes = await fetch('http://localhost:4747/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const json = await syncRes.json()
      if (!syncRes.ok) {
        throw new Error(json.error || 'Scraper could not capture attendance.')
      }

      // 3. Auto-reconcile & apply
      const reconcileRes = await fetch('/api/sync/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courses: json.courses,
          syncedAt: json.syncedAt,
          apply: true,
          merges: json.courses.map((c: any) => ({
            incomingCode: c.code,
            incomingName: c.name,
            present: c.present,
            absent: c.absent,
            targetCourseId: 'AUTO_MATCH',
          })),
        }),
      })

      if (!reconcileRes.ok) {
        console.warn('Reconcile auto-apply notice, refreshing...')
      }

      await onImported()
      setStep('done')
    } catch (err: any) {
      setError(err?.message || 'Failed to sync with SLCM')
      setStep('slcm-sync')
    }
  }

  const copyAgentCommand = () => {
    navigator.clipboard.writeText('cd scraper && node agent.js')
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden bg-dot-grid">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10 space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-2">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -2 }}
            className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)] text-white font-heading font-black text-lg"
          >
            RB
          </motion.div>
          <h1 className="text-xl font-heading font-black text-[var(--foreground)]">Welcome to Roll Book</h1>
          <p className="text-xs text-[var(--muted-foreground)]">Initialize your academic section timetable</p>
        </div>

        <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)]">
          {error && (
            <div className="mb-4 text-xs text-rose-600 dark:text-rose-300 bg-rose-500/10 border-2 border-rose-500/30 rounded-xl px-3.5 py-2 font-bold">
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
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Let's configure your subjects and timetable. Select your section and Roll Book will auto-populate your entire weekly schedule from the official department timetable.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('section')}
                  className="pill-btn w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all"
                >
                  Choose My Section <ArrowRight className="w-4 h-4" />
                </motion.button>
                <button
                  onClick={skipOnboarding}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1.5 mx-auto transition-colors"
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
                  <GraduationCap className="w-7 h-7 text-teal-600 mx-auto mb-2" />
                  <h2 className="text-sm font-heading font-black text-[var(--foreground)]">Select Section</h2>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">B.Tech I Semester • CSE Stream (C01 – C22)</p>
                </div>
                {sections.length === 0 && !error && (
                  <p className="text-xs text-[var(--muted-foreground)] text-center font-mono">Loading sections...</p>
                )}
                <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                  {sections.map((s) => (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      key={s.code}
                      onClick={() => {
                        setSelected(s)
                        setStep('confirm')
                      }}
                      className="p-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] hover:border-teal-500 text-center transition-all shadow-[2px_2px_0px_var(--shadow-color)]"
                    >
                      <div className="font-mono font-black text-sm text-[var(--foreground)]">{s.code}</div>
                    </motion.button>
                  ))}
                </div>
                <button
                  onClick={skipOnboarding}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1.5 mx-auto transition-colors"
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
                  <div className="text-3xl font-heading font-black font-mono text-teal-600 dark:text-teal-400 mb-1">{selected.code}</div>
                  <p className="text-xs text-[var(--muted-foreground)] font-medium">Coordinator: {selected.coordinator}</p>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  We'll populate your <strong className="text-[var(--foreground)]">{selected.courseCount} subjects</strong> and
                  weekly schedule slots automatically.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApply}
                  className="pill-btn w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all"
                >
                  Import Timetable <CheckCircle2 className="w-4 h-4" />
                </motion.button>
                <button
                  onClick={() => setStep('section')}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
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
                <RefreshCw className="w-8 h-8 text-teal-600 mx-auto animate-spin" />
                <p className="text-xs text-[var(--muted-foreground)] font-mono">Applying timetable configuration...</p>
              </motion.div>
            )}

            {/* Step: SLCM Sync Prompt */}
            {step === 'slcm-sync' && (
              <motion.div
                key="slcm-sync"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center space-y-5"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-600 border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)] flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6" />
                </div>

                <div>
                  <h2 className="text-lg font-heading font-black text-[var(--foreground)]">
                    Synchronize Live SLCM Attendance?
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto leading-relaxed">
                    Would you like to pull your verified attendance figures from the MAHE portal right now?
                  </p>
                </div>

                {agentOffline && (
                  <div className="p-4 rounded-2xl bg-amber-400/15 border-2 border-[var(--border)] text-left space-y-2 shadow-[3px_3px_0px_var(--shadow-color)]">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)]">
                      <Terminal className="w-3.5 h-3.5 text-amber-600" />
                      Local Scraper Agent Offline
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Run this once in a terminal to enable 1-Click Sync:
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[var(--background)] p-2 rounded-xl font-mono text-[11px] text-[var(--foreground)] border border-[var(--border)]">
                        cd scraper && node agent.js
                      </div>
                      <button
                        onClick={copyAgentCommand}
                        className="pill-btn px-3 py-1.5 bg-[var(--card)] hover:bg-[var(--muted)] text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedCmd ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedCmd ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOnboardingSync}
                    className="pill-btn w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-[3px_3px_0px_var(--shadow-color)]"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Sync Now (1-Click)
                  </motion.button>
                  <button
                    onClick={() => setStep('done')}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-2 block w-full transition-colors font-medium"
                  >
                    Skip, start with 0 attendance
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'syncing' && (
              <motion.div
                key="syncing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 space-y-3"
              >
                <RefreshCw className="w-8 h-8 text-teal-600 mx-auto animate-spin" />
                <h3 className="font-heading font-black text-sm text-[var(--foreground)]">
                  Synchronizing Portal Figures...
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-xs mx-auto">
                  Connecting to MAHE SLCM. If Microsoft SSO or MFA is needed, a browser window will open.
                </p>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-5"
              >
                <PartyPopper className="w-10 h-10 text-emerald-500 mx-auto" />
                <div>
                  <h2 className="text-sm font-heading font-black text-[var(--foreground)]">Setup Complete!</h2>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{resultMessage}</p>
                </div>

                <div className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 text-left space-y-2 shadow-[3px_3px_0px_var(--shadow-color)]">
                  <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-[var(--foreground)] font-mono">
                    <Terminal className="w-3.5 h-3.5 text-teal-600" />
                    1-Click Sync Ready
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                    You can synchronize live SLCM baseline figures any time via Settings → SLCM Sync Bridge.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onComplete}
                  className="pill-btn w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all"
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
