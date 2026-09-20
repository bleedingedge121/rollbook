import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSyncToken } from '@/lib/syncToken'
import { autoApplySync, SyncedCourse } from '@/lib/reconcile'

/**
 * Architectural Note on Security Boundaries (Medium 5):
 * 
 * 1. Primary Boundary: The 192-bit cryptographic Bearer sync token (`hashSyncToken`)
 *    is the authoritative security boundary. Unlike cookies, Bearer tokens are NEVER
 *    automatically attached by browsers during cross-site requests. Any caller mutating
 *    attendance data must explicitly provide the user's secret sync token.
 *
 * 2. Defense-in-Depth: Restricting CORS from wildcard '*' prevents malicious third-party
 *    websites from triggering cross-origin requests and probing responses from an end-user's
 *    browser. Cross-origin access is restricted to:
 *    - The RollBook application origin (configured via APP_PUBLIC_URL / AGENT_ALLOWED_ORIGIN)
 *    - Development environments (localhost / 127.0.0.1)
 *    - University portal domains where the RollBook bookmarklet runs (manipal.edu, force.com, salesforce.com)
 *
 * 3. Non-browser clients: CLI agents (e.g. agent.js) and curl send requests without an
 *    Origin header; they authenticate directly via the Bearer token without CORS constraints.
 */

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false

  const cleanOrigin = origin.trim().replace(/\/$/, '')

  // 1. Explicitly configured application origins
  const envOrigins = [
    process.env.APP_PUBLIC_URL,
    process.env.AGENT_ALLOWED_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .filter(Boolean)
    .map((o) => o!.trim().replace(/\/$/, ''))

  if (envOrigins.includes(cleanOrigin)) {
    return true
  }

  // 2. Local development origins
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
      return true
    }
  }

  // 3. Trusted educational / SLCM portal domains where the bookmarklet runs
  try {
    const url = new URL(cleanOrigin)
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      return false
    }

    const host = url.hostname.toLowerCase()
    return (
      host === 'manipal.edu' ||
      host.endsWith('.manipal.edu') ||
      host === 'force.com' ||
      host.endsWith('.force.com') ||
      host === 'salesforce.com' ||
      host.endsWith('.salesforce.com') ||
      host === 'site.com' ||
      host.endsWith('.site.com')
    )
  } catch {
    return false
  }
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  }

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin')
  if (origin && !isAllowedOrigin(origin)) {
    return new NextResponse('Disallowed cross-origin request', {
      status: 403,
      headers: { Vary: 'Origin' },
    })
  }

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  })
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: 'Forbidden: Disallowed cross-origin request.' },
      { status: 403, headers: { Vary: 'Origin' } }
    )
  }

  const corsHeaders = getCorsHeaders(req)
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
