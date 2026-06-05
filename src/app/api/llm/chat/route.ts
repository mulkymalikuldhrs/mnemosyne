// ============================================================
// MEMORIX IOT - LLM Chat Stream API Route
// POST /api/llm/chat — Streaming & non-streaming chat with AI
// Supports tool calling (Hermes tools, MCP tools), conversation
// memory, and SSE streaming output
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getLLMService } from '@/lib/llm'
import { validateApiKey } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import type { ChatMessage, ChatParams } from '@/lib/llm'
import type { AgentName } from '@/lib/types'

// --- Request/Response Types ---

interface ChatRequestBody {
  messages: ChatMessage[]
  model?: string
  stream?: boolean
  temperature?: number
  maxTokens?: number
  tools?: string[]
  missionId?: string
  agentName?: AgentName
  includeContext?: boolean
}

// ============================================================
// POST: Chat endpoint
// ============================================================

export async function POST(request: NextRequest) {
  const rateLimitError = rateLimit(request, { windowMs: 60000, maxRequests: 20 })
  if (rateLimitError) return rateLimitError

  const authError = validateApiKey(request)
  if (authError) return authError

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
      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        return NextResponse.json(
          { success: false, error: `Invalid message role: ${msg.role}. Must be system, user, assistant, or tool` },
          { status: 400 }
        )
      }
    }

    const llm = getLLMService()

    // Build system context if requested
    let systemContext
    if (body.includeContext !== false) {
      try {
        systemContext = await llm.buildSystemContext(body.missionId)
      } catch (error) {
        // Continue without context
      }
    }

    const params: ChatParams = {
      messages: body.messages,
      model: body.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      stream: body.stream,
      tools: body.tools,
      missionId: body.missionId,
      agentName: body.agentName,
      systemContext,
    }

    // --- Streaming Response ---
    if (body.stream) {
      return handleStreamResponse(params)
    }

    // --- Non-Streaming Response ---
    const result = await llm.chat(params)

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        model: result.model,
        usage: result.usage,
        toolCalls: result.toolCalls,
        finishReason: result.finishReason,
      },
    })
  } catch (error) {

    if (error instanceof Error && error.message.includes('Rate limit')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 429 }
      )
    }

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

async function handleStreamResponse(params: ChatParams): Promise<NextResponse> {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const llm = getLLMService()

      try {
        for await (const chunk of llm.chatStream(params)) {
          const sseData = formatSSE(chunk as unknown as Record<string, unknown>)
          controller.enqueue(encoder.encode(sseData))
        }

        // Send final done event
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
      } catch (error) {
        const errorData = formatSSE({
          type: 'error',
          error: error instanceof Error ? error.message : 'Stream failed',
        })
        controller.enqueue(encoder.encode(errorData))
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

// --- SSE Formatting ---

function formatSSE(chunk: Record<string, unknown>): string {
  const eventType = chunk.type || 'message'

  // Serialize the chunk data without the type (type goes into event name)
  const { type: _, ...data } = chunk

  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
}
