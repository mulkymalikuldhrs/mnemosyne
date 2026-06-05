// ============================================================
// MEMORIX IOT - Face Tracking API Route
// GET    /api/face-tracking — Get tracking status, detected faces, face database, stats
// POST   /api/face-tracking — Start/stop tracking, register face, identify, delete
// PUT    /api/face-tracking — Update tracking config (mode, confidence threshold)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getFaceTrackingService } from '@/lib/face-tracking'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const service = getFaceTrackingService()

    switch (action) {
      case 'status': {
        const status = service.getTrackingStatus()
        return NextResponse.json({ success: true, data: status })
      }

      case 'detect': {
        const faces = await service.detectFaces()
        return NextResponse.json({ success: true, data: { faces, total: faces.length } })
      }

      case 'faces': {
        const allFaces = await service.getAllFaces()
        return NextResponse.json({ success: true, data: { faces: allFaces, total: allFaces.length } })
      }

      case 'stats': {
        const stats = await service.getStats()
        return NextResponse.json({ success: true, data: stats })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid actions: status, detect, faces, stats` },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get face tracking data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const service = getFaceTrackingService()

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: 'action is required in request body' },
        { status: 400 }
      )
    }

    switch (body.action) {
      case 'start': {
        const mode = body.mode as 'follow' | 'detect' | 'identify' | undefined
        await service.startTracking(mode)
        return NextResponse.json({ success: true, data: { message: 'Tracking started', mode: mode || service.getConfig().trackingMode } })
      }

      case 'stop': {
        await service.stopTracking()
        return NextResponse.json({ success: true, data: { message: 'Tracking stopped' } })
      }

      case 'register': {
        const { name, label, face, photoPath, metadata } = body
        if (!name || !label || !face) {
          return NextResponse.json(
            { success: false, error: 'name, label, and face (detected face data) are required' },
            { status: 400 }
          )
        }
        const entry = await service.registerFace(name, label, face, photoPath, metadata)
        return NextResponse.json({ success: true, data: entry }, { status: 201 })
      }

      case 'identify': {
        const { face } = body
        if (!face) {
          return NextResponse.json(
            { success: false, error: 'face (detected face data) is required' },
            { status: 400 }
          )
        }
        const result = await service.identifyFace(face)
        if (!result) {
          return NextResponse.json(
            { success: true, data: { identified: false, message: 'No matching face found in database' } }
          )
        }
        return NextResponse.json({ success: true, data: { identified: true, person: result } })
      }

      case 'delete': {
        const { faceProfileId } = body
        if (!faceProfileId) {
          return NextResponse.json(
            { success: false, error: 'faceProfileId is required' },
            { status: 400 }
          )
        }
        const deleted = await service.deleteFace(faceProfileId)
        if (!deleted) {
          return NextResponse.json(
            { success: false, error: `Face profile ${faceProfileId} not found or could not be deleted` },
            { status: 404 }
          )
        }
        return NextResponse.json({ success: true, data: { message: 'Face profile deleted', faceProfileId } })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${body.action}. Valid actions: start, stop, register, identify, delete` },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process face tracking action' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const service = getFaceTrackingService()

    // Update tracking configuration
    const { trackingMode, confidenceThreshold, enabled, maxFaces, followDistance } = body
    const updates: Record<string, unknown> = {}

    if (trackingMode !== undefined) {
      const validModes = ['follow', 'detect', 'identify']
      if (!validModes.includes(trackingMode)) {
        return NextResponse.json(
          { success: false, error: `Invalid trackingMode. Must be one of: ${validModes.join(', ')}` },
          { status: 400 }
        )
      }
      updates.trackingMode = trackingMode
    }

    if (confidenceThreshold !== undefined) {
      const threshold = Number(confidenceThreshold)
      if (isNaN(threshold) || threshold < 0 || threshold > 1) {
        return NextResponse.json(
          { success: false, error: 'confidenceThreshold must be a number between 0 and 1' },
          { status: 400 }
        )
      }
      updates.confidenceThreshold = threshold
    }

    if (enabled !== undefined) {
      updates.enabled = Boolean(enabled)
    }

    if (maxFaces !== undefined) {
      const max = Number(maxFaces)
      if (isNaN(max) || max < 1 || max > 20) {
        return NextResponse.json(
          { success: false, error: 'maxFaces must be a number between 1 and 20' },
          { status: 400 }
        )
      }
      updates.maxFaces = max
    }

    if (followDistance !== undefined) {
      const dist = Number(followDistance)
      if (isNaN(dist) || dist < 50 || dist > 500) {
        return NextResponse.json(
          { success: false, error: 'followDistance must be a number between 50 and 500' },
          { status: 400 }
        )
      }
      updates.followDistance = dist
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid configuration fields provided. Available: trackingMode, confidenceThreshold, enabled, maxFaces, followDistance' },
        { status: 400 }
      )
    }

    await service.updateConfig(updates)
    const newConfig = service.getConfig()

    return NextResponse.json({
      success: true,
      data: {
        message: 'Tracking configuration updated',
        updatedFields: Object.keys(updates),
        config: newConfig,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update face tracking config' },
      { status: 500 }
    )
  }
}
