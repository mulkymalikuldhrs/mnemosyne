'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ScrollText,
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Bell,
  BellOff,
  Trash2,
  RefreshCw,
  Shield,
  Cpu,
  Bot,
  Radio,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AlertEntry {
  id: string
  level: string
  source: string
  title: string
  message: string
  category: string
  isRead: boolean
  isResolved: boolean
  timestamp: string
}

interface AgentMessage {
  id: string
  agent: string
  role: string
  content: string
  timestamp: string
}

type LogEntry = {
  id: string
  type: 'alert' | 'agent'
  level: string
  source: string
  message: string
  timestamp: string
  isRead?: boolean
  isResolved?: boolean
  category?: string
  agent?: string
  role?: string
  raw: AlertEntry | AgentMessage
}

const LEVEL_ICONS: Record<string, typeof Info> = {
  debug: Info,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: XCircle,
}

const LEVEL_COLORS: Record<string, string> = {
  debug: 'text-slate-500',
  info: 'text-teal-400',
  warning: 'text-amber-400',
  error: 'text-rose-400',
  critical: 'text-rose-500',
}

const LEVEL_BG: Record<string, string> = {
  debug: 'bg-slate-500/10 border-slate-500/20',
  info: 'bg-teal-500/10 border-teal-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  error: 'bg-rose-500/10 border-rose-500/20',
  critical: 'bg-rose-500/15 border-rose-500/30',
}

const SOURCE_ICONS: Record<string, typeof Cpu> = {
  system: Cpu,
  hermes: Bot,
  picoclaw: Shield,
  autopilot: Radio,
  sensor: Cpu,
  operator: Info,
  battery: Cpu,
  gps: Radio,
}

