// ============================================================
// mnemosyne v3.0.0 — Email Message by ID API
// GET    /api/email/messages/[id]  — Get specific email message
// DELETE /api/email/messages/[id]  — Delete an email message
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ============================================================
// GET /api/email/messages/[id]
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

    const message = await db.emailMessage.findFirst({
      where: { id, userId },
      include: {
        emailAccount: {
          select: {
            id: true,
            provider: true,
            email: true,
            emailAddress: true,
            displayName: true,
          },
        },
        note: {
          select: {
            id: true,
            title: true,
            tags: true,
            createdAt: true,
          },
        },
      },
    })

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Email message not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields for convenience
    const parsedLabels = safeJsonParse(message.labels)
    const parsedToAddresses = safeJsonParse(message.toAddresses)

    return NextResponse.json({
      success: true,
      data: {
        ...message,
        labels: parsedLabels,
        toAddresses: parsedToAddresses,
      },
    })
  } catch (error) {
    console.error('GET /api/email/messages/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email message' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/email/messages/[id]
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
    const existing = await db.emailMessage.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Email message not found' },
        { status: 404 }
      )
    }

    // Delete the message
    await db.emailMessage.delete({
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
    console.error('DELETE /api/email/messages/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete email message' },
      { status: 500 }
    )
  }
}

// --- Helpers ---

function safeJsonParse(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString)
  } catch {
    return jsonString
  }
}
