// ═══════════════════════════════════════════════════════════════════════════════
// Mnemosyne v1.0 — Rate Limiter
// Inspired by Pentaract (https://github.com/mulkymalikuldhrs/Pentaract)
// DB-based rate limiting per API key / storage worker with least-loaded selection
// Adapted from Pentaract's storage_workers_usages scheduler pattern
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitEntry {
  key: string
  timestamp: number
}

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

/**
 * In-memory rate limiter with sliding window.
 * For production multi-instance deployments, replace with Redis-backed rate limiting.
 *
 * Inspired by Pentaract's storage_workers_usages table pattern:
 * - Track every API call with timestamp
 * - Prune entries older than the window
 * - Select the key with fewest usages (least-loaded)
 */
export class RateLimiter {
  private entries: Map<string, RateLimitEntry[]> = new Map()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Check if a key is within rate limits
   * Returns { allowed: boolean, remaining: number, retryAfterMs: number }
   */
  check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    this.prune(key)

    const entries = this.entries.get(key) || []
    const remaining = Math.max(0, this.config.maxRequests - entries.length)
    const allowed = entries.length < this.config.maxRequests

    let retryAfterMs = 0
    if (!allowed && entries.length > 0) {
      // Calculate when the oldest entry will expire
      const oldest = entries[0]
      retryAfterMs = Math.max(0, oldest.timestamp + this.config.windowMs - Date.now())
    }

    return { allowed, remaining, retryAfterMs }
  }

  /**
   * Record a rate-limited request for a key
   */
  record(key: string): void {
    if (!this.entries.has(key)) {
      this.entries.set(key, [])
    }
    this.entries.get(key)!.push({
      key,
      timestamp: Date.now(),
    })
  }

  /**
   * Select the least-loaded key from a set of keys.
   * Inspired by Pentaract's rate-limited token selection:
   * "Find the worker with the fewest usages in the last minute"
   */
  selectLeastLoaded(keys: string[]): string | null {
    if (keys.length === 0) return null

    let bestKey: string | null = null
    let bestCount = Infinity

    for (const key of keys) {
      this.prune(key)
      const entries = this.entries.get(key) || []
      if (entries.length < bestCount && entries.length < this.config.maxRequests) {
        bestKey = key
        bestCount = entries.length
      }
    }

    return bestKey
  }

  /**
   * Prune entries older than the window duration
   */
  private prune(key: string): void {
    const entries = this.entries.get(key)
    if (!entries) return

    const cutoff = Date.now() - this.config.windowMs
    const pruned = entries.filter((e) => e.timestamp > cutoff)

    if (pruned.length === 0) {
      this.entries.delete(key)
    } else {
      this.entries.set(key, pruned)
    }
  }

  /**
   * Clear all rate limit entries
   */
  clear(): void {
    this.entries.clear()
  }
}

// ─── Preset Rate Limiters ──────────────────────────────────────────────────────

/** LLM API rate limiter: 20 requests per minute per key */
export const llmRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000,
})

/** Storage API rate limiter: 10 requests per minute per key */
export const storageRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
})

/** Auth rate limiter: 5 attempts per minute per IP */
export const authRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 1000,
})

/** MCP server rate limiter: 60 requests per minute per API key */
export const mcpRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
})
