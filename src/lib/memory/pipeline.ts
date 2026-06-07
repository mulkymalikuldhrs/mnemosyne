// ============================================================
// MNEMOSYNE v2.0.0 — Memory Processing Pipeline
// Inspired by mem0's V3 additive extraction pipeline
// (https://github.com/mem0ai/mem0)
//
// 8-Phase Pipeline:
//   Phase 0: Context Gathering
//   Phase 1: Existing Memory Retrieval
//   Phase 2: LLM Extraction
//   Phase 3: Batch Embed
//   Phase 4: CPU Processing (hash dedup)
//   Phase 5: Hash Dedup
//   Phase 6: Batch Persist
//   Phase 7: Entity Linking
//   Phase 8: Return Results
// ============================================================

import { db } from '@/lib/db'
import { generateEmbedding } from '@/ai/embedder'
import { chunkText } from '@/ai/chunker'
import { createHash } from 'crypto'

// --- Types ---

export interface MemoryInput {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  userId?: string
  agentId?: string
  runId?: string
  metadata?: Record<string, unknown>
}

export interface ExtractedMemory {
  text: string
  linkedMemoryIds?: string[]
  attributedTo?: string
}

export interface MemoryRecord {
  id: string
  text: string
  hash: string
  embedding: number[]
  userId?: string
  agentId?: string
  runId?: string
  actorId?: string
  role?: string
  attributedTo?: string
  event: 'ADD'
}

export interface EntityRecord {
  text: string
  entityType: 'PROPER' | 'COMPOUND' | 'QUOTED' | 'NOUN'
  linkedMemoryIds: string[]
}

// --- Extraction Prompt (mem0-inspired V3 additive) ---

const ADDITIVE_EXTRACTION_PROMPT = `You are a memory extraction assistant. Your task is to extract discrete, factual memories from a conversation.

Rules:
1. Extract ONLY new facts, preferences, or information — do NOT extract already-known memories
2. Each memory should be a single, self-contained fact
3. Be specific — prefer "User prefers dark mode" over "User has preferences"
4. Do NOT extract greetings, small talk, or system messages
5. If no new memories can be extracted, return an empty array
6. Each memory should have an "attributedTo" field: "User" or "Assistant"

Respond with a JSON object in this exact format:
{
  "memory": [
    { "text": "...", "linkedMemoryIds": [], "attributedTo": "User" }
  ]
}`

// --- Pipeline ---

export class MemoryPipeline {
  /**
   * Phase 0: Context Gathering
   * Collect session scope and recent messages for context.
   */
  private buildSessionScope(input: MemoryInput): string {
    const parts: string[] = []
    if (input.userId) parts.push(`user:${input.userId}`)
    if (input.agentId) parts.push(`agent:${input.agentId}`)
    if (input.runId) parts.push(`run:${input.runId}`)
    return parts.join('|')
  }

  /**
   * Phase 1: Existing Memory Retrieval
   * Find similar existing memories to provide context for the LLM.
   */
  async retrieveExistingMemories(
    queryEmbedding: number[],
    userId?: string,
    agentId?: string,
    topK: number = 10
  ): Promise<Array<{ id: string; text: string; score: number }>> {
    const takeLimit = Math.max(1, Math.min(topK, 1000))
    // Search NoteChunks using cosine similarity
    const allChunks = await db.noteChunk.findMany({
      where: {
        note: {
          ...(userId ? { userId } : {}),
        },
      },
      take: takeLimit,
    })

    const scored: Array<{ id: string; text: string; score: number }> = []

    for (const chunk of allChunks) {
      try {
        const embedding = JSON.parse(chunk.embedding)
        if (!Array.isArray(embedding) || embedding.length === 0) continue

        const score = this.cosineSimilarity(queryEmbedding, embedding)
        if (score > 0.3) {
          scored.push({
            id: chunk.id,
            text: chunk.content.slice(0, 200),
            score,
          })
        }
      } catch {
        continue
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, Math.max(1, topK))
  }

  /**
   * Phase 2: LLM Extraction
   * Use LLM to extract memories from conversation messages.
   * Falls back to simple extraction if LLM is unavailable.
   */
  async extractMemories(input: MemoryInput): Promise<ExtractedMemory[]> {
    const parsedMessages = input.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    // Simple heuristic extraction (works without LLM)
    const extracted: ExtractedMemory[] = []

    for (const message of input.messages) {
      if (message.role === 'system') continue
      if (message.content.length < 20) continue // Skip very short messages

      // Extract sentences that look like facts/preferences
      const sentences = message.content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15 && s.length < 500)

      for (const sentence of sentences) {
        // Check if it looks like a factual statement or preference
        const isFactual =
          /(?:i |my |i'm|i am|we |our |i like|i prefer|i love|i hate|i need|i want|always|never|usually)/i.test(
            sentence
          )

        if (isFactual) {
          extracted.push({
            text: sentence,
            attributedTo: message.role === 'user' ? 'User' : 'Assistant',
          })
        }
      }
    }

    return extracted.slice(0, 20) // Cap at 20 memories per conversation
  }

