#!/usr/bin/env bun

/**
 * Memorix MCP Server
 *
 * A standalone MCP (Model Context Protocol) server implementing JSON-RPC 2.0
 * over stdio transport. Allows AI assistants (Claude, GPT, etc.) to interact
 * with the Memorix AI memory system.
 *
 * Protocol: JSON-RPC 2.0 over stdio (stdin/stdout)
 * Authentication: API key via MEMORIX_API_KEY environment variable
 */

import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 Types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Standard JSON-RPC 2.0 error codes
const RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32000,
  SERVER_ERROR_END: -32099,
} as const;

// ---------------------------------------------------------------------------
// MCP Tool Definitions
// ---------------------------------------------------------------------------

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const TOOLS: ToolDefinition[] = [
  {
    name: "memorix_search",
    description:
      "Search the user's memory for notes matching a query. Returns ranked results with relevance scores.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find matching notes",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "memorix_add_note",
    description:
      "Add a new note to the user's memory. Notes are the primary unit of storage in Memorix.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the note",
        },
        content: {
          type: "string",
          description: "Content/body of the note",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for categorization",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "memorix_get_note",
    description:
      "Retrieve a specific note by its ID, including full content and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The unique ID of the note to retrieve",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "memorix_list_notes",
    description:
      "List all notes in the user's memory with pagination support.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of notes to return (default: 20)",
        },
        offset: {
          type: "number",
          description: "Number of notes to skip for pagination (default: 0)",
        },
      },
    },
  },
  {
    name: "memorix_chat",
    description:
      "Chat with the memory system. Ask questions and get AI-powered responses grounded in your stored memories.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message or question to send",
        },
        conversationId: {
          type: "string",
          description:
            "Optional conversation ID for multi-turn conversations. If omitted, a new conversation is started.",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "memorix_get_related",
    description:
      "Get notes related to a specific note, based on shared tags, content similarity, and explicit relations.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The note ID to find related notes for",
        },
        limit: {
          type: "number",
          description: "Maximum number of related notes to return (default: 5)",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "memorix_detect_patterns",
    description:
      "Detect patterns and themes across the user's memory. Returns identified patterns such as recurring topics, temporal trends, and knowledge clusters.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "memorix_add_decision",
    description:
      "Record a decision in the memory system. Decisions capture context, reasoning, and outcomes for future reference.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title/summary of the decision",
        },
        context: {
          type: "string",
          description: "The context or situation that led to the decision",
        },
        decision: {
          type: "string",
          description: "The actual decision that was made",
        },
        reasoning: {
          type: "string",
          description: "The reasoning or rationale behind the decision",
        },
      },
      required: ["title", "context", "decision", "reasoning"],
    },
  },
];

// ---------------------------------------------------------------------------
// Database Client
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  log: ["error"],
});

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

/**
 * Simple text-based similarity scoring using keyword overlap and
 * substring matching. In a production system, this would use
 * vector embeddings for semantic search.
 */
function computeRelevanceScore(
  query: string,
  title: string,
  content: string,
  tags: string[]
): number {
  const queryLower = query.toLowerCase().trim();
  const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 0);

  if (queryTokens.length === 0) return 0;

  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();

  let score = 0;

  // Exact substring match in title (highest weight)
  if (titleLower.includes(queryLower)) {
    score += 0.4;
  }

  // Exact substring match in content
  if (contentLower.includes(queryLower)) {
    score += 0.2;
  }

  // Token-level matching in title
  for (const token of queryTokens) {
    if (titleLower.includes(token)) {
      score += 0.1;
    }
  }

  // Token-level matching in content
  let contentTokenMatches = 0;
  for (const token of queryTokens) {
    if (contentLower.includes(token)) {
      contentTokenMatches++;
    }
  }
  score += (contentTokenMatches / queryTokens.length) * 0.2;

  // Tag matching
  const tagsLower = tags.map((t) => t.toLowerCase());
  let tagMatches = 0;
  for (const token of queryTokens) {
    if (tagsLower.some((tag) => tag.includes(token) || token.includes(tag))) {
      tagMatches++;
    }
  }
  score += (tagMatches / Math.max(queryTokens.length, 1)) * 0.2;

  return Math.min(score, 1.0);
}

