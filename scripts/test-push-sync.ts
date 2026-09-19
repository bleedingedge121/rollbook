import { prisma } from '../src/lib/prisma'
import { generateSyncToken, hashSyncToken } from '../src/lib/syncToken'
import { autoApplySync } from '../src/lib/reconcile'
import bcrypt from 'bcryptjs'

async function runPushSyncTests() {
  console.log('--- Starting Push Sync & Token Tests ---')

  // 1. Create two test users
  const passwordHash = await bcrypt.hash('password123', 10)

  const userA = await prisma.user.upsert({
    where: { username: 'pushtest_user_a' },
    update: {},
    create: { username: 'pushtest_user_a', passwordHash },
  })

  const userB = await prisma.user.upsert({
    where: { username: 'pushtest_user_b' },
    update: {},
    create: { username: 'pushtest_user_b', passwordHash },
  })

  // 2. Generate and assign a sync token to User A
  const rawTokenA = generateSyncToken()
  const hashedTokenA = hashSyncToken(rawTokenA)
  await prisma.user.update({
    where: { id: userA.id },
    data: { syncToken: hashedTokenA },
  })

  // Verify token hash match
  const foundUser = await prisma.user.findFirst({
    where: { syncToken: hashSyncToken(rawTokenA) },
  })
  if (!foundUser || foundUser.id !== userA.id) {
    throw new Error('FAILED: Could not look up user by hashed sync token')
  }
  console.log('✓ Step 1: Token generation and SHA-256 lookup passed')

  // Verify fake token fails
  const fakeLookup = await prisma.user.findFirst({
    where: { syncToken: hashSyncToken('fake_token_123') },
  })
  if (fakeLookup) {
    throw new Error('FAILED: Fake token should not resolve to any user')
  }
  console.log('✓ Step 2: Invalid token rejection passed')

  // 3. Test autoApplySync with sample courses for User A
  const sampleCourses = [
    {
      name: 'COMPUTATIONAL MATHEMATICS – I',
      code: 'SMS_1102',
      present: 25,
      absent: 3,
    },
    {
      name: 'PROGRAMMING FOR PROBLEM SOLVING',
      code: 'CES_1102',
      present: 14,
      absent: 1,
    },
  ]

  const syncResult = await autoApplySync(userA.id, sampleCourses)
  if (!syncResult.success || syncResult.count !== 2) {
    throw new Error(`FAILED: autoApplySync did not apply 2 courses. Got: ${JSON.stringify(syncResult)}`)
  }

  const coursesA = await prisma.course.findMany({ where: { userId: userA.id } })
  if (coursesA.length !== 2) {
    throw new Error(`FAILED: Expected 2 courses for User A, got ${coursesA.length}`)
  }

  const mathCourse = coursesA.find((c) => c.code === 'SMS_1102')
  if (
    !mathCourse ||
    mathCourse.syncedPresent !== 25 ||
    mathCourse.syncedAbsent !== 3 ||
    mathCourse.simpleAttended !== 25 ||
    mathCourse.simpleHeld !== 28
  ) {
    throw new Error(`FAILED: Math course stats mismatch: ${JSON.stringify(mathCourse)}`)
  }
  console.log('✓ Step 3: autoApplySync created courses with synced and simple stats correctly')

  // 4. Test re-sync update (numbers change)
  const updatedSampleCourses = [
    {
      name: 'COMPUTATIONAL MATHEMATICS – I',
      code: 'SMS_1102',
      present: 26,
      absent: 3,
    },
  ]
  await autoApplySync(userA.id, updatedSampleCourses)
  const mathCourseUpdated = await prisma.course.findUnique({
    where: { id: mathCourse.id },
  })
  if (
    !mathCourseUpdated ||
    mathCourseUpdated.syncedPresent !== 26 ||
    mathCourseUpdated.simpleAttended !== 26 ||
    mathCourseUpdated.simpleHeld !== 29
  ) {
    throw new Error(`FAILED: Math course update failed: ${JSON.stringify(mathCourseUpdated)}`)
  }
  console.log('✓ Step 4: Re-sync updated existing course baseline cleanly without creating duplicate')

  // 5. Verify User B has 0 courses (data isolation)
  const coursesB = await prisma.course.findMany({ where: { userId: userB.id } })
  if (coursesB.length !== 0) {
    throw new Error('FAILED: User B should have 0 courses')
  }
  console.log('✓ Step 5: Multi-user isolation verified')

  // 6. Cleanup
  await prisma.course.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } })
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
  await prisma.$disconnect()
  console.log('--- ALL PUSH SYNC TESTS PASSED SUCCESSFULLY! ---')
}

runPushSyncTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
