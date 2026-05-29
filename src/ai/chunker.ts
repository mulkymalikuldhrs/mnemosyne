export interface Chunk {
  content: string
  index: number
  tokenCount: number
}

/**
 * Estimate the number of tokens in a text string.
 * ~4 chars per token for English, ~2 chars per token for Indonesian/CJK.
 * We use a heuristic: if the text has a high ratio of multi-byte characters,
 * we use the lower chars-per-token ratio.
 */
function estimateTokenCount(text: string): number {
  if (text.length === 0) return 0

  // Count multi-byte characters (non-ASCII)
  let multiByteCount = 0
  for (const char of text) {
    if (char.codePointAt(0)! > 127) {
      multiByteCount++
    }
  }

  const multiByteRatio = multiByteCount / text.length

  // If more than 30% of characters are multi-byte, use the lower ratio
  const charsPerToken = multiByteRatio > 0.3 ? 2 : 4

  return Math.ceil(text.length / charsPerToken)
}

/**
 * Split text into sentences.
 * Handles common sentence-ending punctuation while preserving abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  // Match sentence boundaries: period/exclamation/question followed by space or end
  // but not after common abbreviations
  const sentences: string[] = []
  const regex = /[^.!?]*[.!?]+(?=\s|$)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const sentence = match[0].trim()
    if (sentence) {
      sentences.push(sentence)
    }
  }

  // If no sentences found, return the whole text as one sentence
  if (sentences.length === 0 && text.trim()) {
    sentences.push(text.trim())
  }

  return sentences
}

/**
 * Split text into words, respecting word boundaries.
 */
function splitIntoWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0)
}

/**
 * Chunk text into semantic chunks for embedding.
 *
 * Strategy:
 * 1. Split by double newlines first (paragraphs)
 * 2. If paragraph > maxTokens, split by sentences
 * 3. If sentence > maxTokens, split by words
 * 4. Add overlap between chunks for context continuity
 *
 * @param text - The text to chunk
 * @param maxTokens - Maximum tokens per chunk (default 500)
 * @param overlap - Number of tokens to overlap between chunks (default 50)
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlap: number = 50
): Chunk[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const chunks: Chunk[] = []
  let chunkIndex = 0

  // Step 1: Split by double newlines (paragraphs)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  // Buffer to accumulate chunks that fit within maxTokens
  let buffer = ''
  let bufferTokens = 0

  function flushBuffer(): void {
    if (buffer.trim().length === 0) return

    chunks.push({
      content: buffer.trim(),
      index: chunkIndex++,
      tokenCount: bufferTokens,
    })
    buffer = ''
    bufferTokens = 0
  }

  function addToBuffer(content: string, tokens: number): void {
    if (bufferTokens + tokens > maxTokens && buffer.trim().length > 0) {
      flushBuffer()
    }

    if (buffer.length > 0) {
      buffer += '\n\n'
    }
    buffer += content
    bufferTokens += tokens
  }

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokenCount(paragraph)

    if (paraTokens <= maxTokens) {
      // Paragraph fits within limits — try to add to buffer
      if (bufferTokens + paraTokens > maxTokens && buffer.trim().length > 0) {
        flushBuffer()

        // Add overlap from the previous chunk
        if (overlap > 0 && chunks.length > 0) {
          const prevChunk = chunks[chunks.length - 1]
          const overlapText = getOverlapText(prevChunk.content, overlap)
          if (overlapText) {
            buffer = overlapText
            bufferTokens = estimateTokenCount(overlapText)
          }
        }
      }

      addToBuffer(paragraph, paraTokens)
      continue
    }

    // Step 2: Paragraph too large — split by sentences
    const sentences = splitIntoSentences(paragraph)

    for (const sentence of sentences) {
      const sentTokens = estimateTokenCount(sentence)

      if (sentTokens <= maxTokens) {
        if (bufferTokens + sentTokens > maxTokens && buffer.trim().length > 0) {
          flushBuffer()

          // Add overlap from the previous chunk
          if (overlap > 0 && chunks.length > 0) {
            const prevChunk = chunks[chunks.length - 1]
            const overlapText = getOverlapText(prevChunk.content, overlap)
            if (overlapText) {
              buffer = overlapText
              bufferTokens = estimateTokenCount(overlapText)
            }
          }
        }

        addToBuffer(sentence, sentTokens)
        continue
      }

      // Step 3: Sentence too large — split by words
      const words = splitIntoWords(sentence)
      let wordBuffer = ''
      let wordBufferTokens = 0

      for (const word of words) {
        const wordTokens = estimateTokenCount(word)

        if (wordBufferTokens + wordTokens > maxTokens && wordBuffer.length > 0) {
          if (bufferTokens + wordBufferTokens > maxTokens && buffer.trim().length > 0) {
            flushBuffer()

            // Add overlap from the previous chunk
            if (overlap > 0 && chunks.length > 0) {
              const prevChunk = chunks[chunks.length - 1]
              const overlapText = getOverlapText(prevChunk.content, overlap)
              if (overlapText) {
                buffer = overlapText
                bufferTokens = estimateTokenCount(overlapText)
              }
            }
          }

          addToBuffer(wordBuffer.trim(), wordBufferTokens)
          wordBuffer = ''
          wordBufferTokens = 0
        }

        if (wordBuffer.length > 0) {
          wordBuffer += ' '
        }
        wordBuffer += word
        wordBufferTokens += wordTokens
      }

      // Flush remaining words
      if (wordBuffer.trim().length > 0) {
        if (bufferTokens + wordBufferTokens > maxTokens && buffer.trim().length > 0) {
          flushBuffer()

          if (overlap > 0 && chunks.length > 0) {
            const prevChunk = chunks[chunks.length - 1]
            const overlapText = getOverlapText(prevChunk.content, overlap)
            if (overlapText) {
              buffer = overlapText
              bufferTokens = estimateTokenCount(overlapText)
            }
          }
        }

        addToBuffer(wordBuffer.trim(), wordBufferTokens)
      }
    }
  }

  // Flush any remaining buffer
  flushBuffer()

  return chunks
}

/**
 * Get overlap text from the end of a chunk.
 * Returns approximately `overlapTokens` worth of text from the end of the content.
 */
function getOverlapText(content: string, overlapTokens: number): string {
  const words = splitIntoWords(content)
  if (words.length === 0) return ''

  // Work backwards from the end, collecting words until we reach the overlap token count
  const result: string[] = []
  let tokenCount = 0

  for (let i = words.length - 1; i >= 0; i--) {
    const wordTokens = estimateTokenCount(words[i])
    if (tokenCount + wordTokens > overlapTokens) break
    result.unshift(words[i])
    tokenCount += wordTokens
  }

  return result.length > 0 ? result.join(' ') : ''
}
