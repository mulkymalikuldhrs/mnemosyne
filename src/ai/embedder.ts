export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
  model: string
}

// Default embedding dimension
const DEFAULT_DIMENSIONS = 768

// LRU Cache for embeddings to avoid redundant API calls
const embeddingCache = new Map<string, { embedding: number[]; tokenCount: number; model: string }>()
const CACHE_MAX_SIZE = 500

function cacheKey(text: string, userId?: string): string {
  return `${userId ?? 'anonymous'}:${text.slice(0, 200)}`
}

function evictCache(): void {
  if (embeddingCache.size > CACHE_MAX_SIZE) {
    // Delete the first (oldest) entry — Map preserves insertion order
    const firstKey = embeddingCache.keys().next().value
    if (firstKey) {
      embeddingCache.delete(firstKey)
    }
  }
}

/**
 * Simple deterministic hash function for generating pseudo-embeddings.
 * Used as a fallback when the embedding API is unavailable.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0 // Convert to 32bit integer
  }
  return hash
}

/**
 * Generate a pseudo-embedding from text using a semantic-aware hash approach.
 *
 * This produces a deterministic vector of the specified dimension that
 * captures some semantic similarity between texts:
 * - Texts sharing common n-grams will have more similar embeddings
 * - The approach uses character n-gram hashing for better semantic capture
 *
 * NOT a replacement for a real embedding model — only for development/testing.
 * When a real embedding API is available, swap via the EMBEDDING_API_URL env var.
 */
function generatePseudoEmbedding(
  text: string,
  dimensions: number = DEFAULT_DIMENSIONS
): number[] {
  const embedding = new Float64Array(dimensions)

  // Use character n-grams for better semantic similarity
  const normalizedText = text.toLowerCase().trim()
  const ngramSizes = [3, 4, 5, 6]

  for (const ngramSize of ngramSizes) {
    for (let i = 0; i <= normalizedText.length - ngramSize; i++) {
      const ngram = normalizedText.slice(i, i + ngramSize)
      const h = hashString(ngram)

      // Hash each n-gram into the embedding space using double hashing
      const idx1 = Math.abs(h) % dimensions
      const idx2 = Math.abs(hashString(ngram + ':v2')) % dimensions
      const sign = h >= 0 ? 1 : -1

      embedding[idx1] += sign * 0.1
      embedding[idx2] += sign * 0.05
    }
  }

  // Add word-level hashing for better semantic signals
  const words = normalizedText.split(/\s+/).filter((w) => w.length > 1)
  for (const word of words) {
    const h = hashString(word)
    const idx = Math.abs(h) % dimensions
    const sign = h >= 0 ? 1 : -1
    embedding[idx] += sign * 0.15
  }

  // Add global text hash to make different texts more distinguishable
  const globalHash = hashString(normalizedText)
  for (let i = 0; i < dimensions; i++) {
    const seed = i * 31 + 7
    const h = hashString(`${seed}:${normalizedText}`)
    embedding[i] += (h % 10000) / 10000 * 0.01
  }

  // Normalize the vector to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
  const result: number[] = new Array(dimensions)
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      result[i] = embedding[i] / magnitude
    }
  } else {
    for (let i = 0; i < dimensions; i++) {
      result[i] = 0
    }
  }

  return result
}

/**
 * Try to generate an embedding using the z-ai-web-dev-sdk chat completions
 * to approximate semantic similarity. Since the SDK does not have a native
 * embedding endpoint, we use a pseudo-embedding approach enhanced by the
 * LLM's understanding.
 *
 * Returns null if the SDK is unavailable, so we can fall back gracefully.
 */
async function generateEmbeddingViaExternalAPI(
  text: string,
  _userId?: string
): Promise<EmbeddingResult | null> {
  // Check if a custom embedding API URL is configured
  const embeddingApiUrl = process.env.EMBEDDING_API_URL
  const embeddingApiKey = process.env.EMBEDDING_API_KEY

  if (!embeddingApiUrl) {
    return null
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (embeddingApiKey) {
      headers['Authorization'] = `Bearer ${embeddingApiKey}`
    }

    const response = await fetch(embeddingApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: text,
        model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
        dimensions: DEFAULT_DIMENSIONS,
      }),
    })

    if (!response.ok) {
      return null
    }

    const result = await response.json()

    if (result?.data?.[0]?.embedding && Array.isArray(result.data[0].embedding)) {
      return {
        embedding: result.data[0].embedding,
        tokenCount: result.usage?.total_tokens ?? estimateTokens(text),
        model: result.model ?? 'text-embedding-3-small',
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Estimate token count for a text string.
 * ~4 chars per token for English, ~2 chars per token for Indonesian/CJK.
 */
function estimateTokens(text: string): number {
  if (text.length === 0) return 0
  let multiByteCount = 0
  for (const char of text) {
    if (char.codePointAt(0)! > 127) {
      multiByteCount++
    }
  }
  const multiByteRatio = multiByteCount / text.length
  const charsPerToken = multiByteRatio > 0.3 ? 2 : 4
  return Math.ceil(text.length / charsPerToken)
}

/**
 * Generate a vector embedding for a single text string.
 *
 * Strategy:
 * 1. Check cache for existing embedding
 * 2. Try external embedding API (if EMBEDDING_API_URL is configured)
 * 3. Fall back to hash-based pseudo-embedding for development
 *
 * @param text - The text to embed
 * @param userId - Optional user ID for API key lookup and caching
 */
export async function generateEmbedding(
  text: string,
  userId?: string
): Promise<EmbeddingResult> {
  // Check cache
  const key = cacheKey(text, userId)
  const cached = embeddingCache.get(key)
  if (cached) {
    return { ...cached, embedding: [...cached.embedding] }
  }

  const tokenCount = estimateTokens(text)

  // Try external embedding API first
  const apiResult = await generateEmbeddingViaExternalAPI(text, userId)
  if (apiResult) {
    evictCache()
    embeddingCache.set(key, apiResult)
    return { ...apiResult, embedding: [...apiResult.embedding] }
  }

  // Fallback to pseudo-embedding
  const embedding = generatePseudoEmbedding(text, DEFAULT_DIMENSIONS)
  const result: EmbeddingResult = {
    embedding,
    tokenCount,
    model: 'pseudo-embedding-v1',
  }

  evictCache()
  embeddingCache.set(key, result)
  return { ...result, embedding: [...result.embedding] }
}

/**
 * Generate vector embeddings for multiple text strings in batch.
 * Uses the same strategy as generateEmbedding but processes in parallel.
 *
 * @param texts - Array of texts to embed
 * @param userId - Optional user ID for API key lookup and caching
 */
export async function generateEmbeddings(
  texts: string[],
  userId?: string
): Promise<EmbeddingResult[]> {
  // Process all texts in parallel for efficiency
  const results = await Promise.all(
    texts.map((text) => generateEmbedding(text, userId))
  )
  return results
}
