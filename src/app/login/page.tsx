'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, User, ArrowRight, UserPlus, LogIn } from 'lucide-react'
import { motion } from 'framer-motion'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || (isSignUp ? 'Registration failed' : 'Login failed'))
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

        <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[var(--background)] border-2 border-[var(--border)] rounded-xl text-xs font-mono font-bold">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false)
                setError(null)
              }}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                !isSignUp
                  ? 'bg-teal-600 text-white shadow-[1px_1px_0px_var(--shadow-color)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true)
                setError(null)
              }}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                isSignUp
                  ? 'bg-teal-600 text-white shadow-[1px_1px_0px_var(--shadow-color)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder={isSignUp ? 'your_username' : 'username'}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Password
                </label>
                {isSignUp && (
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    min. 8 chars
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
              {isSubmitting
                ? isSignUp
                  ? 'Creating Account...'
                  : 'Authenticating...'
                : isSignUp
                ? 'Create Account'
                : 'Sign In'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </motion.button>
          </form>
        </div>
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
