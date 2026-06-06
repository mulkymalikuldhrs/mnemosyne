import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const relationCreateSchema = z.object({
  targetEntityId: z.string().min(1),
  relationType: z.string().min(1).max(200),
  properties: z.record(z.unknown()).optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(500).optional(),
})

export async function GET(
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

    const { id: entityId } = await params
    const userId = session.user.id

    // Verify entity ownership
    const entity = await db.memoryEntity.findFirst({
      where: { id: entityId, userId },
    })

    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Entity not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const relationType = searchParams.get('relationType')
    const direction = searchParams.get('direction') ?? 'all' // all | outgoing | incoming

    const where: Record<string, unknown> = { userId }
    if (relationType) {
      where.relationType = relationType
    }

    let outgoingWhere: Record<string, unknown> = { ...where, sourceEntityId: entityId }
    let incomingWhere: Record<string, unknown> = { ...where, targetEntityId: entityId }

    if (relationType) {
      outgoingWhere.relationType = relationType
      incomingWhere.relationType = relationType
    }

    const fetchOutgoing = direction === 'all' || direction === 'outgoing'
    const fetchIncoming = direction === 'all' || direction === 'incoming'

    const [outgoing, incoming] = await Promise.all([
      fetchOutgoing
        ? db.memoryRelation.findMany({
            where: outgoingWhere,
            orderBy: { createdAt: 'desc' },
            include: {
              targetEntity: {
                select: { id: true, name: true, type: true },
              },
            },
          })
        : [],
      fetchIncoming
        ? db.memoryRelation.findMany({
            where: incomingWhere,
            orderBy: { createdAt: 'desc' },
            include: {
              sourceEntity: {
                select: { id: true, name: true, type: true },
              },
            },
          })
        : [],
    ])

    const relations = [
      ...outgoing.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        direction: 'outgoing' as const,
        relatedEntity: r.targetEntity,
        properties: JSON.parse(r.properties),
        validFrom: r.validFrom,
        validTo: r.validTo,
        confidence: r.confidence,
        source: r.source,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      ...incoming.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        direction: 'incoming' as const,
        relatedEntity: r.sourceEntity,
        properties: JSON.parse(r.properties),
        validFrom: r.validFrom,
        validTo: r.validTo,
        confidence: r.confidence,
        source: r.source,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    ]

    return NextResponse.json({
      success: true,
      data: {
        entityId,
        entityName: entity.name,
        entityType: entity.type,
        relations,
        total: relations.length,
      },
    })
  } catch (error) {
    console.error('GET /api/entities/[id]/relations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch relations' },
      { status: 500 }
    )
  }
}

export async function POST(
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

    const { id: sourceEntityId } = await params
    const userId = session.user.id

    // Verify source entity ownership
    const sourceEntity = await db.memoryEntity.findFirst({
      where: { id: sourceEntityId, userId },
    })

    if (!sourceEntity) {
      return NextResponse.json(
        { success: false, error: 'Source entity not found' },
        { status: 404 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = relationCreateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { targetEntityId, relationType, properties, validFrom, validTo, confidence, source } = parsed.data

    // Verify target entity exists and belongs to user
    const targetEntity = await db.memoryEntity.findFirst({
      where: { id: targetEntityId, userId },
    })

    if (!targetEntity) {
      return NextResponse.json(
        { success: false, error: 'Target entity not found' },
        { status: 404 }
      )
    }

    // Prevent self-relation
    if (sourceEntityId === targetEntityId) {
      return NextResponse.json(
        { success: false, error: 'Cannot create a relation from an entity to itself' },
        { status: 400 }
      )
    }

    const relation = await db.memoryRelation.create({
      data: {
        userId,
        sourceEntityId,
        targetEntityId,
        relationType,
        properties: JSON.stringify(properties ?? {}),
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        confidence: confidence ?? 1.0,
        source: source ?? '',
      },
      include: {
        sourceEntity: {
          select: { id: true, name: true, type: true },
        },
        targetEntity: {
          select: { id: true, name: true, type: true },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...relation,
          properties: JSON.parse(relation.properties),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/entities/[id]/relations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create relation' },
      { status: 500 }
    )
  }
}