const ALERT_LEVEL_COLORS: Record<string, string> = {
  info: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

export function LogsTab() {
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [alertsRes, agentsRes] = await Promise.all([
          fetch('/api/alerts?limit=100'),
          fetch('/api/agents?limit=100'),
        ])
        const alertsJson = await alertsRes.json()
        const agentsJson = await agentsRes.json()
        if (mounted && alertsJson.success) setAlerts(alertsJson.data.alerts)
        if (mounted && agentsJson.success) setAgentMessages(agentsJson.data.messages)
      } catch (err) {
        toast.error('Failed to load logs: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [refreshKey])

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 10000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkRead = async (alertIds: string[]) => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds, isRead: true }),
      })
      refresh()
    } catch (err) {
      toast.error('Failed to mark alert as read: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleResolve = async (alertIds: string[]) => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds, isRead: true, isResolved: true }),
      })
      refresh()
    } catch (err) {
      toast.error('Failed to resolve alert: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      refresh()
    } catch (err) {
      toast.error('Failed to mark all alerts as read: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // Build unified log entries
  const logEntries: LogEntry[] = [
    ...alerts.map((a): LogEntry => ({
      id: a.id,
      type: 'alert',
      level: a.level,
      source: a.source,
      message: a.title + (a.message ? ` — ${a.message}` : ''),
      timestamp: a.timestamp,
      isRead: a.isRead,
      isResolved: a.isResolved,
      category: a.category,
      raw: a,
    })),
    ...agentMessages.map((m): LogEntry => ({
      id: m.id,
      type: 'agent',
      level: 'info',
      source: m.agent,
      message: m.content,
      timestamp: m.timestamp,
      agent: m.agent,
      role: m.role,
      raw: m,
    })),
  ]

  // Sort by timestamp descending
  logEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Apply filters
  const filtered = logEntries.filter((entry) => {
    if (levelFilter !== 'all' && entry.level !== levelFilter) return false
    if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false
    if (showUnreadOnly && entry.type === 'alert' && entry.isRead) return false
    return true
  })

  const unreadCount = alerts.filter((a) => !a.isRead).length
  const criticalCount = alerts.filter((a) => a.level === 'critical' && !a.isResolved).length

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse border border-white/5" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-32 h-8 bg-slate-900 border-white/10 text-xs">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-32 h-8 bg-slate-900 border-white/10 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="hermes">Hermes</SelectItem>
              <SelectItem value="picoclaw">PicoClaw</SelectItem>
              <SelectItem value="autopilot">Autopilot</SelectItem>
              <SelectItem value="sensor">Sensor</SelectItem>
              <SelectItem value="operator">Operator</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={showUnreadOnly ? 'default' : 'outline'}
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`h-8 text-xs ${showUnreadOnly ? 'bg-teal-600 text-white' : 'border-white/10 text-slate-300 hover:text-white'}`}
          >
            <BellOff className="w-3 h-3 mr-1" />
            Unread ({unreadCount})
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            className="h-8 text-xs border-white/10 text-slate-300 hover:text-white"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Mark All Read
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            className="h-8 text-xs border-white/10 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900 rounded-lg border border-white/5">
          <p className="text-[10px] text-slate-500 uppercase">Total Alerts</p>
          <p className="text-lg font-bold text-white">{alerts.length}</p>
        </div>
        <div className="p-3 bg-slate-900 rounded-lg border border-white/5">
          <p className="text-[10px] text-slate-500 uppercase">Unread</p>
          <p className="text-lg font-bold text-amber-400">{unreadCount}</p>
        </div>
        <div className="p-3 bg-slate-900 rounded-lg border border-white/5">
          <p className="text-[10px] text-slate-500 uppercase">Critical</p>
          <p className="text-lg font-bold text-rose-400">{criticalCount}</p>
        </div>
        <div className="p-3 bg-slate-900 rounded-lg border border-white/5">
          <p className="text-[10px] text-slate-500 uppercase">Agent Messages</p>
          <p className="text-lg font-bold text-teal-400">{agentMessages.length}</p>
        </div>
      </div>

      {/* Log Entries */}
      <Card className="bg-slate-900 border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-200">System Log</CardTitle>
          <CardDescription className="text-xs">
            {filtered.length} entries • Showing alerts and agent messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <ScrollText className="w-8 h-8 mb-2 text-slate-600" />
              <p className="text-xs">No log entries found</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {filtered.map((entry) => {
                const LevelIcon = LEVEL_ICONS[entry.level] || Info
                const SourceIcon = SOURCE_ICONS[entry.source] || Cpu
                const isUnread = entry.type === 'alert' && !entry.isRead
                const isCritical = entry.level === 'critical'
                const isWarning = entry.level === 'warning'

                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                      isUnread ? LEVEL_BG[entry.level] || 'bg-white/5 border-white/10' :
                      'bg-slate-800/30 border-white/5 hover:bg-slate-800/50'
                    }`}
                  >
                    <LevelIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${LEVEL_COLORS[entry.level] || 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <SourceIcon className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-medium text-slate-300 uppercase">{entry.source}</span>
                        {entry.agent && (
                          <Badge className={`text-[8px] px-1 py-0 ${
                            entry.agent === 'hermes' ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' :
                            entry.agent === 'picoclaw' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                            'bg-slate-500/15 text-slate-400 border-slate-500/30'
                          } border`}>
                            {entry.agent}
                          </Badge>
                        )}
                        {entry.category && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-white/10 text-slate-500">
                            {entry.category}
                          </Badge>
                        )}
                        {entry.type === 'alert' && (
                          <Badge className={`text-[8px] px-1 py-0 border ${ALERT_LEVEL_COLORS[entry.level] || ALERT_LEVEL_COLORS.info}`}>
                            {entry.level}
                          </Badge>
                        )}
                        <span className="text-[9px] text-slate-600 font-mono ml-auto">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed ${isUnread ? 'text-slate-200' : 'text-slate-400'}`}>
                        {entry.message}
                      </p>
                    </div>
                    {/* Actions for alerts */}
                    {entry.type === 'alert' && isUnread && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkRead([entry.id])}
                          className="h-5 w-5 p-0 text-slate-500 hover:text-white"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {entry.type === 'alert' && !entry.isResolved && (isCritical || isWarning) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResolve([entry.id])}
                        className="h-5 w-5 p-0 text-slate-500 hover:text-emerald-400"
                        title="Resolve alert"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
