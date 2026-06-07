# Memorix — Product Requirements Document

> **The Biggest Free Multi-LLM Hub** — Version 4.0.0
> Free access to 500+ AI models, BYOK support, AI Agent, MCP, Semantic Memory & RAG

---

## Table of Contents

- [1. Product Vision](#1-product-vision)
- [2. Target Users](#2-target-users)
- [3. Core Problems Solved](#3-core-problems-solved)
- [4. Key Features](#4-key-features)
- [5. Technical Requirements](#5-technical-requirements)
- [6. Success Metrics](#6-success-metrics)
- [7. Non-Goals](#7-non-goals)
- [8. Release Plan](#8-release-plan)
- [9. Monetization](#9-monetization)
- [10. Risks and Mitigations](#10-risks-and-mitigations)

---

## 1. Product Vision

Memorix is the world's biggest free multi-LLM center. Our mission is to democratize AI access by providing a unified, free gateway to 500+ large language models — surpassing Obsidian, Context7, 9Drive, TeraBox, and any other platform in breadth and accessibility.

We believe that AI should be free, open, and accessible to everyone. Memorix achieves this through:

- **Puter.js Integration**: 500+ models at zero cost, no API key needed
- **BYOK Freedom**: Bring your own keys for any provider, with Memorix as the unified middle layer
- **AI Agent Built-In**: A fully functional AI agent with tool execution, semantic memory, and web search
- **MCP Protocol**: Standard Model Context Protocol support for interoperability
- **Semantic Memory & RAG**: Intelligent note-taking with AI-powered connections and retrieval

Memorix is not just another chatbot — it is an **AI infrastructure platform** that makes every LLM accessible from a single, beautiful interface.

---

## 2. Target Users

### Primary Users

| Segment | Description | Key Needs |
|---------|-------------|-----------|
| **Developers** | Full-stack engineers, AI/ML practitioners | Free LLM access for prototyping, unified API, BYOK for production |
| **AI Enthusiasts** | Hobbyists, students, self-learners | Zero-cost access to premium models, easy model comparison |
| **Researchers** | Academic and industry researchers | Multi-model benchmarking, semantic memory for literature, RAG pipelines |
| **Startups** | Early-stage companies needing AI | Free tier for MVP development, scalable BYOK for growth |
| **Small Businesses** | Teams needing LLM access | Cost-effective multi-model access, team collaboration |

### Secondary Users

| Segment | Description | Key Needs |
|---------|-------------|-----------|
| **Content Creators** | Writers, marketers, designers | AI-assisted writing, image generation, multi-model creativity |
| **Non-technical Users** | Knowledge workers | Easy chat interface, memory for personal knowledge management |
| **Enterprise Teams** | Larger organizations | SSO, role-based access, audit logs, dedicated support |

---

## 3. Core Problems Solved

| Problem | Impact | Memorix Solution |
|---------|--------|------------------|
| **Expensive API keys** | Developers spend $50-500+/month on LLM APIs | Free access via Puter.js to 500+ models |
| **Fragmented LLM access** | Each provider has different APIs, SDKs, and auth | Unified API with auto-routing across all providers |
| **No unified free hub** | No single platform offers free multi-LLM access | Memorix as the biggest free multi-LLM middle provider |
| **Vendor lock-in** | Switching providers requires rewriting code | BYOK with provider-agnostic abstraction layer |
| **No AI memory** | Chat history lost, no persistent knowledge | Semantic memory with RAG for persistent AI knowledge |
| **No free AI agents** | Agent platforms charge per execution | Built-in AI agent with 7 tools, free via Puter.js |

---

## 4. Key Features

### P0 — Critical (Must Have for v4.0)

| Feature | Description | Status |
|---------|-------------|--------|
| **Free Multi-LLM via Puter.js** | 500+ models accessible for free, zero API key required. User-pays model via Puter.com accounts | Done |
| **BYOK (Bring Your Own Key)** | Support for OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, and custom endpoints | Done |
| **Unified LLM Router** | Auto-routing between free (Puter.js) and paid (BYOK) providers with transparent fallback | Done |
| **AI Agent Engine** | 7 built-in tools (memory_search, memory_save, memory_update, memory_delete, memory_insights, web_search, decision_track) with agentic loop | Done |
| **Semantic Memory** | AI-powered note connections, pattern detection, temporal graph, backlinks | Done |
| **MCP Server** | Model Context Protocol server with stdio transport for AI tool interoperability | Done |
| **RAG Pipeline** | Chunking, embedding, and retrieval-augmented generation for knowledge queries | Done |
| **Model Registry** | 21 curated models across 8 providers with capabilities, context windows, and search | Done |
| **Chat API** | Universal chat endpoint with streaming support across all providers | Done |
| **Multi-Model Comparison** | Run same prompt across multiple models simultaneously | Done |
| **Web Search** | Integrated web search for real-time information retrieval | Done |

### P1 — Important (v4.1 - v4.3)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Professional Dashboard** | Redesigned dashboard with LLM Marketplace, Agent Chat, API Hub views | v4.1 |
| **Multi-Model Comparison UI** | Side-by-side comparison interface with scoring | v4.1 |
| **PWA Support** | Installable progressive web app with offline capabilities | v4.1 |
| **Multi-Cloud Storage** | Google Drive, S3-compatible, Puter.js FS, Telegram storage | v4.2 |
| **Custom Agent Creation** | User-defined agents with custom system prompts and tool selections | v4.1 |
| **Agent Marketplace** | Share and discover community-built agents | v4.1 |
| **Enhanced MCP** | More MCP tools, streaming support, tool marketplace | v4.3 |

### P2 — Nice to Have (v5.0+)

| Feature | Description | Priority |
|---------|-------------|----------|
| **SaaS/IaaS Tiers** | Multi-tenancy, billing, API gateway with rate limiting per tier | v5.0 |
| **Analytics Dashboard** | Usage statistics, cost tracking, model performance metrics | v5.0 |
| **Team Collaboration** | Shared workspaces, team memory, role-based access control | v4.3 |
| **Custom Plugin System** | Third-party plugin architecture for extending functionality | v5.0 |
| **Mobile Apps** | Native iOS and Android apps | v6.0 |
| **Desktop Apps** | Tauri-based desktop application | v6.0 |
| **On-Premise Deployment** | Self-hosted enterprise deployment option | v6.0 |

---

## 5. Technical Requirements

### Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16, React 19, TypeScript (strict) | App router, SSR, PWA |
| UI Framework | Tailwind CSS 4, shadcn/ui | Component library, styling |
| State Management | Zustand | Client-side state |
| Data Fetching | TanStack Query (React Query) | Server state, caching |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM | Data persistence |
| LLM Access | Puter.js SDK (free) + BYOK providers | Multi-LLM routing |
| Agent System | Custom AgentEngine with tool registry | AI agent execution |
| MCP | @modelcontextprotocol/sdk | Tool protocol server |
| Auth | NextAuth.js | Authentication |
| Deployment | Vercel / Docker / Standalone | Hosting |

### Performance Requirements

| Metric | Target |
|--------|--------|
| Time to First Byte (TTFB) | < 200ms (cached), < 1s (uncached) |
| LLM Chat First Token | < 2s (Puter.js), < 1s (BYOK) |
| Model Registry Load | < 500ms |
| Agent Tool Execution | < 3s per tool call |
| Semantic Search | < 500ms for 10k notes |
| Lighthouse Score | > 90 (Performance, A11y) |
| Uptime SLA | 99.9% |

### Security Requirements

- API key authentication on all protected endpoints
- HTTPS enforced in production
- CORS configured for allowed origins only
- Input validation via Zod schemas on all API routes
- Rate limiting (Upstash Redis in production)
- No user data mining or selling
- API keys encrypted at rest
- CSP headers for XSS protection

### Compatibility

- **Browsers**: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- **Node.js**: >= 18.x
- **Package Manager**: Bun (primary), npm (fallback)
- **Mobile**: Responsive design, PWA installable
- **Screen Sizes**: 320px to 4K

---

## 6. Success Metrics

### Key Performance Indicators

| KPI | Target (6 months) | Measurement |
|-----|-------------------|-------------|
| **Free models available** | 500+ (via Puter.js) | Model registry count |
| **Monthly active users (MAU)** | 10,000+ | Authenticated sessions |
| **Free tier usage** | 100,000+ API calls/month | LLM router request count |
| **API response time (p95)** | < 3s (chat), < 500ms (models) | Server-side metrics |
| **Uptime** | 99.9% | Health check monitoring |
| **BYOK adoption** | 20% of users configure at least one key | Provider config count |
| **Agent usage** | 30% of users run at least one agent session | Agent execution count |
| **Community growth** | 1,000+ GitHub stars | Repository metrics |

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Build success rate | 100% on main branch | CI pipeline |
| Test coverage | > 80% on `src/lib/` | Vitest coverage |
| TypeScript strict compliance | Zero `any` types in production code | ESLint + TS compiler |
| Accessibility | WCAG 2.1 AA | Lighthouse + manual audit |
| Zero-day vulnerabilities | 0 known CVEs | `bun audit` + Dependabot |

---

## 7. Non-Goals

Memorix explicitly does NOT aim to:

1. **Be a chatbot company** — We are an AI infrastructure platform, not a consumer chatbot
2. **Replace LLM providers** — We are a middle provider that routes to existing providers
3. **Store user data for mining** — User data belongs to users; we never sell or mine it
4. **Build proprietary models** — We aggregate and provide access to existing models
5. **Compete on model training** — We focus on access, not training
6. **Provide enterprise SLA in free tier** — Enterprise SLAs are reserved for paid tiers
7. **Be a single-model platform** — Our value is multi-model diversity and comparison
8. **Replace IDEs or code editors** — We are a knowledge and LLM access platform

---

## 8. Release Plan

### v4.0.0 — Multi-LLM Hub Foundation (Current)

- Free Multi-LLM via Puter.js (500+ models)
- BYOK provider system (7 providers)
- Unified LLM Router with auto-routing and fallback
- AI Agent Engine with 7 built-in tools
- Semantic Memory & RAG pipeline
- MCP Server with stdio transport
- 5 new API endpoints (models, chat, compare, web-search, agent)
- LLM Marketplace, Agent Chat, API Hub UI
- Professional dashboard with sidebar navigation

### v4.1.0 — Enhanced Agent System

- Custom agent creation (user-defined system prompts, tool selection)
- Agent marketplace for sharing and discovering agents
- More built-in tools (file operations, code execution, email integration)
- Multi-model comparison UI with side-by-side view
- Professional dashboard redesign
- PWA improvements (offline mode, push notifications)
- Performance optimizations

### v4.2.0 — Storage Expansion

- Telegram storage integration
- Puter.js filesystem as primary storage option
- WebDAV support
- Multi-cloud storage dashboard
- Backup and sync improvements
- Storage provider abstraction layer

### v4.3.0 — Collaboration

- Team workspaces with shared projects
- Shared memory and knowledge bases
- Role-based access control (Admin, Editor, Viewer)
- Real-time collaboration features
- Team analytics dashboard

### v5.0.0 — SaaS/IaaS Platform

- Multi-tenancy architecture
- Billing and subscription management (Stripe integration)
- API gateway with rate limiting per tier
- Usage analytics and cost tracking
- Custom domain support
- SSO integration (SAML, OIDC)

### v5.1.0 — MCP 2.0

- Streaming MCP transport
- MCP tool marketplace
- Composio integration for 100+ third-party tools
- Enhanced MCP authentication
- MCP client SDK for external integrations

### v6.0.0 — AI Agent Platform

- Autonomous agents with scheduled tasks
- Webhook integrations for event-driven agents
- Agent orchestration (multi-agent workflows)
- Custom agent training/fine-tuning support
- Mobile apps (React Native)
- Desktop apps (Tauri)
- Plugin system for third-party extensions
- On-premise deployment option

---

## 9. Monetization

### Freemium Model

Memorix follows a freemium model where the core product is free and always will be. Premium tiers unlock advanced features, higher limits, and enterprise capabilities.

### Pricing Tiers

| Feature | Free | Pro ($19/mo) | Enterprise (Custom) |
|---------|------|--------------|-------------------|
| **Free LLM Access (Puter.js)** | Unlimited | Unlimited | Unlimited |
| **BYOK Providers** | 3 | 10 | Unlimited |
| **AI Agent Runs** | 100/day | 1,000/day | Unlimited |
| **Semantic Memory** | 1,000 notes | 50,000 notes | Unlimited |
| **MCP Server** | Local only | Remote + Local | Cluster deployment |
| **Team Members** | 1 | 5 | Unlimited |
| **API Rate Limit** | 60 req/min | 300 req/min | Custom |
| **Storage** | 1 GB | 50 GB | Unlimited |
| **Model Comparison** | 3 models | 10 models | Unlimited |
| **Analytics** | Basic | Advanced | Custom dashboards |
| **Support** | Community | Priority email | Dedicated CSM |
| **SLA** | Best effort | 99.5% | 99.9% |

### Revenue Streams

1. **SaaS Subscriptions** — Monthly/annual Pro and Enterprise plans
2. **IaaS API Access** — Pay-per-use API gateway for programmatic LLM access
3. **Agent Marketplace** — Commission on premium agent templates (future)
4. **Enterprise Licensing** — On-premise deployment with support contracts

### Revenue Projections (12 months)

| Quarter | MRR Target | Key Driver |
|---------|-----------|------------|
| Q1 | $1,000 | Early adopters, Pro tier launch |
| Q2 | $5,000 | Content marketing, agent marketplace |
| Q3 | $15,000 | Enterprise pilot programs |
| Q4 | $50,000 | SaaS/IaaS platform (v5.0) |

---

## 10. Risks and Mitigations

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Puter.js service downtime** | Medium | High | BYOK fallback, provider health checks, graceful degradation |
| **Puter.js changes pricing/terms** | Low | Critical | Diversified BYOK support, local Ollama option, provider abstraction |
| **LLM API breaking changes** | Medium | Medium | Versioned provider adapters, automated compatibility tests |
| **Database migration issues** | Low | Medium | Prisma managed migrations, rollback procedures, backup strategy |
| **Performance bottlenecks at scale** | Medium | High | PostgreSQL migration path, Redis caching, horizontal scaling |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Competitor launches free LLM hub** | Medium | Medium | First-mover advantage, 500+ model breadth, community moat |
| **Low free-to-paid conversion** | Medium | High | Clear Pro value props, usage-based nudges, agent marketplace |
| **LLM providers block Puter.js** | Low | Critical | Direct BYOK relationships, local model support, multi-provider diversification |
| **Security breach** | Low | Critical | Security audits, penetration testing, bug bounty program, encryption at rest |
| **Regulatory changes (AI compliance)** | Medium | Medium | Legal review, compliance monitoring, regional deployment options |

### Mitigation Strategy Summary

1. **Provider Diversity**: Never depend on a single LLM provider. Maintain Puter.js + 7 BYOK providers + local Ollama.
2. **Graceful Degradation**: If Puter.js is down, automatically route to BYOK. If BYOK fails, suggest local models.
3. **Data Portability**: All user data is exportable. No lock-in. SQLite/PostgreSQL with standard Prisma migrations.
4. **Open Source**: Core platform is open source, ensuring community trust and contribution.
5. **Security First**: API key encryption, rate limiting, input validation, HTTPS enforcement, regular audits.

---

*Document Version: 4.0.0 | Last Updated: March 2025*
