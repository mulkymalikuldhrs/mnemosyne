import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchMemory } from '@/ai/memory'
import { db } from '@/lib/db'
import { z } from 'zod'

const searchQuerySchema = z.object({
  q: z.string().min(1).max(2000),
  limit: z.coerce.number().int().min(1).max(50).default(10),
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
    const parsed = searchQuerySchema.safeParse({
      q: searchParams.get('q') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { q, limit } = parsed.data

    const results = await searchMemory(q, userId, limit)

    // Enrich results with note metadata (tags, dates, archive status)
    const noteIds = [...new Set(results.map((r) => r.noteId))]
    const notesMeta = noteIds.length > 0
      ? await db.note.findMany({
          where: { id: { in: noteIds }, userId },
          select: { id: true, tags: true, createdAt: true, updatedAt: true, isArchived: true },
        })
      : []

    const notesMap = new Map(notesMeta.map((n) => [n.id, n]))

    const enrichedResults = results.map((r) => {
      const meta = notesMap.get(r.noteId)
      return {
        ...r,
        tags: meta?.tags ? meta.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        createdAt: meta?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: meta?.updatedAt?.toISOString() || new Date().toISOString(),
        isArchived: meta?.isArchived || false,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        query: q,
        results: enrichedResults,
        count: enrichedResults.length,
      },
    })
  } catch (error) {
    console.error('GET /api/search error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search memory' },
      { status: 500 }
    )
  }
}
