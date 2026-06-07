import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { getMemoryContext } from './memory'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  content: string
  memoryRefs: string[]
  tokenUsage: { prompt: number; completion: number; total: number }
}

// ─── System Prompt Template ─────────────────────────────────────────────────

const SYSTEM_PROMPT_TEMPLATE = `You are Mnemosyne, a personal AI memory assistant. You help users recall, connect, and reason about their stored knowledge.

You have access to the following memories from the user's knowledge base:
{memory_context}

Related notes:
{related_notes}

Detected patterns:
{patterns}

Guidelines:
- Reference specific memories when answering questions
- Connect ideas across different notes and time periods
- Help the user think through decisions using their past reasoning
- Suggest connections the user might not have noticed
- Be concise but insightful`

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract note IDs referenced in the assistant's response.
 * Looks for patterns like [note:abc123] or note references in the text.
 */
function extractMemoryRefs(content: string): string[] {
  const refs: string[] = []

  // Match [note:id] patterns
  const noteRefPattern = /\[note:([a-zA-Z0-9]+)\]/g
  let match: RegExpExecArray | null
  while ((match = noteRefPattern.exec(content)) !== null) {
    refs.push(match[1])
  }

  // Match "Note: <title>" patterns (references to note titles)
  const titleRefPattern = /Note:\s*"([^"]+)"/g
  while ((match = titleRefPattern.exec(content)) !== null) {
    refs.push(match[1])
  }

  return refs
}

/**
 * Build the system prompt with memory context injected.
 */
function buildSystemPrompt(
  memoryContext: Awaited<ReturnType<typeof getMemoryContext>>
): string {
  // Format memory results
  const memoryText =
    memoryContext.memories.length > 0
      ? memoryContext.memories
          .map(
            (m, i) =>
              `${i + 1}. [note:${m.noteId}] ${m.content.slice(0, 300)}${m.content.length > 300 ? '...' : ''}`
          )
          .join('\n')
      : 'No relevant memories found.'

  // Format related notes
  const relatedNotesText =
    memoryContext.relatedNotes.length > 0
      ? memoryContext.relatedNotes
          .map(
            (n) =>
              `- [note:${n.noteId}] "${n.title}" (score: ${n.relationScore.toFixed(2)}) — ${n.reason}`
          )
          .join('\n')
      : 'No related notes found.'

  // Format patterns
  const patternsText =
    memoryContext.patterns.length > 0
      ? memoryContext.patterns.map((p) => `- ${p}`).join('\n')
      : 'No patterns detected yet.'

  // Use single-pass replacement to prevent template injection
  // If memoryText contains {related_notes} or {patterns}, it won't be replaced
  const replacements: Record<string, string> = {
    '{memory_context}': memoryText,
    '{related_notes}': relatedNotesText,
    '{patterns}': patternsText,
  }
  return SYSTEM_PROMPT_TEMPLATE.replace(
    /\{memory_context\}|\{related_notes\}|\{patterns\}/g,
    (match) => replacements[match] || match
  )
}

// ─── Core Chat Function ────────────────────────────────────────────────────

/**
 * Chat with the AI using memory context.
 *
 * 1. Get the last user message
 * 2. Use getMemoryContext to find relevant memories
 * 3. Build system prompt with memory context injected
 * 4. Call LLM via z-ai-web-dev-sdk
 * 5. Extract any note references from the response
 * 6. Store the conversation turn
 * 7. Return response with memory references
 */
export async function chatWithMemory(
  messages: ChatMessage[],
  userId: string,
  conversationId?: string
): Promise<ChatResponse> {
  // Step 1: Get the last user message
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user')

  if (!lastUserMessage) {
    throw new Error('No user message found in the conversation')
  }

  // Step 2: Get memory context for the query
  const memoryContext = await getMemoryContext(lastUserMessage.content, userId)

  // Step 3: Build system prompt with memory context
  const systemPrompt = buildSystemPrompt(memoryContext)

  // Step 4: Call LLM via z-ai-web-dev-sdk
  const client = await ZAI.create()

  const llmMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: llmMessages,
    max_tokens: 1024,
    temperature: 0.7,
  })

  // Extract the assistant's response content
  let assistantContent = ''
  let tokenUsage = { prompt: 0, completion: 0, total: 0 }

  if (response && typeof response === 'object' && 'choices' in response) {
    const choices = response.choices as Array<{
      message?: { content?: string }
    }>
    if (choices.length > 0 && choices[0].message?.content) {
      assistantContent = choices[0].message.content
    }

    if ('usage' in response && response.usage) {
      const usage = response.usage as {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
      }
      tokenUsage = {
        prompt: usage.prompt_tokens ?? 0,
        completion: usage.completion_tokens ?? 0,
        total: usage.total_tokens ?? 0,
      }
    }
  }

  // Step 5: Extract note references from the response
  const memoryRefs = extractMemoryRefs(assistantContent)

  // Also include note IDs from the memory context that were used
  const contextNoteIds = memoryContext.memories
    .map((m) => m.noteId)
    .concat(memoryContext.relatedNotes.map((n) => n.noteId))

  // Deduplicate refs
  const allRefs = [...new Set([...memoryRefs, ...contextNoteIds])]

  // Step 6: Store the conversation turn
  if (conversationId) {
    // Ensure conversation exists
    const existingConversation = await db.conversation.findUnique({
      where: { id: conversationId },
    })

    if (!existingConversation) {
      await db.conversation.create({
        data: {
          id: conversationId,
          userId,
          title: lastUserMessage.content.slice(0, 100),
        },
      })
    }

    // Store user message
    await db.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: lastUserMessage.content,
        memoryRefs: JSON.stringify(contextNoteIds),
      },
    })

    // Store assistant message
    await db.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: assistantContent,
        memoryRefs: JSON.stringify(allRefs),
      },
    })
  }

  // Step 7: Return response
  return {
    content: assistantContent,
    memoryRefs: allRefs,
    tokenUsage,
  }
}
