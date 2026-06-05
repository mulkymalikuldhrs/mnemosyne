// ============================================================
// MEMORIX IOT - Flash & Code Deploy API
// GET  /api/flash — List firmware, active operations, history
// POST /api/flash — Start firmware flash or code deploy
// PUT  /api/flash — Cancel operation, verify firmware
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FlashService } from '@/lib/flash'
import { validateApiKey } from '@/lib/auth'
import type { FlashTarget, CodeTarget, FlashOptions, DeployOptions } from '@/lib/flash'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const target = searchParams.get('target') as FlashTarget | null
    const operationId = searchParams.get('operationId')

    const flashService = FlashService.getInstance()

    // List available firmware for a target
    if (action === 'firmware' && target) {
      const validTargets: FlashTarget[] = ['pixhawk', 'companion', 'esc', 'radio']
      if (!validTargets.includes(target)) {
        return NextResponse.json(
          { success: false, error: `Invalid target. Must be one of: ${validTargets.join(', ')}` },
          { status: 400 }
        )
      }
      const firmware = await flashService.listAvailableFirmware(target)
      return NextResponse.json({
        success: true,
        data: { target, firmware },
      })
    }

    // Get operation status
    if (action === 'status' && operationId) {
      const operation = await flashService.getOperationStatus(operationId)
      if (!operation) {
        return NextResponse.json(
          { success: false, error: 'Operation not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        data: operation,
      })
    }

    // Verify firmware on target
    if (action === 'verify' && target) {
      const validTargets: FlashTarget[] = ['pixhawk', 'companion', 'esc', 'radio']
      if (!validTargets.includes(target)) {
        return NextResponse.json(
          { success: false, error: `Invalid target. Must be one of: ${validTargets.join(', ')}` },
          { status: 400 }
        )
      }
      const verification = await flashService.verifyFirmware(target)
      return NextResponse.json({
        success: true,
        data: verification,
      })
    }

    // Default: list active operations and history
    const activeOperations = flashService.getActiveOperations()
    const operationHistory = flashService.getOperationHistory()

    return NextResponse.json({
      success: true,
      data: {
        activeOperations,
        operationHistory,
        activeCount: activeOperations.length,
        historyCount: operationHistory.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve flash information' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    const flashService = FlashService.getInstance()

    // Start firmware flash
    if (action === 'flash') {
      const { target, firmwareVersion, options } = body as {
        target: FlashTarget
        firmwareVersion: string
        options?: FlashOptions
      }

      if (!target || !firmwareVersion) {
        return NextResponse.json(
          { success: false, error: 'target and firmwareVersion are required' },
          { status: 400 }
        )
      }

      if (typeof firmwareVersion !== 'string' || firmwareVersion.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'firmwareVersion must be a non-empty string' },
          { status: 400 }
        )
      }

      if (firmwareVersion.trim().length > 100) {
        return NextResponse.json(
          { success: false, error: 'firmwareVersion must not exceed 100 characters' },
          { status: 400 }
        )
      }

      const validTargets: FlashTarget[] = ['pixhawk', 'companion', 'esc', 'radio']
      if (!validTargets.includes(target)) {
        return NextResponse.json(
          { success: false, error: `Invalid target. Must be one of: ${validTargets.join(', ')}` },
          { status: 400 }
        )
      }

      const operation = await flashService.flashFirmware(target, firmwareVersion, options)

      return NextResponse.json({
        success: true,
        data: operation,
        message: `Firmware flash started: ${firmwareVersion} on ${target}`,
      }, { status: 201 })
    }

    // Start code deployment
    if (action === 'deploy') {
      const { target, codePath, options } = body as {
        target: CodeTarget
        codePath: string
        options?: DeployOptions
      }

      if (!target || !codePath) {
        return NextResponse.json(
          { success: false, error: 'target and codePath are required' },
          { status: 400 }
        )
      }

      if (typeof codePath !== 'string' || codePath.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'codePath must be a non-empty string' },
          { status: 400 }
        )
      }

      const validCodeTargets: CodeTarget[] = ['companion', 'agent']
      if (!validCodeTargets.includes(target)) {
        return NextResponse.json(
          { success: false, error: `Invalid code target. Must be one of: ${validCodeTargets.join(', ')}` },
          { status: 400 }
        )
      }

      const operation = await flashService.deployCode(target, codePath, options)

      return NextResponse.json({
        success: true,
        data: operation,
        message: `Code deployment started: ${codePath} on ${target}`,
      }, { status: 201 })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "flash" or "deploy"' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to start flash/deploy operation' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    const flashService = FlashService.getInstance()

    // Cancel operation
    if (action === 'cancel') {
      const { operationId } = body as { operationId: string }

      if (!operationId) {
        return NextResponse.json(
          { success: false, error: 'operationId is required' },
          { status: 400 }
        )
      }

      const cancelled = await flashService.cancelOperation(operationId)

      if (!cancelled) {
        return NextResponse.json(
          { success: false, error: 'Operation not found or cannot be cancelled (already completed/failed)' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Operation ${operationId} cancelled`,
      })
    }

    // Verify firmware
    if (action === 'verify') {
      const { target } = body as { target: FlashTarget }

      if (!target) {
        return NextResponse.json(
          { success: false, error: 'target is required' },
          { status: 400 }
        )
      }

      const validTargets: FlashTarget[] = ['pixhawk', 'companion', 'esc', 'radio']
      if (!validTargets.includes(target)) {
        return NextResponse.json(
          { success: false, error: `Invalid target. Must be one of: ${validTargets.join(', ')}` },
          { status: 400 }
        )
      }

      const verification = await flashService.verifyFirmware(target)

      return NextResponse.json({
        success: true,
        data: verification,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "cancel" or "verify"' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process flash operation' },
      { status: 500 }
    )
  }
}
