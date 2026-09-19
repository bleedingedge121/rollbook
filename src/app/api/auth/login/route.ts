import { NextResponse } from 'next/server'
import {
  checkCredentials,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    const user = await checkCredentials(username, password)
    if (!user) {
      return NextResponse.json(
        { error: 'Incorrect username or password' },
        { status: 401 }
      )
    }

    const token = await createSessionToken(user.id, user.username)
    const res = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    })

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })

    return res
  } catch (error: any) {
    console.error('Login error:', error)
    const rawMessage = error?.message || ''
    let userMessage = 'Login failed. Please try again.'

    if (
      rawMessage.includes('column') ||
      rawMessage.includes('does not exist') ||
      rawMessage.includes('relation') ||
      error?.code === 'P2022' ||
      error?.code === 'P2021'
    ) {
      userMessage = 'Database schema is out of date. Please run "npx prisma db push" or redeploy on Vercel to sync schema.'
    } else if (
      rawMessage.includes('connect') ||
      rawMessage.includes("Can't reach database") ||
      rawMessage.includes('ETIMEDOUT') ||
      rawMessage.includes('ECONNREFUSED') ||
      error?.code === 'P1001'
    ) {
      userMessage = 'Cannot connect to database. Please check DATABASE_URL in your environment settings.'
    } else if (rawMessage) {
      const firstLine = rawMessage.split('\n')[0] || rawMessage
      userMessage = `Login failed: ${firstLine.slice(0, 150)}`
    }

    return NextResponse.json({ error: userMessage }, { status: 500 })
  }
}
