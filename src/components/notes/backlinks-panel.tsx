'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Link2, GitBranch, Loader2, ExternalLink, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface WikiBacklink {
  sourceNoteId: string
  sourceNoteTitle: string
  linkText: string
  context: string
}

interface MemoryBacklink {
  sourceNoteId: string
  sourceNoteTitle: string
  relationScore: number
  reason: string
}

interface BacklinkData {
  wikiLinks: WikiBacklink[]
  memoryLinks: MemoryBacklink[]
}

interface BacklinksPanelProps {
  noteId: string
  onNavigateToNote?: (noteId: string) => void
}

export function BacklinksPanel({ noteId, onNavigateToNote }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<BacklinkData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const fetchBacklinks = async () => {
      setIsLoading(true)
      try {
        const res = await api.getBacklinks(noteId)
        if (res.success && res.data) {
          setBacklinks(res.data)
        }
      } catch (err) {
        console.error('Failed to fetch backlinks:', err)
      } finally {
        setIsLoading(false)
      }
    }
    if (noteId) {
      fetchBacklinks()
    }
  }, [noteId])

  const wikiCount = backlinks?.wikiLinks.length || 0
  const memoryCount = backlinks?.memoryLinks.length || 0
  const totalLinks = wikiCount + memoryCount

  return (
    <div className="border-t border-border">
      {/* Header with count badge */}
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-medium">Backlinks</span>
          {totalLinks > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {totalLinks}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {wikiCount > 0 && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-violet-500 border-violet-500/20">
              {wikiCount} wiki
            </Badge>
          )}
          {memoryCount > 0 && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-emerald-500 border-emerald-500/20">
              {memoryCount} memory
            </Badge>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.15 }}
          >
            <ArrowLeft className="w-3 h-3 text-muted-foreground" />
          </motion.div>
        </div>
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
            <div className="px-4 pb-3 space-y-3 max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : totalLinks === 0 ? (
                /* Empty state */
                <div className="text-center py-4">
                  <Link2 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No backlinks yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Use [[wiki-links]] to connect notes
                  </p>
                </div>
              ) : (
                <>
                  {/* Wiki Links Section */}
                  {backlinks!.wikiLinks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                        <Link2 className="w-3 h-3 text-violet-500" />
                        Wiki Links
                        <Badge variant="outline" className="text-[9px] h-3 px-1 ml-1 text-violet-500 border-violet-500/20">
                          {wikiCount}
                        </Badge>
                      </h4>
                      {backlinks!.wikiLinks.map((link, i) => (
                        <button
                          key={`wiki-${i}`}
                          className="w-full text-left p-2.5 rounded-lg border border-border hover:bg-accent/30 transition-colors group"
                          onClick={() => onNavigateToNote?.(link.sourceNoteId)}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileText className="w-3 h-3 text-violet-500 shrink-0" />
                            <span className="text-xs font-medium truncate">{link.sourceNoteTitle}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {link.context && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 pl-[18px] italic">
                              &ldquo;{link.context}&rdquo;
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Memory Links Section */}
                  {backlinks!.memoryLinks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-emerald-500" />
                        Memory Links
                        <Badge variant="outline" className="text-[9px] h-3 px-1 ml-1 text-emerald-500 border-emerald-500/20">
                          {memoryCount}
                        </Badge>
                      </h4>
                      {backlinks!.memoryLinks.map((link, i) => (
                        <button
                          key={`memory-${i}`}
                          className="w-full text-left p-2.5 rounded-lg border border-border hover:bg-accent/30 transition-colors group"
                          onClick={() => onNavigateToNote?.(link.sourceNoteId)}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <GitBranch className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-xs font-medium truncate">{link.sourceNoteTitle}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] h-3.5 px-1 ml-auto shrink-0',
                                link.relationScore >= 0.7
                                  ? 'text-emerald-500 border-emerald-500/20'
                                  : link.relationScore >= 0.4
                                    ? 'text-amber-500 border-amber-500/20'
                                    : 'text-rose-500 border-rose-500/20'
                              )}
                            >
                              {Math.round(link.relationScore * 100)}%
                            </Badge>
                          </div>
                          {link.reason && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 pl-[18px]">
                              {link.reason}
                            </p>
                          )}
                          <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0 ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
