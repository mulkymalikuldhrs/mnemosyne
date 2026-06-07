// ============================================================
// mnemosyne — AI Memory Service
// Offline-first memory for AI agents, sync when online
//
// Features:
//   - syncToCloud() POSTs data to a configurable cloud endpoint
//   - Retry logic with exponential backoff for failed syncs
//   - Batch sync for efficiency (sends entries in batches)
//   - Conflict resolution: last-write-wins with timestamp
//   - Uses SyncQueue DB model for tracking pending syncs
//   - pullFromCloud() fetches updates from the remote endpoint
//   - All existing exports and backward compatibility preserved
// ============================================================

import { db } from './db'
import type { AiMemoryCategory, AiMemoryEntry } from './types'

// --- Sync Configuration ---

/** Default cloud endpoint — override via mnemosyne_CLOUD_SYNC_URL env var */
const DEFAULT_CLOUD_SYNC_URL = process.env.mnemosyne_CLOUD_SYNC_URL || ''

const SYNC_BATCH_SIZE = 25
const MAX_RETRY_ATTEMPTS = 5
const BASE_RETRY_DELAY_MS = 1000  // 1 second
const MAX_RETRY_DELAY_MS = 60000  // 60 seconds
const SYNC_TIMEOUT_MS = 10000     // 10 seconds per request

// ============================================================
// AiMemoryService
// ============================================================

export class AiMemoryService {
  private static instance: AiMemoryService
  private localCache: Map<string, AiMemoryEntry> = new Map()
  private syncInProgress: boolean = false
  private pullInProgress: boolean = false

  private constructor() {}

  static getInstance(): AiMemoryService {
    if (!AiMemoryService.instance) {
      AiMemoryService.instance = new AiMemoryService()
    }
    return AiMemoryService.instance
  }

  /**
   * Store a memory entry. Also enqueues a sync entry in the
   * SyncQueue so the change is tracked for cloud sync.
   */
  async remember(
    category: AiMemoryCategory,
    key: string,
    value: unknown,
    context?: string,
    confidence: number = 1.0,
    projectId?: string
  ): Promise<AiMemoryEntry> {
    const entry = await db.aiMemory.create({
      data: {
        category,
        key,
        value: JSON.stringify(value),
        context: context || null,
        confidence,
        isSynced: false,
        projectId: projectId || null,
      },
    })

    // Enqueue in SyncQueue for cloud sync tracking
    await db.syncQueue.create({
      data: {
        entityType: 'ai_memory',
        entityId: entry.id,
        action: 'create',
        data: JSON.stringify({
          id: entry.id,
          category: entry.category,
          key: entry.key,
          value: entry.value,
          context: entry.context,
          confidence: entry.confidence,
          projectId: entry.projectId,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        }),
        status: 'pending',
        attempts: 0,
      },
    })

    const memoryEntry = this.entryToSummary(entry)
    this.localCache.set(`${category}:${key}`, memoryEntry)
    return memoryEntry
  }

  /**
   * Recall a memory entry
   */
  async recall(category: AiMemoryCategory, key: string): Promise<AiMemoryEntry | null> {
    // Check local cache first
    const cached = this.localCache.get(`${category}:${key}`)
    if (cached) {
      // Update access count
      await db.aiMemory.update({
        where: { id: cached.id },
        data: { accessCount: { increment: 1 }, accessedAt: new Date() },
      })
      return cached
    }

    // Check database
    const entry = await db.aiMemory.findFirst({
      where: { category, key },
      orderBy: { createdAt: 'desc' },
    })

    if (!entry) return null

    const memoryEntry = this.entryToSummary(entry)
    this.localCache.set(`${category}:${key}`, memoryEntry)

    // Update access count
    await db.aiMemory.update({
      where: { id: entry.id },
      data: { accessCount: { increment: 1 }, accessedAt: new Date() },
    })

    return memoryEntry
  }

