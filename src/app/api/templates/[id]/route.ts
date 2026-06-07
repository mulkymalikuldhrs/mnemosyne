import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const templateUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  content: z.string().min(1).max(100000).optional(),
  category: z.enum(['general', 'daily', 'meeting', 'project', 'review']).optional(),
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

    const template = await db.template.findFirst({
      where: { id, userId },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error) {
    console.error('GET /api/templates/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch template' },
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

    // Verify ownership and that it's not built-in
    const existing = await db.template.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    if (existing.isBuiltIn) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify built-in templates' },
        { status: 403 }
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

    const parsed = templateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, description, content, category } = parsed.data

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (content !== undefined) updateData.content = content
    if (category !== undefined) updateData.category = category

    const template = await db.template.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error) {
    console.error('PUT /api/templates/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update template' },
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

    // Only delete non-built-in templates owned by user
    const result = await db.template.deleteMany({
      where: { id, userId, isBuiltIn: false },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Template not found or is built-in and cannot be deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { id },
    })
  } catch (error) {
    console.error('DELETE /api/templates/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
