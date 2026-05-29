'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Search,
  GitBranch,
  Settings,
  Plug,
  Brain,
  Plus,
  Clock,
  ArrowRight,
  CheckCircle2,
  Circle,
  RotateCcw,
  Key,
  Server,
  Palette,
  Shield,
  Trash2,
  ExternalLink,
  Sparkles,
  FileCode2,
  Loader2,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { NotesList } from '@/components/notes/notes-list'
import { NoteCard } from '@/components/notes/note-card'
import { ChatPanel } from '@/components/chat/chat-panel'
import { SemanticSearch } from '@/components/search/semantic-search'
import { MemoryInsights } from '@/components/memory/memory-insights'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useUIStore, useNotesStore, useDecisionsStore } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

// ─── Auth Guard ──────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-sm">Redirecting to login...</p>
          <meta httpEquiv="refresh" content="0;url=/login" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// ─── Dashboard View ──────────────────────────────────────────────────────────

function DashboardView() {
  const { notes, setNotes, setIsLoading: setNotesLoading } = useNotesStore()
  const { setActiveSection } = useUIStore()
  const { decisions, setDecisions, setIsLoading: setDecisionsLoading } = useDecisionsStore()

  // Fetch notes and decisions on mount
  useEffect(() => {
    const fetchData = async () => {
      setNotesLoading(true)
      setDecisionsLoading(true)
      try {
        const [notesRes, decisionsRes] = await Promise.all([
          api.getNotes('limit=50'),
          api.getDecisions('limit=50'),
        ])

        if (notesRes.success && notesRes.data?.notes) {
          const mapped = notesRes.data.notes.map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags ? n.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            isArchived: n.isArchived,
          }))
          setNotes(mapped)
        }

        if (decisionsRes.success && decisionsRes.data?.decisions) {
          const mapped = decisionsRes.data.decisions.map((d: any) => ({
            id: d.id,
            title: d.title,
            context: d.context || '',
            reasoning: d.reasoning || '',
            alternatives: '',
            outcome: d.outcome || '',
            status: 'pending' as const,
            createdAt: d.createdAt,
          }))
          setDecisions(mapped)
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setNotesLoading(false)
        setDecisionsLoading(false)
      }
    }
    fetchData()
  }, [setNotes, setDecisions, setNotesLoading, setDecisionsLoading])

  const recentNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 4),
    [notes]
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/5 via-primary/10 to-transparent p-6 md:p-8"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Welcome to Memorix</h1>
              <p className="text-sm text-muted-foreground">Your AI-powered memory infrastructure</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Store, search, and connect your notes, decisions, and conversations using semantic understanding.
            Your memories are always just a query away.
          </p>
        </div>
        <div className="absolute top-4 right-4 opacity-[0.03]">
          <Brain className="w-40 h-40" />
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: FileText, label: 'Total Notes', value: notes.filter((n) => !n.isArchived).length, section: 'notes' as const, color: 'text-violet-500' },
          { icon: MessageSquare, label: 'Conversations', value: 3, section: 'chat' as const, color: 'text-emerald-500' },
          { icon: GitBranch, label: 'Decisions', value: decisions.length, section: 'decisions' as const, color: 'text-amber-500' },
          { icon: Sparkles, label: 'Patterns', value: 3, section: 'dashboard' as const, color: 'text-rose-500' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
              onClick={() => setActiveSection(stat.section)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Memory Insights */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Memory Insights
          </h2>
          <MemoryInsights />
        </div>

        {/* Recent Notes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Recent Notes
            </h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveSection('notes')}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentNotes.map((note) => (
              <NoteCard key={note.id} note={note} onClick={() => setActiveSection('notes')} />
            ))}
          </div>

          {/* Quick Actions */}
          <Card className="border-dashed">
            <CardContent className="p-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveSection('notes')}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Note
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveSection('chat')}>
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Chat with Memory
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveSection('search')}>
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Semantic Search
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Notes View ──────────────────────────────────────────────────────────────

function NotesView() {
  return <NotesList />
}

// ─── Chat View ───────────────────────────────────────────────────────────────

function ChatView() {
  return <ChatPanel />
}

// ─── Search View ─────────────────────────────────────────────────────────────

function SearchView() {
  return <SemanticSearch />
}

// ─── Decisions View ──────────────────────────────────────────────────────────

