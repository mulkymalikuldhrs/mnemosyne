import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const agentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(10000).optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  mcpEnabled: z.boolean().optional(),
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

    const mcpEnabled = searchParams.get('mcpEnabled')
    if (mcpEnabled === 'true') {
      where.mcpEnabled = true
    } else if (mcpEnabled === 'false') {
      where.mcpEnabled = false
    }

    const search = searchParams.get('search')
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [agents, total] = await Promise.all([
      db.agentProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.agentProfile.count({ where }),
    ])

    const parsedAgents = agents.map((agent) => ({
      ...agent,
      capabilities: JSON.parse(agent.capabilities),
    }))

    return NextResponse.json({
      success: true,
      data: {
        agents: parsedAgents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/agents error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent profiles' },
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

    const parsed = agentCreateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, description, systemPrompt, capabilities, mcpEnabled } = parsed.data

    const agent = await db.agentProfile.create({
      data: {
        userId,
        name,
        description: description ?? '',
        systemPrompt: systemPrompt ?? '',
        capabilities: JSON.stringify(capabilities ?? {}),
        mcpEnabled: mcpEnabled ?? false,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...agent,
          capabilities: JSON.parse(agent.capabilities),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/agents error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create agent profile' },
      { status: 500 }
    )
  }
}
