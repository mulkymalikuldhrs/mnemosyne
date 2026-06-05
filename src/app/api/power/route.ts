import { NextRequest, NextResponse } from 'next/server'
import { PowerService } from '@/lib/power'

const VALID_POWER_TYPES = ['battery', 'solar', 'gsm', 'usb']
const VALID_POWER_STATUSES = ['unknown', 'charging', 'discharging', 'full', 'error', 'offline']

export async function GET() {
  try {
    const service = PowerService.getInstance()
    await service.initializeDefaults()
    const [sources, status] = await Promise.all([
      service.listPowerSources(),
      service.getPowerStatus(),
    ])
    return NextResponse.json({ success: true, data: { sources, status } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.sourceId || typeof body.sourceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid required field: sourceId (must be a non-empty string)' },
        { status: 400 }
      )
    }

    // Validate type if provided
    if (body.type !== undefined && (typeof body.type !== 'string' || !VALID_POWER_TYPES.includes(body.type))) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${VALID_POWER_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate name if provided
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid name. Must be a non-empty string' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (body.status !== undefined && (typeof body.status !== 'string' || !VALID_POWER_STATUSES.includes(body.status))) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_POWER_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate reading fields if provided
    if (body.reading !== undefined) {
      if (typeof body.reading !== 'object' || body.reading === null) {
        return NextResponse.json(
          { success: false, error: 'reading must be an object with numeric fields (voltage, current, temperature, currentLevel)' },
          { status: 400 }
        )
      }
      const reading = body.reading as Record<string, unknown>
      if (reading.voltage !== undefined && typeof reading.voltage !== 'number') {
        return NextResponse.json(
          { success: false, error: 'reading.voltage must be a number' },
          { status: 400 }
        )
      }
      if (reading.current !== undefined && typeof reading.current !== 'number') {
        return NextResponse.json(
          { success: false, error: 'reading.current must be a number' },
          { status: 400 }
        )
      }
      if (reading.temperature !== undefined && typeof reading.temperature !== 'number') {
        return NextResponse.json(
          { success: false, error: 'reading.temperature must be a number' },
          { status: 400 }
        )
      }
      if (reading.currentLevel !== undefined && typeof reading.currentLevel !== 'number') {
        return NextResponse.json(
          { success: false, error: 'reading.currentLevel must be a number' },
          { status: 400 }
        )
      }
    }

    const service = PowerService.getInstance()
    const source = await service.updateReading(body.sourceId, body.reading)
    return NextResponse.json({ success: true, data: source })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
