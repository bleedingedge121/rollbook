import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)

  return NextResponse.json({
    authenticated: Boolean(user),
    username: user ? user.username : null,
    userId: user ? user.userId : null,
  })
}
