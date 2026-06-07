import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const wikiLinkCreateSchema = z.object({
  noteId: z.string().min(1),
  links: z.array(
    z.object({
      targetTitle: z.string().min(1).max(500),
      linkText: z.string().min(1).max(500),
    })
  ).min(1).max(100),
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
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''

    if (q.length < 1) {
      return NextResponse.json({
        success: true,
        data: { notes: [] },
      })
    }

    const results = await db.note.findMany({
      where: {
        userId,
        title: { contains: q },
        isArchived: false,
      },
      select: { id: true, title: true },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: { notes: results },
    })
  } catch (error) {
    console.error('GET /api/wiki-links error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search note titles' },
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

    const parsed = wikiLinkCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { noteId, links } = parsed.data

    // Verify the source note belongs to the user
    const sourceNote = await db.note.findFirst({
      where: { id: noteId, userId },
    })

    if (!sourceNote) {
      return NextResponse.json(
        { success: false, error: 'Source note not found' },
        { status: 404 }
      )
    }

    // Resolve target titles to note IDs
    const targetTitles = [...new Set(links.map((l) => l.targetTitle))]
    const targetNotes = await db.note.findMany({
      where: {
        userId,
        title: { in: targetTitles },
        isArchived: false,
      },
      select: { id: true, title: true },
    })

    const titleToId = new Map(targetNotes.map((n) => [n.title, n.id]))

    // Delete existing wiki links from this note
    await db.wikiLink.deleteMany({
      where: { sourceNoteId: noteId },
    })

    // Create new wiki links
    const createdLinks: Array<{ id: string; sourceNoteId: string; targetNoteId: string; linkText: string }> = []
    for (const link of links) {
      const targetNoteId = titleToId.get(link.targetTitle)
      if (targetNoteId && targetNoteId !== noteId) {
        const wikiLink = await db.wikiLink.upsert({
          where: {
            sourceNoteId_targetNoteId_linkText: {
              sourceNoteId: noteId,
              targetNoteId,
              linkText: link.linkText,
            },
          },
          create: {
            sourceNoteId: noteId,
            targetNoteId,
            linkText: link.linkText,
          },
          update: {},
        })
        createdLinks.push(wikiLink)
      }
    }

    return NextResponse.json({
      success: true,
      data: { links: createdLinks },
    })
  } catch (error) {
    console.error('POST /api/wiki-links error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create wiki links' },
      { status: 500 }
    )
  }
}
