/**
 * Memorix MCP Server
 *
 * A standalone MCP (Model Context Protocol) server implementing JSON-RPC 2.0
 * over stdio transport. Allows AI assistants (Claude, GPT, etc.) to interact
 * with the Memorix AI memory system.
 *
 * Protocol: JSON-RPC 2.0 over stdio (stdin/stdout)
 * Authentication: API key validated against the ApiKey table in the database
 *
 * Uses the SAME Prisma schema as the main app — no separate schema.
 * Models: User, Note, NoteChunk, MemoryLink, Conversation, Message, Decision, ApiKey, McpSession
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
  AUTH_REQUIRED: -32001,
  AUTH_FAILED: -32002,
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
      "Chat with the memory system. Ask questions and get AI-powered responses grounded in your stored memories. Uses LLM with RAG pipeline for intelligent responses.",
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
      "Get notes related to a specific note, based on shared tags, content similarity, and explicit memory links.",
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
// Database Client — uses the SAME Prisma schema as the main app
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  log: ["error"],
});

// ---------------------------------------------------------------------------
// Authentication — validates API key against the ApiKey table
// ---------------------------------------------------------------------------

let authenticatedUserId: string | null = null;
let authenticatedApiKeyId: string | null = null;

/**
 * Check if the --allow-open flag was passed via command line arguments.
 * This flag explicitly opts in to open (unauthenticated) mode.
 */
function hasAllowOpenFlag(): boolean {
  return process.argv.includes("--allow-open");
}

/**
 * Validate the API key from the MEMORIX_API_KEY environment variable
 * against the ApiKey table in the database.
 *
 * Security behavior:
 * - If MEMORIX_API_KEY is set: validate against the ApiKey table in the database
 * - If MEMORIX_API_KEY is NOT set AND NODE_ENV is "production": REFUSE to start
 * - If MEMORIX_API_KEY is NOT set AND NODE_ENV is not "production": allow open mode
 *   with a clear WARNING (requires --allow-open flag for explicit opt-in)
 *
 * - Looks up the key in the database
 * - Sets the authenticated user ID for all subsequent operations
 * - Updates the lastUsedAt timestamp
 * - Creates an McpSession record
 */
async function validateAndAuthenticate(): Promise<boolean> {
  const apiKey = process.env.MEMORIX_API_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  const allowOpen = hasAllowOpenFlag();

  // If no API key is configured, enforce security policies
  if (!apiKey) {
    // PRODUCTION: Refuse to start without an API key
    if (isProduction) {
      log("FATAL: MEMORIX_API_KEY is not set and NODE_ENV is 'production'.");
      log("  The MCP server REFUSES to run in open mode in production.");
      log("  Set the MEMORIX_API_KEY environment variable to a valid API key.");
      return false;
    }

    // DEVELOPMENT: Require --allow-open flag for explicit opt-in
    if (!allowOpen) {
      log("ERROR: MEMORIX_API_KEY is not set and --allow-open flag is not provided.");
      log("  In development mode, you must explicitly opt in to open (unauthenticated)");
      log("  mode by passing the --allow-open flag:");
      log("    bun run mcp-server/index.ts --allow-open");
      log("  WARNING: Open mode grants access to the first user's data without authentication.");
      log("  Never use --allow-open in production!");
      return false;
    }

    // Open mode with explicit opt-in (development only)
    log("⚠️  WARNING: Running in OPEN MODE (no MEMORIX_API_KEY set, --allow-open flag provided).");
    log("  This grants unauthenticated access to the first user's data.");
    log("  NEVER use this in production!");

    const firstUser = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (firstUser) {
      authenticatedUserId = firstUser.id;
      log("Running in open mode — using first user");
      return true;
    }
    log("ERROR: No users in database and no MEMORIX_API_KEY set");
    return false;
  }

  // Look up the API key in the database
  const keyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: { user: true },
  });

  if (!keyRecord) {
    log("ERROR: Invalid MEMORIX_API_KEY — not found in database");
    return false;
  }

  // Set the authenticated user
  authenticatedUserId = keyRecord.userId;
  authenticatedApiKeyId = keyRecord.id;

  // Update lastUsedAt
  await prisma.apiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsedAt: new Date() },
  });

  // Create an MCP session record
  await prisma.mcpSession.create({
    data: {
      userId: keyRecord.userId,
      apiKeyId: keyRecord.id,
      clientId: "mcp-stdio",
    },
  });

  log(`Authenticated as user: ${keyRecord.user.email}`);
  return true;
}

