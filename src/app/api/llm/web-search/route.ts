/**
 * POST /api/llm/web-search — Web Search via z-ai-web-dev-sdk
 *
 * Used by the AI Agent's web_search tool.
 * Also available as a standalone API for external consumers.
 */
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, num = 10 } = body

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 })
    }

    const zai = await ZAI.create()
    const searchResult = await zai.functions.invoke('web_search', { query, num })

    return NextResponse.json({
      success: true,
      data: {
        results: searchResult,
        query,
        count: Array.isArray(searchResult) ? searchResult.length : 0,
      },
    })
  } catch (error: any) {
    console.error('Web search error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
