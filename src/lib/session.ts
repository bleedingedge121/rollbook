import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface SessionUser {
  userId: string
  username: string
  role?: string
}

/**
 * Extracts and validates the authenticated user from request cookies.
 * Returns the SessionUser object if valid, or a 401 NextResponse if missing or invalid.
 */
export async function requireUser(
  req?: Request
): Promise<SessionUser | NextResponse> {
  let token: string | undefined

  // First try extracting from next/headers cookies()
  try {
    const cookieStore = await cookies()
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  } catch {
    // If running in a context where next/headers cookies() isn't available, check request header
    if (req) {
      const cookieHeader = req.headers.get('cookie') || ''
      const match = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      if (match) {
        token = match.substring(SESSION_COOKIE_NAME.length + 1)
      }
    }
  }

  // Fallback to direct header check if token not found yet
  if (!token && req) {
    const cookieHeader = req.headers.get('cookie') || ''
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
    if (match) {
      token = match.substring(SESSION_COOKIE_NAME.length + 1)
    }
  }

  const user = await getSessionUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return user
}

/**
 * Verifies that a course exists and belongs to the specified user.
 * Returns true if valid, false if not found or belongs to another user.
 */
export async function verifyCourseOwnership(
  courseId: string,
  userId: string
): Promise<boolean> {
  if (!courseId || !userId) return false
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: { id: true },
  })
  return Boolean(course)
}

/**
 * Validates that the request comes from an authenticated user with 'admin' role.
 * Returns { userId, username, role } if valid, or a 401/403 NextResponse if unauthorized/forbidden.
 */
export async function requireAdmin(
  req?: Request
): Promise<{ userId: string; username: string; role: string } | NextResponse> {
  const sessionUserOrResponse = await requireUser(req)
  if (sessionUserOrResponse instanceof NextResponse) {
    return sessionUserOrResponse
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUserOrResponse.userId },
    select: { id: true, username: true, role: true },
  })

  if (!dbUser || dbUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  return {
    userId: dbUser.id,
    username: dbUser.username,
    role: dbUser.role,
  }
}

