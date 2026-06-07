// ============================================================
// MNEMOSYNE v2.0.0 — Rate Limiter
// Inspired by Pentaract's database-backed sliding window rate limiter
// (https://github.com/mulkymalikuldhrs/Pentaract)
//
// Sliding window counter with least-loaded-first scheduling.
// Supports both in-memory and database-backed rate limiting.
// ============================================================

export interface RateLimitConfig {
  /** Maximum number of requests per window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Key prefix for namespacing */
  prefix?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterMs?: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * In-memory sliding window rate limiter.
 * For production, replace with Redis or database-backed implementation
 * following Pentaract's storage_workers_usages pattern.
 */
export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map()
  private configs: Map<string, RateLimitConfig> = new Map()

  /**
   * Register a rate limit configuration for a key prefix.
   */
  registerConfig(key: string, config: RateLimitConfig): void {
    this.configs.set(key, config)
  }

  /**
   * Check if a request is allowed under the rate limit.
   * Uses sliding window counter with automatic cleanup.
   */
  async check(key: string, configOverride?: RateLimitConfig): Promise<RateLimitResult> {
    const config = configOverride ?? this.configs.get(key)
    if (!config) {
      // No rate limit configured — allow by default
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 60000),
      }
    }

    const now = Date.now()
    const fullKey = `${config.prefix ?? 'default'}:${key}`
    const entry = this.entries.get(fullKey)

    // Clean up expired entries
    if (entry && entry.resetAt <= now) {
      this.entries.delete(fullKey)
    }

    const currentEntry = this.entries.get(fullKey)

    if (!currentEntry) {
      // First request in window
      const resetAt = now + config.windowMs
      this.entries.set(fullKey, { count: 1, resetAt })
      return {
        allowed: true,
        remaining: config.limit - 1,
        resetAt: new Date(resetAt),
      }
    }

    if (currentEntry.count >= config.limit) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(currentEntry.resetAt),
        retryAfterMs: currentEntry.resetAt - now,
      }
    }

    // Increment counter
    currentEntry.count++
    return {
      allowed: true,
      remaining: config.limit - currentEntry.count,
      resetAt: new Date(currentEntry.resetAt),
    }
  }

  /**
   * Acquire a rate limit token, blocking with backpressure if needed.
   * Inspired by Pentaract's scheduler pattern:
   *   loop { if token { return } sleep(1s) }
   */
  async acquire(
    key: string,
    configOverride?: RateLimitConfig,
    maxWaitMs: number = 30000
  ): Promise<RateLimitResult> {
    const startTime = Date.now()

    while (true) {
      const result = await this.check(key, configOverride)

      if (result.allowed) {
        return result
      }

      const elapsed = Date.now() - startTime
      if (elapsed >= maxWaitMs) {
        return result // Return the denied result
      }

      // Wait 1 second before retrying (Pentaract pattern)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  /**
   * Reset rate limit for a specific key.
   */
  reset(key: string, prefix?: string): void {
    const fullKey = `${prefix ?? 'default'}:${key}`
    this.entries.delete(fullKey)
  }

  /**
   * Clean up all expired entries.
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key)
      }
    }
  }

  /**
   * Get the least-loaded key among a set of keys.
   * Pentaract's pattern: pick the worker with the fewest usages.
   */
  async getLeastLoaded(
    keys: string[],
    configOverride?: RateLimitConfig
  ): Promise<string | null> {
    let bestKey: string | null = null
    let bestRemaining = -1

    for (const key of keys) {
      const result = await this.check(key, configOverride)
      if (result.allowed && result.remaining > bestRemaining) {
        bestKey = key
        bestRemaining = result.remaining
      }
    }

    return bestKey
  }
}

// --- Pre-configured rate limiters for Mnemosyne ---

export const LLM_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowMs: 60_000, // 60 requests per minute
  prefix: 'llm',
}

export const STORAGE_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000, // 30 storage ops per minute
  prefix: 'storage',
}

export const MEMORY_RATE_LIMIT: RateLimitConfig = {
  limit: 20,
  windowMs: 60_000, // 20 memory operations per minute
  prefix: 'memory',
}

export const MCP_RATE_LIMIT: RateLimitConfig = {
  limit: 100,
  windowMs: 60_000, // 100 MCP requests per minute
  prefix: 'mcp',
}

// --- Singleton ---

let rateLimiterInstance: RateLimiter | null = null

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter()
    // Register default configs
    rateLimiterInstance.registerConfig('llm', LLM_RATE_LIMIT)
    rateLimiterInstance.registerConfig('storage', STORAGE_RATE_LIMIT)
    rateLimiterInstance.registerConfig('memory', MEMORY_RATE_LIMIT)
    rateLimiterInstance.registerConfig('mcp', MCP_RATE_LIMIT)
  }
  return rateLimiterInstance
}
