// ============================================================
// MEMORIX v3.0.0 — Email Sync API
// POST /api/email/sync  — Trigger sync for a specific account or all accounts
// GET  /api/email/sync  — Get sync status for all accounts
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailManager } from '@/lib/email'
import { z } from 'zod'

// --- Validation Schema ---

const syncRequestSchema = z.object({
  accountId: z.string().optional(), // If omitted, sync all accounts
})

// ============================================================
// POST /api/email/sync
// ============================================================

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
    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is OK — defaults to syncing all accounts
    }

    const parsed = syncRequestSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { accountId } = parsed.data
    const emailManager = EmailManager.getInstance()

    // Sync a specific account
    if (accountId) {
      // Verify the account belongs to this user
      const account = await db.emailAccount.findFirst({
        where: { id: accountId, userId },
      })

      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Email account not found' },
          { status: 404 }
        )
      }

      if (!account.isEnabled) {
        return NextResponse.json(
          { success: false, error: 'Email account is disabled' },
          { status: 400 }
        )
      }

      try {
        const result = await emailManager.syncAccount(accountId)
        return NextResponse.json({
          success: true,
          data: {
            accountId,
            provider: account.provider,
            email: account.email,
            synced: result.synced,
            errors: result.errors,
            cursor: result.cursor,
          },
        })
      } catch (syncError) {
        const message =
          syncError instanceof Error ? syncError.message : 'Sync failed'
        return NextResponse.json(
          {
            success: false,
            error: `Email sync failed for account ${account.email}: ${message}`,
          },
          { status: 500 }
        )
      }
    }

    // Sync all enabled accounts for this user
    const accounts = await db.emailAccount.findMany({
      where: { userId, isEnabled: true },
    })

    if (accounts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No enabled email accounts to sync' },
        { status: 400 }
      )
    }

    const results: Array<{ accountId: string; provider: string; email: string; synced: number; errors: number; cursor: string }> = []
    const errors: Array<{ accountId: string; email: string; error: string }> = []

    for (const account of accounts) {
      try {
        const result = await emailManager.syncAccount(account.id)
        results.push({
          accountId: account.id,
          provider: account.provider,
          email: account.email,
          synced: result.synced,
          errors: result.errors,
          cursor: result.cursor,
        })
      } catch (syncError) {
        const message =
          syncError instanceof Error ? syncError.message : 'Sync failed'
        errors.push({
          accountId: account.id,
          email: account.email,
          error: message,
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      data: {
        results,
        errors,
        totalAccounts: accounts.length,
        syncedAccounts: results.length,
        failedAccounts: errors.length,
      },
    })
  } catch (error) {
    console.error('POST /api/email/sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync email accounts' },
      { status: 500 }
    )
  }
}

// ============================================================
// GET /api/email/sync
// ============================================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    const accounts = await db.emailAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        email: true,
        emailAddress: true,
        displayName: true,
        isEnabled: true,
        isSyncing: true,
        syncError: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    })

    // Add message counts per account
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        const [totalMessages, ingestedMessages, unreadMessages] =
          await Promise.all([
            db.emailMessage.count({
              where: { emailAccountId: account.id },
            }),
            db.emailMessage.count({
              where: { emailAccountId: account.id, isIngested: true },
            }),
            db.emailMessage.count({
              where: { emailAccountId: account.id, isRead: false },
            }),
          ])

        return {
          ...account,
          totalMessages,
          ingestedMessages,
          unreadMessages,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        accounts: accountsWithStats,
        totalAccounts: accounts.length,
        syncingAccounts: accounts.filter((a) => a.isSyncing).length,
        errorAccounts: accounts.filter((a) => a.syncError).length,
      },
    })
  } catch (error) {
    console.error('GET /api/email/sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}
