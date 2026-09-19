import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const SESSION_COOKIE = 'rollbook_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSecret(): string {
  return (
    process.env.APP_SESSION_SECRET ||
    'rollbook-local-dev-secret-change-me-in-env'
  )
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + ((4 - (str.length % 4)) % 4),
    '='
  )
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64UrlEncode(new Uint8Array(sig))
}

export async function createSessionToken(userId: string, username: string): Promise<string> {
  const payload = JSON.stringify({
    sub: userId,
    u: username.toLowerCase().trim(),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  })
  const payloadEncoded = base64UrlEncode(new TextEncoder().encode(payload))
  const signature = await hmac(payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

export async function getSessionUser(
  token: string | undefined | null
): Promise<{ userId: string; username: string } | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadEncoded, signature] = parts

  const expectedSig = await hmac(payloadEncoded)
  if (expectedSig !== signature) return null

  try {
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadEncoded))
    const payload = JSON.parse(payloadJson)
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
    if (!payload.sub || typeof payload.sub !== 'string') return null
    return {
      userId: payload.sub,
      username: payload.u || '',
    }
  } catch {
    return null
  }
}

export async function getSessionUserId(token: string | undefined | null): Promise<string | null> {
  const user = await getSessionUser(token)
  return user ? user.userId : null
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const userId = await getSessionUserId(token)
  return userId !== null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function checkCredentials(
  username: string,
  password: string
): Promise<{ id: string; username: string; role: string } | null> {
  if (!username || !password) return null
  const normalizedUsername = username.toLowerCase().trim()
  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  })
  if (!user) return null

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) return null

  return { id: user.id, username: user.username, role: user.role }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS
