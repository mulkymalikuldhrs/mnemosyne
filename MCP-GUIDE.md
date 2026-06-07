# MCP (Model Context Protocol) Guide — mnemosyne v4.0

> Complete guide for using mnemosyne's MCP server to give AI assistants persistent, searchable memory.

---

## Table of Contents

- [What is MCP and Why Mnemosyne Supports It](#what-is-mcp-and-why-mnemosyne-supports-it)
- [MCP Server Architecture](#mcp-server-architecture)
- [Setup for Claude Desktop](#setup-for-claude-desktop)
- [Setup for Cursor](#setup-for-cursor)
- [Setup for VS Code](#setup-for-vs-code)
- [Setup for Windsurf](#setup-for-windsurf)
- [Available MCP Tools](#available-mcp-tools)
- [MCP as API](#mcp-as-api)
- [Custom MCP Tools](#custom-mcp-tools)
- [Troubleshooting](#troubleshooting)
- [Environment Variables](#environment-variables)

---

## What is MCP and Why Mnemosyne Supports It

**MCP (Model Context Protocol)** is an open standard developed by Anthropic that enables AI assistants to securely connect to external data sources and tools. It uses JSON-RPC 2.0 over stdio transport to provide a standardized way for AI models to interact with external systems.

### Why MCP Matters for mnemosyne

Mnemosyne is fundamentally a **memory system** — and MCP is the perfect protocol for giving AI assistants access to that memory. With mnemosyne's MCP server:

- **Claude** can search your notes and save new memories during conversations
- **Cursor** can access your project knowledge base while you code
- **VS Code extensions** can query your memory for context-aware suggestions
- **Any MCP-compatible client** gets instant access to your personal AI memory

This transforms AI assistants from stateless chatbots into **memory-aware agents** that remember your context across conversations.

### The Memory Advantage

```
Without MCP:                        With MCP:
┌─────────────┐                    ┌─────────────┐
│ AI Assistant │                    │ AI Assistant │
│             │                    │             │
│ No memory   │                    │ Has memory  │
│ Forgets     │◄── MCP ──────────►│ Remembers   │
│ each chat   │    over stdio      │ Connects    │
│ No context  │                    │ Contextual  │
└─────────────┘                    └──────┬──────┘
                                          │
                                   ┌──────▼──────┐
                                   │  mnemosyne     │
                                   │  MCP Server  │
                                   │              │
                                   │  Notes       │
                                   │  Decisions   │
                                   │  Patterns    │
                                   │  Relations   │
                                   └──────────────┘
```

---

## MCP Server Architecture

mnemosyne's MCP server implements JSON-RPC 2.0 over stdio (stdin/stdout):

```
AI Assistant (Claude/Cursor/VS Code)
        │
        │ JSON-RPC 2.0 over stdio
        ▼
┌──────────────────────────────────┐
│       mnemosyne MCP Server         │
│                                  │
│  ┌────────────────────────────┐  │
│  │  MCP Protocol Handler      │  │
│  │  - initialize              │  │
│  │  - tools/list              │  │
│  │  - tools/call              │  │
│  └──────────┬─────────────────┘  │
│             │                    │
│  ┌──────────▼─────────────────┐  │
│  │  Tool Implementations       │  │
│  │  - mnemosyne_search           │  │
│  │  - mnemosyne_add_note         │  │
│  │  - mnemosyne_get_note         │  │
│  │  - mnemosyne_list_notes       │  │
│  │  - mnemosyne_chat             │  │
│  │  - mnemosyne_get_related      │  │
│  │  - mnemosyne_detect_patterns  │  │
│  │  - mnemosyne_add_decision     │  │
│  └──────────┬─────────────────┘  │
│             │                    │
│  ┌──────────▼─────────────────┐  │
│  │  Prisma ORM (SQLite)        │  │
│  │  - Note · NoteChunk         │  │
│  │  - MemoryLink               │  │
│  │  - Decision · Conversation  │  │
│  │  - ApiKey · McpSession      │  │
│  └──────────┬─────────────────┘  │
│             │                    │
└─────────────┼────────────────────┘
              │
       ┌──────▼──────┐
       │  mnemosyne.db  │
       │  (SQLite)    │
       └──────────────┘
```

### Protocol Flow

1. **Initialize** — Client sends `initialize` request, server responds with capabilities
2. **List Tools** — Client sends `tools/list`, server returns available tools
3. **Call Tool** — Client sends `tools/call` with tool name and parameters
4. **Response** — Server executes the tool and returns the result

### Authentication

The MCP server supports two modes:

| Mode | Configuration | Use Case |
|------|--------------|----------|
| **Authenticated** | `mnemosyne_API_KEY` set | Production use |
| **Open** | No key + `--allow-open` flag | Local development only |

---

## Setup for Claude Desktop

### Configuration

Add the following to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key-here",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Steps

1. Generate an API key from mnemosyne (Settings → API Keys → Create)
2. Open the Claude Desktop config file
3. Add the `mnemosyne` MCP server configuration
4. Replace `your-api-key-here` with your actual API key
5. Restart Claude Desktop
6. Verify: Start a new conversation and ask Claude to search your memory

### Example Conversation

```
You: Search my memory for notes about project architecture.

Claude: I'll search your memory for architecture-related notes.

[Calls mnemosyne_search with query "project architecture"]

I found 3 relevant notes in your memory:

1. "Architecture Decision" (score: 0.85)
   We chose SQLite for local-first storage because...

2. "API Design Patterns" (score: 0.72)
   REST API with JSON-RPC for MCP endpoints...

3. "System Architecture" (score: 0.68)
   The system uses a modular design with...
```

---

## Setup for Cursor

### Configuration

Add to your Cursor MCP settings (**Settings → MCP**):

```json
{
  "mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key-here",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Steps

1. Open Cursor Settings
2. Navigate to the MCP section
3. Click **Add MCP Server**
4. Enter the configuration above
5. Replace `your-api-key-here` with your mnemosyne API key
6. Save and restart Cursor
7. Verify: Open Cursor's AI chat and ask it to search your memory

### Use Cases in Cursor

- **Code context**: Ask Cursor to recall architecture decisions from your memory
- **Documentation**: Search your notes for API specifications
- **Learning**: Store and retrieve coding patterns and best practices
- **Project knowledge**: Keep project-specific knowledge accessible during development

---

## Setup for VS Code

### Using Continue Extension

The [Continue](https://continue.dev/) extension supports MCP servers in VS Code.

Add to your VS Code `settings.json`:

```json
{
  "continue.mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key-here",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Using Cline Extension

Add to your VS Code `settings.json`:

```json
{
  "cline.mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key-here",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Steps

1. Install Continue or Cline extension from VS Code marketplace
2. Open VS Code settings (`Cmd+,` on macOS, `Ctrl+,` on Windows)
3. Search for the extension's MCP server configuration
4. Add the mnemosyne MCP server configuration
5. Replace `your-api-key-here` with your API key
6. Reload VS Code
7. Verify: Use the extension's chat to search your memory

---

## Setup for Windsurf

### Configuration

Add to your Windsurf MCP settings:

```json
{
  "mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key-here",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Steps

1. Open Windsurf Settings
2. Navigate to MCP configuration
3. Add the mnemosyne MCP server entry
4. Replace `your-api-key-here` with your API key
5. Save and restart Windsurf
6. Verify: Start a conversation and test memory access

---

## Available MCP Tools

### `mnemosyne_search`

Search the user's memory for notes matching a query. Returns ranked results with relevance scores.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query to find matching notes |
| `limit` | number | No | Maximum results to return (default: 10) |

**Example:**

```json
{
  "name": "mnemosyne_search",
  "arguments": {
    "query": "machine learning pipeline",
    "limit": 5
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "noteId": "clx123",
      "title": "ML Pipeline Architecture",
      "content": "We use a three-stage pipeline: ingestion, processing, inference...",
      "score": 0.85
    }
  ],
  "searchType": "vector"
}
```

The `searchType` field indicates whether vector-based or keyword-based search was used.

---

### `mnemosyne_add_note`

Add a new note to memory. Notes are automatically linked to existing notes with shared tags.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Title of the note |
| `content` | string | Yes | Content/body of the note |
| `tags` | string[] | No | Tags for categorization |

**Example:**

```json
{
  "name": "mnemosyne_add_note",
  "arguments": {
    "title": "API Rate Limiting Strategy",
    "content": "We decided to implement sliding window rate limiting with Redis...",
    "tags": ["api", "architecture", "performance"]
  }
}
```

**Response:**

```json
{
  "noteId": "clx456",
  "message": "Note \"API Rate Limiting Strategy\" created successfully"
}
```

---

### `mnemosyne_get_note`

Retrieve a specific note by its ID with full content and metadata.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteId` | string | Yes | The unique ID of the note |

**Example:**

```json
{
  "name": "mnemosyne_get_note",
  "arguments": { "noteId": "clx123" }
}
```

**Response:**

```json
{
  "noteId": "clx123",
  "title": "ML Pipeline Architecture",
  "content": "Full content of the note...",
  "markdown": "Full content of the note...",
  "tags": ["ml", "pipeline", "architecture"],
  "isArchived": false,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

### `mnemosyne_list_notes`

List all notes with pagination support.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max notes to return (default: 20) |
| `offset` | number | No | Notes to skip for pagination (default: 0) |

**Example:**

```json
{
  "name": "mnemosyne_list_notes",
  "arguments": { "limit": 10, "offset": 0 }
}
```

**Response:**

```json
{
  "notes": [
    {
      "noteId": "clx123",
      "title": "ML Pipeline Architecture",
      "tags": ["ml", "pipeline"],
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "total": 42
}
```

---

### `mnemosyne_chat`

Chat with your memory. Ask questions and get AI-powered responses grounded in your stored knowledge. Supports multi-turn conversations with RAG (Retrieval-Augmented Generation).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Your message or question |
| `conversationId` | string | No | Conversation ID for multi-turn chat |

**Example:**

```json
{
  "name": "mnemosyne_chat",
  "arguments": {
    "message": "What architecture decisions have we made about the database?"
  }
}
```

**Response:**

```json
{
  "response": "Based on your memory, you chose SQLite for local-first storage because of its reliability, zero-configuration, and excellent performance for single-user workloads. You also considered PostgreSQL but decided it was overkill for the personal use case...",
  "memoryRefs": ["clx123", "clx456"],
  "conversationId": "conv789"
}
```

---

### `mnemosyne_get_related`

Get notes related to a specific note based on shared tags, content similarity, and explicit memory links.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteId` | string | Yes | The note ID to find related notes for |
| `limit` | number | No | Max results (default: 5) |

**Example:**

```json
{
  "name": "mnemosyne_get_related",
  "arguments": { "noteId": "clx123", "limit": 3 }
}
```

**Response:**

```json
{
  "related": [
    {
      "noteId": "clx456",
      "title": "Database Selection",
      "relationScore": 0.75,
      "reason": "Shared tags: architecture, database"
    }
  ]
}
```

---

### `mnemosyne_detect_patterns`

Detect patterns and themes across your memory. Identifies recurring topics, temporal trends, and knowledge clusters.

**Parameters:** None

**Example:**

```json
{
  "name": "mnemosyne_detect_patterns",
  "arguments": {}
}
```

**Response:**

```json
{
  "patterns": [
    "Recurring topic: \"architecture\" appears in 5 note(s)",
    "Common themes in titles: \"database\", \"api\", \"design\"",
    "Average note length: 342 characters across 23 note(s)",
    "Memory contains 23 note(s) across 8 unique tag(s)",
    "3 decision(s) recorded in memory, indicating active decision-tracking behavior"
  ]
}
```

---

### `mnemosyne_add_decision`

Record a decision with full context and reasoning. Decisions are tracked separately from notes for easy retrieval.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Decision title/summary |
| `context` | string | Yes | Situation that led to the decision |
| `decision` | string | Yes | The decision that was made |
| `reasoning` | string | Yes | Rationale behind the decision |

**Example:**

```json
{
  "name": "mnemosyne_add_decision",
  "arguments": {
    "title": "Use SQLite for primary storage",
    "context": "Building a personal AI memory app that needs to work offline",
    "decision": "Use SQLite via Prisma ORM as the primary database",
    "reasoning": "SQLite is serverless, zero-config, works offline, and performs excellently for single-user workloads. Prisma provides type-safe queries and easy migrations."
  }
}
```

**Response:**

```json
{
  "decisionId": "dec789",
  "message": "Decision \"Use SQLite for primary storage\" recorded successfully"
}
```

---

## MCP as API

The mnemosyne MCP server can also serve as a programmatic API endpoint, not just an AI assistant integration. This enables powerful automation patterns:

### Direct Invocation

```bash
# Search memory from the command line
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mnemosyne_search","arguments":{"query":"architecture"}}}' | npx @mnemosyne/mcp-server
```

### Integration Patterns

```
┌──────────────────────────────────────────────────────┐
│              MCP as API Integration                   │
│                                                       │
│  ┌─────────────┐     ┌─────────────┐                │
│  │ CI/CD       │     │ Cron Job    │                │
│  │ Pipeline    │     │ Scheduler   │                │
│  └──────┬──────┘     └──────┬──────┘                │
│         │                   │                        │
│         └───────┬───────────┘                        │
│                 │                                     │
│         ┌───────▼───────┐                            │
│         │  MCP Client   │                            │
│         │  (Custom)     │                            │
│         └───────┬───────┘                            │
│                 │ JSON-RPC 2.0                        │
│         ┌───────▼───────┐                            │
│         │ mnemosyne MCP   │                            │
│         │ Server        │                            │
│         └───────────────┘                            │
└──────────────────────────────────────────────────────┘
```

### Use Cases

1. **Automated Documentation** — CI pipeline adds deployment notes to memory
2. **Incident Tracking** — Monitoring systems record incidents as decisions
3. **Knowledge Base Sync** — External tools sync content into mnemosyne
4. **Data Pipeline** — ETL processes store transformation results in memory
5. **Custom Chatbots** — Build your own AI assistant with mnemosyne as the memory layer

---

## Custom MCP Tools

You can extend the mnemosyne MCP server with custom tools by modifying the `mcp-server/index.ts` file.

### Adding a Custom Tool

1. **Define the tool** in the `TOOLS` array:

```typescript
const TOOLS: ToolDefinition[] = [
  // ... existing tools ...
  {
    name: "mnemosyne_custom_action",
    description: "Perform a custom action on the user's memory.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The action to perform",
        },
        target: {
          type: "string",
          description: "The target of the action",
        },
      },
      required: ["action"],
    },
  },
]
```

2. **Implement the tool handler**:

```typescript
async function toolCustomAction(
  params: Record<string, unknown>
): Promise<unknown> {
  const userId = requireUserId()
  const action = String(params.action || "")
  const target = String(params.target || "")

  // Your custom logic here
  // You have full access to Prisma, the database, and all mnemosyne data

  return {
    success: true,
    message: `Action "${action}" performed on "${target}"`,
  }
}
```

3. **Register the handler** in the `toolHandlers` map:

```typescript
const toolHandlers: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  // ... existing handlers ...
  mnemosyne_custom_action: toolCustomAction,
}
```

### Tool Development Guidelines

- Always call `requireUserId()` first to ensure authentication
- Validate all input parameters before processing
- Return structured JSON objects, not plain strings
- Include meaningful error messages in the response
- Use Prisma for all database operations
- Follow the existing naming convention: `mnemosyne_<action>`

---

## Troubleshooting

### Common Issues

#### 1. MCP Server Not Connecting

**Symptoms:** The AI assistant cannot find or connect to the mnemosyne MCP server.

**Solutions:**
- Verify `npx` is available in your PATH
- Check that the command path is correct: `npx -y @mnemosyne/mcp-server`
- Ensure Node.js 18+ is installed
- Try running the server manually: `npx @mnemosyne/mcp-server`

#### 2. Authentication Errors

**Symptoms:** `Authentication required` or `Invalid mnemosyne_API_KEY` errors.

**Solutions:**
- Verify the API key in the `env` configuration
- Check that the key exists in the mnemosyne database (`ApiKey` table)
- For local development, use the `--allow-open` flag (never in production!)
- Ensure the API key hasn't been revoked

#### 3. Empty Search Results

**Symptoms:** `mnemosyne_search` returns no results even when notes exist.

**Solutions:**
- Check that the user has notes in the database
- Verify the `DATABASE_URL` points to the correct database file
- Ensure embeddings exist in the `NoteChunk` table
- Try broader search queries
- Check that notes are not archived (`isArchived: false`)

#### 4. Database Not Found

**Symptoms:** `Cannot find database` or `Prisma client not generated`.

**Solutions:**
```bash
cd mcp-server
bun install
bun run db:generate   # Generate Prisma client
bun run db:push       # Create database tables
```

#### 5. npx Timeout

**Symptoms:** First connection times out while npx downloads the package.

**Solutions:**
- Install globally first: `npm install -g @mnemosyne/mcp-server`
- Use the global command in the config: `"command": "mnemosyne-mcp"`
- Or use the `-y` flag: `npx -y @mnemosyne/mcp-server`

#### 6. Claude Desktop Not Recognizing Tools

**Symptoms:** Claude doesn't show mnemosyne tools after configuration.

**Solutions:**
- Restart Claude Desktop completely (quit, not just close window)
- Check the config file path is correct for your OS
- Validate the JSON syntax in the config file
- Check Claude Desktop logs for MCP connection errors

#### 7. Multiple MCP Sessions

**Symptoms:** Performance degradation with multiple AI assistants connected.

**Solutions:**
- Each client creates its own `McpSession` record
- Old sessions are not automatically cleaned up
- Use a cron job to clean stale sessions:
  ```sql
  DELETE FROM "McpSession" WHERE "createdAt" < datetime('now', '-1 day');
  ```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `mnemosyne_API_KEY` | No* | *(none)* | API key for authentication. Required in production. |
| `DATABASE_URL` | No | `file:../db/mnemosyne.db` | Prisma database connection string. SQLite by default. |
| `EMBEDDING_API_URL` | No | *(none)* | External embedding API URL for vector search. |
| `EMBEDDING_API_KEY` | No | *(none)* | API key for the embedding service. |
| `EMBEDDING_MODEL` | No | `nomic-embed-text` | Model name for embedding generation. |
| `EMBEDDING_DIMENSION` | No | `768` | Embedding vector dimension size. |
| `NODE_ENV` | No | `development` | Environment mode. Production requires `mnemosyne_API_KEY`. |

### Security Configuration Matrix

| `NODE_ENV` | `mnemosyne_API_KEY` | `--allow-open` | Behavior |
|------------|-------------------|-----------------|----------|
| development | Set | — | API key validated against database |
| development | Not set | Not set | **Refuses to start** (requires explicit opt-in) |
| development | Not set | Set | Open mode (first user's data, with warning) |
| production | Set | — | API key validated against database |
| production | Not set | — | **Refuses to start** (security requirement) |
| production | Not set | Set | **Refuses to start** (production blocks open mode) |

### Database URL Formats

| Database | URL Format |
|----------|-----------|
| SQLite (relative) | `file:./mnemosyne.db` |
| SQLite (absolute) | `file:/home/user/mnemosyne/db/mnemosyne.db` |
| PostgreSQL | `postgresql://user:pass@localhost:5432/mnemosyne` |

### Running from Source

```bash
# Clone and setup
git clone https://github.com/mulkymalikuldhrs/mnemosyne.git
cd mnemosyne/mcp-server

# Install dependencies
bun install

# Generate Prisma client
bun run db:generate

# Create database tables
bun run db:push

# Run in development mode
bun run dev

# Run in production
bun start

# Run with open mode (development only)
bun run mcp-server/index.ts --allow-open
```

---

*mnemosyne v4.0 — The Biggest Free Multi-LLM Hub. MCP for AI assistant memory integration.*
