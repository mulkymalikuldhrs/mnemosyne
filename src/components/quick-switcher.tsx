'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, GitBranch, MessageSquare, Search, ArrowRight, Loader2, Clock
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/store'

interface SwitcherItem {
  id: string
  title: string
  type: 'note' | 'conversation' | 'decision'
  snippet?: string
  updatedAt?: string
}

type ItemCategory = 'note' | 'conversation' | 'decision'

const CATEGORY_META: Record<ItemCategory, { icon: React.ElementType; label: string; color: string; section: string }> = {
  note: { icon: FileText, label: 'Notes', color: 'text-violet-500', section: 'notes' },
  conversation: { icon: MessageSquare, label: 'Conversations', color: 'text-emerald-500', section: 'chat' },
  decision: { icon: GitBranch, label: 'Decisions', color: 'text-amber-500', section: 'decisions' },
}

// Simple fuzzy match: checks if all chars in query appear in order in the text
function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti)
    if (idx === -1) return false
    ti = idx + 1
  }
  return true
}

// Score a fuzzy match (higher = better)
function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  // Exact match gets highest score
  if (t === q) return 1000
  // Starts with query gets high score
  if (t.startsWith(q)) return 500
  // Contains query gets medium score
  if (t.includes(q)) return 200
  // Fuzzy match gets lower score
  let score = 0
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti)
    if (idx === -1) return 0
    // Bonus for consecutive characters
    if (idx === ti) score += 10
    score += 1
    ti = idx + 1
  }
  return score
}

