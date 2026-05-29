import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

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
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const skip = (page - 1) * limit

    const [decisions, total] = await Promise.all([
      db.decision.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.decision.count({ where: { userId } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        decisions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/decisions error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch decisions' },
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
    const body = await request.json()
    const { title, context, decision, reasoning, outcome, evaluation, relatedNoteIds } = body

    if (!title || !decision) {
      return NextResponse.json(
        { success: false, error: 'Title and decision are required' },
        { status: 400 }
      )
    }

    const newDecision = await db.decision.create({
      data: {
        userId,
        title,
        context: context ?? '',
        decision,
        reasoning: reasoning ?? '',
        outcome: outcome ?? null,
        evaluation: evaluation ?? null,
        relatedNoteIds: relatedNoteIds ? JSON.stringify(relatedNoteIds) : '[]',
      },
    })

    return NextResponse.json(
      { success: true, data: newDecision },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/decisions error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create decision' },
      { status: 500 }
    )
  }
}
