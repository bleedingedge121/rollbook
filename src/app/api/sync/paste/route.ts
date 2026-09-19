import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/session'
import { autoApplySync, SyncedCourse } from '@/lib/reconcile'

// Fallback for the sync bookmarklet: used only when the bookmarklet's own
// cross-origin push to /api/sync/push is blocked by the SLCM site's
// Content-Security-Policy. In that case the bookmarklet shows the captured
// JSON for the user to copy, and this route accepts it pasted back in on
// this page instead — authenticated by the normal logged-in session
// (unlike /api/sync/push, which is for the unauthenticated bookmarklet/agent
// context and uses a bearer sync token instead).
export async function POST(req: Request) {
  const session = await requireUser(req)
  if (session instanceof NextResponse) return session

  try {
    const body = await req.json()
    const { courses, syncedAt } = body

    if (!Array.isArray(courses)) {
      return NextResponse.json({ error: 'Invalid payload: "courses" array is required' }, { status: 400 })
    }

    const result = await autoApplySync(session.userId, courses as SyncedCourse[], syncedAt)

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} course(s).`,
      count: result.count,
      applied: result.applied,
      syncedAt: result.syncedAt,
    })
  } catch (error) {
    console.error('Failed to process pasted sync data:', error)
    return NextResponse.json({ error: 'Failed to apply pasted attendance data — check the JSON is valid' }, { status: 500 })
  }
}
