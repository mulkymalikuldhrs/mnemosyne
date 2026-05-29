<div align="center">

# 🧠 Memorix

### Personal AI Memory Infrastructure

**Own Your AI Memory**

[![Version](https://img.shields.io/badge/version-1.0.0-purple.svg)](https://github.com/mulkymalikuldhrs/memorix)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-orange.svg)](https://modelcontextprotocol.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-cyan.svg)](https://docker.com)

[Report Bug](https://github.com/mulkymalikuldhrs/memorix/issues) · [Request Feature](https://github.com/mulkymalikuldhrs/memorix/issues) · [API Docs](#api-documentation)

</div>

---

## Overview

Memorix is a personal AI memory infrastructure that transforms how you capture, connect, and recall knowledge. Think of it as your **second brain** — powered by semantic search, AI-driven insights, and a universal MCP server that connects your memory to any AI assistant.

### Key Features

| Feature | Description |
|---------|-------------|
| 🧠 **Semantic Memory** | Store notes as vector-embedded chunks with automatic chunking and indexing for intelligent retrieval |
| 🔍 **AI Recall** | Search your memories with natural language — semantic search finds relevant notes even without exact keyword matches |
| 🔗 **Related Notes** | Automatically discover connections between your notes through tag overlap, shared concepts, and relation scoring |
| 📊 **Decision Intelligence** | Track decisions with context, reasoning, and outcomes — learn from your past choices over time |
| 🧬 **Memory Evolution** | Detect emerging topics, fading interests, knowledge clusters, and temporal patterns in your memory graph |
| 💬 **AI Chat with Memory** | RAG-powered chat that injects your memories into conversations for contextually aware AI responses |
| 🔌 **MCP Server** | Connect your memory to Claude, Cursor, GPT, and any MCP-compatible AI assistant via JSON-RPC 2.0 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Memorix Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Web UI     │    │  MCP Server  │    │  AI Assist   │   │
│  │  (Next.js)   │    │  (Stdio/SSE) │    │  (Claude etc)│   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                   │            │
│         ▼                   ▼                   ▼            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    REST API Layer                     │    │
│  │  ┌─────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌─────────┐  │    │
│  │  │Notes│ │ Chat │ │Search│ │Decisions│ │Settings │  │    │
│  │  └──┬──┘ └──┬───┘ └──┬───┘ └───┬────┘ └────┬────┘  │    │
│  └─────┼───────┼────────┼────────┼───────────┼────────┘    │
│         │       │        │        │           │              │
│         ▼       ▼        ▼        ▼           ▼              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 AI Memory Engine                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │    │
│  │  │ Chunker  │ │ Embedder │ │  Memory  │ │  LLM   │ │    │
│  │  │ (Split)  │ │ (Vector) │ │ (Search) │ │ (RAG)  │ │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SQLite + Prisma ORM                      │    │
│  │  ┌──────┐ ┌───────┐ ┌──────────┐ ┌──────────────┐  │    │
│  │  │ Notes│ │ Chunks│ │MemLinks  │ │Conversations │  │    │
│  │  │      │ │(Vecs) │ │(Graph)   │ │(Messages)    │  │    │
│  │  └──────┘ └───────┘ └──────────┘ └──────────────┘  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │Decisions │ │ ApiKeys  │ │Sessions  │            │    │
│  │  └──────────┘ └──────────┘ └──────────┘            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Bun** >= 1.0 ([install](https://bun.sh))
- **Node.js** >= 20 (for Next.js 16)
- **Git** for version control

### 3-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/mulkymalikuldhrs/memorix.git
cd memorix

# 2. Install dependencies and set up environment
bun install
cp .env.example .env
# Edit .env with your configuration

# 3. Initialize database and start
bun run db:push
bun run db:generate
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Log in with the demo account:

- **Email:** `demo@memorix.ai`
- **Password:** `demo123`

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

## MCP Server Setup

The Memorix MCP (Model Context Protocol) server allows AI assistants to interact with your memory via JSON-RPC 2.0 over stdio transport.

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
| `memorix_search` | Search your memory with keyword + tag + content scoring |
| `memorix_add_note` | Add a note to your memory (auto-creates relations) |
| `memorix_get_note` | Get a specific note with full content and metadata |
| `memorix_list_notes` | List all notes with pagination |
| `memorix_chat` | Chat with your memory (multi-turn conversations) |
| `memorix_get_related` | Get related notes with relation scores |
| `memorix_detect_patterns` | Detect patterns: tag frequency, keyword trends, clusters |
| `memorix_add_decision` | Record a decision with context and reasoning |

---

## API Documentation

All API endpoints require authentication via NextAuth.js session, except where noted.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | No | NextAuth.js handler |
| POST | `/api/auth/register` | No | Register new account (email, password, name) |

### Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | List notes (paginated, searchable, filterable by tags/archived) |
| POST | `/api/notes` | Create note + trigger background memory storage |
| GET | `/api/notes/[id]` | Get note with chunks and related notes |
| PUT | `/api/notes/[id]` | Update note + re-index memory |
| DELETE | `/api/notes/[id]` | Delete note + cleanup memory |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat` | List conversations |
| POST | `/api/chat` | Send message + get AI response with memory context |
| GET | `/api/chat/[conversationId]` | Get conversation messages |
| DELETE | `/api/chat/[conversationId]` | Delete conversation |

### Search & Memory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Semantic search across all notes |
| GET | `/api/memory` | Get memory context for a query |
| POST | `/api/memory` | Force re-index all notes |
| GET | `/api/memory/related/[noteId]` | Get related notes for a specific note |
| GET | `/api/memory/patterns` | Detect and return patterns in user's memory |

### Decisions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/decisions` | List decisions (paginated) |
| POST | `/api/decisions` | Create a new decision |

### Settings & API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings (plan, API key status) |
| PUT | `/api/settings` | Update settings (openrouterApiKey, supabaseProjectUrl) |
| GET | `/api/api-keys` | List API keys (masked) |
| POST | `/api/api-keys` | Generate new API key (`mx_` prefix) |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check (status, timestamp, version) |

### Common Query Parameters

| Parameter | Endpoints | Description |
|-----------|-----------|-------------|
| `page` | List endpoints | Page number (default: 1) |
| `limit` | List endpoints | Items per page (default: 20) |
| `q` | Notes, Search | Search query string |
| `tags` | Notes | Filter by comma-separated tags |
| `archived` | Notes | Include archived notes (boolean) |

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

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
| AI SDK | z-ai-web-dev-sdk | latest |
| Animations | Framer Motion | 12 |
| MCP | JSON-RPC 2.0 over Stdio | — |
| Testing | Vitest | 4 |
| Container | Docker + Docker Compose | — |
| CI/CD | GitHub Actions | — |

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
│   │   │   ├── notes/               # Notes CRUD + memory storage
│   │   │   ├── chat/                # AI chat with memory context
│   │   │   ├── search/              # Semantic search
│   │   │   ├── memory/              # Memory context, related, patterns
│   │   │   ├── decisions/           # Decision tracking
│   │   │   ├── settings/            # User settings
│   │   │   ├── api-keys/            # API key management
│   │   │   └── health/              # Health check
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Main dashboard (7 views)
│   │   └── globals.css              # Custom theme (oklch color system)
│   ├── components/                  # React components
│   │   ├── ui/                      # shadcn/ui components (20+)
│   │   ├── layout/                  # Sidebar, Header, AppLayout
│   │   ├── notes/                   # NoteEditor, NoteCard, NotesList
│   │   ├── chat/                    # ChatPanel, MessageBubble
│   │   ├── memory/                  # MemoryInsights, RelatedNotesPanel
│   │   ├── search/                  # SemanticSearch
│   │   └── providers.tsx            # QueryClient + Theme + Tooltip providers
│   ├── lib/                         # Shared utilities
│   │   ├── auth.ts                  # NextAuth configuration
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── env.ts                   # Zod environment validation
│   │   ├── store.ts                 # Zustand stores (UI, Notes, Chat, Memory, Decisions)
│   │   ├── api-utils.ts             # Shared API response helpers
│   │   ├── rate-limit.ts            # In-memory rate limiter
│   │   ├── error-reporter.ts        # Structured error reporting
│   │   ├── query-client.ts          # TanStack Query client
│   │   └── utils.ts                 # cn() utility
│   └── middleware.ts                # Security headers, rate limiting, CORS
├── mcp-server/                      # Standalone MCP server
│   ├── index.ts                     # JSON-RPC 2.0 server (8 tools)
│   ├── package.json                 # Independent Bun project
│   ├── tsconfig.json                # TypeScript config
│   ├── prisma/
│   │   └── schema.prisma            # MCP-specific database schema
│   └── README.md                    # MCP server documentation
├── prisma/
│   ├── schema.prisma                # Main database schema (9 models)
│   └── seed.ts                      # Demo data seeder
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI pipeline (lint, typecheck, test, build)
├── Dockerfile                       # Multi-stage Docker build
├── Dockerfile.mcp                   # MCP server Docker build
├── docker-compose.yml               # App + MCP services
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── LICENSE                          # MIT License
├── README.md                        # This file
├── next.config.ts                   # Next.js config (standalone output)
├── package.json                     # Project manifest
├── tsconfig.json                    # TypeScript config
├── vitest.config.ts                 # Vitest test config
└── tailwind.config.ts               # Tailwind CSS config
```

---

## Deployment

### Docker (Recommended)

The easiest way to deploy Memorix is with Docker Compose:

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

### Vercel

Memorix can be deployed to Vercel with some adjustments:

1. Fork the repository
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Switch from SQLite to a PostgreSQL database (update `prisma/schema.prisma` datasource)
5. Deploy

> **Note:** SQLite is not supported on Vercel. You'll need to migrate to PostgreSQL or use a managed SQLite service like Turso.

### Environment Variables for Production

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path or PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Secret for JWT signing (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Your public URL (e.g., `https://memorix.example.com`) |
| `OPENROUTER_API_KEY` | No | OpenRouter API key for LLM chat |
| `EMBEDDING_API_URL` | No | External embedding API URL |
| `MEMORIX_API_KEY` | No | API key for MCP server authentication |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite database path |
| `NEXTAUTH_SECRET` | Yes | `change-me-in-production` | JWT session secret |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Public URL for auth callbacks |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key for AI chat |
| `UPSTASH_REDIS_URL` | No | — | Redis URL for production rate limiting |
| `UPSTASH_REDIS_TOKEN` | No | — | Redis token for production rate limiting |
| `MCP_SERVER_PORT` | No | `4000` | MCP server port |
| `EMBEDDING_MODEL` | No | `nomic-embed-text` | Embedding model name |
| `EMBEDDING_DIMENSION` | No | `768` | Embedding vector dimension |
| `EMBEDDING_API_URL` | No | — | External embedding API URL |

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

- Email: mulkymalikuldhaher@email.com
- GitHub: [@mulkymalikuldhrs](https://github.com/mulkymalikuldhrs)

---

<div align="center">

**Own Your AI Memory** 🧠

*Built with ❤️ in Aceh, Indonesia*

</div>
