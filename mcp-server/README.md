# mnemosyne MCP Server

> AI Memory Integration for AI Assistants — Give your AI assistant a persistent, searchable memory.

mnemosyne MCP Server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) to let AI assistants like **Claude**, **GPT**, **Cursor**, and any MCP-compatible client store, search, and interact with a personal knowledge base. Think of it as giving your AI a long-term memory that persists across conversations.

---

## ✨ What It Does

- **Search** your memory with semantic-aware text matching
- **Add notes** with titles, content, and tags — auto-linked to related notes
- **Retrieve** specific notes or list your entire memory
- **Chat** with your memory — get grounded responses referencing stored knowledge
- **Discover related notes** via tag overlap and explicit relations
- **Detect patterns** across your knowledge base (recurring topics, themes, clusters)
- **Record decisions** with full context and reasoning for future reference

All data is stored locally in SQLite via Prisma ORM — no cloud dependencies required.

---

## 🚀 Installation

### Option 1: Run directly with npx (Recommended)

```bash
npx @mnemosyne/mcp-server
```

### Option 2: Install globally

```bash
npm install -g @mnemosyne/mcp-server
mnemosyne-mcp
```

### Option 3: Install locally in a project

```bash
npm install @mnemosyne/mcp-server
npx mnemosyne-mcp
```

### Option 4: From source

