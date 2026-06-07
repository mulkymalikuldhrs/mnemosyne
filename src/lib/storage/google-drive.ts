// ============================================================
// MNEMOSYNE v1.0.0 — Google Drive Storage Adapter
// Universal AI/Human Memory Hub
//
// Implements CloudStorageProviderInterface for Google Drive
// using the Drive API v3. Supports OAuth2 authentication,
// pagination, rate limiting, and file content ingestion.
// ============================================================

import type {
  CloudFile,
  CloudStorageProviderInterface,
  CloudStorageProvider,
  GoogleDriveCredentials,
  ListFilesOptions,
  StorageCredentials,
} from './types'

// --- Constants ---

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const DEFAULT_PAGE_SIZE = 100
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const RATE_LIMIT_STATUS = 429
const SERVER_ERROR_MIN = 500

// --- Error Class ---

class GoogleDriveError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly providerError?: unknown
  ) {
    super(message)
    this.name = 'GoogleDriveError'
  }
}

// --- Helper: Sleep ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Helper: Retry with Exponential Backoff ---

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if the error is retryable
      const isRetryable =
        error instanceof GoogleDriveError &&
        (error.statusCode === RATE_LIMIT_STATUS ||
          (error.statusCode ?? 0) >= SERVER_ERROR_MIN)

      if (!isRetryable || attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
      await sleep(delay)
    }
  }

  throw lastError ?? new Error('Unexpected retry loop exit')
}

// --- Helper: Google Drive API File to CloudFile ---

function driveFileToCloudFile(file: DriveApiFile): CloudFile {
  return {
    id: file.id,
    providerFileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: parseInt(file.size ?? '0', 10),
    path: file.parents?.[0] ?? 'root',
    webUrl: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    thumbnailUrl: file.thumbnailLink ?? '',
    lastModified: file.modifiedTime ?? null,
  }
}

// --- Google Drive API Types ---

interface DriveApiFile {
  id: string
  name: string
  mimeType: string
  size?: string
  parents?: string[]
  webViewLink?: string
  thumbnailLink?: string
  modifiedTime?: string
  createdTime?: string
  md5Checksum?: string
  trashed?: boolean
}

interface DriveApiListResponse {
  files: DriveApiFile[]
  nextPageToken?: string
  incompleteSearch?: boolean
}

type DriveApiFileResponse = DriveApiFile

// ============================================================
// GoogleDriveProvider
// ============================================================

export class GoogleDriveProvider implements CloudStorageProviderInterface {
  readonly providerType: CloudStorageProvider = 'google_drive'
  isAuthenticated: boolean = false

  private accessToken: string = ''
  private refreshToken: string = ''
  private clientId: string = ''
  private clientSecret: string = ''

  // --- Authentication ---

