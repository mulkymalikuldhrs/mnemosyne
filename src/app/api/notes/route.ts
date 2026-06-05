import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { storeMemory } from '@/ai/memory'
import { z } from 'zod'

const noteCreateSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100000),
  markdown: z.string().max(100000).optional(),
  tags: z.string().max(1000).optional(),
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

    // Pagination with cap
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)), 100)
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = { userId }

    // Search filter
    const search = searchParams.get('search')
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ]
    }

    // Archived filter
    const archived = searchParams.get('archived')
    if (archived === 'true') {
      where.isArchived = true
    } else if (archived === 'false') {
      where.isArchived = false
    }

    // Tags filter
    const tags = searchParams.get('tags')
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim().toLowerCase())
      // SQLite doesn't have array contains, so we filter at app level
      // We'll add a simple contains check for each tag
      const tagConditions = tagList.map((tag) => ({
        tags: { contains: tag },
      }))
      if (tagConditions.length > 0) {
        where.AND = tagConditions
      }
    }

    const [notes, total] = await Promise.all([
      db.note.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { chunks: true, sourceLinks: true, targetLinks: true },
          },
        },
      }),
      db.note.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        notes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/notes error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notes' },
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
    const parsed = noteCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { title, content, markdown, tags } = parsed.data

    // Create the note
    const note = await db.note.create({
      data: {
        userId,
        title,
        content,
        markdown: markdown ?? content,
        tags: tags ?? '',
      },
    })

    // Trigger memory storage in the background (don't await to keep response fast)
    storeMemory(note.id, content, userId).catch((err) => {
      console.error('Background memory storage failed:', err)
    })

    return NextResponse.json(
      { success: true, data: note },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/notes error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create note' },
      { status: 500 }
    )
  }
}
