import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE_NAME, usingDefaultCredentials, getConfiguredUsername } from '@/lib/auth'

export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value
  const authed = await verifySessionToken(token)
  return NextResponse.json({
    authenticated: authed,
    usingDefaultCredentials: usingDefaultCredentials(),
    username: authed ? getConfiguredUsername() : null,
  })
}
