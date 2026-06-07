import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const canvasCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  data: z.string().max(5000000).optional(), // JSON string with nodes and edges
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

    const canvases = await db.canvas.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: { canvases },
    })
  } catch (error) {
    console.error('GET /api/canvas error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch canvases' },
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

    const parsed = canvasCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { title, description, data } = parsed.data

    const canvas = await db.canvas.create({
      data: {
        userId,
        title,
        description: description ?? '',
        data: data ?? '{"nodes":[],"edges":[]}',
      },
    })

    return NextResponse.json(
      { success: true, data: canvas },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/canvas error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create canvas' },
      { status: 500 }
    )
  }
}
