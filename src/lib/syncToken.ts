import crypto from 'crypto'

export function generateSyncToken(): string {
  return `rb_sync_${crypto.randomBytes(24).toString('hex')}`
}

export function hashSyncToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex')
}
