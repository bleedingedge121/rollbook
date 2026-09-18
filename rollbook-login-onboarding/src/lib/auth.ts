// Lightweight local-prototype auth. This is NOT multi-tenant auth — it's a
// single shared login gate for one person's local instance (matches "host
// locally, just needs a login screen" scope). Credentials come from env vars
// with dev-friendly fallbacks so the app works out of the box.
//
// Uses Web Crypto (crypto.subtle) rather than Node's `crypto` module so the
// same code runs both in middleware (Edge runtime) and in API routes (Node
// runtime) without special-casing.

const SESSION_COOKIE = 'rollbook_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export const DEFAULT_USERNAME = 'admin'
export const DEFAULT_PASSWORD = 'rollbook'

export function getConfiguredUsername(): string {
  return process.env.APP_USERNAME || DEFAULT_USERNAME
}

export function getConfiguredPassword(): string {
  return process.env.APP_PASSWORD || DEFAULT_PASSWORD
}

export function usingDefaultCredentials(): boolean {
  return !process.env.APP_USERNAME || !process.env.APP_PASSWORD
}

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

export async function createSessionToken(username: string): Promise<string> {
  const payload = JSON.stringify({
    u: username,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  })
  const payloadEncoded = base64UrlEncode(new TextEncoder().encode(payload))
  const signature = await hmac(payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payloadEncoded, signature] = parts

  const expectedSig = await hmac(payloadEncoded)
  if (expectedSig !== signature) return false

  try {
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadEncoded))
    const payload = JSON.parse(payloadJson)
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return false
    return true
  } catch {
    return false
  }
}

export function checkCredentials(username: string, password: string): boolean {
  return username === getConfiguredUsername() && password === getConfiguredPassword()
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS
