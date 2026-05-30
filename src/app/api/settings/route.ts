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
