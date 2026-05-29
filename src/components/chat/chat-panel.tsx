'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Plus, MessageSquare, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageBubble } from './message-bubble'
import { useChatStore, useNotesStore } from '@/lib/store'

export function ChatPanel() {
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    addMessage,
    isLoading,
    setIsLoading,
    addConversation,
  } = useChatStore()

  const { notes } = useNotesStore()
  const [input, setInput] = useState('')
  const [showConvSelector, setShowConvSelector] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentConversation = conversations.find((c) => c.id === currentConversationId)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    addMessage(userMessage)
    setInput('')
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: generateMockResponse(input.trim()),
        timestamp: new Date().toISOString(),
        memoryReferences: [
          {
            noteId: notes[Math.floor(Math.random() * notes.length)]?.id ?? '1',
            noteTitle: notes[Math.floor(Math.random() * notes.length)]?.title ?? 'Related Note',
            relevance: 0.7 + Math.random() * 0.25,
          },
        ],
      }
      addMessage(aiMessage)
      setIsLoading(false)
    }, 1200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    const conv = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      lastMessageAt: new Date().toISOString(),
      messageCount: 0,
    }
    addConversation(conv)
    setCurrentConversationId(conv.id)
  }

  const handleMemoryRefClick = (noteId: string) => {
    // Navigate to the note in the notes section
    const { setSelectedNoteId, setIsEditing } = useNotesStore.getState()
    setSelectedNoteId(noteId)
    setIsEditing(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Chat with Memory</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Conversation Selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 max-w-[200px]"
              onClick={() => setShowConvSelector(!showConvSelector)}
            >
              <span className="truncate text-xs">
                {currentConversation?.title ?? 'Select conversation'}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </Button>
            {showConvSelector && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg z-50">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setCurrentConversationId(conv.id)
                      setShowConvSelector(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors"
                  >
                    {conv.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNewConversation}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onMemoryRefClick={handleMemoryRefClick}
            />
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 max-w-[75%]"
          >
            <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 md:px-6 py-3">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your memories..."
            disabled={isLoading}
            className="h-10 bg-muted/50 border-0"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          Memorix uses your stored memories to provide contextual responses
        </p>
      </div>
    </div>
  )
}

// Simple mock response generator
function generateMockResponse(query: string): string {
  const lower = query.toLowerCase()

  if (lower.includes('embed') || lower.includes('vector')) {
    return 'Based on your notes about embedding strategies, Memorix uses a hybrid approach. When online, it leverages external API embeddings for best quality. When offline, it falls back to n-gram-based pseudo-embeddings that still provide meaningful similarity search. The key insight is that shared substrings between texts produce higher cosine similarity in the n-gram vector space, making the fallback genuinely useful for retrieval.'
  }

  if (lower.includes('pattern') || lower.includes('insight')) {
    return 'Your memory patterns show some interesting trends. There\'s a growing cluster of architecture-related notes that are highly interconnected. I also notice temporal shifts — your recent notes focus more on integration patterns compared to earlier foundational concepts. The knowledge graph connectivity ratio is improving, which means your notes are forming better connections over time.'
  }

  if (lower.includes('mcp') || lower.includes('server')) {
    return 'The MCP Server allows AI assistants like Claude and Cursor to directly access your Memorix memory. It runs as a standalone process communicating via stdio with JSON-RPC 2.0. Eight tools are available including search, add_note, get_note, list_notes, chat, get_related, detect_patterns, and add_decision. This means your AI assistant can seamlessly query and update your memory without leaving their workflow.'
  }

  return `That's a great question about "${query.slice(0, 50)}". Based on your stored memories, I can see connections to several of your notes. The memory system is designed to surface relevant context automatically — when you ask questions, it searches your notes using semantic similarity and injects the most relevant ones into my response context. This ensures I always have access to your knowledge when helping you.`
}
