import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'

// Read version from package.json — resolved at build time
function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
    return pkg.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

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
        version: getVersion(),
        db: dbStatus,
      },
    },
    { status: healthy ? 200 : 503 }
  )
}
