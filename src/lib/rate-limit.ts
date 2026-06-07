/**
 * Rate limiter — reference module.
 *
 * The actual rate limiting enforcement happens in `src/middleware.ts` which
 * runs on every API request via Next.js middleware.  This module exports the
 * `RateLimiter` class so it can be used by other services (e.g. mini-services,
 * MCP server) that are not covered by the Next.js middleware.
 *
 * The pre-configured instances (`apiRateLimit`, `chatRateLimit`,
 * `memoryRateLimit`) are kept here for external use but are NOT used by the
 * main Next.js app — the middleware has its own in-memory store.
 */

import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry>
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.limits = new Map()
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  /**
   * Check if a request is allowed for the given key.
   * Returns whether the request is allowed, remaining requests, and when the window resets.
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.limits.get(key)

    // No existing entry or window has expired — start fresh
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.windowMs
      this.limits.set(key, { count: 1, resetAt })
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt,
      }
    }

    // Within the current window — increment counter
    entry.count += 1

    if (entry.count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      }
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    }
  }

  /**
   * Reset the rate limit for a specific key.
   */
  reset(key: string): void {
    this.limits.delete(key)
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   * Call this periodically (e.g., every 5 minutes).
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        this.limits.delete(key)
      }
    }
  }

  /**
   * Get the current configuration.
   */
  get config() {
    return {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
    }
  }
}

// Pre-configured rate limiter singletons for use by external services (MCP server, etc.)
// The main Next.js app uses middleware.ts for rate limiting.
export const apiRateLimit = new RateLimiter(60, 60000)    // 60 req/min default
export const chatRateLimit = new RateLimiter(20, 60000)   // 20 req/min for AI chat
export const memoryRateLimit = new RateLimiter(30, 60000)  // 30 req/min for memory ops

/**
 * Convenience function for route-level rate limiting.
 * Returns an error response if rate limited, or null if allowed.
 *
 * Uses pre-configured singleton instances based on the requested limits
 * instead of creating a new RateLimiter on every call.
 */
export function rateLimit(
  request: { headers: { get: (name: string) => string | null } },
  options?: { windowMs?: number; maxRequests?: number }
): NextResponse | null {
  // Select the appropriate pre-configured singleton based on options
  let limiter: RateLimiter
  if (options?.maxRequests !== undefined && options.maxRequests <= 20) {
    limiter = chatRateLimit
  } else if (options?.maxRequests !== undefined && options.maxRequests <= 30) {
    limiter = memoryRateLimit
  } else {
    limiter = apiRateLimit
  }

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const result = limiter.check(ip)
  if (!result.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
    )
  }
  return null
}
