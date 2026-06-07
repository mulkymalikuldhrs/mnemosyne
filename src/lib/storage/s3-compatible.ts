// ============================================================
// MEMORIX v3.0.0 — S3-Compatible Storage Adapter
// Universal AI/Human Memory Hub
//
// Implements CloudStorageProviderInterface for any S3-compatible
// storage service including:
//   - AWS S3
//   - MinIO
//   - Cloudflare R2
//   - DigitalOcean Spaces
//   - Wasabi
//   - Any other S3-compatible service
//
// Uses standard S3 API operations via direct HTTP requests
// with AWS Signature V4 authentication.
// ============================================================

import { createHmac, createHash } from 'crypto'
import type {
  CloudFile,
  CloudStorageProviderInterface,
  CloudStorageProvider,
  ListFilesOptions,
  S3Credentials,
  StorageCredentials,
} from './types'

// --- Constants ---

const DEFAULT_REGION = 'us-east-1'
const DEFAULT_ENDPOINT = 'https://s3.amazonaws.com'
const MAX_KEYS = 1000
const S3_FOLDER_MIME_TYPE = 'application/x-s3-folder'

// --- Error Class ---

class S3Error extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'S3Error'
  }
}

// --- S3 API XML Types (simplified) ---

interface S3ListBucketResult {
  contents: S3Object[]
  commonPrefixes: string[]
  isTruncated: boolean
  nextContinuationToken?: string
  prefix: string
  delimiter?: string
}

interface S3Object {
  key: string
  lastModified: string
  size: number
  etag: string
  storageClass: string
}

// ============================================================
// S3CompatibleProvider
// ============================================================

export class S3CompatibleProvider implements CloudStorageProviderInterface {
  readonly providerType: CloudStorageProvider = 's3'
  isAuthenticated: boolean = false

  private accessKeyId: string = ''
  private secretAccessKey: string = ''
  private endpoint: string = ''
  private region: string = ''
  private bucket: string = ''
  private forcePathStyle: boolean = false

  // --- Authentication ---

