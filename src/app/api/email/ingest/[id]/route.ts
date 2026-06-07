// ============================================================
// mnemosyne v3.0.0 — Email Ingest API
// POST /api/email/ingest/[id]  — Ingest an email into memory
//
// This endpoint triggers the full ingestion pipeline:
//   1. Extract text content from the email (plain text → HTML fallback)
//   2. Create a Mnemosyne Note with email metadata
//   3. Store the note content as chunks with embeddings (via storeMemory)
//   4. Link the Note back to the EmailMessage
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EmailManager } from '@/lib/email'

// ============================================================
// POST /api/email/ingest/[id]
// ============================================================

export async function POST(
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

    // Ingest the email via EmailManager
    const emailManager = EmailManager.getInstance()

    let noteId: string
    try {
      noteId = await emailManager.ingestEmail(id, userId)
    } catch (ingestError) {
      const message =
        ingestError instanceof Error ? ingestError.message : 'Ingestion failed'

      if (message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: 'Email message not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { success: false, error: `Email ingestion failed: ${message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        emailMessageId: id,
        noteId,
        ingested: true,
      },
    })
  } catch (error) {
    console.error('POST /api/email/ingest/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to ingest email' },
      { status: 500 }
    )
  }
}
