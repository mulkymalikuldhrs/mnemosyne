// ============================================================
// MNEMOSYNE v2.0.0 — AI Memory Pipeline API
// POST /api/ai-memory-v2 — Add memories from conversation (mem0-inspired pipeline)
// GET  /api/ai-memory-v2 — Search memories with hybrid search
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMemoryPipeline } from '@/lib/memory/pipeline'
import { z } from 'zod'

const addMemorySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1),
    })
  ).min(1),
  agentId: z.string().optional(),
  runId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

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

    const parsed = addMemorySchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { messages, agentId, runId, metadata } = parsed.data
    const pipeline = getMemoryPipeline()

    const records = await pipeline.add({
      messages,
      userId,
      agentId,
      runId,
      metadata,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          memoriesAdded: records.length,
          memories: records.map((r) => ({
            id: r.id,
            text: r.text,
            attributedTo: r.attributedTo,
            event: r.event,
          })),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/ai-memory-v2 error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add memories' },
      { status: 500 }
    )
  }
}

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
    const query = searchParams.get('q') || searchParams.get('query')

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const topK = Math.min(
      Math.max(1, parseInt(searchParams.get('topK') ?? '10', 10)),
      100
    )
    const threshold = Math.min(
      Math.max(0, parseFloat(searchParams.get('threshold') ?? '0.3')),
      1
    )

    const pipeline = getMemoryPipeline()
    const results = await pipeline.search(query, userId, topK, threshold)

    return NextResponse.json({
      success: true,
      data: {
        query,
        results,
        total: results.length,
      },
    })
  } catch (error) {
    console.error('GET /api/ai-memory-v2 error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search memories' },
      { status: 500 }
    )
  }
}
