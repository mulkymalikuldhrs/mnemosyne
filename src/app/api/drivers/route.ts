// ============================================================
// MEMORIX IOT - Drivers API
// GET    /api/drivers — List all registered drivers and states
// POST   /api/drivers — Connect a specific driver
// PUT    /api/drivers — Execute driver commands (health check, read, write)
// DELETE /api/drivers — Disconnect a driver
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { DriverRegistry } from '@/lib/drivers'

export async function GET() {
  try {
    const registry = DriverRegistry.getInstance()
    const drivers = registry.getAllDrivers()

    const driverStates = drivers.map(driver => driver.getState())
    const connectedCount = drivers.filter(d => d.isConnected()).length

    return NextResponse.json({
      success: true,
      data: {
        drivers: driverStates,
        total: drivers.length,
        connected: connectedCount,
        disconnected: drivers.length - connectedCount,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve driver information' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    const registry = DriverRegistry.getInstance()

    // Connect a driver
    if (action === 'connect') {
      const { deviceType, deviceId, config } = body as {
        deviceType: string
        deviceId: string
        config?: Record<string, unknown>
      }

      if (!deviceType || !deviceId) {
        return NextResponse.json(
          { success: false, error: 'deviceType and deviceId are required' },
          { status: 400 }
        )
      }

      const driver = registry.getDriver(deviceType)
      if (!driver) {
        return NextResponse.json(
          { success: false, error: `No driver registered for device type: ${deviceType}` },
          { status: 404 }
        )
      }

      const result = await registry.connectDevice(deviceType, deviceId, config)

      return NextResponse.json({
        success: result.success,
        data: {
          connectionResult: result,
          driverState: driver.getState(),
        },
        message: result.message,
      }, { status: result.success ? 200 : 400 })
    }

    // Health check all connected drivers
    if (action === 'healthCheckAll') {
      const results = await registry.healthCheckAll()

      return NextResponse.json({
        success: true,
        data: results,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "connect" or "healthCheckAll"' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to connect driver' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    const registry = DriverRegistry.getInstance()

    // Execute driver command
    if (action === 'command') {
      const { deviceType, command, data, params } = body as {
        deviceType: string
        command: 'healthCheck' | 'readData' | 'writeData' | 'executeCommand'
        data?: Record<string, unknown>
        params?: Record<string, unknown>
      }

      if (!deviceType || !command) {
        return NextResponse.json(
          { success: false, error: 'deviceType and command are required' },
          { status: 400 }
        )
      }

      const driver = registry.getDriver(deviceType)
      if (!driver) {
        return NextResponse.json(
          { success: false, error: `No driver registered for device type: ${deviceType}` },
          { status: 404 }
        )
      }

      if (!driver.isConnected()) {
        return NextResponse.json(
          { success: false, error: `Driver for ${deviceType} is not connected. Connect first.` },
          { status: 400 }
        )
      }

      switch (command) {
        case 'healthCheck': {
          const result = await driver.healthCheck()
          return NextResponse.json({
            success: true,
            data: {
              result,
              driverState: driver.getState(),
            },
          })
        }

        case 'readData': {
          const result = await driver.readData()
          return NextResponse.json({
            success: true,
            data: result,
          })
        }

        case 'writeData': {
          if (!data) {
            return NextResponse.json(
              { success: false, error: 'data is required for writeData command' },
              { status: 400 }
            )
          }
          const writeResult = await driver.writeData(data)
          return NextResponse.json({
            success: writeResult.success,
            data: {
              writeResult,
              driverState: driver.getState(),
            },
            message: writeResult.message,
          }, { status: writeResult.success ? 200 : 400 })
        }

        case 'executeCommand': {
          const execCommand = data?.command as string | undefined
          const execParams = data?.params as Record<string, unknown> | undefined
          if (!execCommand) {
            return NextResponse.json(
              { success: false, error: 'data.command is required for executeCommand' },
              { status: 400 }
            )
          }
          const execResult = await driver.executeCommand(execCommand, execParams)
          return NextResponse.json({
            success: execResult.success,
            data: {
              commandResult: execResult,
              driverState: driver.getState(),
            },
            message: execResult.message,
          }, { status: execResult.success ? 200 : 400 })
        }

        default:
          return NextResponse.json(
            { success: false, error: `Invalid command: ${command}. Use healthCheck, readData, writeData, or executeCommand` },
            { status: 400 }
          )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "command"' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to execute driver command' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceType = searchParams.get('deviceType')

    if (!deviceType) {
      return NextResponse.json(
        { success: false, error: 'deviceType query parameter is required' },
        { status: 400 }
      )
    }

    const registry = DriverRegistry.getInstance()
    const driver = registry.getDriver(deviceType)

    if (!driver) {
      return NextResponse.json(
        { success: false, error: `No driver registered for device type: ${deviceType}` },
        { status: 404 }
      )
    }

    await registry.disconnectDevice(deviceType)

    return NextResponse.json({
      success: true,
      data: {
        driverState: driver.getState(),
      },
      message: `Driver for ${deviceType} disconnected`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect driver' },
      { status: 500 }
    )
  }
}
