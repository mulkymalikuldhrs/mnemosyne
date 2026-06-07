// ============================================================
// MNEMOSYNE v1.0.0 — Cloud Storage Adapter Layer Types
// Universal AI/Human Memory Hub
//
// Defines TypeScript types and interfaces for the cloud storage
// adapter layer. Each provider implements CloudStorageProviderInterface
// to offer a unified API for file operations across providers.
// ============================================================

// --- Provider Types ---

export type CloudStorageProvider =
  | 'google_drive'
  | 'terabox'
  | 's3'
  | 'dropbox'
  | 'onedrive'
  | 'local'

// --- File Interface ---

export interface CloudFile {
  id: string
  providerFileId: string
  name: string
  mimeType: string
  size: number
  path: string
  webUrl: string
  thumbnailUrl: string
  lastModified: string | null
}

// --- Credentials ---

export interface GoogleDriveCredentials {
  accessToken: string
  refreshToken: string
  clientId?: string
  clientSecret?: string
}

export interface TeraBoxCredentials {
  cookie: string
  userAgent?: string
}

export interface S3Credentials {
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
  region?: string
  bucket?: string
  forcePathStyle?: boolean
}

export interface DropboxCredentials {
  accessToken: string
  refreshToken?: string
  appKey?: string
  appSecret?: string
}

export interface OneDriveCredentials {
  accessToken: string
  refreshToken: string
  clientId?: string
  clientSecret?: string
}

export interface LocalCredentials {
  rootPath: string
}

export type StorageCredentials =
  | GoogleDriveCredentials
  | TeraBoxCredentials
  | S3Credentials
  | DropboxCredentials
  | OneDriveCredentials
  | LocalCredentials

// --- List Options ---

export interface ListFilesOptions {
  pageSize?: number
  pageToken?: string
  query?: string
  mimeType?: string
  orderBy?: 'name' | 'lastModified' | 'size'
  sortOrder?: 'asc' | 'desc'
  recursive?: boolean
}

// --- Ingestion Result ---

export interface IngestFileResult {
  noteId: string
  chunksCreated: number
  textExtracted: string
  metadata: Record<string, unknown>
}

// --- Sync Result ---

export interface SyncResult {
  totalFiles: number
  newFiles: number
  updatedFiles: number
  deletedFiles: number
  errors: number
  durationMs: number
}

// --- Provider Interface ---

export interface CloudStorageProviderInterface {
  /** Provider type identifier */
  readonly providerType: CloudStorageProvider

  /** Whether the provider is currently authenticated */
  isAuthenticated: boolean

  /**
   * Authenticate with the cloud storage provider using the
   * provided credentials. Validates the credentials and
   * stores them internally for subsequent API calls.
   */
  authenticate(credentials: StorageCredentials): Promise<void>

  /**
   * List files at a given path with optional filtering
   * and pagination.
   */
  listFiles(path: string, options?: ListFilesOptions): Promise<CloudFile[]>

  /**
   * Download a file's content as a Buffer.
   */
  downloadFile(fileId: string): Promise<Buffer>

  /**
   * Upload a file to the specified path with the given
   * content and MIME type.
   */
  uploadFile(path: string, content: Buffer, mimeType: string): Promise<CloudFile>

  /**
   * Delete a file by its provider file ID.
   */
  deleteFile(fileId: string): Promise<void>

  /**
   * Search for files matching the given query string.
   */
  searchFiles(query: string): Promise<CloudFile[]>

  /**
   * Get metadata for a single file by its provider file ID.
   */
  getFileInfo(fileId: string): Promise<CloudFile>

  /**
   * Create a folder at the specified path.
   */
  createFolder(path: string): Promise<CloudFile>
}

// --- Text Extraction Mapping ---

/**
 * MIME types that can be directly converted to text without
 * special processing. Used by the ingestion pipeline.
 */
export const TEXT_MIME_TYPES: Record<string, boolean> = {
  'text/plain': true,
  'text/markdown': true,
  'text/csv': true,
  'text/html': true,
  'text/xml': true,
  'application/json': true,
  'application/xml': true,
  'application/javascript': true,
  'application/typescript': true,
  'application/x-yaml': true,
}

/**
 * Document MIME types that may require text extraction.
 */
export const DOCUMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
}

/**
 * Check if a MIME type can be directly read as text.
 */
export function isTextMimeType(mimeType: string): boolean {
  return TEXT_MIME_TYPES[mimeType] === true || mimeType.startsWith('text/')
}

/**
 * Check if a MIME type is a document that requires extraction.
 */
export function isDocumentMimeType(mimeType: string): boolean {
  return mimeType in DOCUMENT_MIME_TYPES
}

/**
 * Determine if a file can be ingested into Mnemosyne memory
 * based on its MIME type.
 */
export function isIngestibleMimeType(mimeType: string): boolean {
  return isTextMimeType(mimeType) || isDocumentMimeType(mimeType)
}
