# BYOK (Bring Your Own Key) Guide — Memorix v4.0

> Complete guide for using your own API keys with Memorix. Supports OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, and custom OpenAI-compatible endpoints.

---

## Table of Contents

- [What is BYOK and Why It Matters](#what-is-byok-and-why-it-matters)
- [Supported Providers](#supported-providers)
- [Step-by-Step Setup](#step-by-step-setup)
- [API Key Security](#api-key-security)
- [Cost Comparison](#cost-comparison)
- [When to Use BYOK vs Free](#when-to-use-byok-vs-free)
- [Troubleshooting](#troubleshooting)
- [Example API Calls](#example-api-calls)

---

## What is BYOK and Why It Matters

**BYOK (Bring Your Own Key)** means you bring your own API keys from LLM providers and use them through Memorix's unified interface. Instead of being limited to the free Puter.js tier, you can use your paid API keys for:

- **Guaranteed uptime** — No dependency on Puter.com availability
- **Higher rate limits** — Paid API keys typically have much higher limits
- **Server-side usage** — BYOK works in Node.js/server environments where Puter.js cannot
- **Advanced models** — Access to models or features not available through Puter.js
- **SLA compliance** — Enterprise-grade availability and support from providers
- **Cost control** — Direct visibility into your API spending

### How BYOK Works in Memorix

```
┌─────────────────────────────────────────────────┐
│              Memorix LLM Router                  │
│                                                  │
│   Request comes in with model + API key          │
│          │                                       │
│          ├── Is model free? → Puter.js           │
│          │                                       │
│          └── Has API key? → BYOK Provider         │
│                  │                                │
│                  ├── provider = 'openai'          │
│                  │   → OpenAI API                 │
│                  ├── provider = 'anthropic'       │
│                  │   → Anthropic API              │
│                  ├── provider = 'google'          │
│                  │   → Google Gemini API          │
│                  ├── provider = 'deepseek'        │
│                  │   → DeepSeek API               │
│                  ├── provider = 'openrouter'      │
│                  │   → OpenRouter API             │
│                  ├── provider = 'ollama'          │
│                  │   → Local Ollama               │
│                  └── provider = 'custom'          │
│                      → Any OpenAI-compatible API  │
└─────────────────────────────────────────────────┘
```

---

## Supported Providers

| Provider | API Format | Base URL | Local/Cloud | Streaming |
|----------|-----------|----------|-------------|-----------|
| **OpenAI** | OpenAI | `api.openai.com/v1` | Cloud | Yes |
| **Anthropic** | Anthropic Native | `api.anthropic.com/v1` | Cloud | Partial* |
| **Google Gemini** | Google Native | `generativelanguage.googleapis.com` | Cloud | Partial* |
| **DeepSeek** | OpenAI-Compatible | `api.deepseek.com/v1` | Cloud | Yes |
| **OpenRouter** | OpenAI-Compatible | `openrouter.ai/api/v1` | Cloud | Yes |
| **Ollama** | OpenAI-Compatible | `localhost:11434/v1` | Local | Yes |
| **Custom** | OpenAI-Compatible | User-defined | Any | Yes |

\* Anthropic and Google use their native API format for non-streaming; streaming falls back to the full response returned at once.

---

## Step-by-Step Setup

### 1. OpenAI

OpenAI provides GPT-4o, GPT-5.4, and o-series reasoning models.

#### Get an API Key

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** in the sidebar
4. Click **Create new secret key**
5. Copy the key (starts with `sk-...`)
6. Add billing details and credit your account

#### Configure in Memorix

```typescript
// Via API call
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/openai-gpt-4o',
    provider: 'openai',
    apiKey: 'sk-your-openai-key-here',
    messages: [
      { role: 'user', content: 'Hello, GPT-4o!' }
    ],
  }),
})
```

#### Test Your Setup

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "byok/openai-gpt-4o",
    "provider": "openai",
    "apiKey": "sk-your-key",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

---

### 2. Anthropic

Anthropic provides the Claude family of models (Opus, Sonnet, Haiku).

#### Get an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`)
6. Add credits to your account

#### Configure in Memorix

```typescript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/anthropic-claude-opus',
    provider: 'anthropic',
    apiKey: 'sk-ant-your-key-here',
    messages: [
      { role: 'user', content: 'What is the meaning of life?' }
    ],
  }),
})
```

#### Anthropic-Specific Notes

- System messages are extracted and sent as the `system` parameter (Anthropic's format)
- Tool calls are converted between OpenAI format and Anthropic format automatically
- The `anthropic-dangerous-direct-browser-access` header is set for browser compatibility
- API version: `2023-06-01`

---

### 3. Google Gemini

Google provides the Gemini family with massive context windows (up to 2M tokens).

#### Get an API Key

1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API Key** in the sidebar
4. Create a new project or select an existing one
5. Copy the API key

#### Configure in Memorix

```typescript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/google-gemini-pro',
    provider: 'google',
    apiKey: 'AIza-your-google-key-here',
    messages: [
      { role: 'user', content: 'Analyze this data...' }
    ],
  }),
})
```

#### Google-Specific Notes

- API key is passed as a URL query parameter (`?key=...`), not a header
- Assistant messages use `role: 'model'` internally
- System instructions are sent as `systemInstruction` parameter
- Supports function calling via `functionDeclarations`

---

### 4. DeepSeek

DeepSeek provides cost-effective models with strong reasoning capabilities.

#### Get an API Key

1. Go to [platform.deepseek.com](https://platform.deepseek.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with `sk-...`)
6. Add credits (very affordable — see cost comparison below)

#### Configure in Memorix

```typescript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/deepseek-chat',
    provider: 'deepseek',
    apiKey: 'sk-your-deepseek-key',
    messages: [
      { role: 'user', content: 'Write a sorting algorithm in Rust' }
    ],
  }),
})
```

#### DeepSeek-Specific Notes

- Uses OpenAI-compatible API format
- Same request/response structure as OpenAI
- Supports streaming natively
- Extremely cost-effective for code tasks

---

### 5. OpenRouter

OpenRouter provides a unified API for 100+ models from multiple providers.

#### Get an API Key

1. Go to [openrouter.ai](https://openrouter.ai/)
2. Sign up or log in
3. Navigate to **Keys**
4. Click **Create Key**
5. Copy the key
6. Add credits to your account

#### Configure in Memorix

```typescript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/openrouter-auto',
    provider: 'openrouter',
    apiKey: 'sk-or-your-openrouter-key',
    messages: [
      { role: 'user', content: 'Compare React and Vue' }
    ],
  }),
})
```

#### OpenRouter-Specific Notes

- Uses OpenAI-compatible API format
- Sends `HTTP-Referer: https://memorix.app` and `X-Title: Memorix` headers
- Supports model routing and fallback
- Access to models from OpenAI, Anthropic, Google, Meta, and more through a single key

---

### 6. Ollama (Local)

Ollama runs models locally on your machine — completely free, completely private.

#### Install Ollama

1. Download from [ollama.com](https://ollama.com/)
2. Install for your platform (macOS, Linux, Windows)
3. Start the Ollama service:
   ```bash
   ollama serve
   ```
4. Pull a model:
   ```bash
   ollama pull llama3
   ollama pull mistral
   ollama pull codellama
   ```

#### Configure in Memorix

```typescript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'local/llama3',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    apiKey: 'ollama',  // Any non-empty string works
    messages: [
      { role: 'user', content: 'Hello from local LLM!' }
    ],
  }),
})
```

#### Ollama-Specific Notes

- Default endpoint: `http://localhost:11434/v1/chat/completions`
- No real API key needed (any non-empty string works)
- Supports streaming natively
- Runs 100% locally — no data leaves your machine
- Context window depends on model and available RAM

---

### 7. Custom (Any OpenAI-Compatible Endpoint)

Connect to any API that implements the OpenAI chat completions format.

#### Configure in Memorix

```typescript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'my-custom-model',
    provider: 'custom',
    baseUrl: 'https://my-llm-api.example.com/v1/chat/completions',
    apiKey: 'your-api-key',
    messages: [
      { role: 'user', content: 'Hello from custom endpoint!' }
    ],
  }),
})
```

#### Compatible Services

- **vLLM** — High-performance inference server
- **LM Studio** — Local model runner with OpenAI-compatible API
- **Together AI** — Cloud inference for open-source models
- **Fireworks AI** — Fast inference for open-source models
- **Groq** — Ultra-fast inference for Llama, Mixtral
- **Text Generation Inference (TGI)** — HuggingFace's inference server
- **Any self-hosted** server implementing the OpenAI chat format

---

## API Key Security

### How Memorix Handles Your Keys

Memorix takes API key security seriously:

| Measure | Implementation |
|---------|---------------|
| **Local Storage** | API keys are stored in user settings (local browser storage), never sent to Memorix servers |
| **UI Masking** | Keys are masked in the settings UI (e.g., `sk-...abc123`) |
| **No Server Storage** | Keys are never persisted in the database |
| **Request-Only** | Keys are only included in the LLM API request, never logged or cached server-side |
| **HTTPS Only** | All API calls use HTTPS encryption |
| **User Control** | Users can delete their keys at any time from settings |

### Best Practices for API Key Security

1. **Never share your API key** — Each user should use their own key
2. **Use project-specific keys** — Create separate keys for different applications
3. **Set usage limits** — Configure spending caps on provider dashboards
4. **Rotate regularly** — Generate new keys periodically and delete old ones
5. **Monitor usage** — Check provider dashboards for unexpected activity
6. **Revoke immediately** — If a key is compromised, revoke it on the provider's dashboard

### Key Format Reference

| Provider | Key Format | Example |
|----------|-----------|---------|
| OpenAI | `sk-...` | `sk-proj-abc123...` |
| Anthropic | `sk-ant-...` | `sk-ant-api03-abc123...` |
| Google | `AIza...` | `AIzaSyB-abc123...` |
| DeepSeek | `sk-...` | `sk-abc123...` |
| OpenRouter | `sk-or-...` | `sk-or-v1-abc123...` |
| Ollama | *(any)* | `ollama` |
| Custom | *(varies)* | Depends on provider |

---

## Cost Comparison

Pricing per 1M tokens (USD) as of 2025:

| Model | Input | Output | Best For |
|-------|-------|--------|----------|
| **Puter.js (Free)** | $0 | $0 | General use, prototyping |
| **DeepSeek Chat** | $0.14 | $0.28 | Cost-effective code & reasoning |
| **DeepSeek R1** | $0.55 | $2.19 | Advanced reasoning |
| **OpenAI GPT-4o Mini** | $0.15 | $0.60 | Fast, affordable chat |
| **OpenAI GPT-4o** | $2.50 | $10.00 | Balanced performance |
| **OpenAI GPT-5.4** | $2.50 | $10.00 | Advanced tasks |
| **Anthropic Claude Sonnet** | $3.00 | $15.00 | Analysis, writing |
| **Anthropic Claude Opus** | $15.00 | $75.00 | Complex reasoning |
| **Google Gemini Flash** | $0.075 | $0.30 | High-volume, fast tasks |
| **Google Gemini Pro** | $1.25 | $5.00 | Balanced performance |
| **Ollama (Local)** | $0 | $0 | Privacy-first, offline |

### Monthly Cost Estimates

| Usage Level | Puter.js (Free) | DeepSeek | OpenAI GPT-4o | Claude Opus |
|-------------|----------------|----------|---------------|-------------|
| Light (100K tokens/mo) | $0 | ~$0.05 | ~$1.25 | ~$7.50 |
| Medium (1M tokens/mo) | $0 | ~$0.40 | ~$12.50 | ~$75.00 |
| Heavy (10M tokens/mo) | $0* | ~$4.00 | ~$125.00 | ~$750.00 |

\* Subject to Puter.com free tier limits

---

## When to Use BYOK vs Free

### Use Puter.js (Free) When:

- You're prototyping or exploring
- Your usage fits within Puter.com's free tier
- You're using the app in a browser
- You don't need guaranteed SLA
- Cost is the primary concern
- You're a casual user

### Use BYOK When:

- You need guaranteed uptime and low latency
- You exceed Puter.com's free tier limits
- You're running server-side (Node.js) code
- You need enterprise-grade SLA
- You need specific models not on Puter.js
- You're building a production SaaS on top of Memorix
- Privacy regulations require direct API contracts

### Decision Flowchart

```
Need LLM access?
├── Browser environment?
│   ├── Within free tier limits?
│   │   └── YES → Use Puter.js (Free)
│   └── NO → Need guaranteed uptime?
│       ├── YES → Use BYOK
│       └── NO → Use Puter.js (Free)
└── Server environment?
    └── Use BYOK (Puter.js is browser-only)
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "API key is required for BYOK providers"

**Cause:** You're trying to use a BYOK model without providing an API key.

**Solution:** Add the `apiKey` parameter to your request, or switch to a free Puter.js model.

```typescript
// Wrong
{ model: 'byok/openai-gpt-4o', provider: 'openai' }

// Correct
{ model: 'byok/openai-gpt-4o', provider: 'openai', apiKey: 'sk-...' }
```

#### 2. "API error (401): Invalid API key"

**Cause:** The API key is invalid, expired, or revoked.

**Solution:**
- Verify the key is correct (check for extra spaces or missing characters)
- Check the provider dashboard to ensure the key is active
- Generate a new key if the old one is revoked

#### 3. "API error (429): Rate limit exceeded"

**Cause:** You've exceeded the provider's rate limit.

**Solution:**
- Wait and retry after the rate limit window resets
- Check your provider dashboard for current usage
- Consider upgrading your API tier
- Implement request queuing and throttling

#### 4. "API error (402): Insufficient quota"

**Cause:** Your provider account has run out of credits.

**Solution:**
- Add credits to your provider account
- Check your billing dashboard
- Set up auto-reload if available

#### 5. "Base URL is required for custom provider"

**Cause:** You specified `provider: 'custom'` without a `baseUrl`.

**Solution:**
```typescript
{
  provider: 'custom',
  baseUrl: 'https://your-api.example.com/v1/chat/completions',
  apiKey: 'your-key',
  model: 'your-model',
}
```

#### 6. "Puter.js is only available in browser environment"

**Cause:** You're trying to call Puter.js from server-side code.

**Solution:** Use BYOK providers for server-side, or restructure to make Puter.js calls from the client.

#### 7. Ollama Connection Refused

**Cause:** Ollama is not running or the port is wrong.

**Solution:**
```bash
# Start Ollama
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags
```

#### 8. Anthropic CORS Error

**Cause:** Browser CORS policies block direct Anthropic API calls.

**Solution:** Memorix sets the `anthropic-dangerous-direct-browser-access` header automatically. If issues persist, route through the server-side API.

---

## Example API Calls

### cURL Examples

#### OpenAI Chat

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "byok/openai-gpt-4o",
    "provider": "openai",
    "apiKey": "sk-your-openai-key",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain transformers in AI."}
    ],
    "temperature": 0.7,
    "maxTokens": 1024
  }'
```

#### Anthropic Claude

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "byok/anthropic-claude-opus",
    "provider": "anthropic",
    "apiKey": "sk-ant-your-key",
    "messages": [
      {"role": "user", "content": "Analyze the pros and cons of microservices."}
    ],
    "maxTokens": 2048
  }'
```

#### Streaming with DeepSeek

```bash
curl -N -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "byok/deepseek-chat",
    "provider": "deepseek",
    "apiKey": "sk-your-deepseek-key",
    "messages": [
      {"role": "user", "content": "Write a Python web scraper."}
    ],
    "stream": true
  }'
```

### Python Examples

```python
import requests

# OpenAI via Memorix
response = requests.post('http://localhost:3000/api/llm/chat', json={
    'model': 'byok/openai-gpt-4o',
    'provider': 'openai',
    'apiKey': 'sk-your-openai-key',
    'messages': [
        {'role': 'user', 'content': 'Hello from Python!'}
    ],
    'temperature': 0.7,
})

result = response.json()
print(result['data']['content'])
```

```python
# Streaming with Python
import requests
import json

response = requests.post('http://localhost:3000/api/llm/chat', json={
    'model': 'byok/deepseek-chat',
    'provider': 'deepseek',
    'apiKey': 'sk-your-deepseek-key',
    'messages': [
        {'role': 'user', 'content': 'Tell me a story.'}
    ],
    'stream': True,
}, stream=True)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]
            if data == '[DONE]':
                break
            chunk = json.loads(data)
            if chunk.get('content'):
                print(chunk['content'], end='', flush=True)
```

### JavaScript Examples

```javascript
// OpenAI chat via Memorix API
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/openai-gpt-4o',
    provider: 'openai',
    apiKey: 'sk-your-openai-key',
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],
  }),
})

const result = await response.json()
console.log(result.data.content)
```

```javascript
// Streaming with JavaScript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'byok/openai-gpt-4o',
    provider: 'openai',
    apiKey: 'sk-your-openai-key',
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
      try {
        const chunk = JSON.parse(data)
        if (chunk.content) process.stdout.write(chunk.content)
      } catch {}
    }
  }
}
```

### Using the LLMRouter Directly

```typescript
import { LLMRouter } from '@/lib/llm'

// BYOK chat with OpenAI
const response = await LLMRouter.chat(
  {
    provider: 'openai',
    model: 'byok/openai-gpt-4o',
    apiKey: 'sk-your-openai-key',
    temperature: 0.7,
    maxTokens: 2048,
  },
  [
    { role: 'system', content: 'You are a coding assistant.' },
    { role: 'user', content: 'Write a REST API in Express.' },
  ]
)

console.log(response.content)
console.log(response.usage) // { promptTokens: 23, completionTokens: 156, totalTokens: 179 }

// BYOK streaming
for await (const chunk of LLMRouter.stream(
  {
    provider: 'deepseek',
    model: 'byok/deepseek-chat',
    apiKey: 'sk-your-deepseek-key',
  },
  [{ role: 'user', content: 'Explain Docker containers.' }]
)) {
  if (chunk.content) process.stdout.write(chunk.content)
}
```

---

*Memorix v4.0 — The Biggest Free Multi-LLM Hub. BYOK for when you need more than free.*
