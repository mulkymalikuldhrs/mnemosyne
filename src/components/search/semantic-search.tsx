'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, Sparkles, Tag, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useNotesStore, type Note } from '@/lib/store'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

export function SemanticSearch() {
  const { notes, setSelectedNoteId, setIsEditing } = useNotesStore()
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [notes])

  // Search results
  const searchResults = useMemo(() => {
    if (!query && selectedTags.length === 0) return []

    const q = query.toLowerCase()
    return notes
      .filter((n) => !n.isArchived)
      .map((note) => {
        let score = 0

        // Title match (highest weight)
        if (note.title.toLowerCase().includes(q)) score += 0.4

        // Content match
        if (note.content.toLowerCase().includes(q)) score += 0.3

        // Tag match
        const tagMatch = note.tags.some((t) => t.toLowerCase().includes(q))
        if (tagMatch) score += 0.2

        // Selected tag filter bonus
        if (selectedTags.length > 0) {
          const hasSelectedTag = selectedTags.some((st) =>
            note.tags.map((t) => t.toLowerCase()).includes(st.toLowerCase())
          )
          if (!hasSelectedTag) return null
          score += 0.3
        }

        // Word-level overlap
        if (q) {
          const queryWords = q.split(/\s+/).filter(Boolean)
          const noteWords = (note.title + ' ' + note.content).toLowerCase().split(/\s+/)
          const overlap = queryWords.filter((qw) => noteWords.some((nw) => nw.includes(qw)))
          score += (overlap.length / Math.max(queryWords.length, 1)) * 0.2
        }

        return { ...note, relationScore: Math.min(score, 1) }
      })
      .filter((n): n is Note & { relationScore: number } => n !== null && n.relationScore > 0)
      .sort((a, b) => b.relationScore - a.relationScore)
  }, [query, selectedTags, notes])

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  const handleNoteClick = (noteId: string) => {
    setSelectedNoteId(noteId)
    setIsEditing(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your memories semantically..."
            className="pl-9 h-10 bg-muted/50 border-0 text-base"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Sparkles className="w-4 h-4 text-primary/50" />
          </div>
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button key={tag} onClick={() => toggleTag(tag)}>
              <Badge
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className={cn(
                  'text-xs cursor-pointer transition-colors',
                  selectedTags.includes(tag)
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                <Tag className="w-2.5 h-2.5 mr-1" />
                {tag}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {!query && selectedTags.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">Semantic Search</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Type a query to search across all your notes, or use tag filters to narrow results
            </p>
          </motion.div>
        ) : searchResults.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No results found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Try different keywords or remove some tag filters
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            <p className="text-xs text-muted-foreground mb-4">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </p>
            <AnimatePresence mode="popLayout">
              {searchResults.map((note, i) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className="cursor-pointer group hover:shadow-md hover:border-primary/30 transition-all"
                    onClick={() => handleNoteClick(note.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                            {note.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {note.content}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {note.tags.slice(0, 4).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1.5">
                                {tag}
                              </Badge>
                            ))}
                            <span className="text-[10px] text-muted-foreground/70 ml-auto">
                              {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-medium text-primary">
                            {Math.round(note.relationScore * 100)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">relevance</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
