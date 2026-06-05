import { NextRequest, NextResponse } from 'next/server'
import { RobotTemplateService } from '@/lib/robot-templates'

export async function GET(request: NextRequest) {
  try {
    const service = RobotTemplateService.getInstance()
    await service.initializeTemplates()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as string | undefined
    const difficulty = searchParams.get('difficulty') as string | undefined

    const templates = await service.listTemplates(
      category as 'drone' | 'rover' | 'boat' | 'amphibious' | 'arm' | 'custom' | undefined,
      difficulty as 'beginner' | 'intermediate' | 'advanced' | undefined
    )

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
