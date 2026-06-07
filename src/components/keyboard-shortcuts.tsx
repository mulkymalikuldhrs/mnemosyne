'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, X, Search, FileText, Save, Sparkles } from 'lucide-react'
import { useUIStore, useNotesStore } from '@/lib/store'

interface ShortcutItem {
  keys: string[]
  label: string
  description: string
  icon: React.ElementType
  category: string
}

const SHORTCUTS: ShortcutItem[] = [
  {
    keys: ['⌘', 'K'],
    label: 'Quick Switcher',
    description: 'Search and navigate to any note, conversation, or decision',
    icon: Search,
    category: 'Navigation',
  },
  {
    keys: ['⌘', 'N'],
    label: 'New Note',
    description: 'Create a new note and start editing immediately',
    icon: FileText,
    category: 'Notes',
  },
  {
    keys: ['⌘', 'S'],
    label: 'Save Note',
    description: 'Save the currently open note',
    icon: Save,
    category: 'Notes',
  },
  {
    keys: ['⌘', '/'],
    label: 'Search',
    description: 'Open semantic search to find anything in your memory',
    icon: Search,
    category: 'Navigation',
  },
  {
    keys: ['?'],
    label: 'Keyboard Shortcuts',
    description: 'Show this keyboard shortcuts panel',
    icon: Keyboard,
    category: 'Help',
  },
  {
    keys: ['⌘', '⇧', 'F'],
    label: 'Semantic Search',
    description: 'Advanced AI-powered semantic search across all memories',
    icon: Sparkles,
    category: 'Search',
  },
  {
    keys: ['Esc'],
    label: 'Close / Cancel',
    description: 'Close dialogs, panels, and overlays',
    icon: X,
    category: 'General',
  },
]

function isAppleDevice() {
  if (typeof navigator === 'undefined') return true
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
}

export function KeyboardShortcutsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const { setActiveSection } = useUIStore()
  const { setSelectedNoteId, setIsEditing } = useNotesStore()
  const isApple = isAppleDevice()

  const mod = isApple ? '⌘' : 'Ctrl'
  const shift = isApple ? '⇧' : 'Shift'

  // Replace placeholder keys with platform-specific ones
  const getDisplayKeys = (keys: string[]) => {
    return keys.map((k) => {
      if (k === '⌘') return mod
      if (k === '⇧') return shift
      return k
    })
  }

  // Global keyboard shortcuts handler
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput = target.closest('input, textarea, [contenteditable]')

    // ? to show shortcuts (only when not in an input)
    if (e.key === '?' && !isInput) {
      e.preventDefault()
      setIsOpen((prev) => !prev)
      return
    }

    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault()
      setIsOpen(false)
      return
    }

    // Cmd/Ctrl + N: New note
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault()
      setSelectedNoteId(null)
      setIsEditing(true)
      setActiveSection('notes')
      return
    }

    // Cmd/Ctrl + S: Save current note (dispatch custom event)
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      // Dispatch a custom event that note-editor can listen to
      window.dispatchEvent(new CustomEvent('memorix:save'))
      return
    }

    // Cmd/Ctrl + /: Search
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault()
      setActiveSection('search')
      return
    }

    // Cmd/Ctrl + Shift + F: Semantic search
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      setActiveSection('search')
      return
    }
  }, [isOpen, setActiveSection, setSelectedNoteId, setIsEditing])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // Group shortcuts by category
  const categories = SHORTCUTS.reduce<Record<string, ShortcutItem[]>>((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = []
    acc[shortcut.category].push(shortcut)
    return acc
  }, {})

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

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-0 top-[10%] z-50 mx-auto w-full max-w-lg"
          >
            <div className="mx-4 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <Keyboard className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md hover:bg-accent transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Shortcuts List */}
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-5">
                {Object.entries(categories).map(([category, shortcuts]) => (
                  <div key={category}>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                      {category}
                    </h3>
                    <div className="space-y-1">
                      {shortcuts.map((shortcut) => {
                        const Icon = shortcut.icon
                        const displayKeys = getDisplayKeys(shortcut.keys)
                        return (
                          <div
                            key={shortcut.label}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/30 transition-colors"
                          >
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{shortcut.label}</p>
                              <p className="text-[11px] text-muted-foreground">{shortcut.description}</p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {displayKeys.map((key, i) => (
                                <kbd
                                  key={i}
                                  className="inline-flex items-center justify-center min-w-[22px] h-6 px-1.5 text-[11px] font-mono font-medium rounded border border-border bg-muted text-muted-foreground"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono">?</kbd> to toggle</span>
                <span>Better than Obsidian&apos;s command palette</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
