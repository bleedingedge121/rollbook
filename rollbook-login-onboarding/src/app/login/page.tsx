'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Lock, User, ArrowRight, Info } from 'lucide-react'

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
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Roll Book</h1>
          <p className="text-xs text-slate-500 mt-1">Confirmed Attendance & Honest Planning</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="admin"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>

          {usingDefaults && (
            <div className="flex items-start gap-2 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Using the default demo login: <strong>admin</strong> / <strong>rollbook</strong>.
                Set <code>APP_USERNAME</code> and <code>APP_PASSWORD</code> in your <code>.env</code> to change it.
              </span>
            </div>
          )}
        </form>
      </div>
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
