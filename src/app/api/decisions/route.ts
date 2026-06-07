import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const decisionCreateSchema = z.object({
  title: z.string().min(1).max(500),
  context: z.string().max(10000).optional(),
  decision: z.string().min(1).max(10000),
  reasoning: z.string().max(10000).optional(),
  outcome: z.string().max(10000).optional(),
  evaluation: z.string().max(10000).optional(),
  relatedNoteIds: z.array(z.string()).optional(),
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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)), 100)
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
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const parsed = decisionCreateSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { title, context, decision, reasoning, outcome, evaluation, relatedNoteIds } = parsed.data

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
