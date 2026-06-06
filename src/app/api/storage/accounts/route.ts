import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { StorageManager } from '@/lib/storage'
import type { CloudStorageProvider, StorageCredentials } from '@/lib/storage'
import { z } from 'zod'

const VALID_PROVIDERS: CloudStorageProvider[] = [
  'google_drive',
  'terabox',
  's3',
  'dropbox',
  'onedrive',
  'local',
]

const addAccountSchema = z.object({
  provider: z.string().refine(
    (val): val is CloudStorageProvider => VALID_PROVIDERS.includes(val as CloudStorageProvider),
    { message: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` }
  ),
  name: z.string().min(1, 'Account name is required').max(100, 'Account name too long'),
  credentials: z.record(z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'Credentials object must not be empty' }
  ),
  folderPath: z.string().max(500).optional(),
})

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
    const storageManager = StorageManager.getInstance()

    const accounts = await storageManager.listAccounts(userId)

    // Also get file counts for each account
    const accountsWithCounts = await Promise.all(
      accounts.map(async (account) => {
        const fileCount = await db.cloudFile.count({
          where: { storageAccountId: account.id },
        })
        return {
          ...account,
          fileCount,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        accounts: accountsWithCounts,
        total: accountsWithCounts.length,
      },
    })
  } catch (error) {
    console.error('GET /api/storage/accounts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch storage accounts' },
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
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = addAccountSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { provider, name, credentials, folderPath } = parsed.data

    // Check if user already has an account with the same name
    const existingAccount = await db.cloudStorageAccount.findFirst({
      where: { userId, name },
    })
    if (existingAccount) {
      return NextResponse.json(
        { success: false, error: 'An account with this name already exists' },
        { status: 409 }
      )
    }

    const storageManager = StorageManager.getInstance()

    try {
      const account = await storageManager.addAccount(
        userId,
        provider,
        name,
        credentials as StorageCredentials,
        folderPath ?? '/'
      )

      return NextResponse.json(
        {
          success: true,
          data: account,
        },
        { status: 201 }
      )
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to authenticate with the provider'
      return NextResponse.json(
        { success: false, error: `Storage provider authentication failed: ${message}` },
        { status: 422 }
      )
    }
  } catch (error) {
    console.error('POST /api/storage/accounts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add storage account' },
      { status: 500 }
    )
  }
}
