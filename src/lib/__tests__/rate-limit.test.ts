import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter } from '../rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    // Fresh instance for each test — no shared state
    limiter = new RateLimiter(60, 60000)
  })

  it('should allow the first request', () => {
    const result = limiter.check('192.168.1.1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(59)
  })

  it('should allow requests within the limit', () => {
    for (let i = 0; i < 10; i++) {
      const result = limiter.check('192.168.1.2')
      expect(result.allowed).toBe(true)
    }
  })

  it('should block requests exceeding the limit', () => {
    const smallLimiter = new RateLimiter(5, 60000)
    // Use up all allowed requests
    for (let i = 0; i < 5; i++) {
      smallLimiter.check('192.168.1.3')
    }
    // The next request should be blocked
    const result = smallLimiter.check('192.168.1.3')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should track limits per key independently', () => {
    const smallLimiter = new RateLimiter(2, 60000)
    // Exhaust limit for key-a
    smallLimiter.check('key-a')
    smallLimiter.check('key-a')
    const blocked = smallLimiter.check('key-a')
    expect(blocked.allowed).toBe(false)

    // Different key should still be allowed
    const result = smallLimiter.check('key-b')
    expect(result.allowed).toBe(true)
  })

  it('should reset rate limit for a key', () => {
    const smallLimiter = new RateLimiter(1, 60000)
    smallLimiter.check('192.168.1.4')
    const blocked = smallLimiter.check('192.168.1.4')
    expect(blocked.allowed).toBe(false)

    smallLimiter.reset('192.168.1.4')
    const afterReset = smallLimiter.check('192.168.1.4')
    expect(afterReset.allowed).toBe(true)
  })

  it('should report correct remaining count', () => {
    const smallLimiter = new RateLimiter(3, 60000)
    const r1 = smallLimiter.check('10.0.0.1')
    expect(r1.remaining).toBe(2)
    const r2 = smallLimiter.check('10.0.0.1')
    expect(r2.remaining).toBe(1)
    const r3 = smallLimiter.check('10.0.0.1')
    expect(r3.remaining).toBe(0)
    const r4 = smallLimiter.check('10.0.0.1')
    expect(r4.allowed).toBe(false)
    expect(r4.remaining).toBe(0)
  })

  it('should cleanup expired entries', () => {
    const shortLimiter = new RateLimiter(1, 10) // 10ms window
    shortLimiter.check('expired-key')
    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        shortLimiter.cleanup()
        const result = shortLimiter.check('expired-key')
        expect(result.allowed).toBe(true)
        resolve()
      }, 20)
    })
  })

  it('should expose config', () => {
    const limiter = new RateLimiter(100, 30000)
    expect(limiter.config.maxRequests).toBe(100)
    expect(limiter.config.windowMs).toBe(30000)
  })
})
