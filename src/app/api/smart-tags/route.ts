import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Simple keyword-based tag suggestions (in production this would use AI)
const TAG_KEYWORDS: Record<string, { keywords: string[]; category: string }> = {
  'ai': { keywords: ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural', 'ml', 'llm', 'gpt'], category: 'ai' },
  'programming': { keywords: ['code', 'programming', 'developer', 'software', 'api', 'framework', 'library', 'typescript', 'javascript', 'python', 'rust', 'react', 'database'], category: 'programming' },
  'business': { keywords: ['business', 'startup', 'revenue', 'market', 'customer', 'product', 'strategy', 'competitive', 'saas', 'pricing'], category: 'business' },
  'design': { keywords: ['design', 'ui', 'ux', 'interface', 'wireframe', 'prototype', 'figma', 'layout', 'color'], category: 'design' },
  'productivity': { keywords: ['productivity', 'workflow', 'automation', 'efficiency', 'time management', 'habits', 'routine'], category: 'productivity' },
  'finance': { keywords: ['trading', 'investment', 'stock', 'portfolio', 'risk', 'crypto', 'financial', 'budget'], category: 'finance' },
  'health': { keywords: ['health', 'exercise', 'fitness', 'nutrition', 'sleep', 'wellness', 'mental health'], category: 'health' },
  'learning': { keywords: ['learning', 'course', 'tutorial', 'book', 'study', 'education', 'skill'], category: 'learning' },
  'meeting': { keywords: ['meeting', 'agenda', 'discussion', 'action item', 'follow up', 'standup'], category: 'meeting' },
  'project': { keywords: ['project', 'milestone', 'deadline', 'sprint', 'backlog', 'roadmap', 'task'], category: 'project' },
  'research': { keywords: ['research', 'paper', 'study', 'analysis', 'findings', 'methodology', 'hypothesis'], category: 'research' },
  'personal': { keywords: ['personal', 'journal', 'reflection', 'gratitude', 'goal', 'dream'], category: 'personal' },
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { content, title } = body

  if (!content) {
    return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 })
  }

  const text = `${title || ''} ${content}`.toLowerCase()
  const suggestions: Array<{ tag: string; confidence: number; category: string }> = []

  for (const [tag, data] of Object.entries(TAG_KEYWORDS)) {
    let matchCount = 0
    for (const keyword of data.keywords) {
      if (text.includes(keyword)) matchCount++
    }
    if (matchCount > 0) {
      const confidence = Math.min(matchCount / data.keywords.length * 2, 1)
      suggestions.push({ tag, confidence: Math.round(confidence * 100) / 100, category: data.category })
    }
  }

  // Also get existing tags from user's notes for context-aware suggestions
  const userTags = await db.note.findMany({
    where: { userId: session.user.id, isArchived: false },
    select: { tags: true },
    take: 100,
  })

  const tagCounts = new Map<string, number>()
  for (const note of userTags) {
    if (note.tags) {
      note.tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    }
  }

  // Add existing tags that match content
  for (const [tag, count] of tagCounts.entries()) {
    const tagLower = tag.toLowerCase()
    if (text.includes(tagLower) && !suggestions.find((s) => s.tag === tag)) {
      suggestions.push({ tag, confidence: Math.min(count / 10, 0.8), category: 'general' })
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence)

  return NextResponse.json({
    success: true,
    data: { suggestions: suggestions.slice(0, 10) },
  })
}
