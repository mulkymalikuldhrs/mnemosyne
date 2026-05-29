import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchMemory } from '@/ai/memory'
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
      q: searchParams.get('q'),
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { q, limit } = parsed.data

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
