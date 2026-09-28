import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const existing = await prisma.holiday.findUnique({
      where: { id },
    })

    if (existing) {
      await prisma.holiday.delete({
        where: { id },
      })
      return NextResponse.json({ success: true })
    }

    // If id contains a date or is a synthetic ID (e.g. official-0-2026-09-20)
    const dateMatch = id.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      const result = await prisma.holiday.deleteMany({
        where: { date: dateMatch[1] },
      })
      return NextResponse.json({ success: true, count: result.count })
    }

    return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
  } catch (error: any) {
    console.error('Failed to delete holiday:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete holiday' }, { status: 500 })
  }
}