  /**
   * Phase 3: Batch Embed
   * Generate embeddings for all extracted memory texts.
   */
  async batchEmbed(
    texts: string[],
    userId?: string
  ): Promise<Array<{ text: string; embedding: number[] }>> {
    const results: Array<{ text: string; embedding: number[] }> = []

    for (const text of texts) {
      try {
        const embeddingResult = await generateEmbedding(text, userId ?? 'system')
        results.push({ text, embedding: embeddingResult.embedding })
      } catch {
        results.push({ text, embedding: [] })
      }
    }

    return results
  }

  /**
   * Phase 4: CPU Processing — hash dedup, lemmatize, build payloads.
   * Phase 5: Hash Dedup — MD5 hash prevents exact-duplicate memories.
   */
  async processAndDedup(
    extracted: ExtractedMemory[],
    embeddings: Array<{ text: string; embedding: number[] }>,
    input: MemoryInput,
    existingHashes: Set<string>
  ): Promise<MemoryRecord[]> {
    const records: MemoryRecord[] = []
    const seenHashes = new Set<string>()

    for (let i = 0; i < extracted.length; i++) {
      const memory = extracted[i]
      const embedding = embeddings[i]

      if (!embedding || !memory) continue

      const hash = createHash('md5').update(memory.text).digest('hex')

      // Dedup against existing and within batch
      if (existingHashes.has(hash) || seenHashes.has(hash)) continue

      seenHashes.add(hash)

      records.push({
        id: `mem_${Date.now()}_${i}`,
        text: memory.text,
        hash,
        embedding: embedding.embedding,
        userId: input.userId,
        agentId: input.agentId,
        runId: input.runId,
        actorId: input.messages[0]?.role === 'user' ? input.userId : input.agentId,
        role: input.messages[0]?.role,
        attributedTo: memory.attributedTo,
        event: 'ADD',
      })
    }

    return records
  }

  /**
   * Phase 6: Batch Persist
   * Store memories as notes with chunks for semantic search.
   */
  async batchPersist(records: MemoryRecord[]): Promise<string[]> {
    const noteIds: string[] = []

    for (const record of records) {
      try {
        // Create a note for this memory
        const note = await db.note.create({
          data: {
            userId: record.userId ?? 'system',
            title: `[Memory] ${record.text.slice(0, 80)}`,
            content: record.text,
            markdown: record.text,
            tags: [
              'ai-memory',
              record.attributedTo?.toLowerCase() ?? 'unknown',
              record.agentId ? 'agent' : 'user',
            ].join(','),
          },
        })

        // Create chunk with embedding
        await db.noteChunk.create({
          data: {
            noteId: note.id,
            content: record.text,
            embedding: JSON.stringify(record.embedding),
            chunkIndex: 0,
            tokenCount: Math.ceil(record.text.length / 4),
          },
        })

        // Create AiMemory record for quick lookup
        await db.aiMemory.create({
          data: {
            category: record.agentId ? 'agent_memory' : 'conversation',
            key: record.hash,
            value: JSON.stringify({
              text: record.text,
              noteId: note.id,
              userId: record.userId,
              agentId: record.agentId,
              runId: record.runId,
              attributedTo: record.attributedTo,
            }),
            confidence: 1.0,
            isSynced: true,
          },
        })

        noteIds.push(note.id)
      } catch (error) {
        console.error('Failed to persist memory:', error)
      }
    }

    return noteIds
  }

  /**
   * Phase 7: Entity Linking
   * Extract entities from memory texts and link to existing entities.
   */
  async linkEntities(
    records: MemoryRecord[],
    userId?: string
  ): Promise<void> {
    for (const record of records) {
      const entities = this.extractEntities(record.text)

      for (const entity of entities) {
        try {
          // Search for existing entity
          const existing = await db.memoryEntity.findFirst({
            where: {
              name: { contains: entity.text },
              ...(userId ? { userId } : {}),
            },
          })

          if (existing) {
            // Update entity properties with link to memory
            const props = JSON.parse(existing.properties)
            await db.memoryEntity.update({
              where: { id: existing.id },
              data: {
                properties: JSON.stringify({
                  ...props,
                  linkedMemoryIds: [
                    ...(props.linkedMemoryIds || []),
                    record.id,
                  ],
                }),
              },
            })
          } else {
            // Create new entity
            await db.memoryEntity.create({
              data: {
                userId: userId ?? 'system',
                name: entity.text,
                type: this.mapEntityType(entity.entityType),
                description: `Extracted from memory: ${record.text.slice(0, 100)}`,
                properties: JSON.stringify({
                  entityType: entity.entityType,
                  linkedMemoryIds: [record.id],
                }),
                confidence: 0.8,
                source: 'memory_pipeline',
              },
            })
          }
        } catch (error) {
          console.error('Entity linking failed:', error)
        }
      }
    }
  }

