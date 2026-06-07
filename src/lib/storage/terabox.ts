// ============================================================
// MNEMOSYNE v1.0.0 — TeraBox Storage Adapter
// Universal AI/Human Memory Hub
//
// IMPORTANT LIMITATIONS:
//   TeraBox does NOT provide an official public API. This adapter
//   implements a best-effort approach using web scraping and
//   undocumented endpoints. It may break at any time if TeraBox
//   changes their web interface or internal APIs.
//
//   Known limitations:
//   - Authentication relies on browser cookies (not OAuth2)
//   - Rate limiting is aggressive and undocumented
//   - File operations may fail unexpectedly
//   - Search functionality is limited to file name matching
//   - Thumbnail URLs are often time-limited
//   - Download requires additional CSRF token handling
//   - Folder creation may not work in all regions
//
//   For production use, consider using the Google Drive, Dropbox,
//   or S3 adapters instead.
// ============================================================

import type {
  CloudFile,
  CloudStorageProviderInterface,
  CloudStorageProvider,
  ListFilesOptions,
  StorageCredentials,
  TeraBoxCredentials,
} from './types'

// --- Constants ---

const TERABOX_API_BASE = 'https://www.terabox.com/api'
const TERABOX_DRIVE_BASE = 'https://www.terabox.com/disk'
const DEFAULT_PAGE_SIZE = 100

// --- Error Class ---

class TeraBoxError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly providerError?: unknown
  ) {
    super(message)
    this.name = 'TeraBoxError'
  }
}

// --- Helper: TeraBox API file to CloudFile ---

function teraboxFileToCloudFile(file: TeraBoxApiFile): CloudFile {
  return {
    id: String(file.fs_id ?? ''),
    providerFileId: String(file.fs_id ?? file.path ?? ''),
    name: file.server_filename ?? file.filename ?? '',
    mimeType: file.isdir === 1
      ? 'application/vnd.terabox.folder'
      : (file.mime_type ?? guessMimeType(file.server_filename ?? file.filename ?? '')),
    size: file.size ?? 0,
    path: file.path ?? '',
    webUrl: file.dlink
      ? `${TERABOX_DRIVE_BASE}/${file.path}`
      : `${TERABOX_DRIVE_BASE}/main?path=${encodeURIComponent(file.path ?? '/')}`,
    thumbnailUrl: file.thumbs?.url3 ?? file.thumbs?.url2 ?? file.thumbs?.url1 ?? '',
    lastModified: file.server_mtime
      ? new Date(file.server_mtime * 1000).toISOString()
      : null,
  }
}

// --- TeraBox API Types ---

interface TeraBoxApiFile {
  fs_id?: number
  path?: string
  server_filename?: string
  filename?: string
  size?: number
  isdir?: number
  md5?: string
  mime_type?: string
  server_mtime?: number
  local_mtime?: number
  dlink?: string
  thumbs?: {
    url1?: string
    url2?: string
    url3?: string
    icon?: string
  }
  category?: number
  server_ctime?: number
  share?: number
}

interface TeraBoxListResponse {
  errno?: number
  list?: TeraBoxApiFile[]
  path?: string
  has_more?: number
  start?: number
  request_id?: number
}

interface TeraBoxFileResponse {
  errno?: number
  info?: TeraBoxApiFile
  request_id?: number
}

// ============================================================
// TeraBoxProvider
// ============================================================

export class TeraBoxProvider implements CloudStorageProviderInterface {
  readonly providerType: CloudStorageProvider = 'terabox'
  isAuthenticated: boolean = false

  private cookie: string = ''
  private userAgent: string = ''
  private csrfToken: string = ''
  private jsToken: string = ''

  // --- Authentication ---

