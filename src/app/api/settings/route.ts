import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const settingsUpdateSchema = z.object({
  openrouterApiKey: z.string().max(500).optional(),
  supabaseProjectUrl: z.string().url().max(500).optional(),
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

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        supabaseProjectUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check API key existence separately — never load the key value into memory
    const keyCheck = await db.user.findUnique({
      where: { id: userId },
      select: { openrouterApiKey: true },
    })
    const hasOpenrouterApiKey = !!keyCheck?.openrouterApiKey

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        hasOpenrouterApiKey,
      },
    })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const parsed = settingsUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { openrouterApiKey, supabaseProjectUrl } = parsed.data

    const updateData: Record<string, unknown> = {}
    if (openrouterApiKey !== undefined) {
      updateData.openrouterApiKey = openrouterApiKey || null
    }
    if (supabaseProjectUrl !== undefined) {
      updateData.supabaseProjectUrl = supabaseProjectUrl || null
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        supabaseProjectUrl: true,
        updatedAt: true,
      },
    })

    // Check API key existence separately — never load the key value into memory
    const keyCheck = await db.user.findUnique({
      where: { id: userId },
      select: { openrouterApiKey: true },
    })
    const hasOpenrouterApiKey = !!keyCheck?.openrouterApiKey

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        hasOpenrouterApiKey,
      },
    })
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Delete all user data in correct order (respecting foreign key constraints)
    // 1. Delete memory links pointing to user's notes
    await db.memoryLink.deleteMany({
      where: {
        OR: [
          { sourceNote: { userId } },
          { targetNote: { userId } },
        ],
      },
    })

    // 2. Delete note chunks (cascade should handle, but explicit for safety)
    await db.noteChunk.deleteMany({
      where: { note: { userId } },
    })

    // 3. Delete notes
    await db.note.deleteMany({
      where: { userId },
    })

    // 4. Delete messages
    await db.message.deleteMany({
      where: { conversation: { userId } },
    })

    // 5. Delete conversations
    await db.conversation.deleteMany({
      where: { userId },
    })

    // 6. Delete decisions
    await db.decision.deleteMany({
      where: { userId },
    })

    // 7. Delete API keys
    await db.apiKey.deleteMany({
      where: { userId },
    })

    // 8. Delete MCP sessions
    await db.mcpSession.deleteMany({
      where: { userId },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'All data has been reset successfully' },
    })
  } catch (error) {
    console.error('DELETE /api/settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reset data' },
      { status: 500 }
    )
  }
}
