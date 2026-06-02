import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
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

    // Verify the note belongs to the user
    const note = await db.note.findFirst({
      where: { id, userId },
    })

    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    // Get wiki links pointing TO this note
    const wikiLinksRaw = await db.wikiLink.findMany({
      where: { targetNoteId: id },
      include: {
        sourceNote: {
          select: { id: true, title: true, content: true, userId: true },
        },
      },
    })

    // Filter to only include links from the same user's notes
    const wikiLinks = wikiLinksRaw
      .filter((wl) => wl.sourceNote.userId === userId)
      .map((wl) => {
        // Extract context around the link
        const content = wl.sourceNote.content
        const linkIndex = content.indexOf(`[[${wl.linkText}]]`)
        let context = ''
        if (linkIndex >= 0) {
          const start = Math.max(0, linkIndex - 60)
          const end = Math.min(content.length, linkIndex + wl.linkText.length + 62)
          context =
            (start > 0 ? '...' : '') +
            content.slice(start, end) +
            (end < content.length ? '...' : '')
        } else {
          // Fallback: just show the link text
          context = `[[${wl.linkText}]]`
        }

        return {
          sourceNoteId: wl.sourceNote.id,
          sourceNoteTitle: wl.sourceNote.title,
          linkText: wl.linkText,
          context,
        }
      })

    // Get memory links pointing TO this note
    const memoryLinksRaw = await db.memoryLink.findMany({
      where: { targetNoteId: id },
      include: {
        sourceNote: {
          select: { id: true, title: true, userId: true },
        },
      },
    })

    // Filter to only include links from the same user's notes
    const memoryLinks = memoryLinksRaw
      .filter((ml) => ml.sourceNote.userId === userId)
      .map((ml) => ({
        sourceNoteId: ml.sourceNote.id,
        sourceNoteTitle: ml.sourceNote.title,
        relationScore: ml.relationScore,
        reason: ml.reason,
      }))

    return NextResponse.json({
      success: true,
      data: { wikiLinks, memoryLinks },
    })
  } catch (error) {
    console.error('GET /api/notes/[id]/backlinks error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch backlinks' },
      { status: 500 }
    )
  }
}
