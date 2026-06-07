// ============================================================
// MNEMOSYNE v1.0.0 — Storage Manager
// Universal AI/Human Memory Hub
//
// Orchestrates all cloud storage providers. Manages account
// connections, file synchronization, and content ingestion
// into Mnemosyne's memory system.
//
// Responsibilities:
//   - Provider instantiation and lifecycle management
//   - Account connection and credential storage
//   - Full and incremental sync of cloud files
//   - File ingestion: text extraction → note creation → chunking
//   - Cross-provider file listing and search
// ============================================================

import { db } from '@/lib/db'
import { chunkText } from '@/ai/chunker'
import { generateEmbedding } from '@/ai/embedder'
import { GoogleDriveProvider } from './google-drive'
import { TeraBoxProvider } from './terabox'
import { S3CompatibleProvider } from './s3-compatible'
import { LocalStorageProvider } from './local'
import type {
  CloudFile,
  CloudStorageProvider,
  CloudStorageProviderInterface,
  IngestFileResult,
  ListFilesOptions,
  StorageCredentials,
  SyncResult,
  GoogleDriveCredentials,
  TeraBoxCredentials,
  S3Credentials,
  LocalCredentials,
} from './types'

import {
  isTextMimeType,
  isIngestibleMimeType,
} from './types'

// --- Re-export types and providers ---

export type {
  CloudFile,
  CloudStorageProvider,
  CloudStorageProviderInterface,
  IngestFileResult,
  ListFilesOptions,
  StorageCredentials,
  SyncResult,
} from './types'

export {
  isTextMimeType,
  isDocumentMimeType,
  isIngestibleMimeType,
  TEXT_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
} from './types'

export { GoogleDriveProvider } from './google-drive'
export { TeraBoxProvider } from './terabox'
export { S3CompatibleProvider } from './s3-compatible'
export { LocalStorageProvider } from './local'

// --- Constants ---

const SYNC_BATCH_SIZE = 200
const INGEST_MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// ============================================================
// StorageManager
// ============================================================

  // NOTE: Dropbox and OneDrive adapters are NOT yet implemented.
  // They will throw a StorageManagerError when instantiated.
  // Use Google Drive, S3, TeraBox, or local storage instead.

