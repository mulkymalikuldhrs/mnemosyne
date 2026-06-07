import { describe, it, expect } from 'vitest'

describe('validateApiKey authentication', () => {
  it('should export authOptions with correct configuration', async () => {
    const { authOptions } = await import('../auth')
    expect(authOptions.session.strategy).toBe('jwt')
    expect(authOptions.pages.signIn).toBe('/login')
    expect(authOptions.providers).toHaveLength(1)
  })

  it('should use CredentialsProvider with correct name', async () => {
    const { authOptions } = await import('../auth')
    const provider = authOptions.providers[0] as any
    expect(provider.id).toBe('credentials')
    expect(provider.name).toBe('Credentials')
  })

  it('should include JWT and session callbacks', async () => {
    const { authOptions } = await import('../auth')
    expect(authOptions.callbacks).toBeDefined()
    expect(typeof authOptions.callbacks.jwt).toBe('function')
    expect(typeof authOptions.callbacks.session).toBe('function')
  })
})
