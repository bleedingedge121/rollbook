import { AttendanceStats } from '@/lib/attendance'

export interface Course {
  id: string
  name: string
  code: string
  requiredPercent: number
  color: string
  timetableSlots?: TimetableSlot[]
  attendance?: AttendanceRecord[]
  createdAt?: string
  updatedAt?: string
}

export interface TimetableSlot {
  id: string
  courseId: string
  course?: Course
  weekday: number // 0-6
  label: string
  room?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface AttendanceRecord {
  id: string
  courseId: string
  course?: Course
  date: string // YYYY-MM-DD
  status: 'present' | 'absent'
  note?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CourseWithStats extends Course {
  stats: AttendanceStats
  history: AttendanceRecord[]
}

export type PlanStatus = 'attend' | 'skip' | 'neutral'

export interface PlannedSlot {
  key: string // `${date}-${slotId}`
  date: string
  slotId: string
  courseId: string
  plan: 'attend' | 'skip'
}
