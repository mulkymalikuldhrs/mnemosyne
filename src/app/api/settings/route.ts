import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

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
        openrouterApiKey: true,
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

    // Return settings with API key status (not the actual key)
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        hasOpenrouterApiKey: !!user.openrouterApiKey,
        openrouterApiKeySet: !!user.openrouterApiKey,
        supabaseProjectUrl: user.supabaseProjectUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
    const body = await request.json()
    const { openrouterApiKey, supabaseProjectUrl } = body

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
        openrouterApiKey: true,
        supabaseProjectUrl: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        hasOpenrouterApiKey: !!user.openrouterApiKey,
        supabaseProjectUrl: user.supabaseProjectUrl,
        updatedAt: user.updatedAt,
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
