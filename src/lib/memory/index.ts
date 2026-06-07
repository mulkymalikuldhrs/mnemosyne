// ═══════════════════════════════════════════════════════════════════════════════
// Mnemosyne v1.0 — Memory Engine
// Inspired by mem0 (https://github.com/mem0ai/mem0) V3 Additive Extraction Pipeline
// Adapted for TypeScript/Next.js with Prisma, multi-LLM hub, and BYOAPI support
// ═══════════════════════════════════════════════════════════════════════════════

import { md5Hash } from '@/lib/crypto'
import db from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface MemoryItem {
  id: string
  memory: string
  hash: string
  metadata: Record<string, unknown>
  score?: number
  createdAt: string
  updatedAt: string
}

export interface AddMemoryInput {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  userId: string
  agentId?: string
  runId?: string
  metadata?: Record<string, unknown>
}

export interface SearchMemoryInput {
  query: string
  userId: string
  agentId?: string
  runId?: string
  topK?: number
  threshold?: number
}

export interface MemoryExtractionResult {
  memories: Array<{
    text: string
    linkedMemoryIds?: string[]
    attributedTo?: string
  }>
}

export interface HybridSearchResult {
  id: string
  memory: string
  score: number
  scoreDetails?: {
    semantic: number
    keyword: number
    entityBoost: number
  }
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ─── V3 Additive Extraction Prompt (adapted from mem0) ─────────────────────────

const ADDITIVE_EXTRACTION_PROMPT = `You are a memory extraction engine for Mnemosyne, the world's biggest free multi-LLM hub and AI agent memory center. Your task is to extract discrete, atomic facts from conversations and store them as independent memory items.

## Core Rules

1. **Extract only facts, not the full conversation** — Each memory should be a single, atomic fact that can be understood independently.
2. **Be specific** — Instead of "User likes coffee", prefer "User prefers oat milk lattes with no sugar".
3. **Preserve temporal context** — If a fact has time relevance, include it (e.g., "User is traveling to Tokyo next March").
4. **Entity linking** — If a new fact relates to an existing memory, include its ID in linked_memory_ids.
5. **Attribution** — Mark who the fact is attributed to (User, Assistant, or System).
6. **No duplicates** — If the same fact already exists in the existing memories, do not extract it again.
7. **ADD only** — Never update or delete existing memories. Only add new ones. The system handles deduplication via hashing.

## Existing Memories

{existing_memories}

## New Messages

{messages}

## Recent Context

{recent_context}

## Custom Instructions

{custom_instructions}

## Output Format

Return a JSON object with a "memory" array. Each item must have:
- "text": The extracted fact (string)
- "linked_memory_ids": Array of existing memory IDs this relates to (can be empty)
- "attributed_to": "User" or "Assistant"

Example:
{
  "memory": [
    {"text": "User's name is Marcus", "linked_memory_ids": [], "attributed_to": "User"},
    {"text": "Marcus was promoted to Senior Engineer at Shopify", "linked_memory_ids": ["0"], "attributed_to": "User"}
  ]
}

Extract all new, non-duplicate facts from the messages above.`

// ─── Memory Engine Class ────────────────────────────────────────────────────────

export class MemoryEngine {
  private userId: string
  private agentId?: string
  private runId?: string

  constructor(options: { userId: string; agentId?: string; runId?: string }) {
    this.userId = options.userId
    this.agentId = options.agentId
    this.runId = options.runId
  }

  // ─── Add Memories (V3 Additive Extraction Pipeline) ─────────────────────────

