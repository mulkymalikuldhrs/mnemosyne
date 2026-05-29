import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getMemoryContext, storeMemory } from '@/ai/memory'

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
    const q = searchParams.get('q')

    if (!q) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const context = await getMemoryContext(q, userId)

    return NextResponse.json({
      success: true,
      data: context,
    })
  } catch (error) {
    console.error('GET /api/memory error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get memory context' },
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

    // Get all user's notes
    const notes = await db.note.findMany({
      where: { userId },
      select: { id: true, content: true },
    })

    if (notes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { reindexed: 0, message: 'No notes to re-index' },
      })
    }

    // Re-index all notes
    let reindexed = 0
    const errors: string[] = []

    for (const note of notes) {
      try {
        await storeMemory(note.id, note.content, userId)
        reindexed++
      } catch (err) {
        console.error(`Failed to re-index note ${note.id}:`, err)
        errors.push(`Note ${note.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reindexed,
        total: notes.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error) {
    console.error('POST /api/memory error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to re-index memory' },
      { status: 500 }
    )
  }
}