  async authenticate(credentials: StorageCredentials): Promise<void> {
    const creds = credentials as GoogleDriveCredentials

    if (!creds.accessToken) {
      throw new GoogleDriveError('Google Drive access token is required')
    }

    this.accessToken = creds.accessToken
    this.refreshToken = creds.refreshToken ?? ''
    this.clientId = creds.clientId ?? process.env.GOOGLE_DRIVE_CLIENT_ID ?? ''
    this.clientSecret = creds.clientSecret ?? process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? ''

    // Validate the access token by fetching user info
    try {
      const response = await this.makeRequest(
        'https://www.googleapis.com/oauth2/v1/tokeninfo',
        { method: 'GET' }
      )

      if (!response.ok) {
        // Try to refresh the token if we have a refresh token
        if (this.refreshToken && this.clientId && this.clientSecret) {
          await this.refreshAccessToken()
        } else {
          throw new GoogleDriveError(
            'Invalid Google Drive access token',
            response.status
          )
        }
      }

      this.isAuthenticated = true
    } catch (error) {
      this.isAuthenticated = false
      if (error instanceof GoogleDriveError) throw error
      throw new GoogleDriveError(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- List Files ---

  async listFiles(path: string, options?: ListFilesOptions): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
    const queryParts: string[] = ['trashed = false']

    // If path is specified, filter by parent folder
    if (path && path !== '/' && path !== 'root') {
      const folderId = await this.resolvePathToFolderId(path)
      queryParts.push(`'${folderId}' in parents`)
    } else if (path === 'root' || path === '/') {
      queryParts.push("'root' in parents")
    }

    // Filter by MIME type if specified
    if (options?.mimeType) {
      queryParts.push(`mimeType = '${options.mimeType}'`)
    }

    // Filter by query if specified
    if (options?.query) {
      queryParts.push(`name contains '${options.query.replace(/'/g, "\\'")}'`)
    }

    const queryParams = new URLSearchParams({
      pageSize: String(Math.min(pageSize, 1000)),
      fields: 'nextPageToken, files(id, name, mimeType, size, parents, webViewLink, thumbnailLink, modifiedTime, createdTime, md5Checksum)',
      q: queryParts.join(' and '),
      orderBy: this.buildOrderBy(options?.orderBy, options?.sortOrder),
    })

    if (options?.pageToken) {
      queryParams.set('pageToken', options.pageToken)
    }

    return withRetry(async () => {
      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files?${queryParams.toString()}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw await this.createErrorFromResponse(response, 'Failed to list files')
      }

      const data = (await response.json()) as DriveApiListResponse
      return data.files.filter((f) => !f.trashed).map(driveFileToCloudFile)
    })
  }

  // --- Download File ---

  async downloadFile(fileId: string): Promise<Buffer> {
    this.ensureAuthenticated()

    return withRetry(async () => {
      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw await this.createErrorFromResponse(response, 'Failed to download file')
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    })
  }

  // --- Upload File ---

  async uploadFile(path: string, content: Buffer, mimeType: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    // Parse the path to get the parent folder and file name
    const pathParts = path.split('/').filter(Boolean)
    const fileName = pathParts[pathParts.length - 1]
    const parentPath = pathParts.slice(0, -1).join('/')

    // Resolve the parent folder
    let parentId = 'root'
    if (parentPath) {
      parentId = await this.resolvePathToFolderId(parentPath)
    }

    return withRetry(async () => {
      // Use multipart upload for metadata + content
      const boundary = `mnemosyne_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`

      const metadata = {
        name: fileName,
        parents: [parentId],
      }

      const body =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`

      const bodyEnd = `\r\n--${boundary}--`

      const bodyBuffer = Buffer.concat([
        Buffer.from(body),
        content,
        Buffer.from(bodyEnd),
      ])

      const response = await this.makeRequest(
        `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: bodyBuffer,
        }
      )

      if (!response.ok) {
        throw await this.createErrorFromResponse(response, 'Failed to upload file')
      }

      const data = (await response.json()) as DriveApiFileResponse
      return driveFileToCloudFile(data)
    })
  }

  // --- Delete File ---

  async deleteFile(fileId: string): Promise<void> {
    this.ensureAuthenticated()

    await withRetry(async () => {
      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`,
        { method: 'DELETE' }
      )

      if (!response.ok && response.status !== 204) {
        throw await this.createErrorFromResponse(response, 'Failed to delete file')
      }
    })
  }

  // --- Search Files ---

  async searchFiles(query: string): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    const escapedQuery = query.replace(/'/g, "\\'")
    const q = `trashed = false and (name contains '${escapedQuery}' or fullText contains '${escapedQuery}')`

    const queryParams = new URLSearchParams({
      pageSize: String(DEFAULT_PAGE_SIZE),
      fields: 'nextPageToken, files(id, name, mimeType, size, parents, webViewLink, thumbnailLink, modifiedTime, createdTime, md5Checksum)',
      q,
      orderBy: 'recency desc',
    })

    return withRetry(async () => {
      const allFiles: CloudFile[] = []
      let nextPageToken: string | undefined

      do {
        if (nextPageToken) {
          queryParams.set('pageToken', nextPageToken)
        }

        const response = await this.makeRequest(
          `${DRIVE_API_BASE}/files?${queryParams.toString()}`,
          { method: 'GET' }
        )

        if (!response.ok) {
          throw await this.createErrorFromResponse(response, 'Failed to search files')
        }

        const data = (await response.json()) as DriveApiListResponse
        allFiles.push(...data.files.filter((f) => !f.trashed).map(driveFileToCloudFile))
        nextPageToken = data.nextPageToken
      } while (nextPageToken)

      return allFiles
    })
  }

  // --- Get File Info ---

  async getFileInfo(fileId: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    return withRetry(async () => {
      const queryParams = new URLSearchParams({
        fields: 'id, name, mimeType, size, parents, webViewLink, thumbnailLink, modifiedTime, createdTime, md5Checksum',
      })

      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?${queryParams.toString()}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw await this.createErrorFromResponse(response, 'Failed to get file info')
      }

      const data = (await response.json()) as DriveApiFileResponse
      return driveFileToCloudFile(data)
    })
  }

  // --- Create Folder ---

  async createFolder(path: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    const pathParts = path.split('/').filter(Boolean)
    const folderName = pathParts[pathParts.length - 1]
    const parentPath = pathParts.slice(0, -1).join('/')

    let parentId = 'root'
    if (parentPath) {
      parentId = await this.resolvePathToFolderId(parentPath)
    }

    return withRetry(async () => {
      const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }

      const response = await this.makeRequest(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      })

      if (!response.ok) {
        throw await this.createErrorFromResponse(response, 'Failed to create folder')
      }

      const data = (await response.json()) as DriveApiFileResponse
      return driveFileToCloudFile(data)
    })
  }

  // --- Internal Helpers ---

  /**
   * Resolve a path like "Documents/Projects" to a Google Drive folder ID.
   * Creates intermediate folders if they don't exist.
   */
  private async resolvePathToFolderId(path: string): Promise<string> {
    if (!path || path === '/' || path === 'root') return 'root'

    const parts = path.split('/').filter(Boolean)
    let currentParentId = 'root'

    for (const part of parts) {
      const q = `trashed = false and name = '${part.replace(/'/g, "\\'")}' and '${currentParentId}' in parents and mimeType = 'application/vnd.google-apps.folder'`

      const queryParams = new URLSearchParams({
        pageSize: '1',
        fields: 'files(id, name)',
        q,
      })

      const response = await this.makeRequest(
        `${DRIVE_API_BASE}/files?${queryParams.toString()}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw new GoogleDriveError(
          `Failed to resolve path "${path}"`,
          response.status
        )
      }

      const data = (await response.json()) as DriveApiListResponse

      if (data.files.length > 0) {
        currentParentId = data.files[0].id
      } else {
        // Create the folder
        const folder = await this.createFolderDirect(part, currentParentId)
        currentParentId = folder.id
      }
    }

    return currentParentId
  }

  /**
   * Create a folder directly by name and parent ID.
   */
  private async createFolderDirect(name: string, parentId: string): Promise<CloudFile> {
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }

    const response = await this.makeRequest(`${DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })

    if (!response.ok) {
      throw new GoogleDriveError(
        `Failed to create folder "${name}"`,
        response.status
      )
    }

    const data = (await response.json()) as DriveApiFileResponse
    return driveFileToCloudFile(data)
  }

  /**
   * Refresh the OAuth2 access token using the refresh token.
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new GoogleDriveError(
        'Cannot refresh token: missing refresh token or client credentials'
      )
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new GoogleDriveError(
        'Failed to refresh Google Drive access token',
        response.status
      )
    }

    const data = (await response.json()) as { access_token?: string }
    if (data.access_token) {
      this.accessToken = data.access_token
    }
  }

  /**
   * Make an authenticated request to the Google Drive API.
   * Automatically handles token refresh on 401 responses.
   */
  private async makeRequest(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.accessToken}`)

    let response = await fetch(url, { ...init, headers })

    // Try refreshing the token on 401
    if (response.status === 401 && this.refreshToken && this.clientId && this.clientSecret) {
      await this.refreshAccessToken()
      headers.set('Authorization', `Bearer ${this.accessToken}`)
      response = await fetch(url, { ...init, headers })
    }

    return response
  }

  /**
   * Create a GoogleDriveError from an API response.
   */
  private async createErrorFromResponse(
    response: Response,
    defaultMessage: string
  ): Promise<GoogleDriveError> {
    let errorDetails: unknown
    try {
      errorDetails = await response.json()
    } catch {
      errorDetails = null
    }

    const message =
      (errorDetails as Record<string, unknown>)?.error
        ? String(((errorDetails as Record<string, Record<string, unknown>>)?.error as Record<string, unknown>)?.message ?? defaultMessage)
        : defaultMessage

    return new GoogleDriveError(message, response.status, errorDetails)
  }

  /**
   * Build the orderBy query parameter for the Drive API.
   */
  private buildOrderBy(
    orderBy?: 'name' | 'lastModified' | 'size',
    sortOrder?: 'asc' | 'desc'
  ): string {
    const direction = sortOrder === 'desc' ? ' desc' : ''
    switch (orderBy) {
      case 'name':
        return `name${direction}`
      case 'lastModified':
        return `modifiedTime${direction}`
      case 'size':
        return `quotaBytesUsed${direction}`
      default:
        return 'recency'
    }
  }

  /**
   * Ensure the provider is authenticated before performing operations.
   */
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated) {
      throw new GoogleDriveError('Not authenticated. Call authenticate() first.')
    }
  }
}
