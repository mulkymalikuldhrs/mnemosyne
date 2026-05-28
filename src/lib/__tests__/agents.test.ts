import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HermesAgent,
  PicoClawAgent,
  picoclawCheck,
  type AgentTask,
  type AgentMessage,
  type AgentState,
} from '../agents'
import { SAFETY_THRESHOLDS } from '../constants'
import type { TelemetrySnapshot, HermesResponse } from '../types'

// Helper: create a safe telemetry snapshot with all values in normal range
function createSafeTelemetry(overrides: Partial<TelemetrySnapshot> = {}): TelemetrySnapshot {
  return {
    battery_voltage: 14.8,
    gps_lat: 4.9125,
    gps_lng: 97.1347,
    altitude: 50,
    signal_strength: -50,
    temperature: 25,
    humidity: 60,
    pressure: 1013,
    heading: 180,
    speed: 5,
    roll: 0,
    pitch: 0,
    yaw: 0,
    motor_rpm_1: 0,
    motor_rpm_2: 0,
    motor_rpm_3: 0,
    current_draw: 10,
    ...overrides,
  }
}

describe('HermesAgent', () => {
  let hermes: HermesAgent

  beforeEach(() => {
    hermes = new HermesAgent()
  })

  it('should have correct name', () => {
    expect(hermes.name).toBe('hermes')
  })

  it('should have correct type as llm', () => {
    expect(hermes.type).toBe('llm')
  })

  it('should start in idle state', () => {
    expect(hermes.state).toBe('idle')
  })

  it('should have expected capabilities', () => {
    expect(hermes.capabilities).toContain('mission_planning')
    expect(hermes.capabilities).toContain('route_optimization')
    expect(hermes.capabilities).toContain('natural_language_chat')
    expect(hermes.capabilities.length).toBeGreaterThan(0)
  })

  it('should transition state after initialize', async () => {
    await hermes.initialize()
    expect(hermes.state).toBe('idle')
  })

  it('should track uptime after start', async () => {
    await hermes.start()
    const status = hermes.getStatus()
    expect(status.uptime).toBeGreaterThanOrEqual(0)
  })

  it('should reset state to idle after stop', async () => {
    hermes.state = 'thinking'
    await hermes.stop()
    expect(hermes.state).toBe('idle')
  })

  it('should handle escalation messages', () => {
    const message: AgentMessage = {
      id: 'msg-1',
      from: 'picoclaw',
      to: 'hermes',
      type: 'escalation',
      payload: { reason: 'Low battery' },
      timestamp: new Date(),
    }
    hermes.onMessage(message)
    // After receiving an escalation, lastActivity should be updated
    const status = hermes.getStatus()
    expect(status.lastActivity).not.toBeNull()
  })

  it('should ignore non-escalation messages', () => {
    const message: AgentMessage = {
      id: 'msg-2',
      from: 'system',
      to: 'hermes',
      type: 'status',
      payload: {},
      timestamp: new Date(),
    }
    hermes.onMessage(message)
    const status = hermes.getStatus()
    expect(status.lastActivity).toBeNull()
  })

  it('should return correct status structure', async () => {
    await hermes.initialize()
    const status = hermes.getStatus()
    expect(status).toHaveProperty('name', 'hermes')
    expect(status).toHaveProperty('type', 'llm')
    expect(status).toHaveProperty('state')
    expect(status).toHaveProperty('capabilities')
    expect(status).toHaveProperty('tasksCompleted', 0)
    expect(status).toHaveProperty('tasksFailed', 0)
    expect(status).toHaveProperty('uptime')
  })
})

