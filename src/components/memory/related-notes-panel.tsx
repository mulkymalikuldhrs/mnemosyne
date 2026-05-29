'use client'

import { Link2, Sparkles, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNotesStore, type Note } from '@/lib/store'
import { cn } from '@/lib/utils'

interface RelatedNotesPanelProps {
  currentNoteId?: string
  onNoteClick?: (noteId: string) => void
  className?: string
}

export function RelatedNotesPanel({ currentNoteId, onNoteClick, className }: RelatedNotesPanelProps) {
  const { notes } = useNotesStore()

  const currentNote = currentNoteId ? notes.find((n) => n.id === currentNoteId) : null

  // Find related notes based on tag overlap
  const relatedNotes = currentNote
    ? notes
        .filter((n) => n.id !== currentNoteId && !n.isArchived)
        .map((n) => {
          const sharedTags = n.tags.filter((t) =>
            currentNote.tags.map((ct) => ct.toLowerCase()).includes(t.toLowerCase())
          )
          const score = sharedTags.length / Math.max(currentNote.tags.length, 1)
          return { ...n, relationScore: score, sharedTags }
        })
        .filter((n) => n.relationScore > 0)
        .sort((a, b) => b.relationScore - a.relationScore)
        .slice(0, 5)
    : notes
        .slice(0, 5)
        .map((n) => ({ ...n, relationScore: 0.5, sharedTags: [] as string[] }))

  const getRelationReason = (note: Note & { sharedTags: string[] }, current: typeof currentNote) => {
    if (note.sharedTags.length > 0) {
      return `Shares tags: ${note.sharedTags.join(', ')}`
    }
    return 'Related by content similarity'
  }

  return (
    <Card className={cn('border-0', className)}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          {currentNote ? 'Related Notes' : 'Recent Notes'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {relatedNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No related notes found
          </p>
        ) : (
          <div className="space-y-2">
            {relatedNotes.map((note, i) => (
              <motion.button
                key={note.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onNoteClick?.(note.id)}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 hover:border-primary/20 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                    {note.title}
                  </p>
                  {note.relationScore > 0 && (
                    <div className="flex items-center gap-1 shrink-0 text-xs text-primary">
                      <Link2 className="w-3 h-3" />
                      {Math.round(note.relationScore * 100)}%
                    </div>
                  )}
                </div>

                {currentNote && 'sharedTags' in note && (note as { sharedTags: string[] }).sharedTags.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {getRelationReason(note as Note & { sharedTags: string[] }, currentNote)}
                  </p>
                )}

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex gap-1">
                    {note.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] h-4 px-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
