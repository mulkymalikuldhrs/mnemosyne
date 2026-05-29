interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
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

// Pre-configured rate limiters for different endpoint types
export const apiRateLimit = new RateLimiter(60, 60000)    // 60 req/min default
export const chatRateLimit = new RateLimiter(20, 60000)   // 20 req/min for AI chat
export const memoryRateLimit = new RateLimiter(30, 60000)  // 30 req/min for memory ops

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof globalThis !== 'undefined') {
  const globalForCleanup = globalThis as unknown as { __rateLimitCleanupTimer?: ReturnType<typeof setInterval> }

  if (!globalForCleanup.__rateLimitCleanupTimer) {
    globalForCleanup.__rateLimitCleanupTimer = setInterval(() => {
      apiRateLimit.cleanup()
      chatRateLimit.cleanup()
      memoryRateLimit.cleanup()
    }, 5 * 60 * 1000)

    // Don't prevent Node.js process from exiting
    if (globalForCleanup.__rateLimitCleanupTimer.unref) {
      globalForCleanup.__rateLimitCleanupTimer.unref()
    }
  }
}

export { RateLimiter }
