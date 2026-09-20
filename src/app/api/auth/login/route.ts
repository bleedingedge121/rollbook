import { NextResponse } from 'next/server'
import {
  checkCredentials,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: Request) {
  try {
    // High 3: Rate limit login attempts per IP (5 attempts per 15 minutes)
    // Prevents automated password guessing and credential stuffing.
    const clientIp = getClientIp(req)
    const rateCheck = checkRateLimit('login', clientIp, 5, 15 * 60 * 1000)
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${rateCheck.resetInSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.resetInSeconds),
          },
        }
      )
    }

    const { username, password } = await req.json()

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          error:
            'DATABASE_URL environment variable is missing on Vercel. Please add DATABASE_URL in Vercel Project Settings -> Environment Variables and redeploy.',
        },
        { status: 500 }
      )
    }

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
    // Medium 6: Log full error server-side, but never leak raw internal database errors to client
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
    }

    return NextResponse.json({ error: userMessage }, { status: 500 })
  }
}
