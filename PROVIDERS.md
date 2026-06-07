# Memorix — Provider Documentation

> **Three provider types: Free (Puter.js), BYOK, and Local**
> Unified access to 500+ AI models through a single consistent API

---

## Table of Contents

- [Overview](#overview)
- [Puter.js Provider (Free)](#puterjs-provider-free)
- [BYOK Providers](#byok-providers)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [Google Gemini](#google-gemini)
  - [DeepSeek](#deepseek)
  - [OpenRouter](#openrouter)
- [Local Providers](#local-providers)
  - [Ollama](#ollama)
  - [LM Studio](#lm-studio)
  - [Custom OpenAI-Compatible](#custom-openai-compatible)
- [How to Configure BYOK in Dashboard](#how-to-configure-byok-in-dashboard)
- [API Key Security Best Practices](#api-key-security-best-practices)
- [Provider Status Checking](#provider-status-checking)

---

## Overview

Memorix provides access to AI language models through three distinct provider types, each with different characteristics:

| Provider Type | Cost | API Key | Internet | Models | Use Case |
|--------------|------|---------|----------|--------|----------|
| **Free (Puter.js)** | Free | None required | Required | 500+ | General use, prototyping, learning |
| **BYOK** | Pay-per-use | Your own key | Required | Provider-dependent | Production, specific models, SLA |
| **Local** | Free | None | Not required | Hardware-dependent | Privacy, offline, sensitive data |

### How the LLM Router Works

The `LLMRouter` class in `src/lib/llm/index.ts` automatically routes requests to the correct provider:

1. If the model is marked as `isFree` or provider is `puter` → route to Puter.js
2. If the model is BYOK and has an API key → route to the appropriate BYOK provider
3. If no specific provider is set → try Puter.js first, fallback to BYOK if an API key is provided

```typescript
import { LLMRouter } from '@/lib/llm'

// Free model — auto-routes to Puter.js
const freeResponse = await LLMRouter.chat(
  { model: 'openai/gpt-5.4-nano' },
  [{ role: 'user', content: 'Hello!' }]
)

// BYOK model — routes to OpenAI with your key
const byokResponse = await LLMRouter.chat(
  { provider: 'openai', model: 'byok/openai-gpt-4o', apiKey: 'sk-...' },
  [{ role: 'user', content: 'Hello!' }]
)

// Local model — routes to Ollama
const localResponse = await LLMRouter.chat(
  { provider: 'ollama', model: 'local/llama3', baseUrl: 'http://localhost:11434/v1/chat/completions' },
  [{ role: 'user', content: 'Hello!' }]
)
```

---

## Puter.js Provider (Free)

### Overview

Puter.js is the default and primary provider in Memorix. It provides free access to 500+ AI models through a browser-based SDK with zero configuration.

| Property | Value |
|----------|-------|
| **Cost** | Free (user-pays model via Puter.com account) |
| **API Key** | None required |
| **Models Available** | 500+ |
| **Curated Models** | 21 across 8 providers |
| **Streaming** | Supported |
| **Tool Use** | Supported |
| **Vision** | Supported (select models) |
| **Internet Required** | Yes |
| **SDK** | `https://js.puter.com/v2/` |

### Features

Beyond chat completions, Puter.js provides additional AI capabilities at no cost:

| Feature | SDK Method | Description |
|---------|-----------|-------------|
| **Chat** | `puter.ai.chat()` | Multi-model chat completions |
| **Streaming** | `puter.ai.chat({ stream: true })` | Real-time token streaming |
| **Image Generation** | `puter.ai.txt2img()` | Text-to-image generation |
| **Text-to-Speech** | `puter.ai.txt2speech()` | Convert text to audio |
| **Speech-to-Text** | `puter.ai.speech2txt()` | Transcribe audio to text |
| **Model Listing** | `puter.ai.listModels()` | List available models |
| **Cloud Storage** | `puter.fs.*` | File system operations |
| **Key-Value Store** | `puter.kv.*` | Persistent key-value storage |
| **Authentication** | `puter.auth.*` | User session management |

### Setup

Puter.js is automatically loaded by Memorix when needed. No configuration required.

```typescript
import { loadPuterSDK } from '@/lib/llm/puter-provider'

// Load Puter.js SDK (called automatically by chat functions)
await loadPuterSDK()
```

### Chat Example

```typescript
import { puterChat, puterChatStream } from '@/lib/llm/puter-provider'

// Non-streaming chat
const response = await puterChat(
  { model: 'openai/gpt-5.4-nano', temperature: 0.7 },
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing in simple terms.' },
  ]
)

// Streaming chat
for await (const chunk of puterChatStream(
  { model: 'anthropic/claude-opus-4-8', temperature: 0.7 },
  [{ role: 'user', content: 'Write a poem about AI.' }]
)) {
  if (chunk.content) process.stdout.write(chunk.content)
}
```

### Image Generation Example

```typescript
import { puterGenerateImage } from '@/lib/llm/puter-provider'

const imageSrc = await puterGenerateImage(
  'A futuristic city with flying cars at sunset',
  'gpt-image-2'
)
```

### Limitations

- Requires a Puter.com account for extended usage
- Rate limits apply based on Puter.com free tier
- Some models may have reduced context windows via Puter.js
- Browser environment only (not available server-side)

---

## BYOK Providers

BYOK (Bring Your Own Key) providers allow you to use your own API keys for direct access to LLM providers. Memorix wraps all providers into a unified API, so you get consistent behavior regardless of which provider you use.

### Common BYOK Pattern

All BYOK providers follow the same usage pattern:

```typescript
import { byokChat, byokChatStream } from '@/lib/llm/byok-provider'

const response = await byokChat(
  {
    provider: 'openai',      // Provider identifier
    model: 'byok/openai-gpt-4o',
    apiKey: 'sk-your-key',   // Your API key
    temperature: 0.7,
    maxTokens: 2048,
  },
  [{ role: 'user', content: 'Hello!' }]
)
```

---

### OpenAI

| Property | Value |
|----------|-------|
| **Provider ID** | `openai` |
| **API Endpoint** | `https://api.openai.com/v1/chat/completions` |
| **API Format** | OpenAI Chat Completions |
| **Streaming** | SSE (Server-Sent Events) |
| **Tool Use** | Supported |

#### Setup

1. Create an account at [platform.openai.com](https://platform.openai.com/)
2. Generate an API key at API Keys → Create new secret key
3. Add the key to Memorix dashboard under Settings → API Keys → OpenAI

#### Supported Models

- GPT-5.5 Pro, GPT-5.4, GPT-5.4 Mini, GPT-5.4 Nano
- GPT-4o, GPT-4o Mini
- O4 Mini, O3
- Any new OpenAI model (use model ID directly)

#### Example

```typescript
const response = await byokChat(
  {
    provider: 'openai',
    model: 'byok/openai-gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather',
        parameters: { type: 'object', properties: { city: { type: 'string' } } },
      },
    }],
  },
  [{ role: 'user', content: 'What is the weather in Tokyo?' }]
)
```

---

### Anthropic

| Property | Value |
|----------|-------|
| **Provider ID** | `anthropic` |
| **API Endpoint** | `https://api.anthropic.com/v1/messages` |
| **API Format** | Anthropic Messages API |
| **Streaming** | Fallback to non-streaming in current version |
| **Tool Use** | Supported |

#### Setup

1. Create an account at [console.anthropic.com](https://console.anthropic.com/)
2. Generate an API key at API Keys → Create Key
3. Add the key to Memorix dashboard under Settings → API Keys → Anthropic

#### Supported Models

- Claude Opus 4.8, Claude Opus 4.8 Fast
- Claude Sonnet 4.6
- Any new Anthropic model (use model ID directly)

#### Special Notes

- Anthropic uses a different API format than OpenAI (Messages API vs Chat Completions)
- System prompts are passed as a top-level `system` parameter, not as a message
- The `anthropic-dangerous-direct-browser-access` header is set for browser compatibility
- Tool calls use Anthropic's native format and are automatically converted

---

### Google Gemini

| Property | Value |
|----------|-------|
| **Provider ID** | `google` |
| **API Endpoint** | `https://generativelanguage.googleapis.com/v1beta/models` |
| **API Format** | Google Generative AI API |
| **Streaming** | Fallback to non-streaming in current version |
| **Tool Use** | Supported (function declarations) |

#### Setup

1. Create a project at [aistudio.google.com](https://aistudio.google.com/)
2. Generate an API key at Get API Key
3. Add the key to Memorix dashboard under Settings → API Keys → Google

#### Supported Models

- Gemini 3.1 Flash (1M context)
- Gemini 3.1 Pro (2M context)
- Any new Gemini model (use model ID directly)

#### Special Notes

- Google API key is passed as a URL query parameter (`?key=...`), not as a header
- System instructions use a `systemInstruction` field in the request body
- Tool definitions use `functionDeclarations` format, automatically converted from OpenAI format
- Gemini models have the largest context windows available (up to 2M tokens)

---

### DeepSeek

| Property | Value |
|----------|-------|
| **Provider ID** | `deepseek` |
| **API Endpoint** | `https://api.deepseek.com/v1/chat/completions` |
| **API Format** | OpenAI-compatible |
| **Streaming** | SSE (Server-Sent Events) |
| **Tool Use** | Not supported |

#### Setup

1. Create an account at [platform.deepseek.com](https://platform.deepseek.com/)
2. Generate an API key at API Keys
3. Add the key to Memorix dashboard under Settings → API Keys → DeepSeek

#### Supported Models

- DeepSeek R1 (reasoning model)
- DeepSeek Chat (general model)

#### Special Notes

- DeepSeek uses the OpenAI-compatible API format, so it works with the same code path
- Very competitive pricing: $0.14 / $0.28 per 1M tokens (input/output)
- DeepSeek R1 is excellent for reasoning tasks at a fraction of the cost

---

### OpenRouter

| Property | Value |
|----------|-------|
| **Provider ID** | `openrouter` |
| **API Endpoint** | `https://openrouter.ai/api/v1/chat/completions` |
| **API Format** | OpenAI-compatible |
| **Streaming** | SSE (Server-Sent Events) |
| **Tool Use** | Supported (varies by model) |

#### Setup

1. Create an account at [openrouter.ai](https://openrouter.ai/)
2. Generate an API key at Keys → Create Key
3. Add the key to Memorix dashboard under Settings → API Keys → OpenRouter

#### Supported Models

- 100+ models from various providers via a single API
- OpenRouter Auto routing (automatically selects the best model)
- Any model available on the OpenRouter platform

#### Special Notes

- OpenRouter adds `HTTP-Referer` and `X-Title` headers automatically
- Acts as a meta-provider — routes to the underlying model provider
- Supports both free and paid models
- Excellent for accessing models not directly available in Memorix

---

## Local Providers

### Ollama

| Property | Value |
|----------|-------|
| **Provider ID** | `ollama` |
| **Default Endpoint** | `http://localhost:11434/v1/chat/completions` |
| **API Format** | OpenAI-compatible |
| **Streaming** | SSE (Server-Sent Events) |
| **Tool Use** | Limited (depends on model) |
| **Internet** | Not required |

#### Setup

1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model: `ollama pull llama3`
3. Start the server: `ollama serve`
4. Configure Memorix: Set provider to `ollama` with base URL `http://localhost:11434/v1/chat/completions`

#### Popular Models

```bash
# General purpose
ollama pull llama3          # 8B parameters, 8K context
ollama pull mistral         # 7B parameters, 32K context
ollama pull qwen2           # 7B parameters, 32K context

# Code-focused
ollama pull codellama       # 34B parameters, 16K context
ollama pull deepseek-coder  # 33B parameters, 16K context
ollama pull starcoder2      # 15B parameters, 16K context

# Reasoning
ollama pull deepseek-r1     # 7B parameters, 128K context
```

#### Example

```typescript
const response = await LLMRouter.chat(
  {
    provider: 'ollama',
    model: 'local/llama3',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
  },
  [{ role: 'user', content: 'Hello from local!' }]
)
```

#### Remote Ollama

To use Ollama on a remote machine, set the base URL to the remote server:

```typescript
baseUrl: 'http://192.168.1.100:11434/v1/chat/completions'
```

---

### LM Studio

| Property | Value |
|----------|-------|
| **Provider ID** | `custom` |
| **Default Endpoint** | `http://localhost:1234/v1/chat/completions` |
| **API Format** | OpenAI-compatible |
| **Streaming** | SSE (Server-Sent Events) |

#### Setup

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Search for and download a model (e.g., Mistral 7B Instruct)
3. Go to Local Server tab and click Start Server
4. Configure Memorix: Set provider to `custom` with base URL `http://localhost:1234/v1/chat/completions`

#### Example

```typescript
const response = await LLMRouter.chat(
  {
    provider: 'custom',
    model: 'mistral-7b-instruct',
    baseUrl: 'http://localhost:1234/v1/chat/completions',
  },
  [{ role: 'user', content: 'Hello from LM Studio!' }]
)
```

---

### Custom OpenAI-Compatible

Any server that implements the OpenAI Chat Completions API format can be used as a custom provider.

| Property | Value |
|----------|-------|
| **Provider ID** | `custom` |
| **API Format** | OpenAI-compatible |
| **Base URL** | Required — your custom endpoint |

#### Compatible Servers

- **vLLM** — High-performance inference server
- **Text Generation Inference (TGI)** — HuggingFace's inference server
- **LocalAI** — Drop-in OpenAI replacement
- **FastChat** — Open-source training and serving platform
- **Any OpenAI-compatible API** — Custom endpoints

#### Setup

1. Deploy your inference server following its documentation
2. Note the base URL (e.g., `http://your-server:8000/v1/chat/completions`)
3. Configure Memorix: Set provider to `custom`, provide base URL and optional API key

#### Example

```typescript
const response = await LLMRouter.chat(
  {
    provider: 'custom',
    model: 'your-model-name',
    apiKey: 'optional-api-key',
    baseUrl: 'https://your-server.com/v1/chat/completions',
    temperature: 0.7,
  },
  [{ role: 'user', content: 'Hello from custom provider!' }]
)
```

---

## How to Configure BYOK in Dashboard

### Step-by-Step Guide

1. **Open Memorix Dashboard** — Navigate to your Memorix instance
2. **Go to Settings** — Click the gear icon in the sidebar
3. **Select API Keys** — Navigate to the API Keys section
4. **Add Provider Key** — Click "Add Key" and select the provider
5. **Enter API Key** — Paste your API key from the provider's dashboard
6. **Save** — The key is encrypted and stored securely

### API Key Storage

- Keys are encrypted at rest using AES-256
- Keys are never logged or exposed in API responses
- Keys are only sent to the intended provider endpoint
- Keys can be revoked at any time from the dashboard

### Per-Request Key Override

You can also provide API keys directly in API requests instead of storing them:

```typescript
// Via Chat API
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/openai-gpt-4o',
    provider: 'openai',
    apiKey: 'sk-your-key',  // Provided per-request
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
})
```

---

## API Key Security Best Practices

### Do's

- **Use environment variables** — Store keys in `.env` or system environment, never in code
- **Rotate keys regularly** — Generate new keys every 90 days
- **Use minimum permissions** — Only grant the scopes your application needs
- **Monitor usage** — Check provider dashboards for unexpected activity
- **Use separate keys** — Different keys for development and production
- **Set spending limits** — Configure usage caps on provider dashboards
- **Revoke compromised keys** — Immediately rotate if a key is leaked

### Don'ts

- **Never commit keys to Git** — Add `.env` to `.gitignore`
- **Never share keys in chat/email** — Use secure key management
- **Never use production keys in development** — Use separate dev keys
- **Never hardcode keys in source code** — Use environment variables
- **Never expose keys in client-side code** — Use API routes as proxies
- **Never ignore billing alerts** — Set up spending notifications

### Environment Variable Setup

```bash
# .env (never commit this file!)
OPENAI_API_KEY=sk-prod-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
```

### Generating Secure Keys

```bash
# Generate a secure random string for MEMORIX_API_KEY
openssl rand -hex 32
# Example output: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

---

## Provider Status Checking

### Health Check Endpoint

Use the Memorix API to check provider availability:

```bash
# Check overall system health
curl http://localhost:3000/api

# Check model registry
curl http://localhost:3000/api/llm/models
```

### Manual Provider Testing

Test each provider individually to verify connectivity:

```typescript
// Test Puter.js (free)
const puterTest = await puterChat(
  { model: 'openai/gpt-5.4-nano' },
  [{ role: 'user', content: 'Hello, are you working?' }]
)
console.log('Puter.js:', puterTest.content)

// Test OpenAI (BYOK)
const openaiTest = await byokChat(
  { provider: 'openai', model: 'byok/openai-gpt-4o', apiKey: 'sk-...' },
  [{ role: 'user', content: 'Hello, are you working?' }]
)
console.log('OpenAI:', openaiTest.content)

// Test Ollama (local)
const ollamaTest = await byokChat(
  { provider: 'ollama', model: 'local/llama3', baseUrl: 'http://localhost:11434/v1/chat/completions' },
  [{ role: 'user', content: 'Hello, are you working?' }]
)
console.log('Ollama:', ollamaTest.content)
```

### Provider Error Handling

The LLM Router provides automatic fallback when a provider fails:

```typescript
// If Puter.js is down, automatically tries BYOK if an API key is provided
const response = await LLMRouter.chat(
  {
    model: 'openai/gpt-5.4-nano',
    apiKey: 'sk-fallback-key',  // Used if Puter.js fails
  },
  [{ role: 'user', content: 'Hello!' }]
)
```

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|---------|
| `Puter.js chat error: 429` | Rate limit exceeded | Wait and retry, or use BYOK |
| `API error (401): Unauthorized` | Invalid API key | Check key in provider dashboard |
| `API error (429): Rate limit` | Provider rate limit | Upgrade plan or use different provider |
| `ECONNREFUSED localhost:11434` | Ollama not running | Start Ollama: `ollama serve` |
| `No provider available` | Model not found in registry | Check model ID, add to registry |
| `Base URL is required for custom` | Missing custom endpoint | Provide `baseUrl` parameter |

---

*Document Version: 4.0.0 | Last Updated: March 2025*
