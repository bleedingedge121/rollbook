'use client'

import React from 'react'
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Settings,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Activity,
  Zap,
} from 'lucide-react'
import { motion } from 'framer-motion'

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
  const navItems = [
    { id: 'home' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'subjects' as TabType, label: 'Subjects', icon: BookOpen },
    { id: 'calendar' as TabType, label: 'Trajectory Lab', icon: CalendarDays },
    { id: 'settings' as TabType, label: 'Command & Sync', icon: Settings },
  ]

  return (
    <header className="sticky top-0 z-40 bg-[#070a12]/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 font-black text-white tracking-widest text-sm border border-white/10"
            >
              RB
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-100 text-base tracking-tight font-sans">
                  Roll Book
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  SLCM 2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block font-medium">
                Deterministic Attendance & Flight Planner
              </p>
            </div>
          </div>

          {/* Navigation Pill Bar */}
          <nav className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 z-10 ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavTab"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-600/30 via-blue-600/30 to-indigo-600/30 border border-cyan-500/40 shadow-sm"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={`w-3.5 h-3.5 relative z-10 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="relative z-10 hidden md:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Right Status / Actions */}
          <div className="flex items-center gap-2.5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-mono font-bold shadow-sm ${
                isSafe
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{overallPct}%</span>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh attendance records"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
              />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                window.location.href = '/login'
              }}
              title="Sign out of Roll Book"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900/80 hover:bg-rose-500/10 border border-slate-800 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  )
}
