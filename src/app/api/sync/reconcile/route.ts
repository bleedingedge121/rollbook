import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/session'
import {
  SyncedCourse,
  CourseMergeSelection,
  buildReconcileDiff,
  applyExplicitMerges,
} from '@/lib/reconcile'

interface ReconcileRequest {
  courses: SyncedCourse[]
  syncedAt?: string
  apply?: boolean
  merges?: CourseMergeSelection[]
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const body: ReconcileRequest = await req.json()
    const { courses: incomingCourses, syncedAt, apply, merges } = body

    if (!Array.isArray(incomingCourses)) {
      return NextResponse.json(
        { error: 'Invalid payload: "courses" array is required' },
        { status: 400 }
      )
    }

    if (apply && Array.isArray(merges)) {
      const result = await applyExplicitMerges(userId, merges, syncedAt)
      return NextResponse.json(result)
    }

    const { diff, availableDbCourses } = await buildReconcileDiff(userId, incomingCourses)

    return NextResponse.json({
      syncedAt: syncedAt || new Date().toISOString(),
      totalIncoming: incomingCourses.length,
      diff,
      availableDbCourses,
    })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile sync data' },
      { status: 500 }
    )
  }
}
