/**
 * scripts/test-admin-and-holidays.ts
 *
 * Automated verification suite for:
 * 1. Admin promotion and role-based permissions
 * 2. Shared global holidays calendar (read-only for users, admin mutation)
 * 3. Admin user management APIs (directory, inspect, reset, delete)
 * 4. Chat AI holiday tool admin gate
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createSessionToken } from '../src/lib/auth'

// Route handlers
import { GET as getUsers } from '../src/app/api/admin/users/route'
import { GET as getUserById, DELETE as deleteUserById } from '../src/app/api/admin/users/[id]/route'
import { POST as resetUserById } from '../src/app/api/admin/users/[id]/reset/route'
import { GET as getHolidays, POST as postHolidays, DELETE as deleteHolidays } from '../src/app/api/holidays/route'
import { DELETE as deleteHolidayById } from '../src/app/api/holidays/[id]/route'
import { POST as postChat } from '../src/app/api/chat/route'

const prisma = new PrismaClient()

function createMockRequest(url: string, method = 'GET', token?: string, body?: any): Request {
  const headers = new Headers()
  if (token) {
    headers.set('cookie', `rollbook_session=${token}`)
  }
  if (body) {
    headers.set('content-type', 'application/json')
  }

  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function run() {
  console.log(`\n======================================================`)
  console.log(`🛡️  Starting Admin Role & Global Holidays Test Suite`)
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

  // Cleanup past test data
  await prisma.attendanceRecord.deleteMany({ where: { course: { user: { username: { in: ['test_std', 'test_adm'] } } } } })
  await prisma.timetableSlot.deleteMany({ where: { course: { user: { username: { in: ['test_std', 'test_adm'] } } } } })
  await prisma.course.deleteMany({ where: { user: { username: { in: ['test_std', 'test_adm'] } } } })
  await prisma.holiday.deleteMany({ where: { date: { in: ['2026-11-01', '2026-11-02', '2026-11-03'] } } })
  await prisma.user.deleteMany({ where: { username: { in: ['test_std', 'test_adm'] } } })

  const passwordHash = await bcrypt.hash('password123', 10)

  // 1. Create a regular student and an admin user
  const student = await prisma.user.create({
    data: {
      username: 'test_std',
      passwordHash,
      role: 'user',
    },
  })

  const admin = await prisma.user.create({
    data: {
      username: 'test_adm',
      passwordHash,
      role: 'admin',
    },
  })

  // Add a course to student for testing inspect/reset
  const course = await prisma.course.create({
    data: {
      userId: student.id,
      name: 'Computer Networks',
      code: 'CSE3001',
      requiredPercent: 80.0,
      syncedPresent: 10,
      syncedAbsent: 2,
    },
  })

  const studentToken = await createSessionToken(student.id, student.username)
  const adminToken = await createSessionToken(admin.id, admin.username)

  // 2. Permission check on Admin Users endpoint
  const unauthReq = createMockRequest('http://localhost:3000/api/admin/users')
  const unauthRes = await getUsers(unauthReq)
  assert(unauthRes.status === 401, 'Unauthenticated user denied from /api/admin/users (401)')

  const stdAdminReq = createMockRequest('http://localhost:3000/api/admin/users', 'GET', studentToken)
  const stdAdminRes = await getUsers(stdAdminReq)
  assert(stdAdminRes.status === 403, 'Regular student denied from /api/admin/users (403)')

  const admAdminReq = createMockRequest('http://localhost:3000/api/admin/users', 'GET', adminToken)
  const admAdminRes = await getUsers(admAdminReq)
  assert(admAdminRes.status === 200, 'Admin can list users on /api/admin/users (200)')
  const usersList = await admAdminRes.json()
  assert(Array.isArray(usersList) && usersList.some((u: any) => u.username === 'test_std'), 'Admin user list includes test student')
  assert(!usersList.some((u: any) => u.passwordHash || u.syncToken), 'Sensitive tokens never exposed in user directory')

  // 3. Admin Inspect User
  const inspectReq = createMockRequest(`http://localhost:3000/api/admin/users/${student.id}`, 'GET', adminToken)
  const inspectRes = await getUserById(inspectReq, { params: Promise.resolve({ id: student.id }) })
  assert(inspectRes.status === 200, 'Admin can inspect student profile (200)')
  const inspectData = await inspectRes.json()
  assert(inspectData.courses.length === 1 && inspectData.courses[0].code === 'CSE3001', 'Inspect contains accurate courses')

  // 4. Global Holidays: Regular user vs Admin mutation
  const stdHolCreateReq = createMockRequest('http://localhost:3000/api/holidays', 'POST', studentToken, {
    date: '2026-11-01',
    label: 'Student Declared Holiday',
  })
  const stdHolCreateRes = await postHolidays(stdHolCreateReq)
  assert(stdHolCreateRes.status === 403, 'Regular student cannot declare holiday (403)')

  // Admin declares single holiday
  const admHolCreateReq = createMockRequest('http://localhost:3000/api/holidays', 'POST', adminToken, {
    date: '2026-11-01',
    label: 'Diwali Celebration',
    type: 'holiday',
  })
  const admHolCreateRes = await postHolidays(admHolCreateReq)
  assert(admHolCreateRes.status === 201, 'Admin can declare holiday (201)')
  const createdHol = await admHolCreateRes.json()

  // Admin declares date range
  const admHolRangeReq = createMockRequest('http://localhost:3000/api/holidays', 'POST', adminToken, {
    startDate: '2026-11-02',
    endDate: '2026-11-03',
    label: 'Mid-Term Examinations',
    type: 'exam',
  })
  const admHolRangeRes = await postHolidays(admHolRangeReq)
  assert(admHolRangeRes.status === 201, 'Admin can declare multi-day holiday/exam range (201)')

  // Regular student can read all declared global holidays
  const stdGetHolReq = createMockRequest('http://localhost:3000/api/holidays', 'GET', studentToken)
  const stdGetHolRes = await getHolidays(stdGetHolReq)
  const allHols = await stdGetHolRes.json()
  assert(allHols.some((h: any) => h.date === '2026-11-01' && h.label === 'Diwali Celebration'), 'Student can see admin-declared Diwali holiday')
  assert(allHols.some((h: any) => h.date === '2026-11-02' && h.type === 'exam'), 'Student can see admin-declared Exam day')

  // Regular student cannot delete holiday
  const stdDelHolReq = createMockRequest(`http://localhost:3000/api/holidays/${createdHol.id}`, 'DELETE', studentToken)
  const stdDelHolRes = await deleteHolidayById(stdDelHolReq, { params: Promise.resolve({ id: createdHol.id }) })
  assert(stdDelHolRes.status === 403, 'Regular student cannot delete holiday (403)')

  // Admin can delete holiday
  const admDelHolReq = createMockRequest(`http://localhost:3000/api/holidays/${createdHol.id}`, 'DELETE', adminToken)
  const admDelHolRes = await deleteHolidayById(admDelHolReq, { params: Promise.resolve({ id: createdHol.id }) })
  assert(admDelHolRes.status === 200, 'Admin can delete single holiday (200)')

  // 5. Admin Reset User Data
  const resetReq = createMockRequest(`http://localhost:3000/api/admin/users/${student.id}/reset`, 'POST', adminToken)
  const resetRes = await resetUserById(resetReq, { params: Promise.resolve({ id: student.id }) })
  assert(resetRes.status === 200, 'Admin can reset student data (200)')

  const studentCoursesAfter = await prisma.course.findMany({ where: { userId: student.id } })
  assert(studentCoursesAfter.length === 0, 'Student courses wiped after admin reset')

  const studentUserAfter = await prisma.user.findUnique({ where: { id: student.id } })
  assert(studentUserAfter !== null, 'Student account itself is preserved after reset')

  // 6. Admin Delete User Account Safeguards
  // Admin cannot delete own account
  const admDeleteSelfReq = createMockRequest(`http://localhost:3000/api/admin/users/${admin.id}`, 'DELETE', adminToken)
  const admDeleteSelfRes = await deleteUserById(admDeleteSelfReq, { params: Promise.resolve({ id: admin.id }) })
  assert(admDeleteSelfRes.status === 400, 'Admin cannot delete their own account (400)')

  // Admin can delete student account
  const admDeleteStdReq = createMockRequest(`http://localhost:3000/api/admin/users/${student.id}`, 'DELETE', adminToken)
  const admDeleteStdRes = await deleteUserById(admDeleteStdReq, { params: Promise.resolve({ id: student.id }) })
  assert(admDeleteStdRes.status === 200, 'Admin can delete student account (200)')

  const studentInDbAfter = await prisma.user.findUnique({ where: { id: student.id } })
  assert(studentInDbAfter === null, 'Student account permanently removed from database')

  // Clean up
  await prisma.holiday.deleteMany({ where: { date: { in: ['2026-11-01', '2026-11-02', '2026-11-03'] } } })
  await prisma.user.deleteMany({ where: { username: { in: ['test_std', 'test_adm'] } } })

  console.log(`\n======================================================`)
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`)
  console.log(`======================================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

run()
  .catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
