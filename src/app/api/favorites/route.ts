import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const favoriteCreateSchema = z.object({
  noteId: z.string().min(1),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    const favorites = await db.favorite.findMany({
      where: { userId },
      include: {
        note: {
          select: {
            id: true,
            title: true,
            content: true,
            tags: true,
            isArchived: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: { favorites },
    })
  } catch (error) {
    console.error('GET /api/favorites error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch favorites' },
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

    const parsed = favoriteCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { noteId } = parsed.data

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

    // Check if already favorited
    const existing = await db.favorite.findUnique({
      where: {
        userId_noteId: { userId, noteId },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Note is already in favorites' },
        { status: 409 }
      )
    }

    const favorite = await db.favorite.create({
      data: { userId, noteId },
    })

    return NextResponse.json(
      { success: true, data: favorite },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/favorites error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add favorite' },
      { status: 500 }
    )
  }
}
