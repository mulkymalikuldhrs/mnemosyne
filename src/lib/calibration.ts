// ============================================================
// MEMORIX IOT - Calibration Service
// Shared calibration execution logic for direct invocation.
// This avoids self-referential HTTP calls from the MCP route.
// ============================================================

import { db } from '@/lib/db'

/**
 * Calibration result type returned by the service.
 */
export interface CalibrationResult {
  calibrationId: string
  deviceType: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  simulated: boolean
  results?: Record<string, unknown>
  message: string
}

/**
 * Execute a calibration routine with simulated timing and results.
 * Updates the calibration record in the database as it progresses.
 *
 * IMPORTANT: This is a SIMULATED calibration. No real hardware is involved.
 * The results contain simulated placeholder values with a `simulated: true` flag.
 * Real calibration requires actual hardware communication.
 */
export async function executeCalibration(calibrationId: string, deviceType: string): Promise<CalibrationResult> {
  // Mark as in_progress
  await db.calibration.update({
    where: { id: calibrationId },
    data: { status: 'in_progress' },
  })

  // Simulated calibration durations for each device type
  const durations: Record<string, number> = {
    compass: 3000,
    accelerometer: 2000,
    gyro: 2500,
    esc: 4000,
    radio: 1500,
  }

  const duration = durations[deviceType] ?? 2000

  // Wait for simulated calibration routine to complete
  await new Promise(resolve => setTimeout(resolve, duration))

  // SIMULATED calibration results — these are placeholder values,
  // NOT from real hardware. The `simulated: true` flag must be checked
  // before trusting any calibration data.
  const simulatedResults: Record<string, Record<string, unknown>> = {
    compass: {
      offsets: { x: 0, y: 0, z: 0 },
      deviation: 0,
      status: 'simulated',
      simulated: true,
      note: 'SIMULATED calibration — values are placeholders. Real calibration requires hardware connection.',
    },
    accelerometer: {
      offsets: { x: 0, y: 0, z: 0 },
      scaling: { x: 1.0, y: 1.0, z: 1.0 },
      status: 'simulated',
      simulated: true,
      note: 'SIMULATED calibration — values are placeholders. Real calibration requires hardware connection.',
    },
    gyro: {
      offsets: { x: 0, y: 0, z: 0 },
      noise: 0,
      status: 'simulated',
      simulated: true,
      note: 'SIMULATED calibration — values are placeholders. Real calibration requires hardware connection.',
    },
    esc: {
      minPulse: 1000,
      maxPulse: 2000,
      motorsCalibrated: false,
      direction: 'cw',
      status: 'simulated',
      simulated: true,
      note: 'SIMULATED calibration — values are placeholders. Real calibration requires hardware connection.',
    },
    radio: {
      frequency: 433,
      rssi: -40,
      noise: -100,
      linkQuality: 95,
      status: 'simulated',
      simulated: true,
      note: 'SIMULATED calibration — values are placeholders. Real calibration requires hardware connection.',
    },
  }

  // Check if the calibration can be considered "successful" based on
  // whether a compatible device exists in the database.
  // Even with a compatible device, results are still SIMULATED.
  const targetDevice = await db.hardwareDevice.findFirst({
    where: {
      deviceType: deviceType === 'compass' || deviceType === 'accelerometer' || deviceType === 'gyro'
        ? 'sensor'
        : deviceType === 'esc'
          ? 'esc'
          : 'radio',
      status: { not: 'offline' },
    },
  })

  const hasCompatibleDevice = !!targetDevice

  const resultData = hasCompatibleDevice
    ? simulatedResults[deviceType]
    : { error: 'No compatible device detected for calibration', simulated: true }

  await db.calibration.update({
    where: { id: calibrationId },
    data: {
      status: hasCompatibleDevice ? 'completed' : 'failed',
      results: JSON.stringify(resultData),
    },
  })

  // Create alert — clearly marked as SIMULATED
  await db.alert.create({
    data: {
      level: hasCompatibleDevice ? 'warning' : 'warning',
      source: 'system',
      title: hasCompatibleDevice
        ? `${deviceType} Calibration Simulated`
        : `${deviceType} Calibration Failed (Simulated)`,
      message: hasCompatibleDevice
        ? `${deviceType} calibration was SIMULATED — no real hardware calibration performed. Results contain placeholder values (simulated: true). Real calibration requires hardware connection.`
        : `${deviceType} calibration failed in simulation — no compatible device detected. Please check hardware connections and retry.`,
      category: 'hardware',
      isRead: false,
    },
  })

  return {
    calibrationId,
    deviceType,
    status: hasCompatibleDevice ? 'completed' : 'failed',
    simulated: true,
    results: resultData as Record<string, unknown>,
    message: hasCompatibleDevice
      ? `SIMULATED ${deviceType} calibration completed with placeholder values. Real calibration requires hardware.`
      : `SIMULATED ${deviceType} calibration failed — no compatible device detected.`,
  }
}
