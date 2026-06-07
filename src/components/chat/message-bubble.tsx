'use client'

import { memo } from 'react'
import { Brain, User, Link2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { Message } from '@/lib/store'

interface MessageBubbleProps {
  message: Message
  onMemoryRefClick?: (noteId: string) => void
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onMemoryRefClick,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3 max-w-[85%] md:max-w-[75%]', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
        )}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-1.5">
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border rounded-bl-md'
          )}
        >
          {message.content}
        </div>

        {/* Memory References */}
        {!isUser && message.memoryReferences && message.memoryReferences.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.memoryReferences.map((ref) => (
              <button key={ref.noteId} onClick={() => onMemoryRefClick?.(ref.noteId)}>
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 px-2 cursor-pointer hover:bg-accent transition-colors gap-1"
                >
                  <Link2 className="w-2.5 h-2.5" />
                  {ref.noteTitle}
                  <span className="text-primary/70">{Math.round(ref.relevance * 100)}%</span>
                </Badge>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground/60 px-1">
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </span>
      </div>
    </motion.div>
  )
})
