import { NextRequest, NextResponse } from 'next/server'
import { CommunicationService } from '@/lib/communication'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.transcript) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: transcript' },
        { status: 400 }
      )
    }

    const service = CommunicationService.getInstance()
    const result = await service.processVoiceInput(
      body.transcript,
      body.language || 'id'
    )
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
