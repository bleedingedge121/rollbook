import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  hashPassword,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

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

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    // Determine initial role:
    // If username is 'admin', or in process.env.ADMIN_USERNAMES, or first registered user -> 'admin'
    const adminList = (process.env.ADMIN_USERNAMES || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const userCount = await prisma.user.count()
    const shouldBeAdmin =
      normalizedUsername === 'admin' ||
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
    } else if (rawMessage) {
      const firstLine = rawMessage.split('\n')[0] || rawMessage
      userMessage = `Signup failed: ${firstLine.slice(0, 150)}`
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    )
  }
}
