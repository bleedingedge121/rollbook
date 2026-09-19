'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Lock, User, ArrowRight, Info, ShieldCheck, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usingDefaults, setUsingDefaults] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.usingDefaultCredentials) setUsingDefaults(true)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      const from = searchParams.get('from')
      router.push(from && from !== '/login' ? from : '/')
      router.refresh()
    } catch {
      setError('Could not reach the server. Is it running?')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden bg-dot-grid">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative z-10 space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-2">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -2 }}
            className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center border-2 border-[var(--border)] shadow-[4px_4px_0px_var(--shadow-color)]"
          >
            <span className="font-heading font-black text-white text-xl tracking-wider">RB</span>
          </motion.div>
          <div>
            <h1 className="text-2xl font-heading font-black text-[var(--foreground)] tracking-tight">
              Roll Book
            </h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-medium">
              Confirmed Attendance & Honest Planning
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-teal-500 transition-colors font-bold"
                placeholder="admin"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-[var(--background)] border-2 border-[var(--border)] rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-teal-500 transition-colors font-bold"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-rose-600 dark:text-rose-300 bg-rose-500/10 border-2 border-rose-500/30 rounded-xl px-3.5 py-2 font-bold"
            >
              {error}
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="pill-btn w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </motion.button>

          {usingDefaults && (
            <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-400/20 border-2 border-[var(--border)] rounded-xl px-3 py-2 shadow-[2px_2px_0px_var(--shadow-color)]">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Default credentials active: <strong className="font-mono">admin</strong> / <strong className="font-mono">rollbook</strong>.
              </span>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
