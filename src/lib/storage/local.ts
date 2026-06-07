// ============================================================
// MNEMOSYNE v1.0.0 — Local Filesystem Storage Adapter
// Universal AI/Human Memory Hub
//
// Implements CloudStorageProviderInterface for the local
// filesystem. Designed for self-hosted and IaaS deployments
// where files are stored on the same server or a mounted
// network volume.
//
// Uses Node.js fs/promises module for async file operations.
// ============================================================

import { readdir, readFile, writeFile, mkdir, stat, unlink, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename, sep, posix } from 'path'
import type {
  CloudFile,
  CloudStorageProviderInterface,
  CloudStorageProvider,
  ListFilesOptions,
  LocalCredentials,
  StorageCredentials,
} from './types'

// --- Constants ---

const LOCAL_FOLDER_MIME_TYPE = 'application/x-local-folder'

// --- Error Class ---

class LocalStorageError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'LocalStorageError'
  }
}

// ============================================================
// LocalStorageProvider
// ============================================================

export class LocalStorageProvider implements CloudStorageProviderInterface {
  readonly providerType: CloudStorageProvider = 'local'
  isAuthenticated: boolean = false

  private rootPath: string = ''

  // --- Authentication ---

  async authenticate(credentials: StorageCredentials): Promise<void> {
    const creds = credentials as LocalCredentials

    if (!creds.rootPath) {
      throw new LocalStorageError(
        'Root path is required for local storage provider'
      )
    }

    // Validate that the root path exists and is accessible
    this.rootPath = creds.rootPath

    try {
      if (!existsSync(this.rootPath)) {
        // Try to create the root directory
        await mkdir(this.rootPath, { recursive: true })
      }

      const stats = await stat(this.rootPath)
      if (!stats.isDirectory()) {
        throw new LocalStorageError(
          `Root path "${this.rootPath}" is not a directory`
        )
      }

      // Test write access by creating and deleting a temp file
      const testFile = join(this.rootPath, '.mnemosyne_write_test')
      await writeFile(testFile, 'test')
      await unlink(testFile)

      this.isAuthenticated = true
    } catch (error) {
      this.isAuthenticated = false
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}. ` +
        'Ensure the root path exists and is readable/writable.'
      )
    }
  }

  // --- List Files ---

  async listFiles(path: string, options?: ListFilesOptions): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    const absolutePath = this.toAbsolutePath(path)

    try {
      if (!existsSync(absolutePath)) {
        return []
      }

      const entries = await readdir(absolutePath, { withFileTypes: true })
      const files: CloudFile[] = []

      for (const entry of entries) {
        // Skip hidden files and directories
        if (entry.name.startsWith('.')) continue

        const entryPath = join(absolutePath, entry.name)
        const relativePath = this.toRelativePath(entryPath)

        try {
          const stats = await stat(entryPath)

          if (entry.isDirectory()) {
            if (!options?.recursive) {
              files.push({
                id: relativePath,
                providerFileId: relativePath,
                name: entry.name,
                mimeType: LOCAL_FOLDER_MIME_TYPE,
                size: 0,
                path: relativePath,
                webUrl: '',
                thumbnailUrl: '',
                lastModified: stats.mtime.toISOString(),
              })
            } else {
              // Recursively list files in subdirectory
              const subFiles = await this.listFiles(relativePath, { ...options, recursive: true })
              files.push(...subFiles)
            }
          } else {
            files.push({
              id: relativePath,
              providerFileId: relativePath,
              name: entry.name,
              mimeType: this.guessMimeType(entry.name),
              size: stats.size,
              path: relativePath,
              webUrl: '',
              thumbnailUrl: '',
              lastModified: stats.mtime.toISOString(),
            })
          }
        } catch {
          // Skip entries we can't stat (permission issues, etc.)
        }
      }

      // Apply client-side filtering
      let result = files

      if (options?.query) {
        const queryLower = options.query.toLowerCase()
        result = result.filter((f) => f.name.toLowerCase().includes(queryLower))
      }

      if (options?.mimeType) {
        result = result.filter((f) => f.mimeType === options.mimeType)
      }

      // Apply sorting
      result = this.sortFiles(result, options?.orderBy, options?.sortOrder)

      // Apply pagination
      if (options?.pageToken) {
        const offset = parseInt(options.pageToken, 10)
        if (!isNaN(offset)) {
          result = result.slice(offset)
        }
      }

      if (options?.pageSize) {
        result = result.slice(0, options.pageSize)
      }

      return result
    } catch (error) {
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Download File ---

  async downloadFile(fileId: string): Promise<Buffer> {
    this.ensureAuthenticated()

    const absolutePath = this.toAbsolutePath(fileId)

    try {
      if (!existsSync(absolutePath)) {
        throw new LocalStorageError('File not found', 'ENOENT')
      }

      const stats = await stat(absolutePath)
      if (stats.isDirectory()) {
        throw new LocalStorageError('Cannot download a directory')
      }

      return await readFile(absolutePath)
    } catch (error) {
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Failed to download file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Upload File ---

  async uploadFile(path: string, content: Buffer, mimeType: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    const absolutePath = this.toAbsolutePath(path)
    const dir = dirname(absolutePath)

    try {
      // Ensure the parent directory exists
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      await writeFile(absolutePath, content)

      const stats = await stat(absolutePath)
      const relativePath = this.toRelativePath(absolutePath)
      const name = basename(absolutePath)

      return {
        id: relativePath,
        providerFileId: relativePath,
        name,
        mimeType: mimeType || this.guessMimeType(name),
        size: stats.size,
        path: relativePath,
        webUrl: '',
        thumbnailUrl: '',
        lastModified: stats.mtime.toISOString(),
      }
    } catch (error) {
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Delete File ---

  async deleteFile(fileId: string): Promise<void> {
    this.ensureAuthenticated()

    const absolutePath = this.toAbsolutePath(fileId)

    try {
      if (!existsSync(absolutePath)) {
        throw new LocalStorageError('File not found', 'ENOENT')
      }

      const stats = await stat(absolutePath)

      if (stats.isDirectory()) {
        await rm(absolutePath, { recursive: true })
      } else {
        await unlink(absolutePath)
      }
    } catch (error) {
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Search Files ---

  async searchFiles(query: string): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    // For local storage, search by recursively listing and filtering
    try {
      const allFiles = await this.listFiles('/', {
        recursive: true,
        pageSize: 1000,
      })

      const queryLower = query.toLowerCase()
      return allFiles.filter((f) =>
        f.name.toLowerCase().includes(queryLower) ||
        f.path.toLowerCase().includes(queryLower)
      )
    } catch (error) {
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Failed to search files: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Get File Info ---

  async getFileInfo(fileId: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    const absolutePath = this.toAbsolutePath(fileId)

    try {
      if (!existsSync(absolutePath)) {
        throw new LocalStorageError('File not found', 'ENOENT')
      }

      const stats = await stat(absolutePath)
      const relativePath = this.toRelativePath(absolutePath)
      const name = basename(absolutePath)

      return {
        id: relativePath,
        providerFileId: relativePath,
        name,
        mimeType: stats.isDirectory()
          ? LOCAL_FOLDER_MIME_TYPE
          : this.guessMimeType(name),
        size: stats.size,
        path: relativePath,
        webUrl: '',
        thumbnailUrl: '',
        lastModified: stats.mtime.toISOString(),
      }
    } catch (error) {
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Create Folder ---

  async createFolder(path: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    const absolutePath = this.toAbsolutePath(path)
    const name = basename(absolutePath)

    try {
      await mkdir(absolutePath, { recursive: true })

      const stats = await stat(absolutePath)
      const relativePath = this.toRelativePath(absolutePath)

      return {
        id: relativePath,
        providerFileId: relativePath,
        name,
        mimeType: LOCAL_FOLDER_MIME_TYPE,
        size: 0,
        path: relativePath,
        webUrl: '',
        thumbnailUrl: '',
        lastModified: stats.mtime.toISOString(),
      }
    } catch (error) {
      if (error instanceof LocalStorageError) throw error
      throw new LocalStorageError(
        `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Internal Helpers ---

  /**
   * Convert a relative path to an absolute path within the root.
   * Prevents path traversal attacks by normalizing and validating.
   */
  private toAbsolutePath(relativePath: string): string {
    // Normalize the path to prevent traversal attacks
    const normalized = relativePath
      .split(/[/\\]/)
      .filter((part) => part && part !== '.' && part !== '..')
      .join(sep)

    const absolute = join(this.rootPath, normalized)

    // Ensure the resolved path is within the root
    if (!absolute.startsWith(this.rootPath)) {
      throw new LocalStorageError(
        'Path traversal detected: path escapes the root directory'
      )
    }

    return absolute
  }

  /**
   * Convert an absolute path to a relative path from the root.
   */
  private toRelativePath(absolutePath: string): string {
    const relative = absolutePath.slice(this.rootPath.length)
    // Normalize to forward slashes for consistency
    return '/' + relative.split(sep).filter(Boolean).join(posix.sep)
  }

  /**
   * Sort files by the specified field and direction.
   */
  private sortFiles(
    files: CloudFile[],
    orderBy?: 'name' | 'lastModified' | 'size',
    sortOrder?: 'asc' | 'desc'
  ): CloudFile[] {
    const direction = sortOrder === 'desc' ? -1 : 1

    return [...files].sort((a, b) => {
      // Always put folders first
      const aIsFolder = a.mimeType === LOCAL_FOLDER_MIME_TYPE ? 0 : 1
      const bIsFolder = b.mimeType === LOCAL_FOLDER_MIME_TYPE ? 0 : 1
      if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder

      switch (orderBy) {
        case 'name':
          return direction * a.name.localeCompare(b.name)
        case 'lastModified': {
          const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0
          const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0
          return direction * (aTime - bTime)
        }
        case 'size':
          return direction * (a.size - b.size)
        default:
          return direction * a.name.localeCompare(b.name)
      }
    })
  }

  /**
   * Guess MIME type from file extension.
   */
  private guessMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      mjs: 'application/javascript',
      ts: 'application/typescript',
      tsx: 'application/typescript',
      jsx: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      yaml: 'application/x-yaml',
      yml: 'application/x-yaml',
      csv: 'text/csv',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      ico: 'image/x-icon',
      bmp: 'image/bmp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      zip: 'application/zip',
      gz: 'application/gzip',
      tar: 'application/x-tar',
      '7z': 'application/x-7z-compressed',
      rar: 'application/x-rar-compressed',
    }
    return mimeMap[ext ?? ''] ?? 'application/octet-stream'
  }

  /**
   * Ensure the provider is authenticated before performing operations.
   */
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated) {
      throw new LocalStorageError('Not authenticated. Call authenticate() first.')
    }
  }
}
