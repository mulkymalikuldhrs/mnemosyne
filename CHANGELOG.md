# Changelog

All notable changes to **Memorix AI Memory** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] — 2026-06-07

### Added

#### Universal AI/Human Memory Hub
- **Cloud Storage Hub** — Multi-cloud storage integration (Google Drive, TeraBox, S3-compatible, Dropbox, OneDrive, Local filesystem)
- **Email Hub** — Email integration (Gmail API, IMAP/SMTP, Outlook) with AI-powered summaries
- **Composio MCP Integration** — 250+ service connectors via Composio managed MCP servers
- **Temporal Knowledge Graph** — Entity-relationship memory with time-travel queries (validFrom/validTo)
- **Agent Hub** — AI agent profiles with MCP access, system prompts, and capability management
- **SaaS/IaaS Subscription** — Plan-based billing (Free/Pro/Enterprise/IaaS) with Stripe integration

#### Multi-Cloud Storage
- Abstract `CloudStorageProviderInterface` with 8 standard methods
- Google Drive adapter with OAuth2, pagination, rate limiting, multipart upload
- TeraBox adapter with cookie-based auth (best-effort, documented limitations)
- S3-compatible adapter (AWS S3, MinIO, Cloudflare R2) with AWS Signature V4
- Local filesystem adapter for self-hosted/IaaS deployments
- `StorageManager` orchestrator with account sync, file ingestion, cross-provider search
- Smart ingestion pipeline: download → text extraction → create Note → chunk → embed

#### Email Integration
- `EmailProviderInterface` with 7 standard methods
- Gmail REST API provider with OAuth2, token refresh, Base64URL MIME
- IMAP/SMTP provider for any mail server (RFC 2822, RFC 2047)
- `EmailManager` orchestrator with incremental sync, AI summarization
- Email ingestion into memory (extract text → create Note → store chunks)
- AI-powered email summaries via z-ai-web-dev-sdk

#### Temporal Knowledge Graph
- `MemoryEntity` model — people, projects, concepts, topics, organizations, tools, events
- `MemoryRelation` model — typed edges with temporal validity (validFrom/validTo)
- `TemporalSnapshot` model — point-in-time graph snapshots for time-travel queries
- Graph rebuild from existing notes and decisions
- Entity search, relation creation, time-travel API

#### Agent Profiles
- `AgentProfile` model with system prompts, capabilities, MCP access toggle
- Agent CRUD API for creating/managing AI agent identities
- MCP session management per agent profile
- Active agent selection on User model

#### PWA Support
- Dynamic web app manifest with Memorix v3 branding
- Service worker with three caching strategies (cache-first, network-first, stale-while-revalidate)
- Background sync for offline note creation via IndexedDB
- Push notification support
- `usePWA()` hook with install prompt, update detection, online/offline status
- PWA registration component with install banner, update banner, offline indicator

#### API Routes (22 new endpoints)
- `/api/storage/*` — 6 endpoints for cloud storage management
- `/api/email/*` — 7 endpoints for email integration
- `/api/integrations/*` — 2 endpoints for Composio/custom integrations
- `/api/entities/*` — 3 endpoints for temporal knowledge graph
- `/api/graph/temporal` — 1 endpoint for time-travel queries
- `/api/agents/*` — 2 endpoints for agent profiles
- `/api/subscription` — 1 endpoint for SaaS billing

#### Dashboard Views (5 new sections)
- **Storage Hub** — Cloud account cards, file browser, sync, ingest-to-memory
- **Email Hub** — Account management, message list, AI summary, ingest
- **Integrations** — Connected services with enable/disable toggles
- **Temporal Graph** — Entity list with type badges, time-travel slider, graph visualization
- **Agent Hub** — Agent profiles with system prompt editor, MCP access toggle

