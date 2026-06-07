# Memorix — Model Catalog

> **21 Curated Free Models across 8 Providers** — All accessible via Puter.js at zero cost
> Plus BYOK and Local model support for maximum flexibility

---

## Table of Contents

- [Introduction](#introduction)
- [Free Models (Puter.js)](#free-models-puterjs)
- [BYOK Models](#byok-models)
- [Local / Ollama Models](#local--ollama-models)
- [Model Capabilities Matrix](#model-capabilities-matrix)
- [Context Windows Comparison](#context-windows-comparison)
- [Recommended Models by Use Case](#recommended-models-by-use-case)
- [How to Add Custom Models](#how-to-add-custom-models)

---

## Introduction

Memorix provides access to AI models through three provider types:

1. **Free (Puter.js)** — 21 curated models across 8 providers, accessible at zero cost. No API key required. Users access models through their free Puter.com account via the Puter.js SDK. This is the core innovation that makes Memorix the biggest free multi-LLM hub.

2. **BYOK (Bring Your Own Key)** — Bring your own API keys from OpenAI, Anthropic, Google, DeepSeek, OpenRouter, or any OpenAI-compatible endpoint. Memorix acts as the unified middle provider, wrapping all BYOK services into a single consistent API.

3. **Local (Ollama / LM Studio)** — Run models locally on your own hardware. Zero cost, full privacy, no internet required. Supports any model available through Ollama or OpenAI-compatible local servers.

### How Free Access Works

Puter.js provides a "user-pays" model where end-users access AI models through their Puter.com accounts. The key benefits:

- **Zero API key** — No registration with individual AI providers
- **500+ models available** — Far more than any single provider offers
- **No credit card** — Free tier includes generous usage
- **Browser-based** — SDK loads directly in the browser, no server needed
- **Streaming support** — Real-time token streaming for all models

---

## Free Models (Puter.js)

All models below are accessible for free via Puter.js. No API key required.

### OpenAI Models (8 models)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `openai/gpt-5.5-pro` | GPT-5.5 Pro | 200,000 | chat, vision, code, reasoning, streaming, tool_use |
| `openai/gpt-5.4` | GPT-5.4 | 200,000 | chat, vision, code, reasoning, streaming, tool_use |
| `openai/gpt-5.4-mini` | GPT-5.4 Mini | 128,000 | chat, code, streaming, tool_use |
| `openai/gpt-5.4-nano` | GPT-5.4 Nano | 128,000 | chat, code, streaming, tool_use |
| `openai/gpt-4o` | GPT-4o | 128,000 | chat, vision, code, streaming, tool_use |
| `openai/gpt-4o-mini` | GPT-4o Mini | 128,000 | chat, code, streaming, tool_use |
| `openai/o4-mini` | O4 Mini | 200,000 | chat, reasoning, code, streaming |
| `openai/o3` | O3 | 200,000 | chat, reasoning, code, streaming |

### Anthropic Models (3 models)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `anthropic/claude-opus-4-8` | Claude Opus 4.8 | 200,000 | chat, vision, code, reasoning, streaming, tool_use |
| `anthropic/claude-opus-4.8-fast` | Claude Opus 4.8 Fast | 200,000 | chat, vision, code, reasoning, streaming, tool_use |
| `anthropic/claude-sonnet-4-6` | Claude Sonnet 4.6 | 200,000 | chat, vision, code, reasoning, streaming, tool_use |

### Google Models (2 models)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `google/gemini-3.1-flash-lite` | Gemini 3.1 Flash | 1,000,000 | chat, vision, code, streaming, tool_use |
| `google/gemini-3.1-pro` | Gemini 3.1 Pro | 2,000,000 | chat, vision, code, reasoning, streaming, tool_use |

### DeepSeek Models (2 models)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `deepseek/deepseek-r1-0528` | DeepSeek R1 | 128,000 | chat, reasoning, code, streaming |
| `deepseek/deepseek-chat` | DeepSeek Chat | 128,000 | chat, code, streaming |

### xAI Models (1 model)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `x-ai/grok-3` | Grok 3 | 128,000 | chat, code, reasoning, streaming |

### Meta Models (1 model)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `meta-llama/llama-4-maverick` | Llama 4 Maverick | 128,000 | chat, code, streaming |

### Mistral Models (1 model)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `mistral/mistral-large` | Mistral Large | 128,000 | chat, code, streaming, tool_use |

### Alibaba Models (2 models)

| Model ID | Name | Context Window | Capabilities |
|----------|------|---------------|-------------|
| `qwen/qwen3.7-plus` | Qwen 3.7 Plus | 128,000 | chat, code, reasoning, streaming |
| `qwen/qwen3.7-max` | Qwen 3.7 Max | 128,000 | chat, code, reasoning, streaming |

---

## BYOK Models

Bring Your Own Key models require an API key from the respective provider. Memorix acts as the unified API layer, so you only need to configure keys once.

| Model ID | Name | Provider | Context | Pricing (per 1M tokens) |
|----------|------|----------|---------|------------------------|
| `byok/openai-gpt-4o` | GPT-4o (BYOK) | OpenAI | 128,000 | $2.50 / $10.00 |
| `byok/anthropic-claude-opus` | Claude Opus (BYOK) | Anthropic | 200,000 | $15.00 / $75.00 |
| `byok/google-gemini-pro` | Gemini Pro (BYOK) | Google | 2,000,000 | Varies |
| `byok/deepseek-chat` | DeepSeek Chat (BYOK) | DeepSeek | 128,000 | $0.14 / $0.28 |
| `byok/openrouter-auto` | OpenRouter Auto | OpenRouter | 128,000 | Varies by model |

### BYOK Configuration

To use BYOK models, configure your API keys in the Memorix dashboard under **Settings → API Keys**. Each key is encrypted at rest and never sent to third parties except the intended provider.

```typescript
// Example: Using BYOK via the LLM Router
const response = await LLMRouter.chat(
  {
    provider: 'openai',
    model: 'byok/openai-gpt-4o',
    apiKey: 'sk-your-key-here',
    temperature: 0.7,
  },
  [{ role: 'user', content: 'Hello!' }]
)
```

---

## Local / Ollama Models

Run models locally on your hardware. Zero cost, full privacy, no internet required after model download.

| Model ID | Name | Provider | Context | Capabilities |
|----------|------|----------|---------|-------------|
| `local/llama3` | Llama 3 (Local) | Ollama | 8,000 | chat, code, streaming |
| `local/mistral` | Mistral (Local) | Ollama | 32,000 | chat, code, streaming |
| `local/codellama` | Code Llama (Local) | Ollama | 16,000 | chat, code, streaming |

### Ollama Setup

1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model: `ollama pull llama3`
3. Start the server: `ollama serve` (runs on `http://localhost:11434`)
4. Configure Memorix: Set provider to `ollama` and base URL to `http://localhost:11434/v1/chat/completions`

```typescript
// Example: Using local Ollama model
const response = await LLMRouter.chat(
  {
    provider: 'ollama',
    model: 'local/llama3',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
  },
  [{ role: 'user', content: 'Hello!' }]
)
```

### LM Studio Setup

1. Download [LM Studio](https://lmstudio.ai/)
2. Search and download a model (e.g., Mistral 7B)
3. Start the local server (default: `http://localhost:1234/v1/chat/completions`)
4. Configure Memorix: Set provider to `custom` with your LM Studio base URL

---

## Model Capabilities Matrix

| Model | Chat | Vision | Code | Reasoning | Tool Use | Streaming |
|-------|:----:|:------:|:----:|:---------:|:--------:|:---------:|
| **GPT-5.5 Pro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GPT-5.4** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GPT-5.4 Mini** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **GPT-5.4 Nano** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **GPT-4o** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **GPT-4o Mini** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **O4 Mini** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **O3** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Claude Opus 4.8** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Claude Opus 4.8 Fast** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Claude Sonnet 4.6** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Gemini 3.1 Flash** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Gemini 3.1 Pro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **DeepSeek R1** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **DeepSeek Chat** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Grok 3** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Llama 4 Maverick** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Mistral Large** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Qwen 3.7 Plus** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Qwen 3.7 Max** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |

### Capability Definitions

| Capability | Description |
|-----------|-------------|
| **chat** | General conversation and text generation |
| **vision** | Image understanding and visual reasoning |
| **code** | Code generation, debugging, and explanation |
| **reasoning** | Advanced logical reasoning and chain-of-thought |
| **tool_use** | Function/tool calling for agent workflows |
| **streaming** | Real-time token-by-token response streaming |

---

## Context Windows Comparison

Models sorted by context window size (largest first):

| Model | Context Window | Approximate Capacity |
|-------|---------------|---------------------|
| Gemini 3.1 Pro | 2,000,000 | ~1.5M words / ~3,000 pages |
| Gemini 3.1 Flash | 1,000,000 | ~750K words / ~1,500 pages |
| GPT-5.5 Pro | 200,000 | ~150K words / ~300 pages |
| GPT-5.4 | 200,000 | ~150K words / ~300 pages |
| O4 Mini | 200,000 | ~150K words / ~300 pages |
| O3 | 200,000 | ~150K words / ~300 pages |
| Claude Opus 4.8 | 200,000 | ~150K words / ~300 pages |
| Claude Opus 4.8 Fast | 200,000 | ~150K words / ~300 pages |
| Claude Sonnet 4.6 | 200,000 | ~150K words / ~300 pages |
| GPT-5.4 Mini | 128,000 | ~96K words / ~192 pages |
| GPT-5.4 Nano | 128,000 | ~96K words / ~192 pages |
| GPT-4o | 128,000 | ~96K words / ~192 pages |
| GPT-4o Mini | 128,000 | ~96K words / ~192 pages |
| DeepSeek R1 | 128,000 | ~96K words / ~192 pages |
| DeepSeek Chat | 128,000 | ~96K words / ~192 pages |
| Grok 3 | 128,000 | ~96K words / ~192 pages |
| Llama 4 Maverick | 128,000 | ~96K words / ~192 pages |
| Mistral Large | 128,000 | ~96K words / ~192 pages |
| Qwen 3.7 Plus | 128,000 | ~96K words / ~192 pages |
| Qwen 3.7 Max | 128,000 | ~96K words / ~192 pages |
| Mistral (Local) | 32,000 | ~24K words / ~48 pages |
| Code Llama (Local) | 16,000 | ~12K words / ~24 pages |
| Llama 3 (Local) | 8,000 | ~6K words / ~12 pages |

---

## Recommended Models by Use Case

### General Chat & Writing

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Daily conversation | GPT-5.4 Nano | Fast, free, good quality |
| Creative writing | Claude Opus 4.8 | Best creative output quality |
| Blog posts | GPT-5.4 Mini | Good balance of speed and quality |
| Email drafting | GPT-4o Mini | Quick and concise |

### Coding & Development

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Code generation | GPT-5.4 | Best code quality and tool use |
| Code review | Claude Opus 4.8 Fast | Fast analysis with reasoning |
| Debugging | DeepSeek Chat | Excellent at finding bugs |
| Code explanation | GPT-4o Mini | Clear explanations, fast |

### Reasoning & Analysis

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Complex reasoning | O3 | Best reasoning capabilities |
| Math problems | DeepSeek R1 | Specialized reasoning model |
| Research analysis | Claude Sonnet 4.6 | Balanced reasoning and speed |
| Logic puzzles | O4 Mini | Good reasoning, faster than O3 |

### Vision & Multimodal

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Image understanding | GPT-5.5 Pro | Best multimodal capabilities |
| Screenshot analysis | Claude Opus 4.8 | Strong visual reasoning |
| Document OCR | Gemini 3.1 Pro | Massive context for long docs |
| Chart interpretation | GPT-4o | Good visual + data analysis |

### Agent & Tool Use

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Agent execution | GPT-5.4 Nano | Default agent model, fast + free |
| Multi-tool agents | Claude Opus 4.8 | Best tool calling accuracy |
| Data processing | Mistral Large | Good tool use, efficient |
| Automation | GPT-5.4 Mini | Reliable tool execution |

### Long Context

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Book analysis | Gemini 3.1 Pro | 2M token context |
| Large codebase | Gemini 3.1 Flash | 1M context, fast processing |
| Document summarization | Claude Opus 4.8 | 200K context, high quality |
| Meeting transcripts | GPT-5.4 | 200K context, good synthesis |

### Privacy & Offline

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Sensitive data | Llama 3 (Local) | Fully local, zero data sent |
| Code assistance | Code Llama (Local) | Specialized for code |
| Air-gapped environments | Mistral (Local) | 32K context, good quality |

---

## How to Add Custom Models

### Adding to the Model Registry

To add a new model to Memorix, edit `src/lib/llm/providers.ts` and add an entry to the `MODEL_REGISTRY` array:

```typescript
// Example: Adding a new free model
{
  id: 'provider/model-name',          // Unique identifier
  name: 'Model Display Name',          // Human-readable name
  provider: 'puter',                   // Provider type
  providerLabel: 'Provider Name',      // Display label
  isFree: true,                        // Free via Puter.js
  contextWindow: 128000,               // Max context tokens
  capabilities: ['chat', 'code', 'streaming'],  // Capabilities
  pricing: undefined,                  // undefined = free
}

// Example: Adding a new BYOK model
{
  id: 'byok/provider-model-name',
  name: 'Model Name (BYOK)',
  provider: 'openai',                  // or anthropic, google, etc.
  providerLabel: 'Provider Name',
  isFree: false,
  contextWindow: 128000,
  capabilities: ['chat', 'vision', 'streaming'],
  pricing: { input: 5.0, output: 15.0 },  // USD per 1M tokens
}

// Example: Adding a new local model
{
  id: 'local/model-name',
  name: 'Model Name (Local)',
  provider: 'ollama',
  providerLabel: 'Ollama',
  isFree: true,
  contextWindow: 32000,
  capabilities: ['chat', 'code', 'streaming'],
}
```

### Model ID Convention

- **Free (Puter.js)**: `{provider}/{model-name}` — e.g., `openai/gpt-5.4-nano`
- **BYOK**: `byok/{provider}-{model-name}` — e.g., `byok/openai-gpt-4o`
- **Local**: `local/{model-name}` — e.g., `local/llama3`

### Registering Custom OpenAI-Compatible Endpoints

For providers not in the default registry, use the `custom` provider type:

```typescript
// Via API
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'custom/my-model',
    provider: 'custom',
    apiKey: 'your-api-key',
    baseUrl: 'https://your-api-endpoint.com/v1/chat/completions',
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
})
```

### Adding New Provider Types

To add a completely new provider type (e.g., Cohere, AI21):

1. Add the provider type to `LLMProvider` union in `src/lib/llm/providers.ts`
2. Add API endpoint to `API_ENDPOINTS` in `src/lib/llm/byok-provider.ts`
3. Implement the chat function following the existing provider patterns
4. Add the provider to the routing logic in `src/lib/llm/index.ts`
5. Add models to `MODEL_REGISTRY`
6. Add provider icon and color in `getProviderIcon()` and `getProviderColor()`

---

*Document Version: 4.0.0 | Last Updated: March 2025*
