import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatWithMemory } from '@/ai/llm'
import { z } from 'zod'

const chatPostSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().optional(),
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

    const [conversations, total] = await Promise.all([
      db.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
      db.conversation.count({ where: { userId } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/chat error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
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
    const parsed = chatPostSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { message, conversationId: inputConversationId } = parsed.data

    // If no conversationId provided, create a new conversation first
    let conversationId = inputConversationId
    if (!conversationId) {
      const conversation = await db.conversation.create({
        data: {
          userId,
          title: message.slice(0, 100),
        },
      })
      conversationId = conversation.id
    }

    // Load previous messages for context
    let previousMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = []

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20, // Last 20 messages for context window
        },
      },
    })

    if (conversation) {
      previousMessages = conversation.messages.map((m) => ({
        role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: m.content,
      }))
    }

    // Add the new user message
    const allMessages = [
      ...previousMessages,
      { role: 'user' as const, content: message },
    ]

    // Call the AI chat function with a guaranteed conversationId
    const response = await chatWithMemory(allMessages, userId, conversationId)

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        response: response.content,
        memoryRefs: response.memoryRefs,
        tokenUsage: response.tokenUsage,
      },
    })
  } catch (error) {
    console.error('POST /api/chat error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
