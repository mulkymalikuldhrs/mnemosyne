import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { detectPatterns } from '@/ai/memory'

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
    const patterns = await detectPatterns(userId)

    return NextResponse.json({
      success: true,
      data: {
        patterns,
        count: patterns.length,
      },
    })
  } catch (error) {
    console.error('GET /api/memory/patterns error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to detect patterns' },
      { status: 500 }
    )
  }
}
