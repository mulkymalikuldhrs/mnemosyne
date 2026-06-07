/**
 * Mnemosyne v1.0 — BYOK (Bring Your Own Key) Provider
 *
 * Users bring their own API keys and Mnemosyne becomes the middle provider.
 * Supports: OpenAI, Anthropic, Google, DeepSeek, OpenRouter, and any OpenAI-compatible API.
 * This is the key to SaaS/IaaS — Mnemosyne wraps everything into a unified API.
 */

import type { LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk } from './providers'

// ─── BYOK Provider Implementations ─────────────────────────────────────────

const API_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

// ─── OpenAI-Compatible Chat (works for OpenAI, DeepSeek, OpenRouter, local) ─

async function openaiCompatibleChat(
  apiKey: string,
  baseUrl: string,
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const openaiMessages = messages
    .filter(m => m.role !== 'tool')
    .map(m => ({ role: m.role, content: m.content }))

  const body: Record<string, any> = {
    model: config.model.replace('byok/', ''),
    messages: openaiMessages,
    stream: false,
  }

  if (config.temperature !== undefined) body.temperature = config.temperature
  if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens
  if (config.topP !== undefined) body.top_p = config.topP
  if (config.tools && config.tools.length > 0) {
    body.tools = config.tools
    body.tool_choice = 'auto'
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }

  // OpenRouter specific headers
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://mnemosyne.app'
    headers['X-Title'] = 'Mnemosyne'
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error (${response.status}): ${error}`)
  }

  const data = await response.json()

  const content = data.choices?.[0]?.message?.content || ''
  const toolCalls = data.choices?.[0]?.message?.tool_calls?.map((tc: any) => ({
    id: tc.id || `tc_${Date.now()}`,
    type: 'function' as const,
    function: {
      name: tc.function?.name || '',
      arguments: typeof tc.function?.arguments === 'string'
        ? tc.function.arguments
        : JSON.stringify(tc.function?.arguments || {}),
    },
  }))

  return {
    content,
    model: config.model,
    provider: config.provider,
    toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0,
      totalTokens: data.usage.total_tokens || 0,
    } : undefined,
    finishReason: data.choices?.[0]?.finish_reason || 'stop',
  }
}

// ─── Anthropic Chat ────────────────────────────────────────────────────────

async function anthropicChat(
  apiKey: string,
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const systemMessage = messages.find(m => m.role === 'system')
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))

  const body: Record<string, any> = {
    model: config.model.replace('byok/anthropic-', ''),
    messages: chatMessages,
    max_tokens: config.maxTokens || 4096,
    stream: false,
  }

  if (systemMessage) body.system = systemMessage.content
  if (config.temperature !== undefined) body.temperature = config.temperature
  if (config.topP !== undefined) body.top_p = config.topP
  if (config.tools && config.tools.length > 0) {
    body.tools = config.tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }))
  }

  const response = await fetch(API_ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${error}`)
  }

  const data = await response.json()

  const content = data.content
    ?.filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('') || ''

  const toolCalls = data.content
    ?.filter((b: any) => b.type === 'tool_use')
    .map((tc: any) => ({
      id: tc.id || `tc_${Date.now()}`,
      type: 'function' as const,
      function: {
        name: tc.name || '',
        arguments: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input || {}),
      },
    }))

  return {
    content,
    model: config.model,
    provider: 'anthropic',
    toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens || 0,
      completionTokens: data.usage.output_tokens || 0,
      totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
    } : undefined,
    finishReason: data.stop_reason || 'stop',
  }
}

// ─── Google Gemini Chat ────────────────────────────────────────────────────

async function googleChat(
  apiKey: string,
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const modelName = config.model.replace('byok/google-', '')
  const url = `${API_ENDPOINTS.google}/${modelName}:generateContent?key=${apiKey}`

  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = messages.find(m => m.role === 'system')

  const body: Record<string, any> = {
    contents,
    generationConfig: {
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens || 4096,
      topP: config.topP ?? 0.95,
    },
  }

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] }
  }

  if (config.tools && config.tools.length > 0) {
    body.tools = [{
      functionDeclarations: config.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }]
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google API error (${response.status}): ${error}`)
  }

  const data = await response.json()

  const content = data.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    .map((p: any) => p.text)
    .join('') || ''

  return {
    content,
    model: config.model,
    provider: 'google',
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount || 0,
      completionTokens: data.usageMetadata.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata.totalTokenCount || 0,
    } : undefined,
    finishReason: data.candidates?.[0]?.finishReason || 'stop',
  }
}

// ─── Unified BYOK Chat ─────────────────────────────────────────────────────

export async function byokChat(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  if (!config.apiKey) {
    throw new Error('API key is required for BYOK providers')
  }

  switch (config.provider) {
    case 'anthropic':
      return anthropicChat(config.apiKey, config, messages)

    case 'google':
      return googleChat(config.apiKey, config, messages)

    case 'openai':
      return openaiCompatibleChat(
        config.apiKey,
        API_ENDPOINTS.openai,
        config,
        messages
      )

    case 'deepseek':
      return openaiCompatibleChat(
        config.apiKey,
        API_ENDPOINTS.deepseek,
        config,
        messages
      )

    case 'openrouter':
      return openaiCompatibleChat(
        config.apiKey,
        API_ENDPOINTS.openrouter,
        config,
        messages
      )

    case 'ollama':
      return openaiCompatibleChat(
        config.apiKey || 'ollama',
        config.baseUrl || 'http://localhost:11434/v1/chat/completions',
        config,
        messages
      )

    case 'custom':
      if (!config.baseUrl) throw new Error('Base URL is required for custom provider')
      return openaiCompatibleChat(
        config.apiKey,
        config.baseUrl,
        config,
        messages
      )

    default:
      throw new Error(`Unknown BYOK provider: ${config.provider}`)
  }
}

// ─── BYOK Streaming ────────────────────────────────────────────────────────

export async function* byokChatStream(
  config: LLMConfig,
  messages: LLMMessage[]
): AsyncGenerator<LLMStreamChunk> {
  if (!config.apiKey) throw new Error('API key is required for BYOK streaming')

  // Determine endpoint
  let endpoint: string
  switch (config.provider) {
    case 'openai': endpoint = API_ENDPOINTS.openai; break
    case 'deepseek': endpoint = API_ENDPOINTS.deepseek; break
    case 'openrouter': endpoint = API_ENDPOINTS.openrouter; break
    case 'ollama': endpoint = config.baseUrl || 'http://localhost:11434/v1/chat/completions'; break
    case 'custom': endpoint = config.baseUrl!; break
    case 'anthropic':
    case 'google':
      // For Anthropic/Google, fallback to non-streaming for simplicity
      const result = await byokChat(config, messages)
      yield { content: result.content, finishReason: 'stop' }
      return
    default:
      throw new Error(`Unsupported streaming provider: ${config.provider}`)
  }

  const openaiMessages = messages
    .filter(m => m.role !== 'tool')
    .map(m => ({ role: m.role, content: m.content }))

  const body: Record<string, any> = {
    model: config.model.replace('byok/', ''),
    messages: openaiMessages,
    stream: true,
  }

  if (config.temperature !== undefined) body.temperature = config.temperature
  if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`BYOK stream error (${response.status}): ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No readable stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') {
        yield { finishReason: 'stop' }
        return
      }

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta
        if (delta?.content) {
          yield { content: delta.content }
        }
        if (parsed.choices?.[0]?.finish_reason) {
          yield { finishReason: parsed.choices[0].finish_reason }
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }
}
