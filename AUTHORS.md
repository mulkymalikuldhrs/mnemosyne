# Mnemosyne — Authors & Contributors

## Creator & Lead Developer

**Mulky Malikul Dhaher**

- Email: mulkymalikuldhaher@email.com
- GitHub: [@mulkymalikuldhrs](https://github.com/mulkymalikuldhrs)

## Project

**Mnemosyne** — The Biggest Free Multi-LLM Hub & AI Agent Memory Center

Named after the Greek titan goddess of memory, Mnemosyne is a unified platform providing free access to 500+ AI models via Puter.js, BYOAPI (Bring Your Own API) support, built-in AI Agent with 7 tools, semantic memory, RAG, MCP server, multi-cloud storage, and email integration. Built with Next.js 16, TypeScript, Prisma, and Tailwind CSS 4. Designed as the central connection hub for both AI agents and humans — portable yet powerful, with no backend required.

### Core Architecture

- **LLM Hub**: 500+ free models via Puter.js, BYOAPI for 7+ providers (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, custom)
- **AI Agent**: Built-in agent with iterative tool execution (search memory, save notes, web search, etc.)
- **Memory Center**: Semantic memory with RAG, vector search, knowledge graph, daily notes, temporal graph
- **MCP Server**: Model Context Protocol server for integration with Claude, Cursor, and other AI tools
- **Multi-Cloud Storage**: Google Drive, TeraBox, S3-compatible, local filesystem, Puter.js cloud storage
- **Email Hub**: Gmail, IMAP integration with AI-powered summarization
- **API Hub**: Universal REST API callable from any language, SaaS/IaaS ready
- **PWA**: Full offline support with service worker, background sync, push notifications

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| State | Zustand, React Query, TipTap editor |
| Backend | Next.js API Routes, Prisma ORM, SQLite/PostgreSQL |
| Auth | NextAuth.js, bcryptjs, JWT |
| AI | Puter.js, @heyputer/puter.js, z-ai-web-dev-sdk |
| MCP | @modelcontextprotocol/sdk (TypeScript) |
| Storage | Google Drive API, AWS S3, TeraBox, Puter.js FS, local fs |
| PWA | Service Worker, IndexedDB, Background Sync API |
| DevOps | Docker, Caddy, GitHub Actions |

## Research & Inspiration

- **Pentaract** — Cloud storage system using Telegram channels as free unlimited storage (Rust/Axum). Inspired Mnemosyne's chunking strategy, storage worker abstraction, and rate-limiting patterns.
- **LiteLLM** — Multi-LLM proxy with 100+ provider support. Informed Mnemosyne's unified API format and BYOAPI architecture.
- **OpenRouter** — LLM routing service. Inspired the model marketplace UI and free tier model access patterns.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
