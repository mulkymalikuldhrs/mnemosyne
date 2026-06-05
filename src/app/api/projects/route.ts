import { NextRequest, NextResponse } from 'next/server'
import { RobotTemplateService } from '@/lib/robot-templates'

export async function GET(request: NextRequest) {
  try {
    const service = RobotTemplateService.getInstance()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as string | undefined

    const projects = await service.listProjects(
      status as 'draft' | 'building' | 'configured' | 'ready' | 'active' | 'error' | undefined
    )
    return NextResponse.json({ success: true, data: projects })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    const service = RobotTemplateService.getInstance()

    let project
    if (body.templateId) {
      project = await service.createProjectFromTemplate(
        body.templateId,
        body.name,
        body.description
      )
    } else {
      project = await service.createCustomProject(
        body.name,
        body.description || '',
        body.category || 'custom'
      )
    }

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
