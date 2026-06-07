import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
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
    const { noteId } = await params

    const result = await db.favorite.deleteMany({
      where: { userId, noteId },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Favorite not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { noteId },
    })
  } catch (error) {
    console.error('DELETE /api/favorites/[noteId] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove favorite' },
      { status: 500 }
    )
  }
}
