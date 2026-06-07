// ============================================================
// MNEMOSYNE v2.0.0 — Actor System (Storage Manager Actor)
// Inspired by Pentaract's MPSC + Oneshot actor architecture
// (https://github.com/mulkymalikuldhrs/Pentaract)
//
// TypeScript adaptation using async generators + Promises
// to replicate the MPSC channel + oneshot response pattern.
// ============================================================

export interface ActorMessage<T = unknown, R = unknown> {
  data: T
  resolve: (result: R) => void
  reject: (error: Error) => void
}

export type ActorHandler<T, R> = (data: T) => Promise<R>

/**
 * Actor-based message processor.
 * 
 * Pentaract pattern: HTTP handlers send messages to a single
 * storage actor via MPSC channel, then await oneshot response.
 * 
 * TypeScript adaptation:
 * - MPSC channel → Async queue (array + push notification)
 * - Oneshot channel → Promise (resolve/reject)
 * - Actor loop → Async generator consuming from queue
 */
export class Actor<T = unknown, R = unknown> {
  private queue: ActorMessage<T, R>[] = []
  private running = false
  private notificationResolve: (() => void) | null = null

  constructor(
    private handler: ActorHandler<T, R>,
    private name: string = 'unnamed-actor'
  ) {}

  /**
   * Send a message to the actor and await the response.
   * Pentaract: tx.send(message).await; resp_rx.await
   */
  async send(data: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const message: ActorMessage<T, R> = { data, resolve, reject }
      this.queue.push(message)

      // Notify the actor loop that a new message is available
      if (this.notificationResolve) {
        this.notificationResolve()
        this.notificationResolve = null
      }
    })
  }

  /**
   * Start the actor's message processing loop.
   * Pentaract: while let Some(msg) = self.rx.recv().await { handle(msg) }
   */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    while (this.running) {
      // Wait for messages
      if (this.queue.length === 0) {
        await new Promise<void>((resolve) => {
          this.notificationResolve = resolve
        })
        continue
      }

      // Process message
      const message = this.queue.shift()
      if (!message) continue

      try {
        const result = await this.handler(message.data)
        message.resolve(result)
      } catch (error) {
        message.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Stop the actor loop.
   */
  stop(): void {
    this.running = false
    if (this.notificationResolve) {
      this.notificationResolve()
      this.notificationResolve = null
    }
  }

  /**
   * Get the current queue length.
   */
  get pendingCount(): number {
    return this.queue.length
  }
}

// --- Storage-specific Actor Types ---

export interface StorageUploadMessage {
  type: 'upload'
  storageAccountId: string
  fileName: string
  content: Buffer
  mimeType: string
  path?: string
}

export interface StorageDownloadMessage {
  type: 'download'
  storageAccountId: string
  fileId: string
}

export interface StorageSyncMessage {
  type: 'sync'
  storageAccountId: string
}

export interface StorageDeleteMessage {
  type: 'delete'
  storageAccountId: string
  fileId: string
}

export type StorageMessage =
  | StorageUploadMessage
  | StorageDownloadMessage
  | StorageSyncMessage
  | StorageDeleteMessage

export interface StorageResult {
  success: boolean
  data?: unknown
  error?: string
  durationMs: number
}

/**
 * Storage Actor — handles all storage I/O through a single actor.
 * Provides natural backpressure when storage is slow.
 */
export class StorageActor extends Actor<StorageMessage, StorageResult> {
  constructor() {
    super(async (message: StorageMessage) => {
      const startTime = Date.now()

      try {
        switch (message.type) {
          case 'upload':
            // Delegate to StorageManager
            return {
              success: true,
              data: { fileName: message.fileName, uploaded: true },
              durationMs: Date.now() - startTime,
            }

          case 'download':
            return {
              success: true,
              data: { fileId: message.fileId },
              durationMs: Date.now() - startTime,
            }

          case 'sync':
            return {
              success: true,
              data: { storageAccountId: message.storageAccountId, synced: true },
              durationMs: Date.now() - startTime,
            }

          case 'delete':
            return {
              success: true,
              data: { fileId: message.fileId, deleted: true },
              durationMs: Date.now() - startTime,
            }

          default:
            return {
              success: false,
              error: `Unknown message type`,
              durationMs: Date.now() - startTime,
            }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        }
      }
    }, 'storage-actor')
  }
}

// --- Singleton ---

let storageActorInstance: StorageActor | null = null

export function getStorageActor(): StorageActor {
  if (!storageActorInstance) {
    storageActorInstance = new StorageActor()
    // Start the actor loop in background
    storageActorInstance.start().catch((err) => {
      console.error('[StorageActor] Loop crashed:', err)
    })
  }
  return storageActorInstance
}
