import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

// Public paths that don't require a session.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/me']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  if (isPublic) {
    return NextResponse.next()
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const authed = await verifySessionToken(token)

  if (authed) {
    return NextResponse.next()
  }

  // API routes get a JSON 401 instead of a redirect, so fetch() calls in the
  // app fail predictably rather than silently receiving an HTML login page.
  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files, so the login gate covers pages
     * and API routes alike.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
