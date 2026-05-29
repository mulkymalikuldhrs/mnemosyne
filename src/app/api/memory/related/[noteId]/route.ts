import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { findRelatedNotes } from '@/ai/memory'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
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
    const { noteId } = await params

    // Verify the note belongs to the user
    const note = await db.note.findFirst({
      where: { id: noteId, userId },
    })

    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    const relatedNotes = await findRelatedNotes(noteId, userId)

    return NextResponse.json({
      success: true,
      data: {
        noteId,
        relatedNotes,
      },
    })
  } catch (error) {
    console.error('GET /api/memory/related/[noteId] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to find related notes' },
      { status: 500 }
    )
  }
}
