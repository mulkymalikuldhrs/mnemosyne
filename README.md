<div align="center">

# 🧠 Memorix

### The Biggest Free Multi-LLM Hub

**500+ AI Models · Zero API Key · Bring Your Own Key · Built-in Agent**

[![Version](https://img.shields.io/badge/version-4.0.0-purple.svg)](https://github.com/mulkymalikuldhrs/memorix)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-orange.svg)](https://modelcontextprotocol.io)
[![Puter.js](https://img.shields.io/badge/Puter.js-500%2B%20Models-ff69b4.svg)](https://puter.com)
[![PWA](https://img.shields.io/badge/PWA-Ready-cyan.svg)](https://web.dev/progressive-web-apps/)

[Report Bug](https://github.com/mulkymalikuldhrs/memorix/issues) · [Request Feature](https://github.com/mulkymalikuldhrs/memorix/issues) · [API Docs](API.md) · [Architecture](ARCHITECTURE.md)

</div>

---

## Overview

Memorix is the world's biggest free multi-LLM hub — a single platform that gives you **free access to 500+ AI models** via Puter.js with zero API keys, alongside BYOK (Bring Your Own Key) support for every major provider. It includes a built-in AI Agent with 7 tools, semantic memory, RAG, an MCP server, and multi-cloud storage — all in one portable Next.js application.

**No backend needed.** Puter.js handles authentication and billing on the client side (user-pays model), so you get GPT-5.5 Pro, Claude Opus 4.8, Gemini 3.1 Pro, and hundreds more — completely free for developers.

### Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-LLM via Puter.js (FREE)** | 500+ models from OpenAI, Anthropic, Google, DeepSeek, xAI, Meta, Mistral, Alibaba — zero API key required |
| 🔑 **BYOK Support** | Bring your own API keys for OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, or any OpenAI-compatible endpoint |
| 🧠 **AI Agent** | Built-in agent with 7 tools: memory search, save, update, delete, insights, web search, decision tracking |
| 💾 **Semantic Memory** | Vector-embedded notes with automatic chunking, embedding, and intelligent retrieval |
| 🔌 **MCP Server** | Connect to Claude Desktop, Cursor, and any MCP-compatible client via JSON-RPC 2.0 |
| 📚 **RAG** | Retrieval-Augmented Generation injects your memories into LLM conversations |
| ☁️ **Multi-Cloud Storage** | Google Drive, TeraBox, S3, Puter.js FS, and local storage with file ingestion |
| 📱 **PWA** | Install as a Progressive Web App for offline-capable, native-like experience |
| 🏢 **SaaS/IaaS Ready** | Middle-provider architecture — wrap Memorix as your own LLM API service |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Memorix v4.0 — Multi-LLM Hub                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │   Web UI     │   │  MCP Clients │   │ API Consumers │            │
│  │  (PWA/React) │   │(Claude/Cursor)│   │  (SaaS/IaaS) │            │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘            │
│         │                  │                   │                     │
│         ▼                  ▼                   ▼                     │
│  ┌──────────────────────────────────────────────────────┐           │
│  │                  REST API + SSE + MCP                  │           │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │           │
│  │  │ LLM  │ │Agent │ │Notes │ │Memory│ │ Storage  │  │           │
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └────┬─────┘  │           │
│  └─────┼────────┼────────┼────────┼───────────┼─────────┘           │
│        │        │        │        │           │                      │
│        ▼        ▼        ▼        ▼           ▼                      │
│  ┌──────────────────────────────────────────────────────┐           │
│  │                   Core Services                        │           │
│  │  ┌───────────┐ ┌───────────┐ ┌─────────────────────┐│           │
│  │  │LLM Router │ │  Agent    │ │   Memory Engine     ││           │
│  │  │(Auto-Route)│ │  Engine   │ │Chunk·Embed·Search  ││           │
│  │  └─────┬─────┘ └───────────┘ │RAG·Patterns·Graph  ││           │
│  │        │                      └─────────────────────┘│           │
│  │  ┌─────▼─────────────────────────────────────────┐   │           │
│  │  │              Provider Layer                     │   │           │
│  │  │  Puter.js FREE ── BYOK Keys ── Local/Ollama   │   │           │
│  │  │  500+ models     OpenAI/Gl/DS/OR   localhost   │   │           │
│  │  └────────────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────────────┘           │
│        │                                                             │
│        ▼                                                             │
│  ┌──────────────────────────────────────────────────────┐           │
│  │             SQLite + Prisma ORM + Puter.js Cloud      │           │
│  │  Notes · Chunks(Vectors) · Links · Conversations     │           │
│  │  Decisions · ApiKeys · Sessions · StorageAccounts     │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Bun** >= 1.0 ([install](https://bun.sh)) or **Node.js** >= 20
- **Git** for version control

### 3-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/mulkymalikuldhrs/memorix.git
cd memorix

# 2. Install dependencies
bun install

# 3. Initialize and start
cp .env.example .env
bun run db:push
bun run db:generate
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) — you now have access to 500+ free LLM models.

> No API keys needed for basic usage. Puter.js handles model access client-side (user-pays model).

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server on port 3000 |
| `bun run build` | Build for production (standalone output) |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint checks |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run test` | Run Vitest unit tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run db:push` | Push Prisma schema to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:migrate` | Run database migrations |
| `bun run db:seed` | Seed database with demo data |
| `bun run mcp` | Start MCP server |
| `bun run mcp:dev` | Start MCP server with hot reload |

---

## Free Models

All models below are available **completely free** via Puter.js. No API key, no credit card — just start chatting.

| Model | Provider | Context Window | Capabilities |
|-------|----------|---------------|-------------|
| **GPT-5.5 Pro** | OpenAI | 200K | Chat, Vision, Code, Reasoning, Tool Use, Streaming |
| **GPT-5.4** | OpenAI | 200K | Chat, Vision, Code, Reasoning, Tool Use, Streaming |
| **GPT-5.4 Mini** | OpenAI | 128K | Chat, Code, Tool Use, Streaming |
| **GPT-5.4 Nano** | OpenAI | 128K | Chat, Code, Tool Use, Streaming |
| **GPT-4o** | OpenAI | 128K | Chat, Vision, Code, Tool Use, Streaming |
| **O3** | OpenAI | 200K | Chat, Reasoning, Code, Streaming |
| **Claude Opus 4.8** | Anthropic | 200K | Chat, Vision, Code, Reasoning, Tool Use, Streaming |
| **Claude Opus 4.8 Fast** | Anthropic | 200K | Chat, Vision, Code, Reasoning, Tool Use, Streaming |
| **Claude Sonnet 4.6** | Anthropic | 200K | Chat, Vision, Code, Reasoning, Tool Use, Streaming |
| **Gemini 3.1 Pro** | Google | 2M | Chat, Vision, Code, Reasoning, Tool Use, Streaming |
| **Gemini 3.1 Flash** | Google | 1M | Chat, Vision, Code, Tool Use, Streaming |
| **DeepSeek R1** | DeepSeek | 128K | Chat, Reasoning, Code, Streaming |
| **Grok 3** | xAI | 128K | Chat, Code, Reasoning, Streaming |
| **Llama 4 Maverick** | Meta | 128K | Chat, Code, Streaming |
| **Mistral Large** | Mistral | 128K | Chat, Code, Tool Use, Streaming |
| **Qwen 3.7 Plus** | Alibaba | 128K | Chat, Code, Reasoning, Streaming |

> **Note:** 500+ additional models are available through Puter.js beyond the curated list above. Use the Model Registry API to discover them all.

---

## BYOK — Bring Your Own Key

Have your own API keys? Memorix supports direct connections to all major providers:

| Provider | Models | Authentication |
|----------|--------|---------------|
| **OpenAI** | GPT-4o, GPT-4o Mini, O3, etc. | API Key (`sk-...`) |
| **Anthropic** | Claude Opus, Sonnet, Haiku | API Key (`sk-ant-...`) |
| **Google** | Gemini Pro, Flash | API Key |
| **DeepSeek** | DeepSeek Chat, R1 | API Key |
| **OpenRouter** | 100+ models via one key | API Key |
| **Ollama** | Llama, Mistral, CodeLlama, etc. | Local (`http://localhost:11434`) |
| **Custom** | Any OpenAI-compatible API | API Key + Base URL |

### Using BYOK

```bash
# Via API
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "byok/openai-gpt-4o",
    "provider": "openai",
    "apiKey": "sk-your-key-here",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

The LLM Router automatically falls back: **Puter.js (free) → BYOK (if key provided)**.

---

## AI Agent

Memorix includes a built-in AI Agent that can use any LLM from the pool and execute 7 built-in tools:

| Tool | Description |
|------|-------------|
| `memory_search` | Semantic search across your notes and memories |
| `memory_save` | Save new notes to your knowledge base |
| `memory_update` | Update existing notes |
| `memory_delete` | Delete notes from your knowledge base |
| `memory_insights` | Get AI-powered insights about memory patterns and connections |
| `web_search` | Search the web for current information |
| `decision_track` | Track decisions with context, reasoning, and outcomes |

The agent uses an **agentic execution loop**: it calls the LLM, if the LLM returns tool calls it executes them and feeds results back, continuing until the LLM provides a final answer (up to configurable `maxIterations`).

> See [AGENTS.md](AGENTS.md) for full agent documentation.

---

## MCP Server Setup

Connect Memorix to any MCP-compatible AI assistant via JSON-RPC 2.0 over stdio transport.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memorix": {
      "command": "bun",
      "args": ["run", "/path/to/memorix/mcp-server/index.ts"],
      "env": {
        "DATABASE_URL": "file:/path/to/memorix/prisma/db/memorix.db",
        "MEMORIX_API_KEY": "mx_your_api_key_here"
      }
    }
  }
}
```

### Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "memorix": {
      "command": "bun",
      "args": ["run", "/path/to/memorix/mcp-server/index.ts"],
      "env": {
        "DATABASE_URL": "file:/path/to/memorix/prisma/db/memorix.db",
        "MEMORIX_API_KEY": "mx_your_api_key_here"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `memorix_search` | Semantic + keyword search across notes |
| `memorix_add_note` | Add a note (auto-creates relations) |
| `memorix_get_note` | Get a specific note with full content |
| `memorix_list_notes` | List all notes with pagination |
| `memorix_chat` | Chat with your memory (RAG-powered) |
| `memorix_get_related` | Get related notes with relation scores |
| `memorix_detect_patterns` | Detect tag frequency, keyword trends, clusters |
| `memorix_add_decision` | Record a decision with context and reasoning |

---

## API Documentation

Memorix exposes a comprehensive REST API for programmatic access. Key endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/llm/chat` | Universal chat (auto-routes to Puter.js or BYOK) |
| POST | `/api/llm/agent` | AI agent execution with tools |
| POST | `/api/llm/compare` | Multi-model comparison |
| GET | `/api/llm/models` | Model registry (all available models) |
| POST | `/api/llm/web-search` | Web search via z-ai-web-dev-sdk |
| GET | `/api/notes` | List notes (paginated, searchable) |
| POST | `/api/notes` | Create note + memory storage |
| GET | `/api/search` | Semantic search |
| POST | `/api/chat` | Chat with memory context |
| POST | `/api/mcp/transport` | MCP JSON-RPC 2.0 transport |

> See [API.md](API.md) for the complete API reference.

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 16 |
| Language | TypeScript | 5 (strict) |
| Styling | Tailwind CSS + shadcn/ui | 4 |
| Database | Prisma ORM (SQLite) | 6 |
| State | Zustand + TanStack Query | 5 / 5 |
| Auth | NextAuth.js | 4 |
| Free LLM | Puter.js SDK | 2.5 |
| AI SDK | z-ai-web-dev-sdk | latest |
| Animations | Framer Motion | 12 |
| MCP | JSON-RPC 2.0 over Stdio | — |
| Testing | Vitest | 4 |
| Container | Docker + Docker Compose | — |

---

## Project Structure

```
memorix/
├── src/
│   ├── ai/                          # AI Memory Engine
│   │   ├── chunker.ts               # Text chunking (paragraph → sentence → word)
│   │   ├── embedder.ts              # Vector embedding with API + pseudo-embedding fallback
│   │   ├── memory.ts                # Core Memory Engine (store, search, relate, patterns)
│   │   └── llm.ts                   # RAG chat with memory injection
│   ├── app/                         # Next.js App Router
│   │   ├── api/                     # REST API endpoints
│   │   │   ├── auth/                # Authentication (NextAuth + register)
│   │   │   ├── llm/                 # Multi-LLM API (chat, agent, compare, models, web-search)
│   │   │   ├── notes/               # Notes CRUD + memory storage
│   │   │   ├── chat/                # AI chat with memory context
│   │   │   ├── search/              # Semantic search
│   │   │   ├── memory/              # Memory context, related, patterns
│   │   │   ├── decisions/           # Decision tracking
│   │   │   ├── settings/            # User settings
│   │   │   ├── api-keys/            # API key management
│   │   │   ├── storage/             # Multi-cloud storage (accounts, files, sync, ingest)
│   │   │   ├── agents/              # Agent configuration
│   │   │   ├── entities/            # Entity management
│   │   │   ├── graph/               # Knowledge graph + temporal
│   │   │   ├── canvas/              # Canvas views
│   │   │   ├── daily-notes/         # Daily note entries
│   │   │   ├── email/               # Email integration
│   │   │   ├── templates/           # Note templates
│   │   │   ├── integrations/        # Third-party integrations
│   │   │   ├── smart-tags/          # Smart tag suggestions
│   │   │   ├── favorites/           # Favorite notes
│   │   │   ├── wiki-links/          # Wiki-style link resolution
│   │   │   ├── subscription/        # Subscription management
│   │   │   ├── ai-memory/           # AI memory CRUD
│   │   │   └── health/              # Health check
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Main dashboard
│   │   └── globals.css              # Custom theme (oklch color system)
│   ├── components/                  # React components
│   │   ├── ui/                      # shadcn/ui components (40+)
│   │   ├── layout/                  # Sidebar, Header, AppLayout
│   │   ├── llm/                     # LLM Marketplace, Agent Chat
│   │   ├── notes/                   # NoteEditor, NoteCard, NotesList, SmartTags
│   │   ├── chat/                    # ChatPanel, MessageBubble
│   │   ├── memory/                  # MemoryInsights, RelatedNotesPanel
│   │   ├── search/                  # SemanticSearch
│   │   ├── editor/                  # RichEditor (TipTap)
│   │   ├── graph/                   # KnowledgeGraph (D3)
│   │   ├── canvas/                  # CanvasView
│   │   ├── daily/                   # DailyNotes
│   │   ├── templates/               # TemplatesView
│   │   ├── providers.tsx            # QueryClient + Theme + Tooltip providers
│   │   ├── pwa-register.tsx         # PWA service worker registration
│   │   ├── keyboard-shortcuts.tsx   # Global keyboard shortcuts
│   │   └── quick-switcher.tsx       # Cmd+K quick switcher
│   ├── lib/                         # Shared utilities
│   │   ├── llm/                     # Multi-LLM Layer
│   │   │   ├── index.ts             # LLM Router (auto-routing)
│   │   │   ├── providers.ts         # Model registry (20+ curated models)
│   │   │   ├── puter-provider.ts    # Puter.js integration (FREE)
│   │   │   └── byok-provider.ts     # BYOK integration (7 providers)
│   │   ├── agent/                   # AI Agent System
│   │   │   └── index.ts             # AgentEngine + 7 built-in tools
│   │   ├── storage/                 # Multi-Cloud Storage
│   │   │   ├── index.ts             # StorageManager (orchestrator)
│   │   │   ├── google-drive.ts      # Google Drive provider
│   │   │   ├── terabox.ts           # TeraBox provider
│   │   │   ├── s3-compatible.ts     # S3-compatible provider
│   │   │   ├── local.ts             # Local filesystem provider
│   │   │   └── types.ts             # Storage type definitions
│   │   ├── email/                   # Email Integration
│   │   │   ├── index.ts             # EmailManager
│   │   │   ├── gmail.ts             # Gmail provider
│   │   │   ├── imap.ts              # IMAP provider
│   │   │   └── types.ts             # Email types
│   │   ├── auth.ts                  # NextAuth configuration
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── env.ts                   # Zod environment validation
│   │   ├── store.ts                 # Zustand stores
│   │   ├── api-utils.ts             # Shared API response helpers
│   │   ├── rate-limit.ts            # In-memory rate limiter
│   │   ├── error-reporter.ts        # Structured error reporting
│   │   ├── query-client.ts          # TanStack Query client
│   │   ├── ai-memory.ts             # AI memory service
│   │   ├── wiki-links.ts            # Wiki link resolution
│   │   ├── api.ts                   # API client utilities
│   │   ├── types.ts                 # Shared type definitions
│   │   └── utils.ts                 # cn() utility
│   └── middleware.ts                # Security headers, rate limiting, CORS
├── mcp-server/                      # Standalone MCP server
│   ├── index.ts                     # JSON-RPC 2.0 server (8 tools)
│   ├── cli.js                       # CLI entry point for npx memorix-mcp
│   ├── package.json                 # Independent npm package
│   └── tsconfig.json                # TypeScript config
├── prisma/
│   ├── schema.prisma                # Main database schema (15+ models)
│   └── seed.ts                      # Demo data seeder
├── public/
│   ├── logo.svg                     # Memorix logo
│   ├── sw.js                        # Service worker
│   └── fonts/                       # Inter font
├── Dockerfile                       # Multi-stage Docker build
├── docker-compose.yml               # App + MCP services
├── .env.example                     # Environment template
├── LICENSE                          # MIT License
├── README.md                        # This file
├── ARCHITECTURE.md                  # Architecture documentation
├── AGENTS.md                        # AI Agent documentation
├── API.md                           # API reference
├── next.config.ts                   # Next.js config (standalone output)
├── package.json                     # Project manifest
├── tsconfig.json                    # TypeScript config
├── vitest.config.ts                 # Vitest test config
└── tailwind.config.ts               # Tailwind CSS config
```

---

## Deployment

### Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/mulkymalikuldhrs/memorix.git
cd memorix

# Set environment variables
cp .env.example .env
# Edit .env with production values (especially NEXTAUTH_SECRET)

# Build and start services
docker compose up -d

# View logs
docker compose logs -f
```

This starts two services:
- **app** — Next.js web application on port 3000
- **mcp** — MCP server on port 4000

Data is persisted in a Docker volume (`memorix-data`).

### Vercel

Memorix can be deployed to Vercel with some adjustments:

1. Fork the repository
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Switch from SQLite to PostgreSQL (update `prisma/schema.prisma` datasource)
5. Deploy

> **Note:** SQLite is not supported on Vercel. Migrate to PostgreSQL or use Turso.

### Manual Deployment

```bash
# Build the application
bun install
bun run db:generate
bun run db:push
bun run build

# Start production server
DATABASE_URL=file:./data/memorix.db \
NEXTAUTH_SECRET=your-secret \
NEXTAUTH_URL=https://your-domain.com \
NODE_ENV=production \
bun run start
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite path or PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | `change-me-in-production` | JWT session secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Public URL for auth callbacks |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key for additional LLM access |
| `MEMORIX_API_KEY` | No | — | API key for MCP server authentication |
| `MCP_SERVER_PORT` | No | `4000` | MCP server port |
| `UPSTASH_REDIS_URL` | No | — | Redis URL for production rate limiting |
| `UPSTASH_REDIS_TOKEN` | No | — | Redis token for production rate limiting |
| `EMBEDDING_MODEL` | No | `nomic-embed-text` | Embedding model name |
| `EMBEDDING_DIMENSION` | No | `768` | Embedding vector dimension |
| `EMBEDDING_API_URL` | No | — | External embedding API URL |
| `EMBEDDING_API_KEY` | No | — | External embedding API key |

---

## Contributing

We welcome contributions! Here's how to get started:

### Quick Steps

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Make** your changes
4. **Run** `bun run lint` and fix any issues
5. **Run** `bun run typecheck` to verify types
6. **Commit** with conventional commits: `feat(scope): description`
7. **Push** and open a Pull Request

### Commit Convention

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting (no code change) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Build/tooling changes |

### Development Guidelines

- Use TypeScript strict mode throughout
- Follow the existing code style (ESLint + Prettier)
- Add proper error handling for all API routes
- Write descriptive commit messages
- Test your changes before pushing
- Keep PRs focused on a single concern

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 Mulky Malikul Dhaher

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Author

**Mulky Malikul Dhaher**

- Email: mulkymalikudhr@mail.com
- GitHub: [@mulkymalikuldhrs](https://github.com/mulkymalikuldhrs)

---

<div align="center">

**The Biggest Free Multi-LLM Hub** 🧠

*Built with ❤️ in Aceh, Indonesia*

</div>
