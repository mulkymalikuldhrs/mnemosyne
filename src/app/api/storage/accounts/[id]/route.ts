import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { StorageManager } from '@/lib/storage'
import { z } from 'zod'

const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
  folderPath: z.string().max(500).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { id } = await params

    const account = await db.cloudStorageAccount.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { files: true },
        },
      },
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Storage account not found' },
        { status: 404 }
      )
    }

    // Return account without exposing sensitive credentials
    const safeAccount = {
      id: account.id,
      provider: account.provider,
      name: account.name,
      folderPath: account.folderPath,
      isEnabled: account.isEnabled,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      fileCount: account._count.files,
      hasAccessToken: !!account.accessToken,
      hasRefreshToken: !!account.refreshToken,
    }

    return NextResponse.json({
      success: true,
      data: safeAccount,
    })
  } catch (error) {
    console.error('GET /api/storage/accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch storage account' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.cloudStorageAccount.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Storage account not found' },
        { status: 404 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = updateAccountSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    // Build update data, only including fields that were provided
    const updateData: Record<string, unknown> = {}
    const { name, isEnabled, folderPath, accessToken, refreshToken } = parsed.data

    if (name !== undefined) updateData.name = name
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled
    if (folderPath !== undefined) updateData.folderPath = folderPath
    if (accessToken !== undefined) updateData.accessToken = accessToken
    if (refreshToken !== undefined) updateData.refreshToken = refreshToken

    const updated = await db.cloudStorageAccount.update({
      where: { id },
      data: updateData,
    })

    // If credentials were updated, reset the cached provider so it re-authenticates
    if (accessToken !== undefined || refreshToken !== undefined) {
      const storageManager = StorageManager.getInstance()
      const provider = storageManager.getProvider(
        updated.provider as 'google_drive' | 'terabox' | 's3' | 'dropbox' | 'onedrive' | 'local'
      )
      // Force re-authentication by marking as not authenticated
      // The provider's isAuthenticated flag is managed internally
      try {
        await storageManager.getAuthenticatedProvider(id)
      } catch {
        // Credentials may be invalid now; still save the update
      }
    }

    // Return safe account data without exposing full credentials
    const safeAccount = {
      id: updated.id,
      provider: updated.provider,
      name: updated.name,
      folderPath: updated.folderPath,
      isEnabled: updated.isEnabled,
      lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: safeAccount,
    })
  } catch (error) {
    console.error('PATCH /api/storage/accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update storage account' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.cloudStorageAccount.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Storage account not found' },
        { status: 404 }
      )
    }

    const storageManager = StorageManager.getInstance()
    await storageManager.removeAccount(id)

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    })
  } catch (error) {
    console.error('DELETE /api/storage/accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete storage account' },
      { status: 500 }
    )
  }
}