/**
 * Detect patterns in notes by analyzing tags, titles, and content themes.
 */
function analyzePatterns(
  notes: Array<{ title: string; content: string; tags: string[] }>
): string[] {
  const patterns: string[] = [];

  if (notes.length === 0) {
    return ["No notes in memory yet. Add some notes to detect patterns."];
  }

  // Tag frequency analysis
  const tagFrequency = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
    }
  }

  const frequentTags = [...tagFrequency.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  if (frequentTags.length > 0) {
    const tagPatterns = frequentTags
      .slice(0, 5)
      .map(
        ([tag, count]) =>
          `Recurring topic: "${tag}" appears in ${count} note(s)`
      );
    patterns.push(...tagPatterns);
  }

  // Title keyword analysis
  const titleWords = new Map<string, number>();
  for (const note of notes) {
    const words = note.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const word of words) {
      titleWords.set(word, (titleWords.get(word) || 0) + 1);
    }
  }

  const recurringWords = [...titleWords.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  if (recurringWords.length > 0) {
    patterns.push(
      `Common themes in titles: ${recurringWords
        .slice(0, 5)
        .map(([w]) => `"${w}"`)
        .join(", ")}`
    );
  }

  // Content length pattern
  const avgLength =
    notes.reduce((sum, n) => sum + n.content.length, 0) / notes.length;
  if (avgLength > 0) {
    patterns.push(
      `Average note length: ${Math.round(avgLength)} characters across ${notes.length} note(s)`
    );
  }

  // Note volume pattern
  patterns.push(
    `Memory contains ${notes.length} note(s) across ${tagFrequency.size} unique tag(s)`
  );

  // Temporal hint
  if (notes.length > 10) {
    patterns.push(
      "Active memory usage: You have a substantial memory bank that may benefit from periodic review and consolidation"
    );
  }

  if (patterns.length === 0) {
    patterns.push(
      "No strong patterns detected yet. Continue adding notes to reveal patterns over time."
    );
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

function validateApiKey(): boolean {
  const apiKey = process.env.MEMORIX_API_KEY;

  // If no API key is configured, allow all requests (development mode)
  if (!apiKey) {
    return true;
  }

  // In production, validate against stored API keys
  // For standalone mode, we check the environment variable is set
  return apiKey.length > 0;
}

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

async function toolSearch(
  params: Record<string, unknown>
): Promise<unknown> {
  const query = String(params.query || "");
  const limit = Number(params.limit) || 10;

  if (!query.trim()) {
    throw { code: RPC_ERROR.INVALID_PARAMS, message: "Query cannot be empty" };
  }

  // Fetch all notes for scoring (SQLite FTS is limited, so we do in-memory scoring)
  const allNotes = await prisma.note.findMany({
    orderBy: { createdAt: "desc" },
  });

  const scored = allNotes.map((note) => {
    const tags = parseTags(note.tags);
    const score = computeRelevanceScore(query, note.title, note.content, tags);
    return { note, score };
  });

  // Filter to only include results with some relevance
  const results = scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      noteId: r.note.id,
      title: r.note.title,
      content: r.note.content,
      score: Math.round(r.score * 1000) / 1000,
    }));

  return { results };
}