function DecisionsView() {
  const { decisions, setDecisions, addDecision, updateDecision, isLoading, setIsLoading } = useDecisionsStore()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [alternatives, setAlternatives] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch decisions on mount
  useEffect(() => {
    const fetchDecisions = async () => {
      setIsLoading(true)
      try {
        const res = await api.getDecisions('limit=100')
        if (res.success && res.data?.decisions) {
          const mapped = res.data.decisions.map((d: any) => ({
            id: d.id,
            title: d.title,
            context: d.context || '',
            reasoning: d.reasoning || '',
            alternatives: '',
            outcome: d.outcome || '',
            status: 'pending' as const,
            createdAt: d.createdAt,
          }))
          setDecisions(mapped)
        }
      } catch (err) {
        console.error('Failed to fetch decisions:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDecisions()
  }, [setDecisions, setIsLoading])

  const handleAdd = async () => {
    if (!title.trim()) return
    setIsSubmitting(true)
    try {
      const res = await api.createDecision({
        title,
        context,
        reasoning,
        decision: title, // Use title as decision since it's required by API
        alternatives,
      })

      if (res.success && res.data) {
        const newDecision = {
          id: res.data.id,
          title: res.data.title,
          context: res.data.context || '',
          reasoning: res.data.reasoning || '',
          alternatives: '',
          outcome: res.data.outcome || '',
          status: 'pending' as const,
          createdAt: res.data.createdAt,
        }
        addDecision(newDecision)
        toast.success('Decision recorded')
        setTitle('')
        setContext('')
        setReasoning('')
        setAlternatives('')
        setShowForm(false)
      } else {
        toast.error(res.error || 'Failed to create decision')
      }
    } catch {
      toast.error('Failed to create decision')
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'decided':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'revisited':
        return <RotateCcw className="w-4 h-4 text-amber-500" />
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Decision Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track and revisit your architectural and product decisions</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Decision
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record a Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Decision title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Context — what led to this decision?" value={context} onChange={(e) => setContext(e.target.value)} rows={2} />
                <Textarea placeholder="Reasoning — why this approach?" value={reasoning} onChange={(e) => setReasoning(e.target.value)} rows={2} />
                <Textarea placeholder="Alternatives considered..." value={alternatives} onChange={(e) => setAlternatives(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={!title.trim() || isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                    Save Decision
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {decisions.map((decision, i) => (
          <motion.div
            key={decision.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{statusIcon(decision.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{decision.title}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5',
                          decision.status === 'decided' && 'border-emerald-500/30 text-emerald-500',
                          decision.status === 'revisited' && 'border-amber-500/30 text-amber-500',
                          decision.status === 'pending' && 'border-muted-foreground/30 text-muted-foreground',
                        )}
                      >
                        {decision.status}
                      </Badge>
                    </div>
                    {decision.context && (
                      <p className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium text-foreground/70">Context:</span> {decision.context}
                      </p>
                    )}
                    {decision.reasoning && (
                      <p className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium text-foreground/70">Reasoning:</span> {decision.reasoning}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(decision.createdAt), { addSuffix: true })}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {decision.status !== 'decided' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => updateDecision(decision.id, { status: 'decided' })}
                          >
                            Mark Decided
                          </Button>
                        )}
                        {decision.status === 'decided' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => updateDecision(decision.id, { status: 'revisited' })}
                          >
                            Revisit
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Settings View ───────────────────────────────────────────────────────────

function SettingsView() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<any>(null)
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKey, setShowNewKey] = useState<string | null>(null)

  // Fetch settings and API keys on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [settingsRes, keysRes] = await Promise.all([
          api.getSettings(),
          api.getApiKeys(),
        ])

        if (settingsRes.success) {
          setSettings(settingsRes.data)
        }
        if (keysRes.success && keysRes.data?.apiKeys) {
          setApiKeys(keysRes.data.apiKeys)
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return
    try {
      const res = await api.createApiKey(newKeyName.trim())
      if (res.success && res.data) {
        setApiKeys((prev) => [
          {
            id: res.data.id,
            name: res.data.name,
            keyMasked: `mx_...${res.data.key.slice(-4)}`,
            createdAt: res.data.createdAt,
          },
          ...prev,
        ])
        setShowNewKey(res.data.key)
        setNewKeyName('')
        toast.success('API key created — copy it now, you won\'t see it again!')
      } else {
        toast.error(res.error || 'Failed to create API key')
      }
    } catch {
      toast.error('Failed to create API key')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your Memorix instance</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input defaultValue={settings?.name || session?.user?.name || ''} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input defaultValue={settings?.email || session?.user?.email || ''} className="h-9" disabled />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Plan</p>
              <p className="text-xs text-muted-foreground">Free tier — upgrade for advanced features</p>
            </div>
            <Badge variant="secondary">{settings?.plan || session?.user?.plan || 'FREE'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark theme</p>
            </div>
            <ThemeToggle />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Compact Sidebar</p>
              <p className="text-xs text-muted-foreground">Minimize sidebar to icon-only mode</p>
            </div>
            <CompactSidebarToggle />
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* New key reveal */}
          {showNewKey && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <p className="text-xs font-medium text-emerald-500">API Key Created</p>
              <code className="text-xs bg-background px-2 py-1 rounded font-mono block break-all">
                {showNewKey}
              </code>
              <p className="text-[10px] text-muted-foreground">Copy this key now — you won&apos;t see it again.</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(showNewKey)
                  toast.success('API key copied to clipboard')
                }}
              >
                Copy Key
              </Button>
            </div>
          )}

          {apiKeys.length > 0 ? apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium font-mono">{apiKey.keyMasked}</p>
                <p className="text-[10px] text-muted-foreground">
                  {apiKey.name} — Created {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No API keys yet. Create one below.</p>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g., 'My App')"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="h-9"
            />
            <Button variant="outline" size="sm" onClick={handleCreateApiKey} disabled={!newKeyName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MCP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plug className="w-4 h-4" />
            MCP Server Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <p className="text-xs font-medium">Server Command</p>
            <code className="text-xs bg-background px-2 py-1 rounded font-mono block">
              npx @memorix/mcp-server --db ./memorix.db
            </code>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <p className="text-xs font-medium">Claude Desktop Config</p>
            <pre className="text-[10px] bg-background px-2 py-1.5 rounded font-mono overflow-x-auto">
{`{
  "mcpServers": {
    "memorix": {
      "command": "npx",
      "args": ["@memorix/mcp-server"]
    }
  }
}`}
            </pre>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            View Full Documentation
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reset All Data</p>
              <p className="text-xs text-muted-foreground">This will permanently delete all your notes, conversations, and decisions</p>
            </div>
            <Button variant="destructive" size="sm">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── MCP Server View ─────────────────────────────────────────────────────────

function McpServerView() {
  const tools = [
    { name: 'memorix_search', desc: 'Search user memory', method: 'tools/call' },
    { name: 'memorix_add_note', desc: 'Add note to memory', method: 'tools/call' },
    { name: 'memorix_get_note', desc: 'Get specific note', method: 'tools/call' },
    { name: 'memorix_list_notes', desc: 'List all notes', method: 'tools/call' },
    { name: 'memorix_chat', desc: 'Chat with memory', method: 'tools/call' },
    { name: 'memorix_get_related', desc: 'Get related notes', method: 'tools/call' },
    { name: 'memorix_detect_patterns', desc: 'Detect memory patterns', method: 'tools/call' },
    { name: 'memorix_add_decision', desc: 'Record a decision', method: 'tools/call' },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Plug className="w-5 h-5 text-primary" />
          MCP Server
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Model Context Protocol server for AI assistant integration
        </p>
      </div>

      {/* Status */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <p className="text-sm font-medium">Server Active</p>
            <p className="text-xs text-muted-foreground">MCP server running on stdio transport</p>
          </div>
        </CardContent>
      </Card>

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="w-4 h-4" />
            Connection Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Transport</p>
              <p className="text-sm font-medium">stdio</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Protocol</p>
              <p className="text-sm font-medium">JSON-RPC 2.0</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Version</p>
              <p className="text-sm font-medium">MCP 2024-11-05</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tools Available</p>
              <p className="text-sm font-medium">{tools.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileCode2 className="w-4 h-4" />
            Available Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {tool.name}
                  </code>
                  <span className="text-xs text-muted-foreground">{tool.desc}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {tool.method}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Client Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Client Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Claude Desktop', config: 'claude_desktop_config.json' },
            { name: 'Cursor', config: '.cursor/mcp.json' },
            { name: 'Windsurf', config: '.windsurf/mcp.json' },
            { name: 'VS Code', config: '.vscode/mcp.json' },
          ].map((client) => (
            <div
              key={client.name}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div>
                <p className="text-sm font-medium">{client.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{client.config}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs">
                Copy Config
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Helper Components ───────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Switch
      checked={theme === 'dark'}
      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
    />
  )
}

function CompactSidebarToggle() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore()
  return (
    <Switch
      checked={sidebarCollapsed}
      onCheckedChange={setSidebarCollapsed}
    />
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { activeSection } = useUIStore()

  const renderView = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardView />
      case 'notes':
        return <NotesView />
      case 'chat':
        return <ChatView />
      case 'search':
        return <SearchView />
      case 'decisions':
        return <DecisionsView />
      case 'settings':
        return <SettingsView />
      case 'mcp':
        return <McpServerView />
      default:
        return <DashboardView />
    }
  }

  return (
    <AuthGuard>
      <AppLayout>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </AppLayout>
    </AuthGuard>
  )
}
