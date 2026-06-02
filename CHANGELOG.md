# Changelog

All notable changes to **Nanggroe IoT** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **API Key Authentication** — `NANGGROE_API_KEY` environment variable for critical route protection
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

- **Renamed from "Nanggroe OS AI" to "Nanggroe IoT"** across all codebase and documentation
- Updated all agent system prompt references from "NANGGROE OS AI" to "NANGGROE IOT"
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

[2.0.0]: https://github.com/mulkymalikuldhrs/nanggroe-iot/releases/tag/v2.0.0
[1.0.0]: https://github.com/mulkymalikuldhrs/nanggroe-iot/releases/tag/v1.0.0
