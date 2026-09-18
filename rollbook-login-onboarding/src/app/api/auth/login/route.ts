import { NextResponse } from 'next/server'
import { checkCredentials, createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    if (!checkCredentials(username, password)) {
      return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 })
    }

    const token = await createSessionToken(username)
    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })
    return res
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
