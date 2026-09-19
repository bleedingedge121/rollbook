import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        chatRequestCount: true,
        chatRequestDate: true,
        courses: {
          select: {
            id: true,
            name: true,
            code: true,
            syncedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = users.map((u) => {
      // Find latest sync timestamp across user courses
      const syncDates = u.courses
        .map((c) => c.syncedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())

      const lastSyncedAt = syncDates.length > 0 ? syncDates[0] : null

      return {
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        courseCount: u.courses.length,
        courses: u.courses.map((c) => ({ id: c.id, code: c.code, name: c.name })),
        lastSyncedAt,
        chatRequestCount: u.chatRequestCount,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to list users:', error)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }
}
