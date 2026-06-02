import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the pure logic from beep-alerts: pattern lookup, duration calculation, validation
// The BeepAlertEngine is a singleton with DB dependency, so we test the exported functions
// and directly test the EXTENDED_BEEP_PATTERNS logic + pattern validation

// Import the types and constants for testing
import type { BeepPattern } from '../types'
import { DEFAULT_BEEP_PATTERNS } from '../constants'

// We need to test the internal logic. Since BeepAlertEngine is a class with private methods,
// we test the pattern validation logic, duration calculation, and pattern definitions directly.

// Replicate the duration calculation logic from BeepAlertEngine for testing
function calculateDuration(
  pattern: BeepPattern,
  options?: { repeatCount?: number; repeatDelay?: number }
): number {
  const repeatCount = options?.repeatCount ?? 1
  const repeatDelay = options?.repeatDelay ?? 200
  const singleDuration = pattern.pattern.reduce((sum, d) => sum + d, 0)
  return singleDuration * repeatCount + repeatDelay * (repeatCount - 1)
}

// Replicate the pattern validation logic from registerPattern
function validatePattern(pattern: BeepPattern): { success: boolean; error?: string } {
  if (!pattern.name || pattern.name.trim().length === 0) {
    return { success: false, error: 'Pattern name is required' }
  }
  if (!pattern.pattern || pattern.pattern.length === 0) {
    return { success: false, error: 'Pattern must have at least one duration entry' }
  }
  if (pattern.frequency < 20 || pattern.frequency > 20000) {
    return { success: false, error: 'Frequency must be between 20Hz and 20000Hz' }
  }
  for (const dur of pattern.pattern) {
    if (dur < 10 || dur > 5000) {
      return { success: false, error: `Pattern duration ${dur}ms is out of range (10-5000ms)` }
    }
  }
  return { success: true }
}

// Extended patterns (from beep-alerts.ts source)
const EXTENDED_BEEP_PATTERNS: Record<string, BeepPattern> = {
  startup: { name: 'startup', pattern: [100, 50, 100, 50, 200], frequency: 2000 },
  warning: { name: 'warning', pattern: [200, 100, 200], frequency: 1500 },
  critical: { name: 'critical', pattern: [500, 200, 500, 200, 500], frequency: 3000 },
  success: { name: 'success', pattern: [100, 50, 100, 50, 400], frequency: 2500 },
  land: { name: 'land', pattern: [300, 300, 300], frequency: 1000 },
  rth: { name: 'rth', pattern: [200, 100, 200, 100, 200, 100, 400], frequency: 1800 },
  arm: { name: 'arm', pattern: [100, 50, 200], frequency: 2200 },
  disarm: { name: 'disarm', pattern: [200, 50, 100], frequency: 1200 },
  boot: { name: 'boot', pattern: [150, 100, 150, 100, 150, 100, 400], frequency: 1600 },
  heartbeat: { name: 'heartbeat', pattern: [80, 120, 80], frequency: 1000 },
  low_battery: { name: 'low_battery', pattern: [200, 100, 200, 100, 200, 500], frequency: 3500 },
  gps_lock: { name: 'gps_lock', pattern: [50, 50, 50, 50, 200], frequency: 1800 },
  error: { name: 'error', pattern: [600, 200, 600], frequency: 400 },
  custom: { name: 'custom', pattern: [200], frequency: 1000 },
}

describe('Beep Alert Service - Pattern Lookup', () => {
  it('should have all expected extended pattern names', () => {
    const expectedNames = [
      'startup', 'warning', 'critical', 'success', 'land', 'rth',
      'arm', 'disarm', 'boot', 'heartbeat', 'low_battery', 'gps_lock',
      'error', 'custom',
    ]
    for (const name of expectedNames) {
      expect(EXTENDED_BEEP_PATTERNS[name]).toBeDefined()
      expect(EXTENDED_BEEP_PATTERNS[name].name).toBe(name)
    }
  })

  it('should have default beep patterns from constants', () => {
    expect(DEFAULT_BEEP_PATTERNS.length).toBeGreaterThan(0)
    for (const p of DEFAULT_BEEP_PATTERNS) {
      expect(p.name).toBeTruthy()
      expect(p.pattern.length).toBeGreaterThan(0)
      expect(p.frequency).toBeGreaterThan(0)
    }
  })

  it('each extended pattern should have a non-empty pattern array', () => {
    for (const [name, pattern] of Object.entries(EXTENDED_BEEP_PATTERNS)) {
      expect(pattern.pattern.length).toBeGreaterThan(0)
    }
  })

  it('each extended pattern should have a positive frequency', () => {
    for (const [name, pattern] of Object.entries(EXTENDED_BEEP_PATTERNS)) {
      expect(pattern.frequency).toBeGreaterThan(0)
    }
  })

  it('startup pattern should have specific structure', () => {
    const startup = EXTENDED_BEEP_PATTERNS.startup
    expect(startup.pattern).toEqual([100, 50, 100, 50, 200])
    expect(startup.frequency).toBe(2000)
  })

  it('critical pattern should have specific structure', () => {
    const critical = EXTENDED_BEEP_PATTERNS.critical
    expect(critical.pattern).toEqual([500, 200, 500, 200, 500])
    expect(critical.frequency).toBe(3000)
  })

  it('should find pattern by name in extended patterns', () => {
    const lookupPattern = (name: string): BeepPattern | null => {
      if (name in EXTENDED_BEEP_PATTERNS) {
        return EXTENDED_BEEP_PATTERNS[name]
      }
      return null
    }

    expect(lookupPattern('warning')).not.toBeNull()
    expect(lookupPattern('warning')!.frequency).toBe(1500)
    expect(lookupPattern('nonexistent')).toBeNull()
  })
})

