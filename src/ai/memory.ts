import { db } from '@/lib/db'
import { chunkText } from './chunker'
import { generateEmbedding, generateEmbeddings } from './embedder'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MemorySearchResult {
  noteId: string
  chunkId: string
  content: string
  score: number
  title?: string
}

export interface MemoryContext {
  memories: MemorySearchResult[]
  relatedNotes: {
    noteId: string
    title: string
    relationScore: number
    reason: string
  }[]
  patterns: string[]
}

// ─── Cosine Similarity ─────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))

  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}

// ─── LRU Cache for Embeddings ───────────────────────────────────────────────

const embeddingCache = new Map<string, number[]>()
const EMBEDDING_CACHE_MAX = 1000

function getCachedEmbedding(key: string): number[] | null {
  const cached = embeddingCache.get(key)
  if (cached) {
    // Move to end (most recently used)
    embeddingCache.delete(key)
    embeddingCache.set(key, cached)
    return cached
  }
  return null
}

function setCachedEmbedding(key: string, embedding: number[]): void {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    // Evict oldest entry
    const firstKey = embeddingCache.keys().next().value
    if (firstKey) embeddingCache.delete(firstKey)
  }
  embeddingCache.set(key, embedding)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Load all chunk embeddings for a user from the database.
 * Uses the LRU cache to avoid repeated JSON parsing.
 */
async function loadUserEmbeddings(
  userId: string
): Promise<
  {
    id: string
    noteId: string
    content: string
    embedding: number[]
    noteTitle: string
  }[]
> {
  const chunks = await db.noteChunk.findMany({
    where: {
      note: { userId },
    },
    include: {
      note: { select: { title: true } },
    },
  })

  const results: {
    id: string
    noteId: string
    content: string
    embedding: number[]
    noteTitle: string
  }[] = []

  for (const chunk of chunks) {
    let embedding: number[] | null = getCachedEmbedding(chunk.id)

    if (!embedding) {
      try {
        const parsed = JSON.parse(chunk.embedding)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((v: unknown) => typeof v === 'number')) {
          embedding = parsed
          setCachedEmbedding(chunk.id, embedding)
        }
      } catch {
        // Skip chunks with malformed embeddings
        continue
      }
    }

    if (!embedding || embedding.length === 0) {
      continue
    }

    results.push({
      id: chunk.id,
      noteId: chunk.noteId,
      content: chunk.content,
      embedding,
      noteTitle: chunk.note.title,
    })
  }

  return results
}

/**
 * Extract keywords from text for pattern detection.
 * Simple keyword extraction using word frequency with stop word removal.
 */
function extractKeywords(text: string): Map<string, number> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
    'she', 'her', 'hers', 'they', 'them', 'their', 'theirs', 'what',
    'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'because', 'as', 'until', 'while', 'about',
    'between', 'through', 'during', 'before', 'after', 'above', 'below',
    'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'if', 'also', 'am',
  ])

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))

  const freq = new Map<string, number>()
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1)
  }

  return freq
}

// ─── Core Memory Functions ──────────────────────────────────────────────────

/**
 * Store a note's content in the memory engine.
 *
 * 1. Chunk the content using the chunker
 * 2. Generate embeddings for each chunk
 * 3. Store chunks in NoteChunk table
 * 4. Find related notes using cosine similarity
 * 5. Create MemoryLink entries for related notes
 */
