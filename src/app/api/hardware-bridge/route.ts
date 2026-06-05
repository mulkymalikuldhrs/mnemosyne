// ============================================================
// MEMORIX IOT - Hardware Bridge API Route
// GET    /api/hardware-bridge — Get bridge mode, detected hardware, active connections, health
// POST   /api/hardware-bridge — Open serial/I2C/SPI/GPIO connections, send commands
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getHardwareBridge } from '@/lib/hardware-bridge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'mode'
    const bridge = await getHardwareBridge()

    switch (action) {
      case 'mode': {
        const mode = bridge.getMode()
        return NextResponse.json({ success: true, data: { mode } })
      }

      case 'detect': {
        const scanResult = await bridge.detectHardware()
        return NextResponse.json({ success: true, data: scanResult })
      }

      case 'connections': {
        const connections = bridge.getActiveConnections()
        return NextResponse.json({ success: true, data: { connections, total: connections.length } })
      }

      case 'health': {
        const health = await bridge.healthCheck()
        return NextResponse.json({ success: true, data: health })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid actions: mode, detect, connections, health` },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get hardware bridge data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bridge = await getHardwareBridge()

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: 'action is required in request body' },
        { status: 400 }
      )
    }

    switch (body.action) {
      case 'open_serial': {
        const { path, baudRate, dataBits, stopBits, parity, flowControl } = body
        if (!path) {
          return NextResponse.json(
            { success: false, error: 'path is required (e.g., /dev/ttyAMA0)' },
            { status: 400 }
          )
        }
        const result = await bridge.openSerialPort(path, {
          baudRate,
          dataBits,
          stopBits,
          parity,
          flowControl,
        })
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: result.data }, { status: 201 })
      }

      case 'open_i2c': {
        const { busNumber } = body
        if (busNumber === undefined) {
          return NextResponse.json(
            { success: false, error: 'busNumber is required (e.g., 1)' },
            { status: 400 }
          )
        }
        const result = await bridge.openI2CBus(Number(busNumber))
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: result.data }, { status: 201 })
      }

      case 'open_spi': {
        const { busNumber, mode, maxSpeedHz, bitOrder } = body
        if (busNumber === undefined) {
          return NextResponse.json(
            { success: false, error: 'busNumber is required' },
            { status: 400 }
          )
        }
        const result = await bridge.openSPIBus(Number(busNumber), {
          mode: mode as 0 | 1 | 2 | 3 | undefined,
          maxSpeedHz: maxSpeedHz ? Number(maxSpeedHz) : undefined,
          bitOrder: bitOrder as 'msb-first' | 'lsb-first' | undefined,
        })
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: result.data }, { status: 201 })
      }

      case 'gpio_config': {
        const { pin, mode, pullUp, pullDown, label } = body
        if (pin === undefined || !mode) {
          return NextResponse.json(
            { success: false, error: 'pin and mode are required (mode: input, output, pwm, i2c, spi, uart)' },
            { status: 400 }
          )
        }
        const result = await bridge.configureGPIOPin(Number(pin), mode, { pullUp, pullDown, label })
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: result.data }, { status: 201 })
      }

      case 'serial_write': {
        const { path, data } = body
        if (!path || data === undefined) {
          return NextResponse.json(
            { success: false, error: 'path and data are required' },
            { status: 400 }
          )
        }
        const result = await bridge.serialWrite(path, data)
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: { written: true, latency: result.latency } })
      }

      case 'i2c_write': {
        const { busNumber, address, data, register } = body
        if (busNumber === undefined || address === undefined || data === undefined) {
          return NextResponse.json(
            { success: false, error: 'busNumber, address, and data are required' },
            { status: 400 }
          )
        }
        const result = await bridge.i2cWrite(Number(busNumber), Number(address), data, register ? Number(register) : undefined)
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: { written: true, latency: result.latency } })
      }

      case 'gpio_write': {
        const { pin, value } = body
        if (pin === undefined || value === undefined) {
          return NextResponse.json(
            { success: false, error: 'pin and value are required' },
            { status: 400 }
          )
        }
        const result = await bridge.gpioWrite(Number(pin), value)
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: { written: true, pin, value } })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${body.action}. Valid actions: open_serial, open_i2c, open_spi, gpio_config, serial_write, i2c_write, gpio_write` },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process hardware bridge action' },
      { status: 500 }
    )
  }
}
