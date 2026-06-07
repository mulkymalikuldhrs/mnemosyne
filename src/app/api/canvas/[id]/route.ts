import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const canvasUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  data: z.string().max(5000000).optional(),
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

    const userId = session.user.id
    const { id } = await params

    const canvas = await db.canvas.findFirst({
      where: { id, userId },
    })

    if (!canvas) {
      return NextResponse.json(
        { success: false, error: 'Canvas not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: canvas,
    })
  } catch (error) {
    console.error('GET /api/canvas/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch canvas' },
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

    const userId = session.user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.canvas.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Canvas not found' },
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

    const parsed = canvasUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { title, description, data } = parsed.data

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (data !== undefined) updateData.data = data

    const canvas = await db.canvas.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: canvas,
    })
  } catch (error) {
    console.error('PUT /api/canvas/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update canvas' },
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

    const userId = session.user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.canvas.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Canvas not found' },
        { status: 404 }
      )
    }

    await db.canvas.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: { id },
    })
  } catch (error) {
    console.error('DELETE /api/canvas/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete canvas' },
      { status: 500 }
    )
  }
}
