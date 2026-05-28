import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const limits = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of limits) {
      if (now > entry.resetTime) limits.delete(key)
    }
  }, 60000)
}

export function rateLimit(
  request: NextRequest,
  options: { windowMs?: number; maxRequests?: number } = {}
): NextResponse | null {
  const { windowMs = 60000, maxRequests = 60 } = options

  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown'
  const key = `${ip}:${request.nextUrl.pathname}`
  const now = Date.now()

  const entry = limits.get(key)

  if (!entry || now > entry.resetTime) {
    limits.set(key, { count: 1, resetTime: now + windowMs })
    return null // Allow
  }

  if (entry.count >= maxRequests) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetTime - now) / 1000)) } }
    )
  }

  entry.count++
  return null // Allow
}
