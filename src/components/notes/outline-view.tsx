'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { List, ChevronRight, ChevronDown, Heading1, Heading2, Heading3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Heading {
  level: number
  text: string
  id: string
  index: number
  children: Heading[]
}

interface FlatHeading {
  level: number
  text: string
  id: string
  index: number
}

interface OutlineViewProps {
  content: string
  onHeadingClick?: (headingIndex: number) => void
}

function buildHeadingTree(flat: FlatHeading[]): Heading[] {
  const root: Heading[] = []
  const stack: Heading[] = []

  for (const h of flat) {
    const node: Heading = { ...h, children: [] }

    // Find parent: pop stack until we find a heading with lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop()
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node)
    } else {
      root.push(node)
    }

    stack.push(node)
  }

  return root
}

function HeadingNode({
  heading,
  activeHeadingIndex,
  onHeadingClick,
  collapsedIds,
  toggleCollapse,
  depth = 0,
}: {
  heading: Heading
  activeHeadingIndex: number | null
  onHeadingClick: (index: number) => void
  collapsedIds: Set<string>
  toggleCollapse: (id: string) => void
  depth?: number
}) {
  const isCollapsed = collapsedIds.has(heading.id)
  const isActive = activeHeadingIndex === heading.index
  const hasChildren = heading.children.length > 0

  const headingIcons: Record<number, React.ElementType> = {
    1: Heading1,
    2: Heading2,
    3: Heading3,
  }
  const Icon = headingIcons[heading.level] || Heading2

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 text-xs py-1 px-2 rounded transition-colors hover:bg-accent/50 cursor-pointer group',
          depth === 0 && 'pl-2',
          depth === 1 && 'pl-4',
          depth === 2 && 'pl-6',
          isActive && 'bg-primary/10 text-primary font-medium',
        )}
      >
        {hasChildren ? (
          <button
            className="w-3.5 h-3.5 shrink-0 flex items-center justify-center rounded hover:bg-accent/50"
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse(heading.id)
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        <span
          className="truncate"
          onClick={() => onHeadingClick(heading.index)}
        >
          {heading.text}
        </span>
      </div>

      {/* Children (collapsible) */}
      {hasChildren && !isCollapsed && (
        <AnimatePresence initial={false}>
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {heading.children.map((child) => (
              <HeadingNode
                key={child.id}
                heading={child}
                activeHeadingIndex={activeHeadingIndex}
                onHeadingClick={onHeadingClick}
                collapsedIds={collapsedIds}
                toggleCollapse={toggleCollapse}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

export function OutlineView({ content, onHeadingClick }: OutlineViewProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const headings = useMemo(() => {
    const lines = content.split('\n')
    const result: FlatHeading[] = []
    let counter = 0

    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+)/)
      if (match) {
        counter++
        result.push({
          level: match[1].length,
          text: match[2].replace(/[*_`~]/g, '').trim(),
          id: `heading-${counter}`,
          index: counter - 1,
        })
      }
    }
    return result
  }, [content])

  const headingTree = useMemo(() => buildHeadingTree(headings), [headings])

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleHeadingClick = (index: number) => {
    setActiveHeadingIndex(index)
    onHeadingClick?.(index)
  }

  if (headings.length === 0) return null

  return (
    <div className="border-t border-border">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <List className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-medium">Outline</span>
          <Badge variant="secondary" className="text-[9px] h-3.5 px-1.5">
            {headings.length}
          </Badge>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 max-h-52 overflow-y-auto">
              <nav className="space-y-0.5">
                {headingTree.map((heading) => (
                  <HeadingNode
                    key={heading.id}
                    heading={heading}
                    activeHeadingIndex={activeHeadingIndex}
                    onHeadingClick={handleHeadingClick}
                    collapsedIds={collapsedIds}
                    toggleCollapse={toggleCollapse}
                  />
                ))}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
