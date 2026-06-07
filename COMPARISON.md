# Memorix vs Competitors — Comparison

> Why Memorix is the best choice for free, universal LLM access with memory and AI agent capabilities.

---

## Feature Comparison

| Feature | Memorix | Obsidian | Context7 | 9Drive | TeraBox | OpenRouter | Jan.ai | LM Studio |
|---------|---------|----------|----------|--------|---------|------------|--------|-----------|
| **Free LLM Access** | 500+ models via Puter.js | None | Limited | None | None | Paid only | Local only | Local only |
| **BYOK Support** | 7+ providers | None | Limited | None | None | Built-in | Built-in | Built-in |
| **AI Agent** | Built-in, 7 tools | None | None | None | None | None | None | None |
| **Semantic Memory** | RAG + Vector Search | Plugin only | Limited | None | None | None | None | None |
| **MCP Server** | JSON-RPC 2.0 | None | None | None | None | None | None | None |
| **API Hub** | Universal REST API | None | None | None | None | REST API | None | None |
| **Multi-Model Compare** | Yes | No | No | No | No | No | No | No |
| **Cloud Storage** | 5 providers | None | None | Yes | Yes | None | None | None |
| **PWA** | Yes | No | No | No | No | No | Desktop | Desktop |
| **No Backend Needed** | Yes | Yes | No | No | No | No | Yes | Yes |
| **SaaS/IaaS Ready** | Yes | No | No | No | No | Yes | No | No |
| **Open Source** | MIT | Paid plugins | No | No | No | No | Yes | Yes |
| **Web Search** | Built-in | Plugin | No | No | No | No | No | No |

---

## Detailed Comparisons

### Memorix vs Obsidian

Obsidian is a note-taking app with a rich plugin ecosystem, but it lacks the core AI capabilities that Memorix provides out of the box. While Obsidian requires paid plugins for AI features, Memorix offers 500+ free LLM models, a built-in AI agent with 7 tools, semantic memory with RAG, and an MCP server — all without any plugins or additional costs. Memorix is not just a note-taking app; it is a complete AI-powered memory and LLM hub.

### Memorix vs Context7

Context7 provides context management tools but requires significant setup and lacks a free LLM tier. Memorix provides free LLM access out of the box via Puter.js, making it immediately usable without API keys. Additionally, Memorix includes an API hub that can serve as a middle provider for other applications, something Context7 does not offer.

### Memorix vs OpenRouter

OpenRouter is a paid LLM routing service that aggregates multiple providers behind a single API key. Memorix offers a similar unified API but with a critical difference: the free tier via Puter.js requires no API key and no payment. For developers who want free LLM access, Memorix is the obvious choice. For those who need specific paid models, Memorix's BYOK support includes OpenRouter as one of the supported providers.

### Memorix vs Jan.ai / LM Studio

Both Jan.ai and LM Studio are desktop-only local LLM runners. Memorix complements these by offering cloud-based free LLM access via Puter.js, which does not require local GPU resources. Memorix also provides semantic memory, RAG, MCP server integration, and an API hub — features that neither Jan.ai nor LM Studio offers. Additionally, Memorix supports Ollama integration, so local models can be used alongside cloud models.

### Memorix vs TeraBox / 9Drive

TeraBox and 9Drive are cloud storage services. While Memorix includes multi-cloud storage capabilities (Google Drive, TeraBox, S3, Puter.js FS, local), its primary value proposition is the free multi-LLM hub with AI agent and memory capabilities. Memorix uses cloud storage as a backend for file ingestion into memory, not as its core feature.

---

## Pricing Comparison

| Platform | Free Tier | Paid Tier | Cost per 1M tokens |
|----------|-----------|-----------|-------------------|
| **Memorix** | 500+ models via Puter.js | BYOK (your cost) | $0 (Puter.js user-pays) |
| **OpenRouter** | None | All models | $0.14 — $75+ |
| **Obsidian** | App free, AI plugins paid | $8-25/month for AI | Varies by plugin |
| **Context7** | Limited free | Subscription | Varies |
| **Jan.ai** | Local models free | None | $0 (local compute) |
| **LM Studio** | Local models free | None | $0 (local compute) |

---

## Why Memorix Wins

1. **Free by default** — 500+ models via Puter.js with zero API keys. No other platform offers this.
2. **Portable** — SQLite-based, runs anywhere. Docker, Vercel, bare metal, Raspberry Pi.
3. **No backend needed** — Puter.js handles auth and billing client-side. Deploy and go.
4. **API for everyone** — Universal REST API callable from any language, any platform.
5. **MCP integration** — Connect to Claude, Cursor, and any MCP-compatible AI assistant.
6. **AI Agent built-in** — 7 tools for memory management, web search, and decision tracking.
7. **Middle provider** — Wrap Memorix as your own LLM API service for SaaS/IaaS.
8. **Open source** — MIT license. Fork it, modify it, deploy it your way.

---

*Last updated: 2026 · Memorix v4.0.0*