export class StorageManager {
  private static instance: StorageManager
  private providers: Map<string, CloudStorageProviderInterface> = new Map()

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager()
    }
    return StorageManager.instance
  }

  // ----------------------------------------------------------
  // Provider Management
  // ----------------------------------------------------------

  /**
   * Get a provider instance for the given provider type.
   * Providers are cached by type so they can be reused.
   */
  getProvider(providerType: CloudStorageProvider): CloudStorageProviderInterface {
    const existing = this.providers.get(providerType)
    if (existing) return existing

    let provider: CloudStorageProviderInterface

    switch (providerType) {
      case 'google_drive':
        provider = new GoogleDriveProvider()
        break
      case 'terabox':
        provider = new TeraBoxProvider()
        break
      case 's3':
        provider = new S3CompatibleProvider()
        break
      case 'dropbox':
        // Dropbox uses Google Drive adapter as a placeholder
        // TODO: Implement dedicated DropboxProvider
        throw new StorageManagerError(
          'Dropbox adapter is not yet implemented. ' +
          'Use Google Drive, S3, or local storage instead.'
        )
      case 'onedrive':
        // TODO: Implement dedicated OneDriveProvider
        throw new StorageManagerError(
          'OneDrive adapter is not yet implemented. ' +
          'Use Google Drive, S3, or local storage instead.'
        )
      case 'local':
        provider = new LocalStorageProvider()
        break
      default:
        throw new StorageManagerError(
          `Unknown storage provider: ${providerType}`
        )
    }

    this.providers.set(providerType, provider)
    return provider
  }

  /**
   * Authenticate a provider using stored account credentials.
   * Returns the authenticated provider instance.
   */
  async getAuthenticatedProvider(
    storageAccountId: string
  ): Promise<CloudStorageProviderInterface> {
    const account = await db.cloudStorageAccount.findUnique({
      where: { id: storageAccountId },
    })

    if (!account) {
      throw new StorageManagerError(
        `Storage account not found: ${storageAccountId}`
      )
    }

    if (!account.isEnabled) {
      throw new StorageManagerError(
        `Storage account is disabled: ${account.name}`
      )
    }

    const provider = this.getProvider(
      account.provider as CloudStorageProvider
    )

    // Only re-authenticate if not already authenticated
    if (!provider.isAuthenticated) {
      const credentials = this.buildCredentials(account)
      await provider.authenticate(credentials)
    }

    return provider
  }

  // ----------------------------------------------------------
  // Account Management
  // ----------------------------------------------------------

  /**
   * Add a new cloud storage account for a user.
   */
  async addAccount(
    userId: string,
    provider: CloudStorageProvider,
    name: string,
    credentials: StorageCredentials,
    folderPath: string = '/'
  ): Promise<{ id: string; provider: string; name: string }> {
    // Validate credentials by attempting authentication
    const providerInstance = this.getProvider(provider)
    await providerInstance.authenticate(credentials)

    // Store the account with encrypted credentials
    const account = await db.cloudStorageAccount.create({
      data: {
        userId,
        provider,
        name,
        accessToken: this.extractAccessToken(credentials),
        refreshToken: this.extractRefreshToken(credentials),
        folderPath,
        isEnabled: true,
      },
    })

    return {
      id: account.id,
      provider: account.provider,
      name: account.name,
    }
  }

  /**
   * Remove a cloud storage account and all its file records.
   */
  async removeAccount(storageAccountId: string): Promise<void> {
    await db.cloudFile.deleteMany({
      where: { storageAccountId },
    })

    await db.cloudStorageAccount.delete({
      where: { id: storageAccountId },
    })
  }

  /**
   * List all storage accounts for a user.
   */
  async listAccounts(userId: string): Promise<
    Array<{
      id: string
      provider: string
      name: string
      folderPath: string
      isEnabled: boolean
      lastSyncedAt: string | null
    }>
  > {
    const accounts = await db.cloudStorageAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      name: a.name,
      folderPath: a.folderPath,
      isEnabled: a.isEnabled,
      lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    }))
  }

  // ----------------------------------------------------------
  // Sync Operations
  // ----------------------------------------------------------

  /**
   * Sync all files from a cloud storage account.
   * Performs a full or incremental sync based on the last sync timestamp.
   */
  async syncAccount(storageAccountId: string): Promise<SyncResult> {
    const startTime = Date.now()

    const account = await db.cloudStorageAccount.findUnique({
      where: { id: storageAccountId },
    })

    if (!account) {
      throw new StorageManagerError(
        `Storage account not found: ${storageAccountId}`
      )
    }

    // Mark as syncing
    await db.cloudStorageAccount.update({
      where: { id: storageAccountId },
      data: { isEnabled: true },
    })

    try {
      const provider = await this.getAuthenticatedProvider(storageAccountId)

      // List all files from the provider
      const remoteFiles = await this.listAllRemoteFiles(
        provider,
        account.folderPath
      )

      // Get existing file records from the database
      const existingFiles = await db.cloudFile.findMany({
        where: { storageAccountId },
      })

      const existingFileMap = new Map(
        existingFiles.map((f) => [f.providerFileId, f])
      )

      let newFiles = 0
      let updatedFiles = 0
      let errors = 0

      // Upsert remote files
      for (const remoteFile of remoteFiles) {
        try {
          const existing = existingFileMap.get(remoteFile.providerFileId)

          if (!existing) {
            // New file
            await db.cloudFile.create({
              data: {
                storageAccountId,
                userId: account.userId,
                providerFileId: remoteFile.providerFileId,
                name: remoteFile.name,
                mimeType: remoteFile.mimeType,
                size: remoteFile.size,
                path: remoteFile.path,
                webUrl: remoteFile.webUrl ?? null,
                thumbnailUrl: remoteFile.thumbnailUrl ?? null,
                lastModified: remoteFile.lastModified
                  ? new Date(remoteFile.lastModified)
                  : null,
              },
            })
            newFiles++
          } else {
            // Check if file has been modified
            const remoteModified = remoteFile.lastModified
              ? new Date(remoteFile.lastModified).getTime()
              : 0
            const localModified = existing.lastModified
              ? new Date(existing.lastModified).getTime()
              : 0

            if (remoteModified > localModified || existing.size !== remoteFile.size) {
              // Updated file
              await db.cloudFile.update({
                where: { id: existing.id },
                data: {
                  name: remoteFile.name,
                  mimeType: remoteFile.mimeType,
                  size: remoteFile.size,
                  path: remoteFile.path,
                  webUrl: remoteFile.webUrl ?? null,
                  thumbnailUrl: remoteFile.thumbnailUrl ?? null,
                  lastModified: remoteFile.lastModified
                    ? new Date(remoteFile.lastModified)
                    : null,
                },
              })
              updatedFiles++
            }

            // Remove from the map so we know it still exists
            existingFileMap.delete(remoteFile.providerFileId)
          }
        } catch {
          errors++
        }
      }

      // Files remaining in the map no longer exist remotely
      const deletedFiles = existingFileMap.size
      if (deletedFiles > 0) {
        await db.cloudFile.deleteMany({
          where: {
            storageAccountId,
            providerFileId: { in: Array.from(existingFileMap.keys()) },
          },
        })
      }

      // Update the account's last synced timestamp
      await db.cloudStorageAccount.update({
        where: { id: storageAccountId },
        data: {
          lastSyncedAt: new Date(),
        },
      })

      return {
        totalFiles: remoteFiles.length,
        newFiles,
        updatedFiles,
        deletedFiles,
        errors,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      // Update the account with the sync error
      await db.cloudStorageAccount.update({
        where: { id: storageAccountId },
        data: {
          isEnabled: true, // Keep enabled so we can retry
        },
      })

      throw error
    }
  }

  // ----------------------------------------------------------
  // Ingest Operations
  // ----------------------------------------------------------

  /**
   * Ingest a cloud file into Mnemosyne memory.
   * Downloads the file, extracts text, creates a Note,
   * and stores chunks with embeddings.
   */
  async ingestFile(
    fileId: string,
    userId: string
  ): Promise<IngestFileResult> {
    // Get the file record
    const fileRecord = await db.cloudFile.findUnique({
      where: { id: fileId },
      include: { storageAccount: true },
    })

    if (!fileRecord) {
      throw new StorageManagerError(`Cloud file not found: ${fileId}`)
    }

    if (fileRecord.isSynced === false) {
      throw new StorageManagerError('File is not synced. Sync the account first.')
    }

    // Check if the file is ingestible
    const mimeType = fileRecord.mimeType
    if (!isIngestibleMimeType(mimeType)) {
      throw new StorageManagerError(
        `File type "${mimeType}" cannot be ingested. ` +
        'Only text and document files are supported.'
      )
    }

    // Check file size
    if (fileRecord.size > INGEST_MAX_FILE_SIZE) {
      throw new StorageManagerError(
        `File is too large to ingest (${Math.round(fileRecord.size / 1024 / 1024)} MB). ` +
        `Maximum size is ${INGEST_MAX_FILE_SIZE / 1024 / 1024} MB.`
      )
    }

    // Download the file content
    const provider = await this.getAuthenticatedProvider(
      fileRecord.storageAccountId
    )
    const content = await provider.downloadFile(fileRecord.providerFileId)

    // Extract text from the file content
    const extractedText = await this.extractText(content, mimeType, fileRecord.name)

    if (!extractedText.trim()) {
      throw new StorageManagerError(
        'No text content could be extracted from the file.'
      )
    }

    // Create a Note from the extracted text
    const metadata = {
      source: 'cloud_storage',
      provider: fileRecord.storageAccount.provider,
      fileName: fileRecord.name,
      filePath: fileRecord.path,
      fileSize: fileRecord.size,
      mimeType: fileRecord.mimeType,
      webUrl: fileRecord.webUrl,
      ingestedAt: new Date().toISOString(),
    }

    const note = await db.note.create({
      data: {
        userId,
        title: `[Cloud] ${fileRecord.name}`,
        content: extractedText,
        markdown: this.textToMarkdown(extractedText, fileRecord.name, metadata),
        tags: this.generateTags(fileRecord),
      },
    })

    // Chunk the text and store with embeddings
    const chunks = chunkText(extractedText)
    let chunksCreated = 0

    for (const chunk of chunks) {
      try {
        const embeddingResult = await generateEmbedding(chunk.content, userId)
        await db.noteChunk.create({
          data: {
            noteId: note.id,
            content: chunk.content,
            embedding: JSON.stringify(embeddingResult.embedding),
            chunkIndex: chunk.index,
            tokenCount: chunk.tokenCount,
          },
        })
        chunksCreated++
      } catch {
        // Continue even if embedding fails — the chunk is still useful
        try {
          await db.noteChunk.create({
            data: {
              noteId: note.id,
              content: chunk.content,
              embedding: JSON.stringify([]),
              chunkIndex: chunk.index,
              tokenCount: chunk.tokenCount,
            },
          })
          chunksCreated++
        } catch {
          // Skip this chunk if it can't be stored
        }
      }
    }

    // Mark the file as ingested
    await db.cloudFile.update({
      where: { id: fileId },
      data: {
        isSynced: true,
      },
    })

    return {
      noteId: note.id,
      chunksCreated,
      textExtracted: extractedText.slice(0, 200) + (extractedText.length > 200 ? '...' : ''),
      metadata,
    }
  }

  // ----------------------------------------------------------
  // Cross-Provider Operations
  // ----------------------------------------------------------

  /**
   * List files across all connected storage accounts for a user.
   */
  async listAllFiles(
    userId: string,
    options?: ListFilesOptions
  ): Promise<Array<CloudFile & { provider: string; accountId: string }>> {
    const accounts = await db.cloudStorageAccount.findMany({
      where: { userId, isEnabled: true },
    })

    const allFiles: Array<CloudFile & { provider: string; accountId: string }> = []

    for (const account of accounts) {
      try {
        const provider = await this.getAuthenticatedProvider(account.id)
        const files = await provider.listFiles(account.folderPath, options)

        for (const file of files) {
          allFiles.push({
            ...file,
            provider: account.provider,
            accountId: account.id,
          })
        }
      } catch {
        // Skip accounts that fail to list
      }
    }

    return allFiles
  }

  /**
   * Search for files across all connected storage accounts.
   */
  async searchAllFiles(
    userId: string,
    query: string
  ): Promise<Array<CloudFile & { provider: string; accountId: string }>> {
    const accounts = await db.cloudStorageAccount.findMany({
      where: { userId, isEnabled: true },
    })

    const allResults: Array<CloudFile & { provider: string; accountId: string }> = []

    for (const account of accounts) {
      try {
        const provider = await this.getAuthenticatedProvider(account.id)
        const files = await provider.searchFiles(query)

        for (const file of files) {
          allResults.push({
            ...file,
            provider: account.provider,
            accountId: account.id,
          })
        }
      } catch {
        // Skip accounts that fail to search
      }
    }

    // Also search local database for previously synced files
    const localResults = await db.cloudFile.findMany({
      where: {
        userId,
        name: { contains: query },
      },
      include: { storageAccount: true },
      take: 50,
    })

    for (const record of localResults) {
      // Avoid duplicates from the live search
      const alreadyExists = allResults.some(
        (f) => f.providerFileId === record.providerFileId
      )

      if (!alreadyExists) {
        allResults.push({
          id: record.id,
          providerFileId: record.providerFileId,
          name: record.name,
          mimeType: record.mimeType,
          size: record.size,
          path: record.path,
          webUrl: record.webUrl ?? '',
          thumbnailUrl: record.thumbnailUrl ?? '',
          lastModified: record.lastModified?.toISOString() ?? null,
          provider: record.storageAccount.provider,
          accountId: record.storageAccountId,
        })
      }
    }

    return allResults
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  /**
   * List all remote files from a provider, handling pagination.
   */
  private async listAllRemoteFiles(
    provider: CloudStorageProviderInterface,
    rootPath: string,
    maxFiles: number = SYNC_BATCH_SIZE
  ): Promise<CloudFile[]> {
    const allFiles: CloudFile[] = []
    let pageToken: string | undefined

    do {
      const files = await provider.listFiles(rootPath, {
        pageSize: 200,
        pageToken,
        recursive: true,
      })

      allFiles.push(...files)

      // Stop if we've reached the maximum number of files per sync
      if (allFiles.length >= maxFiles) {
        break
      }

      // Most providers use pageToken for pagination
      // The listFiles method handles this internally
      pageToken = undefined // Reset to avoid infinite loops
    } while (pageToken && allFiles.length < maxFiles)

    return allFiles.slice(0, maxFiles)
  }

  /**
   * Extract text from file content based on MIME type.
   */
  private async extractText(
    content: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<string> {
    // Plain text files
    if (isTextMimeType(mimeType)) {
      return content.toString('utf-8')
    }

    // CSV files — convert to readable text
    if (mimeType === 'text/csv') {
      return content.toString('utf-8')
    }

    // JSON files — pretty-print
    if (mimeType === 'application/json') {
      try {
        const parsed = JSON.parse(content.toString('utf-8'))
        return JSON.stringify(parsed, null, 2)
      } catch {
        return content.toString('utf-8')
      }
    }

    // PDF files — extract text (basic approach)
    if (mimeType === 'application/pdf') {
      return this.extractTextFromPdf(content, fileName)
    }

    // Office documents (docx, xlsx, pptx)
    if (
      mimeType.includes('openxmlformats-officedocument') ||
      mimeType.includes('msword') ||
      mimeType.includes('ms-excel') ||
      mimeType.includes('ms-powerpoint')
    ) {
      return this.extractTextFromOffice(content, mimeType, fileName)
    }

    // Fallback: try to read as text
    try {
      const text = content.toString('utf-8')
      // Check if it's actually readable text (not binary garbage)
      const nullCount = (text.match(/\0/g) ?? []).length
      if (nullCount < text.length * 0.01) {
        return text
      }
    } catch {
      // Not readable as text
    }

    return `[Binary file: ${fileName} (${mimeType}, ${content.length} bytes)]`
  }

  /**
   * Extract text from a PDF file.
   * Basic approach: looks for text streams in the PDF.
   */
  private async extractTextFromPdf(
    content: Buffer,
    fileName: string
  ): Promise<string> {
    // Simple PDF text extraction: find text between BT and ET markers
    const text: string[] = []
    const pdfText = content.toString('latin1')

    // Extract text from text objects (BT...ET blocks)
    const btEtRegex = /BT([\s\S]*?)ET/g
    let match: RegExpExecArray | null

    while ((match = btEtRegex.exec(pdfText)) !== null) {
      const block = match[1]
      // Extract text from Tj and TJ operators
      const tjRegex = /\(([^)]*)\)\s*Tj/g
      let tjMatch: RegExpExecArray | null
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        text.push(tjMatch[1])
      }

      // TJ arrays
      const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g
      let tjArrayMatch: RegExpExecArray | null
      while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
        const arrayContent = tjArrayMatch[1]
        const stringRegex = /\(([^)]*)\)/g
        let strMatch: RegExpExecArray | null
        while ((strMatch = stringRegex.exec(arrayContent)) !== null) {
          text.push(strMatch[1])
        }
      }
    }

    if (text.length === 0) {
      return `[PDF document: ${fileName}. Text extraction limited — consider using a dedicated PDF parser for better results.]`
    }

    return text.join(' ').replace(/\s+/g, ' ').trim()
  }

  /**
   * Extract text from an Office document.
   * Basic approach: extract text from XML content inside the ZIP.
   */
  private async extractTextFromOffice(
    content: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<string> {
    // Office documents are ZIP files containing XML.
    // We do a basic extraction by looking for text content in the XML.
    const text: string[] = []
    const rawContent = content.toString('latin1')

    // Look for common text patterns in Office XML
    const textRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g  // Word
    const cellRegex = /<v>([^<]+)<\/v>/g             // Excel cell values
    const slideRegex = /<a:t>([^<]+)<\/a:t>/g        // PowerPoint

    let match: RegExpExecArray | null

    while ((match = textRegex.exec(rawContent)) !== null) {
      text.push(match[1])
    }

    while ((match = cellRegex.exec(rawContent)) !== null) {
      text.push(match[1])
    }

    while ((match = slideRegex.exec(rawContent)) !== null) {
      text.push(match[1])
    }

    if (text.length === 0) {
      return `[Office document: ${fileName} (${mimeType}). Text extraction limited — consider using a dedicated parser for better results.]`
    }

    return text.join(' ').replace(/\s+/g, ' ').trim()
  }

  /**
   * Convert extracted text to a Markdown note with metadata header.
   */
  private textToMarkdown(
    text: string,
    fileName: string,
    metadata: Record<string, unknown>
  ): string {
    const frontmatter = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n')

    return `---\nsource: cloud_storage\nfile: ${fileName}\n${frontmatter}\n---\n\n# ${fileName}\n\n${text}`
  }

  /**
   * Generate tags for a cloud file based on its metadata.
   */
  private generateTags(fileRecord: { name: string; mimeType: string; path: string }): string {
    const tags: string[] = ['cloud-storage']

    // Add provider-specific tag
    tags.push(fileRecord.mimeType.split('/').pop() ?? 'file')

    // Add extension as tag
    const ext = fileRecord.name.split('.').pop()?.toLowerCase()
    if (ext && ext.length <= 10) {
      tags.push(ext)
    }

    // Add category tag based on MIME type
    if (fileRecord.mimeType.startsWith('text/')) {
      tags.push('text')
    } else if (fileRecord.mimeType.startsWith('image/')) {
      tags.push('image')
    } else if (fileRecord.mimeType.startsWith('video/')) {
      tags.push('video')
    } else if (fileRecord.mimeType.startsWith('audio/')) {
      tags.push('audio')
    } else if (fileRecord.mimeType.includes('pdf')) {
      tags.push('pdf')
    } else if (fileRecord.mimeType.includes('office') || fileRecord.mimeType.includes('word') || fileRecord.mimeType.includes('excel') || fileRecord.mimeType.includes('presentation')) {
      tags.push('document')
    }

    return [...new Set(tags)].join(',')
  }

  /**
   * Build a credentials object from a stored account record.
   */
  private buildCredentials(
    account: {
      provider: string
      accessToken: string
      refreshToken: string
      folderPath: string
    }
  ): StorageCredentials {
    switch (account.provider as CloudStorageProvider) {
      case 'google_drive':
        return {
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
        } as GoogleDriveCredentials
      case 'terabox':
        return {
          cookie: account.accessToken,
        } as TeraBoxCredentials
      case 's3':
        // For S3, the extra config is stored in the folderPath temporarily
        // In a real implementation, we'd use a dedicated encrypted config field
        try {
          const config = JSON.parse(account.folderPath || '{}')
          return {
            accessKeyId: account.accessToken,
            secretAccessKey: account.refreshToken,
            endpoint: config.endpoint,
            region: config.region,
            bucket: config.bucket,
            forcePathStyle: config.forcePathStyle,
          } as S3Credentials
        } catch {
          return {
            accessKeyId: account.accessToken,
            secretAccessKey: account.refreshToken,
          } as S3Credentials
        }
      case 'local':
        return {
          rootPath: account.folderPath || account.accessToken,
        } as LocalCredentials
      default:
        return {
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
        }
    }
  }

  /**
   * Extract the access token from a credentials object for storage.
   */
  private extractAccessToken(credentials: StorageCredentials): string {
    if ('accessToken' in credentials) return credentials.accessToken ?? ''
    if ('cookie' in credentials) return credentials.cookie ?? ''
    if ('accessKeyId' in credentials) return credentials.accessKeyId ?? ''
    if ('rootPath' in credentials) return credentials.rootPath ?? ''
    return ''
  }

  /**
   * Extract the refresh token from a credentials object for storage.
   */
  private extractRefreshToken(credentials: StorageCredentials): string {
    if ('refreshToken' in credentials) return credentials.refreshToken ?? ''
    if ('secretAccessKey' in credentials) return credentials.secretAccessKey ?? ''
    return ''
  }
}

// --- Error Class ---

class StorageManagerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageManagerError'
  }
}
