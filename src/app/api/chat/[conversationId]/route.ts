import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
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
    const { conversationId } = await params

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    })
  } catch (error) {
    console.error('GET /api/chat/[conversationId] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
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
    const { conversationId } = await params

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, userId },
    })

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Cascade deletes will handle messages
    await db.conversation.delete({
      where: { id: conversationId },
    })

    return NextResponse.json({
      success: true,
      data: { id: conversationId },
    })
  } catch (error) {
    console.error('DELETE /api/chat/[conversationId] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
