/**
 * Mnemosyne v1.0 — Unified LLM Router
 *
 * THE core of Mnemosyne as a multi-LLM middle provider.
 * Routes requests to the correct provider (Puter.js FREE or BYOK).
 * This is what makes Mnemosyne the biggest free multi-LLM hub.
 *
 * Usage:
 *   import { LLMRouter } from '@/lib/llm'
 *   const response = await LLMRouter.chat({ model: 'openai/gpt-5.4-nano', messages })
 */

import type { LLMConfig, LLMMessage, LLMResponse, LLMStreamChunk, LLMModel } from './providers'
import { MODEL_REGISTRY, getModelById, getFreeModels, searchModels } from './providers'
import { puterChat, puterChatStream } from './puter-provider'
import { byokChat, byokChatStream } from './byok-provider'

// ─── LLM Router ────────────────────────────────────────────────────────────

export class LLMRouter {
  /**
   * Send a chat completion — auto-routes to Puter.js (free) or BYOK
   */
  static async chat(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
    const model = getModelById(config.model)

    if (model?.isFree || config.provider === 'puter') {
      return puterChat(config, messages)
    }

    if (config.provider === 'openai' || config.provider === 'anthropic' ||
        config.provider === 'google' || config.provider === 'deepseek' ||
        config.provider === 'openrouter' || config.provider === 'ollama' ||
        config.provider === 'custom') {
      return byokChat(config, messages)
    }

    // Default: try Puter.js first, fallback to BYOK
    try {
      return await puterChat(config, messages)
    } catch {
      if (config.apiKey) {
        return byokChat(config, messages)
      }
      throw new Error(`No provider available for model: ${config.model}`)
    }
  }

  /**
   * Stream a chat completion — auto-routes
   */
  static async *stream(config: LLMConfig, messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk> {
    const model = getModelById(config.model)

    if (model?.isFree || config.provider === 'puter') {
      yield* puterChatStream(config, messages)
      return
    }

    if (config.apiKey) {
      yield* byokChatStream(config, messages)
      return
    }

    // Fallback: try Puter.js
    try {
      yield* puterChatStream(config, messages)
    } catch {
      throw new Error(`No streaming provider available for model: ${config.model}`)
    }
  }

  /**
   * Get all available models
   */
  static getModels(): LLMModel[] {
    return MODEL_REGISTRY
  }

  /**
   * Get free models only
   */
  static getFreeModels(): LLMModel[] {
    return getFreeModels()
  }

  /**
   * Search models
   */
  static searchModels(query: string): LLMModel[] {
    return searchModels(query)
  }

  /**
   * Multi-model comparison — run the same prompt across multiple models
   */
  static async compare(
    prompt: string,
    models: string[],
    config?: Partial<LLMConfig>
  ): Promise<{ model: string; response: LLMResponse; error?: string }[]> {
    const results = await Promise.allSettled(
      models.map(async (modelId) => {
        const response = await LLMRouter.chat(
          { ...config, model: modelId, provider: getModelById(modelId)?.provider || 'puter' },
          [{ role: 'user', content: prompt }]
        )
        return { model: modelId, response }
      })
    )

    return results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value
      }
      return { model: models[i], response: { content: '', model: models[i], provider: 'puter' }, error: r.reason?.message || 'Unknown error' }
    })
  }
}

// Re-export everything for convenience
export * from './providers'
export { puterChat, puterChatStream, loadPuterSDK } from './puter-provider'
export { byokChat, byokChatStream } from './byok-provider'
