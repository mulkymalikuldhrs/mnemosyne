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
import { api } from '@/lib/api'

export function ChatPanel() {
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    addMessage,
    setMessages,
    isLoading,
    setIsLoading,
    addConversation,
    setConversations,
    resetChat,
  } = useChatStore()

  const { notes } = useNotesStore()
  const [input, setInput] = useState('')
  const [showConvSelector, setShowConvSelector] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentConversation = conversations.find((c) => c.id === currentConversationId)

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.getConversations()
        if (res.success && res.data?.conversations) {
          const mapped = res.data.conversations.map((c: any) => ({
            id: c.id,
            title: c.title,
            lastMessageAt: c.updatedAt,
            messageCount: c._count?.messages ?? 0,
          }))
          setConversations(mapped)
        }
      } catch (err) {
        console.error('Failed to fetch conversations:', err)
      }
    }
    fetchConversations()
  }, [setConversations])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    addMessage(userMessage)
    const messageText = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      const res = await api.sendMessage(messageText, currentConversationId || undefined)

      if (res.success && res.data) {
        // Store conversation ID from API response
        const convId = res.data.conversationId
        if (convId && !currentConversationId) {
          setCurrentConversationId(convId)
          // Add the new conversation to the list
          addConversation({
            id: convId,
            title: messageText.slice(0, 40) + (messageText.length > 40 ? '...' : ''),
            lastMessageAt: new Date().toISOString(),
            messageCount: 1,
          })
        }

        // Map memory references from API response
        const memoryRefs = res.data.memoryRefs?.map((ref: any) => ({
          noteId: ref.noteId || ref.id,
          noteTitle: ref.noteTitle || ref.title || 'Related Note',
          relevance: ref.relevance || ref.score || 0.5,
        })) || []

        const aiMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant' as const,
          content: res.data.response || 'I couldn\'t generate a response.',
          timestamp: new Date().toISOString(),
          memoryReferences: memoryRefs,
        }
        addMessage(aiMessage)
      } else {
        const errorMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant' as const,
          content: `Sorry, I encountered an error: ${res.error || 'Unknown error'}. Please try again.`,
          timestamp: new Date().toISOString(),
        }
        addMessage(errorMessage)
      }
    } catch {
      const errorMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: 'Sorry, I couldn\'t connect to the memory service. Please try again.',
        timestamp: new Date().toISOString(),
      }
      addMessage(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    resetChat()
  }

  const handleMemoryRefClick = (noteId: string) => {
    // Navigate to the note in the notes section
    const { setSelectedNoteId, setIsEditing } = useNotesStore.getState()
    setSelectedNoteId(noteId)
    setIsEditing(true)
  }

  const handleSelectConversation = async (convId: string) => {
    setCurrentConversationId(convId)
    setShowConvSelector(false)
    // Load messages for this conversation
    try {
      const res = await api.getConversation(convId)
      if (res.success && res.data?.messages) {
        const mapped = res.data.messages.map((m: any) => ({
          id: m.id,
          role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: m.createdAt,
          memoryReferences: [], // TODO: parse memoryRefs from JSON
        }))
        setMessages(mapped)
      }
    } catch (err) {
      console.error('Failed to load conversation messages:', err)
    }
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
                {currentConversation?.title ?? 'New conversation'}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </Button>
            {showConvSelector && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg z-50">
                {conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors"
                    >
                      {conv.title}
                    </button>
                  ))
                )}
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
          Mnemosyne uses your stored memories to provide contextual responses
        </p>
      </div>
    </div>
  )
}
