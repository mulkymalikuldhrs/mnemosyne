import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Fetch all non-archived notes as graph nodes
    const notes = await db.note.findMany({
      where: {
        userId,
        isArchived: false,
      },
      select: {
        id: true,
        title: true,
        tags: true,
        sourceLinks: {
          select: { targetNoteId: true },
        },
        targetLinks: {
          select: { sourceNoteId: true },
        },
      },
    })

    // Fetch memory links (edges)
    const memoryLinks = await db.memoryLink.findMany({
      where: {
        sourceNote: { userId },
        targetNote: { userId },
      },
      select: {
        sourceNoteId: true,
        targetNoteId: true,
        relationScore: true,
        reason: true,
      },
    })

    // Fetch wiki links (edges)
    const wikiLinks = await db.wikiLink.findMany({
      where: {
        sourceNote: { userId },
        targetNote: { userId },
      },
      select: {
        sourceNoteId: true,
        targetNoteId: true,
        linkText: true,
      },
    })

    // Build nodes with connection counts
    const nodes = notes.map((note) => {
      const connectionCount =
        note.sourceLinks.length +
        note.targetLinks.length

      return {
        id: note.id,
        title: note.title,
        tags: note.tags
          ? note.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        connectionCount,
      }
    })

    // Build edges — memory links
    const memoryEdges = memoryLinks.map((ml) => ({
      source: ml.sourceNoteId,
      target: ml.targetNoteId,
      score: ml.relationScore,
      type: 'memory' as const,
      reason: ml.reason,
    }))

    // Build edges — wiki links
    const wikiEdges = wikiLinks.map((wl) => ({
      source: wl.sourceNoteId,
      target: wl.targetNoteId,
      score: 1.0,
      type: 'wiki' as const,
      reason: `Wiki link: [[${wl.linkText}]]`,
    }))

    const edges = [...memoryEdges, ...wikiEdges]

    return NextResponse.json({
      success: true,
      data: { nodes, edges },
    })
  } catch (error) {
    console.error('GET /api/graph error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch graph data' },
      { status: 500 }
    )
  }
}
