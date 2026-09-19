/**
 * scripts/set-password.ts
 *
 * Sets or resets the password for any user account.
 *
 * Usage:
 *   npx tsx scripts/set-password.ts <username> <new-password>
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const usernameArg = process.argv[2]
  const newPasswordArg = process.argv[3]

  if (!usernameArg || !newPasswordArg) {
    console.error('Usage: npx tsx scripts/set-password.ts <username> <new-password>')
    const users = await prisma.user.findMany({
      select: { username: true, role: true },
      orderBy: { createdAt: 'asc' },
    })
    console.log('\nExisting users:')
    users.forEach((u) => console.log(` - ${u.username} (role: ${u.role})`))
    process.exit(1)
  }

  if (newPasswordArg.length < 8) {
    console.error('Error: Password must be at least 8 characters long.')
    process.exit(1)
  }

  const normalized = usernameArg.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { username: normalized },
  })

  if (!user) {
    console.error(`User "${normalized}" not found.`)
    const users = await prisma.user.findMany({
      select: { username: true, role: true },
    })
    console.log('\nAvailable users:')
    users.forEach((u) => console.log(` - ${u.username} (role: ${u.role})`))
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(newPasswordArg, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  console.log(`\n✅ Successfully updated password for user "${user.username}"!`)
  console.log(`Role: ${user.role}`)
}

main()
  .catch((err) => {
    console.error('Error resetting password:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