export function QuickSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SwitcherItem[]>([])
  const [recentItems, setRecentItems] = useState<SwitcherItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { setActiveSection } = useUIStore()

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        setQuery('')
        setSelectedIndex(0)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Fetch recent items on open
  useEffect(() => {
    if (!isOpen) return
    const fetchRecent = async () => {
      try {
        const [notesRes, decisionsRes, convsRes] = await Promise.all([
          api.getNotes('limit=5&sort=updatedAt'),
          api.getDecisions('limit=3'),
          api.getConversations(),
        ])

        const recent: SwitcherItem[] = []

        if (notesRes.success && notesRes.data?.notes) {
          for (const note of notesRes.data.notes) {
            recent.push({
              id: note.id,
              title: note.title,
              type: 'note',
              snippet: note.content ? note.content.slice(0, 80) : undefined,
              updatedAt: note.updatedAt,
            })
          }
        }

        if (convsRes.success && convsRes.data?.conversations) {
          for (const conv of convsRes.data.conversations.slice(0, 3)) {
            recent.push({
              id: conv.id,
              title: conv.title || 'Untitled Conversation',
              type: 'conversation',
              snippet: `${conv.messageCount || 0} messages`,
              updatedAt: conv.lastMessageAt,
            })
          }
        }

        if (decisionsRes.success && decisionsRes.data?.decisions) {
          for (const decision of decisionsRes.data.decisions) {
            recent.push({
              id: decision.id,
              title: decision.title,
              type: 'decision',
              snippet: decision.status,
              updatedAt: decision.createdAt,
            })
          }
        }

        // Sort by updatedAt descending
        recent.sort((a, b) => {
          if (!a.updatedAt || !b.updatedAt) return 0
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })

        setRecentItems(recent)
      } catch (err) {
        console.error('Failed to fetch recent items:', err)
      }
    }
    fetchRecent()
  }, [isOpen])

  // Fetch items when query changes
  useEffect(() => {
    if (!isOpen) return
    if (!query.trim()) {
      setItems(recentItems)
      setSelectedIndex(0)
      return
    }

    const fetchItems = async () => {
      setIsLoading(true)
      try {
        const [notesRes, decisionsRes, convsRes] = await Promise.all([
          api.getNotes(query ? `search=${encodeURIComponent(query)}&limit=10` : 'limit=10'),
          api.getDecisions(query ? `search=${encodeURIComponent(query)}&limit=5` : 'limit=5'),
          api.getConversations(),
        ])

        const newItems: SwitcherItem[] = []

        if (notesRes.success && notesRes.data?.notes) {
          for (const note of notesRes.data.notes) {
            newItems.push({
              id: note.id,
              title: note.title,
              type: 'note',
              snippet: note.content ? note.content.slice(0, 80) : undefined,
              updatedAt: note.updatedAt,
            })
          }
        }

        if (convsRes.success && convsRes.data?.conversations) {
          const q = query.toLowerCase()
          const filteredConvs = convsRes.data.conversations.filter((c: any) =>
            fuzzyMatch(c.title || '', q)
          )
          for (const conv of filteredConvs.slice(0, 5)) {
            newItems.push({
              id: conv.id,
              title: conv.title || 'Untitled Conversation',
              type: 'conversation',
              snippet: `${conv.messageCount || 0} messages`,
              updatedAt: conv.lastMessageAt,
            })
          }
        }

        if (decisionsRes.success && decisionsRes.data?.decisions) {
          for (const decision of decisionsRes.data.decisions) {
            newItems.push({
              id: decision.id,
              title: decision.title,
              type: 'decision',
              snippet: decision.status,
              updatedAt: decision.createdAt,
            })
          }
        }

        // Apply fuzzy scoring and sort
        if (query.trim()) {
          newItems.sort((a, b) => {
            const scoreA = fuzzyScore(a.title, query)
            const scoreB = fuzzyScore(b.title, query)
            return scoreB - scoreA
          })
          // Filter out zero-score items
          const filtered = newItems.filter((item) => fuzzyScore(item.title, query) > 0)
          setItems(filtered)
        } else {
          setItems(newItems)
        }

        setSelectedIndex(0)
      } catch (err) {
        console.error('Failed to fetch items:', err)
      } finally {
        setIsLoading(false)
      }
    }

    const timeout = setTimeout(fetchItems, 150)
    return () => clearTimeout(timeout)
  }, [query, isOpen, recentItems])

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: { category: ItemCategory; items: SwitcherItem[] }[] = []
    const categoryOrder: ItemCategory[] = ['note', 'conversation', 'decision']

    for (const cat of categoryOrder) {
      const catItems = items.filter((item) => item.type === cat)
      if (catItems.length > 0) {
        groups.push({ category: cat, items: catItems })
      }
    }

    return groups
  }, [items])

  // Flat list for index tracking
  const flatItems = useMemo(() => items, [items])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault()
      handleSelect(flatItems[selectedIndex])
    }
  }, [flatItems, selectedIndex])

  const handleSelect = (item: SwitcherItem) => {
    setIsOpen(false)
    const meta = CATEGORY_META[item.type]
    if (meta) {
      setActiveSection(meta.section as any)
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-0 top-[15%] z-50 mx-auto w-full max-w-lg"
          >
            <div className="mx-4 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  ref={inputRef}
                  placeholder="Search notes, decisions, conversations..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border-0 px-0 h-auto py-0 focus-visible:ring-0 bg-transparent text-sm placeholder:text-muted-foreground/50"
                />
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
                <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-muted text-muted-foreground shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-y-auto">
                {!query.trim() && recentItems.length > 0 && (
                  <div className="px-4 pt-2 pb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    <Clock className="w-3 h-3" />
                    Recent
                  </div>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : flatItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {query ? 'No results found' : 'Start typing to search...'}
                  </div>
                ) : query.trim() ? (
                  // Grouped results for search mode
                  <div className="py-1">
                    {groupedItems.map((group) => {
                      const meta = CATEGORY_META[group.category]
                      const Icon = meta.icon
                      let globalIdx = flatItems.indexOf(group.items[0])

                      return (
                        <div key={group.category}>
                          <div className="px-4 pt-2 pb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                            <Icon className={cn('w-3 h-3', meta.color)} />
                            {meta.label}
                          </div>
                          {group.items.map((item) => {
                            const idx = flatItems.indexOf(item)
                            return (
                              <button
                                key={`${item.type}-${item.id}`}
                                data-index={idx}
                                className={cn(
                                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                  idx === selectedIndex && 'bg-accent/50',
                                  idx !== selectedIndex && 'hover:bg-accent/30',
                                )}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                              >
                                <Icon className={cn('w-4 h-4 shrink-0', meta.color)} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.title}</p>
                                  {item.snippet && (
                                    <p className="text-[10px] text-muted-foreground truncate">{item.snippet}</p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                  {item.type}
                                </Badge>
                                {idx === selectedIndex && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Recent items (flat list)
                  <div className="py-1">
                    {flatItems.map((item, index) => {
                      const meta = CATEGORY_META[item.type]
                      const Icon = meta.icon
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          data-index={index}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            index === selectedIndex && 'bg-accent/50',
                            index !== selectedIndex && 'hover:bg-accent/30',
                          )}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(index)}
                        >
                          <Icon className={cn('w-4 h-4 shrink-0', meta.color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.snippet && (
                              <p className="text-[10px] text-muted-foreground truncate">{item.snippet}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                            {item.type}
                          </Badge>
                          {index === selectedIndex && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>↑↓ Navigate</span>
                  <span>↵ Open</span>
                  <span>Esc Close</span>
                </div>
                <span>⌘K to toggle</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
