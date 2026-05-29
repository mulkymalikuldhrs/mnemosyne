'use client'

import { Brain, FileText, MessageSquare, GitBranch, TrendingUp, Sparkles, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useMemoryStore } from '@/lib/store'
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
  const { insights } = useMemoryStore()

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

      {/* Recent Patterns */}
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

      {/* Weekly Growth Chart */}
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
    </motion.div>
  )
}
