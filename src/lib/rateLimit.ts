// src/lib/rateLimit.ts
// In-memory sliding window rate limiter for abuse prevention on sensitive endpoints.

interface RateLimitRecord {
  count: number
  resetAt: number
}

// Map<namespace, Map<key, RateLimitRecord>>
const stores = new Map<string, Map<string, RateLimitRecord>>()

function getStore(namespace: string): Map<string, RateLimitRecord> {
  let store = stores.get(namespace)
  if (!store) {
    store = new Map<string, RateLimitRecord>()
    stores.set(namespace, store)
  }
  return store
}

// Periodic cleanup of expired rate limit buckets (every 60 seconds)
if (typeof setInterval !== 'undefined') {
  const interval = setInterval(() => {
    const now = Date.now()
    stores.forEach((store) => {
      store.forEach((record, key) => {
        if (now > record.resetAt) {
          store.delete(key)
        }
      })
    })
  }, 60_000)

  // Avoid holding open the Node.js event loop during scripts/tests
  if (interval.unref) {
    interval.unref()
  }
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Check and record a rate-limit attempt for a given namespace and key (e.g. IP or userId).
 *
 * @param namespace - Unique bucket name (e.g. 'login', 'signup', 'chat')
 * @param key - The identifier to rate-limit (e.g. client IP or userId)
 * @param limit - Maximum allowed requests in window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const store = getStore(namespace)
  const now = Date.now()
  const record = store.get(key)

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return {
      success: true,
      remaining: limit - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    }
  }

  if (record.count >= limit) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000))
    return {
      success: false,
      remaining: 0,
      resetInSeconds,
    }
  }

  record.count += 1
  const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000))
  return {
    success: true,
    remaining: limit - record.count,
    resetInSeconds,
  }
}

/**
 * Reset rate limit store (primarily for unit testing)
 */
export function resetRateLimitStore(namespace?: string, key?: string) {
  if (namespace && key) {
    stores.get(namespace)?.delete(key)
  } else if (namespace) {
    stores.get(namespace)?.clear()
  } else {
    stores.clear()
  }
}

/**
 * Extract client IP from standard proxy headers (Vercel x-forwarded-for, x-real-ip)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return '127.0.0.1'
}
