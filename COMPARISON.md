# Mnemosyne vs Competitors — Comparison

> Why Mnemosyne is the best choice for free, universal LLM access with memory and AI agent capabilities.

---

## Feature Comparison

| Feature | Mnemosyne | Obsidian | Context7 | 9Drive | TeraBox | OpenRouter | Jan.ai | LM Studio | LiteLLM |
|---------|---------|----------|----------|--------|---------|------------|--------|-----------|---------|
| **Free LLM Access** | 500+ models via Puter.js | None | Limited | None | None | Paid only | Local only | Local only | No |
| **BYOAPI Support** | 7+ providers | None | Limited | None | None | Built-in | Built-in | Built-in | Built-in |
| **AI Agent** | Built-in, 7 tools | None | None | None | None | None | None | None | None |
| **Semantic Memory** | RAG + Vector Search | Plugin only | Limited | None | None | None | None | None | None |
| **MCP Server** | JSON-RPC 2.0 | None | None | None | None | None | None | None | None |
| **API Hub** | Universal REST API | None | None | None | None | REST API | None | None | REST API |
| **Multi-Model Compare** | Yes | No | No | No | No | No | No | No | No |
| **Cloud Storage** | 5 providers | None | None | Yes | Yes | None | None | None | None |
| **Email Integration** | Gmail + IMAP | Plugin | No | No | No | No | No | No | No |
| **PWA** | Yes | No | No | No | No | No | Desktop | Desktop | No |
| **No Backend Needed** | Yes | Yes | No | No | No | No | Yes | Yes | No |
| **SaaS/IaaS Ready** | Yes | No | No | No | No | Yes | No | No | No |
| **Open Source** | MIT | Paid plugins | No | No | No | No | Yes | Yes | Yes |
| **Web Search** | Built-in | Plugin | No | No | No | No | No | No | No |
| **Knowledge Graph** | Interactive D3 | Plugin | No | No | No | No | No | No | No |
| **Temporal Queries** | Time-travel graph | No | No | No | No | No | No | No | No |
| **Subscription/Billing** | Built-in | No | No | No | No | No | No | No | No |

---

## Detailed Comparisons

### Mnemosyne vs Obsidian

Obsidian is a popular note-taking app with a rich plugin ecosystem, but it fundamentally lacks the core AI capabilities that Mnemosyne provides out of the box. While Obsidian requires paid community plugins for even basic AI features like chat or summarization, Mnemosyne offers 500+ free LLM models via Puter.js, a built-in AI agent with 7 tools (search memory, save notes, web search, list notes, get note, track decision, update note), semantic memory with RAG (Retrieval Augmented Generation), an MCP server for integration with external AI tools, and a universal API hub. All of these capabilities are available without any plugins, additional costs, or complex configuration. Mnemosyne is not just a note-taking app — it is a complete AI-powered memory and LLM hub designed for both humans and AI agents.

### Mnemosyne vs Context7

Context7 provides context management tools for developers but requires significant setup, lacks a free LLM tier, and focuses narrowly on code context. Mnemosyne provides free LLM access out of the box via Puter.js, making it immediately usable without any API keys or configuration. Beyond context management, Mnemosyne includes a full API hub that can serve as a middle provider for other applications, multi-cloud storage integration for ingesting documents into memory, email ingestion with AI summarization, and a knowledge graph for visualizing connections. Context7 serves developers working in IDEs; Mnemosyne serves anyone who needs AI memory and LLM access — developers, researchers, writers, and AI agents alike.

### Mnemosyne vs OpenRouter

OpenRouter is a paid LLM routing service that aggregates multiple providers behind a single API key, providing excellent model selection but at a cost. Mnemosyne offers a similar unified API experience but with a critical difference: the free tier via Puter.js requires no API key and no payment. Users get immediate access to 500+ models including GPT-4o, Claude, Gemini, and Llama models at zero cost. For developers who need specific paid models or higher rate limits, Mnemosyne's BYOAPI (Bring Your Own API) support includes OpenRouter as one of the 7+ supported providers, meaning you can use OpenRouter through Mnemosyne if desired. Additionally, Mnemosyne provides semantic memory, RAG, MCP server, and an AI agent — features that OpenRouter does not offer.

