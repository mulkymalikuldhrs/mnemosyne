# API Hub Documentation — Memorix v4.0

> Complete documentation for Memorix as a Middle Provider / API Hub, offering universal LLM access, agent execution, multi-model comparison, and more.

---

## Table of Contents

- [Memorix as Middle Provider / API Hub](#memorix-as-middle-provider--api-hub)
- [Universal Chat API](#universal-chat-api)
- [Agent Execution API](#agent-execution-api)
- [Multi-Model Comparison API](#multi-model-comparison-api)
- [Model Registry API](#model-registry-api)
- [Web Search API](#web-search-api)
- [OpenAI Compatibility](#openai-compatibility)
- [Anthropic Compatibility](#anthropic-compatibility)
- [Streaming Support](#streaming-support)
- [Rate Limits](#rate-limits)
- [Authentication](#authentication)
- [Usage Examples](#usage-examples)
- [SaaS/IaaS Integration Patterns](#saasiaas-integration-patterns)
- [SDK Integration](#sdk-integration)

---

## Memorix as Middle Provider / API Hub

Memorix v4.0 operates as a **middle provider** — an API hub that aggregates multiple LLM providers behind a single, unified interface. This is the core architectural innovation:

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                       │
│                                                          │
│   Single API endpoint → Memorix API Hub                  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               Memorix API Hub (Middle Provider)          │
│                                                          │
│   ┌──────────────────────────────────────────────────┐  │
│   │              LLM Router                           │  │
│   │                                                   │  │
│   │   Auto-routes to the optimal provider:            │  │
│   │   • Free model → Puter.js (zero cost)             │  │
│   │   • BYOK model → User's API key                   │  │
│   │   • Fallback → Try Puter.js → Try BYOK            │  │
│   └──────────────────────────────────────────────────┘  │
│                                                          │
│   ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐   │
│   │ Puter.js│ │ OpenAI   │ │Anthropic│ │ Google    │   │
│   │ (FREE)  │ │          │ │        │ │           │   │
│   └─────────┘ └──────────┘ └────────┘ └───────────┘   │
│   ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐   │
│   │DeepSeek │ │OpenRouter│ │ Ollama │ │ Custom    │   │
│   │         │ │          │ │(Local) │ │           │   │
│   └─────────┘ └──────────┘ └────────┘ └───────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Why Use Memorix as an API Hub?

| Benefit | Description |
|---------|-------------|
| **Zero-cost start** | 500+ models free via Puter.js — no API key needed |
| **Single interface** | One API for all providers — no provider-specific code |
| **Auto-routing** | Automatically picks the best provider for each request |
| **Fallback chain** | Puter.js → BYOK → error — maximum reliability |
| **OpenAI-compatible** | Drop-in replacement for OpenAI API |
| **Streaming support** | SSE streaming for all compatible providers |
| **Model comparison** | Run the same prompt across multiple models simultaneously |
| **Built-in agent** | AI agent with tool calling, no orchestration needed |

---

## Universal Chat API

### `POST /api/llm/chat`

The primary API endpoint for LLM interactions. Routes to the appropriate provider automatically.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model ID (e.g., `"openai/gpt-5.4-nano"`, `"byok/openai-gpt-4o"`) |
| `messages` | array | Yes | Array of message objects with `role` and `content` |
| `temperature` | number | No | Sampling temperature (0.0–2.0, default: 0.7) |
| `maxTokens` | number | No | Maximum tokens to generate (default: 2048) |
| `topP` | number | No | Top-p sampling parameter |
| `stream` | boolean | No | Enable SSE streaming (default: false) |
| `tools` | array | No | Tool definitions for function calling |
| `apiKey` | string | No | API key for BYOK providers |
| `provider` | string | No | Explicit provider override |

#### Response (Non-Streaming)

```json
{
  "success": true,
  "data": {
    "content": "The meaning of life is a philosophical question...",
    "model": "openai/gpt-5.4-nano",
    "provider": "puter",
    "toolCalls": null,
    "usage": {
      "promptTokens": 23,
      "completionTokens": 156,
      "totalTokens": 179
    },
    "finishReason": "stop"
  }
}
```

#### Example: Simple Chat

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.4-nano",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain quantum computing in 3 sentences."}
    ],
    "temperature": 0.7,
    "maxTokens": 256
  }'
```

#### Example: Tool Calling

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.4",
    "messages": [
      {"role": "user", "content": "What is the weather in Tokyo?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {"type": "string", "description": "City name"}
            },
            "required": ["location"]
          }
        }
      }
    ]
  }'
```

---

## Agent Execution API

### `POST /api/llm/agent`

Execute the built-in AI agent with tool calling. The agent can search memory, save notes, track decisions, and search the web.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The user message for the agent |
| `userId` | string | Yes | User ID for memory access |
| `model` | string | No | Override default model (default: `openai/gpt-5.4-nano`) |
| `provider` | string | No | Override provider |
| `systemPrompt` | string | No | Override default system prompt |
| `maxIterations` | number | No | Max agent iterations (default: 5) |
| `tools` | string[] | No | Override available tools |
| `apiKey` | string | No | API key for BYOK |
| `conversationId` | string | No | Continue existing conversation |
| `metadata` | object | No | Additional context metadata |

#### Response

```json
{
  "success": true,
  "data": {
    "response": "I found 3 notes about machine learning in your memory...",
    "toolCallsMade": 2,
    "memoryRefs": ["clx123", "clx456"],
    "model": "openai/gpt-5.4-nano",
    "iterations": 3,
    "messages": [
      {"role": "system", "content": "You are Memorix Agent..."},
      {"role": "user", "content": "Search my memory for ML notes"},
      {"role": "assistant", "content": "", "toolCalls": [...]},
      {"role": "tool", "content": "[...search results...]", "toolName": "memory_search"},
      {"role": "assistant", "content": "I found 3 notes about machine learning..."}
    ]
  }
}
```

#### Available Agent Tools

| Tool | Description |
|------|-------------|
| `memory_search` | Search user's memory with semantic search |
| `memory_save` | Save a new note to the knowledge base |
| `memory_update` | Update an existing note |
| `memory_delete` | Delete a note from the knowledge base |
| `memory_insights` | Get AI-powered insights about memory patterns |
| `web_search` | Search the web for current information |
| `decision_track` | Track a decision with context and reasoning |

#### Example: Agent Execution

```bash
curl -X POST http://localhost:3000/api/llm/agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Search my memory for notes about API design and summarize the key decisions",
    "userId": "user-123",
    "model": "openai/gpt-5.4-nano",
    "maxIterations": 5
  }'
```

### `GET /api/llm/agent`

Get available agent tools and default configuration.

#### Response

```json
{
  "success": true,
  "data": {
    "defaultConfig": {
      "name": "Memorix Agent",
      "description": "Your personal AI memory assistant",
      "model": "openai/gpt-5.4-nano",
      "maxIterations": 5
    },
    "availableTools": [
      {
        "name": "memory_search",
        "description": "Search the user's memory/notes using semantic search",
        "parameters": { "type": "object", "properties": {...} }
      }
    ]
  }
}
```

---

## Multi-Model Comparison API

### `POST /api/llm/compare`

Run the same prompt across multiple models simultaneously and compare responses.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The prompt to send to all models |
| `models` | string[] | Yes | Array of model IDs to compare |
| `temperature` | number | No | Temperature for all models |
| `maxTokens` | number | No | Max tokens for all models |
| `apiKey` | string | No | API key for BYOK models |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "model": "openai/gpt-5.4-nano",
      "response": {
        "content": "Quantum computing uses quantum bits...",
        "provider": "puter",
        "usage": {"promptTokens": 15, "completionTokens": 120, "totalTokens": 135}
      }
    },
    {
      "model": "anthropic/claude-sonnet-4-6",
      "response": {
        "content": "Quantum computing is a paradigm that leverages...",
        "provider": "puter",
        "usage": {"promptTokens": 15, "completionTokens": 95, "totalTokens": 110}
      }
    },
    {
      "model": "google/gemini-3.1-flash-lite",
      "error": "Rate limit exceeded"
    }
  ]
}
```

#### Example

```bash
curl -X POST http://localhost:3000/api/llm/compare \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain the benefits of edge computing in 3 bullet points.",
    "models": [
      "openai/gpt-5.4-nano",
      "anthropic/claude-sonnet-4-6",
      "google/gemini-3.1-flash-lite",
      "deepseek/deepseek-chat"
    ],
    "temperature": 0.5,
    "maxTokens": 512
  }'
```

---

## Model Registry API

### `GET /api/llm/models`

List all available models with metadata.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "openai/gpt-5.4-nano",
      "name": "GPT-5.4 Nano",
      "provider": "puter",
      "providerLabel": "OpenAI",
      "isFree": true,
      "contextWindow": 128000,
      "capabilities": ["chat", "code", "streaming", "tool_use"],
      "pricing": null
    },
    {
      "id": "byok/openai-gpt-4o",
      "name": "GPT-4o (BYOK)",
      "provider": "openai",
      "providerLabel": "OpenAI",
      "isFree": false,
      "contextWindow": 128000,
      "capabilities": ["chat", "vision", "code", "streaming", "tool_use"],
      "pricing": {"input": 2.5, "output": 10}
    }
  ]
}
```

#### Example

```bash
curl http://localhost:3000/api/llm/models
```

---

## Web Search API

### `POST /api/llm/web-search`

Search the web for current information.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `num` | number | No | Number of results (default: 5) |

#### Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "name": "Latest AI Research Breakthrough",
        "url": "https://example.com/article",
        "snippet": "Researchers have developed a new approach to..."
      }
    ]
  }
}
```

#### Example

```bash
curl -X POST http://localhost:3000/api/llm/web-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest developments in LLM technology 2025",
    "num": 5
  }'
```

---

## OpenAI Compatibility

Memorix can serve as a **drop-in replacement** for the OpenAI API. The Universal Chat API follows the OpenAI chat completions format, making it compatible with any library or tool that expects OpenAI's API.

### Compatibility Layer

```
OpenAI Client Library
        │
        │ HTTP request to api.openai.com
        ▼
┌─────────────────────┐     ┌─────────────────────┐
│  Reverse Proxy       │     │  Direct Usage        │
│  (Caddy / Nginx)    │     │  (Change base URL)   │
│                      │     │                      │
│  api.openai.com →   │     │  baseURL =            │
│  memorix:3000       │     │  localhost:3000       │
└─────────────────────┘     └─────────────────────┘
```

### Using with OpenAI Python SDK

```python
from openai import OpenAI

# Point to Memorix instead of OpenAI
client = OpenAI(
    base_url="http://localhost:3000/api/llm/chat",
    api_key="not-needed-for-free-models"  # Or your BYOK key
)

response = client.chat.completions.create(
    model="openai/gpt-5.4-nano",
    messages=[
        {"role": "user", "content": "Hello from Memorix!"}
    ]
)

print(response.choices[0].message.content)
```

### Using with OpenAI Node SDK

```javascript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'http://localhost:3000/api/llm/chat',
  apiKey: 'not-needed-for-free-models',
})

