'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Plus, X, Loader2, Tag, Cloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TagSuggestion {
  tag: string
  confidence: number
  category?: string
}

interface TagCloudItem {
  tag: string
  count: number
  category: string
}

interface SmartTagsProps {
  content: string
  existingTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

// Category colors for tag cloud
const TAG_CATEGORY_COLORS: Record<string, string> = {
  ai: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  programming: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
  business: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  design: 'bg-pink-500/15 text-pink-600 border-pink-500/20',
  productivity: 'bg-violet-500/15 text-violet-600 border-violet-500/20',
  finance: 'bg-teal-500/15 text-teal-600 border-teal-500/20',
  health: 'bg-green-500/15 text-green-600 border-green-500/20',
  learning: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20',
  meeting: 'bg-orange-500/15 text-orange-600 border-orange-500/20',
  project: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/20',
  research: 'bg-purple-500/15 text-purple-600 border-purple-500/20',
  personal: 'bg-rose-500/15 text-rose-600 border-rose-500/20',
}

const DEFAULT_TAG_COLOR = 'bg-gray-500/15 text-gray-600 border-gray-500/20'

function getTagColor(category: string): string {
  return TAG_CATEGORY_COLORS[category.toLowerCase()] || DEFAULT_TAG_COLOR
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-emerald-500'
  if (confidence >= 0.4) return 'text-amber-500'
  return 'text-rose-500'
}

function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 0.7) return '[&>div]:bg-emerald-500'
  if (confidence >= 0.4) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-rose-500'
}