async function toolAddNote(
  params: Record<string, unknown>
): Promise<unknown> {
  const title = String(params.title || "");
  const content = String(params.content || "");
  const tags = Array.isArray(params.tags)
    ? params.tags.map(String)
    : [];

  if (!title.trim()) {
    throw { code: RPC_ERROR.INVALID_PARAMS, message: "Title cannot be empty" };
  }
  if (!content.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "Content cannot be empty",
    };
  }

  const note = await prisma.note.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      tags: serializeTags(tags),
    },
  });

  // Auto-detect and create relations to existing notes with similar tags
  if (tags.length > 0) {
    const existingNotes = await prisma.note.findMany({
      where: { id: { not: note.id } },
    });

    for (const existing of existingNotes) {
      const existingTags = parseTags(existing.tags);
      const sharedTags = tags.filter((t) => existingTags.includes(t));

      if (sharedTags.length > 0) {
        const relationScore = Math.min(
          sharedTags.length / Math.max(tags.length, existingTags.length),
          1.0
        );

        // Check if relation already exists
        const existingRelation = await prisma.noteRelation.findFirst({
          where: {
            OR: [
              { noteAId: note.id, noteBId: existing.id },
              { noteAId: existing.id, noteBId: note.id },
            ],
          },
        });

        if (!existingRelation) {
          await prisma.noteRelation.create({
            data: {
              noteAId: note.id,
              noteBId: existing.id,
              relationScore,
              reason: `Shared tags: ${sharedTags.join(", ")}`,
            },
          });
        }
      }
    }
  }

  return {
    noteId: note.id,
    message: `Note "${note.title}" created successfully`,
  };
}

async function toolGetNote(
  params: Record<string, unknown>
): Promise<unknown> {
  const noteId = String(params.noteId || "");

  if (!noteId.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "noteId is required",
    };
  }

  const note = await prisma.note.findUnique({
    where: { id: noteId },
  });

  if (!note) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: `Note with ID "${noteId}" not found`,
    };
  }

  return {
    noteId: note.id,
    title: note.title,
    content: note.content,
    tags: parseTags(note.tags),
    createdAt: note.createdAt.toISOString(),
  };
}

async function toolListNotes(
  params: Record<string, unknown>
): Promise<unknown> {
  const limit = Number(params.limit) || 20;
  const offset = Number(params.offset) || 0;

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    }),
    prisma.note.count(),
  ]);

  return {
    notes: notes.map((n) => ({
      noteId: n.id,
      title: n.title,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
  };
}

async function toolChat(
  params: Record<string, unknown>
): Promise<unknown> {
  const message = String(params.message || "");
  const conversationId = params.conversationId
    ? String(params.conversationId)
    : undefined;

  if (!message.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "Message cannot be empty",
    };
  }

  // Search for relevant memories
  const allNotes = await prisma.note.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const scored = allNotes.map((note) => {
    const tags = parseTags(note.tags);
    const score = computeRelevanceScore(message, note.title, note.content, tags);
    return { note, score };
  });

  const relevantNotes = scored
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const memoryRefs = relevantNotes.map((r) => r.note.id);

  // Build response grounded in memory
  let response: string;

  if (relevantNotes.length === 0) {
    response =
      "I couldn't find any relevant memories for your question. " +
      "You can add notes to your memory using the memorix_add_note tool, " +
      "and I'll be able to reference them in future conversations.";
  } else {
    const memoryContext = relevantNotes
      .map(
        (r) =>
          `- "${r.note.title}" (relevance: ${Math.round(r.score * 100)}%): ${r.note.content.slice(0, 200)}${r.note.content.length > 200 ? "..." : ""}`
      )
      .join("\n");

    response =
      `Based on your memory, here's what I found:\n\n${memoryContext}\n\n` +
      `I referenced ${relevantNotes.length} memory item(s) to answer your question. ` +
      `For more details on any specific item, use memorix_get_note with the note ID.`;
  }

  // Handle conversation persistence
  let convId = conversationId;

  if (convId) {
    // Append to existing conversation
    const existing = await prisma.conversation.findUnique({
      where: { id: convId },
    });

    if (existing) {
      let parsedMessages: Array<{ role: string; content: string }> = [];
      try {
        parsedMessages = JSON.parse(existing.messages) as Array<{
          role: string;
          content: string;
        }>;
      } catch {
        parsedMessages = [];
      }

      parsedMessages.push(
        { role: "user", content: message },
        { role: "assistant", content: response }
      );

      await prisma.conversation.update({
        where: { id: convId },
        data: { messages: JSON.stringify(parsedMessages) },
      });
    } else {
      convId = undefined; // Reset if not found
    }
  }

  if (!convId) {
    // Create new conversation
    const conv = await prisma.conversation.create({
      data: {
        messages: JSON.stringify([
          { role: "user", content: message },
          { role: "assistant", content: response },
        ]),
      },
    });
    convId = conv.id;
  }

  return {
    response,
    memoryRefs,
    conversationId: convId,
  };
}

async function toolGetRelated(
  params: Record<string, unknown>
): Promise<unknown> {
  const noteId = String(params.noteId || "");
  const limit = Number(params.limit) || 5;

  if (!noteId.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "noteId is required",
    };
  }

  const note = await prisma.note.findUnique({
    where: { id: noteId },
  });

  if (!note) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: `Note with ID "${noteId}" not found`,
    };
  }

  // Get explicit relations
  const relations = await prisma.noteRelation.findMany({
    where: {
      OR: [{ noteAId: noteId }, { noteBId: noteId }],
    },
    include: {
      noteA: true,
      noteB: true,
    },
    orderBy: { relationScore: "desc" },
    take: limit,
  });

  const related = relations.map((rel) => {
    const relatedNote = rel.noteAId === noteId ? rel.noteB : rel.noteA;
    return {
      noteId: relatedNote.id,
      title: relatedNote.title,
      relationScore: Math.round(rel.relationScore * 1000) / 1000,
      reason: rel.reason,
    };
  });

  // If not enough explicit relations, supplement with tag-based matching
  if (related.length < limit) {
    const noteTags = parseTags(note.tags);

    if (noteTags.length > 0) {
      const allNotes = await prisma.note.findMany({
        where: { id: { not: noteId } },
      });

      const existingRelatedIds = new Set(related.map((r) => r.noteId));

      const tagBased = allNotes
        .filter((n) => !existingRelatedIds.has(n.id))
        .map((n) => {
          const nTags = parseTags(n.tags);
          const sharedTags = noteTags.filter((t) => nTags.includes(t));
          return {
            noteId: n.id,
            title: n.title,
            relationScore:
              sharedTags.length / Math.max(noteTags.length, nTags.length),
            reason:
              sharedTags.length > 0
                ? `Shared tags: ${sharedTags.join(", ")}`
                : "Content similarity",
          };
        })
        .filter((r) => r.relationScore > 0)
        .sort((a, b) => b.relationScore - a.relationScore)
        .slice(0, limit - related.length);

      related.push(...tagBased);
    }
  }

  return { related };
}