```bash
git clone https://github.com/mulkymalikuldhrs/mnemosyne.git
cd mnemosyne/mcp-server
bun install
bun run db:push    # Create database tables
bun start          # Start the MCP server
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `mnemosyne_API_KEY` | No | *(none)* | API key for authentication. If not set, the server runs in open mode (no auth). |
| `DATABASE_URL` | No | `file:../db/mnemosyne.db` | Prisma database connection string. Uses SQLite by default. |

### Claude Desktop Configuration

Add the following to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Cursor Configuration

Add to your Cursor MCP settings (Settings → MCP):

```json
{
  "mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Windsurf Configuration

Add to your Windsurf MCP settings:

```json
{
  "mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Cline / VS Code Extension Configuration

Add to your VS Code `settings.json`:

```json
{
  "cline.mcpServers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

### Zed Editor Configuration

Add to your Zed `settings.json`:

```json
{
  "context_servers": {
    "mnemosyne": {
      "command": "npx",
      "args": ["-y", "@mnemosyne/mcp-server"],
      "env": {
        "mnemosyne_API_KEY": "your-api-key",
        "DATABASE_URL": "file:./mnemosyne.db"
      }
    }
  }
}
```

---

## 🛠️ Available Tools

### `mnemosyne_search`

Search the user's memory for notes matching a query. Returns ranked results with relevance scores.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | The search query |
| `limit` | number | ❌ | Max results (default: 10) |

**Output:**

```json
{
  "results": [
    {
      "noteId": "clx...",
      "title": "Architecture Decision",
      "content": "We chose SQLite for...",
      "score": 0.85
    }
  ]
}
```

---

### `mnemosyne_add_note`

Add a new note to memory. Notes are auto-linked to existing notes with shared tags.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | ✅ | Note title |
| `content` | string | ✅ | Note content |
| `tags` | string[] | ❌ | Tags for categorization |

**Output:**

```json
{
  "noteId": "clx...",
  "message": "Note \"Architecture Decision\" created successfully"
}
```

---

### `mnemosyne_get_note`

Retrieve a specific note by ID with full content and metadata.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteId` | string | ✅ | The note ID |

**Output:**

```json
{
  "noteId": "clx...",
  "title": "Architecture Decision",
  "content": "We chose SQLite for...",
  "tags": ["architecture", "database"],
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

---

### `mnemosyne_list_notes`

List all notes with pagination support.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | ❌ | Max notes to return (default: 20) |
| `offset` | number | ❌ | Notes to skip for pagination (default: 0) |

**Output:**

```json
{
  "notes": [
    {
      "noteId": "clx...",
      "title": "Architecture Decision",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "total": 42
}
```

---

### `mnemosyne_chat`

Chat with your memory. Ask questions and get AI-powered responses grounded in your stored knowledge. Supports multi-turn conversations.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | ✅ | Your message or question |
| `conversationId` | string | ❌ | Conversation ID for multi-turn chat |

**Output:**

```json
{
  "response": "Based on your memory, here's what I found:\n\n- \"Architecture Decision\"...",
  "memoryRefs": ["clx1...", "clx2..."],
  "conversationId": "clx..."
}
```

---

### `mnemosyne_get_related`

Get notes related to a specific note based on shared tags, content similarity, and explicit relations.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteId` | string | ✅ | The note to find relations for |
| `limit` | number | ❌ | Max results (default: 5) |

**Output:**

```json
{
  "related": [
    {
      "noteId": "clx...",
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

**Input:** *(none)*

**Output:**

```json
{
  "patterns": [
    "Recurring topic: \"architecture\" appears in 5 note(s)",
    "Common themes in titles: \"database\", \"api\", \"design\"",
    "Average note length: 342 characters across 23 note(s)",
    "Memory contains 23 note(s) across 8 unique tag(s)"
  ]
}
```

---

### `mnemosyne_add_decision`

Record a decision with full context and reasoning. Decisions are tracked separately from notes for easy retrieval.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | ✅ | Decision title/summary |
| `context` | string | ✅ | Situation that led to the decision |
| `decision` | string | ✅ | The decision that was made |
| `reasoning` | string | ✅ | Rationale behind the decision |

**Output:**

```json
{
  "decisionId": "clx...",
  "message": "Decision \"Use SQLite\" recorded successfully"
}
```

---

## 🏗️ Architecture

```
AI Assistant (Claude/GPT/Cursor)
        │
        │ JSON-RPC 2.0 over stdio
        ▼
┌──────────────────────────┐
│   mnemosyne MCP Server     │
│                          │
│  ┌────────────────────┐  │
│  │  MCP Protocol      │  │
│  │  - initialize      │  │
│  │  - tools/list      │  │
│  │  - tools/call      │  │
│  └────────┬───────────┘  │
│           │              │
│  ┌────────▼───────────┐  │
│  │  Tool Handlers     │  │
│  │  - search          │  │
│  │  - add_note        │  │
│  │  - get_note        │  │
│  │  - list_notes      │  │
│  │  - chat            │  │
│  │  - get_related     │  │
│  │  - detect_patterns │  │
│  │  - add_decision    │  │
│  └────────┬───────────┘  │
│           │              │
│  ┌────────▼───────────┐  │
│  │  Prisma ORM        │  │
│  │  (SQLite)          │  │
│  └────────┬───────────┘  │
│           │              │
└───────────┼──────────────┘
            │
     ┌──────▼──────┐
     │  mnemosyne.db  │
     │  (SQLite)    │
     └─────────────┘
```

### Database Models

| Model | Purpose |
|-------|---------|
| `Note` | Core memory entries with title, content, and tags |
| `NoteRelation` | Bidirectional relationships between notes |
| `Decision` | Recorded decisions with context and reasoning |
| `Conversation` | Multi-turn chat sessions |
| `Pattern` | Detected patterns for future reference |
| `ApiKey` | API key authentication records |

---

## 🔧 Development

```bash
# Install dependencies
bun install

# Generate Prisma client
bun run db:generate

# Create database tables
bun run db:push

# Run in development mode (auto-restart)
bun run dev

# Run in production
bun run start
```

---

## 🔐 Security

- **API Key Authentication**: Set `mnemosyne_API_KEY` to require authentication. Without it, the server runs in open mode (suitable for local development).
- **Local Storage**: All data is stored locally in SQLite. No data is sent to external services.
- **Stdio Transport**: Communication happens only over stdin/stdout, ensuring no network exposure.

---

## 📄 License

MIT © Mulky Malikul Dhaher

---

## 🔗 Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [mnemosyne GitHub](https://github.com/mulkymalikuldhrs/mnemosyne)
- [Report Issues](https://github.com/mulkymalikuldhrs/mnemosyne/issues)
