# Puter.js Integration Guide — mnemosyne v4.0

> Complete guide for using Puter.js to power mnemosyne's free LLM access, cloud storage, key-value store, and authentication.

---

## Table of Contents

- [What is Puter.js?](#what-is-puterjs)
- [How Puter.js Powers mnemosyne](#how-puterjs-powers-mnemosyne)
- [User-Pays Model Explained](#user-pays-model-explained)
- [Setting Up Puter.js](#setting-up-puterjs)
- [AI Capabilities](#ai-capabilities)
- [Cloud Storage](#cloud-storage)
- [Key-Value Store](#key-value-store)
- [Authentication](#authentication)
- [Integration Architecture](#integration-architecture)
- [Fallback to BYOK](#fallback-to-byok)
- [Rate Limits and Considerations](#rate-limits-and-considerations)
- [Example Code Snippets](#example-code-snippets)

---

## What is Puter.js?

[Puter.js](https://developer.puter.com/) is the JavaScript SDK for **Puter.com** — a free, open-source cloud platform that provides:

| Capability | Description |
|-----------|-------------|
| **AI/LLM** | 500+ AI models including GPT-5.4, Claude Opus 4.8, Gemini 3.1, DeepSeek R1, and more |
| **Cloud Storage** | File system with read, write, delete, and directory listing |
| **Key-Value Store** | Simple get/set key-value persistence |
| **Authentication** | User sign-in, session management, user identity |
| **Hosting** | Static site hosting and deployment |

Puter.js requires **zero configuration** and **zero API keys** for the developer. The SDK loads directly from a CDN and authenticates users through their free Puter.com accounts.

---

## How Puter.js Powers mnemosyne

mnemosyne v4.0 uses Puter.js as its **primary free LLM provider**. This is the core innovation that makes mnemosyne "The Biggest Free Multi-LLM Hub":

```
┌──────────────────────────────────────────────────┐
│                   mnemosyne v4.0                    │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │            LLM Router                        │ │
│  │                                              │ │
│  │  ┌──────────────┐    ┌───────────────────┐  │ │
│  │  │  Puter.js    │    │  BYOK Provider     │  │ │
│  │  │  (FREE)      │    │  (User's API Key)  │  │ │
│  │  │              │    │                    │  │ │
│  │  │  500+ models │    │  OpenAI            │  │ │
│  │  │  Zero config │    │  Anthropic         │  │ │
│  │  │  User-pays   │    │  Google            │  │ │
│  │  │              │    │  DeepSeek          │  │ │
│  │  └──────────────┘    │  OpenRouter        │  │ │
│  │                      │  Ollama            │  │ │
│  │                      │  Custom            │  │ │
│  │                      └───────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Auto-routes: Puter.js first → BYOK fallback      │
└──────────────────────────────────────────────────┘
```

The key principle: **Puter.js is the default, free path. BYOK is the fallback for when users need guaranteed uptime or specific models.**

---

## User-Pays Model Explained

Puter.js uses a **User-Pays** model, which is fundamentally different from traditional API key models:

### Traditional Model (Developer-Pays)

```
Developer registers → Gets API key → Pays for all user usage → Bills users
```

Problems: Developer bears all costs, API keys can be leaked, scaling is expensive.

### Puter.js User-Pays Model

```
Developer loads SDK → User authenticates with Puter.com → User pays for their own usage
```

Benefits:

- **Zero cost for the developer** — No API key, no billing, no usage charges
- **Unlimited scaling** — Each user pays for their own usage
- **No API key management** — No keys to leak, rotate, or secure
- **Free Puter.com accounts** — Users get generous free tier on Puter.com
- **Privacy** — User data stays in their Puter account, not the developer's

### How It Works in mnemosyne

1. User opens mnemosyne in their browser
2. Puter.js SDK loads automatically (no setup required)
3. User is prompted to sign in with their free Puter.com account (if not already)
4. All LLM calls are made through the user's Puter session
5. The user's Puter.com account covers the cost of their AI usage
6. Mnemosyne never sees the user's API key or billing information

---

## Setting Up Puter.js

### No Configuration Needed

Puter.js requires **zero configuration**. Mnemosyne loads the SDK dynamically:

```typescript
// src/lib/llm/puter-provider.ts

import { loadPuterSDK } from '@/lib/llm/puter-provider'

// Load the SDK (called automatically when needed)
await loadPuterSDK()
```

### Manual SDK Loading

If you want to load the SDK manually (e.g., for testing):

```html
<!-- Add to your HTML <head> -->
<script src="https://js.puter.com/v2/" async></script>
```

### How mnemosyne Loads the SDK

mnemosyne dynamically injects the SDK script only when an LLM call is made:

```typescript
export function loadPuterSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.puter) {
      resolve()
      return
    }

    // Check if script already loading
    const existing = document.querySelector('script[src*="js.puter.com"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }

    // Load SDK dynamically
    const script = document.createElement('script')
    script.src = 'https://js.puter.com/v2/'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Puter.js SDK'))
    document.body.appendChild(script)
  })
}
```

### Browser-Only Requirement

Puter.js runs **only in the browser**. It cannot be used in server-side Node.js environments. Mnemosyne's LLM Router automatically detects the environment and falls back to BYOK providers when running server-side.

---

## AI Capabilities

### Chat Completions (500+ Models)

Access 500+ AI models through a unified interface:

```typescript
import { puterChat } from '@/lib/llm/puter-provider'

const response = await puterChat(
  {
    provider: 'puter',
    model: 'openai/gpt-5.4-nano',  // or any of 500+ models
    temperature: 0.7,
    maxTokens: 2048,
  },
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' },
  ]
)

console.log(response.content)
console.log(response.model)    // 'openai/gpt-5.4-nano'
console.log(response.provider) // 'puter'
```

### Available Free Models via Puter.js

| Provider | Models | Context Window |
|----------|--------|----------------|
| **OpenAI** | GPT-5.4 Nano, GPT-5.4 Mini, GPT-5.4, GPT-5.5 Pro, GPT-4o, GPT-4o Mini, O4 Mini, O3 | 128K–200K |
| **Anthropic** | Claude Opus 4.8, Claude Opus 4.8 Fast, Claude Sonnet 4.6 | 200K |
| **Google** | Gemini 3.1 Flash Lite, Gemini 3.1 Pro | 1M–2M |
| **DeepSeek** | DeepSeek R1, DeepSeek Chat | 128K |
| **xAI** | Grok 3 | 128K |
| **Meta** | Llama 4 Maverick | 128K |
| **Mistral** | Mistral Large | 128K |
| **Alibaba** | Qwen 3.7 Plus, Qwen 3.7 Max | 128K |

### Streaming Responses

Stream responses token-by-token for real-time output:

```typescript
import { puterChatStream } from '@/lib/llm/puter-provider'

for await (const chunk of puterChatStream(
  { provider: 'puter', model: 'anthropic/claude-sonnet-4-6' },
  [{ role: 'user', content: 'Write a poem about AI.' }]
)) {
  if (chunk.content) {
    process.stdout.write(chunk.content)
  }
  if (chunk.finishReason) {
    console.log('\nDone:', chunk.finishReason)
  }
}
```

### Image Generation

Generate images from text prompts using gpt-image-2:

```typescript
import { puterGenerateImage } from '@/lib/llm/puter-provider'

const imageUrl = await puterGenerateImage(
  'A futuristic cityscape with flying cars and neon lights',
  'gpt-image-2'
)

console.log('Image URL:', imageUrl)
```

### Text-to-Speech

Convert text to speech audio:

```typescript
import { puterTextToSpeech } from '@/lib/llm/puter-provider'

const audioBlob = await puterTextToSpeech(
  'Welcome to mnemosyne, your AI-powered memory hub.',
  'alloy' // optional voice parameter
)

// Play the audio
const audioUrl = URL.createObjectURL(audioBlob)
const audio = new Audio(audioUrl)
audio.play()
```

### Speech-to-Text

Transcribe audio recordings to text:

```typescript
import { puterSpeechToText } from '@/lib/llm/puter-provider'

// From a recorded audio blob
const transcription = await puterSpeechToText(audioBlob)
console.log('Transcription:', transcription)
```

### List Models

Discover all available models:

```typescript
import { puterListModels } from '@/lib/llm/puter-provider'

const models = await puterListModels()
for (const model of models) {
  console.log(model.id, model.name)
}
```

---

## Cloud Storage

Puter.js provides free cloud storage accessible directly from the browser:

### Write a File

```typescript
import { puterWriteFile } from '@/lib/llm/puter-provider'

await puterWriteFile('/mnemosyne/notes/my-note.md', '# My Note\n\nContent here...')
```

### Read a File

```typescript
import { puterReadFile } from '@/lib/llm/puter-provider'

const content = await puterReadFile('/mnemosyne/notes/my-note.md')
console.log(content)
```

### List a Directory

```typescript
import { puterListDir } from '@/lib/llm/puter-provider'

const files = await puterListDir('/mnemosyne/notes')
for (const file of files) {
  console.log(file.name, file.size)
}
```

### Delete a File

```typescript
import { puterDeleteFile } from '@/lib/llm/puter-provider'

await puterDeleteFile('/mnemosyne/notes/old-note.md')
```

### Storage Use Cases in mnemosyne

- **Backup notes** to Puter cloud storage
- **Sync settings** across devices via Puter KV
- **Export conversations** to Puter filesystem
- **Share memory snapshots** via Puter hosting

---

## Key-Value Store

Simple, fast key-value storage for configuration and state:

### Set a Value

```typescript
import { puterKvSet } from '@/lib/llm/puter-provider'

await puterKvSet('user_preferences', JSON.stringify({
  theme: 'dark',
  defaultModel: 'openai/gpt-5.4-nano',
  language: 'en',
}))
```

### Get a Value

```typescript
import { puterKvGet } from '@/lib/llm/puter-provider'

const prefs = await puterKvGet('user_preferences')
if (prefs) {
  const settings = JSON.parse(prefs)
  console.log(settings.theme) // 'dark'
}
```

### KV Use Cases in mnemosyne

- User preferences and settings
- Session state persistence
- Feature flags
- Last-used model and conversation ID
- Cache for frequently accessed data

---

## Authentication

Puter.js provides built-in authentication through Puter.com accounts:

### Check Sign-In Status

```typescript
import { puterIsSignedIn } from '@/lib/llm/puter-provider'

const isSignedIn = await puterIsSignedIn()
if (!isSignedIn) {
  // Prompt user to sign in
}
```

### Sign In

```typescript
import { puterSignIn } from '@/lib/llm/puter-provider'

await puterSignIn()
// User is redirected to Puter.com sign-in, then back to mnemosyne
```

### Get User Info

```typescript
import { puterGetUser } from '@/lib/llm/puter-provider'

const user = await puterGetUser()
console.log(user.username)
console.log(user.email)
```

### Authentication Flow in mnemosyne

```
1. User opens mnemosyne
2. Mnemosyne loads Puter.js SDK
3. Check if user is signed in (puterIsSignedIn)
4. If not signed in:
   a. Show "Sign in with Puter" button
   b. Call puterSignIn() on button click
   c. User authenticates at Puter.com
   d. User is redirected back to mnemosyne
5. User can now use all AI features for free
```

---

## Integration Architecture

mnemosyne wraps Puter.js through a clean abstraction layer:

```
┌───────────────────────────────────────────────────────┐
│                     User Interface                     │
│  (LLM Marketplace · Agent Chat · API Hub)              │
└────────────────────────┬──────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────┐
│                   LLM Router                           │
│  (Auto-routes to Puter.js or BYOK)                     │
│                                                        │
│  1. Check if model is free (isFree flag)               │
│  2. If free → route to Puter.js                        │
│  3. If BYOK → route to BYOK provider                   │
│  4. If Puter.js fails → fallback to BYOK               │
└──────────┬──────────────────────────┬──────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────────────┐
│   Puter.js Provider │   │     BYOK Provider            │
│                     │   │                               │
│  puterChat()        │   │  byokChat()                   │
│  puterChatStream()  │   │  byokChatStream()             │
│  puterGenerateImage │   │  OpenAI · Anthropic · Google  │
│  puterTextToSpeech  │   │  DeepSeek · OpenRouter        │
│  puterSpeechToText  │   │  Ollama · Custom              │
│  puterListModels()  │   │                               │
│  puterWriteFile()   │   │                               │
│  puterReadFile()    │   │                               │
│  puterKvSet/Get()   │   │                               │
│  puterSignIn()      │   │                               │
└──────────┬──────────┘   └──────────────────────────────┘
           │
┌──────────▼──────────┐
│   Puter.js SDK      │
│   (js.puter.com/v2) │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Puter.com Cloud   │
│   (User's Account)  │
└─────────────────────┘
```

### Key Design Decisions

1. **Lazy Loading** — Puter.js SDK is loaded only when first needed, not on page load
2. **Auto-Detection** — The router checks `model.isFree` to determine Puter.js eligibility
3. **Response Normalization** — All Puter.js responses are normalized to the `LLMResponse` type
4. **Error Handling** — Puter.js errors trigger automatic BYOK fallback (if API key available)
5. **Browser-Only** — Puter.js runs client-side; server-side code uses BYOK

---

## Fallback to BYOK

When Puter.js is unavailable, mnemosyne automatically falls back to BYOK providers:

```typescript
// In the LLM Router
static async chat(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  // Try Puter.js first for free models
  try {
    return await puterChat(config, messages)
  } catch {
    // Fallback to BYOK if API key is available
    if (config.apiKey) {
      return byokChat(config, messages)
    }
    throw new Error(`No provider available for model: ${config.model}`)
  }
}
```

### Fallback Scenarios

| Scenario | Behavior |
|----------|----------|
| Puter.js SDK fails to load | Prompt user to sign in, or use BYOK |
| User not signed in | Show sign-in prompt, or use BYOK |
| Puter.js API error | Automatic BYOK fallback (if API key available) |
| Server-side environment | Skip Puter.js, use BYOK directly |
| Rate limited by Puter.js | Automatic BYOK fallback |

---

## Rate Limits and Considerations

### Puter.js Rate Limits

Puter.com enforces rate limits based on user account tier:

| Tier | Requests/Minute | Tokens/Day | Storage |
|------|----------------|------------|---------|
| **Free** | ~30 req/min | ~100K tokens/day | 1 GB |
| **Pro** | ~100 req/min | ~1M tokens/day | 10 GB |
| **Business** | ~300 req/min | ~10M tokens/day | 100 GB |

### Considerations

1. **Cold Start** — First Puter.js call may be slow while the SDK initializes
2. **Browser-Only** — Puter.js cannot be used in server-side (Node.js) contexts
3. **User Authentication Required** — Users must be signed into Puter.com
4. **Network Dependency** — Requires internet connection to Puter.com
5. **Response Format Variation** — Different models return slightly different response formats; mnemosyne normalizes these
6. **Cost Transparency** — Users should check their Puter.com dashboard for usage details

### Best Practices

- Use streaming for long responses to reduce perceived latency
- Cache frequently used model lists client-side
- Implement retry logic with exponential backoff for rate limits
- Always provide BYOK as a fallback for production use cases
- Show clear "Sign in with Puter" prompts for unauthenticated users

---

## Example Code Snippets

### Complete Chat Example

```typescript
import { LLMRouter } from '@/lib/llm'

// Simple chat with free model
const response = await LLMRouter.chat(
  { provider: 'puter', model: 'openai/gpt-5.4-nano' },
  [{ role: 'user', content: 'What is semantic memory?' }]
)
console.log(response.content)
```

### Streaming Chat Example

```typescript
import { LLMRouter } from '@/lib/llm'

// Stream a response
for await (const chunk of LLMRouter.stream(
  { provider: 'puter', model: 'anthropic/claude-sonnet-4-6' },
  [{ role: 'user', content: 'Explain RAG pipelines.' }]
)) {
  if (chunk.content) process.stdout.write(chunk.content)
}
```

### Multi-Model Comparison

```typescript
import { LLMRouter } from '@/lib/llm'

// Compare responses across multiple free models
const results = await LLMRouter.compare(
  'Explain quantum entanglement in simple terms',
  [
    'openai/gpt-5.4-nano',
    'anthropic/claude-sonnet-4-6',
    'google/gemini-3.1-flash-lite',
  ]
)

for (const result of results) {
  console.log(`\n=== ${result.model} ===`)
  console.log(result.response.content)
}
```

### Agent with Puter.js

```typescript
import { runAgent } from '@/lib/agent'

const result = await runAgent(
  'Search my memory for notes about machine learning and summarize them',
  'user-123',
  { model: 'openai/gpt-5.4-nano' } // Uses Puter.js by default
)

console.log(result.finalResponse)
console.log('Tool calls made:', result.toolCallsMade)
console.log('Memory references:', result.memoryRefs)
```

### Direct Puter.js Usage

```typescript
// Access Puter.js directly (outside mnemosyne abstractions)
await loadPuterSDK()
const puter = window.puter

// Chat
const response = await puter.ai.chat(
  [{ role: 'user', content: 'Hello!' }],
  { model: 'gpt-4o-mini' }
)

// Image generation
const image = await puter.ai.txt2img('A beautiful sunset over mountains')

// Storage
await puter.fs.write('/test.txt', 'Hello, Puter!')
const content = await puter.fs.read('/test.txt')

// KV Store
await puter.kv.set('key', 'value')
const value = await puter.kv.get('key')
```

---

*mnemosyne v4.0 — The Biggest Free Multi-LLM Hub. Powered by Puter.js.*