/**
 * Get the authenticated user ID, throwing an error if not authenticated.
 */
function requireUserId(): string {
  if (!authenticatedUserId) {
    throw {
      code: RPC_ERROR.AUTH_REQUIRED,
      message: "Authentication required. Set MEMORIX_API_KEY environment variable.",
    };
  }
  return authenticatedUserId;
}

// ---------------------------------------------------------------------------
// Vector Search — uses NoteChunk embeddings for semantic search
// ---------------------------------------------------------------------------

const DEFAULT_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSION || "768");

/**
 * Generate a pseudo-embedding for vector search in the MCP server.
 * Uses the same n-gram hashing approach as the main app's embedder
 * to ensure compatibility with stored embeddings.
 */
function generateMcpPseudoEmbedding(text: string, dimensions: number = DEFAULT_DIMENSIONS): number[] {
  const embedding = new Float64Array(dimensions);
  const normalizedText = text.toLowerCase().trim();
  const ngramSizes = [3, 4, 5, 6];

  function hashStr(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash;
  }

  for (const ngramSize of ngramSizes) {
    for (let i = 0; i <= normalizedText.length - ngramSize; i++) {
      const ngram = normalizedText.slice(i, i + ngramSize);
      const h = hashStr(ngram);
      const idx1 = Math.abs(h) % dimensions;
      const idx2 = Math.abs(hashStr(ngram + ':v2')) % dimensions;
      const sign = h >= 0 ? 1 : -1;
      embedding[idx1] += sign * 0.1;
      embedding[idx2] += sign * 0.05;
    }
  }

  const words = normalizedText.split(/\s+/).filter((w) => w.length > 1);
  for (const word of words) {
    const h = hashStr(word);
    const idx = Math.abs(h) % dimensions;
    const sign = h >= 0 ? 1 : -1;
    embedding[idx] += sign * 0.15;
  }

  const globalHash = hashStr(normalizedText);
  for (let i = 0; i < dimensions; i++) {
    const seed = i * 31 + 7;
    const h = hashStr(`${seed}:${normalizedText}`);
    embedding[i] += (h % 10000) / 10000 * 0.01;
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  const result: number[] = new Array(dimensions);
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      result[i] = embedding[i] / magnitude;
    }
  } else {
    for (let i = 0; i < dimensions; i++) {
      result[i] = 0;
    }
  }
  return result;
}

/**
 * Generate embedding for a query — tries external API first, falls back to pseudo-embedding.
 */
async function generateMcpEmbedding(text: string): Promise<number[]> {
  const embeddingApiUrl = process.env.EMBEDDING_API_URL;
  const embeddingApiKey = process.env.EMBEDDING_API_KEY;

  if (embeddingApiUrl) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (embeddingApiKey) headers["Authorization"] = `Bearer ${embeddingApiKey}`;

      const response = await fetch(embeddingApiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: text,
          model: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
          dimensions: DEFAULT_DIMENSIONS,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.data?.[0]?.embedding && Array.isArray(result.data[0].embedding)) {
          return result.data[0].embedding;
        }
      }
    } catch {
      // Fall through to pseudo-embedding
    }
  }

  return generateMcpPseudoEmbedding(text, DEFAULT_DIMENSIONS);
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * Perform vector search using NoteChunk embeddings stored by the main app.
 * Returns results sorted by cosine similarity.
 */
