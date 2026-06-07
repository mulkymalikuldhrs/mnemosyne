// ============================================================
// MEMORIX v3.0.0 — Email Account by ID API
// GET    /api/email/accounts/[id]  — Get specific email account
// DELETE /api/email/accounts/[id]  — Remove an email account
// PATCH  /api/email/accounts/[id]  — Update email account settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmailManager } from '@/lib/email'
import { z } from 'zod'

// --- Validation Schema ---

const emailAccountUpdateSchema = z.object({
  displayName: z.string().max(200).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  isEnabled: z.boolean().optional(),
})

// ============================================================
// GET /api/email/accounts/[id]
// ============================================================

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

    const account = await db.emailAccount.findFirst({
      where: { id, userId },
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
        // Deliberately exclude accessToken and refreshToken
      },
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Email account not found' },
        { status: 404 }
      )
    }

    // Add message count
    const messageCount = await db.emailMessage.count({
      where: { emailAccountId: id },
    })

    // Add ingest count
    const ingestedCount = await db.emailMessage.count({
      where: { emailAccountId: id, isIngested: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...account,
        messageCount,
        ingestedCount,
      },
    })
  } catch (error) {
    console.error('GET /api/email/accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email account' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/email/accounts/[id]
// ============================================================

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
    const existing = await db.emailAccount.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Email account not found' },
        { status: 404 }
      )
    }

    // Disconnect the active provider if cached
    const emailManager = EmailManager.getInstance()
    await emailManager.disconnectProvider(id)

    // Delete the account (cascades to email messages)
    await db.emailAccount.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: {
        id,
        deleted: true,
      },
    })
  } catch (error) {
    console.error('DELETE /api/email/accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete email account' },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/email/accounts/[id]
// ============================================================

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
    const existing = await db.emailAccount.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Email account not found' },
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

    const parsed = emailAccountUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    const { displayName, accessToken, refreshToken, imapHost, imapPort, smtpHost, smtpPort, isEnabled } = parsed.data

    if (displayName !== undefined) updateData.displayName = displayName
    if (accessToken !== undefined) updateData.accessToken = accessToken
    if (refreshToken !== undefined) updateData.refreshToken = refreshToken
    if (imapHost !== undefined) updateData.imapHost = imapHost
    if (imapPort !== undefined) updateData.imapPort = imapPort
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled

    // If tokens changed, disconnect the cached provider so it re-authenticates next time
    if (accessToken !== undefined || refreshToken !== undefined) {
      const emailManager = EmailManager.getInstance()
      await emailManager.disconnectProvider(id)
    }

    const account = await db.emailAccount.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({
      success: true,
      data: account,
    })
  } catch (error) {
    console.error('PATCH /api/email/accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update email account' },
      { status: 500 }
    )
  }
}
