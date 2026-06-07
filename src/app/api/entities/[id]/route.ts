import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const entityUpdateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  type: z.enum(['person', 'project', 'concept', 'topic', 'organization', 'tool', 'event']).optional(),
  description: z.string().max(5000).optional(),
  properties: z.record(z.string(), z.any()).optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(500).optional(),
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
    const entity = await db.memoryEntity.findFirst({
      where: { id, userId: session.user.id },
      include: {
        sourceRelations: {
          include: {
            targetEntity: {
              select: { id: true, name: true, type: true },
            },
          },
        },
        targetRelations: {
          include: {
            sourceEntity: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
    })

    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Entity not found' },
        { status: 404 }
      )
    }

    const outgoing = entity.sourceRelations.map((r) => ({
      id: r.id,
      relationType: r.relationType,
      direction: 'outgoing' as const,
      targetEntity: r.targetEntity,
      properties: JSON.parse(r.properties),
      validFrom: r.validFrom,
      validTo: r.validTo,
      confidence: r.confidence,
      source: r.source,
      createdAt: r.createdAt,
    }))

    const incoming = entity.targetRelations.map((r) => ({
      id: r.id,
      relationType: r.relationType,
      direction: 'incoming' as const,
      sourceEntity: r.sourceEntity,
      properties: JSON.parse(r.properties),
      validFrom: r.validFrom,
      validTo: r.validTo,
      confidence: r.confidence,
      source: r.source,
      createdAt: r.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        ...entity,
        properties: JSON.parse(entity.properties),
        relations: [...outgoing, ...incoming],
      },
    })
  } catch (error) {
    console.error('GET /api/entities/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entity' },
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

    const parsed = entityUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const existing = await db.memoryEntity.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entity not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    const { properties, validFrom, validTo, ...rest } = parsed.data

    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    if (properties !== undefined) {
      updateData.properties = JSON.stringify(properties)
    }

    if (validFrom !== undefined) {
      updateData.validFrom = validFrom ? new Date(validFrom) : null
    }

    if (validTo !== undefined) {
      updateData.validTo = validTo ? new Date(validTo) : null
    }

    const updated = await db.memoryEntity.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        properties: JSON.parse(updated.properties),
      },
    })
  } catch (error) {
    console.error('PUT /api/entities/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update entity' },
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

    const existing = await db.memoryEntity.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entity not found' },
        { status: 404 }
      )
    }

    // Cascade delete will handle relations
    await db.memoryEntity.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('DELETE /api/entities/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete entity' },
      { status: 500 }
    )
  }
}
