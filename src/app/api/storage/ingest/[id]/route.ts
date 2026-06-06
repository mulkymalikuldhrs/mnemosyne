import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { StorageManager } from '@/lib/storage'
import type { IngestFileResult } from '@/lib/storage'
import { z } from 'zod'

const ingestOptionsSchema = z.object({
  force: z.boolean().optional().default(false),
  tags: z.string().max(1000).optional(),
  noteTitle: z.string().max(500).optional(),
})

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

    // Verify the file belongs to the user
    const file = await db.cloudFile.findFirst({
      where: { id, userId },
      include: {
        storageAccount: {
          select: {
            id: true,
            provider: true,
            name: true,
            isEnabled: true,
          },
        },
      },
    })

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      )
    }

    if (!file.storageAccount.isEnabled) {
      return NextResponse.json(
        { success: false, error: 'The storage account for this file is disabled. Enable it before ingesting.' },
        { status: 400 }
      )
    }

    // Parse optional ingest options from the request body
    let options: z.infer<typeof ingestOptionsSchema> = { force: false }
    try {
      const body = await request.json()
      const parsed = ingestOptionsSchema.safeParse(body)
      if (parsed.success) {
        options = parsed.data
      }
    } catch {
      // No body or invalid body is fine — use defaults
    }

    // Check if there's an existing note linked to this file (to avoid duplicate ingestion)
    if (!options.force) {
      const existingNote = await db.note.findFirst({
        where: {
          userId,
          title: `[Cloud] ${file.name}`,
        },
        select: { id: true, title: true, createdAt: true },
      })

      if (existingNote) {
        return NextResponse.json(
          {
            success: false,
            error: 'This file has already been ingested. Use { "force": true } to re-ingest.',
            data: {
              existingNoteId: existingNote.id,
              existingNoteTitle: existingNote.title,
            },
          },
          { status: 409 }
        )
      }
    }

    const storageManager = StorageManager.getInstance()

    try {
      const ingestResult: IngestFileResult = await storageManager.ingestFile(id, userId)

      // If custom tags or title were provided, update the created note
      if (options.tags || options.noteTitle) {
        const updateData: Record<string, unknown> = {}
        if (options.noteTitle) {
          updateData.title = options.noteTitle
        }
        if (options.tags) {
          // Merge with existing tags
          const existingNote = await db.note.findUnique({
            where: { id: ingestResult.noteId },
            select: { tags: true },
          })
          const existingTags = existingNote?.tags ? existingNote.tags.split(',') : []
          const newTags = options.tags.split(',').map((t) => t.trim())
          const mergedTags = [...new Set([...existingTags, ...newTags])].filter(Boolean)
          updateData.tags = mergedTags.join(',')
        }

        await db.note.update({
          where: { id: ingestResult.noteId },
          data: updateData,
        })
      }

      // Get the final note details
      const note = await db.note.findUnique({
        where: { id: ingestResult.noteId },
        include: {
          _count: {
            select: { chunks: true },
          },
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          fileId: id,
          fileName: file.name,
          provider: file.storageAccount.provider,
          noteId: ingestResult.noteId,
          noteTitle: note?.title ?? `[Cloud] ${file.name}`,
          chunksCreated: ingestResult.chunksCreated,
          textPreview: ingestResult.textExtracted,
          metadata: ingestResult.metadata,
          totalChunks: note?._count.chunks ?? ingestResult.chunksCreated,
        },
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ingestion failed'

      // Determine the appropriate status code based on the error
      let statusCode = 422
      if (message.includes('not found')) {
        statusCode = 404
      } else if (message.includes('not synced')) {
        statusCode = 400
      } else if (message.includes('cannot be ingested') || message.includes('too large')) {
        statusCode = 422
      }

      return NextResponse.json(
        { success: false, error: message },
        { status: statusCode }
      )
    }
  } catch (error) {
    console.error('POST /api/storage/ingest/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to ingest file' },
      { status: 500 }
    )
  }
}
