import { NextRequest, NextResponse } from 'next/server'
import { CommunicationService } from '@/lib/communication'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const service = CommunicationService.getInstance()
    const channel = await service.getChannel(id)

    if (!channel) {
      return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: channel })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const service = CommunicationService.getInstance()

    if (body.action === 'connect') {
      const result = await service.connectChannel(id)
      return NextResponse.json(
        { success: result.success, message: result.message },
        { status: result.success ? 200 : 400 }
      )
    }

    if (body.action === 'disconnect') {
      await service.disconnectChannel(id)
      return NextResponse.json({ success: true })
    }

    const channel = await service.updateChannel(id, body)
    return NextResponse.json({ success: true, data: channel })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
