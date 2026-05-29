import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    const apiKeys = await db.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        key: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    // Mask the actual keys
    const maskedKeys = apiKeys.map((apiKey) => ({
      id: apiKey.id,
      name: apiKey.name,
      keyMasked: `mx_${apiKey.key.slice(3, 7)}...${apiKey.key.slice(-4)}`,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: maskedKeys,
        count: maskedKeys.length,
      },
    })
  } catch (error) {
    console.error('GET /api/api-keys error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API keys' },
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
    const body = await request.json()
    const parsed = apiKeyCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name } = parsed.data

    // Generate a unique API key with mx_ prefix
    const key = `mx_${uuidv4().replace(/-/g, '')}`

    const apiKey = await db.apiKey.create({
      data: {
        userId,
        key,
        name,
      },
    })

    // Return the full key only on creation (this is the only time the user sees it)
    return NextResponse.json(
      {
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key,
          createdAt: apiKey.createdAt,
        },
        warning:
          'Store this API key securely. You will not be able to see the full key again.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/api-keys error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate API key' },
      { status: 500 }
    )
  }
}
