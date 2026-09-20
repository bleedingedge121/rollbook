import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  hashPassword,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: Request) {
  try {
    // High 3 & High 4: Rate limit signups per IP (10 signups per hour)
    // This mitigates brute-force account creation and prevents automated username enumeration.
    const clientIp = getClientIp(req)
    const rateCheck = checkRateLimit('signup', clientIp, 10, 60 * 60 * 1000)
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: `Too many signup attempts from this IP. Please try again in ${rateCheck.resetInSeconds} seconds.`,
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

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    const normalizedUsername = username.trim().toLowerCase()

    if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 30 characters' },
        { status: 400 }
      )
    }

    if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    // Note on Username Enumeration (High 4):
    // Returning 409 "Username is already taken" is standard and essential UX so legitimate users know
    // to choose another username. To prevent automated bulk username enumeration and stalking attacks,
    // this endpoint is protected by the strict per-IP rate limiter above (10 attempts/hour).
    // In addition, login failures return a uniform generic error ("Incorrect username or password")
    // so existence cannot be cross-confirmed via authentication attempts.
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    // Critical 2 Fix: Admin status must NEVER be granted merely by signing up with
    // the literal username "admin". Admin status is ONLY granted if:
    // (a) userCount === 0 (the first registered account, for initial system bootstrapping)
    // (b) the username is explicitly listed in process.env.ADMIN_USERNAMES.
    const adminList = (process.env.ADMIN_USERNAMES || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const userCount = await prisma.user.count()
    const shouldBeAdmin =
      adminList.includes(normalizedUsername) ||
      userCount === 0

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        passwordHash,
        role: shouldBeAdmin ? 'admin' : 'user',
      },
    })

    const token = await createSessionToken(user.id, user.username)
    const res = NextResponse.json(
      {
        success: true,
        user: { id: user.id, username: user.username, role: user.role },
      },
      { status: 201 }
    )

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
    console.error('Signup error:', error)
    const rawMessage = error?.message || ''
    let userMessage = 'Failed to create account. Please try again.'

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

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    )
  }
}
