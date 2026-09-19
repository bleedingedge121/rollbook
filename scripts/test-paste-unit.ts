import { autoApplySync, SyncedCourse } from '../src/lib/reconcile'
import { POST as pasteRoute } from '../src/app/api/sync/paste/route'
import { prisma } from '../src/lib/prisma'
import { createSessionToken } from '../src/lib/auth'

async function run() {
  console.log('Testing /api/sync/paste route and reconcile logic unit tests...\n')

  let passed = 0
  let failed = 0
  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${msg}`)
      failed++
    }
  }

  // Create real valid signed session token
  const validSessionToken = await createSessionToken('user_123', 'testuser')

  // 1. Test POST /api/sync/paste unauthorized without session cookie
  const unauthReq = new Request('http://localhost:3000/api/sync/paste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courses: [] }),
  })
  const unauthRes = await pasteRoute(unauthReq)
  assert(unauthRes.status === 401, 'Rejects unauthenticated requests with 401')

  // 2. Test POST /api/sync/paste validation (missing courses array)
  const badReq = new Request('http://localhost:3000/api/sync/paste', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `rollbook_session=${validSessionToken}`,
    },
    body: JSON.stringify({ courses: 'not-an-array' }),
  })
  const badRes = await pasteRoute(badReq)
  assert(badRes.status === 400, 'Rejects invalid non-array courses payload with 400')
  const badJson = await badRes.json()
  assert(badJson.error.includes('"courses" array is required'), 'Returns descriptive error message for bad payload')

  // 3. Mock prisma methods for autoApplySync
  const mockDbCourses: any[] = [
    {
      id: 'c_existing',
      userId: 'user_123',
      code: 'MAT101',
      name: 'Calculus and Linear Algebra',
      requiredPercent: 75,
      syncedPresent: 8,
      syncedAbsent: 2,
      simpleAttended: 8,
      simpleHeld: 10,
      syncedAt: new Date('2026-09-01'),
      attendance: [],
    }
  ]

  const updatedRecords: any[] = []
  const createdRecords: any[] = []

  const origFindMany = prisma.course.findMany
  const origUpdate = prisma.course.update
  const origCreate = prisma.course.create
  const origDeleteMany = prisma.attendanceRecord.deleteMany

  ;(prisma.attendanceRecord as any).deleteMany = async () => ({ count: 0 })
  ;(prisma.course as any).findMany = async (args: any) => {
    return mockDbCourses
  }
  ;(prisma.course as any).update = async (args: any) => {
    updatedRecords.push(args)
    return { ...mockDbCourses[0], ...args.data }
  }
  ;(prisma.course as any).create = async (args: any) => {
    createdRecords.push(args)
    return { id: 'c_new_' + Math.random(), ...args.data }
  }

  try {
    // 3. Test POST /api/sync/paste with valid data (both matching existing course and adding new course)
    const validPayload = {
      courses: [
        { name: 'Calculus and Linear Algebra', code: 'MAT101', present: 12, absent: 3 },
        { name: 'Database Systems', code: 'CS201', present: 10, absent: 2 },
      ],
      syncedAt: '2026-09-19T23:00:00.000Z',
    }

    const goodReq = new Request('http://localhost:3000/api/sync/paste', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `rollbook_session=${validSessionToken}`,
      },
      body: JSON.stringify(validPayload),
    })

    const goodRes = await pasteRoute(goodReq)
    assert(goodRes.status === 200, 'Accepts valid courses payload with 200')
    const goodJson = await goodRes.json()

    assert(goodJson.success === true, 'Response contains success: true')
    assert(goodJson.count === 2, 'Applied count is 2')
    assert(goodJson.applied.includes('Calculus and Linear Algebra'), 'Applied list includes existing course')
    assert(goodJson.applied.includes('Database Systems'), 'Applied list includes newly created course')

    // Verify DB update arguments
    assert(updatedRecords.length === 1, 'Called prisma.course.update for existing course')
    assert(updatedRecords[0].data.syncedPresent === 12, 'Updated syncedPresent to 12')
    assert(updatedRecords[0].data.syncedAbsent === 3, 'Updated syncedAbsent to 3')
    assert(updatedRecords[0].data.simpleAttended === 12, 'Updated simpleAttended to 12')
    assert(updatedRecords[0].data.simpleHeld === 15, 'Updated simpleHeld to 15 (12+3)')

    // Verify DB create arguments
    assert(createdRecords.length === 1, 'Called prisma.course.create for new course')
    assert(createdRecords[0].data.code === 'CS201', 'Created course code is CS201')
    assert(createdRecords[0].data.syncedPresent === 10, 'Created course syncedPresent is 10')
    assert(createdRecords[0].data.syncedAbsent === 2, 'Created course syncedAbsent is 2')
    assert(createdRecords[0].data.simpleAttended === 10, 'Created course simpleAttended is 10')
    assert(createdRecords[0].data.simpleHeld === 12, 'Created course simpleHeld is 12 (10+2)')
  } finally {
    // Restore mocks
    ;(prisma.course as any).findMany = origFindMany
    ;(prisma.course as any).update = origUpdate
    ;(prisma.course as any).create = origCreate
    ;(prisma.attendanceRecord as any).deleteMany = origDeleteMany
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