export async function storeMemory(
  noteId: string,
  content: string,
  userId: string
): Promise<void> {
  // Step 1: Chunk the content
  const chunks = chunkText(content)

  if (chunks.length === 0) {
    // No chunks to store — just clean up existing data
    await db.$transaction(async (tx) => {
      await tx.noteChunk.deleteMany({ where: { noteId } })
      await tx.memoryLink.deleteMany({
        where: {
          OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
        },
      })
    })
    return
  }

  // Step 2: Generate embeddings for all chunks
  const chunkTexts = chunks.map((c) => c.content)
  const embeddingResults = await generateEmbeddings(chunkTexts, userId)

  // Step 3: Use transaction for atomic delete+create to prevent race conditions
  await db.$transaction(async (tx) => {
    // Delete existing chunks and links for this note
    await tx.noteChunk.deleteMany({ where: { noteId } })
    await tx.memoryLink.deleteMany({
      where: {
        OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
      },
    })

    // Create new chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embeddingResult = embeddingResults[i]
      await tx.noteChunk.create({
        data: {
          noteId,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: chunk.tokenCount,
          embedding: JSON.stringify(embeddingResult.embedding),
        },
      })
    }
  })

  // Step 4: Find related notes using cosine similarity (outside transaction — read-only)
  const relatedNotes = await findRelatedNotes(noteId, userId, 0.5)

  // Step 5: Create MemoryLink entries in a transaction
  if (relatedNotes.length > 0) {
    await db.$transaction(async (tx) => {
      for (const relation of relatedNotes) {
        // Delete existing links in both directions to avoid duplicates
        await tx.memoryLink.deleteMany({
          where: {
            sourceNoteId: noteId,
            targetNoteId: relation.noteId,
          },
        })
        await tx.memoryLink.deleteMany({
          where: {
            sourceNoteId: relation.noteId,
            targetNoteId: noteId,
          },
        })

        // Create forward link
        await tx.memoryLink.create({
          data: {
            sourceNoteId: noteId,
            targetNoteId: relation.noteId,
            relationScore: relation.relationScore,
            reason: relation.reason,
            autoLinked: true,
          },
        })

        // Create reverse link
        await tx.memoryLink.create({
          data: {
            sourceNoteId: relation.noteId,
            targetNoteId: noteId,
            relationScore: relation.relationScore,
            reason: relation.reason,
            autoLinked: true,
          },
        })
      }
    })
  }
}

/**
 * Search the user's memory for relevant chunks.
 *
 * 1. Generate embedding for query
 * 2. Compare with all user's note chunks using cosine similarity
 * 3. Return top N results sorted by score
 */
