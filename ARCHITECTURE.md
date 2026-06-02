# Nanggroe IoT — Architecture

> System architecture documentation for Nanggroe IoT, a modular IoT & robotics platform.

---

## Table of Contents

- [System Overview](#system-overview)
- [System Architecture Diagram](#system-architecture-diagram)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Multi-Agent Architecture](#multi-agent-architecture)
- [Hardware Bridge Architecture](#hardware-bridge-architecture)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)

---

## System Overview

Nanggroe IoT is a full-stack IoT and robotics platform built on Next.js 16 with App Router. It provides a unified dashboard for managing robots, hardware, AI agents, missions, and telemetry across web, desktop (Tauri), and mobile (Capacitor) platforms.

### Design Principles

1. **Modular** — Each subsystem (agents, hardware, missions, etc.) is an independent module
2. **Offline-First** — SQLite + sync queue for disconnected operation
3. **Real-Time** — SSE for telemetry streaming, WebSocket for IDE extensions
4. **Multi-Agent** — 6 specialized agents coordinated by a central orchestrator
5. **Cross-Platform** — Same codebase for web, desktop, and mobile
6. **Type-Safe** — TypeScript strict mode throughout, Zod validation on critical routes

---

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Nanggroe IoT Platform                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Web App   │  │  Tauri App  │  │ Android App │                 │
│  │  (Browser)  │  │  (Desktop)  │  │ (Capacitor) │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          │                                           │
│  ┌───────────────────────▼───────────────────────────┐              │
│  │              Next.js 16 App Router                 │              │
│  │  ┌──────────────────────────────────────────────┐ │              │
│  │  │           React Frontend (Dashboard)          │ │              │
│  │  │  20 Tabs · 23 Components · 40+ UI Components │ │              │
│  │  │  Zustand State · TanStack Query · SSE Hooks   │ │              │
│  │  └──────────────────────────────────────────────┘ │              │
│  │  ┌──────────────────────────────────────────────┐ │              │
│  │  │            API Routes (42+ Endpoints)         │ │              │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │ │              │
│  │  │  │Agents│ │Hardw │ │Mission│ │Comms │ ...   │ │              │
│  │  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘       │ │              │
│  │  └─────┼────────┼────────┼────────┼─────────────┘ │              │
│  └────────┼────────┼────────┼────────┼────────────────┘              │
│           │        │        │        │                               │
│  ┌────────▼────────▼────────▼────────▼────────────────┐             │
│  │              Service Layer (28 Modules)             │             │
│  │  ┌──────────────────────────────────────────────┐  │             │
│  │  │         Agent Orchestrator (Singleton)        │  │             │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │  │             │
│  │  │  │Herm.│ │Pico.│ │Sent.│ │Nav. │ │Com. │  │  │             │
│  │  │  │     │ │     │ │     │ │     │ │     │  │  │             │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │  │             │
│  │  │              ┌─────┐                         │  │             │
│  │  │              │Data │                         │  │             │
│  │  │              │Stew.│                         │  │             │
│  │  │              └─────┘                         │  │             │
│  │  └──────────────────────────────────────────────┘  │             │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │             │
│  │  │ HW Bridge│ │  LLM Eng │ │  Telem.  │           │             │
│  │  └──────────┘ └──────────┘ └──────────┘           │             │
│  └───────────────────────┬───────────────────────────┘             │
│                          │                                           │
│  ┌───────────────────────▼───────────────────────────┐             │
│  │              Prisma ORM (SQLite)                   │             │
│  │              22 Models · Indexed Queries           │             │
│  └───────────────────────┬───────────────────────────┘             │
│                          │                                           │
│  ┌───────────────────────▼───────────────────────────┐             │
│  │           Hardware Abstraction Layer               │             │
│  │  Serial · I2C · SPI · GPIO · ADC                  │             │
│  │  Arduino · Pixhawk · Raspberry Pi                 │             │
│  └───────────────────────────────────────────────────┘             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Component Hierarchy

```
Layout (layout.tsx)
├── ThemeProvider (next-themes)
├── Dashboard (Dashboard.tsx)
│   ├── Sidebar (desktop navigation)
│   │   ├── Brand header ("NANGGROE IOT")
│   │   ├── System online indicator
│   │   ├── Region info
│   │   ├── 20 Navigation tabs
│   │   └── Version badge
│   ├── Tab Content Area
│   │   ├── Header (active tab title)
│   │   └── Active Tab Component
│   │       ├── OverviewTab
│   │       ├── TelemetryTab
│   │       ├── MissionsTab
│   │       ├── HardwareTab
│   │       ├── AgentsTab
│   │       ├── McpTab
│   │       ├── CalibrationTab
│   │       ├── LogsTab
│   │       ├── DoctorTab
│   │       ├── AssemblyTab
│   │       ├── DriversTab
│   │       ├── FlashTab
│   │       ├── TestingTab
│   │       ├── ExtensionTab
│   │       ├── RobotBuilderTab
│   │       ├── CommsTab
│   │       ├── NavigationTab
│   │       ├── PowerTab
│   │       ├── SelfLearnTab
│   │       └── FaceTrackingTab
│   └── MobileLayout (bottom navigation)
├── Error Boundary (error.tsx)
└── Loading State (loading.tsx)
```

### State Management

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Client State | Zustand | Active tab, UI toggles, local preferences |
| Server State | TanStack Query | API data fetching, caching, background refetch |
| Real-Time | SSE (`use-sse.ts`) | Telemetry streaming, alert streaming |
| Form State | React Hook Form + Zod | Mission creation, settings forms |
| Toast State | Sonner | User notifications and feedback |

### Data Fetching Pattern

```
Component → TanStack Query → API Route → Service Layer → Prisma → SQLite
                ↓ (cache)                                    ↑
          Background Refetch                          SSE Stream
```

1. **TanStack Query** manages API calls with automatic caching and background refetch
2. **API Routes** validate input, check auth, call service layer
3. **Service Layer** contains business logic, hardware communication
4. **Prisma** provides type-safe database access with indexed queries
5. **SSE** pushes real-time updates (telemetry, alerts) to the client

---

## Backend Architecture

### API Route Structure

Each API route follows a consistent pattern:

```
src/app/api/[resource]/
├── route.ts              # GET (list) + POST (create)
└── [id]/
    └── route.ts          # GET (read) + PUT (update) + DELETE (delete)
```

### Route Handler Pattern

```typescript
// Standard route handler structure
export async function GET(request: NextRequest) {
  // 1. API key authentication (for critical routes)
  const authError = validateApiKey(request)
  if (authError) return authError

  // 2. Input validation
  const validated = schema.safeParse(params)
  if (!validated.success) return errorResponse(400, validated.error)

  // 3. Business logic via service layer
  const result = await service.doSomething(validated.data)

  // 4. Return structured response
  return NextResponse.json({ success: true, data: result })
}
```

### Service Layer

28 service modules in `src/lib/`:

| Module | Responsibility |
|--------|---------------|
| `agents.ts` | Hermes (LLM) + PicoClaw (rule-based) agent logic |
| `agent-orchestrator.ts` | Task queue, message bus, lifecycle management |
| `agents-sentinel.ts` | Continuous safety monitoring |
| `agents-navigator.ts` | Route planning, obstacle avoidance |
| `agents-comms.ts` | Communication link monitoring, failover |
| `agents-data.ts` | Data pipeline health, anomaly detection |
| `auth.ts` | API key validation middleware |
| `ai-memory.ts` | Persistent AI memory with confidence scores |
| `beep-alerts.ts` | Buzzer alert pattern generation |
| `communication.ts` | Telegram bot, voice, GSM integration |
| `constants.ts` | Platform constants, safety thresholds |
| `db.ts` | Prisma client singleton |
| `drivers.ts` | Hardware driver registry |
| `extension.ts` | IDE extension bridge (VSCode, Cursor, etc.) |
| `face-tracking.ts` | Face detection and tracking engine |
| `flash.ts` | Firmware flash operations |
| `gsm-module.ts` | GSM cellular connectivity |
| `hardware-bridge.ts` | Serial, I2C, SPI, GPIO, ADC abstraction |
| `llm.ts` | Multi-model LLM engine |
| `mcp.ts` | MCP JSON-RPC 2.0 protocol |
| `navigation.ts` | GPS tracking, autopilot, RTH |
| `power.ts` | Battery, solar, power management |
| `robot-templates.ts` | 9 robot project templates |
| `self-learn.ts` | Pattern detection and knowledge transfer |
| `sensor-config.ts` | Sensor configuration management |
| `simulator.ts` | Hardware simulation for development |
| `telemetry.ts` | Telemetry aggregation and snapshots |
| `testing.ts` | AI-powered test generation |

### Database Design

- **ORM**: Prisma with SQLite
- **22 Models** with JSON fields for flexible configuration
- **Performance Indexes** on frequently queried fields
- **Cascade Deletes** on related records
- **Soft Timestamps** (`createdAt`, `updatedAt`) on all models

---

## Multi-Agent Architecture

### Agent Overview

```
┌─────────────────────────────────────────────────────┐
│                Agent Orchestrator                     │
│                  (Singleton)                         │
│                                                      │
│  ┌──────────┐    Message Bus (EventEmitter)         │
│  │  Hermes   │◄─────────────────────────┐           │
│  │  (LLM)   │                          │           │
│  └────┬─────┘                          │           │
│       │ escalate                       │           │
│       ▼                                │           │
│  ┌──────────┐    ┌──────────┐    ┌─────┴────┐     │
│  │ Sentinel  │───►│ Navigator │───►│CommsGuard│     │
│  │  (Rule)   │    │ (Hybrid)  │    │  (Rule)  │     │
│  └────┬─────┘    └──────────┘    └──────────┘     │
│       │ alert                       │              │
│       ▼                             │ failover     │
│  ┌──────────┐    ┌──────────┐      │              │
│  │ PicoClaw  │    │  Data    │◄─────┘              │
│  │  (Rule)   │    │ Steward  │                     │
│  └──────────┘    │  (Rule)   │                     │
│                  └──────────┘                       │
│                                                      │
│  Task Queue (Priority: critical > high > normal > low) │
│  Auto-Recovery · DB Persistence · Audit Trail       │
└─────────────────────────────────────────────────────┘
```

### Agent Types

| Type | Description | Agents |
|------|-------------|--------|
| **LLM** | Uses AI model for reasoning | Hermes |
| **Rule** | Deterministic rule-based logic | PicoClaw, Sentinel, CommsGuard, DataSteward |
| **Hybrid** | Combines rules with AI | Navigator |

### Orchestrator Lifecycle

1. **Register** — All 6 agents register with the orchestrator
2. **Initialize** — Each agent's `initialize()` is called
3. **Start** — Each agent's `start()` is called, background loops begin
4. **Tick** — Every 5 seconds:
   - Process task queue (priority-sorted)
   - Auto-recover crashed agents
   - Process DB-backed tasks
5. **Message** — Inter-agent communication via message bus
6. **Stop** — Clean shutdown of all agents and loops

### Task Flow

```
Operator Request → API Route → Orchestrator.submitTask()
                                     │
                                     ▼
                              Task Queue (sorted by priority)
                                     │
                                     ▼
                         Agent.processTask(task)
                                     │
                                     ▼
                         Task Result (completed/failed)
                                     │
                                     ▼
                         DB Persistence (AgentTaskRecord)
```

### Inter-Agent Communication

| From | To | Type | Trigger |
|------|----|------|---------|
| Sentinel | Hermes | escalation | Critical safety condition |
| Sentinel | * (broadcast) | status | Safety check result |
| Navigator | * (broadcast) | alert | Route adjustment needed |
| CommsGuard | Sentinel | alert | Signal degradation |
| CommsGuard | * (broadcast) | alert | Failover event |
| DataSteward | Sentinel | alert | Critical data anomaly |
| DataSteward | * (broadcast) | status | Stale data warning |

---

## Hardware Bridge Architecture

```
┌─────────────────────────────────────────────────┐
│                Hardware Bridge                    │
│                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │ Serial  │ │   I2C   │ │   SPI   │ │  GPIO  ││
│  │ Bridge  │ │ Bridge  │ │ Bridge  │ │ Bridge ││
│  └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘│
│       │           │           │           │      │
│  ┌────▼───────────▼───────────▼───────────▼────┐│
│  │           Bus Abstraction Layer              ││
│  └────────────────────┬────────────────────────┘│
│                       │                          │
│  ┌────────────────────▼────────────────────────┐│
│  │            Device HAL Adapters               ││
│  │  Pixhawk · RPi · BME280 · MPU6050 · GPS    ││
│  └────────────────────┬────────────────────────┘│
│                       │                          │
└───────────────────────┼──────────────────────────┘
                        │
           ┌────────────▼────────────┐
           │   Physical Hardware     │
           │  Arduino · RPi · Sensors│
           └─────────────────────────┘
```

### Bus Types

| Bus | Path Pattern | Protocols | Devices |
|-----|-------------|-----------|---------|
| Serial | `/dev/ttyUSB*`, `/dev/ttyACM*` | UART, MAVLink | Pixhawk, GPS |
| I2C | `/dev/i2c-*` | I2C (addresses 0x03–0x77) | BME280, MPU6050 |
| SPI | `/dev/spidev*` | SPI (4 wire) | ADC, Display |
| GPIO | `/sys/class/gpio/*` | Digital I/O, PWM | Relays, Servos, LEDs |
| ADC | `/sys/bus/iio/devices/*` | Analog read | Voltage dividers |

### Auto-Detection Flow

```
1. USB VID/PID Scan → Identify known devices
2. Serial Port Enum → Find /dev/ttyUSB*, /dev/ttyACM*
3. I2C Bus Probe → Scan addresses 0x03–0x77
4. SPI Device Check → Verify /dev/spidev* nodes
5. GPIO Availability → Check /sys/class/gpio/*
6. Match Known Profiles → Auto-load drivers
7. Initialize Devices → Set status to "active"
```

---

## Data Flow Diagrams

### Telemetry Flow

```
Sensor → Hardware Bridge → Telemetry Service → SQLite
                                              │
                                              ├──► SSE Stream → Dashboard
                                              ├──► Sentinel Agent → Safety Check
                                              ├──► DataSteward Agent → Anomaly Detection
                                              └──► AI Memory → Pattern Learning
```

### Mission Flow

```
Operator → Dashboard → POST /api/missions
                            │
                            ├──► Hermes Agent (AI plan)
                            ├──► Navigator Agent (route check)
                            ├──► Sentinel Agent (safety check)
                            └──► SQLite (persist)
                                    │
                                    ├──► Autopilot Execution
                                    ├──► SSE Stream (progress)
                                    └──► Mission Logs
```

### Alert Flow

```
Telemetry Data → Sentinel Agent
                    │
                    ├──► Warning? → Create Alert → Dashboard Badge
                    │
                    └──► Critical? → Emergency Action
                                      │
                                      ├──► RTH/Land Command
                                      ├──► Escalate to Hermes
                                      ├──► CommsGuard Notify
                                      └──► Dashboard Alert Banner
```

### Communication Failover Flow

```
Radio Link ──► CommsGuard Monitor
                   │
                   ├── Signal OK → Continue
                   │
                   └── Signal Degraded
                          │
                          ├──► Try GSM Backup
                          │      │
                          │      ├── Success → Switch to GSM
                          │      └── Fail → Try WiFi
                          │
                          └──► All Failed → Alert Operator
```

---

## Security Architecture

```
┌──────────────────────────────────────────────┐
│              Security Layers                  │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Layer 1: Network (Caddy Reverse Proxy) │ │
│  │  HTTPS · Rate Limiting · CORS           │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Layer 2: Authentication (API Key)      │ │
│  │  NANGGROE_API_KEY · Bearer Token        │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Layer 3: Input Validation (Zod)        │ │
│  │  Schema validation on critical routes   │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Layer 4: Command Injection Protection  │ │
│  │  Input sanitization · No shell exec     │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Layer 5: CSP Headers (Tauri)           │ │
│  │  Content Security Policy · Script Src   │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Layer 6: Database (Prisma)             │ │
│  │  Parameterized queries · No raw SQL     │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Security Measures

| Measure | Implementation | Scope |
|---------|---------------|-------|
| API Key Auth | `validateApiKey()` middleware | MCP, system, critical routes |
| Command Injection | Input sanitization, no shell execution | All routes with hardware access |
| CSP Headers | Tauri CSP configuration | Desktop app builds |
| Input Validation | Zod schemas on critical routes | POST/PUT endpoints |
| SQL Injection | Prisma parameterized queries | All database access |
| XSS | React auto-escaping, CSP | Frontend rendering |
| CSRF | Same-site cookies, API key | State-changing requests |
| Error Boundaries | React error boundaries | Component crash recovery |

---

## Deployment Architecture

### Web Deployment

```
Developer → git push → GitHub → CI (lint + test + build)
                                  │
                                  ├──► Vercel (auto-deploy)
                                  ├──► Docker Hub (container image)
                                  └──► Standalone (Node.js server)
```

### Desktop Deployment (Tauri)

```
Next.js Build → Static Export → Tauri WebView Wrapper → Native Installer
                                     │
                                     ├──► Linux: .deb + .AppImage
                                     └──► Windows: .msi + .exe (NSIS)
```

### Mobile Deployment (Capacitor)

```
Next.js Build → Static Export → Capacitor Sync → Android Studio → APK/AAB
```

### Raspberry Pi Deployment

```
┌──────────────────────────────────────────────┐
│           Raspberry Pi 4B                    │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Nanggroe IoT (Node.js / Bun)           │ │
│  │  Port 3000                              │ │
│  └────────────────┬────────────────────────┘ │
│                   │                           │
│  ┌────────────────▼────────────────────────┐ │
│  │  Hardware Bridge (serialport)           │ │
│  │  /dev/ttyACM0 → Pixhawk                 │ │
│  │  /dev/i2c-1 → BME280, MPU6050          │ │
│  │  GPIO → Relays, Servos                  │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Caddy (Reverse Proxy)                  │ │
│  │  HTTPS on :443 → localhost:3000         │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  SQLite Database                        │ │
│  │  /home/pi/nanggroe-iot/db/              │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Platform Matrix

| Platform | Runtime | Installer | Hardware Access |
|----------|---------|-----------|-----------------|
| Web | Node.js / Bun | Docker / Vercel | Via host serial |
| Desktop (Linux) | Tauri (WebView) | .deb / .AppImage | Direct via Rust |
| Desktop (Windows) | Tauri (WebView) | .msi / .exe | Direct via Rust |
| Mobile (Android) | Capacitor | .apk / .aab | Via BLE/USB OTG |
| Raspberry Pi | Node.js / Bun | systemd service | Direct GPIO/I2C/SPI |

---

## Performance Considerations

### Database

- **Indexes** on `status`, `type`, `timestamp`, `agent`, `metric` fields
- **N+1 Prevention** using Prisma `include` for eager loading
- **Connection Pooling** via Prisma client singleton
- **SQLite WAL Mode** for concurrent read/write performance

### Frontend

- **Code Splitting** via Next.js App Router (each tab loads independently)
- **TanStack Query Caching** reduces redundant API calls
- **SSE Reconnection** with exponential backoff
- **Skeleton Loading** prevents layout shift

### Agent System

- **Task Queue Priority** ensures critical tasks run first
- **Max Concurrent Agents** (default: 6) prevents resource exhaustion
- **Auto-Recovery** restarts crashed agents automatically
- **Communication Log Bounded** to 200 entries max in memory

---

*Last updated: 2025*