const response = await client.chat.completions.create({
  model: 'openai/gpt-5.4-nano',
  messages: [{ role: 'user', content: 'Hello from Memorix!' }],
})

console.log(response.choices[0].message.content)
```

### Model ID Mapping

| OpenAI Model | Memorix Model ID | Free? |
|-------------|------------------|-------|
| gpt-4o | `openai/gpt-4o` | Yes |
| gpt-4o-mini | `openai/gpt-4o-mini` | Yes |
| gpt-5.4-nano | `openai/gpt-5.4-nano` | Yes |
| gpt-5.4 | `openai/gpt-5.4` | Yes |
| o3 | `openai/o3` | Yes |
| o4-mini | `openai/o4-mini` | Yes |

---

## Anthropic Compatibility

While Memorix's API follows OpenAI's format, it also provides access to Anthropic models through the same unified interface. Internally, Memorix handles the format conversion between OpenAI and Anthropic APIs.

### Using Anthropic Models

```bash
# Claude Opus via Memorix (free via Puter.js)
curl -X POST http://localhost:3000/api/llm/chat \
  -d '{
    "model": "anthropic/claude-opus-4-8",
    "messages": [{"role": "user", "content": "Analyze this data."}]
  }'
```

### Format Conversion

Memorix automatically converts between formats:

| Feature | OpenAI Format | Anthropic Format | Memorix Handling |
|---------|--------------|-----------------|------------------|
| System message | `messages[0].role = "system"` | `system` parameter | Extracted and sent as `system` |
| Tool calls | `tool_calls` array | `tool_use` content blocks | Converted automatically |
| Tool results | `role: "tool"` | `tool_result` content block | Converted automatically |
| Usage | `prompt_tokens`, `completion_tokens` | `input_tokens`, `output_tokens` | Normalized to OpenAI format |

---

## Streaming Support

### SSE (Server-Sent Events) Streaming

All chat API calls support streaming via SSE:

```bash
curl -N -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.4-nano",
    "messages": [{"role": "user", "content": "Write a story."}],
    "stream": true
  }'
