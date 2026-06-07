/**
 * Mnemosyne v2.0 — AI Agent System
 *
 * Built-in AI Agent that can use any LLM from our multi-provider pool,
 * execute tools, manage memory, and interact with all Mnemosyne data.
 *
 * v2.0 fix: Agent tools now use direct DB calls instead of relative fetch()
 * to avoid "Invalid URL" crashes when running server-side.
 * Web search uses z-ai-web-dev-sdk directly instead of HTTP roundtrip.
 */

import type { LLMConfig, LLMMessage, LLMResponse, LLMTool, ToolCall } from '@/lib/llm/providers'
import { LLMRouter } from '@/lib/llm'
import db from '@/lib/db'

// ─── Agent Types ───────────────────────────────────────────────────────────

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (args: Record<string, any>, context: AgentContext) => Promise<string>
}

export interface AgentContext {
  userId: string
  conversationId?: string
  memoryRefs: string[]
  metadata: Record<string, any>
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: ToolCall[]
  name?: string
}

export interface AgentConfig {
  id?: string
  name: string
  description: string
  systemPrompt: string
  model: string
  provider?: string
  temperature?: number
  maxTokens?: number
  maxIterations?: number
  tools: string[]
  apiKey?: string
  baseUrl?: string
}

export interface AgentRunResult {
  messages: AgentMessage[]
  finalResponse: string
  toolCallsMade: number
  memoryRefs: string[]
  model: string
  iterations: number
}

// ─── Built-in Tools (Direct DB — No HTTP) ──────────────────────────────────

const MEMORY_SEARCH_TOOL: AgentTool = {
  name: 'memory_search',
  description: 'Search the user\'s memory/notes using semantic search. Use this to find relevant memories, notes, or knowledge.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query to find relevant memories' },
      limit: { type: 'number', description: 'Maximum results to return (default: 5)' },
    },
    required: ['query'],
  },
  execute: async (args, context) => {
    try {
      const limit = Math.min(args.limit || 5, 20)
      const query = args.query?.toLowerCase() || ''
      const queryTerms = query.split(/\s+/).filter(Boolean)

      // Search notes by keyword matching on title and content
      const notes = await db.note.findMany({
        where: {
          userId: context.userId,
          isArchived: false,
          OR: queryTerms.map(term => [
            { title: { contains: term } },
            { content: { contains: term } },
            { tags: { contains: term } },
          ]).flat(),
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      })

      if (notes.length === 0) return 'No results found.'

      return JSON.stringify(notes.map(n => ({
        id: n.id,
        title: n.title,
        snippet: n.content.slice(0, 200),
        tags: n.tags,
      })))
    } catch (err: any) {
      return `Search error: ${err.message}`
    }
  },
}

const MEMORY_SAVE_TOOL: AgentTool = {
  name: 'memory_save',
  description: 'Save a new note/memory to the user\'s knowledge base. Use this when the user wants to store new information.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the note' },
      content: { type: 'string', description: 'Content of the note' },
      tags: { type: 'string', description: 'Comma-separated tags' },
    },
    required: ['title', 'content'],
  },
  execute: async (args, context) => {
    try {
      const note = await db.note.create({
        data: {
          userId: context.userId,
          title: args.title,
          content: args.content,
          markdown: args.content,
          tags: args.tags || '',
        },
      })

      context.memoryRefs.push(note.id)
      return `Note saved: "${args.title}" (ID: ${note.id})`
    } catch (err: any) {
      return `Save error: ${err.message}`
    }
  },
}

const MEMORY_UPDATE_TOOL: AgentTool = {
  name: 'memory_update',
  description: 'Update an existing note/memory in the user\'s knowledge base.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The note ID to update' },
      title: { type: 'string', description: 'New title (optional)' },
      content: { type: 'string', description: 'New content (optional)' },
      tags: { type: 'string', description: 'New tags (optional)' },
    },
    required: ['id'],
  },
  execute: async (args, context) => {
    try {
      // Verify ownership
      const existing = await db.note.findFirst({
        where: { id: args.id, userId: context.userId },
      })
      if (!existing) return `Note not found or access denied: ${args.id}`

      const data: Record<string, string> = {}
      if (args.title) data.title = args.title
      if (args.content) { data.content = args.content; data.markdown = args.content }
      if (args.tags) data.tags = args.tags

      await db.note.update({ where: { id: args.id }, data })
      return `Note updated: ${args.id}`
    } catch (err: any) {
      return `Update error: ${err.message}`
    }
  },
}

