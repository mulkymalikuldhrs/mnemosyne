import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const integrationCreateSchema = z.object({
  provider: z.enum(['composio', 'mcp_client', 'custom']),
  name: z.string().min(1).max(200),
  config: z.record(z.string(), z.any()).optional(),
  isEnabled: z.boolean().optional(),
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

    const where: Record<string, unknown> = { userId }

    const provider = searchParams.get('provider')
    if (provider) {
      where.provider = provider
    }

    const isEnabled = searchParams.get('isEnabled')
    if (isEnabled === 'true') {
      where.isEnabled = true
    } else if (isEnabled === 'false') {
      where.isEnabled = false
    }

    const search = searchParams.get('search')
    if (search) {
      where.name = { contains: search }
    }

    const [integrations, total] = await Promise.all([
      db.integration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.integration.count({ where }),
    ])

    const parsedIntegrations = integrations.map((integration) => ({
      ...integration,
      config: JSON.parse(integration.config),
    }))

    return NextResponse.json({
      success: true,
      data: {
        integrations: parsedIntegrations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/integrations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integrations' },
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

    const parsed = integrationCreateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { provider, name, config, isEnabled } = parsed.data

    const integration = await db.integration.create({
      data: {
        userId,
        provider,
        name,
        config: JSON.stringify(config ?? {}),
        isEnabled: isEnabled ?? true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...integration,
          config: JSON.parse(integration.config),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/integrations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create integration' },
      { status: 500 }
    )
  }
}
