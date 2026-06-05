import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { storeMemory, deleteMemory } from '@/ai/memory'
import { z } from 'zod'

const noteUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100000).optional(),
  markdown: z.string().max(100000).optional(),
  tags: z.string().max(1000).optional(),
  isArchived: z.boolean().optional(),
})

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

    const note = await db.note.findFirst({
      where: { id, userId },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
        sourceLinks: {
          include: {
            targetNote: {
              select: { id: true, title: true },
            },
          },
        },
        targetLinks: {
          include: {
            sourceNote: {
              select: { id: true, title: true },
            },
          },
        },
      },
    })

    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    // Combine related notes from both directions
    const relatedNotes = [
      ...note.sourceLinks.map((link) => ({
        id: link.targetNote.id,
        title: link.targetNote.title,
        relationScore: link.relationScore,
        reason: link.reason,
        autoLinked: link.autoLinked,
      })),
      ...note.targetLinks.map((link) => ({
        id: link.sourceNote.id,
        title: link.sourceNote.title,
        relationScore: link.relationScore,
        reason: link.reason,
        autoLinked: link.autoLinked,
      })),
    ]

    return NextResponse.json({
      success: true,
      data: {
        ...note,
        relatedNotes,
      },
    })
  } catch (error) {
    console.error('GET /api/notes/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch note' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const parsed = noteUpdateSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await db.note.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    const { title, content, markdown, tags, isArchived } = parsed.data
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (markdown !== undefined) updateData.markdown = markdown
    if (tags !== undefined) updateData.tags = tags
    if (isArchived !== undefined) updateData.isArchived = isArchived

    const note = await db.note.update({
      where: { id },
      data: updateData,
    })

    // Re-trigger memory storage if content changed
    if (content !== undefined) {
      storeMemory(note.id, content, userId).catch((err) => {
        console.error('Background memory re-storage failed:', err)
      })
    }

    return NextResponse.json({
      success: true,
      data: note,
    })
  } catch (error) {
    console.error('PUT /api/notes/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update note' },
      { status: 500 }
    )
  }
}

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
    const existing = await db.note.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    // Delete memory (chunks + links) first
    await deleteMemory(id)

    // Delete the note itself
    await db.note.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: { id },
    })
  } catch (error) {
    console.error('DELETE /api/notes/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete note' },
      { status: 500 }
    )
  }
}
