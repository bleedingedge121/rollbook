'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Navigation, TabType } from '@/components/Navigation'
import { HomeView } from '@/components/HomeView'
import { SubjectsView } from '@/components/SubjectsView'
import { CalendarView } from '@/components/CalendarView'
import { SettingsView } from '@/components/SettingsView'
import { CourseModal } from '@/components/CourseModal'
import { CourseWithStats, TimetableSlot, AttendanceRecord, Holiday } from '@/types'
import { calculateAttendance } from '@/lib/attendance'
import { Sparkles } from 'lucide-react'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { useClassReminders } from '@/hooks/useClassReminders'

// Lazy-load ChatWidget on client to optimize First Load JS
const ChatWidget = dynamic(
  () => import('@/components/ChatWidget').then((mod) => mod.ChatWidget),
  { ssr: false }
)

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home')
  const [courses, setCourses] = useState<CourseWithStats[]>([])
  const [allSlots, setAllSlots] = useState<TimetableSlot[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [userRole, setUserRole] = useState<string>('user')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  // Quick Add / Edit Subject Modal State from Subjects View
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<CourseWithStats | null>(null)

  // Automated 15-Minute Class Reminders (PC, Android, iOS)
  const reminders = useClassReminders(allSlots, holidays)

  // Fetch all core data in parallel
  const fetchData = useCallback(async () => {
    try {
      const [coursesRes, slotsRes, attendanceRes, holidaysRes, authRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/timetable'),
        fetch('/api/attendance'),
        fetch('/api/holidays'),
        fetch('/api/auth/me'),
      ])

      const [rawCourses, rawSlots, rawAttendance, rawHolidays, authData] = await Promise.all([
        coursesRes.json(),
        slotsRes.json(),
        attendanceRes.json(),
        holidaysRes.json(),
        authRes.json(),
      ])

      if (authData?.role) {
        setUserRole(authData.role)
      }

      if (Array.isArray(rawCourses) && Array.isArray(rawAttendance)) {
        const enrichedCourses: CourseWithStats[] = rawCourses.map((c: any) => {
          if (c.trackingMode === 'simple') {
            const held = c.simpleHeld || 0
            const present = c.simpleAttended || 0
            const absent = Math.max(0, held - present)
            const stats = calculateAttendance(present, absent, c.requiredPercent || 75.0)

            return {
              ...c,
              stats,
              history: [],
              attendance: [],
            }
          }

          const courseAttendance: AttendanceRecord[] = rawAttendance.filter(
            (a: AttendanceRecord) =>
              a.courseId === c.id && !a.note?.includes('Synced from SLCM')
          )
          const manualPresent = courseAttendance.filter((a) => a.status === 'present').length
          const manualAbsent = courseAttendance.filter((a) => a.status === 'absent').length
          
          const totalPresent = (c.syncedPresent || 0) + manualPresent
          const totalAbsent = (c.syncedAbsent || 0) + manualAbsent
          const stats = calculateAttendance(totalPresent, totalAbsent, c.requiredPercent || 75.0)

          return {
            ...c,
            stats,
            history: courseAttendance,
            attendance: courseAttendance,
          }
        })

        setCourses(enrichedCourses)
      }

      if (Array.isArray(rawSlots)) setAllSlots(rawSlots)
      if (Array.isArray(rawAttendance)) setAllAttendance(rawAttendance)
      if (Array.isArray(rawHolidays)) setHolidays(rawHolidays)
    } catch (err) {
      console.error('Failed to load Roll Book data:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem('rollbook_onboarding_skipped') === 'true') {
        setOnboardingDismissed(true)
      }
    } catch {}
    fetchData()

    const handleSyncEvent = () => {
      fetchData()
    }
    window.addEventListener('rollbook:synced', handleSyncEvent)
    return () => {
      window.removeEventListener('rollbook:synced', handleSyncEvent)
    }
  }, [fetchData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
  }

  // Attendance Handlers
  const handleLogAttendance = async (
    courseId: string,
    date: string,
    status: 'present' | 'absent',
    note?: string
  ) => {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, date, status, note }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to log attendance')
    }
    await fetchData()
  }

  const handleDeleteAttendance = async (recordId: string) => {
    const res = await fetch(`/api/attendance/${recordId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete record')
    }
    await fetchData()
  }

  const handleBatchLogAttendance = async (
    records: { courseId: string; date: string; status: 'present' | 'absent'; note?: string }[]
  ) => {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to batch log attendance')
    }
    await fetchData()
  }

  const handleClearDateAttendance = async (date: string) => {
    const res = await fetch(`/api/attendance?date=${encodeURIComponent(date)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to clear date attendance')
    }
    await fetchData()
  }

  // Course Handlers
  const handleSaveCourse = async (courseData: {
    id?: string
    name: string
    code: string
    requiredPercent: number
    color: string
    trackingMode?: string
    simpleHeld?: number
    simpleAttended?: number
    syncedPresent?: number
    syncedAbsent?: number
  }) => {
    const isEdit = !!courseData.id
    const url = isEdit ? `/api/courses/${courseData.id}` : '/api/courses'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseData),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save subject')

    await fetchData()
  }

  const handleDeleteCourse = async (courseId: string) => {
    const res = await fetch(`/api/courses/${courseId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete subject')
    }
    await fetchData()
  }

  // Timetable Slot Handlers
  const handleSaveSlot = async (slotData: {
    id?: string
    courseId: string
    weekday: number
    label: string
    room?: string
  }) => {
    const isEdit = !!slotData.id
    const url = isEdit ? `/api/timetable/${slotData.id}` : '/api/timetable'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slotData),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save timetable slot')

    await fetchData()
  }

  const handleDeleteSlot = async (slotId: string) => {
    const res = await fetch(`/api/timetable/${slotId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete slot')
    }
    await fetchData()
  }

  // Holiday Handlers
  const handleSaveHoliday = async (holidayData: { date?: string; startDate?: string; endDate?: string; label: string; type?: string }) => {
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holidayData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to save holiday')
    }
    await fetchData()
  }

  const handleDeleteHoliday = async (id: string) => {
    const res = await fetch(`/api/holidays/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete holiday')
    }
    await fetchData()
  }

  // Top-level stats calculation (memoized)
  const { overallPct, isSafe } = useMemo(() => {
    let present = 0
    let absent = 0
    courses.forEach((c) => {
      present += c.stats.present
      absent += c.stats.absent
    })
    const held = present + absent
    const pct = held > 0 ? Number(((present / held) * 100).toFixed(1)) : 100
    return {
      overallPct: pct,
      isSafe: pct >= 75,
    }
  }, [courses])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center space-y-5 bg-dot-grid">
        <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center border-2 border-[var(--border)] shadow-[4px_4px_0px_var(--shadow-color)] animate-bounce">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-2 w-full max-w-xs px-4 text-center">
          <p className="text-sm font-heading font-black text-[var(--foreground)] tracking-tight">
            Preparing Flight Deck...
          </p>
          <div className="h-3 rounded-full bg-[var(--muted)] border border-[var(--border)] overflow-hidden">
            <div className="h-full bg-teal-600 w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (courses.length === 0 && !onboardingDismissed) {
    return (
      <OnboardingWizard
        onComplete={() => setOnboardingDismissed(true)}
        onImported={fetchData}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col transition-colors duration-200 bg-dot-grid w-full max-w-full overflow-x-hidden">
      {/* Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        overallPct={overallPct}
        isSafe={isSafe}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-36 md:pb-8 min-w-0 max-w-full overflow-x-hidden">
        {activeTab === 'home' && (
          <HomeView
            courses={courses}
            allSlots={allSlots}
            allAttendance={allAttendance}
            holidays={holidays}
            onLogAttendance={handleLogAttendance}
            onDeleteAttendance={handleDeleteAttendance}
            onBatchLogAttendance={handleBatchLogAttendance}
            onClearDateAttendance={handleClearDateAttendance}
            onSaveHoliday={handleSaveHoliday}
            onNavigateToSubjects={() => setActiveTab('subjects')}
            onNavigateToCalendar={() => setActiveTab('calendar')}
          />
        )}

        {activeTab === 'subjects' && (
          <SubjectsView
            courses={courses}
            onAddCourse={() => {
              setEditingSubject(null)
              setIsSubjectModalOpen(true)
            }}
            onEditCourse={(course) => {
              setEditingSubject(course)
              setIsSubjectModalOpen(true)
            }}
            onDeleteCourse={handleDeleteCourse}
            onLogAttendance={handleLogAttendance}
            onDeleteAttendance={handleDeleteAttendance}
            onUpdateCourseDirect={handleSaveCourse}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            courses={courses}
            allSlots={allSlots}
            allAttendance={allAttendance}
            holidays={holidays}
            onLogAttendance={handleLogAttendance}
            onDeleteAttendance={handleDeleteAttendance}
            onBatchLogAttendance={handleBatchLogAttendance}
            onClearDateAttendance={handleClearDateAttendance}
            onSaveHoliday={handleSaveHoliday}
            onDeleteHoliday={handleDeleteHoliday}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            courses={courses}
            slots={allSlots}
            holidays={holidays}
            userRole={userRole}
            onSaveCourse={handleSaveCourse}
            onDeleteCourse={handleDeleteCourse}
            onSaveSlot={handleSaveSlot}
            onDeleteSlot={handleDeleteSlot}
            onSaveHoliday={handleSaveHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            onRefreshAll={fetchData}
            reminders={reminders}
          />
        )}
      </main>

      {/* AI Attendance Chatbot Widget (dynamic client load) */}
      <ChatWidget />

      {/* Subject Modal */}
      <CourseModal
        isOpen={isSubjectModalOpen}
        onClose={() => {
          setIsSubjectModalOpen(false)
          setEditingSubject(null)
        }}
        onSave={handleSaveCourse}
        initialData={editingSubject}
      />
    </div>
  )
}
