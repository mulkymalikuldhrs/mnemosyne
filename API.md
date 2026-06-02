# Nanggroe IoT — API Reference

> Comprehensive API documentation for Nanggroe IoT. All endpoints are under `/api/`.

---

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Codes](#error-codes)
- [Rate Limits](#rate-limits)
- [Core System](#core-system)
- [Robots & Projects](#robots--projects)
- [Hardware](#hardware)
- [AI & Agents](#ai--agents)
- [Missions & Navigation](#missions--navigation)
- [Communications](#communications)
- [Telemetry & Monitoring](#telemetry--monitoring)
- [Streaming (SSE)](#streaming-sse)
- [Integrations](#integrations)
- [WebSocket Endpoints](#websocket-endpoints)

---

## Authentication

### API Key Authentication

Critical API routes require an API key. Set the `NANGGROE_API_KEY` environment variable in production.

**Development Mode**: If `NANGGROE_API_KEY` is not set and `NODE_ENV=development`, authentication is skipped.

**Production Mode**: `NANGGROE_API_KEY` must be set. Requests without a valid key receive `401 Unauthorized`.

### Providing the API Key

The API key can be provided in three ways:

1. **Header** (preferred): `x-api-key: YOUR_KEY`
2. **Authorization header**: `Authorization: Bearer YOUR_KEY`
3. **Query parameter**: `?api_key=YOUR_KEY`

### Protected Routes

| Route | Methods | Auth Required |
|-------|---------|--------------|
| `/api/mcp` | POST | Yes |
| `/api/system` | POST | Yes |
| `/api/flash` | POST | Yes |
| `/api/hardware-bridge` | POST | Yes |

---

## Response Format

All API endpoints return JSON in a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Description of the error"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "pageSize": 50
  }
}
```

---

## Error Codes

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid input, missing required fields |
| 401 | Unauthorized | Invalid or missing API key |
| 404 | Not Found | Resource not found |
| 405 | Method Not Allowed | HTTP method not supported for this endpoint |
| 500 | Internal Server Error | Server-side error |

---

## Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| Default | 100 requests | 1 minute |
| SSE Streams | 5 concurrent | Per client |
| Agent Chat | 10 requests | 1 minute |
| MCP Tools | 20 requests | 1 minute |

> Rate limiting is handled by the Caddy reverse proxy in production deployments.

---

## Core System

### GET /api

System health check. Returns system status, version, and device counts.

**Auth**: Not required

**Response**:

```json
{
  "success": true,
  "data": {
    "system": "Nanggroe IoT",
    "version": "2.0.0",
    "mode": "simulation",
    "uptime": {
      "seconds": 3600,
      "formatted": "1h 0m 0s"
    },
    "timestamp": "2025-01-15T10:30:00.000Z",
    "devices": {
      "total": 8,
      "active": 5,
      "detected": 2,
      "error": 0,
      "offline": 1
    }
  }
}
```

---

### GET /api/system

Get system configuration and status.

**Auth**: Not required

**Response**:

```json
{
  "success": true,
  "data": {
    "name": "NANGGROE IOT",
    "version": "2.0.0",
    "mode": "simulation",
    "region": "Aceh Utara",
    "homePosition": { "lat": 4.9125, "lng": 97.1347 },
    "uptime": 3600000,
    "uptimeFormatted": "1h 0m 0s",
    "devices": { "total": 8, "active": 5 },
    "activeMission": null,
    "agents": {
      "hermes": { "enabled": true, "status": "online" },
      "picoclaw": { "enabled": true, "status": "online" }
    },
    "session": null,
    "alerts": { "unread": 0 },
    "config": { ... }
  }
}
```

### POST /api/system

Update system configuration.

**Auth**: Required

**Request**:

```json
{
  "configs": [
    { "key": "system.name", "value": "My Robot", "category": "general" }
  ]
}
```

**Response**:

```json
{
  "success": true,
  "data": { "updated": 1 }
}
```

---

### GET /api/doctor

System health diagnostics.

**Auth**: Not required

**Response**:

```json
{
  "success": true,
  "data": {
    "checks": [
      { "name": "Database", "status": "healthy", "latency": 5 },
      { "name": "Serial Port", "status": "healthy", "latency": 12 }
    ],
    "overall": "healthy",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

### GET/POST /api/bootflow

Boot sequence management.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "steps": [
      { "id": "1", "name": "Database Init", "status": "completed", "order": 1 },
      { "id": "2", "name": "Hardware Scan", "status": "completed", "order": 2 },
      { "id": "3", "name": "Agent Startup", "status": "running", "order": 3 }
    ],
    "currentStep": 3,
    "status": "booting"
  }
}
```

---

## Robots & Projects

### GET /api/robot-templates

List all robot templates.

**Response**:

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "tpl-001",
        "name": "Quadcopter",
        "description": "4-motor UAV for photography & survey",
        "category": "drone",
        "icon": "🚁",
        "difficulty": "intermediate",
        "estimatedBuildHours": 8,
        "isOfficial": true,
        "version": "1.0.0"
      }
    ]
  }
}
```

### POST /api/robot-templates

Create a custom robot template.

**Request**:

```json
{
  "name": "My Custom Drone",
  "description": "Custom drone configuration",
  "category": "drone",
  "requiredHardware": "[{\"type\": \"flight_controller\", \"name\": \"Pixhawk\"}]",
  "capabilities": "[\"gps\", \"camera\"]"
}
```

### GET/PUT/DELETE /api/robot-templates/[id]

Get, update, or delete a specific template.

### GET /api/projects

List all robot projects.

**Response**:

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj-001",
        "name": "Field Mapping Drone",
        "status": "active",
        "buildProgress": 85,
        "currentStep": "calibration",
        "templateId": "tpl-001"
      }
    ]
  }
}
```

### POST /api/projects

Create a new robot project from a template.

**Request**:

```json
{
  "name": "My Drone",
  "templateId": "tpl-001",
  "description": "Agricultural mapping drone"
}
```

### GET/PUT/DELETE /api/projects/[id]

Get, update, or delete a specific project.

---

## Hardware

### GET /api/hardware

List all hardware devices with stats.

**Response**:

```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "hw-001",
        "name": "Pixhawk 4",
        "deviceType": "flight_controller",
        "protocol": "uart",
        "status": "active",
        "vendorId": "0x26AC",
        "productId": "0x0012",
        "port": "/dev/ttyACM0",
        "firmware": "ArduPilot 4.5.1",
        "lastSeen": "2025-01-15T10:30:00.000Z",
        "profiles": [
          { "id": "p1", "adapterName": "MAVLink 2", "config": "{}", "isDefault": true }
        ]
      }
    ],
    "stats": {
      "total": 8,
      "byStatus": { "active": 5, "detected": 2, "offline": 1 },
      "byType": { "flight_controller": 1, "companion_computer": 1 }
    }
  }
}
```

### POST /api/hardware

Register a new hardware device or scan for devices.

**Request (Scan)**:

```json
{
  "action": "scan"
}
```

**Request (Register)**:

```json
{
  "name": "BME280 Sensor",
  "deviceType": "sensor",
  "protocol": "i2c",
  "address": "0x76",
  "port": "/dev/i2c-1"
}
```

### GET/POST /api/hardware-bridge

Hardware bus operations (Serial, I2C, SPI, GPIO).

**GET Response**:

```json
{
  "success": true,
  "data": {
    "buses": [
      { "busType": "serial", "busPath": "/dev/ttyACM0", "status": "available" },
      { "busType": "i2c", "busPath": "/dev/i2c-1", "status": "available" }
    ]
  }
}
```

### GET/POST /api/drivers

Driver management.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "drivers": [
      { "id": "drv-001", "name": "MAVLink 2", "version": "1.0.0", "status": "loaded", "supportedDevices": ["pixhawk"] }
    ]
  }
}
```

### GET/POST /api/auto-detect

Hardware auto-detection.

**POST Response**:

```json
{
  "success": true,
  "data": {
    "scanned": true,
    "newDevices": 1,
    "updatedDevices": 3,
    "offlineDevices": 0,
    "devices": [ ... ]
  }
}
```

### GET/POST /api/flash

Firmware flashing operations.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "firmware": [
      { "target": "pixhawk", "version": "4.5.1", "releaseDate": "2024-01-15", "size": 1048576 }
    ],
    "activeOperations": [],
    "operationHistory": []
  }
}
```

---

## AI & Agents

### GET /api/agents

Get agent messages and status.

**Response**:

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg-001",
        "agent": "hermes",
        "role": "assistant",
        "content": "System ready for mission.",
        "metadata": null,
        "timestamp": "2025-01-15T10:30:00.000Z",
        "missionId": "mission-001"
      }
    ],
    "agentStatus": {
      "hermes": { "enabled": true, "status": "online", "lastMessage": null },
      "picoclaw": { "enabled": true, "status": "online", "lastMessage": null }
    }
  }
}
```