### Changed
- **Version bumped from 2.0.0 to 3.0.0**
- Renamed from "Personal AI Memory Infrastructure" to "Universal AI/Human Memory Hub"
- Expanded Prisma schema from 16 to 25+ models
- Expanded API routes from 20+ to 42+ endpoints
- Expanded dashboard from 11 to 16 sections
- Updated sidebar navigation with 5 new sections
- Updated Zustand store with new active section types
- Updated API utility with 18 new methods
- Updated description and keywords in package.json

---

## [2.0.0] — 2025-03-04

### Added

#### Multi-Agent System (6 Agents + Orchestrator)
- **Hermes** — LLM-powered strategic planning agent (z-ai-web-dev-sdk)
- **PicoClaw** — Rule-based tactical safety agent
- **Sentinel** — Continuous telemetry monitoring agent with emergency action trigger
- **Navigator** — Hybrid route planning and obstacle avoidance agent
- **CommsGuard** — Communication link monitoring and failover agent
- **DataSteward** — Data pipeline health, anomaly detection, and cleanup agent
- **Agent Orchestrator** — Singleton coordinator with task queue, message bus, auto-recovery, and DB persistence
- Inter-agent communication via message bus (EventEmitter)
- Agent orchestration API (`/api/agents/orchestrate`)
- Sentinel safety monitoring API (`/api/agents/sentinel`)
- `AgentTaskRecord` Prisma model for persistent task queue

#### Testing (183 Playwright E2E Tests)
- 8 spec files covering all major dashboard features
- `dashboard.spec.ts` — Dashboard, navigation, branding, tab switching (29 tests)
- `api-health.spec.ts` — API endpoint health, response times, error handling (31 tests)
- `agents.spec.ts` — Agent tab, chat, quick commands (18 tests)
- `hardware.spec.ts` — Hardware scan, device list, status filter (15 tests)
- `missions.spec.ts` — Mission creation, status, detail, abort (15 tests)
- `navigation.spec.ts` — Navigation types, RTH, delivery, field mapping (22 tests)
- `flash.spec.ts` — Firmware flash, code deploy, device selection (14 tests)
- `power.spec.ts` — Power sources, battery, solar, emergency mode (15 tests)
- Shared fixtures with mock API responses and helper functions
- `playwright.config.ts` with CI configuration

#### Security
- **API Key Authentication** — `MEMORIX_API_KEY` environment variable for critical route protection
- **Command Injection Protection** — Input sanitization on all hardware communication routes
- **CSP Headers** — Content Security Policy configured in Tauri desktop builds
- **Input Validation** — Zod schema validation on critical POST/PUT endpoints
- `src/lib/auth.ts` — API key validation middleware (`validateApiKey()`)

#### Database Performance
- **Performance Indexes** added to key query fields:
  - `HardwareDevice`: `deviceType`, `status`
  - `TelemetryReading`: `deviceId`, `metric`, `timestamp`
  - `Mission`: `status`, `type`
  - `AgentMessage`: `agent`, `timestamp`
  - `Alert`: `isRead`, `level`, `timestamp`
  - `AgentTaskRecord`: `agent`, `status`, `priority`
- **N+1 Query Optimization** — Prisma queries updated with proper `include` for eager loading

#### Frontend Quality
- **Error Boundaries** — React error boundaries with graceful fallback UI (`error.tsx`)
- **Loading States** — Skeleton loading patterns across all dashboard tabs (`loading.tsx`)
- **Frontend-Backend Connection Fixes** — Resolved API integration issues between dashboard components and API routes
- **20 Dashboard Tabs** — All tabs render without crash with proper data-testid attributes

### Changed

- **Renamed from "Nanggroe OS AI" to "Memorix AI Memory"** across all codebase and documentation
- Updated all agent system prompt references from "MEMORIX OS AI" to "MEMORIX IOT"
- Expanded Prisma schema from 18 to 22 models (added `AgentTaskRecord`, `LearningRecord`)
- Expanded lib modules from 22 to 28 service modules
- Expanded API routes from 40+ to 42+ endpoints
- Expanded dashboard tabs from 21 to 20 (consolidated and refined)
- Version bumped from 1.0.0 to 2.0.0

