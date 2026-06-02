import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// We need to test the getEnv, isProduction, isDevelopment functions
// by manipulating process.env before importing the module.

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset module cache so getEnv() re-validates
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should validate and return env when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.DATABASE_URL).toBe('file:./test.db')
  })

  it('should throw error when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = 'test'
    const { getEnv } = await import('../env')
    expect(() => getEnv()).toThrow('Environment validation failed')
  })

  it('should throw error when DATABASE_URL is empty string', async () => {
    process.env.DATABASE_URL = ''
    process.env.NODE_ENV = 'test'
    const { getEnv } = await import('../env')
    expect(() => getEnv()).toThrow('Environment validation failed')
  })

  it('should default NODE_ENV to development when not set', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    delete process.env.NODE_ENV
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.NODE_ENV).toBe('development')
  })

  it('should reject invalid NODE_ENV values', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'staging'
    const { getEnv } = await import('../env')
    expect(() => getEnv()).toThrow('Environment validation failed')
  })

  it('should accept valid NODE_ENV values: development, production, test', async () => {
    const validEnvs = ['development', 'production', 'test']
    for (const nodeEnv of validEnvs) {
      vi.resetModules()
      process.env.DATABASE_URL = 'file:./test.db'
      process.env.NODE_ENV = nodeEnv
      const { getEnv } = await import('../env')
      const env = getEnv()
      expect(env.NODE_ENV).toBe(nodeEnv)
    }
  })

  it('should provide default PORT of 3000', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    delete process.env.PORT
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.PORT).toBe(3000)
  })

  it('should coerce PORT string to number', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    process.env.PORT = '4000'
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.PORT).toBe(4000)
  })

  it('should provide default SERIAL_PORT', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    delete process.env.SERIAL_PORT
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.SERIAL_PORT).toBe('/dev/ttyUSB0')
  })

  it('should provide default SERIAL_BAUD_RATE of 115200', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    delete process.env.SERIAL_BAUD_RATE
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.SERIAL_BAUD_RATE).toBe(115200)
  })

  it('should provide default HARDWARE_BRIDGE_MODE of simulation', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    delete process.env.HARDWARE_BRIDGE_MODE
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.HARDWARE_BRIDGE_MODE).toBe('simulation')
  })

  it('should accept optional NANGGROE_API_KEY', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    process.env.NANGGROE_API_KEY = 'test-api-key'
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.NANGGROE_API_KEY).toBe('test-api-key')
  })

  it('should make optional keys undefined when not set', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    delete process.env.NANGGROE_API_KEY
    delete process.env.ZAI_API_KEY
    delete process.env.TELEGRAM_BOT_TOKEN
    const { getEnv } = await import('../env')
    const env = getEnv()
    expect(env.NANGGROE_API_KEY).toBeUndefined()
    expect(env.ZAI_API_KEY).toBeUndefined()
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined()
  })

  it('isProduction should return true when NODE_ENV is production', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'production'
    const { isProduction } = await import('../env')
    expect(isProduction()).toBe(true)
  })

  it('isDevelopment should return true when NODE_ENV is development', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'development'
    const { isDevelopment } = await import('../env')
    expect(isDevelopment()).toBe(true)
  })

  it('should reject invalid HARDWARE_BRIDGE_MODE values', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'test'
    process.env.HARDWARE_BRIDGE_MODE = 'invalid'
    const { getEnv } = await import('../env')
    expect(() => getEnv()).toThrow('Environment validation failed')
  })
})