### POST /api/agents

Manage agent configuration.

**Request**:

```json
{
  "action": "configure",
  "agent": "hermes",
  "enabled": true
}
```

### POST /api/agents/chat

Send a message to an agent.

**Request**:

```json
{
  "prompt": "Plan a mapping mission near Lhoksukon",
  "agent": "hermes",
  "includeContext": true,
  "missionId": "mission-001"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "msg-new",
    "agent": "hermes",
    "role": "assistant",
    "content": "I've designed a mapping mission...",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

### GET/POST /api/agents/orchestrate

Agent orchestrator control.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "orchestrator": {
      "running": true,
      "uptime": 3600,
      "registeredAgents": ["hermes", "picoclaw", "sentinel", "navigator", "comms_guard", "data_steward"],
      "activeAgents": ["sentinel", "navigator", "comms_guard", "data_steward"],
      "taskQueueSize": 3,
      "tasksCompleted": 150,
      "tasksFailed": 2,
      "messagesProcessed": 89,
      "lastTick": "2025-01-15T10:30:00.000Z"
    },
    "agents": {
      "hermes": { "name": "hermes", "type": "llm", "state": "idle", "capabilities": [...] },
      "sentinel": { "name": "sentinel", "type": "rule", "state": "acting", "capabilities": [...] }
    },
    "taskQueue": [ ... ],
    "communicationLog": [ ... ]
  }
}
```

