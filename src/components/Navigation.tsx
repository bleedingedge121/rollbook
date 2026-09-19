'use client'

import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Settings,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from 'next-themes'

export type TabType = 'home' | 'subjects' | 'calendar' | 'settings'

interface NavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  overallPct: number
  isSafe: boolean
  onRefresh: () => void
  isRefreshing?: boolean
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  overallPct,
  isSafe,
  onRefresh,
  isRefreshing,
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    setMounted(true)
  }, [])

  const navItems = [
    { id: 'home' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'subjects' as TabType, label: 'Subjects', icon: BookOpen },
    { id: 'calendar' as TabType, label: 'Trajectory Lab', icon: CalendarDays },
    { id: 'settings' as TabType, label: 'Command & Sync', icon: Settings },
  ]

  const toggleTheme = () => {
    const current = resolvedTheme || theme
    setTheme(current === 'dark' ? 'light' : 'dark')
  }

  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark')

  return (
    <header className="sticky top-0 z-40 bg-[var(--background)]/90 backdrop-blur-xl border-b-2 border-[var(--border)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={prefersReducedMotion ? {} : { scale: 1.08, rotate: -2 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.94 }}
              className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)] font-heading font-black text-white tracking-widest text-base"
            >
              RB
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-[var(--foreground)] text-lg tracking-tight">
                  Roll Book
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 font-mono font-bold border border-violet-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                  SLCM 2.0
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] hidden sm:block font-medium">
                Confirmed Attendance & Honest Planning
              </p>
            </div>
          </div>

          {/* Navigation Pill Bar */}
          <nav className="flex items-center p-1 rounded-full bg-[var(--card)] border-2 border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)]">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 z-10 ${
                    isActive ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavTab"
                      className="absolute inset-0 rounded-full bg-violet-600 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={`w-3.5 h-3.5 relative z-10 transition-colors ${
                      isActive ? 'text-white' : 'text-[var(--muted-foreground)]'
                    }`}
                  />
                  <span className="relative z-10 hidden md:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Right Controls & Theme Toggle */}
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-[var(--border)] text-xs font-mono font-bold shadow-[2px_2px_0px_var(--shadow-color)] ${
                isSafe
                  ? 'bg-emerald-400/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-400/20 text-rose-700 dark:text-rose-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{overallPct}%</span>
            </motion.div>

            {/* Theme Toggle Button */}
            <motion.button
              whileHover={prefersReducedMotion ? {} : { scale: 1.08 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="p-2 rounded-full text-[var(--foreground)] bg-[var(--card)] hover:bg-[var(--muted)] border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] transition-all"
            >
              {mounted ? (
                isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" strokeWidth={2.5} />
                ) : (
                  <Moon className="w-4 h-4 text-violet-600" strokeWidth={2.5} />
                )
              ) : (
                <div className="w-4 h-4" />
              )}
            </motion.button>

            {/* Refresh Button */}
            <motion.button
              whileHover={prefersReducedMotion ? {} : { scale: 1.08 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh attendance records"
              className="p-2 rounded-full text-[var(--foreground)] bg-[var(--card)] hover:bg-[var(--muted)] border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-violet-600' : ''}`}
                strokeWidth={2.5}
              />
            </motion.button>

            {/* Logout Button */}
            <motion.button
              whileHover={prefersReducedMotion ? {} : { scale: 1.08 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                window.location.href = '/login'
              }}
              title="Sign out of Roll Book"
              className="p-2 rounded-full text-[var(--foreground)] hover:text-rose-500 bg-[var(--card)] hover:bg-rose-500/10 border-2 border-[var(--border)] shadow-[2px_2px_0px_var(--shadow-color)] transition-all"
            >
              <LogOut className="w-4 h-4" strokeWidth={2.5} />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  )
}
