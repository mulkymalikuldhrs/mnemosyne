import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const entityCreateSchema = z.object({
  name: z.string().min(1).max(300),
  type: z.enum(['person', 'project', 'concept', 'topic', 'organization', 'tool', 'event']),
  description: z.string().max(5000).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(500).optional(),
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

    const type = searchParams.get('type')
    if (type) {
      where.type = type
    }

    const search = searchParams.get('search')
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [entities, total] = await Promise.all([
      db.memoryEntity.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { sourceRelations: true, targetRelations: true },
          },
        },
      }),
      db.memoryEntity.count({ where }),
    ])

    const parsedEntities = entities.map((entity) => ({
      ...entity,
      properties: JSON.parse(entity.properties),
      relationCount: entity._count.sourceRelations + entity._count.targetRelations,
    }))

    return NextResponse.json({
      success: true,
      data: {
        entities: parsedEntities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/entities error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entities' },
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

    const parsed = entityCreateSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, type, description, properties, validFrom, validTo, confidence, source } = parsed.data

    const entity = await db.memoryEntity.create({
      data: {
        userId,
        name,
        type,
        description: description ?? '',
        properties: JSON.stringify(properties ?? {}),
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        confidence: confidence ?? 1.0,
        source: source ?? '',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...entity,
          properties: JSON.parse(entity.properties),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/entities error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create entity' },
      { status: 500 }
    )
  }
}