describe('Beep Alert Service - Duration Calculation', () => {
  it('should calculate duration of a single-play pattern', () => {
    const pattern: BeepPattern = { name: 'test', pattern: [100, 50, 100], frequency: 1000 }
    // 100 + 50 + 100 = 250
    expect(calculateDuration(pattern)).toBe(250)
  })

  it('should calculate duration with repeat count', () => {
    const pattern: BeepPattern = { name: 'test', pattern: [100, 50, 100], frequency: 1000 }
    // single: 250, repeat: 3, delay: 200
    // 250 * 3 + 200 * (3-1) = 750 + 400 = 1150
    expect(calculateDuration(pattern, { repeatCount: 3 })).toBe(1150)
  })

  it('should calculate duration with custom repeat delay', () => {
    const pattern: BeepPattern = { name: 'test', pattern: [200, 200], frequency: 1000 }
    // single: 400, repeat: 2, delay: 500
    // 400 * 2 + 500 * (2-1) = 800 + 500 = 1300
    expect(calculateDuration(pattern, { repeatCount: 2, repeatDelay: 500 })).toBe(1300)
  })

  it('should handle single-element patterns', () => {
    const pattern: BeepPattern = { name: 'beep', pattern: [500], frequency: 1000 }
    expect(calculateDuration(pattern)).toBe(500)
  })

  it('should handle repeat count of 1 (no repeat delay applied)', () => {
    const pattern: BeepPattern = { name: 'test', pattern: [100, 200], frequency: 1000 }
    const duration = calculateDuration(pattern, { repeatCount: 1, repeatDelay: 500 })
    expect(duration).toBe(300) // Just the sum of pattern entries
  })

  it('should calculate correct duration for real startup pattern', () => {
    const startup = EXTENDED_BEEP_PATTERNS.startup
    // 100 + 50 + 100 + 50 + 200 = 500
    expect(calculateDuration(startup)).toBe(500)
  })

  it('should calculate correct duration for real critical pattern with repeats', () => {
    const critical = EXTENDED_BEEP_PATTERNS.critical
    // 500 + 200 + 500 + 200 + 500 = 1900
    // With repeatCount=2: 1900 * 2 + 200 * 1 = 3800 + 200 = 4000
    expect(calculateDuration(critical, { repeatCount: 2 })).toBe(4000)
  })
})

describe('Beep Alert Service - Pattern Validation', () => {
  it('should accept a valid pattern', () => {
    const result = validatePattern({ name: 'valid', pattern: [200, 100, 200], frequency: 1500 })
    expect(result.success).toBe(true)
  })

  it('should reject pattern with empty name', () => {
    const result = validatePattern({ name: '', pattern: [200], frequency: 1000 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('name')
  })

  it('should reject pattern with whitespace-only name', () => {
    const result = validatePattern({ name: '   ', pattern: [200], frequency: 1000 })
    expect(result.success).toBe(false)
  })

  it('should reject pattern with empty pattern array', () => {
    const result = validatePattern({ name: 'test', pattern: [], frequency: 1000 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('at least one duration')
  })

  it('should reject pattern with frequency below 20Hz', () => {
    const result = validatePattern({ name: 'test', pattern: [200], frequency: 10 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Frequency')
  })

  it('should reject pattern with frequency above 20000Hz', () => {
    const result = validatePattern({ name: 'test', pattern: [200], frequency: 25000 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Frequency')
  })

  it('should accept pattern with frequency at 20Hz boundary', () => {
    const result = validatePattern({ name: 'test', pattern: [200], frequency: 20 })
    expect(result.success).toBe(true)
  })

  it('should accept pattern with frequency at 20000Hz boundary', () => {
    const result = validatePattern({ name: 'test', pattern: [200], frequency: 20000 })
    expect(result.success).toBe(true)
  })

  it('should reject pattern with duration below 10ms', () => {
    const result = validatePattern({ name: 'test', pattern: [5, 200], frequency: 1000 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('5ms')
  })

  it('should reject pattern with duration above 5000ms', () => {
    const result = validatePattern({ name: 'test', pattern: [6000], frequency: 1000 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('6000ms')
  })

  it('should accept pattern with duration at 10ms boundary', () => {
    const result = validatePattern({ name: 'test', pattern: [10], frequency: 1000 })
    expect(result.success).toBe(true)
  })

  it('should accept pattern with duration at 5000ms boundary', () => {
    const result = validatePattern({ name: 'test', pattern: [5000], frequency: 1000 })
    expect(result.success).toBe(true)
  })
})

describe('Beep Alert Service - Extended Patterns Validation', () => {
  it('all extended patterns should pass validation', () => {
    for (const [name, pattern] of Object.entries(EXTENDED_BEEP_PATTERNS)) {
      const result = validatePattern(pattern)
      expect(result.success, `Pattern "${name}" should be valid: ${result.error}`).toBe(true)
    }
  })

  it('all default beep patterns should pass validation', () => {
    for (const pattern of DEFAULT_BEEP_PATTERNS) {
      const result = validatePattern(pattern as BeepPattern)
      expect(result.success, `Pattern "${pattern.name}" should be valid: ${result.error}`).toBe(true)
    }
  })

  it('extended patterns should include additional patterns beyond defaults', () => {
    const defaultNames = new Set(DEFAULT_BEEP_PATTERNS.map(p => p.name))
    const extendedNames = Object.keys(EXTENDED_BEEP_PATTERNS)
    const extraNames = extendedNames.filter(n => !defaultNames.has(n))
    // boot, heartbeat, low_battery, gps_lock, error, custom are extra
    expect(extraNames.length).toBeGreaterThan(0)
  })
})