**POST Actions**:

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `start` | Start orchestrator with all agents | — |
| `stop` | Stop orchestrator | — |
| `submit_task` | Submit a task to the queue | `type`, `agent`, `payload` |
| `cancel_task` | Cancel a pending task | `taskId` |
| `send_message` | Send inter-agent message | `from`, `to`, `type`, `payload` |
| `register_agent` | Register a default agent | `agentName` |
| `unregister_agent` | Unregister an agent | `agentName` |

### GET/POST /api/agents/sentinel

Sentinel safety monitoring.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "sentinel": { "name": "sentinel", "state": "acting", "tasksCompleted": 500 },
    "lastCheckResult": {
      "timestamp": "2025-01-15T10:30:00.000Z",
      "safe": true,
      "criticalCount": 0,
      "warningCount": 1,
      "alerts": [...],
      "actions": [],
      "telemetryAge": 2000
    },
    "currentSafetyCheck": {
      "safe": true,
      "alertCount": 1,
      "alerts": [...]
    },
    "config": {
      "checkInterval": 2000,
      "thresholds": { ... },
      "autoEmergencyActions": true,
      "escalationToHermes": true
    }
  }
}
```

**POST Actions**:

| Action | Description | Fields |
|--------|-------------|--------|
| `manual_check` | Trigger an immediate safety check | — |
| `configure` | Update safety thresholds | `thresholds` |

### POST /api/llm/chat

Direct LLM chat completions.

**Request**:

```json
{
  "messages": [
    { "role": "user", "content": "Plan a survey mission" }
  ],
  "model": "default",
  "temperature": 0.7,
  "maxTokens": 2048
}
```

### GET/POST /api/ai-memory

AI memory CRUD operations.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "memories": [
      {
        "id": "mem-001",
        "category": "learning",
        "key": "optimal_mapping_altitude",
        "value": "{\"altitude\": 50, \"gsd\": 2.0}",
        "confidence": 0.92,
        "accessCount": 15,
        "isSynced": true
      }
    ]
  }
}
```