  /**
   * Search memories by category or partial key
   */
  async search(category?: AiMemoryCategory, query?: string, limit: number = 20): Promise<AiMemoryEntry[]> {
    const where: Record<string, unknown> = {}
    if (category) where.category = category
    if (query) where.key = { contains: query }

    const entries = await db.aiMemory.findMany({
      where,
      orderBy: { accessedAt: 'desc' },
      take: limit,
    })

    return entries.map(e => this.entryToSummary(e))
  }

  /**
   * Sync unsynced memories to cloud — now performs real HTTP POST
   * to the configured cloud endpoint with retry logic, batch sync,
   * and SyncQueue tracking.
   *
   * If no cloud URL is configured, marks entries as synced locally
   * (graceful degradation like the original behavior).
   */
  async syncToCloud(): Promise<{ synced: number; failed: number; retried: number }> {
    if (this.syncInProgress) {
      return { synced: 0, failed: 0, retried: 0 }
    }
    this.syncInProgress = true

    try {
      let synced = 0
      let failed = 0
      let retried = 0

      // Also process any pending items in the SyncQueue
      const pendingQueue = await db.syncQueue.findMany({
        where: {
          entityType: 'ai_memory',
          status: { in: ['pending', 'failed'] },
          attempts: { lt: MAX_RETRY_ATTEMPTS },
        },
        orderBy: { createdAt: 'asc' },
        take: SYNC_BATCH_SIZE,
      })

      if (pendingQueue.length > 0 && DEFAULT_CLOUD_SYNC_URL) {
        // Batch sync: group entries and send in one request per batch
        const batchPayload = pendingQueue.map(q => ({
          queueId: q.id,
          action: q.action,
          data: JSON.parse(q.data),
        }))

        const result = await this.sendToCloud('/sync/push', { entries: batchPayload })

        if (result.success) {
          for (const queueItem of pendingQueue) {
            const wasRetry = queueItem.attempts > 0
            try {
              await db.syncQueue.update({
                where: { id: queueItem.id },
                data: {
                  status: 'synced',
                  attempts: { increment: 1 },
                  syncedAt: new Date(),
                },
              })

              // Also mark the AiMemory entry as synced
              await db.aiMemory.update({
                where: { id: queueItem.entityId },
                data: { isSynced: true },
              }).catch(() => {
                // entry may have been deleted
              })

              if (wasRetry) retried++
              synced++
            } catch {
              failed++
            }
          }
        } else {
          // Batch send failed — mark with retry attempts
          for (const queueItem of pendingQueue) {
            try {
              const newAttempts = queueItem.attempts + 1
              const shouldRetry = newAttempts < MAX_RETRY_ATTEMPTS
              await db.syncQueue.update({
                where: { id: queueItem.id },
                data: {
                  status: shouldRetry ? 'failed' : 'failed',
                  attempts: newAttempts,
                },
              })
            } catch {
              // ignore
            }
            failed++
          }
        }
      } else if (pendingQueue.length > 0) {
        // No cloud URL configured — gracefully mark as synced (backward compat)
        for (const queueItem of pendingQueue) {
          try {
            await db.syncQueue.update({
              where: { id: queueItem.id },
              data: {
                status: 'synced',
                attempts: { increment: 1 },
                syncedAt: new Date(),
              },
            })
            await db.aiMemory.update({
              where: { id: queueItem.entityId },
              data: { isSynced: true },
            }).catch(() => {})
            synced++
          } catch {
            failed++
          }
        }
      }

      // Also find any unsynced AiMemory entries not yet in the SyncQueue
      const unsyncedMemories = await db.aiMemory.findMany({
        where: { isSynced: false },
        take: SYNC_BATCH_SIZE,
      })

      for (const entry of unsyncedMemories) {
        // Check if already in queue
        const existingQueue = await db.syncQueue.findFirst({
          where: { entityType: 'ai_memory', entityId: entry.id },
        })

        if (!existingQueue) {
          // Create queue entry
          await db.syncQueue.create({
            data: {
              entityType: 'ai_memory',
              entityId: entry.id,
              action: 'update',
              data: JSON.stringify({
                id: entry.id,
                category: entry.category,
                key: entry.key,
                value: entry.value,
                context: entry.context,
                confidence: entry.confidence,
                projectId: entry.projectId,
                updatedAt: entry.updatedAt.toISOString(),
              }),
              status: 'pending',
              attempts: 0,
            },
          })
        }
      }

      return { synced, failed, retried }
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Pull updates from the cloud endpoint. Fetches entries that
   * have been updated on the remote side since the last sync,
   * and applies them locally with last-write-wins conflict resolution.
   */
  async pullFromCloud(): Promise<{
    pulled: number
    conflicts: number
    errors: number
  }> {
    if (this.pullInProgress) {
      return { pulled: 0, conflicts: 0, errors: 0 }
    }
    this.pullInProgress = true

    try {
      if (!DEFAULT_CLOUD_SYNC_URL) {
        // No cloud endpoint configured — nothing to pull
        return { pulled: 0, conflicts: 0, errors: 0 }
      }

      let pulled = 0
      let conflicts = 0
      let errors = 0

      // Find the latest synced timestamp to use as the "since" parameter
      const latestSynced = await db.syncQueue.findFirst({
        where: { entityType: 'ai_memory', status: 'synced' },
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      })

      const since = latestSynced?.syncedAt?.toISOString() ?? new Date(0).toISOString()

      // Fetch remote updates
      const result = await this.sendToCloud('/sync/pull', { since })

      const responseData = result.data as Record<string, unknown> | undefined
      if (!result.success || !Array.isArray(responseData?.entries)) {
        return { pulled: 0, conflicts: 0, errors: 1 }
      }

      const remoteEntries = (responseData as Record<string, unknown>).entries as Array<{
        id: string
        category: string
        key: string
        value: string
        context?: string | null
        confidence: number
        projectId?: string | null
        updatedAt: string
      }>

      for (const remote of remoteEntries) {
        try {
          // Check if we have a local entry with the same ID
          const local = await db.aiMemory.findUnique({ where: { id: remote.id } })

          if (local) {
            // Conflict resolution: last-write-wins based on timestamp
            const localTime = new Date(local.updatedAt).getTime()
            const remoteTime = new Date(remote.updatedAt).getTime()

            if (remoteTime > localTime) {
              // Remote is newer — update local
              await db.aiMemory.update({
                where: { id: remote.id },
                data: {
                  value: remote.value,
                  context: remote.context ?? null,
                  confidence: remote.confidence,
                  projectId: remote.projectId ?? null,
                  isSynced: true,
                },
              })
              conflicts++
              pulled++
            }
            // If local is newer or equal, keep local (last-write-wins)
          } else {
            // No local entry — create it
            await db.aiMemory.create({
              data: {
                id: remote.id,
                category: remote.category,
                key: remote.key,
                value: remote.value,
                context: remote.context ?? null,
                confidence: remote.confidence,
                isSynced: true,
                projectId: remote.projectId ?? null,
              },
            })
            pulled++
          }

          // Invalidate cache for this entry
          this.localCache.delete(`${remote.category}:${remote.key}`)
        } catch (err) {
          errors++
        }
      }

      return { pulled, conflicts, errors }
    } catch (err) {
      return { pulled: 0, conflicts: 0, errors: 1 }
    } finally {
      this.pullInProgress = false
    }
  }

  /**
   * Get the current sync queue status
   */
  async getSyncStatus(): Promise<{
    pending: number
    synced: number
    failed: number
    cloudUrl: string
    lastSyncAt: string | null
  }> {
    const pending = await db.syncQueue.count({
      where: { entityType: 'ai_memory', status: 'pending' },
    })
    const syncedCount = await db.syncQueue.count({
      where: { entityType: 'ai_memory', status: 'synced' },
    })
    const failedCount = await db.syncQueue.count({
      where: { entityType: 'ai_memory', status: 'failed' },
    })

    const lastSynced = await db.syncQueue.findFirst({
      where: { entityType: 'ai_memory', status: 'synced' },
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    })

    return {
      pending,
      synced: syncedCount,
      failed: failedCount,
      cloudUrl: DEFAULT_CLOUD_SYNC_URL ? '(configured)' : '(not configured)',
      lastSyncAt: lastSynced?.syncedAt?.toISOString() ?? null,
    }
  }

  /**
   * Retry all failed sync queue entries with exponential backoff
   */
  async retryFailedSyncs(): Promise<{ retried: number; skipped: number }> {
    const failedEntries = await db.syncQueue.findMany({
      where: {
        entityType: 'ai_memory',
        status: 'failed',
        attempts: { lt: MAX_RETRY_ATTEMPTS },
      },
    })

    let retried = 0
    let skipped = 0

    for (const entry of failedEntries) {
      // Check exponential backoff: wait at least 2^attempts seconds since last attempt
      const now = Date.now()
      const created = new Date(entry.createdAt).getTime()
      const elapsed = now - created
      const requiredDelay = Math.min(
        BASE_RETRY_DELAY_MS * Math.pow(2, entry.attempts),
        MAX_RETRY_DELAY_MS
      )

      if (elapsed < requiredDelay) {
        skipped++
        continue
      }

      // Reset status to pending so the next syncToCloud() picks it up
      await db.syncQueue.update({
        where: { id: entry.id },
        data: { status: 'pending' },
      })
      retried++
    }

    return { retried, skipped }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    totalEntries: number
    byCategory: Record<string, number>
    unsyncedCount: number
    topAccessed: AiMemoryEntry[]
  }> {
    const totalEntries = await db.aiMemory.count()
    const unsyncedCount = await db.aiMemory.count({ where: { isSynced: false } })

    const categories = await db.aiMemory.groupBy({
      by: ['category'],
      _count: { category: true },
    })

    const byCategory: Record<string, number> = {}
    for (const c of categories) {
      byCategory[c.category] = c._count.category
    }

    const topAccessed = await db.aiMemory.findMany({
      orderBy: { accessCount: 'desc' },
      take: 5,
    })

    return {
      totalEntries,
      byCategory,
      unsyncedCount,
      topAccessed: topAccessed.map(e => this.entryToSummary(e)),
    }
  }

  /**
   * Delete a memory entry. Also enqueues a delete action in SyncQueue.
   */
  async forget(memoryId: string): Promise<boolean> {
    try {
      const entry = await db.aiMemory.findUnique({ where: { id: memoryId } })
      if (entry) {
        this.localCache.delete(`${entry.category}:${entry.key}`)

        // Enqueue deletion in SyncQueue
        await db.syncQueue.create({
          data: {
            entityType: 'ai_memory',
            entityId: entry.id,
            action: 'delete',
            data: JSON.stringify({
              id: entry.id,
              category: entry.category,
              key: entry.key,
              deletedAt: new Date().toISOString(),
            }),
            status: 'pending',
            attempts: 0,
          },
        })
      }
      await db.aiMemory.delete({ where: { id: memoryId } })
      return true
    } catch {
      return false
    }
  }

  // --- Internal Helpers ---

  /**
   * Send data to the cloud sync endpoint with timeout and
   * error handling. Returns the parsed response.
   */
  private async sendToCloud(
    path: string,
    payload: unknown
  ): Promise<{ success: boolean; data?: unknown }> {
    const url = `${DEFAULT_CLOUD_SYNC_URL}${path}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mnemosyne-Sync-Version': '1.0.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
      })

      if (response.ok) {
        const data = await response.json()
        return { success: true, data }
      }

      return { success: false }
    } catch (err) {
      return { success: false }
    }
  }

  private entryToSummary(entry: {
    id: string
    category: string
    key: string
    value: string
    context: string | null
    confidence: number
    accessCount: number
    isSynced: boolean
    createdAt: Date
    accessedAt: Date
  }): AiMemoryEntry {
    return {
      id: entry.id,
      category: entry.category as AiMemoryCategory,
      key: entry.key,
      value: JSON.parse(entry.value),
      context: entry.context,
      confidence: entry.confidence,
      accessCount: entry.accessCount,
      isSynced: entry.isSynced,
      createdAt: entry.createdAt.toISOString(),
      accessedAt: entry.accessedAt.toISOString(),
    }
  }
}
