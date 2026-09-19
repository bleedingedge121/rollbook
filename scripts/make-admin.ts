/**
 * scripts/make-admin.ts
 *
 * Promotes an existing user to 'admin' role.
 *
 * Usage:
 *   npx tsx scripts/make-admin.ts <username>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const usernameArg = process.argv[2]
  if (!usernameArg) {
    console.error('Usage: npx tsx scripts/make-admin.ts <username>')
    const users = await prisma.user.findMany({
      select: { username: true, role: true },
      orderBy: { createdAt: 'asc' },
    })
    console.log('\nExisting users:')
    users.forEach((u) => console.log(` - ${u.username} (role: ${u.role})`))
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

  if (user.role === 'admin') {
    console.log(`User "${user.username}" is already an admin.`)
    return
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' },
  })

  console.log(`\n✅ Successfully promoted "${updated.username}" to ADMIN role!`)
  console.log(`ID: ${updated.id}`)
}

main()
  .catch((err) => {
    console.error('Error promoting user:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
