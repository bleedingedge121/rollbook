import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete all courses for this user (timetable slots and attendance records cascade automatically)
    const deleteResult = await prisma.course.deleteMany({
      where: { userId: id },
    })

    // Reset chat usage quota
    await prisma.user.update({
      where: { id },
      data: {
        chatRequestCount: 0,
        chatRequestDate: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Reset complete for user "${targetUser.username}". Removed ${deleteResult.count} courses and reset AI chat quota.`,
      coursesRemoved: deleteResult.count,
    })
  } catch (error) {
    console.error('Failed to reset user data:', error)
    return NextResponse.json({ error: 'Failed to reset user data' }, { status: 500 })
  }
}