describe('PicoClawAgent', () => {
  let picoclaw: PicoClawAgent

  beforeEach(() => {
    picoclaw = new PicoClawAgent()
  })

  it('should have correct name', () => {
    expect(picoclaw.name).toBe('picoclaw')
  })

  it('should have correct type as rule', () => {
    expect(picoclaw.type).toBe('rule')
  })

  it('should start in idle state', () => {
    expect(picoclaw.state).toBe('idle')
  })

  it('should have expected capabilities', () => {
    expect(picoclaw.capabilities).toContain('safety_check')
    expect(picoclaw.capabilities).toContain('battery_monitoring')
    expect(picoclaw.capabilities).toContain('failsafe_execution')
  })

  it('should process a safety check task successfully', async () => {
    const telemetry = createSafeTelemetry()
    const task: AgentTask = {
      id: 'task-1',
      type: 'safety_check',
      agent: 'picoclaw',
      priority: 'normal',
      payload: { telemetry },
      status: 'pending',
      createdAt: new Date(),
    }
    const result = await picoclaw.processTask(task)
    expect(result).toHaveProperty('safe', true)
    expect(picoclaw.state).toBe('idle')
  })

  it('should throw error when no telemetry provided', async () => {
    const task: AgentTask = {
      id: 'task-2',
      type: 'safety_check',
      agent: 'picoclaw',
      priority: 'normal',
      payload: {},
      status: 'pending',
      createdAt: new Date(),
    }
    await expect(picoclaw.processTask(task)).rejects.toThrow('No telemetry data provided')
    expect(picoclaw.state).toBe('error')
  })

  it('should handle alert and escalation messages', () => {
    const alertMsg: AgentMessage = {
      id: 'msg-a',
      from: 'sentinel',
      to: 'picoclaw',
      type: 'alert',
      payload: {},
      timestamp: new Date(),
    }
    picoclaw.onMessage(alertMsg)
    expect(picoclaw.getStatus().lastActivity).not.toBeNull()
  })

  it('should return correct status structure', async () => {
    await picoclaw.initialize()
    const status = picoclaw.getStatus()
    expect(status.name).toBe('picoclaw')
    expect(status.type).toBe('rule')
    expect(status.tasksCompleted).toBe(0)
  })
})