async function vectorSearch(
  queryEmbedding: number[],
  userId: string,
  limit: number
): Promise<Array<{ noteId: string; title: string; content: string; score: number }>> {
  if (queryEmbedding.length === 0) return [];

  // Load all chunks for the user
  const chunks = await prisma.noteChunk.findMany({
    where: {
      note: { userId },
    },
    include: {
      note: { select: { title: true } },
    },
    take: 1000, // Cap for performance
  });

  if (chunks.length === 0) return [];

  // Score each chunk
  const scored = [];
  for (const chunk of chunks) {
    try {
      const chunkEmbedding = JSON.parse(chunk.embedding);
      if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) continue;
      const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
      if (score > 0.1) { // Minimum similarity threshold
        scored.push({
          noteId: chunk.noteId,
          title: chunk.note.title,
          content: chunk.content,
          score,
        });
      }
    } catch {
      // Skip malformed embeddings
    }
  }

  // Group by note, keeping the highest-scoring chunk per note
  const bestByNote = new Map<string, { noteId: string; title: string; content: string; score: number }>();
  for (const item of scored) {
    const existing = bestByNote.get(item.noteId);
    if (!existing || item.score > existing.score) {
      bestByNote.set(item.noteId, item);
    }
  }

  return Array.from(bestByNote.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      ...r,
      content: r.content.slice(0, 500) + (r.content.length > 500 ? "..." : ""),
      score: Math.round(r.score * 1000) / 1000,
    }));
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Parse tags from the comma-separated format used in the main app's schema.
 * The main app stores tags as a comma-separated string (e.g., "ai,memory,rag").
 */
function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return [];
  // The main app uses comma-separated tags, not JSON
  return tagsStr
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Serialize tags back to comma-separated format matching the main app.
 */
function serializeTags(tags: string[]): string {
  return tags.join(",");
}

/**
 * Simple text-based similarity scoring using keyword overlap and
 * substring matching. Used as a fallback alongside the main app's
 * vector-based search in the memory engine.
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
// LLM Integration — uses z-ai-web-dev-sdk for real AI chat
// ---------------------------------------------------------------------------

let zaiModule: typeof import("z-ai-web-dev-sdk").default | null = null;

/**
 * Lazily load the z-ai-web-dev-sdk module.
 * Returns null if the SDK is not available.
 */