const MEMORY_DELETE_TOOL: AgentTool = {
  name: 'memory_delete',
  description: 'Delete a note/memory from the user\'s knowledge base.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The note ID to delete' },
    },
    required: ['id'],
  },
  execute: async (args, context) => {
    try {
      // Verify ownership before delete
      const existing = await db.note.findFirst({
        where: { id: args.id, userId: context.userId },
      })
      if (!existing) return `Note not found or access denied: ${args.id}`

      await db.note.delete({ where: { id: args.id } })
      return `Note deleted: ${args.id}`
    } catch (err: any) {
      return `Delete error: ${err.message}`
    }
  },
}

const MEMORY_INSIGHTS_TOOL: AgentTool = {
  name: 'memory_insights',
  description: 'Get AI-powered insights about the user\'s memory patterns, topics, and connections.',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['patterns', 'related', 'temporal'], description: 'Type of insights to retrieve' },
    },
    required: [],
  },
  execute: async (args, context) => {
    try {
      if (args.type === 'patterns') {
        // Analyze tag patterns
        const notes = await db.note.findMany({
          where: { userId: context.userId, isArchived: false },
          select: { tags: true, title: true },
          take: 100,
        })

        const tagFreq: Record<string, number> = {}
        for (const note of notes) {
          if (!note.tags) continue
          for (const tag of note.tags.split(',').map(t => t.trim()).filter(Boolean)) {
            tagFreq[tag] = (tagFreq[tag] || 0) + 1
          }
        }

        const topTags = Object.entries(tagFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)

        return JSON.stringify({
          totalNotes: notes.length,
          topTags: topTags.map(([tag, count]) => ({ tag, count })),
        })
      }

      // Default: list recent memories
      const recentNotes = await db.note.findMany({
        where: { userId: context.userId, isArchived: false },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, title: true, tags: true, updatedAt: true },
      })

      return JSON.stringify(recentNotes)
    } catch (err: any) {
      return `Insights error: ${err.message}`
    }
  },
}

const WEB_SEARCH_TOOL: AgentTool = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when the user asks about recent events or information not in their memory.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      num: { type: 'number', description: 'Number of results (default: 5)' },
    },
    required: ['query'],
  },
  execute: async (args, _context) => {
    try {
      // Use z-ai-web-dev-sdk directly instead of HTTP roundtrip
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const results = await zai.functions.invoke('web_search', {
        query: args.query,
        num: args.num || 5,
      })

      if (Array.isArray(results) && results.length > 0) {
        return JSON.stringify(results.map((r: any) => ({
          title: r.name, url: r.url, snippet: r.snippet,
        })))
      }
      return 'No results found.'
    } catch (err: any) {
      return `Web search error: ${err.message}`
    }
  },
}

const DECISION_TRACK_TOOL: AgentTool = {
  name: 'decision_track',
  description: 'Track a decision with context, reasoning, and outcomes.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Decision title' },
      context: { type: 'string', description: 'The situation/context' },
      decision: { type: 'string', description: 'What was decided' },
      reasoning: { type: 'string', description: 'Why this decision was made' },
    },
    required: ['title', 'context', 'decision'],
  },
  execute: async (args, context) => {
    try {
      const decision = await db.decision.create({
        data: {
          userId: context.userId,
          title: args.title,
          context: args.context,
          decision: args.decision,
          reasoning: args.reasoning || '',
        },
      })
      return `Decision tracked: "${args.title}" (ID: ${decision.id})`
    } catch (err: any) {
      return `Decision track error: ${err.message}`
    }
  },
}

// ─── Tool Registry ─────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, AgentTool> = {
  memory_search: MEMORY_SEARCH_TOOL,
  memory_save: MEMORY_SAVE_TOOL,
  memory_update: MEMORY_UPDATE_TOOL,
  memory_delete: MEMORY_DELETE_TOOL,
  memory_insights: MEMORY_INSIGHTS_TOOL,
  web_search: WEB_SEARCH_TOOL,
  decision_track: DECISION_TRACK_TOOL,
}

