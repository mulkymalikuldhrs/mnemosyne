import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

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

    // Optional `at` parameter for time-travel queries
    // Returns the state of the knowledge graph at a specific point in time
    const atParam = searchParams.get('at')

    // If `at` is provided, look for a snapshot closest to that time
    if (atParam) {
      const atDate = new Date(atParam)
      if (isNaN(atDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid `at` parameter. Use ISO 8601 date format.' },
          { status: 400 }
        )
      }

      // Find the most recent snapshot on or before the requested date
      const snapshot = await db.temporalSnapshot.findFirst({
        where: {
          userId,
          snapshotDate: { lte: atDate },
        },
        orderBy: { snapshotDate: 'desc' },
      })

      if (!snapshot) {
        return NextResponse.json(
          { success: false, error: 'No snapshot found for the requested time period' },
          { status: 404 }
        )
      }

      const entities = JSON.parse(snapshot.entities)
      const relations = JSON.parse(snapshot.relations)
      const metadata = JSON.parse(snapshot.metadata)

      return NextResponse.json({
        success: true,
        data: {
          snapshotId: snapshot.id,
          snapshotDate: snapshot.snapshotDate,
          source: snapshot.source,
          entities,
          relations,
          metadata,
          isTimeTravel: true,
          requestedAt: atDate,
        },
      })
    }

    // Without `at`, return the current live knowledge graph state
    const [entities, relations] = await Promise.all([
      db.memoryEntity.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { sourceRelations: true, targetRelations: true },
          },
        },
      }),
      db.memoryRelation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          sourceEntity: {
            select: { id: true, name: true, type: true },
          },
          targetEntity: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
    ])

    const parsedEntities = entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      properties: JSON.parse(entity.properties),
      validFrom: entity.validFrom,
      validTo: entity.validTo,
      confidence: entity.confidence,
      source: entity.source,
      relationCount: entity._count.sourceRelations + entity._count.targetRelations,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }))

    const parsedRelations = relations.map((relation) => ({
      id: relation.id,
      sourceEntityId: relation.sourceEntityId,
      targetEntityId: relation.targetEntityId,
      sourceEntity: relation.sourceEntity,
      targetEntity: relation.targetEntity,
      relationType: relation.relationType,
      properties: JSON.parse(relation.properties),
      validFrom: relation.validFrom,
      validTo: relation.validTo,
      confidence: relation.confidence,
      source: relation.source,
      createdAt: relation.createdAt,
    }))

    // Get available snapshot dates for time-travel navigation
    const snapshots = await db.temporalSnapshot.findMany({
      where: { userId },
      select: { id: true, snapshotDate: true, source: true },
      orderBy: { snapshotDate: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      data: {
        entities: parsedEntities,
        relations: parsedRelations,
        isTimeTravel: false,
        availableSnapshots: snapshots,
        summary: {
          entityCount: parsedEntities.length,
          relationCount: parsedRelations.length,
          entityTypeBreakdown: parsedEntities.reduce<Record<string, number>>((acc, e) => {
            acc[e.type] = (acc[e.type] ?? 0) + 1
            return acc
          }, {}),
          relationTypeBreakdown: parsedRelations.reduce<Record<string, number>>((acc, r) => {
            acc[r.relationType] = (acc[r.relationType] ?? 0) + 1
            return acc
          }, {}),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/graph/temporal error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch temporal graph' },
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

    const { snapshotDate, source } = (body ?? {}) as Record<string, unknown>
    const now = snapshotDate ? new Date(snapshotDate as string) : new Date()
    if (isNaN(now.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid snapshotDate format' },
        { status: 400 }
      )
    }

    // Rebuild the graph from existing entities and relations
    const [entities, relations, notes, decisions] = await Promise.all([
      db.memoryEntity.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      db.memoryRelation.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      db.note.findMany({
        where: { userId, isArchived: false },
        select: { id: true, title: true, tags: true, createdAt: true, updatedAt: true },
      }),
      db.decision.findMany({
        where: { userId },
        select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
      }),
    ])

    // Serialize entity states for the snapshot
    const entityStates = entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      properties: JSON.parse(entity.properties),
      validFrom: entity.validFrom,
      validTo: entity.validTo,
      confidence: entity.confidence,
      source: entity.source,
      createdAt: entity.createdAt,
    }))

    // Serialize relation states for the snapshot
    const relationStates = relations.map((relation) => ({
      id: relation.id,
      sourceEntityId: relation.sourceEntityId,
      targetEntityId: relation.targetEntityId,
      relationType: relation.relationType,
      properties: JSON.parse(relation.properties),
      validFrom: relation.validFrom,
      validTo: relation.validTo,
      confidence: relation.confidence,
      source: relation.source,
      createdAt: relation.createdAt,
    }))

    const metadata = {
      entityCount: entityStates.length,
      relationCount: relationStates.length,
      noteCount: notes.length,
      decisionCount: decisions.length,
      entityTypeBreakdown: entityStates.reduce<Record<string, number>>((acc, e) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1
        return acc
      }, {}),
      relationTypeBreakdown: relationStates.reduce<Record<string, number>>((acc, r) => {
        acc[r.relationType] = (acc[r.relationType] ?? 0) + 1
        return acc
      }, {}),
    }

    const snapshot = await db.temporalSnapshot.create({
      data: {
        userId,
        snapshotDate: now,
        entities: JSON.stringify(entityStates),
        relations: JSON.stringify(relationStates),
        metadata: JSON.stringify(metadata),
        source: (source as string) ?? 'manual',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: snapshot.id,
          snapshotDate: snapshot.snapshotDate,
          source: snapshot.source,
          createdAt: snapshot.createdAt,
          metadata,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/graph/temporal error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to rebuild temporal graph' },
      { status: 500 }
    )
  }
}