```

### Stream Format

```
data: {"content":"Once"}

data: {"content":" upon"}

data: {"content":" a time"}

data: {"finishReason":"stop"}

data: [DONE]
```

### Streaming with JavaScript

```javascript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'openai/gpt-5.4-nano',
    messages: [{ role: 'user', content: 'Write a poem.' }],
    stream: true,
  }),
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const text = decoder.decode(value)
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') break
      const chunk = JSON.parse(data)
      if (chunk.content) process.stdout.write(chunk.content)
    }
  }
}
```

### Streaming with Python

```python
import requests
import json

response = requests.post(
    'http://localhost:3000/api/llm/chat',
    json={
        'model': 'openai/gpt-5.4-nano',
        'messages': [{'role': 'user', 'content': 'Tell me a story.'}],
        'stream': True,
    },
    stream=True,
)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]
            if data == '[DONE]:
                break
            chunk = json.loads(data)
            if 'content' in chunk:
                print(chunk['content'], end='', flush=True)
```

---

## Rate Limits

### Default Rate Limits

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| `/api/llm/chat` | 30 req/min | Per user |
| `/api/llm/agent` | 10 req/min | Per user |
| `/api/llm/compare` | 5 req/min | Per user |
| `/api/llm/models` | 60 req/min | Per user |
| `/api/llm/web-search` | 15 req/min | Per user |

### Provider-Specific Limits

| Provider | Free Tier | Paid Tier |
|----------|-----------|-----------|
| **Puter.js** | ~30 req/min, ~100K tokens/day | Higher limits on Puter.com Pro |
| **OpenAI** | Per your API key tier | Tier 1–5 scaling |
| **Anthropic** | Per your API key tier | Scale with usage |
| **Google** | 15 RPM free, 60 RPM paid | Up to 1000 RPM |
| **DeepSeek** | Generous limits | Very high limits |
| **Ollama** | No limit (local) | No limit (local) |

### Handling Rate Limits

```typescript
// Example: Retry with exponential backoff
async function chatWithRetry(config, messages, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await LLMRouter.chat(config, messages)
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}
```

---

## Authentication

### API Key Authentication

For BYOK endpoints and protected resources:

```bash
# Include API key in request body
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "byok/openai-gpt-4o",
    "provider": "openai",
    "apiKey": "sk-your-openai-key",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Session Authentication

