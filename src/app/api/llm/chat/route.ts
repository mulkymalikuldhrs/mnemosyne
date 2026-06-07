/**
 * POST /api/llm/chat — Universal Chat API
 *
 * The middle-provider API that routes to Puter.js (free) or BYOK.
 * This is the "API for everybody" — can be called from anywhere.
 * No backend needed because Puter.js handles auth client-side.
 *
 * Request body:
 *   model: string (e.g., "openai/gpt-5.4-nano")
 *   messages: { role, content }[]
 *   temperature?: number
 *   maxTokens?: number
 *   stream?: boolean
 *   tools?: LLMTool[]
 *   apiKey?: string (for BYOK)
 *   provider?: string
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LLMRouter } from '@/lib/llm'
import { getModelById } from '@/lib/llm/providers'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { model, messages, temperature, maxTokens, stream, tools, apiKey, provider } = body

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model is required' },
        { status: 400 }
      )
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Messages array is required' },
        { status: 400 }
      )
    }

    const modelInfo = getModelById(model)
    const resolvedProvider = provider || modelInfo?.provider || 'puter'

    const config = {
      provider: resolvedProvider as any,
      model,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens || 2048,
      stream: false,
      tools,
      apiKey,
    }

    // For streaming, return a streaming response
    if (stream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of LLMRouter.stream(config, messages)) {
              const data = JSON.stringify(chunk)
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Non-streaming
    const response = await LLMRouter.chat(config, messages)

    return NextResponse.json({
      success: true,
      data: {
        content: response.content,
        model: response.model,
        provider: response.provider,
        toolCalls: response.toolCalls,
        usage: response.usage,
        finishReason: response.finishReason,
      },
    })
  } catch (error: any) {
    console.error('LLM chat error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
