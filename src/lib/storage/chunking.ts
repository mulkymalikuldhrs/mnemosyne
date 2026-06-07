// ═══════════════════════════════════════════════════════════════════════════════
// Mnemosyne v1.0 — Storage Chunking Engine
// Inspired by Pentaract (https://github.com/mulkymalikuldhrs/Pentaract)
// File chunking, parallel upload/download, and positional reassembly
// ═══════════════════════════════════════════════════════════════════════════════

export const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB — same as Pentaract's Telegram chunk size

export interface ChunkMeta {
  id: string
  fileId: string
  position: number
  storageRef: string // Reference to stored chunk (e.g., S3 key, Telegram file_id, etc.)
  size: number
  createdAt: string
}

export interface ChunkedFile {
  id: string
  name: string
  totalSize: number
  mimeType: string
  chunks: ChunkMeta[]
  isUploaded: boolean
  createdAt: string
}

/**
 * Split a Buffer into chunks of the specified size.
 * Returns an array of { data: Buffer, position: number } objects.
 */
export function splitIntoChunks(data: Buffer, chunkSize: number = CHUNK_SIZE): Array<{ data: Buffer; position: number }> {
  const chunks: Array<{ data: Buffer; position: number }> = []
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    chunks.push({
      data: data.subarray(offset, offset + chunkSize),
      position: Math.floor(offset / chunkSize),
    })
  }
  return chunks
}

/**
 * Reassemble chunks into a single Buffer.
 * Chunks are sorted by position before concatenation.
 */
export function reassembleChunks(chunks: Array<{ data: Buffer; position: number }>): Buffer {
  const sorted = [...chunks].sort((a, b) => a.position - b.position)
  return Buffer.concat(sorted.map((c) => c.data))
}

/**
 * Upload a file using chunking with parallel uploads.
 * Inspired by Pentaract's parallel chunk upload via futures::join_all()
 *
 * @param data - The file data to upload
 * @param uploadChunk - Function that uploads a single chunk and returns a storage reference
 * @param concurrency - Maximum number of parallel uploads (default: 3)
 */
export async function uploadWithChunking(
  data: Buffer,
  uploadChunk: (chunk: Buffer, position: number) => Promise<string>,
  concurrency: number = 3
): Promise<ChunkMeta[]> {
  const chunks = splitIntoChunks(data)
  const results: ChunkMeta[] = []

  // Process chunks in batches for controlled parallelism
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        const storageRef = await uploadChunk(chunk.data, chunk.position)
        return {
          id: `chunk-${chunk.position}`,
          fileId: '', // Will be set by caller
          position: chunk.position,
          storageRef,
          size: chunk.data.length,
          createdAt: new Date().toISOString(),
        } satisfies ChunkMeta
      })
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Download a chunked file by downloading all chunks in parallel and reassembling.
 * Inspired by Pentaract's parallel chunk download with positional sort.
 *
 * @param chunks - Metadata for all chunks of the file
 * @param downloadChunk - Function that downloads a single chunk by its storage reference
 * @param concurrency - Maximum number of parallel downloads (default: 5)
 */
export async function downloadWithChunking(
  chunks: ChunkMeta[],
  downloadChunk: (storageRef: string) => Promise<Buffer>,
  concurrency: number = 5
): Promise<Buffer> {
  const sortedChunks = [...chunks].sort((a, b) => a.position - b.position)
  const downloadedChunks: Array<{ data: Buffer; position: number }> = []

  // Download in batches
  for (let i = 0; i < sortedChunks.length; i += concurrency) {
    const batch = sortedChunks.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        const data = await downloadChunk(chunk.storageRef)
        return { data, position: chunk.position }
      })
    )
    downloadedChunks.push(...batchResults)
  }

  return reassembleChunks(downloadedChunks)
}
