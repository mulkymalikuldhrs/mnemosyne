import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  let dbStatus = 'ok'
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  const healthy = dbStatus === 'ok'

  return NextResponse.json(
    {
      success: healthy,
      data: {
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        db: dbStatus,
      },
    },
    { status: healthy ? 200 : 503 }
  )
}
