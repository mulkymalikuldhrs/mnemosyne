/**
 * POST /api/llm/compare — Multi-Model Comparison
 *
 * Run the same prompt across multiple models simultaneously.
 * This is the killer feature for comparing LLM outputs side by side.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LLMRouter } from '@/lib/llm'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { prompt, models, temperature, maxTokens } = body

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 })
    }

    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ success: false, error: 'Models array is required' }, { status: 400 })
    }

    if (models.length > 10) {
      return NextResponse.json({ success: false, error: 'Maximum 10 models per comparison' }, { status: 400 })
    }

    const config = { temperature, maxTokens }
    const results = await LLMRouter.compare(prompt, models, config)

    return NextResponse.json({
      success: true,
      data: {
        prompt,
        results: results.map(r => ({
          model: r.model,
          content: r.response?.content || '',
          provider: r.response?.provider,
          usage: r.response?.usage,
          error: r.error,
        })),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