  /**
   * Add memories from conversation messages using the V3 additive extraction pipeline.
   * Inspired by mem0's ADD-only approach: extract facts via LLM, dedup via hash, batch persist.
   */
  async add(input: AddMemoryInput): Promise<MemoryItem[]> {
    const { messages, userId, agentId, runId, metadata = {} } = input

    // Phase 0: Fetch existing memories for context (filtered by userId)
    const existingMemories = await this.getRecentMemories(userId, 10)
    const existingHashes = new Set(existingMemories.map((m) => m.hash))

    // Phase 1: Map UUIDs to integers for anti-hallucination
    const idMap = new Map<string, number>()
    existingMemories.forEach((m, i) => idMap.set(m.id, i))

    const existingMemoriesText = existingMemories
      .map((m) => `{"id": "${idMap.get(m.id)}", "text": "${m.memory}"}`)
      .join('\n')

    const messagesText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    // Phase 2: LLM Extraction
    const prompt = ADDITIVE_EXTRACTION_PROMPT
      .replace('{existing_memories}', existingMemoriesText || 'No existing memories.')
      .replace('{messages}', messagesText)
      .replace('{recent_context}', messages.slice(-3).map((m) => `${m.role}: ${m.content}`).join('\n'))
      .replace('{custom_instructions}', 'Extract facts relevant to AI agent memory and user preferences.')

    const extraction = await this.callLLMForExtraction(prompt)

    // Phase 3: Hash dedup
    const newMemories: MemoryItem[] = []
    const batchHashes = new Set<string>()

    for (const item of extraction.memories) {
      const hash = md5Hash(item.text)

      // Skip if duplicate of existing memory or within-batch duplicate
      if (existingHashes.has(hash) || batchHashes.has(hash)) continue

      batchHashes.add(hash)

      newMemories.push({
        id: '', // Will be assigned by Prisma
        memory: item.text,
        hash,
        metadata: {
          ...metadata,
          attributedTo: item.attributedTo || 'User',
          linkedMemoryIds: item.linkedMemoryIds || [],
          agentId,
          runId,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    // Phase 4: Batch persist to database
    const persisted: MemoryItem[] = []
    for (const memory of newMemories) {
      const record = await db.aiMemory.create({
        data: {
          userId,
          category: 'extracted_fact',
          key: memory.hash,
          value: memory.memory,
          context: JSON.stringify(memory.metadata),
          confidence: 1.0,
          isSynced: false,
          projectId: agentId || null,
        },
      })

      persisted.push({
        id: record.id,
        memory: record.value,
        hash: record.key,
        metadata: JSON.parse(record.context || '{}'),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })
    }

    // Phase 5: Record history
    for (const memory of persisted) {
      await this.recordHistory(memory.id, null, memory.memory, 'ADD')
    }

    return persisted
  }

  // ─── Search Memories (Hybrid Retrieval) ──────────────────────────────────────

  /**
   * Hybrid search combining semantic similarity + keyword matching + entity boost.
   * Inspired by mem0's multi-signal retrieval: semantic + BM25 + entity boost.
   */
  async search(input: SearchMemoryInput): Promise<HybridSearchResult[]> {
    const { query, userId, topK = 10, threshold = 0.3 } = input

    // Step 1: Get all memories for user (in production, use vector search)
    const allMemories = await db.aiMemory.findMany({
      where: {
        category: 'extracted_fact',
        userId,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200, // Limit for performance
    })

    // Step 2: Keyword/semantic scoring
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const scored = allMemories.map((memory) => {
      const text = memory.value.toLowerCase()

      // Keyword score (BM25-inspired)
      let keywordScore = 0
      for (const term of queryTerms) {
        const regex = new RegExp(term, 'gi')
        const matches = text.match(regex)
        if (matches) {
          keywordScore += matches.length / Math.max(text.split(/\s+/).length, 1)
        }
      }
      keywordScore = Math.min(keywordScore, 1.0)

      // Semantic approximation (in production, use actual embeddings)
      const semanticScore = this.computeSemanticSimilarity(query, text)

      // Entity boost (check if query entities match memory metadata)
      let entityBoost = 0
      try {
        const metadata = JSON.parse(memory.context || '{}')
        if (metadata.linkedMemoryIds && Array.isArray(metadata.linkedMemoryIds) && metadata.linkedMemoryIds.length > 0) {
          entityBoost = 0.1 * (1 / (1 + 0.001 * (metadata.linkedMemoryIds.length - 1) ** 2))
        }
      } catch {
        // ignore
      }

      const combinedScore = semanticScore + keywordScore + entityBoost
      const maxPossible = 2.5 // semantic(1) + keyword(1) + entity(0.5)
      const normalizedScore = combinedScore / maxPossible

      return {
        id: memory.id,
        memory: memory.value,
        score: normalizedScore,
        scoreDetails: {
          semantic: semanticScore,
          keyword: keywordScore,
          entityBoost,
        },
        metadata: JSON.parse(memory.context || '{}'),
        createdAt: memory.createdAt.toISOString(),
        updatedAt: memory.updatedAt.toISOString(),
      }
    })

    // Step 3: Filter by threshold, sort, and return top K
    return scored
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  // ─── Get All Memories ────────────────────────────────────────────────────────

  async getAll(userId: string, options?: { agentId?: string; limit?: number }): Promise<MemoryItem[]> {
    const memories = await db.aiMemory.findMany({
      where: { category: 'extracted_fact', userId, projectId: options?.agentId || undefined },
      orderBy: { updatedAt: 'desc' },
      take: options?.limit || 100,
    })

    return memories.map((m) => ({
      id: m.id,
      memory: m.value,
      hash: m.key,
      metadata: JSON.parse(m.context || '{}'),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))
  }

  // ─── Get Single Memory ───────────────────────────────────────────────────────

  async get(memoryId: string): Promise<MemoryItem | null> {
    const memory = await db.aiMemory.findUnique({ where: { id: memoryId } })
    if (!memory) return null

    return {
      id: memory.id,
      memory: memory.value,
      hash: memory.key,
      metadata: JSON.parse(memory.context || '{}'),
      createdAt: memory.createdAt.toISOString(),
      updatedAt: memory.updatedAt.toISOString(),
    }
  }

  // ─── Update Memory ───────────────────────────────────────────────────────────

  async update(memoryId: string, newText: string): Promise<MemoryItem | null> {
    const existing = await db.aiMemory.findUnique({ where: { id: memoryId } })
    if (!existing) return null

    const oldText = existing.value
    const newHash = md5Hash(newText)

    const updated = await db.aiMemory.update({
      where: { id: memoryId },
      data: {
        value: newText,
        key: newHash,
        updatedAt: new Date(),
      },
    })

    await this.recordHistory(memoryId, oldText, newText, 'UPDATE')

    return {
      id: updated.id,
      memory: updated.value,
      hash: updated.key,
      metadata: JSON.parse(updated.context || '{}'),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  }

  // ─── Delete Memory ───────────────────────────────────────────────────────────

  async delete(memoryId: string): Promise<boolean> {
    const existing = await db.aiMemory.findUnique({ where: { id: memoryId } })
    if (!existing) return false

    await this.recordHistory(memoryId, existing.value, null, 'DELETE')
    await db.aiMemory.delete({ where: { id: memoryId } })

    return true
  }

  // ─── Memory History ──────────────────────────────────────────────────────────

  async getHistory(memoryId: string): Promise<Array<{ event: string; oldMemory: string | null; newMemory: string | null; createdAt: string }>> {
    // In production, use a dedicated History table
    // For now, we use the SyncQueue as a proxy
    const entries = await db.syncQueue.findMany({
      where: { entityId: memoryId, entityType: 'memory_history' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return entries.map((e) => {
      const data = JSON.parse(e.data || '{}')
      return {
        event: data.event || e.action,
        oldMemory: data.oldMemory || null,
        newMemory: data.newMemory || null,
        createdAt: e.createdAt.toISOString(),
      }
    })
  }

  // ─── Internal Helpers ────────────────────────────────────────────────────────

  private async getRecentMemories(userId: string, limit: number): Promise<MemoryItem[]> {
    const memories = await db.aiMemory.findMany({
      where: { category: 'extracted_fact', userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    return memories.map((m) => ({
      id: m.id,
      memory: m.value,
      hash: m.key,
      metadata: JSON.parse(m.context || '{}'),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))
  }

  private async callLLMForExtraction(prompt: string): Promise<MemoryExtractionResult> {
    try {
      // Use Puter.js for free LLM extraction
      const llmModule = await import('@/lib/llm')
      const response = await llmModule.LLMRouter.chat(
        { model: 'gpt-4o-mini', provider: 'puter' },
        [
          { role: 'system', content: 'You are a memory extraction engine. Extract facts from conversations. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ]
      )

      // Parse LLM response
      const content = typeof response === 'string' ? response : response?.content || ''
      const jsonMatch = content.match(/\{[\s\S]*"memory"[\s\S]*\}/)
      if (!jsonMatch) return { memories: [] }

      const parsed = JSON.parse(jsonMatch[0])
      return {
        memories: (parsed.memory || []).map((m: any) => ({
          text: m.text || '',
          linkedMemoryIds: m.linked_memory_ids || m.linkedMemoryIds || [],
          attributedTo: m.attributed_to || m.attributedTo || 'User',
        })),
      }
    } catch (error) {
      console.error('[Mnemosyne Memory] LLM extraction failed:', error)
      return { memories: [] }
    }
  }

  /**
   * Compute semantic similarity between two strings.
   * In production, use actual embeddings (OpenAI, Transformers.js, etc.)
   * This is a simplified TF-IDF-like approximation.
   */
  private computeSemanticSimilarity(query: string, text: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(Boolean))
    const textWords = new Set(text.toLowerCase().split(/\s+/).filter(Boolean))

    if (queryWords.size === 0 || textWords.size === 0) return 0

    let intersection = 0
    for (const word of queryWords) {
      if (textWords.has(word)) intersection++
    }

    // Jaccard-like similarity
    const union = new Set([...queryWords, ...textWords]).size
    return intersection / Math.max(union, 1)
  }

  private async recordHistory(memoryId: string, oldMemory: string | null, newMemory: string | null, event: string): Promise<void> {
    await db.syncQueue.create({
      data: {
        entityType: 'memory_history',
        entityId: memoryId,
        action: event.toLowerCase(),
        data: JSON.stringify({ event, oldMemory, newMemory }),
        status: 'synced',
      },
    })
  }
}

// ─── Convenience Exports ────────────────────────────────────────────────────────

export function createMemoryEngine(options: { userId: string; agentId?: string; runId?: string }): MemoryEngine {
  return new MemoryEngine(options)
}