### GET/POST /api/self-learn

Self-learning engine.

### GET/POST /api/face-tracking

Face detection and tracking operations.

### GET/POST /api/testing

AI-powered testing.

---

## Missions & Navigation

### GET /api/missions

List all missions.

**Response**:

```json
{
  "success": true,
  "data": {
    "missions": [
      {
        "id": "mission-001",
        "name": "Pemetaan Lhoksukon",
        "description": "Area mapping of Lhoksukon fields",
        "type": "mapping",
        "status": "active",
        "prompt": "Peta area persawahan di Lhoksukon",
        "waypoints": "[{\"lat\":4.9125,\"lng\":97.1347,\"alt\":50,\"action\":\"takeoff\"}]",
        "altitude": 80,
        "speed": 5,
        "overlapFront": 75,
        "overlapSide": 65,
        "startedAt": "2025-01-15T10:00:00.000Z",
        "completedAt": null,
        "createdAt": "2025-01-15T09:30:00.000Z"
      }
    ]
  }
}
```

### POST /api/missions

Create a new mission.

**Request**:

```json
{
  "name": "Field Mapping",
  "type": "mapping",
  "prompt": "Map the area near Lhoksukon",
  "altitude": 80,
  "speed": 5,
  "overlapFront": 75,
  "overlapSide": 65
}
```

### GET/PUT/DELETE /api/missions/[id]

Get, update, or delete a specific mission.

### GET /api/navigation

List navigation plans.

### POST /api/navigation

Create a navigation plan (autopilot, field mapping, delivery, RTH).

**Request (Delivery)**:

```json
{
  "name": "Delivery to Station B",
  "type": "delivery",
  "waypoints": "[{\"lat\":4.9125,\"lng\":97.1347},{\"lat\":4.9145,\"lng\":97.1367}]",
  "homePosition": "{\"lat\":4.9125,\"lng\":97.1347,\"alt\":0}"
}
```

**Request (RTH Emergency)**:

```json
{
  "name": "Emergency RTH",
  "type": "rth",
  "homePosition": "{\"lat\":4.9125,\"lng\":97.1347,\"alt\":0}"
}
```

### GET/PUT/DELETE /api/navigation/[id]

Get, update, or delete a navigation plan.

---

## Communications

### GET /api/comms

List communication channels.

**Response**:

```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "ch-001",
        "type": "telegram",
        "name": "Hermes Telegram Bot",
        "status": "connected",
        "isEnabled": true
      }
    ]
  }
}
```

### POST /api/comms

Create a communication channel.

### GET/PUT/DELETE /api/comms/[id]

Get, update, or delete a channel.

### POST /api/comms/telegram

Send a Telegram message.

**Request**:

```json
{
  "message": "Mission started",
  "chatId": "123456789"
}
```

### POST /api/comms/voice

Voice/TTS operations.

### POST /api/comms/beep

Beep alert operations.

---

## Telemetry & Monitoring

### GET /api/telemetry

Get telemetry data.

**Response**:

```json
{
  "success": true,
  "data": {
    "readings": [
      { "id": "tel-001", "metric": "battery_voltage", "value": 14.8, "unit": "V", "source": "sensor", "timestamp": "2025-01-15T10:30:00.000Z" }
    ],
    "snapshot": {
      "battery_voltage": 14.8,
      "altitude": 50,
      "speed": 5,
      "signal_strength": -45,
      "temperature": 28
    }
  }
}
```

### POST /api/telemetry

Record a new telemetry reading.

### GET/POST /api/power

