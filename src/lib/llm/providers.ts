/**
 * Mnemosyne v1.0 — Multi-LLM Provider Layer
 *
 * Universal LLM access via:
 * 1. Puter.js (FREE — 500+ models, user-pays, zero API key)
 * 2. BYOK (Bring Your Own Key) — OpenAI, Anthropic, Google, DeepSeek, etc.
 * 3. OpenRouter — Unified API for 100+ models
 * 4. Local — Ollama, LM Studio, etc.
 *
 * This is the CORE abstraction that makes Mnemosyne the biggest
 * multi-LLM middle provider — portable yet powerful.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type LLMProvider = 'puter' | 'z-ai-server' | 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'ollama' | 'custom'

export interface LLMModel {
  id: string               // e.g. "openai/gpt-5.4-nano"
  name: string             // e.g. "GPT-5.4 Nano"
  provider: LLMProvider
  providerLabel: string    // e.g. "OpenAI"
  isFree: boolean          // Available via Puter.js for free
  contextWindow: number    // Max context tokens
  capabilities: ('chat' | 'vision' | 'code' | 'reasoning' | 'tool_use' | 'streaming')[]
  pricing?: { input: number; output: number } // Per 1M tokens (USD), null if free
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface LLMTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export interface LLMResponse {
  content: string
  model: string
  provider: LLMProvider
  toolCalls?: ToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
}

export interface LLMStreamChunk {
  content?: string
  toolCalls?: Partial<ToolCall>[]
  finishReason?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export interface LLMConfig {
  provider: LLMProvider
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  tools?: LLMTool[]
  apiKey?: string  // For BYOK
  baseUrl?: string // For custom/local providers
}

// ─── Model Registry ────────────────────────────────────────────────────────

export const MODEL_REGISTRY: LLMModel[] = [
  // ═══ OpenAI (via Puter.js — FREE) ═══
  { id: 'openai/gpt-5.4-nano', name: 'GPT-5.4 Nano', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 200000, capabilities: ['chat', 'vision', 'code', 'reasoning', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'openai/gpt-5.5-pro', name: 'GPT-5.5 Pro', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 200000, capabilities: ['chat', 'vision', 'code', 'reasoning', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 128000, capabilities: ['chat', 'vision', 'code', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'openai/o4-mini', name: 'O4 Mini', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 200000, capabilities: ['chat', 'reasoning', 'code', 'streaming'], pricing: undefined },
  { id: 'openai/o3', name: 'O3', provider: 'puter', providerLabel: 'OpenAI', isFree: true, contextWindow: 200000, capabilities: ['chat', 'reasoning', 'code', 'streaming'], pricing: undefined },

  // ═══ Anthropic (via Puter.js — FREE) ═══
  { id: 'anthropic/claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'puter', providerLabel: 'Anthropic', isFree: true, contextWindow: 200000, capabilities: ['chat', 'vision', 'code', 'reasoning', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'anthropic/claude-opus-4.8-fast', name: 'Claude Opus 4.8 Fast', provider: 'puter', providerLabel: 'Anthropic', isFree: true, contextWindow: 200000, capabilities: ['chat', 'vision', 'code', 'reasoning', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'puter', providerLabel: 'Anthropic', isFree: true, contextWindow: 200000, capabilities: ['chat', 'vision', 'code', 'reasoning', 'streaming', 'tool_use'], pricing: undefined },

  // ═══ Google (via Puter.js — FREE) ═══
  { id: 'google/gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash', provider: 'puter', providerLabel: 'Google', isFree: true, contextWindow: 1000000, capabilities: ['chat', 'vision', 'code', 'streaming', 'tool_use'], pricing: undefined },
  { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro', provider: 'puter', providerLabel: 'Google', isFree: true, contextWindow: 2000000, capabilities: ['chat', 'vision', 'code', 'reasoning', 'streaming', 'tool_use'], pricing: undefined },

  // ═══ DeepSeek (via Puter.js — FREE) ═══
  { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1', provider: 'puter', providerLabel: 'DeepSeek', isFree: true, contextWindow: 128000, capabilities: ['chat', 'reasoning', 'code', 'streaming'], pricing: undefined },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'puter', providerLabel: 'DeepSeek', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming'], pricing: undefined },

  // ═══ xAI (via Puter.js — FREE) ═══
  { id: 'x-ai/grok-3', name: 'Grok 3', provider: 'puter', providerLabel: 'xAI', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'reasoning', 'streaming'], pricing: undefined },

  // ═══ Meta (via Puter.js — FREE) ═══
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'puter', providerLabel: 'Meta', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming'], pricing: undefined },

  // ═══ Mistral (via Puter.js — FREE) ═══
  { id: 'mistral/mistral-large', name: 'Mistral Large', provider: 'puter', providerLabel: 'Mistral', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming', 'tool_use'], pricing: undefined },

  // ═══ Qwen (via Puter.js — FREE) ═══
  { id: 'qwen/qwen3.7-plus', name: 'Qwen 3.7 Plus', provider: 'puter', providerLabel: 'Alibaba', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'reasoning', 'streaming'], pricing: undefined },
  { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', provider: 'puter', providerLabel: 'Alibaba', isFree: true, contextWindow: 128000, capabilities: ['chat', 'code', 'reasoning', 'streaming'], pricing: undefined },

  // ═══ BYOK Models (requires API key) ═══
  { id: 'byok/openai-gpt-4o', name: 'GPT-4o (BYOK)', provider: 'openai', providerLabel: 'OpenAI', isFree: false, contextWindow: 128000, capabilities: ['chat', 'vision', 'code', 'streaming', 'tool_use'], pricing: { input: 2.5, output: 10 } },
  { id: 'byok/anthropic-claude-opus', name: 'Claude Opus (BYOK)', provider: 'anthropic', providerLabel: 'Anthropic', isFree: false, contextWindow: 200000, capabilities: ['chat', 'vision', 'code', 'reasoning', 'streaming', 'tool_use'], pricing: { input: 15, output: 75 } },
  { id: 'byok/google-gemini-pro', name: 'Gemini Pro (BYOK)', provider: 'google', providerLabel: 'Google', isFree: false, contextWindow: 2000000, capabilities: ['chat', 'vision', 'code', 'streaming', 'tool_use'] },
  { id: 'byok/deepseek-chat', name: 'DeepSeek Chat (BYOK)', provider: 'deepseek', providerLabel: 'DeepSeek', isFree: false, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming'], pricing: { input: 0.14, output: 0.28 } },
  { id: 'byok/openrouter-auto', name: 'OpenRouter Auto', provider: 'openrouter', providerLabel: 'OpenRouter', isFree: false, contextWindow: 128000, capabilities: ['chat', 'code', 'streaming', 'tool_use'] },

  // ═══ Local Models ═══
  { id: 'local/llama3', name: 'Llama 3 (Local)', provider: 'ollama', providerLabel: 'Ollama', isFree: true, contextWindow: 8000, capabilities: ['chat', 'code', 'streaming'] },
  { id: 'local/mistral', name: 'Mistral (Local)', provider: 'ollama', providerLabel: 'Ollama', isFree: true, contextWindow: 32000, capabilities: ['chat', 'code', 'streaming'] },
  { id: 'local/codellama', name: 'Code Llama (Local)', provider: 'ollama', providerLabel: 'Ollama', isFree: true, contextWindow: 16000, capabilities: ['chat', 'code', 'streaming'] },
]

// ─── Provider Groupings ────────────────────────────────────────────────────

export const PROVIDER_GROUPS: Record<string, { label: string; icon: string; color: string; models: LLMModel[] }> = {}

// Build provider groups dynamically
const seen = new Set<string>()
for (const model of MODEL_REGISTRY) {
  const key = model.providerLabel
  if (!seen.has(key)) {
    seen.add(key)
    PROVIDER_GROUPS[key] = {
      label: key,
      icon: getProviderIcon(key),
      color: getProviderColor(key),
      models: MODEL_REGISTRY.filter(m => m.providerLabel === key),
    }
  }
}

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    'OpenAI': '🟢', 'Anthropic': '🟠', 'Google': '🔵', 'DeepSeek': '🟣',
    'xAI': '⚡', 'Meta': '🦙', 'Mistral': '🌊', 'Alibaba': '🔴',
    'Ollama': '🦙', 'OpenRouter': '🔀',
  }
  return icons[provider] || '🤖'
}

function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    'OpenAI': '#10a37f', 'Anthropic': '#d4a574', 'Google': '#4285f4',
    'DeepSeek': '#7c3aed', 'xAI': '#000000', 'Meta': '#0668E1',
    'Mistral': '#ff7000', 'Alibaba': '#ff4400', 'Ollama': '#000000',
    'OpenRouter': '#6366f1',
  }
  return colors[provider] || '#6b7280'
}

// ─── Helper Functions ──────────────────────────────────────────────────────

export function getModelById(id: string): LLMModel | undefined {
  return MODEL_REGISTRY.find(m => m.id === id)
}

export function getFreeModels(): LLMModel[] {
  return MODEL_REGISTRY.filter(m => m.isFree)
}

export function getModelsByProvider(provider: string): LLMModel[] {
  return MODEL_REGISTRY.filter(m => m.providerLabel === provider || m.provider === provider)
}

export function searchModels(query: string): LLMModel[] {
  const q = query.toLowerCase()
  return MODEL_REGISTRY.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.providerLabel.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q) ||
    m.capabilities.some(c => c.includes(q))
  )
}
