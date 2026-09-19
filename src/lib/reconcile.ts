import { prisma } from '@/lib/prisma'
import { normalizeText, calculateSimilarity } from '@/lib/courseMatch'

export interface SyncedCourse {
  name: string
  code: string
  present: number
  absent: number
}

export interface CourseMergeSelection {
  incomingCode: string
  incomingName: string
  present: number
  absent: number
  targetCourseId: string | 'NEW' | 'SKIP'
}

/**
 * Parses copied plain-text attendance tables (from mobile or desktop browser screens)
 * into structured SyncedCourse records.
 */
export function parsePastedTableText(text: string): SyncedCourse[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const results: SyncedCourse[] = []

  for (const line of lines) {
    if (/course\s*name|classes\s*attended|sl\s*no|subject\s*title|attendance\s*percentage/i.test(line)) continue

    const cleanLine = line.replace(/\b\d+(\.\d+)?%/g, '')
    const numMatches = cleanLine.match(/\b\d+\b/g)
    if (!numMatches || numMatches.length < 2) continue

    const nums = numMatches.map(Number)
    let present = 0
    let absent = 0

    const last = nums[nums.length - 1]
    const secondLast = nums[nums.length - 2]

    if (secondLast <= last && last <= 250) {
      present = secondLast
      absent = last - secondLast
    } else {
      present = secondLast
      absent = last
    }

    const codeMatch = line.match(/\b([A-Z]{2,5}[_-]?\d{3,4}[A-Z]?)\b/i)
    const code = codeMatch ? codeMatch[1].toUpperCase() : ''

    let name = cleanLine
      .replace(/\b\d+\b/g, '')
      .replace(/[|\t–—]/g, ' ')
      .trim()

    if (code) {
      name = name.replace(new RegExp(`\\b${code}\\b`, 'gi'), '').trim()
    }
    name = name.replace(/\s+/g, ' ').replace(/^[-_:,.\s]+|[-_:,.\s]+$/g, '').trim()

    if (name.length >= 3) {
      results.push({ name, code, present, absent })
    }
  }

  return results
}

/**
 * Automatically applies an incoming course array directly to the user's courses,
 * matching existing courses by code or fuzzy name, or creating new ones.
 * Updates both synced baseline counts and simple counter counts.
 */
export async function autoApplySync(
  userId: string,
  incomingCourses: SyncedCourse[],
  syncedAt?: string
) {
  const syncDate = syncedAt ? new Date(syncedAt) : new Date()
  const dbCourses = await prisma.course.findMany({
    where: { userId },
    include: { attendance: true },
  })

  const appliedCourseNames: string[] = []

  for (const inc of incomingCourses) {
    const codeUpper = (inc.code || '').toUpperCase().trim()
    const codeDigits = codeUpper.replace(/\D/g, '')

    let match = dbCourses.find((c) => c.code.toUpperCase().trim() === codeUpper)

    if (!match) {
      const normIncName = normalizeText(inc.name)
      match = dbCourses.find((c) => normalizeText(c.name) === normIncName)
    }

    if (!match && codeDigits.length >= 3) {
      match = dbCourses.find((c) => c.code.replace(/\D/g, '') === codeDigits)
    }

    if (!match) {
      const candidates = dbCourses
        .map((c) => ({
          course: c,
          similarity: calculateSimilarity(inc.name, c.name),
        }))
        .filter((item) => item.similarity >= 0.7)
        .sort((a, b) => b.similarity - a.similarity)

      if (candidates.length > 0) {
        match = candidates[0].course
      }
    }

    const present = Math.max(0, inc.present || 0)
    const absent = Math.max(0, inc.absent || 0)
    const held = present + absent

    if (match) {
      await prisma.course.update({
        where: { id: match.id },
        data: {
          syncedPresent: present,
          syncedAbsent: absent,
          simpleAttended: present,
          simpleHeld: held,
          syncedAt: syncDate,
        },
      })

      // Clean up any legacy fabricated sync records from older builds
      await prisma.attendanceRecord.deleteMany({
        where: {
          courseId: match.id,
          note: { contains: 'Synced from SLCM' },
        },
      })

      appliedCourseNames.push(match.name)
    } else {
      const newCourse = await prisma.course.create({
        data: {
          userId,
          name: inc.name,
          code: (inc.code || inc.name.slice(0, 6)).toUpperCase().trim(),
          requiredPercent: 75.0,
          syncedPresent: present,
          syncedAbsent: absent,
          simpleAttended: present,
          simpleHeld: held,
          syncedAt: syncDate,
        },
      })
      appliedCourseNames.push(newCourse.name)
    }
  }

  return {
    success: true,
    count: appliedCourseNames.length,
    applied: appliedCourseNames,
    syncedAt: syncDate.toISOString(),
  }
}

/**
 * Builds diff between incoming portal courses and user's current DB courses.
 */
export async function buildReconcileDiff(
  userId: string,
  incomingCourses: SyncedCourse[]
) {
  const dbCourses = await prisma.course.findMany({
    where: { userId },
    include: { attendance: true },
  })

  const diff = incomingCourses.map((inc) => {
    const codeUpper = (inc.code || '').toUpperCase().trim()
    const codeDigits = codeUpper.replace(/\D/g, '')

    let bestMatch: (typeof dbCourses)[0] | null = null
    let matchType: 'exact' | 'suggested' | 'none' = 'none'
    let bestConfidence = 0

    const exactCodeMatch = dbCourses.find(
      (c) => c.code.toUpperCase().trim() === codeUpper
    )
    if (exactCodeMatch) {
      bestMatch = exactCodeMatch
      matchType = 'exact'
      bestConfidence = 1.0
    }

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

    let currentPresent = 0
    let currentAbsent = 0
    let currentTotal = 0
    let currentPct = 100

    if (bestMatch) {
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

  return {
    diff,
    availableDbCourses: dbCourses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
    })),
  }
}

/**
 * Applies explicit user merge decisions from the SyncModal.
 */
export async function applyExplicitMerges(
  userId: string,
  merges: CourseMergeSelection[],
  syncedAt?: string
) {
  const syncDate = syncedAt ? new Date(syncedAt) : new Date()
  const dbCourses = await prisma.course.findMany({
    where: { userId },
  })

  const appliedCourseNames: string[] = []

  for (const merge of merges) {
    if (merge.targetCourseId === 'SKIP') continue

    const present = Math.max(0, merge.present || 0)
    const absent = Math.max(0, merge.absent || 0)
    const held = present + absent

    if (merge.targetCourseId === 'NEW') {
      const newCourse = await prisma.course.create({
        data: {
          userId,
          name: merge.incomingName,
          code: (merge.incomingCode || merge.incomingName.slice(0, 6)).toUpperCase().trim(),
          requiredPercent: 75.0,
          syncedPresent: present,
          syncedAbsent: absent,
          simpleAttended: present,
          simpleHeld: held,
          syncedAt: syncDate,
        },
      })
      appliedCourseNames.push(newCourse.name)
    } else {
      const existing = dbCourses.find((c) => c.id === merge.targetCourseId)
      if (existing) {
        await prisma.course.update({
          where: { id: existing.id },
          data: {
            syncedPresent: present,
            syncedAbsent: absent,
            simpleAttended: present,
            simpleHeld: held,
            syncedAt: syncDate,
          },
        })

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

  return {
    success: true,
    message: `Successfully synchronized ${appliedCourseNames.length} subject(s).`,
    applied: appliedCourseNames,
  }
}
