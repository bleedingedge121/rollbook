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
} from 'lucide-react'

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
    { id: 'home' as TabType, label: 'Home', icon: LayoutDashboard },
    { id: 'subjects' as TabType, label: 'Subjects', icon: BookOpen },
    { id: 'calendar' as TabType, label: 'Calendar & Planning', icon: CalendarDays },
    { id: 'settings' as TabType, label: 'Settings & Sync', icon: Settings },
  ]

  return (
    <header className="sticky top-0 z-40 bg-[#0e1422]/90 backdrop-blur-md border-b border-[#1e293b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 font-bold text-white tracking-wider text-lg">
              RB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-lg tracking-tight">
                  Roll Book
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20">
                  SLCM 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Confirmed Attendance & Honest Planning
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Right Status / Actions */}
          <div className="flex items-center gap-3">
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                isSafe
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Overall: {overallPct}%</span>
            </div>

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh attendance data"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                window.location.href = '/login'
              }}
              title="Sign out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
