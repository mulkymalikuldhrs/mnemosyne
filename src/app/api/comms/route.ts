import { NextResponse } from 'next/server'
import { CommunicationService } from '@/lib/communication'

export async function GET() {
  try {
    const service = CommunicationService.getInstance()
    await service.initializeDefaults()
    const channels = await service.listChannels()
    return NextResponse.json({ success: true, data: channels })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