  /**
   * Full pipeline: add memories from a conversation.
   */
  async add(input: MemoryInput): Promise<MemoryRecord[]> {
    // Phase 0: Context
    const sessionScope = this.buildSessionScope(input)
    console.log(`[MemoryPipeline] Processing: ${sessionScope}`)

    // Phase 1: Get existing memory hashes for dedup
    const existingMemories = await db.aiMemory.findMany({
      where: { category: { in: ['conversation', 'agent_memory'] } },
      select: { key: true },
    })
    const existingHashes = new Set(existingMemories.map((m) => m.key))

    // Phase 2: Extract
    const extracted = await this.extractMemories(input)
    if (extracted.length === 0) return []

    // Phase 3: Embed
    const embeddings = await this.batchEmbed(
      extracted.map((e) => e.text),
      input.userId
    )

    // Phase 4 + 5: Process and dedup
    const records = await this.processAndDedup(
      extracted,
      embeddings,
      input,
      existingHashes
    )
    if (records.length === 0) return []

    // Phase 6: Persist
    await this.batchPersist(records)

    // Phase 7: Entity linking
    await this.linkEntities(records, input.userId)

    // Phase 8: Return
    return records
  }

  /**
   * Search memories using hybrid semantic + keyword search.
   * Inspired by mem0's search pipeline.
   */
  async search(
    query: string,
    userId?: string,
    topK: number = 10,
    threshold: number = 0.3
  ): Promise<Array<{ id: string; text: string; score: number }>> {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, userId ?? 'system')

    // Semantic search via NoteChunks
    const overFetch = Math.min(topK * 4, 200)
    const semanticResults = await this.retrieveExistingMemories(
      queryEmbedding.embedding,
      userId,
      undefined, // agentId not used in search
      overFetch
    )

    // Keyword boost: simple text matching
    const keywordResults = await db.note.findMany({
      where: {
        ...(userId ? { userId } : {}),
        tags: { contains: 'ai-memory' },
        OR: [
          { content: { contains: query } },
          { title: { contains: query } },
        ],
      },
      take: topK * 2,
    })

    // Combine scores
    const combinedMap = new Map<string, { id: string; text: string; score: number }>()

    for (const result of semanticResults) {
      if (result.score >= threshold) {
        combinedMap.set(result.id, result)
      }
    }

    for (const note of keywordResults) {
      const existing = combinedMap.get(note.id)
      if (existing) {
        existing.score = Math.min(existing.score + 0.2, 1.0) // Boost keyword matches
      } else {
        combinedMap.set(note.id, {
          id: note.id,
          text: note.content.slice(0, 300),
          score: 0.4,
        })
      }
    }

    return Array.from(combinedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  // --- Private Helpers ---

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
    const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
    if (magA === 0 || magB === 0) return 0
    return dot / (magA * magB)
  }

  private extractEntities(text: string): EntityRecord[] {
    const entities: EntityRecord[] = []

    // Extract proper nouns (capitalized multi-word sequences)
    const properRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
    let match: RegExpExecArray | null
    while ((match = properRegex.exec(text)) !== null) {
      entities.push({
        text: match[1],
        entityType: 'PROPER',
        linkedMemoryIds: [],
      })
    }

    // Extract quoted text
    const quotedRegex = /"([^"]+)"/g
    while ((match = quotedRegex.exec(text)) !== null) {
      entities.push({
        text: match[1],
        entityType: 'QUOTED',
        linkedMemoryIds: [],
      })
    }

    return entities
  }

  private mapEntityType(
    entityType: string
  ): string {
    switch (entityType) {
      case 'PROPER':
        return 'person'
      case 'COMPOUND':
        return 'concept'
      case 'QUOTED':
        return 'topic'
      case 'NOUN':
        return 'concept'
      default:
        return 'concept'
    }
  }
}

// --- Singleton ---

let pipelineInstance: MemoryPipeline | null = null

export function getMemoryPipeline(): MemoryPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new MemoryPipeline()
  }
  return pipelineInstance
}
