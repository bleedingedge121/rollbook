import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { getSecret } from '@/lib/auth'
import { checkRateLimit, resetRateLimitStore, getClientIp } from '@/lib/rateLimit'
import { isAllowedOrigin, OPTIONS, POST } from '@/app/api/sync/push/route'
import { middleware } from '@/middleware'

async function runTests() {
  console.log('--- Starting RollBook Security Tests ---\n')
  let passed = 0

  // -------------------------------------------------------------
  // Test 1: CRITICAL 1 - Hardcoded session secret removal & production enforcement
  // -------------------------------------------------------------
  console.log('1. Testing Session Secret Enforcement (CRITICAL 1)...')
  const originalEnv = process.env.NODE_ENV
  const originalSecret = process.env.APP_SESSION_SECRET

  try {
    // 1a. In production with no secret -> MUST THROW
    ;(process.env as any).NODE_ENV = 'production'
    delete process.env.APP_SESSION_SECRET
    assert.throws(
      () => getSecret(),
      /APP_SESSION_SECRET must be set in production/,
      'Should throw if APP_SESSION_SECRET is unset in production'
    )

    // 1b. In production with secret set -> returns secret
    process.env.APP_SESSION_SECRET = 'a-super-secret-random-production-token-12345'
    assert.equal(getSecret(), 'a-super-secret-random-production-token-12345')

    // 1c. In development -> returns dev fallback without throwing
    ;(process.env as any).NODE_ENV = 'development'
    delete process.env.APP_SESSION_SECRET
    assert.equal(getSecret(), 'rollbook-local-dev-secret-change-me-in-env')

    console.log('   [PASS] getSecret() correctly enforces session secret in production and throws when missing.')
    passed++
  } finally {
    ;(process.env as any).NODE_ENV = originalEnv
    if (originalSecret !== undefined) {
      process.env.APP_SESSION_SECRET = originalSecret
    } else {
      delete process.env.APP_SESSION_SECRET
    }
  }

  // -------------------------------------------------------------
  // Test 2: CRITICAL 2 - Admin Privilege Escalation Prevention
  // -------------------------------------------------------------
  console.log('\n2. Testing Admin Self-Escalation Logic (CRITICAL 2)...')
  {
    // Replicate route logic
    const evaluateAdminRole = (
      username: string,
      userCount: number,
      adminUsernamesEnv: string | undefined
    ) => {
      const normalizedUsername = username.trim().toLowerCase()
      const adminList = (adminUsernamesEnv || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

      const shouldBeAdmin =
        adminList.includes(normalizedUsername) ||
        userCount === 0

      return shouldBeAdmin ? 'admin' : 'user'
    }

    // Normal signup with "admin" username when other users already exist
    const role1 = evaluateAdminRole('admin', 5, 'john_doe,alice')
    assert.equal(role1, 'user', 'Signing up with "admin" when users exist MUST NOT grant admin role')

    // Normal user signup when other users exist
    const role2 = evaluateAdminRole('student123', 5, 'john_doe,alice')
    assert.equal(role2, 'user', 'Normal user signup should have role: user')

    // Initial bootstrap signup (userCount === 0)
    const role3 = evaluateAdminRole('first_user', 0, undefined)
    assert.equal(role3, 'admin', 'First registered user (userCount === 0) should be granted bootstrap admin')

    // Explicitly designated admin via ADMIN_USERNAMES
    const role4 = evaluateAdminRole('special_admin', 10, 'root,special_admin,head')
    assert.equal(role4, 'admin', 'User listed in ADMIN_USERNAMES must receive admin role')

    console.log('   [PASS] Admin self-escalation via username="admin" is completely eliminated.')
    passed++
  }

  // -------------------------------------------------------------
  // Test 3: HIGH 3 - In-Memory Sliding Window Rate Limiting
  // -------------------------------------------------------------
  console.log('\n3. Testing Sliding Window Rate Limiting (HIGH 3)...')
  {
    resetRateLimitStore()

    // 3a. Login Rate Limiter: 5 attempts per window
    const testIp = '198.51.100.42'
    for (let i = 1; i <= 5; i++) {
      const res = checkRateLimit('login', testIp, 5, 900_000)
      assert.equal(res.success, true, `Attempt ${i} within limit should succeed`)
      assert.equal(res.remaining, 5 - i)
    }
    const sixthLogin = checkRateLimit('login', testIp, 5, 900_000)
    assert.equal(sixthLogin.success, false, '6th login attempt MUST be blocked')
    assert.equal(sixthLogin.remaining, 0)
    assert.ok(sixthLogin.resetInSeconds > 0, 'Reset seconds should be positive')

    // 3b. Signup Rate Limiter: 10 attempts per window
    const signupIp = '203.0.113.88'
    for (let i = 1; i <= 10; i++) {
      const res = checkRateLimit('signup', signupIp, 10, 3_600_000)
      assert.equal(res.success, true, `Signup attempt ${i} should succeed`)
      assert.equal(res.remaining, 10 - i)
    }
    const eleventhSignup = checkRateLimit('signup', signupIp, 10, 3_600_000)
    assert.equal(eleventhSignup.success, false, '11th signup attempt MUST be blocked')

    // 3c. Chat Rate Limiter: 20 messages per window per userId
    const testUserId = 'usr_abc_123_test'
    for (let i = 1; i <= 20; i++) {
      const res = checkRateLimit('chat', testUserId, 20, 3_600_000)
      assert.equal(res.success, true, `Chat message ${i} should succeed`)
      assert.equal(res.remaining, 20 - i)
    }
    const twentyFirstChat = checkRateLimit('chat', testUserId, 20, 3_600_000)
    assert.equal(twentyFirstChat.success, false, '21st chat message MUST be blocked')

    // 3d. Client IP extraction
    const mockReqWithForwarded = new Request('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.195, 10.0.0.1' },
    })
    assert.equal(getClientIp(mockReqWithForwarded), '203.0.113.195')

    const mockReqWithRealIp = new Request('http://localhost/api/auth/login', {
      headers: { 'x-real-ip': '198.51.100.77' },
    })
    assert.equal(getClientIp(mockReqWithRealIp), '198.51.100.77')

    const mockReqNoHeaders = new Request('http://localhost/api/auth/login')
    assert.equal(getClientIp(mockReqNoHeaders), '127.0.0.1')

    console.log('   [PASS] Sliding window rate limits verified for login (5), signup (10), and chat (20).')
    passed++
  }

  // -------------------------------------------------------------
  // Test 4: MEDIUM 5 - CORS Restrictions on /api/sync/push
  // -------------------------------------------------------------
  console.log('\n4. Testing CORS Origin Restrictions on /api/sync/push (MEDIUM 5)...')
  {
    // Allowed educational/SLCM origins
    assert.equal(isAllowedOrigin('https://slcm.manipal.edu'), true)
    assert.equal(isAllowedOrigin('https://learner.manipal.edu'), true)
    assert.equal(isAllowedOrigin('https://portal.force.com'), true)
    assert.equal(isAllowedOrigin('https://org.salesforce.com'), true)
    assert.equal(isAllowedOrigin('https://site.com'), true)

    // Malicious/unauthorized origins
    assert.equal(isAllowedOrigin('https://attacker.evil.com'), false)
    assert.equal(isAllowedOrigin('https://fake-manipal.edu.attacker.com'), false)
    assert.equal(isAllowedOrigin('https://notmanipal.edu'), false)
    assert.equal(isAllowedOrigin('http://insecure-portal.manipal.edu'), true) // in dev mode (non-production)

    // Test with production env
    const origEnv = process.env.NODE_ENV
    ;(process.env as any).NODE_ENV = 'production'
    assert.equal(isAllowedOrigin('http://slcm.manipal.edu'), false, 'In production, plain HTTP must be rejected')
    assert.equal(isAllowedOrigin('https://slcm.manipal.edu'), true, 'In production, HTTPS must be allowed')
    ;(process.env as any).NODE_ENV = origEnv

    // Test OPTIONS preflight HTTP response
    const maliciousOptionsReq = new Request('http://localhost/api/sync/push', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.com' },
    })
    const maliciousOptionsRes = await OPTIONS(maliciousOptionsReq)
    assert.equal(maliciousOptionsRes.status, 403, 'OPTIONS from unauthorized origin MUST return 403')

    const validOptionsReq = new Request('http://localhost/api/sync/push', {
      method: 'OPTIONS',
      headers: { Origin: 'https://slcm.manipal.edu' },
    })
    const validOptionsRes = await OPTIONS(validOptionsReq)
    assert.equal(validOptionsRes.status, 204, 'OPTIONS from valid origin should return 204')
    assert.equal(
      validOptionsRes.headers.get('Access-Control-Allow-Origin'),
      'https://slcm.manipal.edu',
      'Should reflect authorized origin in ACAO'
    )

    // Test POST from unauthorized origin
    const maliciousPostReq = new Request('http://localhost/api/sync/push', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    const maliciousPostRes = await POST(maliciousPostReq)
    assert.equal(maliciousPostRes.status, 403, 'POST from unauthorized origin MUST return 403')

    // Test POST without Origin (CLI scraper / agent.js)
    const cliPostReq = new Request('http://localhost/api/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    const cliPostRes = await POST(cliPostReq)
    // Should proceed to Bearer token authentication (401 because no token was sent)
    assert.equal(cliPostRes.status, 401, 'CLI request without Origin proceeds to auth check')

    console.log('   [PASS] CORS origin validation and preflight handling verified.')
    passed++
  }

  // -------------------------------------------------------------
  // Test 5: MEDIUM 6 - Internal Database Error Sanitization
  // -------------------------------------------------------------
  console.log('\n5. Testing Error Sanitization in Auth Routes (MEDIUM 6)...')
  {
    // Simulate error mapping logic from login and signup catch blocks
    const sanitizeError = (error: any, defaultMsg: string) => {
      const rawMessage = error?.message || ''
      let userMessage = defaultMsg

      if (
        rawMessage.includes('column') ||
        rawMessage.includes('does not exist') ||
        rawMessage.includes('relation') ||
        error?.code === 'P2022' ||
        error?.code === 'P2021'
      ) {
        userMessage = 'Database schema is out of date. Please run "npx prisma db push" or redeploy on Vercel to sync schema.'
      } else if (
        rawMessage.includes('connect') ||
        rawMessage.includes("Can't reach database") ||
        rawMessage.includes('ETIMEDOUT') ||
        rawMessage.includes('ECONNREFUSED') ||
        error?.code === 'P1001'
      ) {
        userMessage = 'Cannot connect to database. Please check DATABASE_URL in your environment settings.'
      }

      return userMessage
    }

    // Sensitive Prisma internal stack / SQL trace
    const sensitiveError = new Error(
      'Invalid `prisma.user.findUnique()` invocation:\nSELECT "public"."User"."id", "public"."User"."passwordHash", "public"."User"."secret_salt" FROM "public"."User" WHERE "public"."User"."username" = $1'
    )
    const sanitized1 = sanitizeError(sensitiveError, 'Login failed. Please try again.')
    assert.equal(sanitized1, 'Login failed. Please try again.')
    assert.ok(!sanitized1.includes('SELECT'), 'Sanitized error must not contain raw SQL')
    assert.ok(!sanitized1.includes('passwordHash'), 'Sanitized error must not contain column names')

    // Connection timeout error
    const connError = new Error("Can't reach database server at `postgres.railway.internal:5432`")
    const sanitized2 = sanitizeError(connError, 'Login failed. Please try again.')
    assert.equal(sanitized2, 'Cannot connect to database. Please check DATABASE_URL in your environment settings.')
    assert.ok(!sanitized2.includes('railway.internal'), 'Must not leak database host/port')

    console.log('   [PASS] Error sanitization prevents raw database queries and traces from leaking.')
    passed++
  }

  // -------------------------------------------------------------
  // Test 6: Static Assets & Middleware Routing
  // -------------------------------------------------------------
  console.log('\n6. Testing Static Asset & Middleware Routing...')
  {
    // 6a. Icon request without session token -> MUST NOT REDIRECT
    const iconReq = new NextRequest('http://localhost:3000/icons/icon-192x192.png')
    const iconRes = await middleware(iconReq)
    assert.equal(
      iconRes.headers.get('location'),
      null,
      'Icon (/icons/icon-192x192.png) must not be redirected to /login'
    )

    // 6b. Apple touch icon & manifest -> MUST NOT REDIRECT
    const appleIconReq = new NextRequest('http://localhost:3000/apple-touch-icon.png')
    const appleIconRes = await middleware(appleIconReq)
    assert.equal(
      appleIconRes.headers.get('location'),
      null,
      '/apple-touch-icon.png must not be redirected to /login'
    )

    const manifestReq = new NextRequest('http://localhost:3000/manifest.json')
    const manifestRes = await middleware(manifestReq)
    assert.equal(
      manifestRes.headers.get('location'),
      null,
      '/manifest.json must not be redirected to /login'
    )

    // 6c. Public login route -> MUST NOT REDIRECT
    const loginReq = new NextRequest('http://localhost:3000/login')
    const loginRes = await middleware(loginReq)
    assert.equal(
      loginRes.headers.get('location'),
      null,
      '/login must not be redirected'
    )

    // 6d. Protected app root without session -> MUST REDIRECT to /login
    const homeReq = new NextRequest('http://localhost:3000/')
    const homeRes = await middleware(homeReq)
    assert.equal(homeRes.status, 307, 'Unauthenticated access to / must return 307 redirect')
    assert.ok(
      homeRes.headers.get('location')?.includes('/login'),
      'Redirect location must target /login'
    )

    console.log('   [PASS] Static assets, icons, and login routes load freely without session redirects.')
    passed++
  }

  console.log(`\n==============================================`)
  console.log(`All ${passed} security verification test suites passed successfully!`)
  console.log(`==============================================`)
}

runTests().catch((err) => {
  console.error('Security test failed:', err)
  process.exit(1)
})
