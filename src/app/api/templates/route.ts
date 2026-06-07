import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Built-in templates to seed for new users
const BUILT_IN_TEMPLATES = [
  {
    name: 'Daily Note',
    description: 'Capture your daily tasks, notes, and reflections',
    content: '# {{date}} - {{day_of_week}}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n',
    category: 'daily',
    isBuiltIn: true,
  },
  {
    name: 'Meeting Notes',
    description: 'Document meeting attendees, agenda, and action items',
    content: '# Meeting: {{title}}\n**Date**: {{date}}\n\n## Attendees\n- \n\n## Agenda\n1. \n\n## Discussion\n\n## Action Items\n- [ ] \n',
    category: 'meeting',
    isBuiltIn: true,
  },
  {
    name: 'Project Brief',
    description: 'Outline project overview, goals, timeline, and risks',
    content: '# {{title}}\n\n## Overview\n\n## Goals\n- \n\n## Timeline\n\n## Resources\n\n## Risks\n',
    category: 'project',
    isBuiltIn: true,
  },
  {
    name: 'Decision Record',
    description: 'Document context, options considered, and reasoning for decisions',
    content: '# Decision: {{title}}\n**Date**: {{date}}\n\n## Context\n\n## Options Considered\n1. \n\n## Decision\n\n## Reasoning\n\n## Outcome\n',
    category: 'decision',
    isBuiltIn: true,
  },
  {
    name: 'Weekly Review',
    description: 'Reflect on accomplishments, challenges, and plan next week',
    content: '# Weekly Review - {{date}}\n\n## Accomplishments\n- \n\n## Challenges\n- \n\n## Learnings\n- \n\n## Next Week\n- \n',
    category: 'review',
    isBuiltIn: true,
  },
]

async function ensureBuiltInTemplates(userId: string) {
  // Check if user already has built-in templates
  const existing = await db.template.findFirst({
    where: { userId, isBuiltIn: true },
  })

  if (!existing) {
    // Seed built-in templates
    await db.template.createMany({
      data: BUILT_IN_TEMPLATES.map((t) => ({
        ...t,
        userId,
      })),
    })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Ensure built-in templates are seeded
  await ensureBuiltInTemplates(session.user.id)

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const where: any = { userId: session.user.id }
  if (category) where.category = category

  const templates = await db.template.findMany({
    where,
    orderBy: [
      { isBuiltIn: 'desc' },
      { name: 'asc' },
    ],
  })

  return NextResponse.json({ success: true, data: { templates } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, description, content, category } = body

  if (!name || !content) {
    return NextResponse.json({ success: false, error: 'Name and content are required' }, { status: 400 })
  }

  const template = await db.template.create({
    data: {
      userId: session.user.id,
      name,
      description: description || '',
      content,
      category: category || 'general',
      isBuiltIn: false,
    },
  })

  return NextResponse.json({ success: true, data: template })
}
