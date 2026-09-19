import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { generateSyncToken, hashSyncToken } from '@/lib/syncToken'

export async function GET(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { syncToken: true },
    })

    return NextResponse.json({
      hasSyncToken: !!user?.syncToken,
    })
  } catch (error) {
    console.error('Failed to get sync token status:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const rawToken = generateSyncToken()
    const hashed = hashSyncToken(rawToken)

    await prisma.user.update({
      where: { id: userId },
      data: { syncToken: hashed },
    })

    return NextResponse.json({
      success: true,
      syncToken: rawToken,
      message: 'New sync token generated. Store it securely; it will not be shown again.',
    })
  } catch (error) {
    console.error('Failed to generate sync token:', error)
    return NextResponse.json({ error: 'Failed to generate sync token' }, { status: 500 })
  }
}
