// ============================================================
// MEMORIX IOT - Hardware Detection & Management API
// GET  /api/hardware — List all hardware devices with profiles
// POST /api/hardware — Trigger hardware detection scan (DB-based)
// PUT  /api/hardware — Update device status/profile
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const rateLimitError = rateLimit(request, { windowMs: 60000, maxRequests: 60 })
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const deviceType = searchParams.get('deviceType')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (deviceType) where.deviceType = deviceType

    const devices = await db.hardwareDevice.findMany({
      where,
      include: {
        profiles: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get summary stats using groupBy instead of fetching all devices
    const [totalCount, statusGroups, typeGroups] = await Promise.all([
      db.hardwareDevice.count(),
      db.hardwareDevice.groupBy({ by: ['status'], _count: { status: true } }),
      db.hardwareDevice.groupBy({ by: ['deviceType'], _count: { deviceType: true } }),
    ])

    const stats = {
      total: totalCount,
      byStatus: Object.fromEntries(statusGroups.map(g => [g.status, g._count.status])) as Record<string, number>,
      byType: Object.fromEntries(typeGroups.map(g => [g.deviceType, g._count.deviceType])) as Record<string, number>,
    }

    return NextResponse.json({
      success: true,
      data: {
        devices,
        stats,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve hardware devices' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimitError = rateLimit(request, { windowMs: 60000, maxRequests: 60 })
  if (rateLimitError) return rateLimitError

  try {
    // Real hardware detection: query the database for existing devices
    // and check their last-seen timestamps to determine current status.
    // Detect newly appeared devices by comparing against previously known offline devices.
    const existingDevices = await db.hardwareDevice.findMany()
    let newDevices = 0
    let updatedDevices = 0
    let offlineDevices = 0

    // Track which device IDs were previously offline so we can count
    // devices that come back online as "newly detected"
    const previouslyOffline = new Set(
      existingDevices.filter(d => d.status === 'offline').map(d => d.id)
    )

    for (const device of existingDevices) {
      const timeSinceLastSeen = Date.now() - new Date(device.lastSeen).getTime()
      const isStale = timeSinceLastSeen > 60000 // 1 minute

      if (isStale && device.status !== 'offline') {
        // Mark stale devices as offline
        await db.hardwareDevice.update({
          where: { id: device.id },
          data: { status: 'offline' },
        })
        offlineDevices++
      } else if (!isStale && device.status === 'offline') {
        // Mark recently-seen offline devices as active — count as new detection
        await db.hardwareDevice.update({
          where: { id: device.id },
          data: { status: 'active', lastSeen: new Date() },
        })
        if (previouslyOffline.has(device.id)) {
          newDevices++
        }
        updatedDevices++
      } else if (!isStale) {
        // Update lastSeen for active devices
        await db.hardwareDevice.update({
          where: { id: device.id },
          data: { lastSeen: new Date() },
        })
        updatedDevices++
      }
    }

    // Also detect devices that were in "detected" or "unknown" status
    // and have now been initialized — count those as newDevices too
    for (const device of existingDevices) {
      if (
        (device.status === 'detected' || device.status === 'unknown') &&
        !previouslyOffline.has(device.id)
      ) {
        const timeSinceLastSeen = Date.now() - new Date(device.lastSeen).getTime()
        const isRecent = timeSinceLastSeen <= 60000
        if (isRecent) {
          newDevices++
        }
      }
    }

    // Create alert for scan result
    await db.alert.create({
      data: {
        level: 'info',
        source: 'system',
        title: 'Hardware Scan Complete',
        message: `Scan checked ${existingDevices.length} devices. Updated: ${updatedDevices}, Offline: ${offlineDevices}`,
        category: 'hardware',
        isRead: false,
      },
    })

    const finalDevices = await db.hardwareDevice.findMany({
      include: { profiles: true },
      orderBy: { lastSeen: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        scanned: existingDevices.length,
        newDevices,
        updatedDevices,
        offlineDevices,
        devices: finalDevices,
      },
      message: `Hardware scan complete: ${updatedDevices} updated, ${offlineDevices} offline`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to perform hardware scan' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const rateLimitError = rateLimit(request, { windowMs: 60000, maxRequests: 60 })
  if (rateLimitError) return rateLimitError

  try {
    const body = await request.json()
    const { deviceId, status, profileId, profileConfig, name, deviceType } = body as {
      deviceId?: string
      status?: string
      profileId?: string
      profileConfig?: Record<string, unknown>
      name?: string
      deviceType?: string
    }

    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'deviceId is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Validate status if provided
    const validStatuses = ['active', 'offline', 'detected', 'initialized', 'error', 'unknown']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const device = await db.hardwareDevice.findUnique({
      where: { id: deviceId },
    })

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Update device status
    const updateData: Record<string, unknown> = {
      lastSeen: new Date(),
    }

    if (status) {
      updateData.status = status
    }

    if (name) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'name must be a non-empty string' },
          { status: 400 }
        )
      }
      if (name.trim().length > 200) {
        return NextResponse.json(
          { success: false, error: 'name must not exceed 200 characters' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (deviceType) {
      const validDeviceTypes = ['flight_controller', 'companion_computer', 'gps', 'camera', 'sensor', 'radio', 'battery', 'motor', 'servo', 'esc']
      if (typeof deviceType !== 'string' || !validDeviceTypes.includes(deviceType)) {
        return NextResponse.json(
          { success: false, error: `Invalid deviceType. Must be one of: ${validDeviceTypes.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.deviceType = deviceType
    }

    await db.hardwareDevice.update({
      where: { id: deviceId },
      data: updateData,
    })

    // Update profile config
    if (profileId && profileConfig) {
      await db.hardwareProfile.update({
        where: { id: profileId },
        data: { config: JSON.stringify(profileConfig) },
      })
    }

    const updatedDevice = await db.hardwareDevice.findUnique({
      where: { id: deviceId },
      include: { profiles: true },
    })

    return NextResponse.json({
      success: true,
      data: updatedDevice,
      message: 'Device updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update hardware device' },
      { status: 500 }
    )
  }
}
