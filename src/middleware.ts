import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// In-memory rate limit store (shared via module scope within the same server process)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Rate limit configuration per route prefix
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  '/api/chat': { maxRequests: 20, windowMs: 60000 },     // 20 req/min for AI chat
  '/api/memory': { maxRequests: 30, windowMs: 60000 },    // 30 req/min for memory ops
  '/api/notes': { maxRequests: 30, windowMs: 60000 },     // 30 req/min for note ops
  '/api/search': { maxRequests: 30, windowMs: 60000 },    // 30 req/min for search
  '/api/auth': { maxRequests: 10, windowMs: 60000 },      // 10 req/min for auth
  '/api': { maxRequests: 60, windowMs: 60000 },           // 60 req/min default
}

function getRateLimitConfig(pathname: string) {
  // Find the most specific matching prefix
  const matches = Object.keys(RATE_LIMITS)
    .filter((prefix) => pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length)

  if (matches.length > 0) {
    return RATE_LIMITS[matches[0]]
  }

  return { maxRequests: 60, windowMs: 60000 } // fallback default
}

function checkRateLimit(key: string, config: { maxRequests: number; windowMs: number }) {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  entry.count += 1

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

// Periodic cleanup of expired rate limit entries
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
let lastCleanup = Date.now()

function cleanupRateLimits() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'on',
}

// Content Security Policy
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed for Next.js dev
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// CORS headers for MCP-related routes
const MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400', // 24 hours
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle CORS preflight for MCP routes
  if (pathname.startsWith('/api/mcp') && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...MCP_CORS_HEADERS,
        ...SECURITY_HEADERS,
        'Content-Security-Policy': CSP_HEADER,
      },
    })
  }

  // Rate limiting for API routes
  let rateLimitHeaders: Record<string, string> = {}
  if (pathname.startsWith('/api/')) {
    const config = getRateLimitConfig(pathname)
    // Use IP-based key (fallback to a generic key if IP not available)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    const rateLimitKey = `${ip}:${pathname.replace(/\/[a-zA-Z0-9_-]{20,}/, '/:id')}`
    const result = checkRateLimit(rateLimitKey, config)

    rateLimitHeaders = {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    }

    // Cleanup expired entries periodically
    cleanupRateLimits()

    if (!result.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
        }
      )
    }
  }

  // Build response with security headers
  const response = NextResponse.next()

  // Apply security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  // Apply CSP header
  response.headers.set('Content-Security-Policy', CSP_HEADER)

  // Apply rate limit headers for API routes
  for (const [key, value] of Object.entries(rateLimitHeaders)) {
    response.headers.set(key, value)
  }

  // Apply CORS headers for MCP routes
  if (pathname.startsWith('/api/mcp')) {
    for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
      response.headers.set(key, value)
    }
  }

  // Remove X-Powered-By header (also configured in next.config.ts)
  response.headers.delete('X-Powered-By')

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