async function toolDetectPatterns(
  _params: Record<string, unknown>
): Promise<unknown> {
  const notes = await prisma.note.findMany({
    orderBy: { createdAt: "desc" },
  });

  const notesWithTags = notes.map((n) => ({
    title: n.title,
    content: n.content,
    tags: parseTags(n.tags),
  }));

  const patterns = analyzePatterns(notesWithTags);

  // Also check decisions for patterns
  const decisions = await prisma.decision.findMany({
    orderBy: { createdAt: "desc" },
  });

  if (decisions.length > 0) {
    patterns.push(
      `${decisions.length} decision(s) recorded in memory, indicating active decision-tracking behavior`
    );
  }

  // Store detected patterns for future reference
  if (patterns.length > 0) {
    await prisma.pattern.upsert({
      where: { id: `patterns-latest` },
      create: {
        id: `patterns-latest`,
        pattern: JSON.stringify(patterns),
        description: "Latest detected patterns",
        confidence: 0.8,
      },
      update: {
        pattern: JSON.stringify(patterns),
        description: "Latest detected patterns",
        confidence: 0.8,
      },
    });
  }

  return { patterns };
}

async function toolAddDecision(
  params: Record<string, unknown>
): Promise<unknown> {
  const title = String(params.title || "");
  const context = String(params.context || "");
  const decision = String(params.decision || "");
  const reasoning = String(params.reasoning || "");

  if (!title.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "Title cannot be empty",
    };
  }
  if (!context.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "Context cannot be empty",
    };
  }
  if (!decision.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "Decision cannot be empty",
    };
  }
  if (!reasoning.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "Reasoning cannot be empty",
    };
  }

  const decisionRecord = await prisma.decision.create({
    data: {
      title: title.trim(),
      context: context.trim(),
      decision: decision.trim(),
      reasoning: reasoning.trim(),
    },
  });

  return {
    decisionId: decisionRecord.id,
    message: `Decision "${decisionRecord.title}" recorded successfully`,
  };
}

