'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Navigation, TabType } from '@/components/Navigation'
import { HomeView } from '@/components/HomeView'
import { SubjectsView } from '@/components/SubjectsView'
import { CalendarView } from '@/components/CalendarView'
import { SettingsView } from '@/components/SettingsView'
import { CourseModal } from '@/components/CourseModal'
import { Course, CourseWithStats, TimetableSlot, AttendanceRecord } from '@/types'
import { calculateAttendance } from '@/lib/attendance'
import { Loader2 } from 'lucide-react'
import { OnboardingWizard } from '@/components/OnboardingWizard'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home')
  const [courses, setCourses] = useState<CourseWithStats[]>([])
  const [allSlots, setAllSlots] = useState<TimetableSlot[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  // Quick Add / Edit Subject Modal State from Subjects View
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<CourseWithStats | null>(null)

  // Fetch all core data
  const fetchData = useCallback(async () => {
    try {
      const [coursesRes, slotsRes, attendanceRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/timetable'),
        fetch('/api/attendance'),
      ])

      const [rawCourses, rawSlots, rawAttendance] = await Promise.all([
        coursesRes.json(),
        slotsRes.json(),
        attendanceRes.json(),
      ])

      if (Array.isArray(rawCourses) && Array.isArray(rawAttendance)) {
        const enrichedCourses: CourseWithStats[] = rawCourses.map((c: any) => {
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

  // Calculate top-level stats for navigation
  let totalPresent = 0
  let totalAbsent = 0
  courses.forEach((c) => {
    totalPresent += c.stats.present
    totalAbsent += c.stats.absent
  })
  const totalHeld = totalPresent + totalAbsent
  const overallPct = totalHeld > 0 ? Number(((totalPresent / totalHeld) * 100).toFixed(1)) : 100
  const isSafe = overallPct >= 75

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 animate-pulse">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
        <div className="space-y-2 w-full max-w-xs px-4">
          <p className="text-sm font-semibold text-slate-400 text-center mb-4">Loading Roll Book...</p>
          <div className="h-3 rounded-full bg-slate-800/80 animate-pulse" />
          <div className="h-3 rounded-full bg-slate-800/60 animate-pulse w-4/5 mx-auto" />
          <div className="h-3 rounded-full bg-slate-800/40 animate-pulse w-3/5 mx-auto" />
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
    <div className="min-h-screen bg-[#0b0f17] flex flex-col">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && (
          <HomeView
            courses={courses}
            allSlots={allSlots}
            allAttendance={allAttendance}
            onLogAttendance={handleLogAttendance}
            onDeleteAttendance={handleDeleteAttendance}
            onBatchLogAttendance={handleBatchLogAttendance}
            onClearDateAttendance={handleClearDateAttendance}
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
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            courses={courses}
            allSlots={allSlots}
            allAttendance={allAttendance}
            onLogAttendance={handleLogAttendance}
            onDeleteAttendance={handleDeleteAttendance}
            onBatchLogAttendance={handleBatchLogAttendance}
            onClearDateAttendance={handleClearDateAttendance}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            courses={courses}
            slots={allSlots}
            onSaveCourse={handleSaveCourse}
            onDeleteCourse={handleDeleteCourse}
            onSaveSlot={handleSaveSlot}
            onDeleteSlot={handleDeleteSlot}
            onRefreshAll={fetchData}
          />
        )}
      </main>

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
