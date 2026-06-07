// ============================================================
// MEMORIX v3.0.0 — Email Accounts API
// GET  /api/email/accounts  — List all email accounts for the authenticated user
// POST /api/email/accounts  — Add a new email account (Gmail, IMAP, Outlook)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailManager } from '@/lib/email'
import { z } from 'zod'

// --- Validation Schemas ---

const emailAccountCreateSchema = z.object({
  provider: z.enum(['gmail', 'imap', 'outlook']),
  email: z.string().email('Invalid email address'),
  displayName: z.string().max(200).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  redirectUri: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  imapTls: z.boolean().optional(),
  smtpTls: z.boolean().optional(),
})

// ============================================================
// GET /api/email/accounts
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
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        email: true,
        emailAddress: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        smtpHost: true,
        smtpPort: true,
        isEnabled: true,
        isSyncing: true,
        syncError: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
        // Deliberately exclude accessToken and refreshToken for security
      },
    })

    // Mask sensitive data and add message count
    const enrichedAccounts = await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        messageCount: await db.emailMessage.count({
          where: { emailAccountId: account.id },
        }),
      }))
    )

    return NextResponse.json({
      success: true,
      data: {
        accounts: enrichedAccounts,
        count: enrichedAccounts.length,
      },
    })
  } catch (error) {
    console.error('GET /api/email/accounts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email accounts' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/email/accounts
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
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = emailAccountCreateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check if an account with this email already exists for this user
    const existing = await db.emailAccount.findUnique({
      where: { userId_email: { userId, email: data.email } },
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `An email account with address "${data.email}" already exists`,
        },
        { status: 409 }
      )
    }

    // Validate credentials by authenticating with the provider
    const emailManager = EmailManager.getInstance()
    try {
      const provider = await emailManager.getProvider(data.provider, undefined, {
        provider: data.provider,
        emailAddress: data.email,
        displayName: data.displayName,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        redirectUri: data.redirectUri,
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        username: data.username,
        password: data.password,
        imapTls: data.imapTls,
        smtpTls: data.smtpTls,
      })

      // Disconnect the provider after validation (it will be re-instantiated during sync)
      await provider.disconnect()
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : 'Authentication failed'
      return NextResponse.json(
        {
          success: false,
          error: `Email account authentication failed: ${message}`,
        },
        { status: 400 }
      )
    }

    // Create the email account in the database
    const account = await db.emailAccount.create({
      data: {
        userId,
        provider: data.provider,
        email: data.email,
        emailAddress: data.email,
        displayName: data.displayName ?? '',
        accessToken: data.accessToken ?? '',
        refreshToken: data.refreshToken ?? '',
        imapHost: data.imapHost ?? null,
        imapPort: data.imapPort ?? (data.provider !== 'gmail' ? 993 : null),
        smtpHost: data.smtpHost ?? null,
        smtpPort: data.smtpPort ?? (data.provider !== 'gmail' ? 587 : null),
      },
      select: {
        id: true,
        provider: true,
        email: true,
        emailAddress: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        smtpHost: true,
        smtpPort: true,
        isEnabled: true,
        isSyncing: true,
        syncError: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: account,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/email/accounts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add email account' },
      { status: 500 }
    )
  }
}