// ---------------------------------------------------------------------------
// Tool Router
// ---------------------------------------------------------------------------

const TOOL_HANDLERS: Record<
  string,
  (params: Record<string, unknown>) => Promise<unknown>
> = {
  memorix_search: toolSearch,
  memorix_add_note: toolAddNote,
  memorix_get_note: toolGetNote,
  memorix_list_notes: toolListNotes,
  memorix_chat: toolChat,
  memorix_get_related: toolGetRelated,
  memorix_detect_patterns: toolDetectPatterns,
  memorix_add_decision: toolAddDecision,
};

// ---------------------------------------------------------------------------
// MCP Protocol Handlers
// ---------------------------------------------------------------------------

function handleInitialize(
  id: string | number | null,
  params?: Record<string, unknown>
): JsonRpcResponse {
  const protocolVersion = "2024-11-05";

  // Parse client capabilities if provided
  const clientInfo = (params?.clientInfo as { name?: string; version?: string }) || {};

  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion,
      capabilities: {
        tools: {
          listChanged: false,
        },
        logging: {},
      },
      serverInfo: {
        name: "memorix-mcp-server",
        version: "1.0.0",
        description:
          "Memorix MCP Server — AI Memory Integration for AI Assistants",
      },
    },
  };
}

function handleToolsList(id: string | number | null): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: TOOLS,
    },
  };
}

async function handleToolsCall(
  id: string | number | null,
  params?: Record<string, unknown>
): Promise<JsonRpcResponse> {
  if (!params) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: RPC_ERROR.INVALID_PARAMS,
        message: "Missing params for tools/call",
      },
    };
  }

  const toolName = String(params.name || "");
  const toolArgs = (params.arguments as Record<string, unknown>) || {};

  if (!toolName) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: RPC_ERROR.INVALID_PARAMS,
        message: "Missing tool name in tools/call",
      },
    };
  }

  const handler = TOOL_HANDLERS[toolName];

  if (!handler) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: RPC_ERROR.METHOD_NOT_FOUND,
        message: `Unknown tool: ${toolName}`,
      },
    };
  }

  try {
    const result = await handler(toolArgs);

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  } catch (err: unknown) {
    const rpcError = err as {
      code?: number;
      message?: string;
    };

    if (rpcError.code && rpcError.message) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: rpcError.code,
          message: rpcError.message,
        },
      };
    }

    // Internal error
    const message =
      err instanceof Error ? err.message : "Unknown error executing tool";

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: RPC_ERROR.INTERNAL_ERROR,
        message: `Tool execution failed: ${message}`,
        data: { tool: toolName },
      },
    };
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC Message Router
// ---------------------------------------------------------------------------

async function handleMessage(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  // Validate JSON-RPC version
  if (request.jsonrpc !== "2.0") {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: RPC_ERROR.INVALID_REQUEST,
        message: "Invalid or missing jsonrpc version. Must be '2.0'.",
      },
    };
  }

  const { id, method, params } = request;

  // Notification (no id) — acknowledge but don't respond
  if (id === undefined || id === null) {
    // Process the notification but don't send a response
    return null;
  }

  // Route based on method
  switch (method) {
    case "initialize":
      return handleInitialize(id, params);

    case "notifications/initialized":
      // Client has acknowledged initialization — no response needed
      return null;

    case "ping":
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      };

    case "tools/list":
      return handleToolsList(id);

    case "tools/call":
      return await handleToolsCall(id, params);

    case "logging/setLevel":
      // Accept but no-op
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      };

    case "completion/complete":
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: RPC_ERROR.METHOD_NOT_FOUND,
          message: "completion/complete is not supported",
        },
      };

    case "prompts/list":
    case "prompts/get":
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: RPC_ERROR.METHOD_NOT_FOUND,
          message: "Prompts are not supported by this server",
        },
      };

    case "resources/list":
    case "resources/read":
    case "resources/templates/list":
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: RPC_ERROR.METHOD_NOT_FOUND,
          message: "Resources are not supported by this server",
        },
      };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: RPC_ERROR.METHOD_NOT_FOUND,
          message: `Method not found: ${method}`,
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Stdio Transport
// ---------------------------------------------------------------------------

