# Mnemosyne v4.0 — AI Agent System

> Documentation for the built-in AI Agent that can use any LLM from the multi-provider pool, execute tools, manage memory, and interact with all mnemosyne data.

---

## Table of Contents

- [Overview](#overview)
- [Agent Types](#agent-types)
- [AgentConfig Interface](#agentconfig-interface)
- [Built-in Tools](#built-in-tools)
- [Tool Registry](#tool-registry)
- [Agent Execution Engine](#agent-execution-engine)
- [Execution Loop Diagram](#execution-loop-diagram)
- [Default Agent Config](#default-agent-config)
- [Custom Agents](#custom-agents)
- [Agent API Endpoints](#agent-api-endpoints)
- [Multi-LLM Agent](#multi-llm-agent)
- [Integration with Puter.js](#integration-with-puterjs)
- [Example Workflows](#example-workflows)

---

## Overview

Mnemosyne includes a built-in AI Agent system that combines the power of any LLM from the multi-provider pool with 7 built-in tools. The agent can search your memories, save new notes, update existing ones, track decisions, search the web, and generate insights about your knowledge base — all powered by free LLM models via Puter.js.

The key innovation is that the agent is **model-agnostic**: you can use any model from the pool (GPT-5.5 Pro, Claude Opus 4.8, DeepSeek R1, etc.) as the "brain" of the agent, and it will automatically route to the correct provider via the LLM Router.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| **Model-Agnostic** | Use any LLM from the pool (500+ via Puter.js or BYOK) |
| **Tool Calling** | 7 built-in tools with full parameter validation |
| **Agentic Loop** | Autonomous execution until task completion (configurable max iterations) |
| **Memory-Aware** | Automatically searches your memory before answering |
| **Free Execution** | Powered by Puter.js — no API key needed for basic usage |
| **Context Tracking** | Tracks memory references created during execution |

---

## Agent Types

### The mnemosyne Agent

The default agent type in mnemosyne v4.0 is the **mnemosyne Agent** — a configurable, multi-LLM agent with access to the full tool registry. Unlike v2.0's multi-agent system (Hermes, PicoClaw, Sentinel, etc.), v4.0 uses a single, flexible agent that can be configured for any task by changing the system prompt, model, and tool set.

| Property | Description |
|----------|-------------|
| **Type** | Multi-LLM Agent (configurable) |
| **Default Model** | `openai/gpt-5.4-nano` (free via Puter.js) |
| **Max Iterations** | 5 (configurable) |
| **Tools** | All 7 built-in tools (configurable subset) |
| **Provider** | Auto-routed via LLM Router (Puter.js → BYOK fallback) |

---

## AgentConfig Interface

Every agent execution is configured through the `AgentConfig` interface:

```typescript
interface AgentConfig {
  id?: string                    // Optional agent identifier
  name: string                   // Agent display name
  description: string            // Agent description
  systemPrompt: string           // System prompt that defines agent behavior
  model: string                  // LLM model ID (e.g., "openai/gpt-5.4-nano")
  provider?: string              // Explicit provider override ("puter" | "openai" | etc.)
  temperature?: number           // LLM temperature (default: 0.7)
  maxTokens?: number             // Maximum tokens in response (default: 2048)
  maxIterations?: number         // Maximum agentic loop iterations (default: 5)
  tools: string[]                // Array of tool names to enable
  apiKey?: string                // BYOK API key (for BYOK models)
  baseUrl?: string               // Custom base URL (for local/custom providers)
}
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | Display name for the agent |
| `description` | `string` | Yes | — | Human-readable description of the agent's purpose |
| `systemPrompt` | `string` | Yes | — | Instructions that define the agent's behavior and personality |
| `model` | `string` | Yes | `"openai/gpt-5.4-nano"` | Model ID from the model registry |
| `provider` | `string` | No | Auto-detected | Override the provider routing |
| `temperature` | `number` | No | `0.7` | Controls randomness (0 = deterministic, 1 = creative) |
| `maxTokens` | `number` | No | `2048` | Maximum tokens in the LLM response |
| `maxIterations` | `number` | No | `5` | Maximum number of agentic loop iterations |
| `tools` | `string[]` | Yes | All 7 tools | Subset of tools to make available |
| `apiKey` | `string` | No | — | API key for BYOK providers |
| `baseUrl` | `string` | No | — | Custom endpoint URL for local/custom providers |

---

## Built-in Tools

The mnemosyne Agent comes with 7 built-in tools that provide full access to the user's knowledge base and the web:

### 1. memory_search

Search the user's memory/notes using semantic search. Use this to find relevant memories, notes, or knowledge before answering questions.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | The search query to find relevant memories |
| `limit` | `number` | No | Maximum results to return (default: 5) |

**Behavior:**
- Calls the `/api/search` endpoint with the query
- Returns matching notes with ID, title, content snippet, and relevance score
- Uses vector similarity (cosine) + keyword matching as fallback
- The agent should always search memory first before answering questions

**Example Tool Call:**
```json
{
  "name": "memory_search",
  "arguments": {
    "query": "project deadlines Q4",
    "limit": 5
  }
}
```

**Example Response:**
```json
[
  {"id": "note-1", "title": "Q4 Planning", "snippet": "Deadline for Q4 deliverables is December 15...", "score": 0.89},
  {"id": "note-2", "title": "Sprint Review Notes", "snippet": "The team agreed to prioritize...", "score": 0.72}
]
```

---

### 2. memory_save

Save a new note/memory to the user's knowledge base. Use this when the user shares important information that should be stored for future reference.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | Yes | Title of the note |
| `content` | `string` | Yes | Content of the note |
| `tags` | `string` | No | Comma-separated tags for categorization |

**Behavior:**
- Calls `/api/notes` POST endpoint to create a new note
- The note is automatically chunked and embedded for semantic search
- The note ID is added to `context.memoryRefs` for tracking
- Auto-creates MemoryLinks to existing notes with similar tags

**Example Tool Call:**
```json
{
  "name": "memory_save",
  "arguments": {
    "title": "Meeting Notes: API Design Review",
    "content": "Decided to use REST for the public API and gRPC for internal services. Rate limiting: 100 req/min for free tier, 1000 req/min for pro.",
    "tags": "meeting,api,architecture,rate-limiting"
  }
}
```

**Example Response:**
```
Note saved: "Meeting Notes: API Design Review" (ID: note-abc123)
```

---

### 3. memory_update

Update an existing note/memory in the user's knowledge base. Use this to correct or augment existing information.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The note ID to update |
| `title` | `string` | No | New title |
| `content` | `string` | No | New content |
| `tags` | `string` | No | New tags |

**Behavior:**
- Calls `/api/notes/[id]` PUT endpoint
- Only provided fields are updated (partial update)
- The note is re-chunked and re-embedded after update
- At least one of `title`, `content`, or `tags` must be provided

**Example Tool Call:**
```json
{
  "name": "memory_update",
  "arguments": {
    "id": "note-abc123",
    "content": "Updated: Decided to use REST for public API. Rate limiting changed to 200 req/min for free tier.",
    "tags": "meeting,api,architecture,rate-limiting,updated"
  }
}
```

**Example Response:**
```
Note updated: note-abc123
```

---

### 4. memory_delete

Delete a note/memory from the user's knowledge base. Use this when the user explicitly requests removal of a note or when information is no longer relevant.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The note ID to delete |

**Behavior:**
- Calls `/api/notes/[id]` DELETE endpoint
- Removes the note and all associated chunks and embeddings
- Cleans up related MemoryLinks

**Example Tool Call:**
```json
{
  "name": "memory_delete",
  "arguments": {
    "id": "note-abc123"
  }
}
```

**Example Response:**
```
Note deleted: note-abc123
```

---

### 5. memory_insights

Get AI-powered insights about the user's memory patterns, topics, and connections. Use this to help the user understand their knowledge base holistically.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `string` | No | Type of insights: `"patterns"`, `"related"`, or `"temporal"` |

**Behavior:**
- `patterns`: Calls `/api/memory/patterns` — detects tag frequency, keyword trends, knowledge clusters
- `temporal`: Calls `/api/graph/temporal` — shows how memory evolves over time
- `related` or omitted: Calls `/api/memory` — returns overall memory context

**Example Tool Call:**
```json
{
  "name": "memory_insights",
  "arguments": {
    "type": "patterns"
  }
}
```

**Example Response:**
```json
{
  "patterns": [
    "Recurring topic: 'api' appears in 8 notes",
    "Common themes in titles: \"design\", \"review\", \"planning\"",
    "Active memory: 42 notes across 15 unique tags"
  ]
}
```

---

### 6. web_search

Search the web for current information. Use this when the user asks about recent events, current data, or information not available in their memory.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Search query |
| `num` | `number` | No | Number of results (default: 5) |

**Behavior:**
- Calls `/api/llm/web-search` POST endpoint
- Uses z-ai-web-dev-sdk for web search
- Returns page titles, URLs, and snippets
- The agent should prefer memory search first, then fall back to web search

**Example Tool Call:**
```json
{
  "name": "web_search",
  "arguments": {
    "query": "latest Node.js 24 features",
    "num": 5
  }
}
```

**Example Response:**
```json
[
  {"title": "Node.js 24 Release Notes", "url": "https://nodejs.org/...", "snippet": "Node.js 24 includes native TypeScript support..."},
  {"title": "What's New in Node.js 24", "url": "https://dev.to/...", "snippet": "The latest LTS release brings..."}
]
```

---

### 7. decision_track

Track a decision with context, reasoning, and outcomes. Use this when the user makes an important decision that should be recorded for future reference.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | Yes | Decision title |
| `context` | `string` | Yes | The situation/context that led to the decision |
| `decision` | `string` | Yes | What was decided |
| `reasoning` | `string` | No | Why this decision was made |

**Behavior:**
- Calls `/api/decisions` POST endpoint
- Creates a Decision record with full context and reasoning
- Enables future retrospection: "Why did I decide X?"
- The agent should proactively suggest tracking important decisions

**Example Tool Call:**
```json
{
  "name": "decision_track",
  "arguments": {
    "title": "Choose PostgreSQL over MongoDB",
    "context": "Building a new multi-tenant SaaS application that needs ACID compliance",
    "decision": "Use PostgreSQL as the primary database",
    "reasoning": "ACID compliance is critical for financial data. Strong schema enforcement reduces bugs. JSON columns provide flexibility when needed."
  }
}
```

**Example Response:**
```
Decision tracked: "Choose PostgreSQL over MongoDB"
```

---

## Tool Registry

The Tool Registry is a `Record<string, AgentTool>` map that stores all available tools by name. It provides O(1) lookup for tool execution during the agentic loop.

```typescript
export const TOOL_REGISTRY: Record<string, AgentTool> = {
  memory_search:   MEMORY_SEARCH_TOOL,
  memory_save:     MEMORY_SAVE_TOOL,
  memory_update:   MEMORY_UPDATE_TOOL,
  memory_delete:   MEMORY_DELETE_TOOL,
  memory_insights: MEMORY_INSIGHTS_TOOL,
  web_search:      WEB_SEARCH_TOOL,
  decision_track:  DECISION_TRACK_TOOL,
}
```

### AgentTool Interface

Each tool implements the `AgentTool` interface:

```typescript
interface AgentTool {
  name: string                    // Unique tool identifier
  description: string             // Description for the LLM to understand when to use this tool
  parameters: Record<string, any> // JSON Schema for tool parameters
  execute: (args: Record<string, any>, context: AgentContext) => Promise<string>
}
```

### AgentContext Interface

The execution context passed to every tool:

```typescript
interface AgentContext {
  userId: string                  // Authenticated user ID
  conversationId?: string         // Current conversation ID
  memoryRefs: string[]            // Accumulated memory reference IDs
  metadata: Record<string, any>   // Additional context metadata
}
```

The `memoryRefs` array is particularly important — tools like `memory_save` append note IDs to this array, enabling the agent to track which memories were created during the current execution.

---

## Agent Execution Engine

The `AgentEngine` class is the core execution engine that runs the agentic loop:

```typescript
class AgentEngine {
  private config: AgentConfig
  private context: AgentContext
  private tools: AgentTool[]
  private llmTools: LLMTool[]

  constructor(config: AgentConfig, context: AgentContext)

  async run(userMessage: string): Promise<AgentRunResult>
}
```

### How AgentEngine.run() Works

1. **Initialize** — Build the message array with system prompt and user message. Resolve tools from the Tool Registry based on `config.tools`. Convert tools to LLM-compatible format.

2. **LLM Call** — Call `LLMRouter.chat()` with the current messages, config, and tools. The LLM Router automatically routes to Puter.js (free) or BYOK.

3. **Check for Tool Calls** — If the LLM response contains `toolCalls`, execute each tool:
   - Parse the tool call arguments from JSON
   - Look up the tool in the Tool Registry
   - Execute `tool.execute(args, context)`
   - Append the tool result as a `role: "tool"` message

4. **Loop** — If tool calls were made, go back to step 2 (up to `maxIterations`). If no tool calls were made, the LLM's response is the final answer.

5. **Return** — Package the result with messages, final response, tool call count, memory refs, model, and iteration count.

---

## Execution Loop Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                    Agent Execution Loop                        │
│                                                               │
│  Start: userMessage                                           │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ Build messages: [systemPrompt, userMessage]         │      │
│  │ Resolve tools from config.tools → TOOL_REGISTRY     │      │
│  │ Convert to LLMTool[] format                         │      │
│  └─────────────────────┬───────────────────────────────┘      │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ Call LLMRouter.chat(config, messages)               │      │
│  │ → Puter.js (free) or BYOK (auto-routed)            │      │
│  └─────────────────────┬───────────────────────────────┘      │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ Check response for toolCalls                        │      │
│  └──────┬──────────────────────────┬───────────────────┘      │
│         │                          │                          │
│    Tool Calls                  No Tool Calls                  │
│         │                          │                          │
│         ▼                          ▼                          │
│  ┌──────────────────┐    ┌──────────────────────────┐        │
│  │ For each toolCall:│    │ Final answer received!   │        │
│  │ 1. Parse args    │    │ Return AgentRunResult    │        │
│  │ 2. Find tool     │    └──────────────────────────┘        │
│  │ 3. Execute tool  │                                        │
│  │ 4. Append result │                                        │
│  └────────┬─────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ iterations < maxIterations?                         │      │
│  └──────┬──────────────────────────┬───────────────────┘      │
│         │ YES                      │ NO                       │
│         ▼                          ▼                          │
│    Go back to                    Return last                  │
│    LLM Call                      assistant message            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Default Agent Config

The default agent configuration is optimized for general-purpose memory assistance:

```typescript
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  name: 'mnemosyne Agent',
  description: 'Your personal AI memory assistant — can search, save, update, and reason about your memories.',
  systemPrompt: `You are mnemosyne Agent, an advanced AI assistant with full access to the user's memory and knowledge base. You can search memories, save new notes, update existing ones, track decisions, and search the web for current information.

Key behaviors:
1. Always search memory first before answering questions — the user's past knowledge is your primary source
2. Proactively save important information to memory when the user shares it
3. Connect ideas across different notes and time periods
4. Track decisions with proper context and reasoning
5. Use web search only when the user asks about current events or information not in their memory
6. Be concise but insightful — reference specific memories by title
7. Suggest connections the user might not have noticed`,
  model: 'openai/gpt-5.4-nano',
  maxIterations: 5,
  tools: ['memory_search', 'memory_save', 'memory_update', 'memory_delete', 'memory_insights', 'web_search', 'decision_track'],
}
```

### Key Design Decisions

- **Model**: `openai/gpt-5.4-nano` — the fastest free model, ideal for most agent tasks
- **Max Iterations**: 5 — balances thoroughness with cost/latency
- **All Tools**: The default config enables all 7 tools for maximum capability
- **Memory-First Behavior**: The system prompt instructs the agent to search memory before answering

---

## Custom Agents

You can create custom agents by providing overrides to the default configuration. Custom agents allow you to specialize the agent for specific tasks.

### Creating a Research Agent

```typescript
const researchAgent: AgentConfig = {
  name: 'Research Agent',
  description: 'Deep research agent that searches the web and saves comprehensive notes.',
  systemPrompt: `You are a research assistant. When given a topic:
1. Search the web for current information
2. Search existing memory for prior knowledge
3. Synthesize findings into comprehensive notes
4. Save the research as a structured note with tags
5. Track the research decision with reasoning`,
  model: 'openai/gpt-5.4',  // Use a more capable model for research
  temperature: 0.3,           // Lower temperature for factual accuracy
  maxTokens: 4096,            // Longer responses for research
  maxIterations: 8,           // More iterations for thorough research
  tools: ['memory_search', 'memory_save', 'web_search', 'decision_track'],
}
```

### Creating a Memory Manager Agent

```typescript
const memoryManager: AgentConfig = {
  name: 'Memory Manager',
  description: 'Agent focused on organizing and maintaining the knowledge base.',
  systemPrompt: `You are a memory organization assistant. Your job is to:
1. Review existing memories for duplicates or outdated info
2. Update notes with new information
3. Suggest connections between related notes
4. Clean up poorly tagged notes
5. Generate insights about memory patterns`,
  model: 'anthropic/claude-opus-4-8',  // Use Claude for nuanced reasoning
  temperature: 0.5,
  maxIterations: 10,          // More iterations for complex reorganization
  tools: ['memory_search', 'memory_save', 'memory_update', 'memory_delete', 'memory_insights'],
}
```

### Running a Custom Agent via API

```bash
curl -X POST http://localhost:3000/api/llm/agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Research the latest developments in quantum computing",
    "userId": "user-123",
    "model": "openai/gpt-5.4",
    "systemPrompt": "You are a research assistant...",
    "maxIterations": 8,
    "tools": ["memory_search", "memory_save", "web_search", "decision_track"],
    "temperature": 0.3
  }'
```

---

## Agent API Endpoints

### POST /api/llm/agent

Execute the AI agent with a message. The agent runs the full agentic loop with tool calling.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | The user message to process |
| `userId` | `string` | Yes | The user ID for data scoping |
| `model` | `string` | No | Override the default model |
| `provider` | `string` | No | Override the provider ("puter", "openai", etc.) |
| `systemPrompt` | `string` | No | Override the default system prompt |
| `maxIterations` | `number` | No | Override max iterations (default: 5) |
| `tools` | `string[]` | No | Override enabled tools |
| `apiKey` | `string` | No | BYOK API key |
| `conversationId` | `string` | No | Continue an existing conversation |
| `metadata` | `object` | No | Additional context metadata |

**Response:**

```json
{
  "success": true,
  "data": {
    "response": "Based on your notes, the Q4 deadline is December 15...",
    "toolCallsMade": 2,
    "memoryRefs": ["note-1", "note-2"],
    "model": "openai/gpt-5.4-nano",
    "iterations": 3,
    "messages": [
      {"role": "system", "content": "..."},
      {"role": "user", "content": "..."},
      {"role": "assistant", "content": "", "toolCalls": [...]},
      {"role": "tool", "content": "...", "toolName": "memory_search"},
      {"role": "assistant", "content": "Based on your notes..."}
    ]
  }
}
```

### GET /api/llm/agent

Get the default agent configuration and available tools.

**Response:**

```json
{
  "success": true,
  "data": {
    "defaultConfig": {
      "name": "mnemosyne Agent",
      "description": "Your personal AI memory assistant...",
      "model": "openai/gpt-5.4-nano",
      "maxIterations": 5
    },
    "availableTools": [
      {
        "name": "memory_search",
        "description": "Search the user's memory/notes...",
        "parameters": { "type": "object", "properties": { "query": {...}, "limit": {...} } }
      },
      ...
    ]
  }
}
```

### POST /api/agents

Manage agent configurations (create, list, update custom agents).

### GET /api/agents

List agent messages and configuration status.

### GET/PUT/DELETE /api/agents/[id]

Get, update, or delete a specific agent configuration.

---

## Multi-LLM Agent

One of the most powerful features of mnemosyne's agent system is the ability to use **any model** from the pool as the agent's "brain". This is handled automatically by the LLM Router.

### Model Selection Guide

| Task Type | Recommended Model | Reason |
|-----------|------------------|--------|
| General chat | `openai/gpt-5.4-nano` | Fast, free, good for most tasks |
| Complex reasoning | `anthropic/claude-opus-4-8` | Best reasoning capabilities |
| Research | `openai/gpt-5.4` | Balance of speed and quality |
| Code generation | `deepseek/deepseek-r1-0528` | Strong code capabilities |
| Long context | `google/gemini-3.1-pro` | 2M token context window |
| Fast responses | `openai/gpt-5.4-nano` | Lowest latency |
| BYOK tasks | `byok/openai-gpt-4o` | When you need guaranteed availability |

### Switching Models at Runtime

The agent model can be switched per-request without any configuration changes:

```bash
# Use Claude Opus for a complex reasoning task
curl -X POST http://localhost:3000/api/llm/agent \
  -d '{"message": "Analyze the trade-offs between microservices and monolith", "userId": "user-1", "model": "anthropic/claude-opus-4-8"}'

# Use DeepSeek R1 for a coding task
curl -X POST http://localhost:3000/api/llm/agent \
  -d '{"message": "Write a binary search implementation in Rust", "userId": "user-1", "model": "deepseek/deepseek-r1-0528"}'

# Use BYOK for guaranteed availability
curl -X POST http://localhost:3000/api/llm/agent \
  -d '{"message": "Process this sensitive data", "userId": "user-1", "model": "byok/openai-gpt-4o", "apiKey": "sk-...", "provider": "openai"}'
```

---

## Integration with Puter.js

The agent's default execution path uses Puter.js for free LLM access. This means:

### How It Works

1. **Client-Side Auth**: Puter.js SDK loads in the browser and handles user authentication with Puter.com
2. **User-Pays Model**: End-users cover their own LLM usage through their Puter.com accounts
3. **Zero API Key**: No API keys are needed for the default agent experience
4. **500+ Models**: Access to the full Puter.js model catalog beyond the curated registry

### Puter.js SDK Integration

The `puter-provider.ts` module provides the bridge between mnemosyne and Puter.js:

```typescript
// Load Puter.js SDK (browser only)
await loadPuterSDK()

// Chat completions (FREE)
const response = await puterChat(config, messages)

// Streaming completions (FREE)
for await (const chunk of puterChatStream(config, messages)) {
  // Process each chunk
}

// Additional Puter.js capabilities:
await puterGenerateImage(prompt, model)   // Image generation
await puterTextToSpeech(text, voice)      // Text-to-speech
await puterSpeechToText(audioBlob)        // Speech-to-text
await puterWriteFile(path, content)       // Cloud file storage
await puterKvSet(key, value)              // Key-value store
```

### Fallback Strategy

When Puter.js is unavailable (server-side rendering, network issues, rate limits), the agent automatically falls back to BYOK if an API key is provided:

```
Puter.js (free) ──► Success ──► Return response
       │
       └──► Error ──► apiKey provided?
                         │
                         ├── YES ──► BYOK fallback ──► Return response
                         └── NO ──► Throw error
```

---

## Example Workflows

### Workflow 1: Knowledge Query

```
User: "What did I decide about the database for the SaaS project?"
       │
       ▼
Agent calls memory_search("database decision SaaS")
       │
       ▼
Results: Decision "Choose PostgreSQL over MongoDB" (score: 0.94)
       │
       ▼
Agent: "You decided to use PostgreSQL as the primary database for the SaaS project.
       The reasoning was: ACID compliance is critical for financial data,
       strong schema enforcement reduces bugs, and JSON columns provide flexibility.
       This decision was made in the context of building a multi-tenant SaaS
       that needs ACID compliance."
```

### Workflow 2: Saving New Information

```
User: "The API rate limit for the free tier is now 200 requests per minute,
       up from 100. We decided this in yesterday's meeting."
       │
       ▼
Agent calls memory_search("API rate limit free tier")
       │
       ▼
Results: Note "Meeting Notes: API Design Review" (score: 0.88)
         - Contains old rate limit: 100 req/min
       │
       ▼
Agent calls memory_update("note-abc123", {content: "...200 req/min...", tags: "...updated"})
       │
       ▼
Agent: "I've updated your 'Meeting Notes: API Design Review' note with the new
       rate limit of 200 req/min for the free tier. The previous value was
       100 req/min."
```

### Workflow 3: Research and Save

```
User: "What's new in Next.js 16? Save a summary to my notes."
       │
       ▼
Agent calls memory_search("Next.js 16")
       │
       ▼
Results: No relevant memories found
       │
       ▼
Agent calls web_search("Next.js 16 new features")
       │
       ▼
Results: 5 web pages with Next.js 16 information
       │
       ▼
Agent synthesizes findings
       │
       ▼
Agent calls memory_save("Next.js 16 Features Summary", "...", "nextjs,react,framework")
       │
       ▼
Agent: "I've researched Next.js 16 and saved a comprehensive summary to your notes.
       Key highlights include: [summary]. The note has been tagged with
       'nextjs,react,framework' for easy future retrieval."
```

### Workflow 4: Decision Tracking

```
User: "We decided to use Redis for caching instead of Memcached because
       we need pub/sub support and data persistence."
       │
       ▼
Agent calls decision_track({
  title: "Choose Redis over Memcached for caching",
  context: "Building a caching layer for the API that needs pub/sub and persistence",
  decision: "Use Redis for caching",
  reasoning: "Redis provides pub/sub support and data persistence,
              which Memcached does not offer"
})
       │
       ▼
Agent: "I've tracked this decision: 'Choose Redis over Memcached for caching'.
       The reasoning (pub/sub support and data persistence) has been recorded
       so you can reference it later when evaluating your caching strategy."
```

### Workflow 5: Memory Insights

```
User: "What patterns do you see in my notes?"
       │
       ▼
Agent calls memory_insights({type: "patterns"})
       │
       ▼
Results: Tag frequency, recurring topics, knowledge clusters
       │
       ▼
Agent: "Here's what I found in your knowledge base:
       - 'api' appears in 8 notes — it's your most common topic
       - You have 3 decisions about database choices
       - Recent activity focuses on architecture and rate limiting
       - Your notes span 15 unique tags across 42 notes
       I'd recommend reviewing your older notes about microservices
       — they might connect well with your recent API design work."
```

---

## AgentRunResult Interface

The result of an agent execution:

```typescript
interface AgentRunResult {
  messages: AgentMessage[]         // Full conversation history including tool calls
  finalResponse: string            // The agent's final text response
  toolCallsMade: number            // Total number of tool calls executed
  memoryRefs: string[]             // Note IDs created or referenced during execution
  model: string                    // The model used for execution
  iterations: number               // Number of agentic loop iterations
}
```

### Convenience Function

For quick agent execution without manually constructing an `AgentEngine`:

```typescript
import { runAgent } from '@/lib/agent'

const result = await runAgent(
  'What did I decide about the database?',
  'user-123',
  { model: 'anthropic/claude-opus-4-8', maxIterations: 8 }
)
```

---

*Last updated: 2026 · Mnemosyne v1.0.0*
