'use client'

/**
 * Mnemosyne v1.0 — AI Agent Chat Panel
 *
 * Full AI agent with multi-LLM access and tool execution.
 * Powered by Puter.js for FREE LLMs.
 * Professional-grade chat interface with model selection and agent tools.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, User, Wrench, Search, Brain, Plus,
  ChevronDown, Loader2, Zap, Crown, MessageSquare,
  Settings2, Trash2, Copy, Check, ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { MODEL_REGISTRY, getFreeModels, type LLMModel } from '@/lib/llm/providers'
import { TOOL_REGISTRY } from '@/lib/agent'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  model?: string
  toolName?: string
  toolCallId?: string
  timestamp: Date
  isStreaming?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AgentChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('openai/gpt-5.4-nano')
  const [useAgent, setUseAgent] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const freeModels = getFreeModels()

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (useAgent) {
        // Agent mode — uses /api/llm/agent with tool calling
        const res = await fetch('/api/llm/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            userId: 'current-user', // TODO: Replace with authenticated user ID from session
            model: selectedModel,
          }),
        })

        const data = await res.json()

        if (data.success && data.data) {
          // Add tool call messages
          const agentMessages = data.data.messages || []
          for (const msg of agentMessages) {
            if (msg.role === 'assistant' && msg.toolCalls) {
              // Tool calls were made
              for (const tc of msg.toolCalls) {
                setMessages(prev => [...prev, {
                  id: `tool_${Date.now()}_${tc.function.name}`,
                  role: 'tool',
                  content: `Calling ${tc.function.name}...`,
                  toolName: tc.function.name,
                  timestamp: new Date(),
                }])
              }
            }
          }

          // Final response
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: data.data.response || 'No response from agent.',
            model: selectedModel,
            timestamp: new Date(),
          }])
        } else {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `Error: ${data.error || 'Agent failed'}`,
            timestamp: new Date(),
          }])
        }
      } else {
        // Simple chat mode — uses /api/llm/chat
        const res = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: 'You are Mnemosyne, a personal AI memory assistant. Help users with their questions and knowledge management.' },
              ...messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
                role: m.role,
                content: m.content,
              })),
              { role: 'user', content: userMessage.content },
            ],
          }),
        })

        const data = await res.json()

        if (data.success && data.data) {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: data.data.content || 'No response.',
            model: selectedModel,
            timestamp: new Date(),
          }])
        } else {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `Error: ${data.error || 'Chat failed'}`,
            timestamp: new Date(),
          }])
        }
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const modelInfo = MODEL_REGISTRY.find(m => m.id === selectedModel)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Agent Chat</p>
            <p className="text-[10px] text-muted-foreground">
              {useAgent ? 'Agent mode with tool execution' : 'Simple chat mode'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-48 h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {freeModels.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-emerald-500" />
                    {m.providerLabel} — {m.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Agent Toggle */}
          <div className="flex items-center gap-1.5">
            <Switch checked={useAgent} onCheckedChange={setUseAgent} id="agent-mode" />
            <Label htmlFor="agent-mode" className="text-[10px]">
              <Wrench className="w-3 h-3 inline mr-0.5" />
              Agent
            </Label>
          </div>

          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearChat}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Mnemosyne AI Agent</p>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                Chat with your AI agent powered by {modelInfo?.name || 'multi-LLM'}.
                {useAgent && ' The agent can search your memories, save notes, track decisions, and search the web.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                'What do I know about machine learning?',
                'Save a note about my project deadline',
                'Search my memories for meeting notes',
                'What decisions have I made recently?',
              ].map(suggestion => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {msg.role !== 'user' && (
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1',
                  msg.role === 'tool'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-primary/10 text-primary',
                )}>
                  {msg.role === 'tool' ? <Wrench className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
              )}

              <div className={cn(
                'max-w-[80%] rounded-xl p-3',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : msg.role === 'tool'
                  ? 'bg-amber-500/5 border border-amber-500/20'
                  : 'bg-accent',
              )}>
                {msg.role === 'tool' && msg.toolName && (
                  <div className="flex items-center gap-1 mb-1">
                    <Wrench className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-medium text-amber-500">{msg.toolName}</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  {msg.model && (
                    <span className="text-[9px] opacity-60">{msg.model}</span>
                  )}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="text-[9px] opacity-40 hover:opacity-80"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">
              {useAgent ? 'Agent thinking...' : 'Generating...'}
            </span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-border">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={useAgent ? 'Ask the agent anything... (Enter to send, Shift+Enter for new line)' : 'Type a message...'}
              className="min-h-[40px] max-h-32 resize-none pr-10 text-sm"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {modelInfo?.isFree && (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[7px] h-4 px-1">
                  <Zap className="w-2 h-2 mr-0.5" />
                  FREE
                </Badge>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-10"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground">
          <span>Model: {modelInfo?.name || selectedModel}</span>
          <span>Mode: {useAgent ? 'Agent (tool-use)' : 'Chat'}</span>
          <span>Provider: {modelInfo?.providerLabel || 'Puter.js'}</span>
        </div>
      </div>
    </div>
  )
}