Power source management.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "sources": [
      {
        "id": "ps-001",
        "type": "battery",
        "name": "LiPo 4S 6000mAh",
        "status": "charging",
        "voltage": 15.2,
        "current": 2.1,
        "temperature": 32.5,
        "currentLevel": 85
      }
    ],
    "status": {
      "mainBattery": { "voltage": 15.2, "percentage": 85, "estimatedMinutes": 120 },
      "solar": { "voltage": 18.5, "isCharging": true, "wattage": 22 },
      "emergencyMode": false
    }
  }
}
```

### GET/POST /api/alerts

Alert management.

**GET Response**:

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-001",
        "level": "warning",
        "source": "sentinel",
        "title": "Battery Low",
        "message": "Battery voltage at 13.5V",
        "category": "safety",
        "isRead": false,
        "isResolved": false,
        "timestamp": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

### GET/POST /api/calibration

Calibration records.

---

## Streaming (SSE)

### GET /api/stream/telemetry

Real-time telemetry stream via Server-Sent Events.

**Auth**: Not required

**Event Format**:

```
event: telemetry
data: {"battery_voltage":14.8,"altitude":50,"speed":5,"timestamp":"2025-01-15T10:30:00.000Z"}

event: telemetry
data: {"battery_voltage":14.7,"altitude":51,"speed":4.8,"timestamp":"2025-01-15T10:30:05.000Z"}
```

**Client Usage**:

```javascript
const eventSource = new EventSource('/api/stream/telemetry')
eventSource.addEventListener('telemetry', (event) => {
  const data = JSON.parse(event.data)
  console.log(data)
})
```

### GET /api/stream/alerts

Real-time alert stream via SSE.

**Event Format**:

```
event: alert
data: {"level":"warning","source":"sentinel","title":"Battery Low","message":"Voltage at 13.5V"}

event: alert
data: {"level":"critical","source":"sentinel","title":"Signal Lost","message":"No telemetry for 10s"}
```

### GET /api/stream/testing

Testing progress stream via SSE.

---

## Integrations

### GET /api/mcp

List available MCP tools and their statuses.

**Response**:

```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "mavlink_command",
        "description": "Send MAVLink commands to the flight controller",
        "status": "available",
        "inputSchema": { ... }
      },
      {
        "name": "telemetry_query",
        "description": "Query historical telemetry data",
        "status": "available",
        "inputSchema": { ... }
      }
    ],
    "totalTools": 6,
    "availableTools": 6
  }
}
```

### POST /api/mcp

Execute an MCP tool.

**Auth**: Required

**Request**:

```json
{
  "tool": "safety_assessment",
  "arguments": {
    "useLiveTelemetry": true
  }
}
```

**Available Tools**:

| Tool | Description | Auth |
|------|-------------|------|
| `mavlink_command` | Send MAVLink commands (ARM, DISARM, TAKEOFF, LAND, RTL) | Required |
| `telemetry_query` | Query historical telemetry data | Required |
| `mission_generate` | Generate mission waypoints with AI | Required |
| `hardware_diagnostic` | Run hardware diagnostics | Required |
| `calibration_control` | Control calibration processes | Required |
| `safety_assessment` | Run PicoClaw safety assessment | Required |

### POST /api/mcp/transport

MCP JSON-RPC 2.0 transport endpoint.

**Request**:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

### GET/POST /api/extension

IDE extension bridge (VSCode, Cursor, Neovim, JetBrains).

### GET/POST /api/assembly

Robot assembly step management.

---

## WebSocket Endpoints

### Extension WebSocket

**URL**: `ws://localhost:8081` (or via Caddy gateway with `?XTransformPort=8081`)

**Purpose**: Real-time communication between IDE extensions and the Nanggroe IoT platform.

**Events**:

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client → Server | IDE extension connects |
| `heartbeat` | Bidirectional | Connection keep-alive |
| `command` | Client → Server | Execute a platform command |
| `status` | Server → Client | Platform status update |
| `alert` | Server → Client | Real-time alert notification |

---

*Last updated: 2025*
