/**
 * GET /api/llm/models — List all available LLM models
 *
 * Public API: Returns the full model registry including free models (Puter.js)
 * and BYOK models. This is the "API for everybody" endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import { MODEL_REGISTRY, getFreeModels, searchModels, PROVIDER_GROUPS } from '@/lib/llm/providers'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const free = searchParams.get('free')
  const provider = searchParams.get('provider')
  const search = searchParams.get('q')
  const capability = searchParams.get('cap')

  let models = [...MODEL_REGISTRY]

  // Filter: free only
  if (free === 'true' || free === '1') {
    models = getFreeModels()
  }

  // Filter: by provider
  if (provider) {
    models = models.filter(m =>
      m.provider === provider || m.providerLabel.toLowerCase() === provider.toLowerCase()
    )
  }

  // Filter: by capability
  if (capability) {
    models = models.filter(m => m.capabilities.includes(capability as any))
  }

  // Search
  if (search) {
    models = searchModels(search)
  }

  return NextResponse.json({
    success: true,
    data: {
      models,
      providers: Object.keys(PROVIDER_GROUPS),
      total: models.length,
      freeCount: models.filter(m => m.isFree).length,
    },
  })
}
