import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const decisionUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  context: z.string().max(10000).optional(),
  decision: z.string().min(1).max(10000).optional(),
  reasoning: z.string().max(10000).optional(),
  outcome: z.string().max(10000).optional(),
  evaluation: z.string().max(10000).optional(),
  status: z.enum(['pending', 'decided', 'revisited']).optional(),
  relatedNoteIds: z.array(z.string()).optional(),
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
    const decision = await db.decision.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!decision) {
      return NextResponse.json(
        { success: false, error: 'Decision not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: decision })
  } catch (error) {
    console.error('GET /api/decisions/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch decision' },
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

    const parsed = decisionUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await db.decision.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Decision not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    const { status, relatedNoteIds, ...rest } = parsed.data

    // Copy simple string fields
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    if (status !== undefined) {
      updateData.status = status
    }

    if (relatedNoteIds !== undefined) {
      updateData.relatedNoteIds = JSON.stringify(relatedNoteIds)
    }

    const updated = await db.decision.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PUT /api/decisions/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update decision' },
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

    // Verify ownership
    const existing = await db.decision.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Decision not found' },
        { status: 404 }
      )
    }

    await db.decision.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('DELETE /api/decisions/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete decision' },
      { status: 500 }
    )
  }
}