export function SmartTags({ content, existingTags, onAddTag, onRemoveTag }: SmartTagsProps) {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [tagCloud, setTagCloud] = useState<TagCloudItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCloudLoading, setIsCloudLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [showCloud, setShowCloud] = useState(false)

  // Fetch tag cloud data (all user tags with frequency)
  useEffect(() => {
    const fetchTagCloud = async () => {
      setIsCloudLoading(true)
      try {
        const res = await api.getNotes('limit=100')
        if (res.success && res.data?.notes) {
          const tagCounts = new Map<string, { count: number; category: string }>()
          for (const note of res.data.notes) {
            if (note.tags) {
              note.tags.split(',').map((t: string) => t.trim()).filter(Boolean).forEach((tag: string) => {
                const existing = tagCounts.get(tag)
                if (existing) {
                  existing.count++
                } else {
                  tagCounts.set(tag, { count: 1, category: detectCategory(tag) })
                }
              })
            }
          }
          const cloud = Array.from(tagCounts.entries())
            .map(([tag, data]) => ({ tag, ...data }))
            .sort((a, b) => b.count - a.count)
          setTagCloud(cloud)
        }
      } catch (err) {
        console.error('Failed to fetch tag cloud:', err)
      } finally {
        setIsCloudLoading(false)
      }
    }
    fetchTagCloud()
  }, [])

  // Simple category detection based on tag name
  const detectCategory = (tag: string): string => {
    const tagLower = tag.toLowerCase()
    const categoryMap: Record<string, string[]> = {
      ai: ['ai', 'ml', 'llm', 'gpt', 'neural', 'deep learning'],
      programming: ['code', 'dev', 'api', 'typescript', 'javascript', 'python', 'react', 'database'],
      business: ['business', 'startup', 'revenue', 'strategy', 'saas'],
      design: ['design', 'ui', 'ux', 'figma'],
      productivity: ['productivity', 'workflow', 'automation'],
      finance: ['trading', 'investment', 'crypto', 'stock'],
      health: ['health', 'fitness', 'exercise'],
      learning: ['learning', 'course', 'tutorial', 'book'],
      meeting: ['meeting', 'standup', 'agenda'],
      project: ['project', 'milestone', 'sprint'],
      research: ['research', 'paper', 'study'],
      personal: ['personal', 'journal', 'goal'],
    }
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some((k) => tagLower.includes(k))) {
        return category
      }
    }
    return 'general'
  }

  const generateSuggestions = useCallback(async () => {
    if (!content.trim()) return
    setIsLoading(true)
    try {
      const res = await api.generateSmartTags({ content })
      if (res.success && res.data?.suggestions) {
        // Filter out already-applied tags and add category
        const filtered = res.data.suggestions
          .filter((s: TagSuggestion) => !existingTags.includes(s.tag))
          .map((s: TagSuggestion) => ({
            ...s,
            category: s.category || detectCategory(s.tag),
          }))
        setSuggestions(filtered)
      }
    } catch (err) {
      console.error('Failed to generate tags:', err)
    } finally {
      setIsLoading(false)
    }
  }, [content, existingTags])

  const handleAddSuggestion = (suggestion: TagSuggestion) => {
    onAddTag(suggestion.tag)
    setSuggestions((prev) => prev.filter((s) => s.tag !== suggestion.tag))
    toast.success(`Added tag: ${suggestion.tag}`)
  }

  // Tag cloud sizing based on count
  const maxCount = useMemo(() => {
    if (tagCloud.length === 0) return 1
    return Math.max(...tagCloud.map((t) => t.count))
  }, [tagCloud])

  const getTagSize = (count: number): string => {
    const ratio = count / maxCount
    if (ratio > 0.7) return 'text-sm px-3 py-1.5'
    if (ratio > 0.4) return 'text-xs px-2.5 py-1'
    return 'text-[10px] px-2 py-0.5'
  }

  return (
    <div className="border-t border-border">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-medium">Smart Tags</span>
          {existingTags.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {existingTags.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-md border transition-colors',
              showCloud
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-accent/50'
            )}
            onClick={(e) => {
              e.stopPropagation()
              setShowCloud(!showCloud)
            }}
          >
            <Cloud className="w-3 h-3 inline mr-0.5" />
            Cloud
          </button>
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.15 }}
          >
            <X className="w-3 h-3 text-muted-foreground rotate-45" />
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
            <div className="px-4 pb-3 space-y-3">
              {/* Current Tags */}
              {existingTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {existingTags.map((tag) => {
                    const category = detectCategory(tag)
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className={cn('text-[10px] h-5 gap-1 pr-0.5', getTagColor(category))}
                      >
                        {tag}
                        <button
                          className="w-3.5 h-3.5 rounded-full hover:bg-foreground/20 flex items-center justify-center"
                          onClick={() => onRemoveTag(tag)}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {/* Generate Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={generateSuggestions}
                disabled={isLoading || !content.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1.5" />
                )}
                {isLoading ? 'Analyzing...' : 'Suggest Tags'}
              </Button>

              {/* Suggestions with Confidence Bars */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Suggestions
                  </h4>
                  <div className="space-y-1.5">
                    {suggestions.map((suggestion) => {
                      const confidencePercent = Math.round(suggestion.confidence * 100)
                      return (
                        <div
                          key={suggestion.tag}
                          className="flex items-center gap-2 p-2 rounded-md border border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate">{suggestion.tag}</span>
                              <span className={cn('text-[10px] font-mono font-medium', getConfidenceColor(suggestion.confidence))}>
                                {confidencePercent}%
                              </span>
                            </div>
                            <Progress
                              value={confidencePercent}
                              className={cn('h-1 bg-muted', getConfidenceBarColor(suggestion.confidence))}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100"
                            onClick={() => handleAddSuggestion(suggestion)}
                          >
                            <Plus className="w-3 h-3 text-primary" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tag Cloud */}
              <AnimatePresence>
                {showCloud && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <Separator className="mb-3" />
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        Tag Cloud
                        <span className="text-muted-foreground/50">({tagCloud.length} tags)</span>
                      </h4>
                      {isCloudLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : tagCloud.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/50">
                          {tagCloud.map((item) => (
                            <button
                              key={item.tag}
                              className={cn(
                                'rounded-md border font-medium transition-all hover:scale-105',
                                getTagSize(item.count),
                                getTagColor(item.category),
                                existingTags.includes(item.tag) && 'ring-1 ring-primary/40'
                              )}
                              onClick={() => {
                                if (!existingTags.includes(item.tag)) {
                                  onAddTag(item.tag)
                                  toast.success(`Added tag: ${item.tag}`)
                                }
                              }}
                              title={`${item.tag} (${item.count} notes, ${item.category})`}
                            >
                              {item.tag}
                              <span className="ml-1 opacity-50 text-[8px]">{item.count}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground py-2">
                          No tags yet. Add tags to your notes to build the cloud.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