### Mnemosyne vs Jan.ai / LM Studio

Both Jan.ai and LM Studio are desktop-only local LLM runners that excel at running models locally on your hardware. Mnemosyne complements these by offering cloud-based free LLM access via Puter.js, which does not require any local GPU resources, making it accessible from any device including mobile phones via the PWA. Mnemosyne also provides semantic memory with vector search, RAG capabilities, MCP server integration for connecting to external AI tools, an API hub for programmatic access, email and cloud storage ingestion, and a knowledge graph — features that neither Jan.ai nor LM Studio offers. Additionally, Mnemosyne supports Ollama integration, so local models can be used seamlessly alongside cloud models for a hybrid approach.

### Mnemosyne vs TeraBox / 9Drive

TeraBox and 9Drive are cloud storage services focused on file storage and sharing. While Mnemosyne includes multi-cloud storage capabilities (Google Drive, TeraBox, S3-compatible, Puter.js cloud storage, local filesystem), its primary value proposition is the free multi-LLM hub with AI agent and memory capabilities. Mnemosyne uses cloud storage as an ingestion source for feeding documents into the semantic memory system — files are not just stored but are understood, indexed, and made searchable through natural language queries. This transforms passive file storage into active, AI-queryable knowledge.

### Mnemosyne vs LiteLLM

LiteLLM is a Python-based LLM proxy that normalizes 100+ providers to the OpenAI API format. While LiteLLM excels at API routing and cost tracking, it requires a running server, Python runtime, and configuration. Mnemosyne provides similar multi-LLM routing capabilities but in a JavaScript/TypeScript stack with a built-in PWA dashboard, AI agent, semantic memory, and MCP server. Mnemosyne's free tier via Puter.js requires zero setup, whereas LiteLLM always requires API keys. For Python-centric teams, LiteLLM may be preferred; for JavaScript/TypeScript projects or users who want a complete AI memory hub with a visual dashboard, Mnemosyne is the better choice.

---

## Pricing Comparison

| Platform | Free Tier | Paid Tier | Cost per 1M tokens |
|----------|-----------|-----------|-------------------|
| **Mnemosyne** | 500+ models via Puter.js | BYOAPI (your cost) | $0 (Puter.js user-pays) |
| **OpenRouter** | None | All models | $0.14 — $75+ |
| **Obsidian** | App free, AI plugins paid | $8-25/month for AI | Varies by plugin |
| **Context7** | Limited free | Subscription | Varies |
| **Jan.ai** | Local models free | None | $0 (local compute) |
| **LM Studio** | Local models free | None | $0 (local compute) |
| **LiteLLM** | Open source, no free models | BYOK (your cost) | $0 (your API keys) |

---

## Why Mnemosyne Wins

1. **Free by default** — 500+ models via Puter.js with zero API keys. No other platform offers this combination of free access and breadth of models.
2. **Portable yet powerful** — SQLite-based, runs anywhere. Docker, Vercel, bare metal, Raspberry Pi. Single binary or container deployment.
3. **No backend needed** — Puter.js handles authentication and billing entirely client-side. Deploy and go, no server infrastructure required.
4. **API for everyone** — Universal REST API callable from any language, any platform. Use as a middle provider for your own SaaS/IaaS.
5. **MCP integration** — Connect to Claude Desktop, Cursor, Windsurf, and any MCP-compatible AI assistant via the built-in MCP server.
6. **AI Agent built-in** — 7 tools for memory management, web search, and decision tracking. The agent can autonomously use tools to accomplish tasks.
7. **Middle provider architecture** — Wrap Mnemosyne as your own LLM API service. Users bring their own API keys (BYOAPI), Mnemosyne becomes the central hub.
8. **Open source** — MIT license. Fork it, modify it, deploy it your way. No vendor lock-in.
9. **Memory-first design** — Not just LLM access, but a complete memory system with semantic search, knowledge graph, temporal queries, and RAG.
10. **Multi-cloud ingestion** — Connect Google Drive, TeraBox, S3, or local files and ingest them into searchable memory with AI summarization.

---

*Last updated: 2026 · Mnemosyne v1.0.0*