For Memorix user sessions:

```bash
# Include session token in header
curl -X POST http://localhost:3000/api/llm/agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-session-token" \
  -d '{
    "message": "Search my memory",
    "userId": "user-123"
  }'
```

### No Authentication (Free Models)

Free Puter.js models require no API key:

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.4-nano",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Usage Examples

### cURL

```bash
# Chat with free model
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-5.4-nano","messages":[{"role":"user","content":"Hello"}]}'

# Stream a response
curl -N -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-5.4-nano","messages":[{"role":"user","content":"Write a story"}],"stream":true}'

# Compare models
curl -X POST http://localhost:3000/api/llm/compare \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is AI?","models":["openai/gpt-5.4-nano","anthropic/claude-sonnet-4-6"]}'

# List models
curl http://localhost:3000/api/llm/models
```

### Python

```python
import requests

BASE_URL = "http://localhost:3000/api/llm"

# Chat
response = requests.post(f"{BASE_URL}/chat", json={
    "model": "openai/gpt-5.4-nano",
    "messages": [{"role": "user", "content": "Hello from Python!"}],
    "temperature": 0.7,
})
print(response.json()["data"]["content"])

# Compare
response = requests.post(f"{BASE_URL}/compare", json={
    "prompt": "Explain transformers",
    "models": ["openai/gpt-5.4-nano", "deepseek/deepseek-chat"],
})
for result in response.json()["data"]:
    print(f"Model: {result['model']}")
    if "response" in result:
        print(f"Response: {result['response']['content'][:100]}...")

# Agent
response = requests.post(f"{BASE_URL}/agent", json={
    "message": "Search my memory for meeting notes",
    "userId": "user-123",
})
print(response.json()["data"]["response"])
```

