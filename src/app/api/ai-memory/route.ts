// ============================================================
// mnemosyne — AI Memory API Route
// GET/POST/DELETE /api/ai-memory — AI memory management
// Requires authentication (session or API key)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { AiMemoryService } from '@/lib/ai-memory'
import { validateApiKey } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

/**
 * Helper: Get authenticated user ID from request
 */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  // Try session first
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    return session.user.id
  }

  // Try API key
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '') || request.headers.get('x-api-key')
  if (apiKey) {
    return await validateApiKey(apiKey as string)
  }

  return null
}

// ============================================================
// GET: Retrieve AI memory entries
// ============================================================

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const service = AiMemoryService.getInstance()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as string | undefined
    const query = searchParams.get('query') as string | undefined

    if (searchParams.get('stats') === 'true') {
      const stats = await service.getStats()
      return NextResponse.json({ success: true, data: stats })
    }

    if (searchParams.get('syncStatus') === 'true') {
      const status = await service.getSyncStatus()
      return NextResponse.json({ success: true, data: status })
    }

    const entries = await service.search(
      category as 'conversation' | 'decision' | 'learning' | 'pattern' | 'preference' | undefined,
      query || undefined
    )
    return NextResponse.json({ success: true, data: entries })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: Create or manage AI memory entries
// ============================================================

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const service = AiMemoryService.getInstance()

    if (body.action === 'sync') {
      const result = await service.syncToCloud()
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'pull') {
      const result = await service.pullFromCloud()
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'retryFailed') {
      const result = await service.retryFailedSyncs()
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'recall') {
      const entry = await service.recall(body.category, body.key)
      return NextResponse.json({ success: true, data: entry })
    }

    const entry = await service.remember(
      body.category,
      body.key,
      body.value,
      body.context,
      body.confidence || 1.0,
      body.projectId
    )
    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE: Remove AI memory entry
// ============================================================

export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const memoryId = searchParams.get('memoryId')

    if (!memoryId || typeof memoryId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'memoryId query parameter is required' },
        { status: 400 }
      )
    }

    const service = AiMemoryService.getInstance()
    const deleted = await service.forget(memoryId)
    return NextResponse.json({ success: deleted })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
