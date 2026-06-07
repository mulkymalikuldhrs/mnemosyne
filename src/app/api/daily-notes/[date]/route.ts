import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const dailyNoteUpdateSchema = z.object({
  content: z.string().min(1).max(100000).optional(),
  markdown: z.string().max(100000).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
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
    const { date } = await params

    const dailyNote = await db.dailyNote.findUnique({
      where: {
        userId_date: { userId, date },
      },
    })

    if (!dailyNote) {
      return NextResponse.json(
        { success: false, error: 'Daily note not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: dailyNote,
    })
  } catch (error) {
    console.error('GET /api/daily-notes/[date] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch daily note' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
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
    const { date } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = dailyNoteUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { content, markdown } = parsed.data

    // Upsert: create if doesn't exist, update if it does
    const dailyNote = await db.dailyNote.upsert({
      where: {
        userId_date: { userId, date },
      },
      create: {
        userId,
        date,
        content: content ?? '',
        markdown: markdown ?? content ?? '',
      },
      update: {
        ...(content !== undefined && { content, markdown: markdown ?? content }),
        ...(markdown !== undefined && { markdown }),
      },
    })

    return NextResponse.json({
      success: true,
      data: dailyNote,
    })
  } catch (error) {
    console.error('PUT /api/daily-notes/[date] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update daily note' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
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
    const { date } = await params

    const existing = await db.dailyNote.findUnique({
      where: {
        userId_date: { userId, date },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Daily note not found' },
        { status: 404 }
      )
    }

    await db.dailyNote.delete({
      where: {
        userId_date: { userId, date },
      },
    })

    return NextResponse.json({
      success: true,
      data: { date },
    })
  } catch (error) {
    console.error('DELETE /api/daily-notes/[date] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete daily note' },
      { status: 500 }
    )
  }
}