### JavaScript

```javascript
const BASE_URL = '/api/llm'

// Chat
const chatResponse = await fetch(`${BASE_URL}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'openai/gpt-5.4-nano',
    messages: [{ role: 'user', content: 'Hello from JS!' }],
  }),
})
const chatData = await chatResponse.json()
console.log(chatData.data.content)

// Streaming
const streamResponse = await fetch(`${BASE_URL}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'openai/gpt-5.4-nano',
    messages: [{ role: 'user', content: 'Tell me a story.' }],
    stream: true,
  }),
})

const reader = streamResponse.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const text = decoder.decode(value)
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      const chunk = JSON.parse(line.slice(6))
      if (chunk.content) process.stdout.write(chunk.content)
    }
  }
}

// Models
const modelsResponse = await fetch(`${BASE_URL}/models`)
const modelsData = await modelsResponse.json()
console.log(`Available models: ${modelsData.data.length}`)
```

---

## SaaS/IaaS Integration Patterns

### Pattern 1: API Gateway

Use Memorix as a unified API gateway for your SaaS:

```
Your SaaS App → Memorix API Hub → Multiple LLM Providers
                    │
                    ├── Auto-routing (free → paid)
                    ├── Fallback chains
                    ├── Rate limiting
                    └── Usage analytics
```

### Pattern 2: Multi-Tenant LLM Service

```
Tenant A ──┐
Tenant B ──┼──→ Memorix API Hub ──→ LLM Providers
Tenant C ──┘         │
                     ├── Per-tenant API keys
                     ├── Per-tenant rate limits
                     ├── Usage tracking per tenant
                     └── Billing integration
```

### Pattern 3: AI-Powered Feature Enhancement

```
Your Application
├── Feature A ──→ Memorix Chat API ──→ Smart responses
├── Feature B ──→ Memorix Agent API ──→ Autonomous actions
├── Feature C ──→ Memorix Compare API ──→ A/B testing
└── Feature D ──→ Memorix Web Search ──→ Real-time data
```

### Pattern 4: White-Label AI

```
Your Brand's App
├── Your UI/UX
├── Your Branding
└── Memorix API Hub (hidden backend)
    ├── 500+ models
    ├── Auto-routing
    └── Zero-config free tier
```

---

## SDK Integration

### z-ai-web-dev-sdk

Memorix's MCP server uses the `z-ai-web-dev-sdk` for LLM-powered chat responses:

```typescript
import zai from 'z-ai-web-dev-sdk'

const client = await zai.create()

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are Memorix, a personal AI memory assistant.' },
    { role: 'user', content: 'What do I know about databases?' },
  ],
  max_tokens: 1024,
  temperature: 0.7,
})

console.log(response.choices[0].message.content)
```

### Custom SDK Wrapper

You can build your own SDK wrapper around Memorix's API:

```typescript
class MemorixClient {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  async chat(model: string, messages: Array<{role: string; content: string}>, options?: {
    temperature?: number
    maxTokens?: number
    stream?: boolean
  }) {
    const response = await fetch(`${this.baseUrl}/api/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        ...options,
        apiKey: this.apiKey,
      }),
    })
    return response.json()
  }

  async compare(prompt: string, models: string[]) {
    const response = await fetch(`${this.baseUrl}/api/llm/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, models, apiKey: this.apiKey }),
    })
    return response.json()
  }

  async agent(message: string, userId: string, options?: Record<string, any>) {
    const response = await fetch(`${this.baseUrl}/api/llm/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId, ...options }),
    })
    return response.json()
  }

  async models() {
    const response = await fetch(`${this.baseUrl}/api/llm/models`)
    return response.json()
  }
}

// Usage
const memorix = new MemorixClient('http://localhost:3000')
const result = await memorix.chat('openai/gpt-5.4-nano', [
  { role: 'user', content: 'Hello!' }
])
```

---

*Memorix v4.0 — The Biggest Free Multi-LLM Hub. One API for all models.*
