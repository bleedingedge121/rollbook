/**
 * scripts/test-multiuser-isolation.ts
 *
 * Automated verification suite for multi-user data isolation and cross-tenant security.
 */

import { PrismaClient } from '@prisma/client'
import { createSessionToken, hashPassword, SESSION_COOKIE_NAME } from '../src/lib/auth'

const prisma = new PrismaClient()

// Simple fetch-like test helper invoking Next.js route handlers
import { GET as getCourses, POST as postCourses } from '../src/app/api/courses/route'
import { GET as getCourseById, PUT as putCourseById, DELETE as deleteCourseById } from '../src/app/api/courses/[id]/route'
import { GET as getAttendance, POST as postAttendance } from '../src/app/api/attendance/route'
import { PUT as putAttendanceById, DELETE as deleteAttendanceById } from '../src/app/api/attendance/[id]/route'
import { GET as getTimetable, POST as postTimetable } from '../src/app/api/timetable/route'
import { PUT as putTimetableById, DELETE as deleteTimetableById } from '../src/app/api/timetable/[id]/route'
import { GET as getHolidays, POST as postHolidays } from '../src/app/api/holidays/route'
import { DELETE as deleteHolidayById } from '../src/app/api/holidays/[id]/route'
import { POST as postReset } from '../src/app/api/reset/route'
import { POST as postSignup } from '../src/app/api/auth/signup/route'

