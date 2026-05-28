// ============================================================
// NANGGROE IOT - OpenAPI 3.0 Specification Endpoint
// GET /api/docs — Returns the full OpenAPI spec as JSON
// ============================================================

import { NextResponse } from 'next/server'

export async function GET() {
  const spec = generateOpenApiSpec()
  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    },
  })
}

function generateOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Nanggroe IoT API',
      description:
        'Modular IoT & Robotics Platform — Full API reference for hardware management, missions, navigation, telemetry, AI agents, communication, and more.',
      version: '1.0.0',
      contact: {
        name: 'Mulky Malikul Dhaher',
        email: 'mulkymalikuldhaher@email.com',
        url: 'https://github.com/mulkymalikuldhrs/nanggroe-iot',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current server',
      },
    ],
    tags: [
      { name: 'System', description: 'System health, status, and configuration' },
      { name: 'Hardware', description: 'Hardware device management and detection' },
      { name: 'Hardware Bridge', description: 'Low-level hardware bus communication' },
      { name: 'Drivers', description: 'Device driver management' },
      { name: 'Flash', description: 'Firmware flashing operations' },
      { name: 'Extension', description: 'IDE extension connections' },
      { name: 'Communication', description: 'Multi-channel communication (Telegram, Voice, Beep)' },
      { name: 'Missions', description: 'Mission planning, execution, and monitoring' },
      { name: 'Navigation', description: 'Navigation planning and autopilot' },
      { name: 'Telemetry', description: 'Real-time sensor telemetry data' },
      { name: 'Power', description: 'Power source monitoring and management' },
      { name: 'Agents', description: 'AI agent communication and orchestration' },
      { name: 'LLM', description: 'Large Language Model chat interface' },
      { name: 'MCP', description: 'Model Context Protocol integration' },
      { name: 'AI Memory', description: 'AI memory and learning persistence' },
      { name: 'Self-Learn', description: 'Self-learning and pattern detection' },
      { name: 'Face Tracking', description: 'Face detection, tracking, and identification' },
      { name: 'Testing', description: 'Hardware and system testing' },
      { name: 'Projects', description: 'Robot project management' },
      { name: 'Robot Templates', description: 'Robot template library' },
      { name: 'Assembly', description: 'Robot assembly guidance' },
      { name: 'Alerts', description: 'System alerts and notifications' },
      { name: 'Calibration', description: 'Sensor and device calibration' },
      { name: 'Auto-Detect', description: 'Hardware auto-detection and scanning' },
      { name: 'Doctor', description: 'System diagnostics and health checks' },
      { name: 'Boot Flow', description: 'System boot sequence management' },
      { name: 'Streams', description: 'Server-Sent Events (SSE) real-time streams' },
    ],
    paths: {
      '/api': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: 'Returns basic system health information including uptime and device counts.',
          operationId: 'healthCheck',
          responses: {
            '200': {
              description: 'System health information',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' },
                },
              },
            },
          },
        },
      },
      '/api/system': {
        get: {
          tags: ['System'],
          summary: 'Get system status',
          description: 'Returns comprehensive system status including config, agents, and session info.',
          operationId: 'getSystemStatus',
          responses: {
            '200': {
              description: 'System status',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' },
                },
              },
            },
          },
        },
        post: {
          tags: ['System'],
          summary: 'Update system config',
          description: 'Update system configuration or seed the database.',
          operationId: 'updateSystemConfig',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    configs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          key: { type: 'string' },
                          value: { type: 'string' },
                          category: { type: 'string' },
                        },
                      },
                    },
                    seed: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Config updated' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/hardware': {
        get: {
          tags: ['Hardware'],
          summary: 'List hardware devices',
          description: 'Returns all registered hardware devices with their status and profiles.',
          operationId: 'listHardware',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by device status' },
            { name: 'deviceType', in: 'query', schema: { type: 'string' }, description: 'Filter by device type' },
          ],
          responses: {
            '200': {
              description: 'List of hardware devices',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/HardwareDevice' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Hardware'],
          summary: 'Register or update a hardware device',
          operationId: 'createHardware',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HardwareDeviceInput' },
              },
            },
          },
          responses: {
            '200': { description: 'Device created or updated' },
          },
        },
      },
      '/api/hardware-bridge': {
        get: {
          tags: ['Hardware Bridge'],
          summary: 'Get hardware bridge status',
          description: 'Returns the current hardware bridge status including serial, I2C, SPI, GPIO, and ADC bus states.',
          operationId: 'getHardwareBridge',
          responses: {
            '200': {
              description: 'Hardware bridge status',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' },
                },
              },
            },
          },
        },
        post: {
          tags: ['Hardware Bridge'],
          summary: 'Configure hardware bridge',
          description: 'Update hardware bridge mode and bus configuration.',
          operationId: 'configureHardwareBridge',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mode: { type: 'string', enum: ['serial', 'i2c', 'spi', 'gpio', 'adc'] },
                    action: { type: 'string' },
                    config: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Bridge configuration updated' },
          },
        },
      },
      '/api/drivers': {
        get: {
          tags: ['Drivers'],
          summary: 'List device drivers',
          description: 'Returns available device drivers and their status.',
          operationId: 'listDrivers',
          responses: {
            '200': {
              description: 'Driver list',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
            },
          },
        },
        post: {
          tags: ['Drivers'],
          summary: 'Install or configure a driver',
          operationId: 'configureDriver',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    driverName: { type: 'string' },
                    action: { type: 'string', enum: ['install', 'configure', 'remove'] },
                    config: { type: 'object' },
                  },
                  required: ['driverName', 'action'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Driver action completed' },
          },
        },
      },
      '/api/flash': {
        get: {
          tags: ['Flash'],
          summary: 'Get flash status',
          description: 'Returns current firmware flash status and available firmware images.',
          operationId: 'getFlashStatus',
          responses: {
            '200': { description: 'Flash status' },
          },
        },
        post: {
          tags: ['Flash'],
          summary: 'Flash firmware',
          description: 'Start a firmware flash operation on a target device.',
          operationId: 'flashFirmware',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    deviceId: { type: 'string' },
                    firmwareUrl: { type: 'string' },
                    firmwareVersion: { type: 'string' },
                    target: { type: 'string' },
                  },
                  required: ['deviceId'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Flash operation started' },
          },
        },
      },
      '/api/extension': {
        get: {
          tags: ['Extension'],
          summary: 'List extension connections',
          description: 'Returns all IDE extension connections and their status.',
          operationId: 'listExtensions',
          responses: {
            '200': { description: 'Extension connections list' },
          },
        },
        post: {
          tags: ['Extension'],
          summary: 'Create or update extension connection',
          operationId: 'configureExtension',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['vscode', 'cursor', 'neovim', 'jetbrains', 'custom'] },
                    capabilities: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['name', 'type'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Extension configured' },
          },
        },
      },
      '/api/comms': {
        get: {
          tags: ['Communication'],
          summary: 'List communication channels',
          description: 'Returns all configured communication channels.',
          operationId: 'listCommChannels',
          responses: {
            '200': { description: 'Communication channels list' },
          },
        },
        post: {
          tags: ['Communication'],
          summary: 'Create or update communication channel',
          operationId: 'configureCommChannel',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['telegram', 'voice', 'android', 'beep', 'gsm', 'radio'] },
                    name: { type: 'string' },
                    config: { type: 'object' },
                  },
                  required: ['type', 'name'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Channel configured' },
          },
        },
      },
      '/api/comms/telegram': {
        post: {
          tags: ['Communication'],
          summary: 'Send Telegram message',
          description: 'Send a message through the configured Telegram bot.',
          operationId: 'sendTelegram',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    chatId: { type: 'string' },
                    parseMode: { type: 'string', enum: ['Markdown', 'HTML'] },
                  },
                  required: ['message'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Message sent' },
          },
        },
      },
      '/api/comms/voice': {
        post: {
          tags: ['Communication'],
          summary: 'Voice input/output',
          description: 'Process voice commands or generate text-to-speech output.',
          operationId: 'voiceCommand',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ['transcribe', 'speak', 'listen'] },
                    text: { type: 'string' },
                    language: { type: 'string', default: 'id' },
                  },
                  required: ['action'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Voice action completed' },
          },
        },
      },
      '/api/comms/beep': {
        post: {
          tags: ['Communication'],
          summary: 'Trigger beep alert',
          description: 'Play a beep pattern for audible alerts and notifications.',
          operationId: 'triggerBeep',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pattern: { type: 'string', description: 'Named beep pattern or custom array' },
                    frequency: { type: 'number', default: 1000 },
                    duration: { type: 'number', default: 200 },
                    repeat: { type: 'number', default: 1 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Beep triggered' },
          },
        },
      },
      '/api/missions': {
        get: {
          tags: ['Missions'],
          summary: 'List missions',
          description: 'Returns all missions with their current status.',
          operationId: 'listMissions',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by mission status' },
            { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by mission type' },
          ],
          responses: {
            '200': {
              description: 'Mission list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/Mission' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Missions'],
          summary: 'Create a new mission',
          operationId: 'createMission',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MissionInput' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Mission created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Mission' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/missions/{id}': {
        get: {
          tags: ['Missions'],
          summary: 'Get mission by ID',
          operationId: 'getMission',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Mission ID' },
          ],
          responses: {
            '200': { description: 'Mission details' },
            '404': { description: 'Mission not found' },
          },
        },
        put: {
          tags: ['Missions'],
          summary: 'Update a mission',
          operationId: 'updateMission',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Mission ID' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MissionInput' } },
            },
          },
          responses: {
            '200': { description: 'Mission updated' },
          },
        },
        delete: {
          tags: ['Missions'],
          summary: 'Delete a mission',
          operationId: 'deleteMission',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Mission ID' },
          ],
          responses: {
            '200': { description: 'Mission deleted' },
          },
        },
      },
      '/api/navigation': {
        get: {
          tags: ['Navigation'],
          summary: 'List navigation plans',
          operationId: 'listNavigationPlans',
          responses: {
            '200': { description: 'Navigation plans list' },
          },
        },
        post: {
          tags: ['Navigation'],
          summary: 'Create navigation plan',
          operationId: 'createNavigationPlan',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NavigationPlanInput' },
              },
            },
          },
          responses: {
            '200': { description: 'Navigation plan created' },
          },
        },
      },
      '/api/navigation/{id}': {
        get: {
          tags: ['Navigation'],
          summary: 'Get navigation plan by ID',
          operationId: 'getNavigationPlan',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Navigation plan ID' },
          ],
          responses: {
            '200': { description: 'Navigation plan details' },
            '404': { description: 'Not found' },
          },
        },
        put: {
          tags: ['Navigation'],
          summary: 'Update navigation plan',
          operationId: 'updateNavigationPlan',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Navigation plan ID' },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/NavigationPlanInput' } } },
          },
          responses: {
            '200': { description: 'Navigation plan updated' },
          },
        },
        delete: {
          tags: ['Navigation'],
          summary: 'Delete navigation plan',
          operationId: 'deleteNavigationPlan',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Navigation plan ID' },
          ],
          responses: {
            '200': { description: 'Navigation plan deleted' },
          },
        },
      },
      '/api/telemetry': {
        get: {
          tags: ['Telemetry'],
          summary: 'Get telemetry data',
          description: 'Returns recent telemetry readings. Supports filtering by device and metric.',
          operationId: 'getTelemetry',
          parameters: [
            { name: 'deviceId', in: 'query', schema: { type: 'string' }, description: 'Filter by device ID' },
            { name: 'metric', in: 'query', schema: { type: 'string' }, description: 'Filter by metric type' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 }, description: 'Max readings to return' },
          ],
          responses: {
            '200': {
              description: 'Telemetry readings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/TelemetryReading' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Telemetry'],
          summary: 'Submit telemetry reading',
          operationId: 'submitTelemetry',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TelemetryReadingInput' },
              },
            },
          },
          responses: {
            '200': { description: 'Reading recorded' },
          },
        },
      },
      '/api/power': {
        get: {
          tags: ['Power'],
          summary: 'List power sources',
          description: 'Returns all power sources with their current readings.',
          operationId: 'listPowerSources',
          responses: {
            '200': {
              description: 'Power sources list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/PowerSource' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Power'],
          summary: 'Create or update power source',
          operationId: 'configurePowerSource',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PowerSourceInput' },
              },
            },
          },
          responses: {
            '200': { description: 'Power source configured' },
          },
        },
      },
      '/api/agents': {
        get: {
          tags: ['Agents'],
          summary: 'List agent messages',
          description: 'Returns recent agent messages from Hermes, PicoClaw, and other agents.',
          operationId: 'listAgentMessages',
          parameters: [
            { name: 'agent', in: 'query', schema: { type: 'string' }, description: 'Filter by agent name' },
            { name: 'missionId', in: 'query', schema: { type: 'string' }, description: 'Filter by mission ID' },
          ],
          responses: {
            '200': {
              description: 'Agent messages',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/AgentMessage' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Agents'],
          summary: 'Send message to agents',
          description: 'Send a command or query to the agent system.',
          operationId: 'sendAgentMessage',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    agent: { type: 'string', enum: ['hermes', 'picoclaw', 'operator', 'system'] },
                    role: { type: 'string', enum: ['command', 'query', 'alert'] },
                    content: { type: 'string' },
                    missionId: { type: 'string' },
                  },
                  required: ['agent', 'content'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Agent response' },
          },
        },
      },
      '/api/agents/chat': {
        post: {
          tags: ['Agents'],
          summary: 'Chat with AI agent',
          description: 'Send a natural language message and receive an AI agent response.',
          operationId: 'agentChat',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    context: { type: 'object' },
                    missionId: { type: 'string' },
                  },
                  required: ['message'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Agent chat response' },
          },
        },
      },
      '/api/agents/orchestrate': {
        get: {
          tags: ['Agents'],
          summary: 'Get orchestration status',
          description: 'Returns current multi-agent orchestration status and task queue.',
          operationId: 'getOrchestrationStatus',
          responses: {
            '200': { description: 'Orchestration status' },
          },
        },
        post: {
          tags: ['Agents'],
          summary: 'Create orchestration task',
          description: 'Submit a task for multi-agent orchestration.',
          operationId: 'createOrchestrationTask',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['safety_check', 'navigation', 'communication', 'data_pipeline', 'mission_plan'] },
                    priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'] },
                    payload: { type: 'object' },
                  },
                  required: ['type', 'payload'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Task created' },
          },
        },
      },
      '/api/agents/sentinel': {
        get: {
          tags: ['Agents'],
          summary: 'Get sentinel status',
          description: 'Returns the PicoClaw sentinel agent safety monitoring status.',
          operationId: 'getSentinelStatus',
          responses: {
            '200': { description: 'Sentinel status' },
          },
        },
        post: {
          tags: ['Agents'],
          summary: 'Trigger sentinel check',
          description: 'Manually trigger a safety check from the sentinel agent.',
          operationId: 'triggerSentinelCheck',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    scope: { type: 'string', enum: ['full', 'hardware', 'mission', 'power', 'communication'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Sentinel check result' },
          },
        },
      },
      '/api/llm/chat': {
        post: {
          tags: ['LLM'],
          summary: 'LLM chat completion',
          description: 'Send a chat message to the configured Large Language Model and get a response.',
          operationId: 'llmChat',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                          content: { type: 'string' },
                        },
                      },
                    },
                    model: { type: 'string' },
                    temperature: { type: 'number', minimum: 0, maximum: 2 },
                    maxTokens: { type: 'integer' },
                  },
                  required: ['messages'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'LLM response' },
          },
        },
      },
      '/api/mcp': {
        get: {
          tags: ['MCP'],
          summary: 'List MCP tools',
          description: 'Returns available Model Context Protocol tools and their schemas.',
          operationId: 'listMcpTools',
          responses: {
            '200': { description: 'MCP tools list' },
          },
        },
        post: {
          tags: ['MCP'],
          summary: 'Execute MCP tool',
          description: 'Execute a Model Context Protocol tool call.',
          operationId: 'executeMcpTool',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tool: { type: 'string' },
                    arguments: { type: 'object' },
                  },
                  required: ['tool'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'MCP tool result' },
          },
        },
      },
      '/api/mcp/transport': {
        post: {
          tags: ['MCP'],
          summary: 'MCP transport message',
          description: 'Send a raw MCP transport-level message.',
          operationId: 'mcpTransport',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    method: { type: 'string' },
                    params: { type: 'object' },
                  },
                  required: ['method'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Transport response' },
          },
        },
      },
      '/api/ai-memory': {
        get: {
          tags: ['AI Memory'],
          summary: 'List AI memory entries',
          description: 'Returns stored AI memory entries for learning and context persistence.',
          operationId: 'listAiMemory',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
            { name: 'key', in: 'query', schema: { type: 'string' }, description: 'Filter by key' },
          ],
          responses: {
            '200': { description: 'AI memory entries' },
          },
        },
        post: {
          tags: ['AI Memory'],
          summary: 'Store AI memory',
          operationId: 'storeAiMemory',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    category: { type: 'string', enum: ['conversation', 'decision', 'learning', 'pattern', 'preference'] },
                    key: { type: 'string' },
                    value: { type: 'object' },
                    context: { type: 'object' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                  },
                  required: ['category', 'key', 'value'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Memory stored' },
          },
        },
        delete: {
          tags: ['AI Memory'],
          summary: 'Clear AI memory',
          description: 'Delete AI memory entries by category or key.',
          operationId: 'clearAiMemory',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category to clear' },
            { name: 'key', in: 'query', schema: { type: 'string' }, description: 'Specific key to delete' },
          ],
          responses: {
            '200': { description: 'Memory cleared' },
          },
        },
      },
      '/api/self-learn': {
        get: {
          tags: ['Self-Learn'],
          summary: 'Get learning report',
          description: 'Returns the self-learning report including patterns, decisions, and suggestions.',
          operationId: 'getLearningReport',
          responses: {
            '200': { description: 'Learning report' },
          },
        },
        post: {
          tags: ['Self-Learn'],
          summary: 'Submit learning data',
          description: 'Submit new learning data for pattern detection and analysis.',
          operationId: 'submitLearningData',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    category: { type: 'string', enum: ['pattern', 'decision', 'performance', 'suggestion', 'auto_tune'] },
                    key: { type: 'string' },
                    value: { type: 'object' },
                    confidence: { type: 'number' },
                    source: { type: 'string', enum: ['hermes', 'picoclaw', 'system', 'operator'] },
                  },
                  required: ['category', 'key', 'value'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Learning data recorded' },
          },
        },
      },
      '/api/face-tracking': {
        get: {
          tags: ['Face Tracking'],
          summary: 'Get face tracking state',
          description: 'Returns current face tracking state including detections and FPS.',
          operationId: 'getFaceTrackingState',
          responses: {
            '200': { description: 'Face tracking state' },
          },
        },
        post: {
          tags: ['Face Tracking'],
          summary: 'Configure face tracking',
          description: 'Update face tracking configuration or register a face profile.',
          operationId: 'configureFaceTracking',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ['start', 'stop', 'register_face', 'delete_face', 'update_config'] },
                    config: { type: 'object' },
                    profileName: { type: 'string' },
                    profileLabel: { type: 'string' },
                  },
                  required: ['action'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Face tracking configured' },
          },
        },
      },
      '/api/testing': {
        get: {
          tags: ['Testing'],
          summary: 'Get testing status',
          description: 'Returns current hardware and system testing status and results.',
          operationId: 'getTestingStatus',
          responses: {
            '200': { description: 'Testing status' },
          },
        },
        post: {
          tags: ['Testing'],
          summary: 'Run a test',
          description: 'Execute a hardware or system test.',
          operationId: 'runTest',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['hardware', 'sensor', 'motor', 'communication', 'full_system'] },
                    deviceId: { type: 'string' },
                    testSuite: { type: 'string' },
                  },
                  required: ['type'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Test started' },
          },
        },
      },
      '/api/projects': {
        get: {
          tags: ['Projects'],
          summary: 'List robot projects',
          operationId: 'listProjects',
          responses: {
            '200': { description: 'Projects list' },
          },
        },
        post: {
          tags: ['Projects'],
          summary: 'Create robot project',
          operationId: 'createProject',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    templateId: { type: 'string' },
                    config: { type: 'object' },
                  },
                  required: ['name'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Project created' },
          },
        },
      },
      '/api/projects/{id}': {
        get: {
          tags: ['Projects'],
          summary: 'Get project by ID',
          operationId: 'getProject',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Project ID' },
          ],
          responses: {
            '200': { description: 'Project details' },
            '404': { description: 'Not found' },
          },
        },
        put: {
          tags: ['Projects'],
          summary: 'Update project',
          operationId: 'updateProject',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Project ID' },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: {
            '200': { description: 'Project updated' },
          },
        },
        delete: {
          tags: ['Projects'],
          summary: 'Delete project',
          operationId: 'deleteProject',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Project ID' },
          ],
          responses: {
            '200': { description: 'Project deleted' },
          },
        },
      },
      '/api/robot-templates': {
        get: {
          tags: ['Robot Templates'],
          summary: 'List robot templates',
          operationId: 'listRobotTemplates',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
            { name: 'difficulty', in: 'query', schema: { type: 'string' }, description: 'Filter by difficulty' },
          ],
          responses: {
            '200': { description: 'Template list' },
          },
        },
        post: {
          tags: ['Robot Templates'],
          summary: 'Create robot template',
          operationId: 'createRobotTemplate',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string', enum: ['drone', 'rover', 'boat', 'amphibious', 'arm', 'custom'] },
                    requiredHardware: { type: 'array', items: { type: 'object' } },
                    capabilities: { type: 'array', items: { type: 'string' } },
                    difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                  },
                  required: ['name', 'description', 'category'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Template created' },
          },
        },
      },
      '/api/robot-templates/{id}': {
        get: {
          tags: ['Robot Templates'],
          summary: 'Get robot template by ID',
          operationId: 'getRobotTemplate',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Template ID' },
          ],
          responses: {
            '200': { description: 'Template details' },
            '404': { description: 'Not found' },
          },
        },
        put: {
          tags: ['Robot Templates'],
          summary: 'Update robot template',
          operationId: 'updateRobotTemplate',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Template ID' },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: {
            '200': { description: 'Template updated' },
          },
        },
        delete: {
          tags: ['Robot Templates'],
          summary: 'Delete robot template',
          operationId: 'deleteRobotTemplate',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Template ID' },
          ],
          responses: {
            '200': { description: 'Template deleted' },
          },
        },
      },
      '/api/assembly': {
        get: {
          tags: ['Assembly'],
          summary: 'Get assembly status',
          description: 'Returns current assembly status and step-by-step guide progress.',
          operationId: 'getAssemblyStatus',
          responses: {
            '200': { description: 'Assembly status' },
          },
        },
        post: {
          tags: ['Assembly'],
          summary: 'Update assembly progress',
          description: 'Update the assembly step or request next step guidance.',
          operationId: 'updateAssembly',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projectId: { type: 'string' },
                    stepIndex: { type: 'integer' },
                    action: { type: 'string', enum: ['complete_step', 'request_help', 'undo_step'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Assembly updated' },
          },
        },
      },
      '/api/alerts': {
        get: {
          tags: ['Alerts'],
          summary: 'List alerts',
          description: 'Returns system alerts with filtering options.',
          operationId: 'listAlerts',
          parameters: [
            { name: 'level', in: 'query', schema: { type: 'string', enum: ['info', 'warning', 'critical'] } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'isRead', in: 'query', schema: { type: 'boolean' } },
            { name: 'isResolved', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: {
            '200': {
              description: 'Alerts list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/Alert' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Alerts'],
          summary: 'Create alert',
          description: 'Manually create a system alert.',
          operationId: 'createAlert',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AlertInput' },
              },
            },
          },
          responses: {
            '200': { description: 'Alert created' },
          },
        },
      },
      '/api/calibration': {
        get: {
          tags: ['Calibration'],
          summary: 'List calibration records',
          operationId: 'listCalibrations',
          responses: {
            '200': { description: 'Calibration records' },
          },
        },
        post: {
          tags: ['Calibration'],
          summary: 'Start calibration',
          description: 'Start a sensor or device calibration process.',
          operationId: 'startCalibration',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    deviceType: { type: 'string', enum: ['compass', 'accelerometer', 'gyro', 'esc', 'radio'] },
                    deviceId: { type: 'string' },
                    parameters: { type: 'object' },
                  },
                  required: ['deviceType'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Calibration started' },
          },
        },
      },
      '/api/auto-detect': {
        get: {
          tags: ['Auto-Detect'],
          summary: 'Get last scan results',
          description: 'Returns the most recent hardware auto-detection scan results.',
          operationId: 'getAutoDetectResults',
          responses: {
            '200': { description: 'Auto-detect results' },
          },
        },
        post: {
          tags: ['Auto-Detect'],
          summary: 'Run hardware scan',
          description: 'Trigger a hardware auto-detection scan.',
          operationId: 'runAutoDetect',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    scanType: { type: 'string', enum: ['quick', 'full', 'usb', 'i2c', 'spi', 'bluetooth'] },
                    templateId: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Scan completed' },
          },
        },
      },
      '/api/doctor': {
        get: {
          tags: ['Doctor'],
          summary: 'Run system diagnostics',
          description: 'Performs a comprehensive system health check and returns diagnostic results.',
          operationId: 'runDiagnostics',
          responses: {
            '200': { description: 'Diagnostic results' },
          },
        },
      },
      '/api/bootflow': {
        get: {
          tags: ['Boot Flow'],
          summary: 'Get boot flow status',
          description: 'Returns the current system boot sequence status and stage information.',
          operationId: 'getBootFlowStatus',
          responses: {
            '200': { description: 'Boot flow status' },
          },
        },
        post: {
          tags: ['Boot Flow'],
          summary: 'Control boot flow',
          description: 'Start, restart, or advance the boot sequence.',
          operationId: 'controlBootFlow',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ['start', 'restart', 'advance', 'skip'] },
                  },
                  required: ['action'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Boot flow action completed' },
          },
        },
      },
      '/api/stream/telemetry': {
        get: {
          tags: ['Streams'],
          summary: 'Telemetry SSE stream',
          description: 'Server-Sent Events stream for real-time telemetry data updates.',
          operationId: 'streamTelemetry',
          responses: {
            '200': {
              description: 'SSE telemetry stream',
              content: {
                'text/event-stream': {
                  schema: {
                    type: 'object',
                    properties: {
                      event: { type: 'string', example: 'telemetry' },
                      data: { $ref: '#/components/schemas/TelemetryReading' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/stream/alerts': {
        get: {
          tags: ['Streams'],
          summary: 'Alerts SSE stream',
          description: 'Server-Sent Events stream for real-time alert notifications.',
          operationId: 'streamAlerts',
          responses: {
            '200': {
              description: 'SSE alerts stream',
              content: {
                'text/event-stream': {
                  schema: {
                    type: 'object',
                    properties: {
                      event: { type: 'string', example: 'alert' },
                      data: { $ref: '#/components/schemas/Alert' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/stream/testing': {
        get: {
          tags: ['Streams'],
          summary: 'Testing SSE stream',
          description: 'Server-Sent Events stream for real-time testing progress and results.',
          operationId: 'streamTesting',
          responses: {
            '200': {
              description: 'SSE testing stream',
              content: {
                'text/event-stream': {
                  schema: {
                    type: 'object',
                    properties: {
                      event: { type: 'string', example: 'test_result' },
                      data: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        HardwareDevice: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique device identifier' },
            name: { type: 'string', description: 'Device name' },
            deviceType: {
              type: 'string',
              enum: ['flight_controller', 'companion_computer', 'gps', 'camera', 'sensor', 'radio', 'battery', 'motor', 'servo', 'esc'],
              description: 'Type of hardware device',
            },
            protocol: {
              type: 'string',
              enum: ['usb', 'i2c', 'spi', 'uart', 'gpio', 'can', 'adc'],
              description: 'Communication protocol',
            },
            status: {
              type: 'string',
              enum: ['unknown', 'detected', 'initialized', 'active', 'error', 'offline'],
              description: 'Current device status',
            },
            vendorId: { type: 'string', nullable: true, description: 'USB Vendor ID' },
            productId: { type: 'string', nullable: true, description: 'USB Product ID' },
            port: { type: 'string', nullable: true, description: 'Connection port (e.g., /dev/ttyUSB0)' },
            address: { type: 'string', nullable: true, description: 'Bus address (e.g., I2C 0x68)' },
            capabilities: { type: 'string', nullable: true, description: 'JSON capabilities string' },
            firmware: { type: 'string', nullable: true, description: 'Current firmware version' },
            lastSeen: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        HardwareDeviceInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            deviceType: { type: 'string' },
            protocol: { type: 'string' },
            vendorId: { type: 'string' },
            productId: { type: 'string' },
            port: { type: 'string' },
            address: { type: 'string' },
            firmware: { type: 'string' },
          },
          required: ['name', 'deviceType', 'protocol'],
        },
        Mission: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            type: {
              type: 'string',
              enum: ['mapping', 'survey', 'delivery', 'patrol', 'inspection', 'agriculture'],
            },
            status: {
              type: 'string',
              enum: ['draft', 'planned', 'active', 'paused', 'completed', 'failed', 'aborted'],
            },
            prompt: { type: 'string', nullable: true, description: 'Natural language prompt that generated the mission' },
            waypoints: { type: 'string', description: 'JSON array of waypoints' },
            parameters: { type: 'string', nullable: true, description: 'JSON mission parameters' },
            altitude: { type: 'number', default: 50 },
            speed: { type: 'number', default: 5 },
            overlapFront: { type: 'number', default: 75 },
            overlapSide: { type: 'number', default: 65 },
            gsd: { type: 'number', nullable: true, description: 'Ground Sampling Distance in cm/pixel' },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        MissionInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string' },
            prompt: { type: 'string' },
            waypoints: { type: 'array', items: { type: 'object' } },
            altitude: { type: 'number' },
            speed: { type: 'number' },
            overlapFront: { type: 'number' },
            overlapSide: { type: 'number' },
          },
          required: ['name'],
        },
        TelemetryReading: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            deviceId: { type: 'string', nullable: true },
            metric: {
              type: 'string',
              enum: ['battery_voltage', 'gps_lat', 'gps_lng', 'altitude', 'signal_strength', 'temperature', 'humidity', 'pressure', 'heading', 'speed', 'roll', 'pitch', 'yaw'],
            },
            value: { type: 'number' },
            unit: { type: 'string', nullable: true, description: 'Unit of measurement (V, m, %, dBm, C, hPa, deg, m/s)' },
            source: { type: 'string', enum: ['sensor', 'manual'] },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        TelemetryReadingInput: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            metric: { type: 'string' },
            value: { type: 'number' },
            unit: { type: 'string' },
            source: { type: 'string', enum: ['sensor', 'manual'] },
          },
          required: ['metric', 'value'],
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            level: { type: 'string', enum: ['info', 'warning', 'critical'] },
            source: { type: 'string', enum: ['system', 'picoclaw', 'hermes', 'sensor', 'battery', 'gps'] },
            title: { type: 'string' },
            message: { type: 'string' },
            category: { type: 'string', enum: ['safety', 'hardware', 'mission', 'system', 'communication'] },
            isRead: { type: 'boolean' },
            isResolved: { type: 'boolean' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        AlertInput: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['info', 'warning', 'critical'] },
            source: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            category: { type: 'string', enum: ['safety', 'hardware', 'mission', 'system', 'communication'] },
          },
          required: ['level', 'title', 'message', 'category'],
        },
        AgentMessage: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            missionId: { type: 'string', nullable: true },
            agent: { type: 'string', enum: ['hermes', 'picoclaw', 'operator', 'system'] },
            role: { type: 'string', enum: ['command', 'response', 'alert', 'recommendation', 'status'] },
            content: { type: 'string' },
            metadata: { type: 'string', nullable: true, description: 'JSON metadata' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        PowerSource: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['battery', 'solar', 'gsm', 'usb'] },
            name: { type: 'string' },
            status: { type: 'string', enum: ['unknown', 'charging', 'discharging', 'full', 'error', 'offline'] },
            capacity: { type: 'number', description: 'Capacity in mAh or mW' },
            currentLevel: { type: 'number', description: 'Current level (percentage or voltage)' },
            voltage: { type: 'number' },
            current: { type: 'number', description: 'Current in amps' },
            temperature: { type: 'number' },
            config: { type: 'string', nullable: true, description: 'JSON power source config' },
            projectId: { type: 'string', nullable: true },
            lastReading: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PowerSourceInput: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['battery', 'solar', 'gsm', 'usb'] },
            name: { type: 'string' },
            status: { type: 'string' },
            capacity: { type: 'number' },
            currentLevel: { type: 'number' },
            voltage: { type: 'number' },
            current: { type: 'number' },
            temperature: { type: 'number' },
            config: { type: 'object' },
            projectId: { type: 'string' },
          },
          required: ['type', 'name'],
        },
        NavigationPlanInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['gps_track', 'autopilot', 'rth', 'field_mapping', 'survey', 'delivery'] },
            waypoints: { type: 'array', items: { type: 'object' } },
            homePosition: { type: 'object' },
            geofence: { type: 'object' },
            parameters: { type: 'object' },
            projectId: { type: 'string' },
          },
          required: ['name', 'type'],
        },
      },
    },
  }
}
