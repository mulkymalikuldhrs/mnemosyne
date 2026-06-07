/**
 * Mnemosyne v1.0 — Puter.js LLM Provider
 *
 * FREE access to 500+ AI models with zero API key.
 * User-Pays model: end-users cover their own usage via Puter.com accounts.
 * This makes Mnemosyne the biggest free multi-LLM hub in the world.
 */

import type { LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk, LLMTool, ToolCall } from './providers'

// ─── Puter.js Client (Browser-side) ────────────────────────────────────────

declare global {
  interface Window {
    puter: any
  }
}

let puterLoaded = false

/**
 * Load Puter.js SDK dynamically (for PWA/client-side usage)
 */
export function loadPuterSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Puter.js is only available in browser environment'))
      return
    }

    if (window.puter) {
      puterLoaded = true
      resolve()
      return
    }

    // Check if script already loading
    const existing = document.querySelector('script[src*="js.puter.com"]')
    if (existing) {
      existing.addEventListener('load', () => { puterLoaded = true; resolve() })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.puter.com/v2/'
    script.async = true
    script.onload = () => { puterLoaded = true; resolve() }
    script.onerror = () => reject(new Error('Failed to load Puter.js SDK'))
    document.body.appendChild(script)
  })
}

/**
 * Ensure Puter.js is loaded and return the client
 */
async function getPuterClient(): Promise<any> {
  if (!puterLoaded && !window.puter) {
    await loadPuterSDK()
  }
  return window.puter
}

// ─── Chat Completions ──────────────────────────────────────────────────────

/**
 * Send a chat completion request via Puter.js (FREE)
 */
export async function puterChat(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const puter = await getPuterClient()

  const puterMessages = messages
    .filter(m => m.role !== 'tool')
    .map(m => ({
      role: m.role,
      content: m.content,
    }))

  const options: Record<string, any> = {
    model: config.model,
  }

  if (config.temperature !== undefined) options.temperature = config.temperature
  if (config.maxTokens !== undefined) options.max_tokens = config.maxTokens
  if (config.topP !== undefined) options.top_p = config.topP
  if (config.tools && config.tools.length > 0) {
    options.tools = config.tools
  }

  try {
    const response = await puter.ai.chat(puterMessages, options)
    return parsePuterResponse(response, config.model)
  } catch (error: any) {
    throw new Error(`Puter.js chat error: ${error.message}`)
  }
}

/**
 * Stream a chat completion via Puter.js (FREE)
 */
export async function* puterChatStream(
  config: LLMConfig,
  messages: LLMMessage[]
): AsyncGenerator<LLMStreamChunk> {
  const puter = await getPuterClient()

  const puterMessages = messages
    .filter(m => m.role !== 'tool')
    .map(m => ({
      role: m.role,
      content: m.content,
    }))

  const options: Record<string, any> = {
    model: config.model,
    stream: true,
  }

  if (config.temperature !== undefined) options.temperature = config.temperature
  if (config.maxTokens !== undefined) options.max_tokens = config.maxTokens

  try {
    const response = await puter.ai.chat(puterMessages, options)

    for await (const part of response) {
      if (part?.text) {
        yield { content: part.text }
      }
      if (part?.done) {
        yield { finishReason: 'stop' }
      }
    }
  } catch (error: any) {
    throw new Error(`Puter.js stream error: ${error.message}`)
  }
}

// ─── Image Generation ──────────────────────────────────────────────────────

export async function puterGenerateImage(prompt: string, model: string = 'gpt-image-2'): Promise<string> {
  const puter = await getPuterClient()
  try {
    const imageElement = await puter.ai.txt2img(prompt, { model })
    // Return the image src
    return imageElement?.src || imageElement?.toString()
  } catch (error: any) {
    throw new Error(`Puter.js image generation error: ${error.message}`)
  }
}

// ─── Text-to-Speech ────────────────────────────────────────────────────────

export async function puterTextToSpeech(text: string, voice?: string): Promise<Blob> {
  const puter = await getPuterClient()
  try {
    const audio = await puter.ai.txt2speech(text, { voice })
    return audio
  } catch (error: any) {
    throw new Error(`Puter.js TTS error: ${error.message}`)
  }
}

