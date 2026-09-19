import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSyncToken } from '@/lib/syncToken'
import { autoApplySync, SyncedCourse } from '@/lib/reconcile'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid Authorization header. Expected Bearer <syncToken>.' },
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.slice(7).trim()
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Empty sync token provided.' },
        { status: 401, headers: corsHeaders }
      )
    }

    const hashedToken = hashSyncToken(token)
    const user = await prisma.user.findFirst({
      where: { syncToken: hashedToken },
      select: { id: true, username: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid sync token. Please generate a new token in Settings.' },
        { status: 401, headers: corsHeaders }
      )
    }

    const body = await req.json()
    const { courses, syncedAt } = body

    if (!Array.isArray(courses)) {
      return NextResponse.json(
        { error: 'Invalid payload: "courses" array is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const result = await autoApplySync(user.id, courses as SyncedCourse[], syncedAt)

    return NextResponse.json(
      {
        success: true,
        message: `Successfully updated ${result.count} course(s) for user "${user.username}".`,
        count: result.count,
        applied: result.applied,
        syncedAt: result.syncedAt,
      },
      { status: 200, headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to process sync push:', error)
    return NextResponse.json(
      { error: 'Failed to apply pushed attendance data' },
      { status: 500, headers: corsHeaders }
    )
  }
}
