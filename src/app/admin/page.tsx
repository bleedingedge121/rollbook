'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Shield,
  Users,
  Calendar,
  Palmtree,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Eye,
  RotateCcw,
  UserX,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Clock,
  ExternalLink,
  Sliders,
  X,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { Holiday } from '@/types'

interface AdminUserItem {
  id: string
  username: string
  role: string
  createdAt: string
  courseCount: number
  courses: { id: string; code: string; name: string }[]
  lastSyncedAt: string | null
  chatRequestCount: number
}

interface UserDetail extends AdminUserItem {
  chatRequestDate: string | null
  courses: {
    id: string
    name: string
    code: string
    trackingMode: string
    requiredPercent: number
    syncedPresent: number | null
    syncedAbsent: number | null
    syncedAt: string | null
    simpleHeld: number | null
    simpleAttended: number | null
    timetableSlots: {
      id: string
      weekday: number
      label: string
      room: string | null
    }[]
    attendance: {
      id: string
      date: string
      status: string
      note: string | null
    }[]
  }[]
}

interface HolidayGroup {
  key: string
  label: string
  type: string
  startDate: string
  endDate: string
  count: number
  ids: string[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminPage() {
  const prefersReducedMotion = useReducedMotion()

  // Auth / Role State
  const [currentAdmin, setCurrentAdmin] = useState<{ userId: string; username: string; role: string } | null>(null)
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true)

  // Active Tab: 'holidays' | 'users'
  const [activeTab, setActiveTab] = useState<'holidays' | 'users'>('users')

  // Data States
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Toast / Alert Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // Inspect Modal State
  const [inspectUserId, setInspectUserId] = useState<string | null>(null)
  const [inspectData, setInspectData] = useState<UserDetail | null>(null)
  const [isLoadingInspect, setIsLoadingInspect] = useState(false)

  // Reset Data Modal State
  const [resetTargetUser, setResetTargetUser] = useState<AdminUserItem | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  // Delete User Modal State
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserItem | null>(null)
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Add Holiday Form State
  const [holidayMode, setHolidayMode] = useState<'single' | 'range'>('single')
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayStartDate, setNewHolidayStartDate] = useState('')
  const [newHolidayEndDate, setNewHolidayEndDate] = useState('')
  const [newHolidayLabel, setNewHolidayLabel] = useState('')
  const [newHolidayType, setNewHolidayType] = useState<'holiday' | 'exam'>('holiday')
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false)

  // Verify Admin Access
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data?.authenticated) {
          window.location.href = '/login'
          return
        }
        if (data.role !== 'admin') {
          window.location.href = '/'
          return
        }
        setCurrentAdmin({ userId: data.userId, username: data.username, role: data.role })
        setIsVerifyingAuth(false)
      })
      .catch(() => {
        window.location.href = '/login'
      })
  }, [])

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data)
    } catch (err: any) {
      showToast(err.message || 'Error fetching user list', 'error')
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  // Fetch Holidays
  const fetchHolidays = useCallback(async () => {
    setIsLoadingHolidays(true)
    try {
      const res = await fetch('/api/holidays')
      if (!res.ok) throw new Error('Failed to load holidays')
      const data = await res.json()
      setHolidays(data)
    } catch (err: any) {
      showToast(err.message || 'Error fetching holidays', 'error')
    } finally {
      setIsLoadingHolidays(false)
    }
  }, [])

  // Load Data once verified
  useEffect(() => {
    if (!isVerifyingAuth && currentAdmin) {
      fetchUsers()
      fetchHolidays()
    }
  }, [isVerifyingAuth, currentAdmin, fetchUsers, fetchHolidays])

  // Open Inspect Modal
  const handleInspectUser = async (userId: string) => {
    setInspectUserId(userId)
    setInspectData(null)
    setIsLoadingInspect(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (!res.ok) throw new Error('Failed to fetch user details')
      const data = await res.json()
      setInspectData(data)
    } catch (err: any) {
      showToast(err.message || 'Error inspecting user', 'error')
      setInspectUserId(null)
    } finally {
      setIsLoadingInspect(false)
    }
  }

  // Execute Reset User Data
  const handleExecuteReset = async () => {
    if (!resetTargetUser) return
    setIsResetting(true)
    try {
      const res = await fetch(`/api/admin/users/${resetTargetUser.id}/reset`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset user data')
      showToast(`Successfully wiped data for ${resetTargetUser.username}.`)
      setResetTargetUser(null)
      fetchUsers()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setIsResetting(false)
    }
  }

  // Execute Delete User Account
  const handleExecuteDelete = async () => {
    if (!deleteTargetUser) return
    if (deleteConfirmationInput.trim().toLowerCase() !== deleteTargetUser.username.toLowerCase()) {
      showToast('Typed username does not match.', 'error')
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteTargetUser.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user account')
      showToast(`User account "${deleteTargetUser.username}" permanently deleted.`)
      setDeleteTargetUser(null)
      setDeleteConfirmationInput('')
      fetchUsers()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Create Holiday
  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHolidayLabel.trim()) return

    setIsSubmittingHoliday(true)
    try {
      let body: any = {
        label: newHolidayLabel.trim(),
        type: newHolidayType,
      }

      if (holidayMode === 'range') {
        if (!newHolidayStartDate || !newHolidayEndDate) return
        body.startDate = newHolidayStartDate
        body.endDate = newHolidayEndDate
      } else {
        if (!newHolidayDate) return
        body.date = newHolidayDate
      }

      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to declare holiday')

      showToast('Calendar event declared successfully across all student accounts.')
      setNewHolidayDate('')
      setNewHolidayStartDate('')
      setNewHolidayEndDate('')
      setNewHolidayLabel('')
      fetchHolidays()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setIsSubmittingHoliday(false)
    }
  }

  // Delete Holiday Group
  const handleDeleteHolidayGroup = async (group: HolidayGroup) => {
    if (!confirm(`Delete declared event "${group.label}" for all students?`)) return

    try {
      const res = await fetch(`/api/holidays?ids=${group.ids.join(',')}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete holiday')
      showToast(`Removed event "${group.label}".`)
      fetchHolidays()
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  // Group holidays into consecutive ranges
  const groupedHolidays = useMemo<HolidayGroup[]>(() => {
    if (!holidays || holidays.length === 0) return []
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date))
    const groups: HolidayGroup[] = []

    for (const h of sorted) {
      const prev = groups[groups.length - 1]
      if (prev && prev.label === h.label && prev.type === h.type) {
        const [py, pm, pd] = prev.endDate.split('-').map(Number)
        const prevEnd = new Date(py, pm - 1, pd)
        const expectedNext = new Date(prevEnd)
        expectedNext.setDate(expectedNext.getDate() + 1)
        const expectedNextStr = `${expectedNext.getFullYear()}-${(expectedNext.getMonth() + 1).toString().padStart(2, '0')}-${expectedNext.getDate().toString().padStart(2, '0')}`

        if (h.date === expectedNextStr) {
          prev.endDate = h.date
          prev.count += 1
          prev.ids.push(h.id)
          continue
        }
      }

      groups.push({
        key: `${h.date}-${h.id}`,
        label: h.label,
        type: h.type,
        startDate: h.date,
        endDate: h.date,
        count: 1,
        ids: [h.id],
      })
    }
    return groups
  }, [holidays])

  // Filtered Users list
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const q = searchQuery.trim().toLowerCase()
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.courses.some((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    )
  }, [users, searchQuery])

  if (isVerifyingAuth) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 p-6 bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl shadow-[4px_4px_0px_var(--shadow-color)]">
          <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
          <span className="font-heading font-bold text-sm">Verifying administrator credentials...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl border-2 border-[var(--border)] text-xs font-bold shadow-[4px_4px_0px_var(--shadow-color)] ${
              toast.type === 'error'
                ? 'bg-rose-500 text-white'
                : 'bg-emerald-500 text-slate-900'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Top Navigation */}
      <header className="sticky top-0 z-40 bg-[var(--background)]/90 backdrop-blur-xl border-b-2 border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--card)] hover:bg-[var(--muted)] border-2 border-[var(--border)] text-xs font-mono font-bold shadow-[2px_2px_0px_var(--shadow-color)] transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to App</span>
              </a>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center border-2 border-[var(--border)] text-white shadow-[2px_2px_0px_var(--shadow-color)]">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading font-black text-base tracking-tight">Admin Console</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                      ROOT
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-[var(--border)] text-xs font-mono font-bold bg-[var(--card)] shadow-[2px_2px_0px_var(--shadow-color)]">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>{currentAdmin?.username} (Admin)</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b-2 border-[var(--border)] pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-heading font-bold border-2 transition-all ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Accounts & Oversight ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('holidays')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-heading font-bold border-2 transition-all ${
              activeTab === 'holidays'
                ? 'bg-indigo-600 text-white border-[var(--border)] shadow-[3px_3px_0px_var(--shadow-color)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)]'
            }`}
          >
            <Palmtree className="w-4 h-4" />
            <span>Global Academic Calendar ({groupedHolidays.length})</span>
          </button>
        </div>

        {/* TAB 1: USERS DIRECTORY & OVERSIGHT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl p-4 shadow-[3px_3px_0px_var(--shadow-color)]">
                <div className="text-[11px] font-mono font-bold text-[var(--muted-foreground)] uppercase">Total Registered Users</div>
                <div className="text-2xl font-heading font-black mt-1 text-[var(--foreground)]">{users.length}</div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-1">Multi-user isolated accounts</div>
              </div>

              <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl p-4 shadow-[3px_3px_0px_var(--shadow-color)]">
                <div className="text-[11px] font-mono font-bold text-[var(--muted-foreground)] uppercase">Total Tracked Courses</div>
                <div className="text-2xl font-heading font-black mt-1 text-teal-600">
                  {users.reduce((acc, u) => acc + u.courseCount, 0)}
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-1">Across all section members</div>
              </div>

              <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl p-4 shadow-[3px_3px_0px_var(--shadow-color)]">
                <div className="text-[11px] font-mono font-bold text-[var(--muted-foreground)] uppercase">Administrators</div>
                <div className="text-2xl font-heading font-black mt-1 text-indigo-600">
                  {users.filter((u) => u.role === 'admin').length}
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-1">With calendar & management privileges</div>
              </div>
            </div>

            {/* Search & Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter users or courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--card)] border-2 border-[var(--border)] rounded-xl text-xs text-[var(--foreground)] focus:outline-none focus:border-indigo-500 font-mono shadow-[2px_2px_0px_var(--shadow-color)]"
                />
              </div>

              <button
                onClick={fetchUsers}
                disabled={isLoadingUsers}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] text-xs font-mono font-bold shadow-[2px_2px_0px_var(--shadow-color)] hover:bg-[var(--muted)] transition-all self-end sm:self-auto disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-indigo-600' : ''}`} />
                <span>Refresh Directory</span>
              </button>
            </div>

            {/* Users Table / Grid */}
            <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-4 sm:p-6 shadow-[6px_6px_0px_var(--shadow-color)] space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[var(--border)] text-[var(--muted-foreground)] font-mono uppercase text-[11px]">
                      <th className="pb-3 px-3">User</th>
                      <th className="pb-3 px-3">Role</th>
                      <th className="pb-3 px-3">Joined Date</th>
                      <th className="pb-3 px-3">Courses</th>
                      <th className="pb-3 px-3">Last Portal Sync</th>
                      <th className="pb-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredUsers.map((u) => {
                      const isSelf = u.id === currentAdmin?.userId
                      return (
                        <tr key={u.id} className="hover:bg-[var(--background)] transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-black text-sm text-[var(--foreground)]">
                                {u.username}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">ID: {u.id}</span>
                          </td>

                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                                u.role === 'admin'
                                  ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                  : 'bg-[var(--muted)] text-[var(--foreground)] border-[var(--border)]'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 font-mono text-[var(--muted-foreground)]">
                            {formatDate(u.createdAt)}
                          </td>

                          <td className="py-3.5 px-3 font-mono">
                            <span className="font-bold text-[var(--foreground)]">{u.courseCount}</span> courses
                          </td>

                          <td className="py-3.5 px-3 font-mono text-[var(--muted-foreground)]">
                            {u.lastSyncedAt ? formatDateTime(u.lastSyncedAt) : 'Never synced'}
                          </td>

                          <td className="py-3.5 px-3 text-right space-x-1.5">
                            {/* Inspect Button */}
                            <button
                              onClick={() => handleInspectUser(u.id)}
                              title="Inspect courses and attendance"
                              className="px-2.5 py-1.5 rounded-xl bg-[var(--background)] border-2 border-[var(--border)] hover:bg-[var(--muted)] text-xs font-mono font-bold transition-all shadow-[2px_2px_0px_var(--shadow-color)]"
                            >
                              <Eye className="w-3.5 h-3.5 inline mr-1 text-teal-600" />
                              Inspect
                            </button>

                            {/* Reset Data Button */}
                            <button
                              onClick={() => setResetTargetUser(u)}
                              title="Reset user courses and attendance"
                              className="px-2.5 py-1.5 rounded-xl bg-[var(--background)] border-2 border-[var(--border)] hover:bg-amber-500/10 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 transition-all shadow-[2px_2px_0px_var(--shadow-color)]"
                            >
                              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                              Reset
                            </button>

                            {/* Delete User Button */}
                            {!isSelf && (
                              <button
                                onClick={() => {
                                  setDeleteTargetUser(u)
                                  setDeleteConfirmationInput('')
                                }}
                                title="Permanently delete user account"
                                className="px-2.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border-2 border-[var(--border)] text-xs font-mono font-bold transition-all shadow-[2px_2px_0px_var(--shadow-color)]"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GLOBAL ACADEMIC CALENDAR */}
        {activeTab === 'holidays' && (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-[6px_6px_0px_var(--shadow-color)] space-y-6">
              <div>
                <h2 className="text-base font-heading font-black text-[var(--foreground)] flex items-center gap-2">
                  <Palmtree className="w-5 h-5 text-amber-500" />
                  Shared University Calendar (Global)
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  All dates added or deleted here are globally synchronized across all registered student accounts in this section.
                </p>
              </div>

              {/* Add Holiday Form with Range Toggle */}
              <form
                onSubmit={handleCreateHoliday}
                className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4.5 space-y-4 shadow-[3px_3px_0px_var(--shadow-color)]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5 font-mono">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" /> Declare Calendar Event
                  </div>

                  {/* Single Day vs Date Range Toggle */}
                  <div className="flex items-center p-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setHolidayMode('single')}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        holidayMode === 'single'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      Single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setHolidayMode('range')}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        holidayMode === 'range'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      Date Range
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {holidayMode === 'single' ? (
                    <div>
                      <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Date</label>
                      <input
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        required
                        className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="sm:col-span-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Start Date</label>
                        <input
                          type="date"
                          value={newHolidayStartDate}
                          onChange={(e) => setNewHolidayStartDate(e.target.value)}
                          required
                          className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-2.5 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">End Date</label>
                        <input
                          type="date"
                          value={newHolidayEndDate}
                          onChange={(e) => setNewHolidayEndDate(e.target.value)}
                          required
                          className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-2.5 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Event Name / Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Diwali Break, Mid-Term Exam"
                      value={newHolidayLabel}
                      onChange={(e) => setNewHolidayLabel(e.target.value)}
                      required
                      className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--muted-foreground)] font-bold block mb-1 font-mono">Type</label>
                    <select
                      value={newHolidayType}
                      onChange={(e) => setNewHolidayType(e.target.value as any)}
                      className="w-full bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-indigo-500 font-bold"
                    >
                      <option value="holiday">🌴 Holiday / Recess</option>
                      <option value="exam">📝 Exam Day / Assessment</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <motion.button
                    whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                    type="submit"
                    disabled={
                      isSubmittingHoliday ||
                      !newHolidayLabel.trim() ||
                      (holidayMode === 'single' ? !newHolidayDate : !newHolidayStartDate || !newHolidayEndDate)
                    }
                    className="pill-btn px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                  >
                    {isSubmittingHoliday
                      ? 'Saving...'
                      : holidayMode === 'range'
                      ? 'Add Date Range'
                      : 'Add Date'}
                  </motion.button>
                </div>
              </form>

              {/* List of Declared Holidays (Grouped Range View) */}
              <div className="space-y-3">
                <div className="text-xs font-heading font-black uppercase tracking-wider text-[var(--foreground)] font-mono flex items-center justify-between">
                  <span>Declared Calendar Events ({groupedHolidays.length} entries, {holidays.length} days total)</span>
                  <button
                    onClick={fetchHolidays}
                    disabled={isLoadingHolidays}
                    className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHolidays ? 'animate-spin text-indigo-600' : ''}`} />
                  </button>
                </div>

                {groupedHolidays.length === 0 ? (
                  <div className="text-xs text-[var(--muted-foreground)] p-6 bg-[var(--background)] rounded-2xl border-2 border-dashed border-[var(--border)] text-center font-mono">
                    No holidays or exam days registered yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {groupedHolidays.map((group) => (
                      <div
                        key={group.key}
                        className="bg-[var(--background)] border-2 border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-3 text-xs shadow-[2px_2px_0px_var(--shadow-color)]"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                                group.type === 'exam'
                                  ? 'bg-purple-400 text-slate-900 border-[var(--border)]'
                                  : 'bg-amber-400 text-slate-900 border-[var(--border)]'
                              }`}
                            >
                              {group.type === 'exam' ? 'Exam' : 'Holiday'}
                            </span>
                            <span className="font-mono text-[var(--foreground)] font-bold">
                              {group.count > 1
                                ? `${formatDate(group.startDate)} → ${formatDate(group.endDate)}`
                                : formatDate(group.startDate)}
                            </span>
                            {group.count > 1 && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]">
                                {group.count} days
                              </span>
                            )}
                          </div>
                          <div className="text-[var(--foreground)] font-heading font-bold truncate">
                            {group.label}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteHolidayGroup(group)}
                          className="p-1.5 rounded-full text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-[var(--muted)] transition-colors"
                          title={`Delete ${group.label}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: INSPECT USER DETAILS */}
      <AnimatePresence>
        {inspectUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-[6px_6px_0px_var(--shadow-color)] space-y-5"
            >
              <div className="flex items-center justify-between border-b-2 border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white font-black text-sm">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-heading font-black">Inspect User Account</h3>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono">
                      {inspectData ? `User: ${inspectData.username} (${inspectData.role})` : 'Loading...'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectUserId(null)}
                  className="p-1 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isLoadingInspect ? (
                <div className="py-12 flex items-center justify-center gap-3 text-xs font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  Loading user data...
                </div>
              ) : inspectData ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                    <div className="p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--muted-foreground)] block">Courses</span>
                      <span className="font-bold text-sm">{inspectData.courses.length}</span>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--muted-foreground)] block">Chat Quota Today</span>
                      <span className="font-bold text-sm">{inspectData.chatRequestCount} / 50</span>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--muted-foreground)] block">Account Created</span>
                      <span className="font-bold text-xs">{formatDate(inspectData.createdAt)}</span>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--muted-foreground)] block">Role</span>
                      <span className="font-bold uppercase text-indigo-600 text-xs">{inspectData.role}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-heading font-bold text-xs uppercase tracking-wider text-[var(--foreground)] font-mono">
                      Registered Courses ({inspectData.courses.length})
                    </div>
                    {inspectData.courses.length === 0 ? (
                      <div className="p-4 bg-[var(--background)] rounded-xl text-center text-[var(--muted-foreground)] font-mono border border-dashed border-[var(--border)]">
                        No courses created or synced yet for this user.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {inspectData.courses.map((c) => (
                          <div
                            key={c.id}
                            className="p-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-xl space-y-1.5 shadow-[2px_2px_0px_var(--shadow-color)]"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-heading font-bold text-sm">
                                {c.name} <span className="font-mono text-xs text-[var(--muted-foreground)]">({c.code})</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--card)] border border-[var(--border)] uppercase">
                                {c.trackingMode}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-[var(--muted-foreground)]">
                              <span>Req: {c.requiredPercent}%</span>
                              {c.trackingMode === 'detailed' ? (
                                <>
                                  <span>Synced: {c.syncedPresent}P / {c.syncedAbsent}A</span>
                                  <span>Manual Records: {c.attendance.length}</span>
                                  <span>Slots: {c.timetableSlots.length}</span>
                                </>
                              ) : (
                                <span>Simple: {c.simpleAttended}P / {c.simpleHeld}H</span>
                              )}
                              {c.syncedAt && <span>Synced At: {formatDateTime(c.syncedAt)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end pt-2 border-t-2 border-[var(--border)]">
                <button
                  onClick={() => setInspectUserId(null)}
                  className="px-4 py-2 bg-[var(--card)] hover:bg-[var(--muted)] border-2 border-[var(--border)] rounded-xl font-mono font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RESET USER DATA CONFIRMATION */}
      <AnimatePresence>
        {resetTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 w-full max-w-md shadow-[6px_6px_0px_var(--shadow-color)] space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center border-2 border-[var(--border)]">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base">Reset User Data?</h3>
                  <p className="text-xs text-[var(--muted-foreground)] font-mono">Target: {resetTargetUser.username}</p>
                </div>
              </div>

              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                This will wipe <strong>all courses, timetable slots, and attendance records</strong> for user{' '}
                <strong className="text-[var(--foreground)]">{resetTargetUser.username}</strong>, and reset their AI chat rate limit.
                Their account login and password will remain active.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setResetTargetUser(null)}
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl bg-[var(--card)] hover:bg-[var(--muted)] border-2 border-[var(--border)] text-xs font-mono font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteReset}
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 border-2 border-[var(--border)] text-xs font-mono font-bold shadow-[2px_2px_0px_var(--shadow-color)]"
                >
                  {isResetting ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: DELETE USER ACCOUNT WITH CONFIRMATION */}
      <AnimatePresence>
        {deleteTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--card)] border-2 border-[var(--border)] rounded-3xl p-6 w-full max-w-md shadow-[6px_6px_0px_var(--shadow-color)] space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-600 flex items-center justify-center border-2 border-[var(--border)]">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-rose-600">Permanently Delete User?</h3>
                  <p className="text-xs text-[var(--muted-foreground)] font-mono">Irreversible Action</p>
                </div>
              </div>

              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-1 text-rose-700 dark:text-rose-300">
                <p>
                  You are about to permanently delete user <strong>&quot;{deleteTargetUser.username}&quot;</strong> and all associated courses, attendance logs, and data.
                </p>
                <p className="font-bold">This action cannot be undone.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--muted-foreground)] block">
                  Please type <span className="font-bold text-[var(--foreground)]">&quot;{deleteTargetUser.username}&quot;</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  placeholder={deleteTargetUser.username}
                  className="w-full px-3 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-xl text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setDeleteTargetUser(null)
                    setDeleteConfirmationInput('')
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-[var(--card)] hover:bg-[var(--muted)] border-2 border-[var(--border)] text-xs font-mono font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteDelete}
                  disabled={
                    isDeleting ||
                    deleteConfirmationInput.trim().toLowerCase() !== deleteTargetUser.username.toLowerCase()
                  }
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border-2 border-[var(--border)] text-xs font-mono font-bold shadow-[2px_2px_0px_var(--shadow-color)] disabled:opacity-40 transition-all"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
