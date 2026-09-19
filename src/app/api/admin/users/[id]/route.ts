import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        chatRequestCount: true,
        chatRequestDate: true,
        courses: {
          include: {
            timetableSlots: true,
            attendance: {
              orderBy: { date: 'desc' },
              take: 20,
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to inspect user:', error)
    return NextResponse.json({ error: 'Failed to inspect user' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    if (auth.userId === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own admin account while logged in.' },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Cascade delete user and all their courses, slots, attendance records
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `User "${targetUser.username}" and all associated data have been permanently deleted.`,
    })
  } catch (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
