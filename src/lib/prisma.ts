import { PrismaClient } from '@prisma/client'

// Sanitize DATABASE_URL if present:
// 1. Strip surrounding quotes accidentally copied from .env or UI
// 2. Trim whitespace
// 3. For Neon URLs, ensure sslmode=require and add reasonable connect_timeout
if (process.env.DATABASE_URL) {
  let url = process.env.DATABASE_URL.trim()
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim()
  }

  if (url.includes('neon.tech')) {
    if (!url.includes('sslmode=')) {
      url += (url.includes('?') ? '&' : '?') + 'sslmode=require'
    }
    if (!url.includes('connect_timeout=')) {
      url += (url.includes('?') ? '&' : '?') + 'connect_timeout=15'
    }
  }

  process.env.DATABASE_URL = url
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

