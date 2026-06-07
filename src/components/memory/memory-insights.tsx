'use client'

import { useEffect } from 'react'
import { Brain, FileText, MessageSquare, GitBranch, TrendingUp, Sparkles, BarChart3, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMemoryStore, useNotesStore, useDecisionsStore } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export function MemoryInsights() {
  const { insights, setInsights, isLoadingInsights, setIsLoadingInsights } = useMemoryStore()
  const { notes } = useNotesStore()
  const { decisions } = useDecisionsStore()

  // Fetch memory patterns from API on mount
  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoadingInsights(true)
      try {
        const res = await api.getPatterns()
        if (res.success && res.data?.patterns) {
          // Build insights from patterns API + local store data
          const patterns = res.data.patterns

          // Build topTopics from notes tags
          const tagCounts: Record<string, number> = {}
          notes.forEach((n) => {
            n.tags.forEach((tag) => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1
            })
          })
          const topTopics = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tag, count]) => ({ tag, count }))

          // Build weekly growth from notes
          const weekMap: Record<string, number> = {}
          notes.forEach((n) => {
            const d = new Date(n.createdAt)
            const weekNum = Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000))
            const key = `W${weekNum}`
            weekMap[key] = (weekMap[key] || 0) + 1
          })
          const weeklyGrowth = Object.entries(weekMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-7)
            .map(([week, count]) => ({ week, notes: count }))

          // Map patterns from API — backend returns string[] not objects
          const recentPatterns = patterns.map((p: string) => {
            // Classify pattern type based on content
            let type = 'keyword_frequency'
            if (p.toLowerCase().includes('shift') || p.toLowerCase().includes('focus')) type = 'temporal_shift'
            else if (p.toLowerCase().includes('connected') || p.toLowerCase().includes('cluster')) type = 'knowledge_cluster'
            else if (p.toLowerCase().includes('active') || p.toLowerCase().includes('quiet') || p.toLowerCase().includes('volume')) type = 'note_volume'
            else if (p.toLowerCase().includes('emerging') || p.toLowerCase().includes('new topic')) type = 'emerging_topic'
            return {
              type,
              description: p,
              confidence: 0.7,
            }
          })

          setInsights({
            totalMemories: notes.filter((n) => !n.isArchived).length,
            totalConversations: 0, // Will be updated below
            totalDecisions: decisions.length,
            topTopics,
            recentPatterns,
            weeklyGrowth,
          })

          // Fetch conversation count separately
          try {
            const chatRes = await api.getConversations()
            if (chatRes.success && chatRes.data) {
              const chatCount = chatRes.data.conversations?.length || chatRes.data.pagination?.total || 0
              const currentInsights = useMemoryStore.getState().insights
              if (currentInsights) {
                setInsights({ ...currentInsights, totalConversations: chatCount })
              }
            }
          } catch {
            // Ignore — keep 0 as fallback
          }
        } else {
          // Fallback: build insights from local data
          const tagCounts: Record<string, number> = {}
          notes.forEach((n) => {
            n.tags.forEach((tag) => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1
            })
          })
          const topTopics = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tag, count]) => ({ tag, count }))

          const weekMap: Record<string, number> = {}
          notes.forEach((n) => {
            const d = new Date(n.createdAt)
            const weekNum = Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000))
            const key = `W${weekNum}`
            weekMap[key] = (weekMap[key] || 0) + 1
          })
          const weeklyGrowth = Object.entries(weekMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-7)
            .map(([week, count]) => ({ week, notes: count }))

          setInsights({
            totalMemories: notes.filter((n) => !n.isArchived).length,
            totalConversations: 0,
            totalDecisions: decisions.length,
            topTopics,
            recentPatterns: [],
            weeklyGrowth,
          })
        }
      } catch (err) {
        console.error('Failed to fetch memory insights:', err)
        // Fallback to local data
        const tagCounts: Record<string, number> = {}
        notes.forEach((n) => {
          n.tags.forEach((tag) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        })
        const topTopics = Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([tag, count]) => ({ tag, count }))

        setInsights({
          totalMemories: notes.filter((n) => !n.isArchived).length,
          totalConversations: 0,
          totalDecisions: decisions.length,
          topTopics,
          recentPatterns: [],
          weeklyGrowth: [],
        })
      } finally {
        setIsLoadingInsights(false)
      }
    }
    fetchInsights()
  }, [notes, decisions, setInsights, setIsLoadingInsights])

  if (isLoadingInsights) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!insights) return null

  const maxNotes = Math.max(...insights.weeklyGrowth.map((w) => w.notes), 1)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-primary/5">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold">{insights.totalMemories}</p>
              <p className="text-xs text-muted-foreground">Notes</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-primary/5">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold">{insights.totalConversations}</p>
              <p className="text-xs text-muted-foreground">Chats</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-primary/5">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <GitBranch className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold">{insights.totalDecisions}</p>
              <p className="text-xs text-muted-foreground">Decisions</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Topics */}
      {insights.topTopics.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-primary" />
                Top Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2.5">
                {insights.topTopics.map((topic) => {
                  const maxCount = insights.topTopics[0]?.count ?? 1
                  return (
                    <div key={topic.tag} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{topic.tag}</span>
                        <span className="text-muted-foreground">{topic.count} notes</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(topic.count / maxCount) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full bg-primary/60"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Patterns */}
      {insights.recentPatterns.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Detected Patterns
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {insights.recentPatterns.map((pattern, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold',
                    pattern.type === 'emerging_topic' && 'bg-green-500/10 text-green-500',
                    pattern.type === 'knowledge_cluster' && 'bg-blue-500/10 text-blue-500',
                    pattern.type === 'temporal_shift' && 'bg-amber-500/10 text-amber-500',
                    pattern.type === 'keyword_frequency' && 'bg-violet-500/10 text-violet-500',
                    pattern.type === 'note_volume' && 'bg-cyan-500/10 text-cyan-500',
                    !['emerging_topic', 'knowledge_cluster', 'temporal_shift', 'keyword_frequency', 'note_volume'].includes(pattern.type) && 'bg-gray-500/10 text-gray-500',
                  )}>
                    <TrendingUp className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">{pattern.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {pattern.type.replace('_', ' ')}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(pattern.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Weekly Growth Chart */}
      {insights.weeklyGrowth.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-primary" />
                Memory Growth
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-end gap-2 h-28">
                {insights.weeklyGrowth.map((week) => (
                  <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {week.notes}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((week.notes / maxNotes) * 80, 4)}px` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={cn(
                        'w-full rounded-t-sm min-h-[4px]',
                        week.notes > 0 ? 'bg-primary/60' : 'bg-muted'
                      )}
                    />
                    <span className="text-[9px] text-muted-foreground/70">{week.week}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