### Documentation
- Updated `README.md` with v2.0.0 features and new name
- Created `ARCHITECTURE.md` — System architecture documentation
- Created `API.md` — Comprehensive API reference (42+ endpoints)
- Created `AGENTS.md` — Agent system documentation
- Created `TESTING.md` — E2E testing guide
- Created `DEPLOYMENT.md` — Deployment guide (Web, Desktop, Android, RPi)
- Updated `SECURITY.md` with new security measures
- Updated `CHANGELOG.md` with v2.0.0 release notes

---

## [1.0.0] — 2025-01-01

### Added

#### Core Platform
- Next.js 16 App Router dashboard with tab modules
- Prisma ORM with SQLite — 18 database models
- 40+ API routes covering all platform subsystems
- 22 lib service modules with real implementations
- Zustand client state management + TanStack Query server state
- Responsive mobile layout with Capacitor Android support
- Tauri v2 desktop app packaging (Linux DEB/AppImage, Windows MSI/NSIS)
- Comprehensive .gitignore for all platforms

#### Hardware & Drivers
- Hardware Bridge service — Serial, I2C, SPI, GPIO, ADC abstraction
- Auto-detect hardware via USB VID/PID scanning
- Driver management API with install/scan/load capabilities
- HardwareBusState model for bus monitoring
- Support for Arduino, Pixhawk, Raspberry Pi, and custom boards

#### AI & Agents
- LLM Engine — z-ai-web-dev-sdk integration (TinyLlama, Phi-2, Llama-3.2, Gemma-2, Qwen2.5)
- Multi-agent system — Hermes (cloud) and PicoClaw (local) agents
- AI Memory with sync queue for offline-first operation
- Self-Learning module — pattern detection, auto-tune, knowledge transfer
- AI-powered testing service with coverage analysis
- Agent chat API with conversation history

#### Robotics Features
- 9 robot templates (Tricopter, Quadcopter, Rover, Boat, Amphibious, Arm, Blimp, Hexacopter, Custom)
- Robot Builder with step-by-step assembly guides
- Mission planning with waypoints, area polygons, and overlap settings
- Navigation — GPS tracking, autopilot, RTH (Return-To-Home), field mapping
- Face Tracking — detection, tracking, face database, servo control
- Calibration — compass, accelerometer, gyro, ESC, radio
- Telemetry — real-time data streaming via SSE

#### Communications
- Telegram Bot integration (Hermes agent)
- Voice/TTS support
- Beep alert patterns
- GSM module connectivity
- WebSocket extension bridge for VSCode/Cursor/Neovim/JetBrains

#### Power & Infrastructure
- Power management — battery, solar panel, GSM monitoring
- System Doctor — health check, diagnostics, repair
- Firmware flasher with verification
- MCP Protocol — JSON-RPC 2.0 implementation
- Boot flow manager

#### Developer Experience
- Full TypeScript strict mode — zero compilation errors
- shadcn/ui component library with 40+ components
- ESLint configuration
- Prisma seed script with sample data
- Comprehensive API documentation

#### Documentation
- README.md with full setup, architecture, and API reference
- CONTRIBUTING.md with guidelines and code style
- SECURITY.md with vulnerability reporting process
- AUTHORS.md with contributor credits
- MIT License
- .env.example with all configuration options
- .github/ issue templates, PR template, and CI workflow

### Technical Details
- **Framework**: Next.js 16 (App Router) + React 19
- **Desktop**: Tauri v2 (Rust backend)
- **Mobile**: Capacitor (Android)
- **Language**: TypeScript 5 (strict) + Rust
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Prisma ORM (SQLite)
- **State**: Zustand (client) + TanStack Query (server)
- **AI SDK**: z-ai-web-dev-sdk

[2.0.0]: https://github.com/mulkymalikuldhrs/memorix-ai/releases/tag/v2.0.0
[1.0.0]: https://github.com/mulkymalikuldhrs/memorix-ai/releases/tag/v1.0.0
