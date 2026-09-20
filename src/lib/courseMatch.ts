// Shared fuzzy course-matching helpers.
// Used by /api/sync/reconcile (matching SLCM-scraped courses to existing ones)
// and /api/sections/apply (matching the official timetable's courses to existing ones),
// so a course entered by hand, synced from SLCM, or imported from the official
// timetable under slightly different wording all converge on one Course row
// instead of creating duplicates.

export function isLabCourse(name?: string, code?: string): boolean {
  const text = `${name || ''} ${code || ''}`.toLowerCase()
  return /\b(lab|laboratory|bwp\s*lab|practical)\b/i.test(text)
}

export function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[_\-.:,()/]/g, ' ')
    .replace(/\blaboratory\b/g, 'lab')
    .replace(/\b(and|the|of|for|in|to|with|using|basic|fundamentals|introduction|department)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCode(code: string): string {
  if (!code) return ''
  return code.toUpperCase().replace(/[\s_\-]/g, '').trim()
}

export function calculateSimilarity(str1: string, str2: string): number {
  // A lab course and a non-lab (theory) course must NEVER match by name similarity
  if (isLabCourse(str1) !== isLabCourse(str2)) {
    return 0.0
  }

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

export interface MatchableCourse {
  id: string
  name: string
  code: string
}

// Finds the best existing course match for an incoming (name, code) pair.
// Tries exact normalized-code match first (handles "EES 1004" vs "EES_1004" vs "EES1004"),
// then falls back to name similarity above a confidence threshold (strictly keeping lab vs theory separated).
export function findBestMatch(
  incomingName: string,
  incomingCode: string,
  existing: MatchableCourse[]
): { course: MatchableCourse; confidence: number; matchType: 'exact' | 'suggested' } | null {
  const incomingCodeNorm = normalizeCode(incomingCode)

  if (incomingCodeNorm) {
    for (const c of existing) {
      if (normalizeCode(c.code) === incomingCodeNorm) {
        return { course: c, confidence: 1.0, matchType: 'exact' }
      }
    }
  }

  const incomingIsLab = isLabCourse(incomingName, incomingCode)

  let best: { course: MatchableCourse; confidence: number } | null = null
  for (const c of existing) {
    // Strictly isolate practical lab subjects from classroom theory subjects
    if (incomingIsLab !== isLabCourse(c.name, c.code)) {
      continue
    }

    const sim = calculateSimilarity(incomingName, c.name)
    if (sim > (best?.confidence ?? 0)) {
      best = { course: c, confidence: sim }
    }
  }

  if (best && best.confidence >= 0.5) {
    return { course: best.course, confidence: best.confidence, matchType: 'suggested' }
  }

  return null
}
