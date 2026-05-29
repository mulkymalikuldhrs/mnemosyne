import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchMemory } from '@/ai/memory'

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
    const limit = parseInt(searchParams.get('limit') ?? '10', 10)

    if (!q) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const results = await searchMemory(q, userId, limit)

    return NextResponse.json({
      success: true,
      data: {
        query: q,
        results,
        count: results.length,
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