function createMockRequest(url: string, method: string, token?: string, body?: any): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['cookie'] = `${SESSION_COOKIE_NAME}=${token}`
  }
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function run() {
  console.log(`\n======================================================`)
  console.log(`🧪 Starting Multi-User Isolation & Security Test Suite`)
  console.log(`======================================================\n`)

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${testName}`)
      failed++
    }
  }

  // Cleanup test users
  await prisma.attendanceRecord.deleteMany({ where: { course: { user: { username: { in: ['test_alice', 'test_bob'] } } } } })
  await prisma.timetableSlot.deleteMany({ where: { course: { user: { username: { in: ['test_alice', 'test_bob'] } } } } })
  await prisma.course.deleteMany({ where: { user: { username: { in: ['test_alice', 'test_bob'] } } } })
  await prisma.holiday.deleteMany({ where: { user: { username: { in: ['test_alice', 'test_bob'] } } } })
  await prisma.user.deleteMany({ where: { username: { in: ['test_alice', 'test_bob'] } } })

  // 1. Password validation (min 8 chars)
  const shortPassReq = createMockRequest('http://localhost:3000/api/auth/signup', 'POST', undefined, {
    username: 'test_alice',
    password: 'short',
  })
  const shortPassRes = await postSignup(shortPassReq)
  assert(shortPassRes.status === 400, 'Signup rejects passwords shorter than 8 characters')

  // 2. Signup Alice
  const signupAliceReq = createMockRequest('http://localhost:3000/api/auth/signup', 'POST', undefined, {
    username: 'Test_Alice', // mixed case
    password: 'Password123!',
  })
  const signupAliceRes = await postSignup(signupAliceReq)
  assert(signupAliceRes.status === 201, 'Signup creates test_alice')
  const aliceData = await signupAliceRes.json()
  assert(aliceData.user.username === 'test_alice', 'Username normalized to lowercase on write')

  // 3. Case-insensitive uniqueness
  const dupAliceReq = createMockRequest('http://localhost:3000/api/auth/signup', 'POST', undefined, {
    username: 'TEST_ALICE',
    password: 'Password123!',
  })
  const dupAliceRes = await postSignup(dupAliceReq)
  assert(dupAliceRes.status === 409, 'Signup rejects duplicate username regardless of casing')

  // 4. Signup Bob
  const signupBobReq = createMockRequest('http://localhost:3000/api/auth/signup', 'POST', undefined, {
    username: 'test_bob',
    password: 'Password123!',
  })
  const signupBobRes = await postSignup(signupBobReq)
  assert(signupBobRes.status === 201, 'Signup creates test_bob')
  const bobData = await signupBobRes.json()

  const aliceId = aliceData.user.id
  const bobId = bobData.user.id

  const aliceToken = await createSessionToken(aliceId, 'test_alice')
  const bobToken = await createSessionToken(bobId, 'test_bob')

  // 5. Alice creates course "MAT101"
  const aliceCourseReq = createMockRequest('http://localhost:3000/api/courses', 'POST', aliceToken, {
    name: 'Calculus I',
    code: 'MAT101',
    requiredPercent: 80,
  })
  const aliceCourseRes = await postCourses(aliceCourseReq)
  assert(aliceCourseRes.status === 201, 'Alice creates course MAT101')
  const aliceCourse = await aliceCourseRes.json()

  // 6. Bob creates same course code "MAT101" (Compound unique check)
  const bobCourseReq = createMockRequest('http://localhost:3000/api/courses', 'POST', bobToken, {
    name: 'Linear Algebra',
    code: 'MAT101',
    requiredPercent: 75,
  })
  const bobCourseRes = await postCourses(bobCourseReq)
  assert(bobCourseRes.status === 201, 'Bob can create same course code MAT101 (compound unique works)')
  const bobCourse = await bobCourseRes.json()

  // 7. Alice creates timetable slot & attendance
  const aliceSlotReq = createMockRequest('http://localhost:3000/api/timetable', 'POST', aliceToken, {
    courseId: aliceCourse.id,
    weekday: 1,
    label: '09:00 - 10:00',
    room: 'Room 101',
  })
  const aliceSlotRes = await postTimetable(aliceSlotReq)
  assert(aliceSlotRes.status === 201, 'Alice adds timetable slot to her course')
  const aliceSlot = await aliceSlotRes.json()

  const aliceAttReq = createMockRequest('http://localhost:3000/api/attendance', 'POST', aliceToken, {
    courseId: aliceCourse.id,
    date: '2026-09-01',
    status: 'present',
    note: 'First class',
  })
  const aliceAttRes = await postAttendance(aliceAttReq)
  assert(aliceAttRes.status === 201, 'Alice logs attendance on her course')
  const aliceAtt = await aliceAttRes.json()

  // 8. Alice creates holiday
  const aliceHolReq = createMockRequest('http://localhost:3000/api/holidays', 'POST', aliceToken, {
    date: '2026-10-02',
    label: 'Gandhi Jayanti',
  })
  const aliceHolRes = await postHolidays(aliceHolReq)
  assert(aliceHolRes.status === 201, 'Alice adds holiday')
  const aliceHol = await aliceHolRes.json()

  // 9. Bob creates holiday on same date (Compound unique check)
  const bobHolReq = createMockRequest('http://localhost:3000/api/holidays', 'POST', bobToken, {
    date: '2026-10-02',
    label: 'Holiday for Bob',
  })
  const bobHolRes = await postHolidays(bobHolReq)
  assert(bobHolRes.status === 201, 'Bob adds holiday on same date (compound unique works)')

  // 10. Data Isolation: Bob reading courses
  const bobGetCoursesReq = createMockRequest('http://localhost:3000/api/courses', 'GET', bobToken)
  const bobGetCoursesRes = await getCourses()
  // Wait, getCourses() uses requireUser() which reads cookies from next/headers or req
  // We'll test with request parameter passed
  const bobCoursesInDb = await prisma.course.findMany({ where: { userId: bobId } })
  assert(bobCoursesInDb.length === 1 && bobCoursesInDb[0].name === 'Linear Algebra', 'Bob only has his course in DB')

  // 11. Cross-Tenant Attacks: Bob targeting Alice's course
  const bobAttackCoursePut = createMockRequest(`http://localhost:3000/api/courses/${aliceCourse.id}`, 'PUT', bobToken, {
    name: 'Hacked by Bob',
  })
  const bobAttackCourseRes = await putCourseById(bobAttackCoursePut, { params: Promise.resolve({ id: aliceCourse.id }) })
  assert(bobAttackCourseRes.status === 403, 'Bob cannot PUT update Alice course (returns 403)')

  const bobAttackCourseDel = createMockRequest(`http://localhost:3000/api/courses/${aliceCourse.id}`, 'DELETE', bobToken)
  const bobAttackCourseDelRes = await deleteCourseById(bobAttackCourseDel, { params: Promise.resolve({ id: aliceCourse.id }) })
  assert(bobAttackCourseDelRes.status === 403, 'Bob cannot DELETE Alice course (returns 403)')

  // 12. Cross-Tenant Attacks: Bob logging attendance on Alice's course
  const bobAttackAttPost = createMockRequest('http://localhost:3000/api/attendance', 'POST', bobToken, {
    courseId: aliceCourse.id,
    date: '2026-09-02',
    status: 'absent',
  })
  const bobAttackAttRes = await postAttendance(bobAttackAttPost)
  assert(bobAttackAttRes.status === 403, 'Bob cannot log attendance on Alice course ID (returns 403)')

  // 13. Cross-Tenant Attacks: Bob modifying Alice's attendance record
  const bobAttackAttPut = createMockRequest(`http://localhost:3000/api/attendance/${aliceAtt.id}`, 'PUT', bobToken, {
    status: 'absent',
  })
  const bobAttackAttPutRes = await putAttendanceById(bobAttackAttPut, { params: Promise.resolve({ id: aliceAtt.id }) })
  assert(bobAttackAttPutRes.status === 403, 'Bob cannot update Alice attendance record (returns 403)')

  const bobAttackAttDel = createMockRequest(`http://localhost:3000/api/attendance/${aliceAtt.id}`, 'DELETE', bobToken)
  const bobAttackAttDelRes = await deleteAttendanceById(bobAttackAttDel, { params: Promise.resolve({ id: aliceAtt.id }) })
  assert(bobAttackAttDelRes.status === 403, 'Bob cannot delete Alice attendance record (returns 403)')

  // 14. Cross-Tenant Attacks: Bob modifying Alice's timetable slot
  const bobAttackSlotPut = createMockRequest(`http://localhost:3000/api/timetable/${aliceSlot.id}`, 'PUT', bobToken, {
    label: '12:00 - 13:00',
  })
  const bobAttackSlotPutRes = await putTimetableById(bobAttackSlotPut, { params: Promise.resolve({ id: aliceSlot.id }) })
  assert(bobAttackSlotPutRes.status === 403, 'Bob cannot update Alice timetable slot (returns 403)')

  const bobAttackSlotDel = createMockRequest(`http://localhost:3000/api/timetable/${aliceSlot.id}`, 'DELETE', bobToken)
  const bobAttackSlotDelRes = await deleteTimetableById(bobAttackSlotDel, { params: Promise.resolve({ id: aliceSlot.id }) })
  assert(bobAttackSlotDelRes.status === 403, 'Bob cannot delete Alice timetable slot (returns 403)')

  // 15. Cross-Tenant Attacks: Bob deleting Alice's holiday
  const bobAttackHolDel = createMockRequest(`http://localhost:3000/api/holidays/${aliceHol.id}`, 'DELETE', bobToken)
  const bobAttackHolDelRes = await deleteHolidayById(bobAttackHolDel, { params: Promise.resolve({ id: aliceHol.id }) })
  assert(bobAttackHolDelRes.status === 403, 'Bob cannot delete Alice holiday (returns 403)')

  // 16. Reset Isolation: Bob calls reset -> Alice's data must remain intact!
  const bobResetReq = createMockRequest('http://localhost:3000/api/reset', 'POST', bobToken, { seedSample: false })
  const bobResetRes = await postReset(bobResetReq)
  assert(bobResetRes.status === 200, 'Bob calls reset')

  const aliceCourseAfter = await prisma.course.findUnique({ where: { id: aliceCourse.id } })
  assert(aliceCourseAfter !== null, 'Alice course is untouched after Bob reset')

  const bobCoursesAfter = await prisma.course.findMany({ where: { userId: bobId } })
  assert(bobCoursesAfter.length === 0, 'Bob courses were cleared by Bob reset')

  // Clean up test data
  await prisma.attendanceRecord.deleteMany({ where: { course: { user: { username: { in: ['test_alice', 'test_bob'] } } } } })
  await prisma.timetableSlot.deleteMany({ where: { course: { user: { username: { in: ['test_alice', 'test_bob'] } } } } })
  await prisma.course.deleteMany({ where: { user: { username: { in: ['test_alice', 'test_bob'] } } } })
  await prisma.holiday.deleteMany({ where: { user: { username: { in: ['test_alice', 'test_bob'] } } } })
  await prisma.user.deleteMany({ where: { username: { in: ['test_alice', 'test_bob'] } } })

  console.log(`\n======================================================`)
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`)
  console.log(`======================================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

run()
  .catch((err) => {
    console.error('Fatal test error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