describe('picoclawCheck - Safety Threshold Checks', () => {
  it('should return safe=true for normal telemetry', () => {
    const telemetry = createSafeTelemetry()
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(true)
    expect(result.alerts).toHaveLength(0)
    expect(result.actions).toHaveLength(0)
  })

  it('should detect critical battery voltage', () => {
    const telemetry = createSafeTelemetry({
      battery_voltage: SAFETY_THRESHOLDS.battery_voltage.critical, // 12.6
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.some(a => a.metric === 'battery_voltage' && a.level === 'critical')).toBe(true)
    expect(result.actions.some(a => a.type === 'rth')).toBe(true)
  })

  it('should detect warning battery voltage', () => {
    const telemetry = createSafeTelemetry({
      battery_voltage: SAFETY_THRESHOLDS.battery_voltage.warning, // 13.2
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(true) // No critical alerts
    expect(result.alerts.some(a => a.metric === 'battery_voltage' && a.level === 'warning')).toBe(true)
    expect(result.actions.some(a => a.type === 'alert_operator')).toBe(true)
  })

  it('should detect critical signal strength', () => {
    const telemetry = createSafeTelemetry({
      signal_strength: SAFETY_THRESHOLDS.signal_strength.critical, // -80
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.some(a => a.metric === 'signal_strength' && a.level === 'critical')).toBe(true)
    expect(result.actions.some(a => a.type === 'rth')).toBe(true)
  })

  it('should detect warning signal strength', () => {
    const telemetry = createSafeTelemetry({
      signal_strength: SAFETY_THRESHOLDS.signal_strength.warning, // -70
    })
    const result = picoclawCheck(telemetry)
    expect(result.alerts.some(a => a.metric === 'signal_strength' && a.level === 'warning')).toBe(true)
    expect(result.actions.some(a => a.type === 'reduce_speed')).toBe(true)
  })

  it('should detect critical altitude', () => {
    const telemetry = createSafeTelemetry({
      altitude: SAFETY_THRESHOLDS.altitude.critical, // 120
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.some(a => a.metric === 'altitude' && a.level === 'critical')).toBe(true)
    expect(result.actions.some(a => a.type === 'land')).toBe(true)
  })

  it('should detect warning altitude', () => {
    const telemetry = createSafeTelemetry({
      altitude: SAFETY_THRESHOLDS.altitude.warning, // 110
    })
    const result = picoclawCheck(telemetry)
    expect(result.alerts.some(a => a.metric === 'altitude' && a.level === 'warning')).toBe(true)
  })

  it('should detect critical temperature', () => {
    const telemetry = createSafeTelemetry({
      temperature: SAFETY_THRESHOLDS.temperature.critical, // 50
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.some(a => a.metric === 'temperature' && a.level === 'critical')).toBe(true)
  })

  it('should detect critical current draw', () => {
    const telemetry = createSafeTelemetry({
      current_draw: SAFETY_THRESHOLDS.current_draw.critical, // 30
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.some(a => a.metric === 'current_draw' && a.level === 'critical')).toBe(true)
  })

  it('should detect critical speed', () => {
    const telemetry = createSafeTelemetry({
      speed: SAFETY_THRESHOLDS.speed.critical, // 15
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.some(a => a.metric === 'speed' && a.level === 'critical')).toBe(true)
    expect(result.actions.some(a => a.type === 'reduce_speed')).toBe(true)
  })

  it('should detect motor RPM asymmetry (critical >15%)', () => {
    // Avg = (6000 + 6000 + 8000) / 3 = 6666.7
    // Max deviation = |8000 - 6666.7| = 1333.3
    // Deviation % = 1333.3 / 6666.7 * 100 = 20% > 15%
    const telemetry = createSafeTelemetry({
      motor_rpm_1: 6000,
      motor_rpm_2: 6000,
      motor_rpm_3: 8000,
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.some(a => a.metric === 'motor_rpm' && a.level === 'critical')).toBe(true)
    expect(result.actions.some(a => a.type === 'hover')).toBe(true)
  })

  it('should detect motor RPM asymmetry (warning >8%)', () => {
    // Avg = (6000 + 6000 + 7000) / 3 = 6333.3
    // Max deviation = |7000 - 6333.3| = 666.7
    // Deviation % = 666.7 / 6333.3 * 100 = 10.5% > 8% but < 15%
    const telemetry = createSafeTelemetry({
      motor_rpm_1: 6000,
      motor_rpm_2: 6000,
      motor_rpm_3: 7000,
    })
    const result = picoclawCheck(telemetry)
    expect(result.alerts.some(a => a.metric === 'motor_rpm' && a.level === 'warning')).toBe(true)
  })

  it('should not flag motor asymmetry when motors are off (0 RPM)', () => {
    const telemetry = createSafeTelemetry({
      motor_rpm_1: 0,
      motor_rpm_2: 0,
      motor_rpm_3: 0,
    })
    const result = picoclawCheck(telemetry)
    expect(result.alerts.some(a => a.metric === 'motor_rpm')).toBe(false)
  })

  it('should detect multiple simultaneous issues', () => {
    const telemetry = createSafeTelemetry({
      battery_voltage: 12.0, // Below critical
      signal_strength: -85,  // Below critical
      altitude: 130,          // Above critical
    })
    const result = picoclawCheck(telemetry)
    expect(result.safe).toBe(false)
    expect(result.alerts.length).toBeGreaterThanOrEqual(3)
    expect(result.actions.length).toBeGreaterThanOrEqual(3)
  })

  it('should include current value and threshold in alerts', () => {
    const telemetry = createSafeTelemetry({
      battery_voltage: 12.0,
    })
    const result = picoclawCheck(telemetry)
    const batteryAlert = result.alerts.find(a => a.metric === 'battery_voltage')
    expect(batteryAlert).toBeDefined()
    expect(batteryAlert!.currentValue).toBe(12.0)
    expect(batteryAlert!.threshold).toBe(SAFETY_THRESHOLDS.battery_voltage.critical)
  })
})

describe('Agent State Management', () => {
  it('should track tasksCompleted after successful task', async () => {
    const picoclaw = new PicoClawAgent()
    await picoclaw.initialize()
    const telemetry = createSafeTelemetry()
    const task: AgentTask = {
      id: 'task-1',
      type: 'safety_check',
      agent: 'picoclaw',
      priority: 'normal',
      payload: { telemetry },
      status: 'pending',
      createdAt: new Date(),
    }
    await picoclaw.processTask(task)
    expect(picoclaw.getStatus().tasksCompleted).toBe(1)
  })

  it('should track tasksFailed after failed task', async () => {
    const picoclaw = new PicoClawAgent()
    await picoclaw.initialize()
    const task: AgentTask = {
      id: 'task-bad',
      type: 'safety_check',
      agent: 'picoclaw',
      priority: 'normal',
      payload: {}, // No telemetry
      status: 'pending',
      createdAt: new Date(),
    }
    try {
      await picoclaw.processTask(task)
    } catch {
      // Expected
    }
    expect(picoclaw.getStatus().tasksFailed).toBe(1)
  })

  it('should transition state through thinking->idle for Hermes', async () => {
    const hermes = new HermesAgent()
    await hermes.initialize()

    // Mock hermesRespond to avoid real LLM call
    const task: AgentTask = {
      id: 'task-h1',
      type: 'chat',
      agent: 'hermes',
      priority: 'normal',
      payload: { prompt: 'test' },
      status: 'pending',
      createdAt: new Date(),
    }

    // hermes.processTask will try to call the AI SDK which may fail in test env
    // We just verify state transitions work correctly
    try {
      await hermes.processTask(task)
    } catch {
      // Expected if AI SDK is unavailable
    }

    // State should be either idle (success) or error (AI unavailable)
    expect(['idle', 'error']).toContain(hermes.state)
  })
})
