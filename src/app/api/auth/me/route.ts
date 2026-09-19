import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)

  let role: string | null = null
  if (user) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true },
      })
      role = dbUser?.role || 'user'
    } catch {
      role = 'user'
    }
  }

  return NextResponse.json({
    authenticated: Boolean(user),
    username: user ? user.username : null,
    userId: user ? user.userId : null,
    role,
  })
}

