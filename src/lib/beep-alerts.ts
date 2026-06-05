// ============================================================
// MEMORIX IOT - Beep Alert Service
// Buzzer pattern definitions, playback scheduling,
// and integration with hardware-bridge for GPIO buzzer control.
// ============================================================

import { db } from './db'
import type { BeepPattern } from './types'
import { DEFAULT_BEEP_PATTERNS } from './constants'

// ============================================================
// Types
// ============================================================

export type BeepPatternName = 'startup' | 'warning' | 'critical' | 'success' | 'land' | 'rth' | 'arm' | 'disarm' | 'boot' | 'heartbeat' | 'low_battery' | 'gps_lock' | 'error' | 'custom'

export interface BeepPlaybackOptions {
  /** Volume level 0-100 (maps to PWM duty cycle on hardware) */
  volume?: number
  /** Number of times to repeat the pattern */
  repeatCount?: number
  /** Delay between pattern repetitions in ms */
  repeatDelay?: number
  /** Override frequency in Hz */
  frequencyOverride?: number
}

export interface BeepPlaybackState {
  isPlaying: boolean
  currentPattern: string | null
  startedAt: string | null
  estimatedEndAt: string | null
  queue: string[]
}

export interface HardwareBridgeResponse {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

// ============================================================
// Extended Pattern Definitions
// ============================================================

const EXTENDED_BEEP_PATTERNS: Record<BeepPatternName, BeepPattern> = {
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

// ============================================================
// Hardware Bridge Interface
// ============================================================

const HARDWARE_BRIDGE_PORT = process.env.HARDWARE_BRIDGE_PORT || '3010'

async function callHardwareBridge(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<HardwareBridgeResponse> {
  try {
    const url = `/api/hardware${endpoint}?XTransformPort=${HARDWARE_BRIDGE_PORT}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Hardware bridge returned ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return { success: true, data: data as Record<string, unknown> }
  } catch (error) {
    return {
      success: false,
      error: `Hardware bridge unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// ============================================================
// BeepAlertEngine — Singleton
// ============================================================

class BeepAlertEngine {
  private static instance: BeepAlertEngine
  private playbackTimer: ReturnType<typeof setTimeout> | null = null
  private currentPattern: string | null = null
  private startedAt: Date | null = null
  private queue: string[] = []
  private isPlaying: boolean = false
  private customPatterns: Map<string, BeepPattern> = new Map()
  private defaultVolume: number = 80

  private constructor() {
    // Load custom patterns from database
    this.loadCustomPatterns().catch(err => {
    })
  }

  static getInstance(): BeepAlertEngine {
    if (!BeepAlertEngine.instance) {
      BeepAlertEngine.instance = new BeepAlertEngine()
    }
    return BeepAlertEngine.instance
  }

  // -------------------------------------------
  // Load custom patterns from DB
  // -------------------------------------------

  private async loadCustomPatterns(): Promise<void> {
    try {
      const beepChannel = await db.communicationChannel.findFirst({
        where: { type: 'beep' },
      })

      if (beepChannel) {
        const config = JSON.parse(beepChannel.config) as { patterns?: BeepPattern[] }
        if (config.patterns) {
          for (const pattern of config.patterns) {
            this.customPatterns.set(pattern.name, pattern)
          }
        }
      }
    } catch (error) {
    }
  }

  // -------------------------------------------
  // Get pattern by name
  // -------------------------------------------

  private getPattern(name: string): BeepPattern | null {
    // Check custom patterns first
    if (this.customPatterns.has(name)) {
      return this.customPatterns.get(name)!
    }
    // Then built-in patterns
    if (name in EXTENDED_BEEP_PATTERNS) {
      return EXTENDED_BEEP_PATTERNS[name as BeepPatternName]
    }
    // Then default patterns from constants
    const defaultPattern = DEFAULT_BEEP_PATTERNS.find(p => p.name === name)
    if (!defaultPattern) return null
    return { name: defaultPattern.name, pattern: [...defaultPattern.pattern], frequency: defaultPattern.frequency }
  }

  // -------------------------------------------
  // Calculate total duration of a pattern
  // -------------------------------------------

  private calculateDuration(pattern: BeepPattern, options?: BeepPlaybackOptions): number {
    const repeatCount = options?.repeatCount ?? 1
    const repeatDelay = options?.repeatDelay ?? 200
    const singleDuration = pattern.pattern.reduce((sum, d) => sum + d, 0)
    return singleDuration * repeatCount + repeatDelay * (repeatCount - 1)
  }

  // -------------------------------------------
  // Play pattern via hardware bridge or software fallback
  // -------------------------------------------

  async play(name: string, options?: BeepPlaybackOptions): Promise<{
    played: boolean
    simulated: boolean
    pattern: BeepPattern
    durationMs: number
    error?: string
  }> {
    const pattern = this.getPattern(name)
    if (!pattern) {
      return {
        played: false,
        simulated: false,
        pattern: { name, pattern: [], frequency: 0 },
        durationMs: 0,
        error: `Pattern "${name}" not found. Available: ${Object.keys(EXTENDED_BEEP_PATTERNS).join(', ')}`,
      }
    }

    // Apply overrides
    const effectivePattern: BeepPattern = {
      name: pattern.name,
      pattern: [...pattern.pattern],
      frequency: options?.frequencyOverride ?? pattern.frequency,
    }

    const volume = options?.volume ?? this.defaultVolume
    const durationMs = this.calculateDuration(effectivePattern, options)

    // If already playing, queue the pattern
    if (this.isPlaying) {
      this.queue.push(name)
      return {
        played: false,
        simulated: false,
        pattern: effectivePattern,
        durationMs: 0,
        error: 'Already playing another pattern. This pattern has been queued.',
      }
    }

    this.isPlaying = true
    this.currentPattern = name
    this.startedAt = new Date()

    try {
      // Try hardware bridge first
      const bridgeResult = await callHardwareBridge('/gpio/buzzer', {
        action: 'play_pattern',
        pattern: effectivePattern.pattern,
        frequency: effectivePattern.frequency,
        volume,
        repeatCount: options?.repeatCount ?? 1,
        repeatDelay: options?.repeatDelay ?? 200,
      })

      if (bridgeResult.success) {
        // Hardware played successfully
        this.playbackTimer = setTimeout(() => {
          this.finishPlayback()
        }, durationMs + 100)

        // Log to communication channel
        await this.logPlayback(name, false, durationMs)

        return {
          played: true,
          simulated: false,
          pattern: effectivePattern,
          durationMs,
        }
      }
    } catch (error) {
    }

    // Fallback: software simulation (no actual sound)

    this.playbackTimer = setTimeout(() => {
      this.finishPlayback()
    }, durationMs + 100)

    // Log to communication channel
    await this.logPlayback(name, true, durationMs)

    return {
      played: true,
      simulated: true,
      pattern: effectivePattern,
      durationMs,
    }
  }

  // -------------------------------------------
  // Stop current playback
  // -------------------------------------------

  async stop(): Promise<void> {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer)
      this.playbackTimer = null
    }

    // Try to stop hardware
    try {
      await callHardwareBridge('/gpio/buzzer', { action: 'stop' })
    } catch {
      // Ignore errors on stop
    }

    this.isPlaying = false
    this.currentPattern = null
    this.startedAt = null

    // Process queue
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      this.play(next).catch(err => {
      })
    }
  }

  // -------------------------------------------
  // Finish playback (internal)
  // -------------------------------------------

  private finishPlayback(): void {
    this.isPlaying = false
    this.currentPattern = null
    this.startedAt = null
    this.playbackTimer = null

    // Process queue
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      this.play(next).catch(err => {
      })
    }
  }

  // -------------------------------------------
  // Get current playback state
  // -------------------------------------------

  getState(): BeepPlaybackState {
    return {
      isPlaying: this.isPlaying,
      currentPattern: this.currentPattern,
      startedAt: this.startedAt?.toISOString() ?? null,
      estimatedEndAt: null, // would need pattern info to calculate
      queue: [...this.queue],
    }
  }

  // -------------------------------------------
  // Get all available patterns
  // -------------------------------------------

  getPatterns(): BeepPattern[] {
    const builtin = Object.values(EXTENDED_BEEP_PATTERNS)
    const custom = Array.from(this.customPatterns.values())
    return [...builtin, ...custom]
  }

  // -------------------------------------------
  // Register a custom pattern
  // -------------------------------------------

  async registerPattern(pattern: BeepPattern): Promise<{ success: boolean; error?: string }> {
    // Validate pattern
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

    // Store in memory
    this.customPatterns.set(pattern.name, pattern)

    // Persist to database via communication channel config
    try {
      const beepChannel = await db.communicationChannel.findFirst({
        where: { type: 'beep' },
      })

      if (beepChannel) {
        const config = JSON.parse(beepChannel.config) as { patterns?: BeepPattern[] }
        const existingPatterns = config.patterns ?? []
        // Replace if exists, otherwise append
        const updatedPatterns = [
          ...existingPatterns.filter(p => p.name !== pattern.name),
          pattern,
        ]

        await db.communicationChannel.update({
          where: { id: beepChannel.id },
          data: {
            config: JSON.stringify({
              ...config,
              patterns: updatedPatterns,
            }),
          },
        })
      }
    } catch (error) {
    }

    return { success: true }
  }

  // -------------------------------------------
  // Log playback to communication channel
  // -------------------------------------------

  private async logPlayback(patternName: string, simulated: boolean, durationMs: number): Promise<void> {
    try {
      const beepChannel = await db.communicationChannel.findFirst({
        where: { type: 'beep' },
      })

      if (beepChannel) {
        await db.communicationChannel.update({
          where: { id: beepChannel.id },
          data: {
            lastMessage: JSON.stringify({
              event: 'beep_played',
              pattern: patternName,
              simulated,
              durationMs,
              timestamp: new Date().toISOString(),
            }),
          },
        })
      }
    } catch (error) {
    }
  }
}

// ============================================================
// Exported Functions
// ============================================================

/**
 * Play a beep pattern by name.
 * Uses hardware bridge for GPIO buzzer control if available,
 * otherwise falls back to software simulation.
 */
export async function playPattern(
  name: string,
  options?: BeepPlaybackOptions
): Promise<{
  played: boolean
  simulated: boolean
  pattern: BeepPattern
  durationMs: number
  error?: string
}> {
  return BeepAlertEngine.getInstance().play(name, options)
}

/**
 * Stop the currently playing beep pattern.
 */
export async function stopBeep(): Promise<void> {
  return BeepAlertEngine.getInstance().stop()
}

/**
 * Get all available beep patterns (built-in + custom).
 */
export function getPatterns(): BeepPattern[] {
  return BeepAlertEngine.getInstance().getPatterns()
}

/**
 * Register a custom beep pattern.
 * Validates the pattern and persists it to the database.
 */
export async function registerPattern(pattern: BeepPattern): Promise<{ success: boolean; error?: string }> {
  return BeepAlertEngine.getInstance().registerPattern(pattern)
}

/**
 * Get current beep playback state.
 */
export function getPlaybackState(): BeepPlaybackState {
  return BeepAlertEngine.getInstance().getState()
}