  async authenticate(credentials: StorageCredentials): Promise<void> {
    const creds = credentials as S3Credentials

    if (!creds.accessKeyId || !creds.secretAccessKey) {
      throw new S3Error('S3 access key ID and secret access key are required')
    }

    this.accessKeyId = creds.accessKeyId
    this.secretAccessKey = creds.secretAccessKey
    this.endpoint = creds.endpoint ?? process.env.S3_ENDPOINT ?? DEFAULT_ENDPOINT
    this.region = creds.region ?? process.env.S3_REGION ?? DEFAULT_REGION
    this.bucket = creds.bucket ?? process.env.S3_BUCKET ?? ''
    this.forcePathStyle = creds.forcePathStyle ?? false

    if (!this.bucket) {
      throw new S3Error('S3 bucket name is required')
    }

    // Validate credentials by listing objects (with max-keys=1)
    try {
      await this.listObjects('/', 1)
      this.isAuthenticated = true
    } catch (error) {
      this.isAuthenticated = false
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- List Files ---

  async listFiles(path: string, options?: ListFilesOptions): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    const prefix = this.normalizePath(path)
    const pageSize = options?.pageSize ?? MAX_KEYS
    const delimiter = options?.recursive ? undefined : '/'

    try {
      const result = await this.listObjects(
        prefix,
        pageSize,
        delimiter,
        options?.pageToken
      )

      const files: CloudFile[] = []

      // Process objects (files)
      for (const obj of result.contents) {
        // Skip the prefix itself if it appears as an object
        if (obj.key === prefix) continue

        const name = obj.key.split('/').filter(Boolean).pop() ?? obj.key
        files.push({
          id: obj.key,
          providerFileId: obj.key,
          name,
          mimeType: this.guessMimeType(name),
          size: obj.size,
          path: obj.key,
          webUrl: this.getObjectUrl(obj.key),
          thumbnailUrl: '',
          lastModified: obj.lastModified,
        })
      }

      // Process common prefixes (folders)
      for (const folderPrefix of result.commonPrefixes) {
        const folderName = folderPrefix.replace(/\/$/, '').split('/').pop() ?? folderPrefix
        files.push({
          id: folderPrefix,
          providerFileId: folderPrefix,
          name: folderName,
          mimeType: S3_FOLDER_MIME_TYPE,
          size: 0,
          path: folderPrefix,
          webUrl: this.getObjectUrl(folderPrefix),
          thumbnailUrl: '',
          lastModified: null,
        })
      }

      // Apply client-side query filtering if needed
      if (options?.query) {
        const queryLower = options.query.toLowerCase()
        return files.filter((f) => f.name.toLowerCase().includes(queryLower))
      }

      return files
    } catch (error) {
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Download File ---

  async downloadFile(fileId: string): Promise<Buffer> {
    this.ensureAuthenticated()

    try {
      const response = await this.s3Request('GET', fileId)

      if (!response.ok) {
        const errorBody = await response.text()
        throw new S3Error(
          `Failed to download file: ${errorBody}`,
          response.status
        )
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Failed to download file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Upload File ---

  async uploadFile(path: string, content: Buffer, mimeType: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    const key = this.normalizePath(path)

    try {
      const response = await this.s3Request('PUT', key, {
        body: content,
        contentType: mimeType,
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new S3Error(
          `Failed to upload file: ${errorBody}`,
          response.status
        )
      }

      const name = key.split('/').filter(Boolean).pop() ?? key
      return {
        id: key,
        providerFileId: key,
        name,
        mimeType,
        size: content.length,
        path: key,
        webUrl: this.getObjectUrl(key),
        thumbnailUrl: '',
        lastModified: new Date().toISOString(),
      }
    } catch (error) {
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Delete File ---

  async deleteFile(fileId: string): Promise<void> {
    this.ensureAuthenticated()

    try {
      const response = await this.s3Request('DELETE', fileId)

      if (!response.ok && response.status !== 204) {
        const errorBody = await response.text()
        throw new S3Error(
          `Failed to delete file: ${errorBody}`,
          response.status
        )
      }
    } catch (error) {
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Search Files ---

  async searchFiles(query: string): Promise<CloudFile[]> {
    this.ensureAuthenticated()

    // S3 doesn't have native search — list all objects and filter
    // For large buckets, this is inefficient but works for reasonable sizes
    try {
      const allFiles = await this.listFiles('/', {
        recursive: true,
        pageSize: MAX_KEYS,
      })

      const queryLower = query.toLowerCase()
      return allFiles.filter((f) =>
        f.name.toLowerCase().includes(queryLower) ||
        f.path.toLowerCase().includes(queryLower)
      )
    } catch (error) {
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Failed to search files: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Get File Info ---

  async getFileInfo(fileId: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    try {
      const response = await this.s3Request('HEAD', fileId)

      if (!response.ok) {
        throw new S3Error(
          'Failed to get file info',
          response.status
        )
      }

      const name = fileId.split('/').filter(Boolean).pop() ?? fileId
      const contentLength = response.headers.get('content-length')
      const lastModified = response.headers.get('last-modified')
      const contentType = response.headers.get('content-type')

      return {
        id: fileId,
        providerFileId: fileId,
        name,
        mimeType: contentType ?? this.guessMimeType(name),
        size: contentLength ? parseInt(contentLength, 10) : 0,
        path: fileId,
        webUrl: this.getObjectUrl(fileId),
        thumbnailUrl: '',
        lastModified: lastModified ?? null,
      }
    } catch (error) {
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Create Folder ---

  async createFolder(path: string): Promise<CloudFile> {
    this.ensureAuthenticated()

    // In S3, folders are created by uploading a zero-byte object
    // with a trailing slash
    const key = this.normalizePath(path) + '/'
    const folderName = path.split('/').filter(Boolean).pop() ?? path

    try {
      const response = await this.s3Request('PUT', key, {
        body: Buffer.alloc(0),
        contentType: 'application/x-directory',
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new S3Error(
          `Failed to create folder: ${errorBody}`,
          response.status
        )
      }

      return {
        id: key,
        providerFileId: key,
        name: folderName,
        mimeType: S3_FOLDER_MIME_TYPE,
        size: 0,
        path: key,
        webUrl: this.getObjectUrl(key),
        thumbnailUrl: '',
        lastModified: new Date().toISOString(),
      }
    } catch (error) {
      if (error instanceof S3Error) throw error
      throw new S3Error(
        `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // --- Internal Helpers ---

  /**
   * List objects in the bucket with optional delimiter and pagination.
   */
  private async listObjects(
    prefix: string,
    maxKeys: number = MAX_KEYS,
    delimiter?: string,
    continuationToken?: string
  ): Promise<S3ListBucketResult> {
    const params = new URLSearchParams({
      'max-keys': String(maxKeys),
      prefix: prefix,
    })

    if (delimiter) {
      params.set('delimiter', delimiter)
    }

    if (continuationToken) {
      params.set('continuation-token', continuationToken)
    }

    const response = await this.s3Request('GET', '', params)

    if (!response.ok) {
      const errorBody = await response.text()
      throw new S3Error(
        `Failed to list objects: ${errorBody}`,
        response.status
      )
    }

    return this.parseListBucketResult(await response.text())
  }

  /**
   * Parse the S3 ListBucketResult XML response.
   * Uses simple string parsing to avoid XML parser dependency.
   */
  private parseListBucketResult(xml: string): S3ListBucketResult {
    const contents: S3Object[] = []
    const commonPrefixes: string[] = []

    // Extract contents
    const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g
    let match: RegExpExecArray | null

    while ((match = contentRegex.exec(xml)) !== null) {
      const contentBlock = match[1]
      contents.push({
        key: this.extractXmlValue(contentBlock, 'Key') ?? '',
        lastModified: this.extractXmlValue(contentBlock, 'LastModified') ?? new Date().toISOString(),
        size: parseInt(this.extractXmlValue(contentBlock, 'Size') ?? '0', 10),
        etag: this.extractXmlValue(contentBlock, 'ETag') ?? '',
        storageClass: this.extractXmlValue(contentBlock, 'StorageClass') ?? 'STANDARD',
      })
    }

    // Extract common prefixes
    const prefixRegex = /<CommonPrefixes>[\s\S]*?<Prefix>([\s\S]*?)<\/Prefix>[\s\S]*?<\/CommonPrefixes>/g
    while ((match = prefixRegex.exec(xml)) !== null) {
      commonPrefixes.push(match[1].trim())
    }

    // Also try simpler common prefix extraction
    const simplePrefixRegex = /<Prefix>(.*?)<\/Prefix>/g
    if (commonPrefixes.length === 0) {
      while ((match = simplePrefixRegex.exec(xml)) !== null) {
        const prefix = match[1].trim()
        if (prefix && !contents.some((c) => c.key === prefix)) {
          commonPrefixes.push(prefix)
        }
      }
    }

    const isTruncated = this.extractXmlValue(xml, 'IsTruncated') === 'true'
    const nextContinuationToken = this.extractXmlValue(xml, 'NextContinuationToken')
    const prefix = this.extractXmlValue(xml, 'Prefix') ?? ''

    return {
      contents,
      commonPrefixes,
      isTruncated,
      nextContinuationToken: isTruncated ? nextContinuationToken : undefined,
      prefix,
      delimiter: this.extractXmlValue(xml, 'Delimiter') ?? undefined,
    }
  }

  /**
   * Extract a value from an XML string by tag name.
   */
  private extractXmlValue(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
    const match = xml.match(regex)
    return match?.[1]?.trim()
  }

  /**
   * Make an authenticated S3 request using AWS Signature V4.
   */
  private async s3Request(
    method: string,
    key: string,
    paramsOrOptions?: URLSearchParams | S3RequestOptions
  ): Promise<Response> {
    const isParams = paramsOrOptions instanceof URLSearchParams
    const params = isParams ? paramsOrOptions : undefined
    const options = !isParams ? paramsOrOptions : undefined

    const host = this.getHost()
    const path = this.getRequestPath(key, params)
    const url = `https://${host}${path}`

    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)

    const contentHash = createHash('sha256')
      .update(options?.body ?? Buffer.alloc(0))
      .digest('hex')

    const headers: Record<string, string> = {
      host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': contentHash,
    }

    if (options?.contentType) {
      headers['content-type'] = options.contentType
    }

    // Build the canonical request
    const signedHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .join(';')

    const canonicalHeaders = Object.entries(headers)
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}\n`)
      .sort((a, b) => a.localeCompare(b))
      .join('')

    const canonicalQueryString = params?.toString() ?? ''

    const canonicalRequest = [
      method,
      path.split('?')[0],
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      contentHash,
    ].join('\n')

    // Build the string to sign
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    // Calculate the signature
    const signingKey = this.getSignatureKey(dateStamp)
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex')

    // Build the authorization header
    const authorization =
      `AWS4-HMAC-SHA256 ` +
      `Credential=${this.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`

    headers['authorization'] = authorization

    return fetch(url, {
      method,
      headers,
      body: options?.body ? new Uint8Array(options.body) : undefined,
    })
  }

  /**
   * Derive the signing key from the secret access key.
   */
  private getSignatureKey(dateStamp: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${this.secretAccessKey}`)
      .update(dateStamp)
      .digest()
    const kRegion = createHmac('sha256', kDate)
      .update(this.region)
      .digest()
    const kService = createHmac('sha256', kRegion)
      .update('s3')
      .digest()
    const kSigning = createHmac('sha256', kService)
      .update('aws4_request')
      .digest()
    return kSigning
  }

  /**
   * Get the host for S3 requests.
   */
  private getHost(): string {
    const endpointUrl = new URL(this.endpoint)
    if (this.forcePathStyle) {
      return `${endpointUrl.host}/${this.bucket}`
    }
    // Virtual-hosted style: bucket.s3.region.amazonaws.com
    return `${this.bucket}.${endpointUrl.host}`
  }

  /**
   * Get the request path including query string.
   */
  private getRequestPath(key: string, params?: URLSearchParams): string {
    let path: string
    if (this.forcePathStyle) {
      // Path-style: endpoint/bucket/key
      path = `/${this.bucket}/${key}`
    } else {
      // Virtual-hosted style: endpoint/key (bucket is in the host)
      const endpointPath = new URL(this.endpoint).pathname.replace(/\/$/, '')
      path = key ? `${endpointPath}/${key}` : endpointPath || '/'
    }

    if (params && params.toString()) {
      path += `?${params.toString()}`
    }

    return path
  }

  /**
   * Get the public URL for an object.
   */
  private getObjectUrl(key: string): string {
    if (this.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}/${key}`
    }
    const endpointUrl = new URL(this.endpoint)
    return `${endpointUrl.protocol}//${this.bucket}.${endpointUrl.host}/${key}`
  }

  /**
   * Normalize a path for S3 (ensure trailing slash for prefixes).
   */
  private normalizePath(path: string): string {
    if (!path || path === '/') return ''
    // Remove leading slash
    let normalized = path.startsWith('/') ? path.slice(1) : path
    // Ensure trailing slash for folder-like paths
    if (!normalized.endsWith('/') && !normalized.includes('.')) {
      // Only add trailing slash if it looks like a folder (no extension)
      // This is a heuristic; callers should be explicit
    }
    return normalized
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
      css: 'text/css',
      js: 'application/javascript',
      ts: 'application/typescript',
      json: 'application/json',
      xml: 'application/xml',
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
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      zip: 'application/zip',
      gz: 'application/gzip',
      tar: 'application/x-tar',
    }
    return mimeMap[ext ?? ''] ?? 'application/octet-stream'
  }

  /**
   * Ensure the provider is authenticated before performing operations.
   */
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated) {
      throw new S3Error('Not authenticated. Call authenticate() first.')
    }
  }
}

// --- S3 Request Options ---

interface S3RequestOptions {
  body?: Buffer
  contentType?: string
}
