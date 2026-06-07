import { describe, it, expect } from 'vitest'

describe('env validation', () => {
  it('should export env object', async () => {
    const mod = await import('../env')
    expect(mod.env).toBeDefined()
    expect(typeof mod.env).toBe('object')
  })

  it('should export Env type', async () => {
    const mod = await import('../env')
    // Type exports are compile-time only, but we can verify the module loaded
    expect(mod).toBeDefined()
  })
})
