import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { StorageManager } from '@/lib/storage'
import type { SyncResult } from '@/lib/storage'
import { z } from 'zod'

const syncRequestSchema = z.object({
  storageAccountId: z.string().optional(),
})

// In-memory tracking for ongoing sync operations
const activeSyncs = new Map<string, { startedAt: string; status: string }>()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get all storage accounts for the user with their sync status
    const accounts = await db.cloudStorageAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { files: true },
        },
      },
    })

    const syncStatuses = accounts.map((account) => {
      const activeSync = activeSyncs.get(account.id)
      return {
        id: account.id,
        provider: account.provider,
        name: account.name,
        isEnabled: account.isEnabled,
        lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
        totalFiles: account._count.files,
        isSyncing: activeSync?.status === 'syncing' ?? false,
        syncStartedAt: activeSync?.startedAt ?? null,
      }
    })

    // Summary stats
    const totalAccounts = accounts.length
    const enabledAccounts = accounts.filter((a) => a.isEnabled).length
    const syncingAccounts = syncStatuses.filter((s) => s.isSyncing).length
    const neverSynced = accounts.filter((a) => !a.lastSyncedAt).length

    return NextResponse.json({
      success: true,
      data: {
        accounts: syncStatuses,
        summary: {
          totalAccounts,
          enabledAccounts,
          syncingAccounts,
          neverSynced,
        },
      },
    })
  } catch (error) {
    console.error('GET /api/storage/sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    let body: unknown
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsed = syncRequestSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { storageAccountId } = parsed.data
    const storageManager = StorageManager.getInstance()

    if (storageAccountId) {
      // Sync a specific account
      const account = await db.cloudStorageAccount.findFirst({
        where: { id: storageAccountId, userId },
      })

      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Storage account not found' },
          { status: 404 }
        )
      }

      if (!account.isEnabled) {
        return NextResponse.json(
          { success: false, error: 'Storage account is disabled. Enable it before syncing.' },
          { status: 400 }
        )
      }

      // Check if already syncing
      if (activeSyncs.get(storageAccountId)?.status === 'syncing') {
        return NextResponse.json(
          { success: false, error: 'This account is already being synced. Please wait for the current sync to complete.' },
          { status: 409 }
        )
      }

      // Mark as syncing
      activeSyncs.set(storageAccountId, {
        startedAt: new Date().toISOString(),
        status: 'syncing',
      })

      try {
        const result: SyncResult = await storageManager.syncAccount(storageAccountId)

        return NextResponse.json({
          success: true,
          data: {
            storageAccountId,
            provider: account.provider,
            name: account.name,
            result,
          },
        })
      } finally {
        activeSyncs.delete(storageAccountId)
      }
    } else {
      // Sync all enabled accounts
      const accounts = await db.cloudStorageAccount.findMany({
        where: { userId, isEnabled: true },
      })

      if (accounts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No enabled storage accounts to sync' },
          { status: 400 }
        )
      }

      const results: Array<{
        storageAccountId: string
        provider: string
        name: string
        result: SyncResult | null
        error: string | null
      }> = []

      for (const account of accounts) {
        // Skip accounts that are already syncing
        if (activeSyncs.get(account.id)?.status === 'syncing') {
          results.push({
            storageAccountId: account.id,
            provider: account.provider,
            name: account.name,
            result: null,
            error: 'Already syncing — skipped',
          })
          continue
        }

        activeSyncs.set(account.id, {
          startedAt: new Date().toISOString(),
          status: 'syncing',
        })

        try {
          const result = await storageManager.syncAccount(account.id)
          results.push({
            storageAccountId: account.id,
            provider: account.provider,
            name: account.name,
            result,
            error: null,
          })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Sync failed'
          results.push({
            storageAccountId: account.id,
            provider: account.provider,
            name: account.name,
            result: null,
            error: message,
          })
        } finally {
          activeSyncs.delete(account.id)
        }
      }

      const successful = results.filter((r) => r.result !== null).length
      const failed = results.filter((r) => r.error !== null).length

      return NextResponse.json({
        success: true,
        data: {
          results,
          summary: {
            total: accounts.length,
            successful,
            failed,
          },
        },
      })
    }
  } catch (error) {
    console.error('POST /api/storage/sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync storage accounts' },
      { status: 500 }
    )
  }
}
