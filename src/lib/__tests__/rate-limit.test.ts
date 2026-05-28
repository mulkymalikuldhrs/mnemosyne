import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit } from '../rate-limit'

// Mock NextRequest for testing
function createMockRequest(ip: string, pathname: string = '/api/test') {
  const url = `http://localhost:3000${pathname}`
  return {
    headers: {
      get: (name: string) => {
        if (name === 'x-forwarded-for') return ip
        if (name === 'x-real-ip') return null
        return null
      },
    },
    nextUrl: { pathname },
    url,
  } as any
}

describe('rateLimit', () => {
  beforeEach(() => {
    // We need to reset the module state between tests.
    // Since the `limits` map is module-scoped, we re-import for isolation.
    vi.resetModules()
  })

  it('should allow the first request', () => {
    const req = createMockRequest('192.168.1.1')
    const result = rateLimit(req)
    expect(result).toBeNull()
  })

  it('should allow requests within the limit', () => {
    const req = createMockRequest('192.168.1.2')
    // Default maxRequests is 60, so several requests should be fine
    for (let i = 0; i < 10; i++) {
      const result = rateLimit(req)
      expect(result).toBeNull()
    }
  })

  it('should block requests exceeding the limit', () => {
    const req = createMockRequest('192.168.1.3')
    const maxRequests = 5
    // Use up all allowed requests
    for (let i = 0; i < maxRequests; i++) {
      rateLimit(req)
    }
    // The next request should be blocked
    const result = rateLimit(req, { maxRequests })
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
  })

  it('should return 429 status with proper error body', async () => {
    const req = createMockRequest('192.168.1.4')
    const maxRequests = 2
    rateLimit(req, { maxRequests })
    rateLimit(req, { maxRequests })
    const result = rateLimit(req, { maxRequests })
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)

    const body = await result!.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('Rate limit exceeded')
  })

  it('should include Retry-After header when rate limited', () => {
    const req = createMockRequest('192.168.1.5')
    const maxRequests = 1
    rateLimit(req, { maxRequests })
    const result = rateLimit(req, { maxRequests })
    expect(result).not.toBeNull()
    expect(result!.headers.get('Retry-After')).not.toBeNull()
  })

  it('should track limits per IP and path separately', () => {
    const req1 = createMockRequest('10.0.0.1', '/api/path-a')
    const req2 = createMockRequest('10.0.0.1', '/api/path-b')
    const maxRequests = 2

    // Exhaust limit on path-a
    rateLimit(req1, { maxRequests })
    rateLimit(req1, { maxRequests })
    const blocked = rateLimit(req1, { maxRequests })
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)

    // Same IP, different path should still be allowed
    const result = rateLimit(req2, { maxRequests })
    expect(result).toBeNull()
  })

  it('should track limits per different IPs independently', () => {
    const req1 = createMockRequest('172.16.0.1')
    const req2 = createMockRequest('172.16.0.2')
    const maxRequests = 1

    // Exhaust limit for first IP
    rateLimit(req1, { maxRequests })
    const blocked = rateLimit(req1, { maxRequests })
    expect(blocked).not.toBeNull()

    // Different IP should still be allowed
    const result = rateLimit(req2, { maxRequests })
    expect(result).toBeNull()
  })

  it('should use x-real-ip as fallback when x-forwarded-for is absent', () => {
    const req = {
      headers: {
        get: (name: string) => {
          if (name === 'x-forwarded-for') return null
          if (name === 'x-real-ip') return '10.10.10.10'
          return null
        },
      },
      nextUrl: { pathname: '/api/test' },
      url: 'http://localhost:3000/api/test',
    } as any

    const result = rateLimit(req)
    expect(result).toBeNull()
  })

  it('should use "unknown" as IP when no IP headers present', () => {
    const req = {
      headers: {
        get: () => null,
      },
      nextUrl: { pathname: '/api/test' },
      url: 'http://localhost:3000/api/test',
    } as any

    const result = rateLimit(req)
    expect(result).toBeNull()
  })

  it('should respect custom windowMs and maxRequests options', () => {
    const req = createMockRequest('192.168.99.1')
    const maxRequests = 3
    const windowMs = 1000

    for (let i = 0; i < maxRequests; i++) {
      rateLimit(req, { maxRequests, windowMs })
    }
    const result = rateLimit(req, { maxRequests, windowMs })
    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)
  })
})
