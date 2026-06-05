// ============================================================
// MEMORIX IOT - Calibration Management API
// GET  /api/calibration — List calibration records
// POST /api/calibration — Start new calibration (SIMULATED)
// ============================================================
//
// IMPORTANT: All calibrations are currently SIMULATED.
// No real hardware calibration is performed. Results contain
// placeholder values with a `simulated: true` flag.
// Real calibration requires hardware connection.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executeCalibration } from '@/lib/calibration'
import { validateApiKey } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceType = searchParams.get('deviceType')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') ?? '20')

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: 'limit must be a number between 1 and 100' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {}
    if (deviceType) where.deviceType = deviceType
    if (status) where.status = status

    const calibrations = await db.calibration.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: limit,
    })

    // Get calibration stats
    const stats = {
      total: await db.calibration.count(),
      pending: await db.calibration.count({ where: { status: 'pending' } }),
      inProgress: await db.calibration.count({ where: { status: 'in_progress' } }),
      completed: await db.calibration.count({ where: { status: 'completed' } }),
      failed: await db.calibration.count({ where: { status: 'failed' } }),
    }

    return NextResponse.json({
      success: true,
      data: {
        calibrations,
        stats,
        simulated: true,
        warning: 'All calibration results are SIMULATED. No real hardware calibration is performed. Results contain placeholder values.',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve calibration records' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { deviceType, deviceId, parameters } = body as {
      deviceType: string
      deviceId?: string
      parameters?: Record<string, unknown>
    }

    if (!deviceType || typeof deviceType !== 'string') {
      return NextResponse.json(
        { success: false, error: 'deviceType is required and must be a string' },
        { status: 400 }
      )
    }

    const validTypes = ['compass', 'accelerometer', 'gyro', 'esc', 'radio']
    if (!validTypes.includes(deviceType)) {
      return NextResponse.json(
        { success: false, error: `Invalid deviceType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate deviceId format if provided
    if (deviceId !== undefined && (typeof deviceId !== 'string' || deviceId.trim() === '')) {
      return NextResponse.json(
        { success: false, error: 'deviceId must be a non-empty string if provided' },
        { status: 400 }
      )
    }

    // Create calibration record
    const calibration = await db.calibration.create({
      data: {
        deviceType,
        deviceId: deviceId ?? null,
        status: 'pending',
        parameters: parameters ? JSON.stringify(parameters) : null,
      },
    })

    // Execute SIMULATED calibration routine asynchronously
    // Real calibration requires hardware — this runs a simulation only.
    executeCalibration(calibration.id, deviceType).catch(err => {
    })

    return NextResponse.json({
      success: true,
      data: calibration,
      simulated: true,
      warning: 'This calibration is SIMULATED. No real hardware calibration will be performed. Results will contain placeholder values with simulated: true flag.',
      message: `SIMULATED calibration for ${deviceType} initiated. Results will be simulated — real calibration requires hardware connection.`,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to start calibration' },
      { status: 500 }
    )
  }
}
