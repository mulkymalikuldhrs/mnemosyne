// ============================================================
// MEMORIX — LLM Chat Stream API Route
// POST /api/llm/chat — Streaming & non-streaming chat with AI
// Uses z-ai-web-dev-sdk with memory context injection
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { chatWithMemory, type ChatMessage } from '@/ai/llm'
import { validateApiKey } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// --- Request/Response Types ---

interface ChatRequestBody {
  messages: ChatMessage[]
  conversationId?: string
  stream?: boolean
}

// ============================================================
// POST: Chat endpoint with memory context
// ============================================================

export async function POST(request: NextRequest) {
  // Authentication: Try session first, then API key
  let userId: string | null = null

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    userId = session.user.id
  } else {
    // Try API key authentication
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '') || request.headers.get('x-api-key')

    if (apiKey) {
      userId = await validateApiKey(apiKey as string)
    }
  }

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json() as ChatRequestBody

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messages array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate message format
    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { success: false, error: 'Each message must have role and content' },
          { status: 400 }
        )
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { success: false, error: `Invalid message role: ${msg.role}` },
          { status: 400 }
        )
      }
    }

    // --- Streaming Response ---
    if (body.stream) {
      return handleStreamResponse(body.messages, userId, body.conversationId)
    }

    // --- Non-Streaming Response ---
    const result = await chatWithMemory(body.messages, userId, body.conversationId)

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        memoryRefs: result.memoryRefs,
        tokenUsage: result.tokenUsage,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Chat request failed',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Streaming Response Handler
// ============================================================

async function handleStreamResponse(
  messages: ChatMessage[],
  userId: string,
  conversationId?: string
): Promise<NextResponse> {
  const { chatWithMemory } = await import('@/ai/llm')

  // For streaming, we first get the full response then stream it
  // This is because the z-ai-web-dev-sdk doesn't support streaming directly
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await chatWithMemory(messages, userId, conversationId)

        // Stream the content word by word for a typing effect
        const words = result.content.split(' ')
        for (let i = 0; i < words.length; i++) {
          const chunk = {
            type: 'content',
            content: i === 0 ? words[i] : ' ' + words[i],
            memoryRefs: i === words.length - 1 ? result.memoryRefs : undefined,
          }
          const sseData = `event: content\ndata: ${JSON.stringify(chunk)}\n\n`
          controller.enqueue(encoder.encode(sseData))

          // Small delay for typing effect
          await new Promise((resolve) => setTimeout(resolve, 20))
        }

        // Send final done event with metadata
        const doneData = {
          type: 'done',
          tokenUsage: result.tokenUsage,
          memoryRefs: result.memoryRefs,
        }
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`))
      } catch (error) {
        const errorData = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Stream failed',
        }
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