export async function searchMemory(
  query: string,
  userId: string,
  limit: number = 10
): Promise<MemorySearchResult[]> {
  // Step 1: Generate embedding for query
  const queryEmbedding = await generateEmbedding(query, userId)

  if (queryEmbedding.embedding.length === 0) return []

  // Step 2: Load all user's chunk embeddings
  const userChunks = await loadUserEmbeddings(userId)

  if (userChunks.length === 0) return []

  // Step 3: Compute similarity for each chunk
  const scored = userChunks
    .filter((chunk) => chunk.embedding.length > 0)
    .map((chunk) => ({
      noteId: chunk.noteId,
      chunkId: chunk.id,
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding.embedding, chunk.embedding),
      title: chunk.noteTitle,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}

/**
 * Get full memory context for a query.
 *
 * 1. Search memory for query
 * 2. Find related notes
 * 3. Detect patterns
 * 4. Return full context for AI injection
 */
export async function getMemoryContext(
  query: string,
  userId: string
): Promise<MemoryContext> {
  // Step 1: Search memory for relevant chunks
  const memories = await searchMemory(query, userId, 5)

  // Step 2: Find related notes from the top memory results
  const relatedNotesSet = new Map<string, { noteId: string; title: string; relationScore: number; reason: string }>()

  for (const memory of memories.slice(0, 3)) {
    const related = await findRelatedNotes(memory.noteId, userId, 0.4)
    for (const relation of related) {
      if (!relatedNotesSet.has(relation.noteId)) {
        relatedNotesSet.set(relation.noteId, relation)
      } else {
        // Keep the highest score
        const existing = relatedNotesSet.get(relation.noteId)!
        if (relation.relationScore > existing.relationScore) {
          relatedNotesSet.set(relation.noteId, relation)
        }
      }
    }
  }

  // Step 3: Detect patterns
  const patterns = await detectPatterns(userId)

  return {
    memories,
    relatedNotes: Array.from(relatedNotesSet.values()),
    patterns,
  }
}

/**
 * Find notes related to a given note.
 *
 * 1. Get all chunks for the given note
 * 2. Compare with all other notes' chunks
 * 3. Calculate average similarity score
 * 4. Return notes above threshold
 */
export async function findRelatedNotes(
  noteId: string,
  userId: string,
  threshold: number = 0.5
): Promise<{ noteId: string; title: string; relationScore: number; reason: string }[]> {
  // Step 1: Get all chunks for the given note
  const noteChunks = await db.noteChunk.findMany({
    where: { noteId },
  })

  if (noteChunks.length === 0) return []

  // Parse the note's chunk embeddings
  const noteEmbeddings: number[][] = []
  for (const chunk of noteChunks) {
    try {
      const embedding = JSON.parse(chunk.embedding)
      if (Array.isArray(embedding) && embedding.length > 0) {
        noteEmbeddings.push(embedding)
      }
    } catch {
      // Skip malformed embeddings
    }
  }

  if (noteEmbeddings.length === 0) return []

  // Step 2: Load all other notes' chunks
  const allUserChunks = await loadUserEmbeddings(userId)

  // Group chunks by note (excluding the source note)
  const noteChunkMap = new Map<string, { title: string; embeddings: number[][] }>()
  for (const chunk of allUserChunks) {
    if (chunk.noteId === noteId) continue
    if (chunk.embedding.length === 0) continue

    const existing = noteChunkMap.get(chunk.noteId)
    if (existing) {
      existing.embeddings.push(chunk.embedding)
    } else {
      noteChunkMap.set(chunk.noteId, {
        title: chunk.noteTitle,
        embeddings: [chunk.embedding],
      })
    }
  }

  // Step 3: Calculate average similarity for each note
  const results: { noteId: string; title: string; relationScore: number; reason: string }[] = []

  for (const [candidateNoteId, data] of noteChunkMap) {
    let totalSimilarity = 0
    let comparisonCount = 0

    for (const noteEmb of noteEmbeddings) {
      for (const candidateEmb of data.embeddings) {
        totalSimilarity += cosineSimilarity(noteEmb, candidateEmb)
        comparisonCount++
      }
    }

    if (comparisonCount === 0) continue

    const avgSimilarity = totalSimilarity / comparisonCount

    if (avgSimilarity >= threshold) {
      // Generate a reason based on similarity strength
      let reason: string
      if (avgSimilarity >= 0.9) {
        reason = 'Highly similar content — likely the same topic with different details'
      } else if (avgSimilarity >= 0.75) {
        reason = 'Strong topical overlap — shares key themes and concepts'
      } else if (avgSimilarity >= 0.6) {
        reason = 'Moderately related — some shared concepts and ideas'
      } else {
        reason = 'Loosely connected — peripheral thematic relationship'
      }

      results.push({
        noteId: candidateNoteId,
        title: data.title,
        relationScore: avgSimilarity,
        reason,
      })
    }
  }

  // Sort by relation score descending
  return results.sort((a, b) => b.relationScore - a.relationScore)
}

/**
 * Detect patterns in a user's notes.
 *
 * 1. Analyze user's notes over time
 * 2. Find frequently mentioned topics
 * 3. Detect shifts in focus areas
 * 4. Return human-readable pattern descriptions
 */
export async function detectPatterns(userId: string): Promise<string[]> {
  const patterns: string[] = []

  // Get user's notes ordered by creation date
  const notes = await db.note.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
    },
  })

  if (notes.length === 0) return patterns

  // Step 1: Keyword frequency analysis across all notes
  const allText = notes.map((n) => `${n.title} ${n.content}`).join(' ')
  const globalKeywords = extractKeywords(allText)

  // Sort by frequency
  const sortedKeywords = Array.from(globalKeywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  if (sortedKeywords.length > 0) {
    const topTopics = sortedKeywords
      .filter(([, count]) => count >= 2)
      .map(([word]) => word)

    if (topTopics.length > 0) {
      patterns.push(
        `You frequently write about: ${topTopics.join(', ')}`
      )
    }
  }

  // Step 2: Detect temporal patterns — shifts in focus over time
  if (notes.length >= 3) {
    const recentCount = Math.max(1, Math.floor(notes.length * 0.3))
    const recentNotes = notes.slice(-recentCount)
    const olderNotes = notes.slice(0, -recentCount)

    const recentKeywords = extractKeywords(
      recentNotes.map((n) => `${n.title} ${n.content}`).join(' ')
    )
    const olderKeywords = extractKeywords(
      olderNotes.map((n) => `${n.title} ${n.content}`).join(' ')
    )

    // Find topics that are new in recent notes
    const emergingTopics: string[] = []
    for (const [word, count] of recentKeywords) {
      if (count >= 2) {
        const olderCount = olderKeywords.get(word) ?? 0
        if (olderCount === 0) {
          emergingTopics.push(word)
        }
      }
    }

    if (emergingTopics.length > 0) {
      patterns.push(
        `Recent focus shift — new topics: ${emergingTopics.slice(0, 5).join(', ')}`
      )
    }

    // Find topics that have faded
    const fadingTopics: string[] = []
    for (const [word, count] of olderKeywords) {
      if (count >= 2) {
        const recentCount2 = recentKeywords.get(word) ?? 0
        if (recentCount2 === 0) {
          fadingTopics.push(word)
        }
      }
    }

    if (fadingTopics.length > 0) {
      patterns.push(
        `Topics you haven't revisited recently: ${fadingTopics.slice(0, 5).join(', ')}`
      )
    }
  }

  // Step 3: Note volume pattern
  if (notes.length >= 5) {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recentNotesCount = notes.filter(
      (n) => new Date(n.createdAt) >= oneWeekAgo
    ).length

    if (recentNotesCount >= 3) {
      patterns.push(
        `Active period — you've created ${recentNotesCount} notes in the last week`
      )
    } else if (recentNotesCount === 0) {
      patterns.push(
        'Quiet period — no new notes in the last week. Consider capturing recent thoughts.'
      )
    }
  }

  // Step 4: Connectivity pattern
  const memoryLinks = await db.memoryLink.findMany({
    where: {
      OR: [
        { sourceNote: { userId } },
        { targetNote: { userId } },
      ],
    },
  })

  const connectedNoteIds = new Set<string>()
  for (const link of memoryLinks) {
    connectedNoteIds.add(link.sourceNoteId)
    connectedNoteIds.add(link.targetNoteId)
  }

  if (notes.length > 1) {
    const connectivityRatio = connectedNoteIds.size / notes.length
    if (connectivityRatio < 0.3) {
      patterns.push(
        'Your notes are loosely connected — consider writing on shared themes to build stronger connections'
      )
    } else if (connectivityRatio > 0.7) {
      patterns.push(
        'Your knowledge base is well-connected — good for cross-referencing ideas'
      )
    }
  }

  return patterns
}

/**
 * Delete all memory data for a note.
 * Removes chunks and memory links.
 */
export async function deleteMemory(noteId: string): Promise<void> {
  // Get chunk IDs before deleting so we can invalidate cache
  const chunks = await db.noteChunk.findMany({
    where: { noteId },
    select: { id: true },
  })

  // Invalidate cache entries for this note's chunks
  for (const chunk of chunks) {
    embeddingCache.delete(chunk.id)
  }

  // Delete in order to respect foreign key constraints
  await db.memoryLink.deleteMany({
    where: {
      OR: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
    },
  })

  await db.noteChunk.deleteMany({
    where: { noteId },
  })
}
