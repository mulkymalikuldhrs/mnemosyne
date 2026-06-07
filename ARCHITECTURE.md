# Mnemosyne v4.0 — Architecture

> System architecture documentation for mnemosyne, the world's biggest free multi-LLM hub.

---

## Table of Contents

- [System Overview](#system-overview)
- [Design Principles](#design-principles)
- [Architecture Diagram](#architecture-diagram)
- [Client Layer](#client-layer)
- [API Layer](#api-layer)
- [Core Services](#core-services)
- [LLM Router Architecture](#llm-router-architecture)
- [AI Agent System](#ai-agent-system)
- [Memory Engine](#memory-engine)
- [MCP Server Architecture](#mcp-server-architecture)
- [Multi-Cloud Storage Architecture](#multi-cloud-storage-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Performance Considerations](#performance-considerations)

---

## System Overview

mnemosyne v4.0 is the world's biggest free multi-LLM hub — a full-stack Next.js 16 application that provides free access to 500+ AI models via Puter.js, alongside BYOK (Bring Your Own Key) support, a built-in AI Agent with tool execution, semantic memory with RAG, an MCP server for AI assistant integration, and multi-cloud storage with file ingestion.

The core innovation is the **LLM Router**: a unified interface that automatically routes chat requests to the best available provider — Puter.js (free, 500+ models, zero API key) first, then BYOK (user's own API keys) as fallback. This makes mnemosyne a **middle provider** — portable yet powerful, SaaS/IaaS ready.

---

## Design Principles

1. **Free First** — Puter.js provides 500+ models at zero cost. The default experience requires no API keys, no credit cards, no backend.
2. **Portable** — Runs entirely on SQLite + Prisma. Deploy anywhere: Docker, Vercel, bare metal, Raspberry Pi.
3. **Middle Provider** — mnemosyne sits between end-users and LLM providers. It wraps everything into a unified API, making it SaaS/IaaS ready out of the box.
4. **Agent-Native** — The built-in AI Agent can use any LLM from the pool and execute tools against your memory, notes, decisions, and the web.
5. **Memory-First** — Every note is chunked, embedded, and indexed. RAG injects your memories into conversations. The knowledge graph connects ideas automatically.
6. **Type-Safe** — TypeScript strict mode throughout. Zod validation on critical routes. Prisma for type-safe database access.

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                    mnemosyne v4.0 — Multi-LLM Hub                       │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─── Client Layer ─────────────────────────────────────────────┐    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │  Web UI PWA  │  │  MCP Clients │  │ API Consumers │       │    │
│  │  │  (React/SSR) │  │(Claude/Cursor)│  │  (SaaS/IaaS) │       │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │    │
│  └─────────┼─────────────────┼─────────────────┼────────────────┘    │
│            │                 │                 │                      │
│  ┌─── API Layer ─────────────────────────────────────────────────┐   │
│  │                    REST + SSE + MCP                             │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │   │
│  │  │ LLM  │ │Agent │ │Notes │ │Chat  │ │Search│ │ Storage  │  │   │
│  │  │ API  │ │ API  │ │ API  │ │ API  │ │ API  │ │   API    │  │   │
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └────┬─────┘  │   │
│  └─────┼────────┼────────┼────────┼────────┼───────────┼─────────┘   │
│        │        │        │        │        │           │             │
│  ┌─── Core Services ─────────────────────────────────────────────┐   │
│  │                                                                │   │
│  │  ┌─────────────────┐  ┌──────────────────┐                    │   │
│  │  │   LLM Router    │  │   Agent Engine   │                    │   │
│  │  │  ┌────────────┐ │  │  ┌─────────────┐ │                    │   │
│  │  │  │ Auto-Route │ │  │  │Tool Registry│ │                    │   │
│  │  │  │ Puter→BYOK │ │  │  │ Exec Loop   │ │                    │   │
│  │  │  └────────────┘ │  │  └─────────────┘ │                    │   │
│  │  └────────┬────────┘  └──────────────────┘                    │   │
│  │           │                                                     │   │
│  │  ┌────────▼──────────────────────────────────────────────┐    │   │
│  │  │                Provider Layer                          │    │   │
│  │  │  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │    │   │
│  │  │  │ Puter.js │  │   BYOK    │  │  Local/Ollama    │   │    │   │
│  │  │  │  FREE    │  │ Providers │  │  localhost       │   │    │   │
│  │  │  │ 500+ mdl │  │ 7 provs   │  │  any model      │   │    │   │
│  │  │  └──────────┘  └───────────┘  └──────────────────┘   │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  │                                                                │   │
│  │  ┌──────────────────────┐  ┌───────────────────────────────┐  │   │
│  │  │    Memory Engine     │  │      Storage Manager          │  │   │
│  │  │  Chunker·Embedder   │  │  Google Drive·TeraBox·S3     │  │   │
│  │  │  Search·RAG·Graph   │  │  Puter.js FS·Local           │  │   │
│  │  │  Patterns·Related   │  │  Sync·Ingest·Search          │  │   │
│  │  └──────────────────────┘  └───────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│           │                                                           │
│  ┌─── Data Layer ─────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │              SQLite + Prisma ORM                         │  │   │
│  │  │  Notes · NoteChunks(Vectors) · MemoryLinks · Convs      │  │   │
│  │  │  Messages · Decisions · ApiKeys · McpSessions            │  │   │
│  │  │  CloudStorageAccounts · CloudFiles · Entities            │  │   │
│  │  │  Templates · SmartTags · DailyNotes · Favorites          │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │              Puter.js Cloud Storage                      │  │   │
│  │  │  FS (read/write/delete) · KV Store · Auth               │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Client Layer

The client layer encompasses all interfaces through which users and systems interact with mnemosyne:

| Client | Transport | Purpose |
|--------|-----------|---------|
| **Web UI (PWA)** | HTTPS (REST + SSE) | Full dashboard with LLM Marketplace, Agent Chat, Notes, Memory, Search, Settings |
| **MCP Clients** | Stdio (JSON-RPC 2.0) | Claude Desktop, Cursor, Windsurf, and other MCP-compatible AI assistants |
| **API Consumers** | HTTPS (REST) | External applications consuming mnemosyne as a SaaS/IaaS LLM provider |

---

## API Layer

All API endpoints are implemented as Next.js App Router route handlers under `src/app/api/`. The layer provides three transport mechanisms:

### REST API

Standard request/response endpoints for all CRUD operations and LLM interactions. All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### Server-Sent Events (SSE)

Streaming transport for LLM chat completions. The `/api/llm/chat` endpoint returns `text/event-stream` when `stream: true` is specified:

```
data: {"content":"Hello"}
data: {"content":" world"}
data: [DONE]
```

### MCP Transport

The `/api/mcp/transport` endpoint provides a JSON-RPC 2.0 bridge for HTTP-based MCP clients. The standalone MCP server uses stdio transport directly.

---

## Core Services

Core services are the business logic layer between the API routes and the data layer:

| Service | Module | Responsibility |
|---------|--------|---------------|
| **LLM Router** | `src/lib/llm/index.ts` | Auto-routes chat requests to Puter.js (free) or BYOK |
| **Agent Engine** | `src/lib/agent/index.ts` | Executes agentic loops with tool calling |
| **Memory Engine** | `src/ai/memory.ts` | Chunking, embedding, search, RAG, patterns, relations |
| **Storage Manager** | `src/lib/storage/index.ts` | Multi-cloud storage orchestration |
| **Email Manager** | `src/lib/email/index.ts` | Gmail and IMAP integration |
| **Auth** | `src/lib/auth.ts` | NextAuth.js session management |
| **Rate Limiter** | `src/lib/rate-limit.ts` | In-memory request throttling |
| **Error Reporter** | `src/lib/error-reporter.ts` | Structured error logging |

---

## LLM Router Architecture

The LLM Router is the core of mnemosyne as a multi-LLM middle provider. It provides a single interface that automatically routes to the best available provider:

```
┌───────────────────────────────────────────────────────────┐
│                      LLM Router                           │
│                                                           │
│  chat(config, messages)                                   │
│       │                                                   │
│       ├── model.isFree || provider === 'puter'?           │
│       │       │                                           │
│       │       ▼ YES                                       │
│       │   ┌──────────────────┐                            │
│       │   │  Puter.js FREE   │  500+ models, zero key     │
│       │   │  puterChat()     │  client-side auth           │
│       │   └──────────────────┘                            │
│       │                                                   │
│       ├── BYOK provider specified?                        │
│       │       │                                           │
│       │       ▼ YES                                       │
│       │   ┌──────────────────┐                            │
│       │   │   BYOK Provider  │  OpenAI · Anthropic ·      │
│       │   │   byokChat()     │  Google · DeepSeek ·       │
│       │   └──────────────────┘  OpenRouter · Ollama       │
│       │                                                   │
│       └── Default: Try Puter.js first, BYOK fallback      │
│               │                                           │
│               ├── puterChat() ── success ──► return        │
│               └── puterChat() ── error                    │
│                       │                                   │
│                       ├── apiKey provided?                │
│                       │       │                           │
│                       │       ▼ YES                       │
│                       │   byokChat() ──► return           │
│                       │                                   │
│                       └── throw "No provider available"   │
│                                                           │
│  stream(config, messages)  ── same routing logic          │
│  compare(prompt, models)   ── parallel across models      │
│  getModels()               ── MODEL_REGISTRY              │
│  getFreeModels()           ── filtered by isFree          │
│  searchModels(query)       ── name/provider/capability    │
└───────────────────────────────────────────────────────────┘
```

### Model Registry

The model registry (`src/lib/llm/providers.ts`) contains 20+ curated models across 8 providers:

| Provider | Free Models | BYOK Models | Local Models |
|----------|-------------|-------------|-------------|
| OpenAI | GPT-5.5 Pro, GPT-5.4, GPT-5.4 Mini, GPT-5.4 Nano, GPT-4o, O3, O4 Mini | GPT-4o (BYOK) | — |
| Anthropic | Claude Opus 4.8, Claude Opus 4.8 Fast, Claude Sonnet 4.6 | Claude Opus (BYOK) | — |
| Google | Gemini 3.1 Pro, Gemini 3.1 Flash | Gemini Pro (BYOK) | — |
| DeepSeek | DeepSeek R1, DeepSeek Chat | DeepSeek Chat (BYOK) | — |
| xAI | Grok 3 | — | — |
| Meta | Llama 4 Maverick | — | — |
| Mistral | Mistral Large | — | — |
| Alibaba | Qwen 3.7 Plus, Qwen 3.7 Max | — | — |
| OpenRouter | — | OpenRouter Auto | — |
| Ollama | — | — | Llama 3, Mistral, CodeLlama |

### Auto-Routing Decision Tree

1. If `model.isFree === true` or `config.provider === 'puter'` → route to Puter.js
2. If a BYOK provider is explicitly specified → route to BYOK
3. Default: try Puter.js first; on failure, fall back to BYOK if `config.apiKey` is provided
4. If no provider is available → throw error

---

## AI Agent System

The AI Agent is a built-in autonomous agent that can use any LLM from the pool and execute tools against the user's data. See [AGENTS.md](AGENTS.md) for full documentation.

```
┌───────────────────────────────────────────────────────────┐
│                    Agent Engine                           │
│                                                           │
│  AgentEngine.run(userMessage)                             │
│       │                                                   │
│       ▼                                                   │
│  ┌──────────────────────────────────────────────────┐     │
│  │ 1. Build messages with systemPrompt              │     │
│  │ 2. Call LLMRouter.chat() with tools              │     │
│  │ 3. Check response for toolCalls                  │     │
│  │    ├── Tool calls? → Execute each tool           │     │
│  │    │   ├── Find tool in TOOL_REGISTRY            │     │
│  │    │   ├── tool.execute(args, context)            │     │
│  │    │   └── Append tool result to messages         │     │
│  │    └── No tool calls? → Return final response    │     │
│  │ 4. Repeat until maxIterations or final answer    │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  Built-in Tools:                                          │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │memory_search│ │ memory_save  │ │memory_update │       │
│  └─────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │memory_delete │ │memory_insights│ │ web_search   │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│  ┌──────────────┐                                        │
│  │decision_track│                                        │
│  └──────────────┘                                        │
└───────────────────────────────────────────────────────────┘
```

---

## Memory Engine

The Memory Engine (`src/ai/memory.ts`) provides the semantic memory capabilities that power mnemosyne's "second brain" functionality:

### Pipeline

```
Note Content
     │
     ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Chunker  │────►│ Embedder │────►│ Storage  │
│ (Split)  │     │ (Vector) │     │ (SQLite) │
└──────────┘     └──────────┘     └──────────┘
                                        │
                    ┌───────────────────┤
                    │                   │
                    ▼                   ▼
             ┌──────────┐       ┌──────────┐
             │  Search  │       │   RAG    │
             │(Semantic)│       │(Context) │
             └──────────┘       └──────────┘
                    │                   │
                    ▼                   ▼
             ┌──────────┐       ┌──────────┐
             │ Related  │       │ Patterns │
             │ (Graph)  │       │(Insights)│
             └──────────┘       └──────────┘
```

### Components

| Component | Module | Function |
|-----------|--------|----------|
| **Chunker** | `src/ai/chunker.ts` | Splits text into paragraphs → sentences → words with token counting |
| **Embedder** | `src/ai/embedder.ts` | Generates vector embeddings via API or pseudo-embedding fallback |
| **Memory Engine** | `src/ai/memory.ts` | Stores, searches, relates, and detects patterns in notes |
| **LLM** | `src/ai/llm.ts` | RAG-powered chat that injects memory context into conversations |

### Search Flow

1. User sends search query
2. Embedder generates vector for the query
3. System compares against all NoteChunk embeddings (cosine similarity)
4. Results ranked by similarity score, grouped by note
5. Fallback: keyword-based scoring if vector search returns no results

### RAG Flow

1. User sends chat message
2. Memory Engine searches for relevant notes (vector + keyword)
3. Top-k relevant notes are injected into the LLM system prompt
4. LLM generates response grounded in the user's memories
5. Conversation is persisted with memory references

---

## MCP Server Architecture

The MCP Server is a standalone JSON-RPC 2.0 server that allows AI assistants (Claude, Cursor, etc.) to interact with mnemosyne's memory system:

```
┌─────────────────────────────────────────────────────┐
│                  MCP Server                          │
│                                                      │
│  Transport: Stdio (stdin/stdout)                     │
│  Protocol:  JSON-RPC 2.0                            │
│  Auth:      API Key (mnemosyne_API_KEY env var)       │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │            Tool Implementations             │     │
│  │                                             │     │
│  │  mnemosyne_search     → Vector + Keyword      │     │
│  │  mnemosyne_add_note   → Create + Auto-link    │     │
│  │  mnemosyne_get_note   → Read + Metadata       │     │
│  │  mnemosyne_list_notes → Paginated listing     │     │
│  │  mnemosyne_chat       → RAG-powered chat      │     │
│  │  mnemosyne_get_related→ Links + Tag matching  │     │
│  │  mnemosyne_detect_patterns → Tag/keyword/time │     │
│  │  mnemosyne_add_decision → Context + Reasoning │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │              Shared Database                │     │
│  │  Same Prisma schema as the main app        │     │
│  │  Models: Note, NoteChunk, MemoryLink,      │     │
│  │  Conversation, Message, Decision, ApiKey    │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Entry: mcp-server/index.ts                         │
│  CLI:  npx mnemosyne-mcp                              │
└─────────────────────────────────────────────────────┘
```

### Authentication Flow

1. On startup, `mnemosyne_API_KEY` is validated against the `ApiKey` database table
2. An `McpSession` record is created for audit purposes
3. All tool operations are scoped to the authenticated user's data
4. In development mode, `--allow-open` flag enables unauthenticated access (first user)

### Embedding Compatibility

The MCP server uses the same n-gram hashing approach as the main app's embedder to ensure compatibility with stored NoteChunk embeddings. It also supports external embedding APIs via `EMBEDDING_API_URL`.

---

## Multi-Cloud Storage Architecture

The Storage Manager (`src/lib/storage/index.ts`) orchestrates multiple cloud storage providers for file synchronization and content ingestion:

```
┌───────────────────────────────────────────────────────┐
│                 Storage Manager                        │
│                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Google Drive │ │   TeraBox    │ │  S3-Compatible│  │
│  │   Provider   │ │   Provider   │ │   Provider    │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
│         │                │                │           │
│  ┌──────┴────────────────┴────────────────┘          │
│  │           CloudStorageProviderInterface            │
│  │  authenticate() · listFiles() · searchFiles()     │
│  │  downloadFile() · getAuthenticatedProvider()      │
│  └──────────────────────────────────────────────────┘│
│         │                                              │
│  ┌──────┴──────────────────────────────────────────┐  │
│  │              Storage Operations                   │  │
│  │  addAccount() · removeAccount() · listAccounts() │  │
│  │  syncAccount() · ingestFile() · searchAllFiles() │  │
│  └──────────────────────────────────────────────────┘  │
│         │                                              │
│  ┌──────┴──────┐                                      │
│  │   Local     │   Puter.js FS (via puter-provider)   │
│  │  Provider   │   read/write/delete + KV store       │
│  └─────────────┘                                      │
└───────────────────────────────────────────────────────┘
```

### Ingestion Pipeline

When a cloud file is ingested into memory:

1. **Download** — File content is downloaded from the provider
2. **Extract** — Text is extracted based on MIME type (text, CSV, JSON, PDF, Office docs)
3. **Create Note** — A Note record is created with the extracted text and metadata
4. **Chunk** — Text is split into manageable chunks by the Chunker
5. **Embed** — Each chunk is embedded via the Embedder
6. **Store** — NoteChunk records are stored with embedding vectors

### Supported Providers

| Provider | Auth Method | Capabilities |
|----------|------------|-------------|
| Google Drive | OAuth2 (access + refresh token) | List, download, search |
| TeraBox | Cookie-based | List, download, search |
| S3-Compatible | Access key + secret key | List, download, search |
| Local | Root path | List, read, search |
| Puter.js FS | Puter.js session | Read, write, delete, list directory |

---

## Frontend Architecture

### Component Hierarchy

```
Layout (layout.tsx)
├── ThemeProvider (next-themes)
├── QueryClientProvider (TanStack Query)
├── AppLayout
│   ├── Sidebar
│   │   ├── Brand header ("mnemosyne")
│   │   ├── Navigation sections
│   │   │   ├── LLM Marketplace
│   │   │   ├── Agent Chat
│   │   │   ├── Notes
│   │   │   ├── Memory
│   │   │   ├── Search
│   │   │   ├── Decisions
│   │   │   ├── Knowledge Graph
│   │   │   ├── Daily Notes
│   │   │   ├── Canvas
│   │   │   ├── Templates
│   │   │   ├── Storage
│   │   │   ├── Settings
│   │   │   └── API Hub
│   │   └── Version badge (v4.0.0)
│   ├── Header (active section title + actions)
│   └── Content Area
│       ├── LLM Marketplace (model cards, chat)
│       ├── Agent Chat (agent execution panel)
│       ├── NoteEditor (TipTap rich editor)
│       ├── NotesList + NoteCard
│       ├── MemoryInsights
│       ├── SemanticSearch
│       ├── KnowledgeGraph (D3 force-directed)
│       ├── CanvasView
│       └── Settings (API keys, BYOK config)
├── QuickSwitcher (Cmd+K)
├── KeyboardShortcuts
└── PWARegister
```

### State Management

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Client State | Zustand | Active section, UI toggles, local preferences, BYOK keys |
| Server State | TanStack Query | API data fetching, caching, background refetch |
| Form State | React Hook Form + Zod | Settings forms, note creation |
| Toast State | Sonner | User notifications and feedback |

### Data Fetching Pattern

```
Component → TanStack Query → API Route → Service Layer → Prisma → SQLite
                ↓ (cache)                                    ↑
          Background Refetch                          SSE Stream
```

---

## Backend Architecture

### Route Handler Pattern

Each API route follows a consistent pattern:

```typescript
export async function POST(request: NextRequest) {
  // 1. Parse and validate input
  const body = await request.json()

  // 2. Auth check (session or API key)
  const session = await getServerSession(authOptions)

  // 3. Business logic via service layer
  const result = await service.doSomething(body)

  // 4. Return structured response
  return NextResponse.json({ success: true, data: result })
}
```

### Route Structure

```
src/app/api/
├── llm/                    # Multi-LLM Hub APIs
│   ├── chat/route.ts       # Universal chat (Puter.js + BYOK)
│   ├── agent/route.ts      # AI agent execution
│   ├── compare/route.ts    # Multi-model comparison
│   ├── models/route.ts     # Model registry
│   └── web-search/route.ts # Web search
├── auth/                   # Authentication
├── notes/                  # Notes CRUD
├── chat/                   # Chat with memory
├── search/                 # Semantic search
├── memory/                 # Memory context, patterns, related
├── decisions/              # Decision tracking
├── settings/               # User settings
├── api-keys/               # API key management
├── storage/                # Multi-cloud storage
├── agents/                 # Agent configuration
├── entities/               # Entity management
├── graph/                  # Knowledge graph
├── canvas/                 # Canvas views
├── daily-notes/            # Daily notes
├── email/                  # Email integration
├── templates/              # Note templates
├── integrations/           # Third-party integrations
├── smart-tags/             # Smart tag suggestions
├── favorites/              # Favorite notes
├── wiki-links/             # Wiki link resolution
├── subscription/           # Subscription management
├── ai-memory/              # AI memory CRUD
└── health/                 # Health check
```

---

## Security Architecture

```
┌──────────────────────────────────────────────────┐
│              Security Layers                       │
│                                                    │
│  ┌──────────────────────────────────────────────┐│
│  │  Layer 1: Network (Caddy Reverse Proxy)      ││
│  │  HTTPS · Rate Limiting · CORS                ││
│  └──────────────────────────────────────────────┘│
│                                                    │
│  ┌──────────────────────────────────────────────┐│
│  │  Layer 2: Authentication                     ││
│  │  NextAuth Session · API Key (mx_ prefix)     ││
│  │  MCP: mnemosyne_API_KEY validation             ││
│  └──────────────────────────────────────────────┘│
│                                                    │
│  ┌──────────────────────────────────────────────┐│
│  │  Layer 3: Input Validation (Zod)             ││
│  │  Schema validation on all POST/PUT routes    ││
│  └──────────────────────────────────────────────┘│
│                                                    │
│  ┌──────────────────────────────────────────────┐│
│  │  Layer 4: Rate Limiting                      ││
│  │  In-memory sliding window (100 req/min)      ││
│  │  Redis (Upstash) for production              ││
│  └──────────────────────────────────────────────┘│
│                                                    │
│  ┌──────────────────────────────────────────────┐│
│  │  Layer 5: Security Headers (Middleware)       ││
│  │  X-Frame-Options · CSP · HSTS               ││
│  └──────────────────────────────────────────────┘│
│                                                    │
│  ┌──────────────────────────────────────────────┐│
│  │  Layer 6: Database (Prisma)                  ││
│  │  Parameterized queries · No raw SQL          ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### Security Measures

| Measure | Implementation | Scope |
|---------|---------------|-------|
| Session Auth | NextAuth.js JWT sessions | All protected routes |
| API Key Auth | `mx_` prefix, hashed in DB | MCP, API endpoints |
| MCP Auth | Environment variable validation | MCP server startup |
| Input Validation | Zod schemas on POST/PUT | All mutation endpoints |
| SQL Injection | Prisma parameterized queries | All database access |
| XSS | React auto-escaping, CSP headers | Frontend rendering |
| CSRF | Same-site cookies | State-changing requests |
| Rate Limiting | In-memory / Upstash Redis | All API routes |
| CORS | Configurable origins | Middleware |

---

## Deployment Architecture

### Docker (Recommended)

```
┌──────────────────────────────────────────────┐
│            Docker Compose                     │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  App Service (Next.js)                  │ │
│  │  Port 3000 · Standalone output          │ │
│  │  SQLite volume: /app/data               │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  MCP Service (Bun)                      │ │
│  │  Port 4000 · Stdio + SSE               │ │
│  │  Shared SQLite volume: /app/data        │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  Volume: mnemosyne-data → /app/data            │
└──────────────────────────────────────────────┘
```

### Vercel

```
Developer → git push → GitHub → Vercel (auto-deploy)
                                  │
                                  └── PostgreSQL (required for Vercel)
                                      Turso (managed SQLite alternative)
```

### Standalone

```
Developer → bun run build → .next/standalone/
                              │
                              └── Node.js / Bun server
                                  │
                                  ├── SQLite (local file)
                                  └── Caddy (reverse proxy + HTTPS)
```

### Platform Matrix

| Platform | Runtime | Database | LLM Access |
|----------|---------|----------|-----------|
| Docker | Node.js (standalone) | SQLite (volume) | Puter.js + BYOK |
| Vercel | Serverless Functions | PostgreSQL / Turso | Puter.js + BYOK |
| Standalone | Node.js / Bun | SQLite (local) | Puter.js + BYOK |
| Local Dev | `next dev` | SQLite (dev.db) | Puter.js + BYOK |

---

## Performance Considerations

### Database

- **Indexes** on `userId`, `status`, `type`, `createdAt` fields across all models
- **N+1 Prevention** using Prisma `include` for eager loading
- **Connection Pooling** via Prisma client singleton
- **SQLite WAL Mode** for concurrent read/write performance

### Frontend

- **Code Splitting** via Next.js App Router (each section loads independently)
- **TanStack Query Caching** reduces redundant API calls
- **Skeleton Loading** prevents layout shift during data fetch
- **PWA Service Worker** enables offline-capable experience

### LLM Router

- **Puter.js First** routing avoids unnecessary API key usage
- **BYOK Fallback** only triggered when Puter.js fails
- **Model Registry** cached in memory — no database lookup per request
- **Streaming** support reduces time-to-first-token for chat completions

### Agent System

- **Max Iterations** (default: 5) prevents infinite agent loops
- **Tool Registry** lookup is O(1) via Record map
- **Memory Refs** tracking enables efficient context management
- **Parallel Tool Execution** where possible (independent tool calls)

---

*Last updated: 2026 · Mnemosyne v1.0.0*
