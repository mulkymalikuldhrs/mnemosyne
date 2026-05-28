import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('validateApiKey authentication', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function createMockRequest(headers: Record<string, string> = {}, url: string = 'http://localhost:3000/api/test') {
    return {
      headers: {
        get: (name: string) => headers[name] || null,
      },
      url,
    } as any
  }

  it('should allow requests with valid API key in x-api-key header', async () => {
    process.env.NANGGROE_API_KEY = 'my-secret-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest({ 'x-api-key': 'my-secret-key' })
    const result = validateApiKey(req)
    expect(result).toBeNull()
  })

  it('should allow requests with valid API key in Authorization Bearer header', async () => {
    process.env.NANGGROE_API_KEY = 'my-secret-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest({ authorization: 'Bearer my-secret-key' })
    const result = validateApiKey(req)
    expect(result).toBeNull()
  })

  it('should allow requests with valid API key in query parameter', async () => {
    process.env.NANGGROE_API_KEY = 'my-secret-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest({}, 'http://localhost:3000/api/test?api_key=my-secret-key')
    const result = validateApiKey(req)
    expect(result).toBeNull()
  })

  it('should reject requests with invalid API key', async () => {
    process.env.NANGGROE_API_KEY = 'my-secret-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest({ 'x-api-key': 'wrong-key' })
    const result = validateApiKey(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('should reject requests with no API key when key is configured', async () => {
    process.env.NANGGROE_API_KEY = 'my-secret-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest()
    const result = validateApiKey(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('should return proper error body for unauthorized requests', async () => {
    process.env.NANGGROE_API_KEY = 'my-secret-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest({ 'x-api-key': 'bad-key' })
    const result = validateApiKey(req)!
    expect(result.status).toBe(401)

    const body = await result.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('Unauthorized')
    expect(body.error).toContain('API key')
  })

  it('should allow all requests in dev mode when no API key is configured', async () => {
    process.env.NANGGROE_API_KEY = ''
    process.env.NODE_ENV = 'development'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest()
    const result = validateApiKey(req)
    expect(result).toBeNull()
  })

  it('should reject requests in dev mode when API key IS configured and key is wrong', async () => {
    process.env.NANGGROE_API_KEY = 'my-secret-key'
    process.env.NODE_ENV = 'development'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest({ 'x-api-key': 'wrong-key' })
    const result = validateApiKey(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('should reject requests in production when no key header is provided', async () => {
    process.env.NANGGROE_API_KEY = 'configured-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    const req = createMockRequest({ 'some-other-header': 'value' })
    const result = validateApiKey(req)
    expect(result).not.toBeNull()
  })

  it('should prefer x-api-key header over authorization header', async () => {
    process.env.NANGGROE_API_KEY = 'correct-key'
    process.env.NODE_ENV = 'production'
    const { validateApiKey } = await import('../auth')
    // x-api-key is checked first, so even if Authorization is wrong, x-api-key wins
    const req = createMockRequest({
      'x-api-key': 'correct-key',
      authorization: 'Bearer wrong-key',
    })
    const result = validateApiKey(req)
    expect(result).toBeNull()
  })
})
