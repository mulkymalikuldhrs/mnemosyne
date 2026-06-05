import { NextRequest, NextResponse } from 'next/server'
import { RobotTemplateService } from '@/lib/robot-templates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: action' },
        { status: 400 }
      )
    }

    const validActions = ['scan', 'auto-configure', 'update-step']
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    const service = RobotTemplateService.getInstance()

    if (body.action === 'scan') {
      const result = await service.scanHardware(body.projectId)
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'auto-configure' && body.projectId) {
      const project = await service.autoConfigure(body.projectId)
      return NextResponse.json({ success: true, data: project })
    }

    if (body.action === 'update-step' && body.projectId) {
      const project = await service.updateBuildStep(
        body.projectId,
        body.stepIndex,
        body.completed
      )
      return NextResponse.json({ success: true, data: project })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