// ─── Speech-to-Text ────────────────────────────────────────────────────────

export async function puterSpeechToText(audioBlob: Blob): Promise<string> {
  const puter = await getPuterClient()
  try {
    const transcription = await puter.ai.speech2txt(audioBlob)
    return transcription
  } catch (error: any) {
    throw new Error(`Puter.js STT error: ${error.message}`)
  }
}

// ─── List Models ───────────────────────────────────────────────────────────

export async function puterListModels(): Promise<any[]> {
  const puter = await getPuterClient()
  try {
    const models = await puter.ai.listModels()
    return models
  } catch (error: any) {
    console.warn('Puter.js listModels error:', error.message)
    return []
  }
}

// ─── Cloud Storage (via Puter.js — FREE) ───────────────────────────────────

export async function puterWriteFile(path: string, content: string): Promise<void> {
  const puter = await getPuterClient()
  await puter.fs.write(path, content)
}

export async function puterReadFile(path: string): Promise<string> {
  const puter = await getPuterClient()
  const content = await puter.fs.read(path)
  return typeof content === 'string' ? content : await content.text()
}

export async function puterListDir(path: string = '/'): Promise<any[]> {
  const puter = await getPuterClient()
  return puter.fs.readdir(path)
}

export async function puterDeleteFile(path: string): Promise<void> {
  const puter = await getPuterClient()
  await puter.fs.delete(path)
}

// ─── Key-Value Store (via Puter.js — FREE) ─────────────────────────────────

export async function puterKvSet(key: string, value: string): Promise<void> {
  const puter = await getPuterClient()
  await puter.kv.set(key, value)
}

export async function puterKvGet(key: string): Promise<string | null> {
  const puter = await getPuterClient()
  return puter.kv.get(key)
}

// ─── Auth (Puter.js User Session) ─────────────────────────────────────────

export async function puterIsSignedIn(): Promise<boolean> {
  const puter = await getPuterClient()
  return puter.auth.isSignedIn()
}

export async function puterSignIn(): Promise<void> {
  const puter = await getPuterClient()
  await puter.auth.signIn()
}

export async function puterGetUser(): Promise<any> {
  const puter = await getPuterClient()
  return puter.auth.getUser()
}

// ─── Response Parser ──────────────────────────────────────────────────────

function parsePuterResponse(response: any, model: string): LLMResponse {
  let content = ''
  let toolCalls: ToolCall[] | undefined
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  // Handle string response (common for OpenAI models via Puter)
  if (typeof response === 'string') {
    content = response
  }
  // Handle structured response (Anthropic-style)
  else if (response?.message) {
    if (typeof response.message === 'string') {
      content = response.message
    } else if (response.message.content) {
      if (Array.isArray(response.message.content)) {
        // Anthropic format: [{type: 'text', text: '...'}]
        const textBlocks = response.message.content.filter((b: any) => b.type === 'text')
        content = textBlocks.map((b: any) => b.text).join('')
      } else if (typeof response.message.content === 'string') {
        content = response.message.content
      }
    }

    // Extract tool calls
    if (response.message.tool_calls?.length > 0) {
      toolCalls = response.message.tool_calls.map((tc: any) => ({
        id: tc.id || `tc_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: tc.function?.name || tc.name || '',
          arguments: typeof tc.function?.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function?.arguments || tc.arguments || {}),
        },
      }))
    }
  }
  // Handle choices array (OpenAI-style)
  else if (response?.choices?.length > 0) {
    const choice = response.choices[0]
    content = choice.message?.content || ''
    if (choice.message?.tool_calls?.length > 0) {
      toolCalls = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id || `tc_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: tc.function?.name || '',
          arguments: typeof tc.function?.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function?.arguments || {}),
        },
      }))
    }
    if (response.usage) {
      usage = {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
      }
    }
  }

  return {
    content,
    model,
    provider: 'puter',
    toolCalls,
    usage: usage.totalTokens > 0 ? usage : undefined,
    finishReason: 'stop',
  }
}
