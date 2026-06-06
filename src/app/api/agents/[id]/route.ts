import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const agentUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(10000).optional(),
  capabilities: z.record(z.unknown()).optional(),
  mcpEnabled: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const agent = await db.agentProfile.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...agent,
        capabilities: JSON.parse(agent.capabilities),
      },
    })
  } catch (error) {
    console.error('GET /api/agents/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent profile' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = agentUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const existing = await db.agentProfile.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Agent profile not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    const { capabilities, ...rest } = parsed.data

    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    if (capabilities !== undefined) {
      updateData.capabilities = JSON.stringify(capabilities)
    }

    const updated = await db.agentProfile.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        capabilities: JSON.parse(updated.capabilities),
      },
    })
  } catch (error) {
    console.error('PUT /api/agents/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update agent profile' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    const existing = await db.agentProfile.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Agent profile not found' },
        { status: 404 }
      )
    }

    // Clear this agent as the active agent for any users that reference it
    await db.user.updateMany({
      where: { agentProfileId: id },
      data: { agentProfileId: null },
    })

    await db.agentProfile.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('DELETE /api/agents/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete agent profile' },
      { status: 500 }
    )
  }
}
