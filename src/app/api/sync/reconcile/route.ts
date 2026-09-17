import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface SyncedCourse {
  name: string
  code: string
  present: number
  absent: number
}

interface CourseMergeSelection {
  incomingCode: string
  incomingName: string
  present: number
  absent: number
  targetCourseId: string | 'NEW' | 'SKIP' // Existing ID, 'NEW' to create, or 'SKIP'
}

interface ReconcileRequest {
  courses: SyncedCourse[]
  syncedAt?: string
  apply?: boolean
  merges?: CourseMergeSelection[]
}

function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[_\-.:,()/]/g, ' ')
    .replace(/\b(and|the|of|for|in|to|with|using|basic|fundamentals|introduction|practice|lab|department)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeText(str1)
  const norm2 = normalizeText(str2)
  if (norm1 === norm2) return 1.0
  if (!norm1 || !norm2) return 0.0

  const words1 = new Set(norm1.split(' ').filter(Boolean))
  const words2 = new Set(norm2.split(' ').filter(Boolean))

  if (words1.size === 0 || words2.size === 0) return 0.0

  let overlap = 0
  Array.from(words1).forEach((w) => {
    if (words2.has(w)) overlap++
  })

  const allWords = new Set([...Array.from(words1), ...Array.from(words2)])
  const union = allWords.size
  return union > 0 ? overlap / union : 0
}

export async function POST(req: Request) {
  try {
    const body: ReconcileRequest = await req.json()
    const { courses: incomingCourses, syncedAt, apply, merges } = body

    if (!Array.isArray(incomingCourses)) {
      return NextResponse.json(
        { error: 'Invalid payload: "courses" array is required' },
        { status: 400 }
      )
    }

    const dbCourses = await prisma.course.findMany({
      include: {
        attendance: true,
      },
    })

    // If apply is requested, execute updates cleanly without fabricating AttendanceRecords
    if (apply && Array.isArray(merges)) {
      const appliedCourseNames: string[] = []
      const syncDate = syncedAt ? new Date(syncedAt) : new Date()

      for (const merge of merges) {
        if (merge.targetCourseId === 'SKIP') continue

        if (merge.targetCourseId === 'NEW') {
          // Create new course with verified baseline
          const newCourse = await prisma.course.create({
            data: {
              name: merge.incomingName,
              code: (merge.incomingCode || merge.incomingName.slice(0, 6)).toUpperCase().trim(),
              requiredPercent: 75.0,
              syncedPresent: Math.max(0, merge.present || 0),
              syncedAbsent: Math.max(0, merge.absent || 0),
              syncedAt: syncDate,
            },
          })
          appliedCourseNames.push(newCourse.name)
        } else {
          // Update existing course baseline
          const existing = dbCourses.find((c) => c.id === merge.targetCourseId)
          if (existing) {
            await prisma.course.update({
              where: { id: existing.id },
              data: {
                syncedPresent: Math.max(0, merge.present || 0),
                syncedAbsent: Math.max(0, merge.absent || 0),
                syncedAt: syncDate,
              },
            })

            // Clean up any legacy fabricated sync records from older builds
            await prisma.attendanceRecord.deleteMany({
              where: {
                courseId: existing.id,
                note: { contains: 'Synced from SLCM' },
              },
            })

            appliedCourseNames.push(existing.name)
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully synchronized ${appliedCourseNames.length} subject(s).`,
        applied: appliedCourseNames,
      })
    }

    // Build diff preview with fuzzy matching & merge candidates
    const diff = incomingCourses.map((inc) => {
      const codeUpper = (inc.code || '').toUpperCase().trim()
      const codeDigits = codeUpper.replace(/\D/g, '')

      let bestMatch: (typeof dbCourses)[0] | null = null
      let matchType: 'exact' | 'suggested' | 'none' = 'none'
      let bestConfidence = 0

      // Step 1: Check exact code match
      const exactCodeMatch = dbCourses.find(
        (c) => c.code.toUpperCase().trim() === codeUpper
      )
      if (exactCodeMatch) {
        bestMatch = exactCodeMatch
        matchType = 'exact'
        bestConfidence = 1.0
      }

      // Step 2: Check exact normalized name match
      if (!bestMatch) {
        const normIncName = normalizeText(inc.name)
        const exactNameMatch = dbCourses.find(
          (c) => normalizeText(c.name) === normIncName
        )
        if (exactNameMatch) {
          bestMatch = exactNameMatch
          matchType = 'exact'
          bestConfidence = 0.95
        }
      }

      // Step 3: Check numeric code match (e.g. 1001 in PHY1001 vs PHY_1001)
      if (!bestMatch && codeDigits.length >= 3) {
        const numMatch = dbCourses.find(
          (c) => c.code.replace(/\D/g, '') === codeDigits
        )
        if (numMatch) {
          bestMatch = numMatch
          matchType = 'suggested'
          bestConfidence = 0.85
        }
      }

      // Step 4: Fuzzy name similarity ranking
      const candidates = dbCourses
        .map((c) => ({
          course: c,
          similarity: calculateSimilarity(inc.name, c.name),
        }))
        .filter((item) => item.similarity >= 0.3)
        .sort((a, b) => b.similarity - a.similarity)

      if (!bestMatch && candidates.length > 0) {
        bestMatch = candidates[0].course
        matchType = 'suggested'
        bestConfidence = candidates[0].similarity
      }

      const present = Math.max(0, inc.present || 0)
      const absent = Math.max(0, inc.absent || 0)
      const total = present + absent
      const syncedPct = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100

      // Compute current statistics for the matched course
      let currentPresent = 0
      let currentAbsent = 0
      let currentTotal = 0
      let currentPct = 100

      if (bestMatch) {
        // Only count manual records that are not old fabricated sync notes
        const manualRecords = bestMatch.attendance.filter(
          (a) => !a.note?.includes('Synced from SLCM')
        )
        const manualPresent = manualRecords.filter((a) => a.status === 'present').length
        const manualAbsent = manualRecords.filter((a) => a.status === 'absent').length

        currentPresent = (bestMatch.syncedPresent || 0) + manualPresent
        currentAbsent = (bestMatch.syncedAbsent || 0) + manualAbsent
        currentTotal = currentPresent + currentAbsent
        currentPct = currentTotal > 0 ? Number(((currentPresent / currentTotal) * 100).toFixed(1)) : 100
      }

      const hasDiff =
        !bestMatch ||
        currentPresent !== present ||
        currentAbsent !== absent

      return {
        matchType,
        matchedCourseId: bestMatch?.id || null,
        confidence: bestConfidence,
        syncedName: inc.name,
        syncedCode: inc.code,
        synced: {
          present,
          absent,
          total,
          pct: syncedPct,
        },
        current: {
          present: currentPresent,
          absent: currentAbsent,
          total: currentTotal,
          pct: currentPct,
        },
        hasDiff,
      }
    })

    return NextResponse.json({
      syncedAt: syncedAt || new Date().toISOString(),
      totalIncoming: incomingCourses.length,
      diff,
      availableDbCourses: dbCourses.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })),
    })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile sync data' },
      { status: 500 }
    )
  }
}
