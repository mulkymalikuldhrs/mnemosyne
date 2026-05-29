'use client'

import { motion } from 'framer-motion'
import { Clock, Tag, Link2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { Note } from '@/lib/store'

interface NoteCardProps {
  note: Note
  onClick?: () => void
  compact?: boolean
  showRelationScore?: boolean
}

export function NoteCard({ note, onClick, compact = false, showRelationScore }: NoteCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -2 }}
    >
      <Card
        className={cn(
          'cursor-pointer group transition-all duration-200 hover:shadow-md hover:border-primary/30',
          compact && 'py-0'
        )}
        onClick={onClick}
      >
        <CardContent className={cn('p-4', compact && 'p-3')}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {note.title}
            </h3>
            {showRelationScore && note.relationScore !== undefined && (
              <div className="flex items-center gap-1 shrink-0 text-xs text-primary">
                <Link2 className="w-3 h-3" />
                {Math.round(note.relationScore * 100)}%
              </div>
            )}
          </div>

          {!compact && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {note.content}
            </p>
          )}

          <div className="flex items-center justify-between mt-3 gap-2">
            <div className="flex flex-wrap gap-1 overflow-hidden">
              {note.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 font-normal"
                >
                  <Tag className="w-2.5 h-2.5 mr-0.5" />
                  {tag}
                </Badge>
              ))}
              {note.tags.length > 3 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                  +{note.tags.length - 3}
                </Badge>
              )}
            </div>

            <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
