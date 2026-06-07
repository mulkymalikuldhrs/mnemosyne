import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const SYSTEM_START_TIME = Date.now()

export async function GET() {
  try {
    const [totalNotes, totalUsers, totalConversations, totalDecisions] = await Promise.all([
      db.note.count(),
      db.user.count(),
      db.conversation.count(),
      db.decision.count(),
    ])

    const uptimeSeconds = Math.floor((Date.now() - SYSTEM_START_TIME) / 1000)
    const hours = Math.floor(uptimeSeconds / 3600)
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
    const seconds = uptimeSeconds % 60

    return NextResponse.json({
      success: true,
      data: {
        system: 'Mnemosyne AI Memory',
        version: '1.0.0',
        uptime: {
          seconds: uptimeSeconds,
          formatted: `${hours}h ${minutes}m ${seconds}s`,
        },
        timestamp: new Date().toISOString(),
        stats: {
          notes: totalNotes,
          users: totalUsers,
          conversations: totalConversations,
          decisions: totalDecisions,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve system health information' },
      { status: 500 }
    )
  }
}
