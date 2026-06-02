# Nanggroe IoT — Agent System

> Documentation for the 6-agent system and Agent Orchestrator in Nanggroe IoT.

---

## Table of Contents

- [Overview](#overview)
- [Agent Architecture](#agent-architecture)
- [Agent Profiles](#agent-profiles)
- [Agent Orchestrator](#agent-orchestrator)
- [Task Queue System](#task-queue-system)
- [Inter-Agent Communication](#inter-agent-communication)
- [Configuration Options](#configuration-options)
- [API Endpoints for Agent Control](#api-endpoints-for-agent-control)
- [Safety Monitoring (Sentinel)](#safety-monitoring-sentinel)
- [Example Workflows](#example-workflows)

---

## Overview

Nanggroe IoT uses a multi-agent architecture with 6 specialized agents coordinated by a central orchestrator. Each agent has a specific domain of responsibility and can communicate with other agents through a message bus.

### Agent Roster

| Agent | Type | Role | Check Interval |
|-------|------|------|---------------|
| **Hermes** | LLM | Strategic planning, mission design, natural language | On-demand |
| **PicoClaw** | Rule | Tactical safety checks, failsafe execution | On-demand |
| **Sentinel** | Rule | Continuous telemetry monitoring, emergency actions | 2s |
| **Navigator** | Hybrid | Route planning, obstacle avoidance, rerouting | 3s |
| **CommsGuard** | Rule | Communication link monitoring, failover | 3s |
| **DataSteward** | Rule | Data pipeline health, anomaly detection | 5s |

### Agent Types

- **LLM** — Uses AI language model for reasoning and natural language understanding
- **Rule** — Deterministic rule-based logic with configurable thresholds
- **Hybrid** — Combines rule-based checks with AI-assisted recommendations

---

## Agent Architecture

### AgentInstance Interface

All agents implement the `AgentInstance` interface:

```typescript
interface AgentInstance {
  name: string                    // Unique agent identifier
  type: AgentType                 // 'llm' | 'rule' | 'hybrid'
  state: AgentState               // 'idle' | 'thinking' | 'acting' | 'waiting' | 'error'
  capabilities: string[]          // List of agent capabilities

  // Lifecycle
  initialize(): Promise<void>     // Set up agent resources
  start(): Promise<void>          // Begin agent operation
  stop(): Promise<void>           // Graceful shutdown

  // Processing
  processTask(task: AgentTask): Promise<unknown>  // Execute a task

  // Communication
  onMessage(message: AgentMessage): void          // Handle incoming message

  // Status
  getStatus(): AgentStatus        // Get current agent status
}
```

### Agent Lifecycle States

```
idle → thinking → acting → idle
  │                              │
  └── error ←─────── error ←────┘
       │
       └── (auto-recovery) → idle → start()
```

| State | Description |
|-------|-------------|
| `idle` | Agent is ready but not actively processing |
| `thinking` | Agent is processing input (LLM inference) |
| `acting` | Agent is performing an action |
| `waiting` | Agent is waiting for external input |
| `error` | Agent encountered an error (auto-recoverable) |

---

## Agent Profiles

### Hermes — Strategic Planning Agent

| Property | Value |
|----------|-------|
| **Name** | `hermes` |
| **Type** | LLM |
| **SDK** | z-ai-web-dev-sdk |
| **Model** | default (cloud) |

**Capabilities**:
- `mission_planning` — Design missions from natural language
- `route_optimization` — Optimize waypoint routes
- `terrain_analysis` — Analyze terrain for mission planning
- `weather_assessment` — Evaluate weather conditions
- `battery_estimation` — Estimate flight time from battery data
- `strategic_recommendation` — High-level mission recommendations
- `natural_language_chat` — Conversational AI interface

**System Prompt Region**: Aceh Utara, Indonesia (4.9°N, 97.1°E) — coastal, tropical climate

**How it works**:
1. Receives prompt via `/api/agents/chat`
2. Builds context from current telemetry, mission, devices, alerts
3. Calls z-ai-web-dev-sdk for LLM inference
4. Returns structured JSON response with type, content, priority

**Response Format**:
```json
{
  "type": "mission_plan" | "recommendation" | "alert" | "status" | "clarification",
  "content": "Human-readable explanation",
  "data": { ... },
  "priority": "low" | "medium" | "high" | "critical"
}
```

---

### PicoClaw — Tactical Safety Agent

| Property | Value |
|----------|-------|
| **Name** | `picoclaw` |
| **Type** | Rule |
| **Trigger** | On-demand (via task or message) |

**Capabilities**:
- `safety_check` — Comprehensive telemetry safety analysis
- `battery_monitoring` — Voltage threshold checking
- `signal_monitoring` — Signal strength analysis
- `altitude_monitoring` — Altitude limit enforcement
- `temperature_monitoring` — Temperature threshold checking
- `motor_asymmetry_detection` — Motor RPM deviation detection
- `failsafe_execution` — RTH, land, reduce speed actions

**Safety Thresholds**:

| Metric | Warning | Critical |
|--------|---------|----------|
| Battery Voltage | 13.2V | 12.6V |
| Signal Strength | -70 dBm | -80 dBm |
| Altitude | 110m | 120m |
| Temperature | 40°C | 50°C |
| Current Draw | 25A | 30A |
| Speed | 12 m/s | 15 m/s |
| Motor RPM Asymmetry | 8% | 15% |

**Check Flow**:
1. Receive telemetry snapshot
2. Evaluate each metric against thresholds
3. Generate alerts (warning/critical)
4. Determine actions (RTH, land, reduce speed, alert operator)
5. Return `{ safe, alerts, actions }`

---

### Sentinel — Continuous Safety Monitor

| Property | Value |
|----------|-------|
| **Name** | `sentinel` |
| **Type** | Rule |
| **Check Interval** | 2000ms (configurable) |

**Capabilities**:
- `continuous_telemetry_monitoring` — Background safety monitoring loop
- `safety_threshold_checking` — Uses PicoClaw's check logic
- `emergency_action_trigger` — Auto-trigger RTH/land on consecutive criticals
- `alert_generation` — Create alerts in database
- `hermes_escalation` — Escalate critical issues to Hermes
- `telemetry_staleness_detection` — Detect stale data

**How it differs from PicoClaw**:
- PicoClaw is **on-demand** — called when needed
- Sentinel is **continuous** — runs a background monitoring loop
- Sentinel can **auto-trigger emergency actions** (RTH, land)
- Sentinel tracks **consecutive critical count** for escalation
- Sentinel **detects stale telemetry** (no data for >10s)

**Emergency Action Logic**:
1. First critical check → Generate alert
2. Second consecutive critical → Auto-trigger emergency action (RTH/land)
3. Escalate to Hermes for strategic response

**Escalation Flow**:
```
Sentinel detects critical
    │
    ├──► Create Alert in DB
    │
    └──► Send escalation to Hermes (via message bus)
              │
              └──► Hermes formulates strategic response
```

---

### Navigator — Route Planning Agent

| Property | Value |
|----------|-------|
| **Name** | `navigator` |
| **Type** | Hybrid |
| **Check Interval** | 3000ms (configurable) |

**Capabilities**:
- `route_planning` — Waypoint sequence optimization
- `waypoint_processing` — Waypoint validation and calculation
- `dynamic_rerouting` — Real-time route adjustment
- `obstacle_avoidance` — Terrain, weather, no-fly zone detection
- `wind_adjustment` — Speed reduction in high wind
- `battery_aware_navigation` — RTH trigger on low battery
- `altitude_optimization` — Safe altitude maintenance

**Navigation Adjustment Types**:

| Type | Priority | Trigger |
|------|----------|---------|
| `reroute` | High | Signal weakness, no-fly zone |
| `speed_adjustment` | Medium | High wind, high temperature |
| `altitude_change` | Medium | Near regulatory limit |
| `hover` | Critical | Motor asymmetry |
| `rth` | Critical | Low battery, signal loss |
| `skip_waypoint` | Low | Unreachable waypoint |

**Default Configuration**:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `checkInterval` | 3000ms | Navigation check frequency |
| `rerouteThreshold` | 50m | Deviation before rerouting |
| `windSpeedLimit` | 10 m/s | Max safe wind speed |
| `lowBatteryRthPercent` | 25% | Battery % to trigger RTH |
| `maxWaypointDistance` | 500m | Max distance between waypoints |
| `altitudeMargin` | 20m | Clearance above obstacles |

---

### CommsGuard — Communication Guard Agent

| Property | Value |
|----------|-------|
| **Name** | `comms_guard` |
| **Type** | Rule |
| **Check Interval** | 3000ms (configurable) |

**Capabilities**:
- `link_monitoring` — Monitor all communication links
- `signal_quality_tracking` — Signal strength and latency tracking
- `failover_management` — Automatic channel failover
- `connection_retry` — Retry failed connections
- `heartbeat_monitoring` — Detect dead connections
- `operator_alerting` — Alert operator on communication issues

**Failover Priority**: `radio → gsm → wifi → telemetry`

**Communication Link Status**:

| Status | Description |
|--------|-------------|
| `connected` | Link is healthy |
| `degraded` | Signal below warning threshold |
| `failing` | Signal below critical threshold |
| `lost` | No heartbeat within timeout |
| `unknown` | No data available |

**Failover Flow**:
1. Detect signal below critical threshold or heartbeat timeout
2. Search for backup channel by priority order
3. Attempt failover to best available backup
4. If failover succeeds → continue on backup channel
5. If failover fails → retry up to max attempts
6. If all retries exhausted → alert operator

---

### DataSteward — Data Pipeline Agent

| Property | Value |
|----------|-------|
| **Name** | `data_steward` |
| **Type** | Rule |
| **Check Interval** | 5000ms (configurable) |

**Capabilities**:
- `data_freshness_monitoring` — Check data staleness per metric
- `sensor_anomaly_detection` — Detect stuck values and outliers
- `stuck_value_detection` — Consecutive identical readings
- `outlier_detection` — Values >3 std devs from mean
- `data_sync_management` — Monitor sync queue health
- `data_cleanup_archival` — Delete old telemetry data
- `pipeline_health_monitoring` — Overall pipeline status

**Anomaly Types**:

| Type | Severity | Detection |
|------|----------|-----------|
| `stuck_value` | Critical | N consecutive identical readings |
| `outlier` | Warning | Value >N std devs from mean |
| `drift` | Warning | Data is older than threshold |
| `missing` | Warning | No readings for a metric |

**Default Staleness Thresholds** (partial):

| Metric | Threshold |
|--------|-----------|
| `battery_voltage` | 5s |
| `gps_lat`, `gps_lng` | 3s |
| `altitude` | 3s |
| `signal_strength` | 5s |
| `temperature` | 10s |
| `heading` | 3s |
| `motor_rpm_*` | 3s |

---

## Agent Orchestrator

### Overview

The `AgentOrchestrator` is a singleton class that coordinates all 6 agents. It manages:

- Agent registration and lifecycle
- Task queue with priority scheduling
- Inter-agent message bus
- Auto-recovery for crashed agents
- DB-backed task persistence

### Configuration

```typescript
interface AgentOrchestratorConfig {
  tickInterval: number            // ms between orchestration cycles (default: 5000)
  safetyMonitorInterval: number   // ms between safety checks (default: 2000)
  maxConcurrentAgents: number     // max agents running simultaneously (default: 6)
  autoRecovery: boolean           // auto-restart crashed agents (default: true)
}
```

### Orchestrator Tick Cycle

Every 5 seconds (configurable):

```
1. Process Task Queue
   ├── Sort by priority (critical > high > normal > low)
   ├── Find available slots (up to maxConcurrentAgents)
   ├── Execute pending tasks via agent.processTask()
   └── Clean up completed/failed tasks (keep last 100)

2. Auto-Recovery
   ├── Find agents in 'error' state
   ├── Stop → Initialize → Start each crashed agent
   └── Log recovery attempt

3. Process DB Tasks
   ├── Query pending AgentTaskRecords
   ├── Assign to registered agents
   └── Update DB with results
```

### Starting the Orchestrator

```typescript
// Get singleton instance
const orchestrator = AgentOrchestrator.getInstance()

// Register all 6 default agents
orchestrator.registerDefaultAgents()

// Start the orchestrator
await orchestrator.start()
```

---

## Task Queue System

### Task Lifecycle

```
pending → running → completed
                  └── failed
```

### In-Memory Task Queue

Tasks can be submitted to the in-memory queue for immediate processing:

```typescript
const taskId = orchestrator.submitTask({
  type: 'safety_check',
  agent: 'sentinel',
  priority: 'critical',
  payload: { action: 'manual_check' }
})
```

### DB-Backed Task Queue

For persistent tasks that survive restarts:

```typescript
const taskId = await orchestrator.submitTaskToDb({
  type: 'navigation',
  agent: 'navigator',
  priority: 'high',
  payload: { action: 'evaluate_route', waypoints: [...] },
  missionId: 'mission-001',
  projectId: 'proj-001'
})
```

### Task Priority

| Priority | Weight | Use Cases |
|----------|--------|-----------|
| `critical` | 0 | Emergency RTH, signal loss, battery critical |
| `high` | 1 | Safety warnings, route adjustments, failover |
| `normal` | 2 | Regular checks, status queries, data analysis |
| `low` | 3 | Cleanup, archival, non-urgent reports |

### AgentTaskRecord Model

Tasks submitted via `submitTaskToDb` are persisted in the `AgentTaskRecord` Prisma model with indexes on `agent`, `status`, and `priority`.

---

## Inter-Agent Communication

### Message Bus

The orchestrator uses a Node.js `EventEmitter` as the message bus. Each agent listens on `agent:{name}` channels.

### Message Format

```typescript
interface AgentMessage {
  id: string           // Unique message ID
  from: string         // Sender agent name
  to: string           // Recipient agent name (or '*' for broadcast)
  type: string         // alert, command, status, escalation, data
  payload: unknown     // Message-specific data
  timestamp: Date      // When the message was sent
  priority?: AgentPriority  // Message priority
}
```

### Message Types

| Type | Description | Example |
|------|-------------|---------|
| `alert` | Safety or status alert | Signal degradation |
| `command` | Direct instruction | Reset consecutive counter |
| `status` | Status update | Pipeline health report |
| `escalation` | Critical issue escalation | Sentinel → Hermes |
| `data` | Data exchange | Telemetry snapshot |

### Communication Patterns

**Direct Message**:
```typescript
orchestrator.sendMessage('sentinel', 'hermes', {
  type: 'escalation',
  payload: { criticalCount: 2, alerts: [...] },
  priority: 'critical'
})
```

**Broadcast**:
```typescript
orchestrator.broadcast('sentinel', {
  type: 'status',
  payload: { safe: false, criticalCount: 1 },
  priority: 'high'
})
```

### Communication Log

The orchestrator maintains a bounded communication log (max 200 entries) for debugging and audit:

```typescript
const log = orchestrator.getCommunicationLog(50)
// Returns last 50 communication events
```

All messages are also persisted to the `AgentMessage` database model for long-term audit.

---

## Configuration Options

### Sentinel Configuration

```typescript
interface SentinelConfig {
  checkInterval: number             // 2000ms default
  thresholds: SentinelThresholds    // Safety thresholds
  autoEmergencyActions: boolean     // true default
  escalationToHermes: boolean       // true default
  telemetryStalenessThreshold: number  // 10000ms default
}
```

### Navigator Configuration

```typescript
interface NavigatorConfig {
  checkInterval: number         // 3000ms default
  rerouteThreshold: number      // 50m default
  windSpeedLimit: number        // 10 m/s default
  lowBatteryRthPercent: number  // 25% default
  maxWaypointDistance: number    // 500m default
  altitudeMargin: number        // 20m default
}
```

### CommsGuard Configuration

```typescript
interface CommsGuardConfig {
  checkInterval: number                // 3000ms default
  signalDegradationThreshold: number   // -65 dBm default
  signalCriticalThreshold: number      // -80 dBm default
  heartbeatTimeout: number             // 10000ms default
  maxRetryAttempts: number             // 3 default
  retryInterval: number                // 5000ms default
  failoverPriority: string[]           // ['radio','gsm','wifi','telemetry']
}
```

### DataSteward Configuration

```typescript
interface DataStewardConfig {
  checkInterval: number                 // 5000ms default
  stalenessThresholds: Record<string, number>  // Per-metric
  stuckValueThreshold: number           // 5 consecutive default
  outlierStdDeviations: number          // 3 default
  cleanupAgeDays: number                // 90 days default
  syncCheckInterval: number             // 30000ms default
  anomalyHistorySize: number            // 100 readings default
}
```

---

## API Endpoints for Agent Control

### GET /api/agents

Get agent messages and status.

### POST /api/agents/chat

Send a message to Hermes for LLM-powered response.

**Request**:
```json
{
  "prompt": "Plan a mapping mission",
  "agent": "hermes",
  "includeContext": true,
  "missionId": "mission-001"
}
```

### GET/POST /api/agents/orchestrate

Control the agent orchestrator.

**GET** — Get orchestrator status, agent statuses, task queue, and communication log.

**POST Actions**:

| Action | Description | Example Request |
|--------|-------------|-----------------|
| `start` | Start orchestrator with all agents | `{ "action": "start" }` |
| `stop` | Stop orchestrator | `{ "action": "stop" }` |
| `submit_task` | Submit task to queue | `{ "action": "submit_task", "type": "safety_check", "agent": "sentinel", "priority": "critical", "payload": {} }` |
| `cancel_task` | Cancel a pending task | `{ "action": "cancel_task", "taskId": "task-123" }` |
| `send_message` | Send inter-agent message | `{ "action": "send_message", "from": "hermes", "to": "sentinel", "type": "command", "payload": {} }` |
| `register_agent` | Register an agent | `{ "action": "register_agent", "agentName": "sentinel" }` |
| `unregister_agent` | Unregister an agent | `{ "action": "unregister_agent", "agentName": "sentinel" }` |

### GET/POST /api/agents/sentinel

Direct Sentinel agent control.

**GET** — Get sentinel status, last check result, current safety check, and config.

**POST Actions**:

| Action | Description | Example Request |
|--------|-------------|-----------------|
| `manual_check` | Trigger immediate safety check | `{ "action": "manual_check" }` |
| `configure` | Update safety thresholds | `{ "action": "configure", "thresholds": { "battery_voltage": { "warning": 13.5, "critical": 12.8 } } }` |

---

## Safety Monitoring (Sentinel)

### How Sentinel Works

Sentinel runs a continuous background loop that:

1. **Every 2 seconds**: Fetches latest telemetry snapshot
2. **Checks telemetry staleness**: Is data fresh? (< 10 seconds old)
3. **Runs PicoClaw check logic**: Evaluates all safety thresholds
4. **Handles critical conditions**:
   - Creates alerts in the database
   - Auto-triggers emergency actions (RTH/land) after 2+ consecutive criticals
5. **Escalates to Hermes**: Sends escalation message for critical conditions
6. **Broadcasts status**: Sends safety status to all agents

### Safety Check Response

```typescript
interface SentinelCheckResult {
  timestamp: Date
  safe: boolean              // No critical alerts
  criticalCount: number      // Number of critical conditions
  warningCount: number       // Number of warning conditions
  alerts: Alert[]            // Detailed alert list
  actions: Action[]          // Recommended/emergency actions
  telemetryAge: number       // ms since last telemetry update
}
```

### Emergency Action Triggers

| Condition | Consecutive Criticals | Action |
|-----------|----------------------|--------|
| Battery < 12.6V | 2+ | RTH |
| Signal < -80 dBm | 2+ | RTH |
| Altitude > 120m | 2+ | Land |
| Temperature > 50°C | 2+ | Land |
| No telemetry data | 1 | Alert operator |

---

## Example Workflows

### Workflow 1: Mission Planning with Safety

```
1. Operator sends "Map area near Lhoksukon" via Agents tab
2. Dashboard calls POST /api/agents/chat
3. Hermes generates mission plan (type: mission_plan)
4. Operator reviews plan and creates mission
5. Sentinel starts monitoring telemetry
6. Navigator checks route safety
7. If safety issue detected → Sentinel escalates to Hermes
8. Hermes recommends alternative action
```

### Workflow 2: Communication Failover

```
1. CommsGuard detects radio signal at -82 dBm (critical)
2. CommsGuard searches for backup: GSM is available
3. CommsGuard attempts failover to GSM
4. CommsGuard sends broadcast alert about failover
5. If GSM fails → try WiFi → try telemetry
6. If all fail → alert operator via DB alert
```

### Workflow 3: Data Anomaly Detection

```
1. DataSteward checks telemetry freshness every 5s
2. DataSteward detects battery_voltage stuck at 14.8V for 6 readings
3. DataSteward creates critical anomaly alert
4. DataSteward notifies Sentinel via message bus
5. Sentinel evaluates: is this a real safety concern?
6. If critical → Sentinel escalates to Hermes
7. Hermes responds with diagnostic recommendation
```

### Workflow 4: Emergency RTH

```
1. Sentinel detects battery at 12.5V (critical)
2. First check: creates alert in DB
3. Second check (2s later): battery still critical
4. Sentinel auto-triggers RTH emergency action
5. Sentinel creates emergency alert in DB
6. Sentinel escalates to Hermes
7. Navigator detects active navigation plan → aborts it
8. Hermes formulates recovery plan for operator
```

### Workflow 5: Agent Task Submission

```
1. Operator submits task via POST /api/agents/orchestrate
2. Task is persisted in AgentTaskRecord (DB)
3. Orchestrator picks up pending task on next tick
4. Task assigned to appropriate agent
5. Agent processes task → result stored in DB
6. Orchestrator increments tasksCompleted counter
7. Communication log records the event
```

---

*Last updated: 2025*