function sendResponse(response: JsonRpcResponse): void {
  const json = JSON.stringify(response);
  process.stdout.write(json + "\n");
}

function log(message: string): void {
  // Log to stderr so it doesn't interfere with JSON-RPC on stdout
  process.stderr.write(`[memorix-mcp] ${message}\n`);
}

let inputBuffer = "";
let pendingOperations = 0;
let shuttingDown = false;

async function processLine(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request: JsonRpcRequest;

  try {
    request = JSON.parse(trimmed) as JsonRpcRequest;
  } catch {
    sendResponse({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: RPC_ERROR.PARSE_ERROR,
        message: "Invalid JSON in request",
      },
    });
    return;
  }

  pendingOperations++;
  try {
    const response = await handleMessage(request);
    if (response !== null) {
      sendResponse(response);
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    log(`Error handling message: ${message}`);
    sendResponse({
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: RPC_ERROR.INTERNAL_ERROR,
        message,
      },
    });
  } finally {
    pendingOperations--;
    if (shuttingDown && pendingOperations === 0) {
      cleanup();
    }
  }
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Validate authentication
  if (!validateApiKey()) {
    log("ERROR: Invalid MEMORIX_API_KEY. Server cannot start.");
    process.exit(1);
  }

  // Ensure database is accessible
  try {
    await prisma.$connect();
    log("Database connected successfully");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log(`ERROR: Failed to connect to database: ${message}`);
    log("Make sure DATABASE_URL is set correctly and run 'prisma db push' to create tables.");
    process.exit(1);
  }

  const apiKeyStatus = process.env.MEMORIX_API_KEY
    ? "configured"
    : "not set (open mode)";
  log(`Memorix MCP Server starting...`);
  log(`API Key: ${apiKeyStatus}`);
  log(`Database: ${process.env.DATABASE_URL || "file:../db/memorix.db"}`);
  log(`Tools available: ${TOOLS.length}`);
  log(`Listening on stdin (JSON-RPC 2.0 over stdio)`);

  // Handle stdin
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", (chunk: string) => {
    inputBuffer += chunk;
    const lines = inputBuffer.split("\n");
    // Keep the last (possibly incomplete) line in the buffer
    inputBuffer = lines.pop() || "";

    for (const line of lines) {
      processLine(line).catch((err: unknown) => {
        log(
          `Unhandled error processing line: ${err instanceof Error ? err.message : err}`
        );
      });
    }
  });

  process.stdin.on("end", () => {
    // Process any remaining data in buffer
    if (inputBuffer.trim()) {
      processLine(inputBuffer).catch((err: unknown) => {
        log(
          `Unhandled error processing remaining buffer: ${err instanceof Error ? err.message : err}`
        );
      });
    }
    log("stdin ended, shutting down...");
    shuttingDown = true;
    if (pendingOperations === 0) {
      cleanup();
    }
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    log("Received SIGINT, shutting down...");
    cleanup();
  });

  process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down...");
    cleanup();
  });

  process.on("uncaughtException", (err: Error) => {
    log(`Uncaught exception: ${err.message}`);
    log(err.stack || "");
  });

  process.on("unhandledRejection", (reason: unknown) => {
    log(`Unhandled rejection: ${reason}`);
  });
}

let cleanupCalled = false;

function cleanup(): void {
  if (cleanupCalled) return;
  cleanupCalled = true;

  prisma
    .$disconnect()
    .then(() => {
      log("Database disconnected");
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

// Start the server
main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  log(`Fatal error: ${message}`);
  process.exit(1);
});