// ─── Default Agent Config ──────────────────────────────────────────────────

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  name: 'Mnemosyne Agent',
  description: 'Your personal AI memory assistant — can search, save, update, and reason about your memories.',
  systemPrompt: `You are Mnemosyne Agent, the AI assistant for the biggest free multi-LLM hub. You have full access to the user's memory and knowledge base, and can search memories, save new notes, update existing ones, track decisions, and search the web for current information.

As the core intelligence of Mnemosyne, you serve as:
1. A personal memory assistant that never forgets — always search memory first before answering
2. A multi-LLM gateway — you leverage hundreds of free models to provide the best answers
3. A knowledge connector — you proactively find and surface connections across the user's notes
4. A decision tracker — you help users make better decisions by preserving context and reasoning

Key behaviors:
1. Always search memory first before answering questions — the user's past knowledge is your primary source
2. Proactively save important information to memory when the user shares it
3. Connect ideas across different notes and time periods
4. Track decisions with proper context and reasoning
5. Use web search only when the user asks about current events or information not in their memory
6. Be concise but insightful — reference specific memories by title
7. Suggest connections the user might not have noticed
8. When appropriate, remind users that Mnemosyne provides free access to 500+ LLM models via Puter.js`,
  model: 'openai/gpt-5.4-nano',
  maxIterations: 5,
  tools: ['memory_search', 'memory_save', 'memory_update', 'memory_delete', 'memory_insights', 'web_search', 'decision_track'],
}

// ─── Agent Execution Engine ────────────────────────────────────────────────

export class AgentEngine {
  private config: AgentConfig
  private context: AgentContext
  private tools: AgentTool[]
  private llmTools: LLMTool[]

  constructor(config: AgentConfig, context: AgentContext) {
    this.config = config
    this.context = context
    this.tools = config.tools
      .map(name => TOOL_REGISTRY[name])
      .filter(Boolean)

    this.llmTools = this.tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  async run(userMessage: string): Promise<AgentRunResult> {
    const messages: AgentMessage[] = [
      { role: 'system', content: this.config.systemPrompt },
      { role: 'user', content: userMessage },
    ]

    let toolCallsMade = 0
    let iterations = 0
    const maxIterations = this.config.maxIterations || 5

    while (iterations < maxIterations) {
      iterations++

      const llmConfig: LLMConfig = {
        provider: this.config.provider ? this.config.provider as any : 'puter',
        model: this.config.model,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens || 2048,
        tools: this.llmTools.length > 0 ? this.llmTools : undefined,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
      }

      const llmMessages: LLMMessage[] = messages.map(m => ({
        role: m.role as any,
        content: m.content,
        toolCallId: m.toolCallId,
        toolCalls: m.toolCalls,
      }))

      const response = await LLMRouter.chat(llmConfig, llmMessages)

      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: response.content || '',
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        assistantMessage.toolCalls = response.toolCalls
        messages.push(assistantMessage)

        for (const toolCall of response.toolCalls) {
          toolCallsMade++
          let toolArgs: Record<string, any>
          try {
            toolArgs = JSON.parse(toolCall.function.arguments)
          } catch {
            toolArgs = {}
          }

          const tool = this.tools.find(t => t.name === toolCall.function.name)
          let toolResult: string

          if (tool) {
            try {
              toolResult = await tool.execute(toolArgs, this.context)
            } catch (err: any) {
              toolResult = `Tool execution error: ${err.message}`
            }
          } else {
            toolResult = `Unknown tool: ${toolCall.function.name}`
          }

          messages.push({
            role: 'tool',
            content: toolResult,
            toolCallId: toolCall.id,
            name: toolCall.function.name,
          })
        }

        continue
      }

      messages.push(assistantMessage)
      break
    }

    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant')
    const finalResponse = lastAssistantMessage?.content || ''

    return {
      messages,
      finalResponse,
      toolCallsMade,
      memoryRefs: this.context.memoryRefs,
      model: this.config.model,
      iterations,
    }
  }
}

export async function runAgent(
  userMessage: string,
  userId: string,
  configOverrides?: Partial<AgentConfig>
): Promise<AgentRunResult> {
  const config = { ...DEFAULT_AGENT_CONFIG, ...configOverrides }
  const context: AgentContext = {
    userId,
    memoryRefs: [],
    metadata: {},
  }

  const engine = new AgentEngine(config, context)
  return engine.run(userMessage)
}
