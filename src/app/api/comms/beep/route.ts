import { NextRequest, NextResponse } from 'next/server'
import { CommunicationService } from '@/lib/communication'
import type { BeepPatternName } from '@/lib/beep-alerts'

const VALID_BEEP_PATTERNS: BeepPatternName[] = [
  'startup', 'warning', 'critical', 'success', 'land', 'rth',
  'arm', 'disarm', 'boot', 'heartbeat', 'low_battery', 'gps_lock',
  'error', 'custom',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.pattern && !VALID_BEEP_PATTERNS.includes(body.pattern as BeepPatternName)) {
      return NextResponse.json(
        { success: false, error: `Invalid pattern. Must be one of: ${VALID_BEEP_PATTERNS.join(', ')}` },
        { status: 400 }
      )
    }

    const service = CommunicationService.getInstance()
    const result = await service.sendBeep(body.pattern || 'warning')
    return NextResponse.json({ success: result.played, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
