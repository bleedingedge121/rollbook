/**
 * scripts/migrate-to-multiuser.ts
 *
 * One-time migration script for existing local data to the new multi-user architecture.
 * Usage:
 *   npx tsx scripts/migrate-to-multiuser.ts [username] [password]
 *
 * If arguments are omitted, defaults to username "kavish" and prompts for password or defaults to "rollbook123".
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const usernameInput = (args[0] || process.env.APP_USERNAME || 'admin').trim().toLowerCase()
  const passwordInput = (args[1] || process.env.APP_PASSWORD || 'rollbook123').trim()

  if (passwordInput.length < 8) {
    console.error('Password must be at least 8 characters long.')
    process.exit(1)
  }

  console.log(`\n========================================`)
  console.log(`🚀 Roll Book Multi-User Migration Script`)
  console.log(`Target username: "${usernameInput}"`)
  console.log(`========================================\n`)

  const passwordHash = await bcrypt.hash(passwordInput, 10)

  // Find or create user
  const user = await prisma.user.upsert({
    where: { username: usernameInput },
    update: { passwordHash },
    create: {
      username: usernameInput,
      passwordHash,
    },
  })

  console.log(`✓ User "${user.username}" ready with ID: ${user.id}`)

  // Assign any orphaned courses to this user
  const coursesUpdated = await prisma.course.updateMany({
    where: { userId: '' },
    data: { userId: user.id },
  }).catch(() => ({ count: 0 }))

  console.log(`✓ Assigned ${coursesUpdated.count} courses to user "${user.username}".`)
  console.log(`\nMigration complete! You can now log in as "${user.username}".\n`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