  async authenticate(credentials: StorageCredentials): Promise<void> {
    const creds = credentials as TeraBoxCredentials

    if (!creds.cookie) {
      throw new TeraBoxError(
        'TeraBox cookie is required for authentication. ' +
        'Log in via a browser and copy the cookie string.'
      )
    }

    this.cookie = creds.cookie
    this.userAgent = creds.userAgent ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    try {
      // Validate the cookie by fetching the user's file list
      const response = await this.makeRequest(
        `${TERABOX_API_BASE}/list?dir=/&num=1&order=name`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw new TeraBoxError(
          'TeraBox authentication failed: invalid or expired cookie',
          response.status
        )
      }

      const data = (await response.json()) as TeraBoxListResponse

      if (data.errno && data.errno !== 0) {
        // errno -6 means not logged in
        if (data.errno === -6) {
          throw new TeraBoxError(
            'TeraBox cookie has expired. Please re-authenticate.',
            401
          )
        }
        // Some errors are acceptable (e.g., empty directory)
        if (data.errno !== 0 && data.errno !== 2) {
          throw new TeraBoxError(
            `TeraBox authentication error: errno=${data.errno}`,
            401
          )
        }
      }

      // Try to extract CSRF/JS tokens from the response
      this.extractTokens(data as unknown as Record<string, unknown>)

      this.isAuthenticated = true
    } catch (error) {
      this.isAuthenticated = false
      if (error instanceof TeraBoxError) throw error
      throw new TeraBoxError(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- List Files ---

  async listFiles(path: string, options?: ListFilesOptions): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
    const dir = path || '/'
    const page = options?.pageToken ? parseInt(options.pageToken, 10) : 0

    const queryParams = new URLSearchParams({
      dir,
      num: String(pageSize),
      order: this.mapOrderBy(options?.orderBy, options?.sortOrder),
      start: String(page * pageSize),
    })

    try {
      const response = await this.makeRequest(
        `${TERABOX_API_BASE}/list?${queryParams.toString()}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw new TeraBoxError(
          'Failed to list files from TeraBox',
          response.status
        )
      }

      const data = (await response.json()) as TeraBoxListResponse

      if (data.errno && data.errno !== 0 && data.errno !== 2) {
        throw new TeraBoxError(
          `TeraBox list error: errno=${data.errno}`,
          400
        )
      }

      const files = (data.list ?? []).map((f) => teraboxFileToCloudFile(f))

      // Apply client-side query filtering if needed
      if (options?.query) {
        const queryLower = options.query.toLowerCase()
        return files.filter((f) => f.name.toLowerCase().includes(queryLower))
      }

      return files
    } catch (error) {
      if (error instanceof TeraBoxError) throw error
      throw new TeraBoxError(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Download File ---

  async downloadFile(fileId: string): Promise<Buffer> {
    this.ensureAuthenticated()

    // TeraBox requires a dlink (download link) to download files
    // First, get the file info to obtain the dlink
    try {
      const fileResponse = await this.makeRequest(
        `${TERABOX_API_BASE}/fileinfo?fs_id=${encodeURIComponent(fileId)}&dlink=1`,
        { method: 'GET' }
      )

      if (!fileResponse.ok) {
        throw new TeraBoxError(
          'Failed to get download link from TeraBox',
          fileResponse.status
        )
      }

      const fileData = (await fileResponse.json()) as TeraBoxFileResponse

      if (fileData.errno && fileData.errno !== 0) {
        throw new TeraBoxError(
          `TeraBox fileinfo error: errno=${fileData.errno}`,
          400
        )
      }

      const dlink = fileData.info?.dlink
      if (!dlink) {
        throw new TeraBoxError(
          'No download link available for this file. ' +
          'TeraBox may require premium for large file downloads.'
        )
      }

      // Download the file content using the dlink
      const downloadResponse = await this.makeRequest(dlink, {
        method: 'GET',
        redirect: 'follow',
      })

      if (!downloadResponse.ok) {
        throw new TeraBoxError(
          'Failed to download file content from TeraBox',
          downloadResponse.status
        )
      }

      const arrayBuffer = await downloadResponse.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      if (error instanceof TeraBoxError) throw error
      throw new TeraBoxError(
        `Failed to download file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Upload File ---

  async uploadFile(path: string, content: Buffer, mimeType: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    // TeraBox upload is complex and uses a multi-step process
    // with precreate -> upload parts -> create superfile
    // This is a best-effort implementation

    const pathParts = path.split('/').filter(Boolean)
    const fileName = pathParts[pathParts.length - 1]

    try {
      // Step 1: Pre-create the file
      const precreateParams = new URLSearchParams({
        path: `/${path}`,
        size: String(content.length),
        isdir: '0',
        autoinit: '1',
        block_list: JSON.stringify([this.simpleHash(content)]),
      })

      const precreateResponse = await this.makeRequest(
        `${TERABOX_API_BASE}/precreate?${precreateParams.toString()}`,
        { method: 'POST' }
      )

      if (!precreateResponse.ok) {
        throw new TeraBoxError(
          'TeraBox pre-create failed. File upload is a best-effort feature.',
          precreateResponse.status
        )
      }

      const precreateData = (await precreateResponse.json()) as Record<string, unknown>

      if ((precreateData as Record<string, number>).errno && (precreateData as Record<string, number>).errno !== 0) {
        throw new TeraBoxError(
          `TeraBox pre-create error: errno=${(precreateData as Record<string, number>).errno}`,
          400
        )
      }

      const uploadId = (precreateData as Record<string, string>).uploadid ?? (precreateData as Record<string, string>).return_type ?? ''

      // Step 2: Upload the file content
      const uploadParams = new URLSearchParams({
        uploadid: String(uploadId),
        path: `/${path}`,
      })

      const formData = new FormData()
      formData.append('file', new Blob([new Uint8Array(content)], { type: mimeType }), fileName)

      const uploadResponse = await this.makeRequest(
        `${TERABOX_API_BASE}/upload?${uploadParams.toString()}`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!uploadResponse.ok) {
        throw new TeraBoxError(
          'TeraBox upload failed. File upload is a best-effort feature.',
          uploadResponse.status
        )
      }

      // Step 3: Create the file (finalize)
      const createParams = new URLSearchParams({
        path: `/${path}`,
        size: String(content.length),
        isdir: '0',
        uploadid: String(uploadId),
        block_list: JSON.stringify([this.simpleHash(content)]),
      })

      const createResponse = await this.makeRequest(
        `${TERABOX_API_BASE}/create?${createParams.toString()}`,
        { method: 'POST' }
      )

      if (!createResponse.ok) {
        throw new TeraBoxError(
          'TeraBox create file failed. File upload is a best-effort feature.',
          createResponse.status
        )
      }

      const createData = (await createResponse.json()) as Record<string, unknown>

      // Return a CloudFile representation
      return {
        id: String((createData as Record<string, number>).fs_id ?? ''),
        providerFileId: String((createData as Record<string, number>).fs_id ?? path),
        name: fileName,
        mimeType,
        size: content.length,
        path: `/${path}`,
        webUrl: `${TERABOX_DRIVE_BASE}/${path}`,
        thumbnailUrl: '',
        lastModified: new Date().toISOString(),
      }
    } catch (error) {
      if (error instanceof TeraBoxError) throw error
      throw new TeraBoxError(
        `Failed to upload file: ${error instanceof Error ? error.message : String(error)}. ` +
        'TeraBox upload is a best-effort feature and may not work reliably.'
      )
    }
  }

  // --- Delete File ---

  async deleteFile(fileId: string): Promise<void> {
    this.ensureAuthenticated()

    try {
      const params = new URLSearchParams({
        filelist: JSON.stringify([fileId]),
      })

      const response = await this.makeRequest(
        `${TERABOX_API_BASE}/filemanager?opera=delete&${params.toString()}`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new TeraBoxError(
          'Failed to delete file from TeraBox',
          response.status
        )
      }

      const data = (await response.json()) as Record<string, unknown>
      if ((data as Record<string, number>).errno && (data as Record<string, number>).errno !== 0) {
        throw new TeraBoxError(
          `TeraBox delete error: errno=${(data as Record<string, number>).errno}`,
          400
        )
      }
    } catch (error) {
      if (error instanceof TeraBoxError) throw error
      throw new TeraBoxError(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Search Files ---

  async searchFiles(query: string): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    // TeraBox has a search API endpoint, but it's limited
    try {
      const params = new URLSearchParams({
        key: query,
        page: '1',
        num: String(DEFAULT_PAGE_SIZE),
      })

      const response = await this.makeRequest(
        `${TERABOX_API_BASE}/search?${params.toString()}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        // Fall back to listing and client-side filtering
        return this.fallbackSearch(query)
      }

      const data = (await response.json()) as TeraBoxListResponse

      if (data.errno && data.errno !== 0) {
        return this.fallbackSearch(query)
      }

      return (data.list ?? []).map((f) => teraboxFileToCloudFile(f))
    } catch {
      return this.fallbackSearch(query)
    }
  }

  // --- Get File Info ---

  async getFileInfo(fileId: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    try {
      const params = new URLSearchParams({
        fs_id: fileId,
        dlink: '0',
      })

      const response = await this.makeRequest(
        `${TERABOX_API_BASE}/fileinfo?${params.toString()}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw new TeraBoxError(
          'Failed to get file info from TeraBox',
          response.status
        )
      }

      const data = (await response.json()) as TeraBoxFileResponse

      if (data.errno && data.errno !== 0) {
        throw new TeraBoxError(
          `TeraBox fileinfo error: errno=${data.errno}`,
          400
        )
      }

      if (!data.info) {
        throw new TeraBoxError('File not found', 404)
      }

      return teraboxFileToCloudFile(data.info)
    } catch (error) {
      if (error instanceof TeraBoxError) throw error
      throw new TeraBoxError(
        `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Create Folder ---

  async createFolder(path: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    const pathParts = path.split('/').filter(Boolean)
    const folderName = pathParts[pathParts.length - 1]

    try {
      const params = new URLSearchParams({
        path: `/${path}`,
        isdir: '1',
        size: '0',
        block_list: '[]',
      })

      const response = await this.makeRequest(
        `${TERABOX_API_BASE}/create?${params.toString()}`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new TeraBoxError(
          'Failed to create folder in TeraBox. This feature may not be reliable.',
          response.status
        )
      }

      const data = (await response.json()) as Record<string, unknown>

      if ((data as Record<string, number>).errno && (data as Record<string, number>).errno !== 0) {
        throw new TeraBoxError(
          `TeraBox create folder error: errno=${(data as Record<string, number>).errno}`,
          400
        )
      }

      return {
        id: String((data as Record<string, number>).fs_id ?? ''),
        providerFileId: String((data as Record<string, number>).fs_id ?? path),
        name: folderName,
        mimeType: 'application/vnd.terabox.folder',
        size: 0,
        path: `/${path}`,
        webUrl: `${TERABOX_DRIVE_BASE}/${path}`,
        thumbnailUrl: '',
        lastModified: new Date().toISOString(),
      }
    } catch (error) {
      if (error instanceof TeraBoxError) throw error
      throw new TeraBoxError(
        `Failed to create folder: ${error instanceof Error ? error.message : String(error)}. ` +
        'TeraBox folder creation is a best-effort feature.'
      )
    }
  }

  // --- Internal Helpers ---

  /**
   * Make an authenticated request to TeraBox.
   */
  private async makeRequest(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('Cookie', this.cookie)
    headers.set('User-Agent', this.userAgent)
    headers.set('Referer', 'https://www.terabox.com/')

    if (this.csrfToken) {
      headers.set('X-CSRF-Token', this.csrfToken)
    }

    return fetch(url, { ...init, headers })
  }

  /**
   * Extract CSRF/JS tokens from TeraBox responses.
   */
  private extractTokens(data: Record<string, unknown>): void {
    if (data.request_id) {
      this.csrfToken = String(data.request_id)
    }
    // TeraBox sometimes includes a jsToken in page responses
    // We'd need to parse HTML pages to get it reliably
  }

  /**
   * Fallback search: list root directory and filter by name.
   * Very limited but better than nothing when the search API fails.
   */
  private async fallbackSearch(query: string): Promise<CloudFile[]> {
    try {
      const allFiles = await this.listFiles('/', { pageSize: 200 })
      const queryLower = query.toLowerCase()
      return allFiles.filter((f) => f.name.toLowerCase().includes(queryLower))
    } catch {
      return []
    }
  }

  /**
   * Map Mnemosyne orderBy to TeraBox order parameter.
   */
  private mapOrderBy(
    orderBy?: 'name' | 'lastModified' | 'size',
    sortOrder?: 'asc' | 'desc'
  ): string {
    switch (orderBy) {
      case 'name':
        return sortOrder === 'desc' ? 'name_desc' : 'name_asc'
      case 'lastModified':
        return sortOrder === 'desc' ? 'time_desc' : 'time_asc'
      case 'size':
        return sortOrder === 'desc' ? 'size_desc' : 'size_asc'
      default:
        return 'name_asc'
    }
  }

  /**
   * Simple hash function for content (not cryptographically secure).
   * Used for TeraBox's block_list parameter.
   */
  private simpleHash(content: Buffer): string {
    let hash = 0
    const sampleSize = Math.min(content.length, 8192)
    for (let i = 0; i < sampleSize; i++) {
      hash = ((hash << 5) - hash + content[i]) | 0
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }

  /**
   * Ensure the provider is authenticated before performing operations.
   */
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated) {
      throw new TeraBoxError('Not authenticated. Call authenticate() first.')
    }
  }
}

/**
 * Guess MIME type from file extension.
 */
function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
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
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    json: 'application/json',
    csv: 'text/csv',
    zip: 'application/zip',
  }
  return mimeMap[ext ?? ''] ?? 'application/octet-stream'
}