async function getLLMClient() {
  if (zaiModule === null) {
    try {
      const mod = await import("z-ai-web-dev-sdk");
      zaiModule = mod.default;
    } catch {
      zaiModule = null;
      log("z-ai-web-dev-sdk not available — chat will use keyword-based responses");
    }
  }
  if (!zaiModule) return null;

  try {
    const client = await zaiModule.create();
    return client;
  } catch (err) {
    log(`Failed to create LLM client: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Call the LLM to generate a chat response grounded in memory context.
 */
async function callLLM(
  message: string,
  memoryContext: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string | null> {
  const client = await getLLMClient();
  if (!client) return null;

  const systemPrompt = `You are Memorix, a personal AI memory assistant. You help users recall, connect, and reason about their stored knowledge.

You have access to the following memories from the user's knowledge base:
${memoryContext}

Guidelines:
- Reference specific memories when answering questions
- Connect ideas across different notes and time periods
- Help the user think through decisions using their past reasoning
- Suggest connections the user might not have noticed
- Be concise but insightful
- If the memories don't contain relevant information, say so honestly`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10) // Keep last 10 messages for context window
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    { role: "user" as const, content: message },
  ];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    if (
      response &&
      typeof response === "object" &&
      "choices" in response
    ) {
      const choices = response.choices as Array<{
        message?: { content?: string };
      }>;
      if (choices.length > 0 && choices[0].message?.content) {
        return choices[0].message.content;
      }
    }

    return null;
  } catch (err) {
    log(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tool Implementations — all use authenticatedUserId for multi-tenancy
// ---------------------------------------------------------------------------

async function toolSearch(
  params: Record<string, unknown>
): Promise<unknown> {
  const userId = requireUserId();
  const query = String(params.query || "");
  const limit = Math.min(Number(params.limit) || 10, 100);

  if (!query.trim()) {
    throw { code: RPC_ERROR.INVALID_PARAMS, message: "Query cannot be empty" };
  }

  // Step 1: Try vector-based search using NoteChunk embeddings
  // This uses the same embeddings stored by the main app's memory engine
  const queryEmbeddingResult = await generateMcpEmbedding(query);
  const vectorResults = await vectorSearch(queryEmbeddingResult, userId, limit);

  if (vectorResults.length > 0) {
    return { results: vectorResults, searchType: "vector" };
  }

  // Step 2: Fallback to keyword-based search
  const allNotes = await prisma.note.findMany({
    where: {
      userId,
      isArchived: false,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const scored = allNotes.map((note) => {
    const tags = parseTags(note.tags);
    const score = computeRelevanceScore(query, note.title, note.content, tags);
    return { note, score };
  });

  const results = scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      noteId: r.note.id,
      title: r.note.title,
      content: r.note.content.slice(0, 500) + (r.note.content.length > 500 ? "..." : ""),
      score: Math.round(r.score * 1000) / 1000,
    }));

  return { results, searchType: "keyword" };
}

async function toolAddNote(
  params: Record<string, unknown>
): Promise<unknown> {
  const userId = requireUserId();
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

  const tagsStr = serializeTags(tags);

  const note = await prisma.note.create({
    data: {
      userId,
      title: title.trim(),
      content: content.trim(),
      markdown: content.trim(), // Store as markdown too
      tags: tagsStr,
    },
  });

  // Auto-detect and create memory links to existing notes with similar tags
  if (tags.length > 0) {
    const existingNotes = await prisma.note.findMany({
      where: {
        userId,
        id: { not: note.id },
        isArchived: false,
      },
    });

    for (const existing of existingNotes) {
      const existingTags = parseTags(existing.tags);
      const sharedTags = tags.filter((t) =>
        existingTags.some((et) => et.toLowerCase() === t.toLowerCase())
      );

      if (sharedTags.length > 0) {
        const relationScore = Math.min(
          sharedTags.length / Math.max(tags.length, existingTags.length),
          1.0
        );

        // Check if link already exists (in either direction)
        const existingLink = await prisma.memoryLink.findFirst({
          where: {
            OR: [
              { sourceNoteId: note.id, targetNoteId: existing.id },
              { sourceNoteId: existing.id, targetNoteId: note.id },
            ],
          },
        });

        if (!existingLink) {
          // Create forward link (sourceNote → targetNote)
          await prisma.memoryLink.create({
            data: {
              sourceNoteId: note.id,
              targetNoteId: existing.id,
              relationScore,
              reason: `Shared tags: ${sharedTags.join(", ")}`,
              autoLinked: true,
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
  const userId = requireUserId();
  const noteId = String(params.noteId || "");

  if (!noteId.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "noteId is required",
    };
  }

  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      userId, // Ensure user owns this note
    },
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
    markdown: note.markdown,
    tags: parseTags(note.tags),
    isArchived: note.isArchived,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function toolListNotes(
  params: Record<string, unknown>
): Promise<unknown> {
  const userId = requireUserId();
  const limit = Math.min(Number(params.limit) || 20, 100);
  const offset = Number(params.offset) || 0;

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where: {
        userId,
        isArchived: false,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        tags: true,
        createdAt: true,
      },
    }),
    prisma.note.count({
      where: { userId, isArchived: false },
    }),
  ]);

  return {
    notes: notes.map((n) => ({
      noteId: n.id,
      title: n.title,
      tags: parseTags(n.tags),
      createdAt: n.createdAt.toISOString(),
    })),
    total,
  };
}

async function toolChat(
  params: Record<string, unknown>
): Promise<unknown> {
  const userId = requireUserId();
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

  // Step 1: Search for relevant memories
  const userNotes = await prisma.note.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const scored = userNotes.map((note) => {
    const tags = parseTags(note.tags);
    const score = computeRelevanceScore(message, note.title, note.content, tags);
    return { note, score };
  });

  const relevantNotes = scored
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const memoryRefs = relevantNotes.map((r) => r.note.id);

  // Step 2: Build memory context for LLM
  const memoryContext =
    relevantNotes.length > 0
      ? relevantNotes
          .map(
            (r) =>
              `- "${r.note.title}" (relevance: ${Math.round(r.score * 100)}%): ${r.note.content.slice(0, 300)}${r.note.content.length > 300 ? "..." : ""}`
          )
          .join("\n")
      : "No relevant memories found.";

  // Step 3: Load conversation history if continuing a conversation
  let conversationHistory: Array<{ role: string; content: string }> = [];
  let convId = conversationId;

  if (convId) {
    const existingConv = await prisma.conversation.findFirst({
      where: { id: convId, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        },
      },
    });

    if (existingConv) {
      conversationHistory = existingConv.messages.map((m) => ({
        role: m.role.toLowerCase() === "user" ? "user" : "assistant",
        content: m.content,
      }));
    } else {
      convId = undefined; // Reset if not found
    }
  }

  // Step 4: Try to get an AI-powered response via LLM
  let response: string;

  const llmResponse = await callLLM(message, memoryContext, conversationHistory);

  if (llmResponse) {
    response = llmResponse;
  } else if (relevantNotes.length === 0) {
    response =
      "I couldn't find any relevant memories for your question. " +
      "You can add notes to your memory using the memorix_add_note tool, " +
      "and I'll be able to reference them in future conversations.";
  } else {
    // Fallback: keyword-based response when LLM is unavailable
    const memorySummary = relevantNotes
      .map(
        (r) =>
          `- "${r.note.title}" (relevance: ${Math.round(r.score * 100)}%): ${r.note.content.slice(0, 200)}${r.note.content.length > 200 ? "..." : ""}`
      )
      .join("\n");

    response =
      `Based on your memory, here's what I found:\n\n${memorySummary}\n\n` +
      `I referenced ${relevantNotes.length} memory item(s) to answer your question. ` +
      `For more details on any specific item, use memorix_get_note with the note ID.`;
  }

  // Step 5: Handle conversation persistence using separate Message model
  if (!convId) {
    // Create new conversation
    const conv = await prisma.conversation.create({
      data: {
        userId,
        title: message.slice(0, 100),
      },
    });
    convId = conv.id;
  }

  // Store user message
  await prisma.message.create({
    data: {
      conversationId: convId,
      role: "USER",
      content: message,
      memoryRefs: JSON.stringify(memoryRefs),
    },
  });

  // Store assistant message
  await prisma.message.create({
    data: {
      conversationId: convId,
      role: "ASSISTANT",
      content: response,
      memoryRefs: JSON.stringify(memoryRefs),
    },
  });

  return {
    response,
    memoryRefs,
    conversationId: convId,
  };
}

async function toolGetRelated(
  params: Record<string, unknown>
): Promise<unknown> {
  const userId = requireUserId();
  const noteId = String(params.noteId || "");
  const limit = Math.min(Number(params.limit) || 5, 20);

  if (!noteId.trim()) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: "noteId is required",
    };
  }

  // Verify the note belongs to the user
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
  });

  if (!note) {
    throw {
      code: RPC_ERROR.INVALID_PARAMS,
      message: `Note with ID "${noteId}" not found`,
    };
  }

  // Get explicit memory links using the main app's MemoryLink model
  const sourceLinks = await prisma.memoryLink.findMany({
    where: { sourceNoteId: noteId },
    include: {
      targetNote: { select: { id: true, title: true, userId: true } },
    },
    orderBy: { relationScore: "desc" },
    take: limit,
  });

  const targetLinks = await prisma.memoryLink.findMany({
    where: { targetNoteId: noteId },
    include: {
      sourceNote: { select: { id: true, title: true, userId: true } },
    },
    orderBy: { relationScore: "desc" },
    take: limit,
  });

  const related: Array<{
    noteId: string;
    title: string;
    relationScore: number;
    reason: string;
  }> = [];

  const seenIds = new Set<string>();

  // Process source links (noteId is source)
  for (const link of sourceLinks) {
    // Only include notes belonging to the same user
    if (link.targetNote.userId !== userId) continue;
    if (seenIds.has(link.targetNote.id)) continue;
    seenIds.add(link.targetNote.id);
    related.push({
      noteId: link.targetNote.id,
      title: link.targetNote.title,
      relationScore: Math.round(link.relationScore * 1000) / 1000,
      reason: link.reason,
    });
  }

  // Process target links (noteId is target)
  for (const link of targetLinks) {
    if (link.sourceNote.userId !== userId) continue;
    if (seenIds.has(link.sourceNote.id)) continue;
    seenIds.add(link.sourceNote.id);
    related.push({
      noteId: link.sourceNote.id,
      title: link.sourceNote.title,
      relationScore: Math.round(link.relationScore * 1000) / 1000,
      reason: link.reason,
    });
  }

  // If not enough explicit links, supplement with tag-based matching
  if (related.length < limit) {
    const noteTags = parseTags(note.tags);

    if (noteTags.length > 0) {
      const userNotes = await prisma.note.findMany({
        where: {
          userId,
          id: { not: noteId },
          isArchived: false,
        },
        take: 200,
      });

      const tagBased = userNotes
        .filter((n) => !seenIds.has(n.id))
        .map((n) => {
          const nTags = parseTags(n.tags);
          const sharedTags = noteTags.filter((t) =>
            nTags.some((nt) => nt.toLowerCase() === t.toLowerCase())
          );
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
  const userId = requireUserId();

  const notes = await prisma.note.findMany({
    where: { userId },
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
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (decisions.length > 0) {
    patterns.push(
      `${decisions.length} decision(s) recorded in memory, indicating active decision-tracking behavior`
    );
  }

  // Note: We do NOT store patterns in a Pattern model — that model doesn't exist
  // in the main app's schema. Patterns are computed on-the-fly.

  return { patterns };
}

async function toolAddDecision(
  params: Record<string, unknown>
): Promise<unknown> {
  const userId = requireUserId();
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
      userId,
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

  const _clientInfo = (params?.clientInfo as { name?: string; version?: string }) || {};

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

  // Validate and authenticate using the API key
  const authSuccess = await validateAndAuthenticate();
  if (!authSuccess) {
    log("ERROR: Authentication failed. Set MEMORIX_API_KEY to a valid API key from the Memorix app.");
    process.exit(1);
  }

  const apiKeyStatus = process.env.MEMORIX_API_KEY
    ? "configured (authenticated)"
    : "not set (open mode — using first user)";
  log(`Memorix MCP Server starting...`);
  log(`API Key: ${apiKeyStatus}`);
  log(`Database: ${process.env.DATABASE_URL || "file:./dev.db"}`);
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

async function cleanup(): Promise<void> {
  if (cleanupCalled) return;
  cleanupCalled = true;

  // Mark MCP session as disconnected
  if (authenticatedApiKeyId) {
    try {
      await prisma.mcpSession.updateMany({
        where: {
          apiKeyId: authenticatedApiKeyId,
          disconnectedAt: null,
        },
        data: { disconnectedAt: new Date() },
      });
    } catch {
      // Ignore errors during cleanup
    }
  }

  try {
    await prisma.$disconnect();
    log("Database disconnected");
  } catch {
    // Ignore
  }
  process.exit(0);
}

// Start the server
main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  log(`Fatal error: ${message}`);
  process.exit(1);
});
