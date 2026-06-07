# Mnemosyne — CHANGELOG

All notable changes to Mnemosyne will be documented in this file.

## [1.0.0] — 2026-06-07

### 🌟 Mnemosyne — The Biggest Free Multi-LLM Hub & AI Agent Memory Center

This is the **inaugural release** of Mnemosyne (rebranded from Memorix), named after the Greek titan goddess of memory. Mnemosyne is the world's biggest free multi-LLM hub — a central connection point for both AI agents and humans. No backend needed. No API keys needed for free tier. BYOAPI (Bring Your Own API) for premium models. SaaS/IaaS ready.

### Rebranding: Memorix → Mnemosyne

- Complete rebrand from "Memorix" to "Mnemosyne" across all source code, documentation, configuration files, service worker, PWA manifest, and Docker files
- Package renamed from `@memorix/memory` to `@mnemosyne/memory`
- MCP server binary renamed from `memorix-mcp` to `mnemosyne-mcp`
- Service worker cache version updated to `mnemosyne-v1`
- All documentation updated with proper Mnemosyne branding and capitalization

---

#### 🧠 Multi-LLM Provider Layer

- **Puter.js Integration**: 500+ AI models available for FREE via Puter.js User-Pays model — zero API key required, zero cost to developers. End-users authenticate with their free Puter.com account.
- **BYOK (Bring Your Own Key)**: Full support for OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter, Ollama, and any OpenAI-compatible API.
- **Unified LLM Router**: Single API endpoint that auto-routes to Puter.js (free) or BYOK based on model availability and user configuration.
- **Model Registry**: Curated registry of 20+ models across 8+ providers with metadata including context windows, capabilities (chat, vision, code, reasoning, tool_use, streaming), and pricing.
- **Streaming Support**: SSE streaming for all providers (Puter.js and BYOK).
- **Multi-Model Comparison**: Run the same prompt across multiple models simultaneously and compare responses side-by-side.

**Free Models Available (via Puter.js):**
| Provider | Models |
|----------|--------|
| OpenAI | GPT-5.5 Pro, GPT-5.4, GPT-5.4 Mini, GPT-5.4 Nano, GPT-4o, GPT-4o Mini, O4 Mini, O3 |
| Anthropic | Claude Opus 4.8, Claude Opus 4.8 Fast, Claude Sonnet 4.6 |
| Google | Gemini 3.1 Flash, Gemini 3.1 Pro |
| DeepSeek | DeepSeek R1, DeepSeek Chat |
| xAI | Grok 3 |
| Meta | Llama 4 Maverick |
| Mistral | Mistral Large |
| Alibaba | Qwen 3.7 Plus, Qwen 3.7 Max |

#### 🤖 AI Agent System

- **Built-in AI Agent**: Full agentic loop with automatic tool calling — no backend needed.
- **7 Built-in Tools**:
  - `memory_search` — Semantic search across user memories
  - `memory_save` — Save new notes/memories
  - `memory_update` — Update existing memories
  - `memory_delete` — Delete memories
  - `memory_insights` — Get AI-powered insights about memory patterns
  - `web_search` — Search the web for current information
  - `decision_track` — Track decisions with context and reasoning
- **Multi-LLM Agent**: Use any model from the registry for agent execution (GPT-5.4 Nano is the default — fast and free).
- **Configurable**: Custom system prompts, max iterations, tool selection, and model selection.
- **Tool Execution Loop**: Automatic multi-turn tool execution with configurable iteration limits.

#### 🌐 API Hub (Middle Provider)

Mnemosyne now serves as a **middle provider** — wrapping 500+ LLM models into a single unified API that anyone can call from anywhere.

- **POST /api/llm/chat** — Universal Chat API (auto-routes to Puter.js or BYOK, supports streaming and tool calling)
- **POST /api/llm/agent** — AI Agent Execution API (automatic tool execution, multi-LLM)
- **POST /api/llm/compare** — Multi-Model Comparison API (side-by-side response comparison)
- **GET /api/llm/models** — Model Registry API (full model catalog with metadata)
- **POST /api/llm/web-search** — Web Search API (powered by z-ai-web-dev-sdk)

All APIs are SaaS/IaaS ready — can be consumed from any client, any language, any platform.

#### 🎨 Dashboard Enhancements

- **LLM Marketplace**: Professional-grade model browser with search, filters (free/BYOK, capability), provider grouping, and model selection.
- **Agent Chat Panel**: Full chat interface with model selector, agent mode toggle, tool call visualization, and streaming support.
- **API Hub View**: Complete API documentation with request/response examples for all endpoints.
- **Updated Sidebar**: New sections for LLM Marketplace, Agent Chat, and API Hub with NEW/FREE badges.

#### 🐛 Bug Fixes

- Fixed `z.record(z.unknown())` type errors across 7 route files (Zod v4 compatibility)
- Fixed email sync results array type inference (`never[]`)
- Fixed storage account credentials type casting (`Record<string, unknown>` to `StorageCredentials`)
- Fixed `activeSync?.status === 'syncing' ?? false` unreachable code
- Fixed email `buildConfigFromAccount` nullable port fields
- Fixed `upsertEmailMessage` missing `userId`, `fromAddr`, `toAddr` fields
- Fixed Prisma schema field mismatches in email module

#### 📦 Dependencies

- **Added**: `@heyputer/puter.js` — Free LLM access via Puter.js SDK

#### 🔧 Technical

- All TypeScript strict mode errors resolved
- Build passes with zero errors
- PWA manifest and service worker preserved
- MCP server compatibility maintained

---

## [3.0.0] — 2026-06-06

### Universal AI/Human Memory Hub

- Semantic memory, RAG pipeline, context management
- MCP server (JSON-RPC 2.0)
- Multi-cloud storage (Google Drive, TeraBox, S3, Dropbox, OneDrive, local)
- Email hub (Gmail, IMAP, Outlook) with AI summarization
- Knowledge graph with temporal snapshots
- AI agent profiles
- Decision intelligence tracking
- PWA ready with service worker
- Professional dashboard with 15+ views
- Docker deployment support
- SaaS/IaaS subscription model
