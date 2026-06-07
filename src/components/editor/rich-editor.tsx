'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, Link as LinkIcon,
  Undo, Redo, Eye, EyeOff, Type, Highlighter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── HTML Sanitizer ──────────────────────────────────────────────────────────
// Strips dangerous tags and event handlers from HTML to prevent XSS.
// This is used before rendering user-generated HTML in the preview pane.

const DANGEROUS_TAGS = /<\/?(script|iframe|object|embed|form|input|textarea|select|button|meta|link|base|style)[^>]*>/gi
const EVENT_HANDLERS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JAVASCRIPT_HREF = /href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi
const DATA_URL_SRC = /src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi

function sanitizeHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAGS, '')
    .replace(EVENT_HANDLERS, '')
    .replace(JAVASCRIPT_HREF, 'href="#"')
    .replace(DATA_URL_SRC, '')
}

// WikiLink extension — recognizes [[text]] syntax
import { Mark, markInputRule, markPasteRule } from '@tiptap/core'

const WikiLinkInputRegex = /\[\[([^\]]+)\]\]$/
const WikiLinkPasteRegex = /\[\[([^\]]+)\]\]/g

export interface WikiLinkSuggestion {
  id: string
  title: string
}

// Toolbar Button Component (outside render to satisfy hooks rules)
function ToolbarButton({
  onClick, isActive, icon: Icon, label
}: { onClick: () => void; isActive?: boolean; icon: React.ElementType; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', isActive && 'bg-primary/10 text-primary')}
      onClick={onClick}
      title={label}
    >
      <Icon className="w-3.5 h-3.5" />
    </Button>
  )
}

interface RichEditorProps {
  content: string
  onChange: (content: string) => void
  onWikiLinkSearch?: (query: string) => Promise<WikiLinkSuggestion[]>
  onWikiLinkClick?: (noteId: string) => void
  placeholder?: string
  className?: string
}

// Create WikiLink Mark extension
const WikiLinkExtension = Mark.create({
  name: 'wikiLink',

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', {
      ...HTMLAttributes,
      'data-wiki-link': '',
      class: 'wiki-link',
      style: 'color: #8b5cf6; text-decoration: underline; cursor: pointer; background: rgba(139, 92, 246, 0.1); padding: 0 2px; border-radius: 2px;',
    }, 0]
  },

  addInputRules() {
    return [
      markInputRule({
        find: WikiLinkInputRegex,
        type: this.type,
        getAttributes: (match) => ({ title: match[1] }),
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: WikiLinkPasteRegex,
        type: this.type,
        getAttributes: (match) => ({ title: match[1] }),
      }),
    ]
  },
})

export function RichEditor({
  content,
  onChange,
  onWikiLinkSearch,
  onWikiLinkClick,
  placeholder = 'Start writing... Use [[ for wiki-links, / for commands',
  className,
}: RichEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [wikiLinkQuery, setWikiLinkQuery] = useState('')
  const [wikiLinkSuggestions, setWikiLinkSuggestions] = useState<WikiLinkSuggestion[]>([])
  const [showWikiLinkDropdown, setShowWikiLinkDropdown] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
      Placeholder.configure({ placeholder }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      WikiLinkExtension,
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)

      // Word count
      const text = editor.getText()
      setWordCount(text.split(/\s+/).filter(Boolean).length)

      // Check for wiki-link typing
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - 30),
        from,
        '\n'
      )
      const wikiMatch = textBefore.match(/\[\[([^\]]*?)$/)
      if (wikiMatch) {
        setWikiLinkQuery(wikiMatch[1])
        setShowWikiLinkDropdown(true)
        handleWikiLinkSearch(wikiMatch[1])
      } else {
        setShowWikiLinkDropdown(false)
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-1',
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement
        if (target.closest('[data-wiki-link]')) {
          const title = target.getAttribute('title') || target.textContent?.replace(/[\[\]]/g, '')
          if (title && onWikiLinkClick) {
            // In real usage, we'd resolve title to noteId
            onWikiLinkClick(title)
          }
        }
      },
    },
  })

  const handleWikiLinkSearch = useCallback(async (query: string) => {
    if (onWikiLinkSearch && query.length > 0) {
      try {
        const results = await onWikiLinkSearch(query)
        setWikiLinkSuggestions(results)
      } catch {
        setWikiLinkSuggestions([])
      }
    } else {
      setWikiLinkSuggestions([])
    }
  }, [onWikiLinkSearch])

  const insertWikiLink = useCallback((title: string) => {
    if (!editor) return
    const { from } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(
      Math.max(0, from - 30),
      from,
      '\n'
    )
    const wikiMatch = textBefore.match(/\[\[([^\]]*?)$/)
    if (wikiMatch) {
      const matchStart = from - wikiMatch[0].length
      editor.chain().focus()
        .deleteRange({ from: matchStart, to: from })
        .insertContent(`[[${title}]] `)
        .run()
    }
    setShowWikiLinkDropdown(false)
  }, [editor])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowWikiLinkDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) return null

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border flex-wrap">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} icon={Undo} label="Undo" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} icon={Redo} label="Redo" />
        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} icon={Heading1} label="Heading 1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} icon={Heading2} label="Heading 2" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} icon={Heading3} label="Heading 3" />
        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={Bold} label="Bold" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={Italic} label="Italic" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon={Strikethrough} label="Strikethrough" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} icon={Highlighter} label="Highlight" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} icon={Code} label="Code" />
        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} icon={List} label="Bullet List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} icon={ListOrdered} label="Ordered List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} icon={CheckSquare} label="Task List" />
        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} icon={Quote} label="Quote" />
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} label="Horizontal Rule" />

        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{wordCount} words</span>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', showPreview && 'bg-primary/10 text-primary')}
            onClick={() => setShowPreview(!showPreview)}
            title="Toggle preview"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 overflow-y-auto relative">
        {!showPreview ? (
          <div className="p-4 relative">
            <EditorContent editor={editor} />

            {/* Wiki-link autocomplete dropdown */}
            {showWikiLinkDropdown && wikiLinkSuggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
              >
                <div className="p-1.5 text-[10px] text-muted-foreground border-b border-border">
                  Link to note...
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {wikiLinkSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2"
                      onClick={() => insertWikiLink(suggestion.title)}
                    >
                      <Type className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{suggestion.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="p-4 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(editor.getHTML()) }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        <span>Type [[ for wiki-links</span>
        <span>•</span>
        <span>{wordCount} words</span>
        <span>•</span>
        <span>{editor.getText().length} characters</span>
      </div>

      <style jsx global>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted-foreground);
          pointer-events: none;
          height: 0;
          opacity: 0.5;
        }
        .ProseMirror .wiki-link {
          color: #8b5cf6;
          text-decoration: underline;
          cursor: pointer;
          background: rgba(139, 92, 246, 0.1);
          padding: 0 2px;
          border-radius: 2px;
        }
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .ProseMirror ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  )
}
