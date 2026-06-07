/**
 * POST /api/llm/agent — AI Agent Execution
 *
 * Run the built-in AI agent with tool calling.
 * The agent can search memory, save notes, track decisions, and search the web.
 * Uses any LLM from our multi-provider pool (Puter.js = FREE).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AgentEngine, DEFAULT_AGENT_CONFIG, TOOL_REGISTRY } from '@/lib/agent'
import type { AgentConfig } from '@/lib/agent'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { message, model, tools, systemPrompt, maxIterations, apiKey, provider } = body

    // Always use session user ID — never trust client-supplied userId
    const userId = (session.user as any).id

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 })
    }

    const config: AgentConfig = {
      ...DEFAULT_AGENT_CONFIG,
      ...(model && { model }),
      ...(provider && { provider }),
      ...(systemPrompt && { systemPrompt }),
      ...(maxIterations && { maxIterations }),
      ...(apiKey && { apiKey }),
      ...(tools && Array.isArray(tools) && { tools }),
    }

    const context = {
      userId,
      conversationId: body.conversationId,
      memoryRefs: [],
      metadata: body.metadata || {},
    }

    const engine = new AgentEngine(config, context)
    const result = await engine.run(message)

    return NextResponse.json({
      success: true,
      data: {
        response: result.finalResponse,
        toolCallsMade: result.toolCallsMade,
        memoryRefs: result.memoryRefs,
        model: result.model,
        iterations: result.iterations,
        messages: result.messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.toolCalls && { toolCalls: m.toolCalls }),
          ...(m.name && { toolName: m.name }),
        })),
      },
    })
  } catch (error: any) {
    console.error('Agent error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/llm/agent — Get available agent tools and config
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      defaultConfig: {
        name: DEFAULT_AGENT_CONFIG.name,
        description: DEFAULT_AGENT_CONFIG.description,
        model: DEFAULT_AGENT_CONFIG.model,
        maxIterations: DEFAULT_AGENT_CONFIG.maxIterations,
      },
      availableTools: Object.entries(TOOL_REGISTRY).map(([name, tool]) => ({
        name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  })
}
