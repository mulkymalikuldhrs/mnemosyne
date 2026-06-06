'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  Star,
  Network,
  Calendar,
  LayoutGrid,
  // v3.0.0 icons
  Cloud,
  Mail,
  Puzzle,
  History,
  Bot,
  Download,
  RefreshCw,
  Inbox,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
  Edit3,
  Save,
  X,
  HardDrive,
  Globe,
  Database,
  Zap,
  Eye,
  ChevronDown,
  Send,
  FileSearch,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { NotesList } from '@/components/notes/notes-list'
import { NoteCard } from '@/components/notes/note-card'
import { ChatPanel } from '@/components/chat/chat-panel'
import { SemanticSearch } from '@/components/search/semantic-search'
import { MemoryInsights } from '@/components/memory/memory-insights'
import { KnowledgeGraph } from '@/components/graph/knowledge-graph'
import { DailyNotes } from '@/components/daily/daily-notes'
import { CanvasView } from '@/components/canvas/canvas-view'
import { TemplatesView } from '@/components/templates/templates-view'
import { QuickSwitcher } from '@/components/quick-switcher'
import { KeyboardShortcutsPanel } from '@/components/keyboard-shortcuts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useUIStore, useNotesStore, useDecisionsStore } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

// ─── Auth Guard ──────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

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
  const [conversationCount, setConversationCount] = useState(0)
  const [patternCount, setPatternCount] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      setNotesLoading(true)
      setDecisionsLoading(true)
      try {
        const [notesRes, decisionsRes, chatRes, patternsRes] = await Promise.all([
          api.getNotes('limit=50'),
          api.getDecisions('limit=50'),
          api.getConversations(),
          api.getPatterns(),
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
            status: (d.status || 'pending') as 'pending' | 'decided' | 'revisited',
            createdAt: d.createdAt,
          }))
          setDecisions(mapped)
        }

        if (chatRes.success && chatRes.data?.conversations) {
          setConversationCount(chatRes.data.conversations.length || chatRes.data.pagination?.total || 0)
        }

        if (patternsRes.success && patternsRes.data?.patterns) {
          setPatternCount(patternsRes.data.patterns.length)
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
              <h1 className="text-xl md:text-2xl font-bold">Welcome to Memorix v3</h1>
              <p className="text-sm text-muted-foreground">Universal AI/Human Memory Hub — storage, email, integrations & more</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Store, search, and connect your notes, decisions, and conversations using semantic understanding.
            Your memories are always just a query away. Use <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px]">⌘K</kbd> to search.
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
          { icon: MessageSquare, label: 'Conversations', value: conversationCount, section: 'chat' as const, color: 'text-emerald-500' },
          { icon: GitBranch, label: 'Decisions', value: decisions.length, section: 'decisions' as const, color: 'text-amber-500' },
          { icon: Sparkles, label: 'Patterns', value: patternCount, section: 'dashboard' as const, color: 'text-rose-500' },
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

      {/* Feature Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Network, label: 'Knowledge Graph', section: 'graph' as const, desc: 'Visualize connections' },
          { icon: Calendar, label: 'Daily Notes', section: 'daily' as const, desc: 'Journal your thoughts' },
          { icon: LayoutGrid, label: 'Canvas', section: 'canvas' as const, desc: 'Spatial thinking' },
          { icon: FileCode2, label: 'Templates', section: 'templates' as const, desc: 'Consistent workflows' },
        ].map((feature) => (
          <motion.div
            key={feature.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all border-dashed"
              onClick={() => setActiveSection(feature.section)}
            >
              <CardContent className="p-4 text-center">
                <feature.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{feature.label}</p>
                <p className="text-[10px] text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* v3.0.0 Feature Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Cloud, label: 'Storage Hub', section: 'storage' as const, desc: 'Cloud files & sync' },
          { icon: Mail, label: 'Email Hub', section: 'email' as const, desc: 'Ingest emails' },
          { icon: Puzzle, label: 'Integrations', section: 'integrations' as const, desc: 'Connected services' },
          { icon: History, label: 'Temporal Graph', section: 'temporal' as const, desc: 'Time-travel graph' },
          { icon: Bot, label: 'Agent Hub', section: 'agents' as const, desc: 'AI agent profiles' },
        ].map((feature) => (
          <motion.div
            key={feature.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
              onClick={() => setActiveSection(feature.section)}
            >
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-medium">{feature.label}</p>
                <p className="text-[10px] text-muted-foreground">{feature.desc}</p>
                <Badge variant="secondary" className="text-[8px] mt-1 h-4">NEW</Badge>
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
              <Button variant="outline" size="sm" onClick={() => setActiveSection('graph')}>
                <Network className="w-3.5 h-3.5 mr-1.5" />
                Knowledge Graph
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

// ─── Graph View ──────────────────────────────────────────────────────────────

function GraphView() {
  return <KnowledgeGraph />
}

// ─── Daily Notes View ────────────────────────────────────────────────────────

function DailyNotesView() {
  return <DailyNotes />
}

// ─── Canvas View ─────────────────────────────────────────────────────────────

function CanvasFullView() {
  return <CanvasView />
}

// ─── Templates View ──────────────────────────────────────────────────────────

function TemplatesFullView() {
  return <TemplatesView />
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── v3.0.0 — Storage Hub View ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_PROVIDERS = [
  { value: 'google_drive', label: 'Google Drive', icon: '📁' },
  { value: 's3', label: 'Amazon S3', icon: '☁️' },
  { value: 'terabox', label: 'TeraBox', icon: '📦' },
  { value: 'dropbox', label: 'Dropbox', icon: '💼' },
  { value: 'onedrive', label: 'OneDrive', icon: '🔷' },
  { value: 'local', label: 'Local Storage', icon: '🖥️' },
]

function StorageHubView() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newProvider, setNewProvider] = useState('')
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [accRes, filesRes] = await Promise.all([
          api.getStorageAccounts(),
          api.getStorageFiles('limit=50'),
        ])
        if (accRes.success && accRes.data?.accounts) setAccounts(accRes.data.accounts)
        if (filesRes.success && filesRes.data?.files) setFiles(filesRes.data.files)
      } catch (err) {
        console.error('Failed to fetch storage data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSync = async (accountId: string) => {
    setSyncingId(accountId)
    try {
      const res = await api.syncStorage(accountId)
      if (res.success) {
        toast.success('Sync started')
        // Refresh files
        const filesRes = await api.getStorageFiles('limit=50')
        if (filesRes.success && filesRes.data?.files) setFiles(filesRes.data.files)
        // Refresh accounts
        const accRes = await api.getStorageAccounts()
        if (accRes.success && accRes.data?.accounts) setAccounts(accRes.data.accounts)
      } else {
        toast.error(res.error || 'Sync failed')
      }
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleIngest = async (fileId: string) => {
    setIngestingId(fileId)
    try {
      const res = await api.ingestStorageFile(fileId)
      if (res.success) {
        toast.success('File ingested to memory')
        setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, isIngested: true } : f))
      } else {
        toast.error(res.error || 'Ingest failed')
      }
    } catch {
      toast.error('Ingest failed')
    } finally {
      setIngestingId(null)
    }
  }

  const handleAddAccount = async () => {
    if (!newProvider || !newName.trim()) return
    setIsAdding(true)
    try {
      const res = await api.addStorageAccount({
        provider: newProvider,
        name: newName.trim(),
        accessToken: newToken || 'demo-token',
      })
      if (res.success && res.data) {
        setAccounts((prev) => [...prev, res.data])
        toast.success('Storage account connected')
        setShowAddDialog(false)
        setNewProvider('')
        setNewName('')
        setNewToken('')
      } else {
        toast.error(res.error || 'Failed to add storage account')
      }
    } catch {
      toast.error('Failed to add storage account')
    } finally {
      setIsAdding(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getProviderEmoji = (provider: string) => {
    return STORAGE_PROVIDERS.find((p) => p.value === provider)?.icon || '📁'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Storage Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Browse and ingest cloud storage files into memory</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Storage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Storage</DialogTitle>
              <DialogDescription>Link a cloud storage provider to browse and ingest files</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={newProvider} onValueChange={setNewProvider}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {STORAGE_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.icon} {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account Name</Label>
                <Input placeholder="e.g., My Google Drive" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Access Token</Label>
                <Input placeholder="OAuth token or API key" value={newToken} onChange={(e) => setNewToken(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddAccount} disabled={!newProvider || !newName.trim() || isAdding}>
                {isAdding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Storage Accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.length > 0 ? accounts.map((account, i) => (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getProviderEmoji(account.provider)}</span>
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-[10px] text-muted-foreground">{account.provider}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    'text-[10px] h-5',
                    account.isEnabled ? 'border-emerald-500/30 text-emerald-500' : 'border-muted-foreground/30 text-muted-foreground'
                  )}>
                    {account.isEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {account.lastSyncedAt
                      ? `Synced ${formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })}`
                      : 'Never synced'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => handleSync(account.id)}
                    disabled={syncingId === account.id}
                  >
                    {syncingId === account.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Sync
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )) : (
          <Card className="border-dashed col-span-full">
            <CardContent className="p-8 text-center">
              <Cloud className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No storage accounts connected</p>
              <p className="text-xs text-muted-foreground mt-1">Click &quot;Add Storage&quot; to connect your first cloud provider</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Files */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSearch className="w-4 h-4" />
            Files
            {files.length > 0 && <Badge variant="secondary" className="text-[10px] h-5">{files.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length > 0 ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium border-b border-border">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-1">Size</div>
                <div className="col-span-2">Provider</div>
                <div className="col-span-1">Modified</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {files.map((file, i) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-accent/30 transition-colors items-center border-b border-border/50 last:border-0"
                >
                  <div className="col-span-4 text-sm font-medium truncate">{file.name}</div>
                  <div className="col-span-2">
                    <Badge variant="outline" className="text-[10px] h-5">{file.mimeType?.split('/').pop() || 'file'}</Badge>
                  </div>
                  <div className="col-span-1 text-xs text-muted-foreground">{formatSize(file.size || 0)}</div>
                  <div className="col-span-2 text-xs text-muted-foreground">{file.storageAccount?.provider || '—'}</div>
                  <div className="col-span-1 text-[10px] text-muted-foreground">
                    {file.lastModified ? formatDistanceToNow(new Date(file.lastModified), { addSuffix: true }) : '—'}
                  </div>
                  <div className="col-span-2 flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-6 text-[10px] px-2", file.isIngested && "text-emerald-500")}
                      onClick={() => handleIngest(file.id)}
                      disabled={ingestingId === file.id || file.isIngested}
                    >
                      {ingestingId === file.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : file.isIngested ? (
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      ) : (
                        <Brain className="w-3 h-3 mr-0.5" />
                      )}
                      {file.isIngested ? 'In Memory' : 'Ingest'}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <HardDrive className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No files found</p>
              <p className="text-xs text-muted-foreground mt-1">Sync a storage account to browse files</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── v3.0.0 — Email Hub View ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const EMAIL_PROVIDERS = [
  { value: 'gmail', label: 'Gmail', icon: '📧' },
  { value: 'imap', label: 'IMAP', icon: '📬' },
  { value: 'outlook', label: 'Outlook', icon: '📨' },
]

function EmailHubView() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [summary, setSummary] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newProvider, setNewProvider] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newToken, setNewToken] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [accRes, msgRes, sumRes] = await Promise.all([
          api.getEmailAccounts(),
          api.getEmailMessages('limit=30'),
          api.getEmailSummary(),
        ])
        if (accRes.success && accRes.data?.accounts) setAccounts(accRes.data.accounts)
        if (msgRes.success && msgRes.data?.messages) setMessages(msgRes.data.messages)
        if (sumRes.success && sumRes.data?.summary) setSummary(sumRes.data.summary)
      } catch (err) {
        console.error('Failed to fetch email data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSync = async (accountId: string) => {
    setSyncingId(accountId)
    try {
      const res = await api.syncEmail(accountId)
      if (res.success) {
        toast.success('Email sync started')
        const msgRes = await api.getEmailMessages('limit=30')
        if (msgRes.success && msgRes.data?.messages) setMessages(msgRes.data.messages)
        const accRes = await api.getEmailAccounts()
        if (accRes.success && accRes.data?.accounts) setAccounts(accRes.data.accounts)
      } else {
        toast.error(res.error || 'Sync failed')
      }
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleIngest = async (messageId: string) => {
    setIngestingId(messageId)
    try {
      const res = await api.ingestEmail(messageId)
      if (res.success) {
        toast.success('Email ingested to memory')
        setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isIngested: true } : m))
      } else {
        toast.error(res.error || 'Ingest failed')
      }
    } catch {
      toast.error('Ingest failed')
    } finally {
      setIngestingId(null)
    }
  }

  const handleAddAccount = async () => {
    if (!newProvider || !newEmail.trim()) return
    setIsAdding(true)
    try {
      const res = await api.addEmailAccount({
        provider: newProvider,
        email: newEmail.trim(),
        accessToken: newToken || 'demo-token',
      })
      if (res.success && res.data) {
        setAccounts((prev) => [...prev, res.data])
        toast.success('Email account connected')
        setShowAddDialog(false)
        setNewProvider('')
        setNewEmail('')
        setNewToken('')
      } else {
        toast.error(res.error || 'Failed to add email account')
      }
    } catch {
      toast.error('Failed to add email account')
    } finally {
      setIsAdding(false)
    }
  }

  const getProviderEmoji = (provider: string) => {
    return EMAIL_PROVIDERS.find((p) => p.value === provider)?.icon || '📬'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Email Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Connect email accounts and ingest messages to memory</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Email
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Email</DialogTitle>
              <DialogDescription>Link an email account to browse and ingest messages</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={newProvider} onValueChange={setNewProvider}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {EMAIL_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.icon} {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email Address</Label>
                <Input placeholder="you@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Access Token</Label>
                <Input placeholder="OAuth token or app password" value={newToken} onChange={(e) => setNewToken(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddAccount} disabled={!newProvider || !newEmail.trim() || isAdding}>
                {isAdding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Email Accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.length > 0 ? accounts.map((account, i) => (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getProviderEmoji(account.provider)}</span>
                    <div>
                      <p className="text-sm font-medium">{account.email}</p>
                      <p className="text-[10px] text-muted-foreground">{account.provider}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    'text-[10px] h-5',
                    account.isEnabled ? 'border-emerald-500/30 text-emerald-500' : 'border-muted-foreground/30 text-muted-foreground'
                  )}>
                    {account.isEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {account.lastSyncedAt
                      ? `Synced ${formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })}`
                      : 'Never synced'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => handleSync(account.id)}
                    disabled={syncingId === account.id}
                  >
                    {syncingId === account.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Sync
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )) : (
          <Card className="border-dashed col-span-full">
            <CardContent className="p-8 text-center">
              <Mail className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No email accounts connected</p>
              <p className="text-xs text-muted-foreground mt-1">Click &quot;Add Email&quot; to connect your first account</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Summary */}
      {summary && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">AI Email Summary</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Messages
            {messages.length > 0 && <Badge variant="secondary" className="text-[10px] h-5">{messages.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length > 0 ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/30 transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="shrink-0">
                    {msg.isStarred ? (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{msg.fromName || msg.fromAddr}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(msg.date), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{msg.subject || '(No subject)'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {msg.isIngested && (
                      <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/30 text-emerald-500">In Memory</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => handleIngest(msg.id)}
                      disabled={ingestingId === msg.id || msg.isIngested}
                    >
                      {ingestingId === msg.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Brain className="w-3 h-3 mr-0.5" />
                      )}
                      {msg.isIngested ? 'Done' : 'Ingest'}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Mail className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No messages found</p>
              <p className="text-xs text-muted-foreground mt-1">Sync an email account to browse messages</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── v3.0.0 — Integrations View ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const INTEGRATION_PROVIDERS = [
  { value: 'composio', label: 'Composio', icon: '🔗', desc: 'Connect 200+ apps via Composio' },
  { value: 'mcp_client', label: 'MCP Client', icon: '🔌', desc: 'Custom MCP client integration' },
  { value: 'custom', label: 'Custom', icon: '⚙️', desc: 'Custom integration via API' },
]

function IntegrationsView() {
  const [integrations, setIntegrations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newProvider, setNewProvider] = useState('')
  const [newName, setNewName] = useState('')
  const [newConfig, setNewConfig] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await api.getIntegrations()
        if (res.success && res.data?.integrations) setIntegrations(res.data.integrations)
      } catch (err) {
        console.error('Failed to fetch integrations:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    // Optimistic update
    setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, isEnabled: !currentEnabled } : i))
    try {
      const res = await api.updateIntegration(id, { isEnabled: !currentEnabled })
      if (!res.success) {
        setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, isEnabled: currentEnabled } : i))
        toast.error('Failed to update integration')
      } else {
        toast.success(currentEnabled ? 'Integration disabled' : 'Integration enabled')
      }
    } catch {
      setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, isEnabled: currentEnabled } : i))
      toast.error('Failed to update integration')
    }
  }

  const handleAdd = async () => {
    if (!newProvider || !newName.trim()) return
    setIsAdding(true)
    try {
      const res = await api.addIntegration({
        provider: newProvider,
        name: newName.trim(),
        config: newConfig || '{}',
      })
      if (res.success && res.data) {
        setIntegrations((prev) => [...prev, res.data])
        toast.success('Integration added')
        setShowAddDialog(false)
        setNewProvider('')
        setNewName('')
        setNewConfig('')
      } else {
        toast.error(res.error || 'Failed to add integration')
      }
    } catch {
      toast.error('Failed to add integration')
    } finally {
      setIsAdding(false)
    }
  }

  const getProviderInfo = (provider: string) => {
    return INTEGRATION_PROVIDERS.find((p) => p.value === provider) || { icon: '⚙️', label: provider, desc: '' }
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
            <Puzzle className="w-5 h-5 text-primary" />
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage connected services and tools</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Integration</DialogTitle>
              <DialogDescription>Connect a third-party service or tool</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={newProvider} onValueChange={setNewProvider}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {INTEGRATION_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.icon} {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input placeholder="e.g., My Composio Connection" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Configuration (JSON)</Label>
                <Textarea placeholder='{"apiKey": "...", "region": "us"}' value={newConfig} onChange={(e) => setNewConfig(e.target.value)} rows={3} className="font-mono text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={!newProvider || !newName.trim() || isAdding}>
                {isAdding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Available Integration Types */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {INTEGRATION_PROVIDERS.map((provider) => (
          <Card key={provider.value} className="border-dashed hover:border-primary/30 transition-colors">
            <CardContent className="p-4 text-center">
              <span className="text-2xl">{provider.icon}</span>
              <p className="text-sm font-medium mt-2">{provider.label}</p>
              <p className="text-[10px] text-muted-foreground">{provider.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connected Integrations */}
      <div className="space-y-3">
        {integrations.length > 0 ? integrations.map((integration, i) => {
          const providerInfo = getProviderInfo(integration.provider)
          return (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{providerInfo.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{integration.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {integration.provider}
                          {integration.lastSyncedAt && ` — Synced ${formatDistanceToNow(new Date(integration.lastSyncedAt), { addSuffix: true })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn(
                        'text-[10px] h-5',
                        integration.isEnabled ? 'border-emerald-500/30 text-emerald-500' : 'border-muted-foreground/30 text-muted-foreground'
                      )}>
                        {integration.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground">
                          {integration.isEnabled ? 'On' : 'Off'}
                        </Label>
                        <Switch
                          checked={integration.isEnabled}
                          onCheckedChange={() => handleToggle(integration.id, integration.isEnabled)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        }) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Puzzle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No integrations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click &quot;Add Integration&quot; to connect your first service</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── v3.0.0 — Temporal Graph View ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const ENTITY_TYPES = [
  { value: 'person', label: 'Person', color: 'bg-violet-500/10 text-violet-500 border-violet-500/30' },
  { value: 'project', label: 'Project', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  { value: 'concept', label: 'Concept', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  { value: 'topic', label: 'Topic', color: 'bg-rose-500/10 text-rose-500 border-rose-500/30' },
  { value: 'organization', label: 'Organization', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30' },
  { value: 'tool', label: 'Tool', color: 'bg-orange-500/10 text-orange-500 border-orange-500/30' },
  { value: 'event', label: 'Event', color: 'bg-pink-500/10 text-pink-500 border-pink-500/30' },
]

function TemporalGraphView() {
  const [entities, setEntities] = useState<any[]>([])
  const [relations, setRelations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeSlider, setTimeSlider] = useState(100) // 0-100, 100 = now
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'entities' | 'graph'>('entities')

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [entRes, graphRes] = await Promise.all([
          api.getEntities('limit=100'),
          api.getTemporalGraph(),
        ])
        if (entRes.success && entRes.data?.entities) setEntities(entRes.data.entities)
        if (graphRes.success && graphRes.data?.relations) setRelations(graphRes.data.relations)
      } catch (err) {
        console.error('Failed to fetch temporal graph data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter entities based on time slider
  const filteredEntities = useMemo(() => {
    if (timeSlider >= 100) return entities
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - Math.floor((100 - timeSlider) * 3.65))
    return entities.filter((e) => {
      if (!e.createdAt) return true
      return new Date(e.createdAt) <= cutoffDate
    })
  }, [entities, timeSlider])

  const getEntityTypeStyle = (type: string) => {
    return ENTITY_TYPES.find((t) => t.value === type)?.color || 'bg-muted text-muted-foreground border-muted'
  }

  const getEntityTypeLabel = (type: string) => {
    return ENTITY_TYPES.find((t) => t.value === type)?.label || type
  }

  const sliderDateLabel = useMemo(() => {
    if (timeSlider >= 100) return 'Now'
    const d = new Date()
    d.setDate(d.getDate() - Math.floor((100 - timeSlider) * 3.65))
    return d.toLocaleDateString()
  }, [timeSlider])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Temporal Graph
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Visualize your knowledge graph across time</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'entities' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('entities')}
          >
            <Database className="w-3.5 h-3.5 mr-1.5" />
            Entities
          </Button>
          <Button
            variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('graph')}
          >
            <Network className="w-3.5 h-3.5 mr-1.5" />
            Graph
          </Button>
        </div>
      </div>

      {/* Time Travel Slider */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Time Travel</span>
            </div>
            <div className="flex-1">
              <Slider
                value={[timeSlider]}
                onValueChange={(v) => setTimeSlider(v[0])}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>
            <Badge variant="outline" className="text-xs h-6 min-w-[80px] justify-center">
              {sliderDateLabel}
            </Badge>
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[9px] text-muted-foreground">1 year ago</span>
            <span className="text-[9px] text-muted-foreground">6 months</span>
            <span className="text-[9px] text-muted-foreground">Now</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{filteredEntities.length}</p>
            <p className="text-[10px] text-muted-foreground">Entities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{relations.length}</p>
            <p className="text-[10px] text-muted-foreground">Relations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{new Set(filteredEntities.map((e: any) => e.type)).size}</p>
            <p className="text-[10px] text-muted-foreground">Types</p>
          </CardContent>
        </Card>
      </div>

      {viewMode === 'entities' ? (
        /* Entity List */
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="w-4 h-4" />
              Entities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredEntities.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredEntities.map((entity, i) => (
                  <motion.div
                    key={entity.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors cursor-pointer",
                      selectedEntity === entity.id && "border-primary/30 bg-primary/5"
                    )}
                    onClick={() => setSelectedEntity(selectedEntity === entity.id ? null : entity.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{entity.name}</p>
                        <Badge variant="outline" className={cn('text-[9px] h-4', getEntityTypeStyle(entity.type))}>
                          {getEntityTypeLabel(entity.type)}
                        </Badge>
                      </div>
                      {entity.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{entity.description}</p>
                      )}
                    </div>
                    {entity.confidence < 1 && (
                      <span className="text-[9px] text-muted-foreground">{Math.round(entity.confidence * 100)}%</span>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Network className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No entities at this point in time</p>
                <p className="text-xs text-muted-foreground mt-1">Try moving the time slider to a different position</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Graph Visualization (simplified) */
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-3 justify-center items-center min-h-[300px]">
              {filteredEntities.map((entity) => {
                const angle = (filteredEntities.indexOf(entity) / filteredEntities.length) * 2 * Math.PI
                const radius = 120
                const x = Math.cos(angle) * radius
                const y = Math.sin(angle) * radius
                return (
                  <motion.div
                    key={entity.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1, x, y }}
                    className="flex flex-col items-center"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2",
                      getEntityTypeStyle(entity.type)
                    )}>
                      {entity.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1 max-w-[60px] truncate text-center">{entity.name}</span>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── v3.0.0 — Agent Hub View ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function AgentHubView() {
  const [agents, setAgents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await api.getAgents()
        if (res.success && res.data?.agents) setAgents(res.data.agents)
      } catch (err) {
        console.error('Failed to fetch agents:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const resetForm = () => {
    setName('')
    setDescription('')
    setSystemPrompt('')
    setMcpEnabled(false)
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      if (editingId) {
        const res = await api.updateAgent(editingId, {
          name: name.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          mcpEnabled,
        })
        if (res.success) {
          setAgents((prev) => prev.map((a) => a.id === editingId ? { ...a, name: name.trim(), description, systemPrompt, mcpEnabled } : a))
          toast.success('Agent updated')
          resetForm()
        } else {
          toast.error(res.error || 'Failed to update agent')
        }
      } else {
        const res = await api.createAgent({
          name: name.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          mcpEnabled,
        })
        if (res.success && res.data) {
          setAgents((prev) => [...prev, res.data])
          toast.success('Agent created')
          resetForm()
        } else {
          toast.error(res.error || 'Failed to create agent')
        }
      }
    } catch {
      toast.error('Failed to save agent')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (agent: any) => {
    setEditingId(agent.id)
    setName(agent.name)
    setDescription(agent.description || '')
    setSystemPrompt(agent.systemPrompt || '')
    setMcpEnabled(agent.mcpEnabled || false)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await api.deleteAgent(id)
      if (res.success) {
        setAgents((prev) => prev.filter((a) => a.id !== id))
        toast.success('Agent deleted')
      } else {
        toast.error(res.error || 'Failed to delete agent')
      }
    } catch {
      toast.error('Failed to delete agent')
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
            <Bot className="w-5 h-5 text-primary" />
            Agent Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage AI agent profiles and MCP access</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm) }}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Agent
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
                <CardTitle className="text-base">{editingId ? 'Edit Agent' : 'Create Agent'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
                <Textarea
                  placeholder="System prompt — define the agent's personality and instructions..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                />
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">MCP Access</p>
                      <p className="text-[10px] text-muted-foreground">Allow this agent to use MCP tools</p>
                    </div>
                  </div>
                  <Switch checked={mcpEnabled} onCheckedChange={setMcpEnabled} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                    {editingId ? 'Update Agent' : 'Create Agent'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Profiles */}
      <div className="space-y-3">
        {agents.length > 0 ? agents.map((agent, i) => {
          const capabilities = agent.capabilities ? (typeof agent.capabilities === 'string' ? JSON.parse(agent.capabilities) : agent.capabilities) : {}
          const capKeys = Object.keys(capabilities)
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">{agent.name}</h3>
                        {agent.mcpEnabled && (
                          <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/30 text-emerald-500">
                            <Plug className="w-2.5 h-2.5 mr-0.5" />
                            MCP
                          </Badge>
                        )}
                        {agent.lastActiveAt && (
                          <Badge variant="outline" className="text-[9px] h-4">
                            Active {formatDistanceToNow(new Date(agent.lastActiveAt), { addSuffix: true })}
                          </Badge>
                        )}
                      </div>
                      {agent.description && (
                        <p className="text-xs text-muted-foreground mb-2">{agent.description}</p>
                      )}
                      {capKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {capKeys.map((key) => (
                            <Badge key={key} variant="secondary" className="text-[9px] h-4">
                              {key}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground/60">
                          Created {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleEdit(agent)}>
                            <Edit3 className="w-3 h-3 mr-0.5" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive hover:text-destructive">
                                <Trash2 className="w-3 h-3 mr-0.5" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(agent.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        }) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No agents yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click &quot;New Agent&quot; to create your first AI agent profile</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
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
            status: (d.status || 'pending') as 'pending' | 'decided' | 'revisited',
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
        decision: title,
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
          status: (res.data.status || 'pending') as 'pending' | 'decided' | 'revisited',
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

  const handleStatusChange = async (decisionId: string, newStatus: 'decided' | 'revisited') => {
    updateDecision(decisionId, { status: newStatus })
    try {
      const res = await api.updateDecision(decisionId, { status: newStatus })
      if (!res.success) {
        updateDecision(decisionId, { status: newStatus === 'decided' ? 'pending' : 'decided' })
        toast.error('Failed to update decision status')
      }
    } catch {
      updateDecision(decisionId, { status: newStatus === 'decided' ? 'pending' : 'decided' })
      toast.error('Failed to update decision status')
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
                            onClick={() => handleStatusChange(decision.id, 'decided')}
                          >
                            Mark Decided
                          </Button>
                        )}
                        {decision.status === 'decided' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => handleStatusChange(decision.id, 'revisited')}
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
  const { setNotes } = useNotesStore()
  const { setDecisions } = useDecisionsStore()
  const [settings, setSettings] = useState<any>(null)
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKey, setShowNewKey] = useState<string | null>(null)

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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your notes, conversations, decisions, API keys, and memory data. Your account will remain but will be completely empty.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        const res = await api.resetAllData()
                        if (res.success) {
                          toast.success('All data has been reset')
                          setNotes([])
                          setDecisions([])
                          setApiKeys([])
                        } else {
                          toast.error(res.error || 'Failed to reset data')
                        }
                      } catch {
                        toast.error('Failed to reset data')
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Reset All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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

      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <p className="text-sm font-medium">Server Active</p>
            <p className="text-xs text-muted-foreground">MCP server running on stdio transport</p>
          </div>
        </CardContent>
      </Card>

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
      case 'graph':
        return <GraphView />
      case 'daily':
        return <DailyNotesView />
      case 'canvas':
        return <CanvasFullView />
      case 'templates':
        return <TemplatesFullView />
      case 'storage':
        return <StorageHubView />
      case 'email':
        return <EmailHubView />
      case 'integrations':
        return <IntegrationsView />
      case 'temporal':
        return <TemporalGraphView />
      case 'agents':
        return <AgentHubView />
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
      <QuickSwitcher />
      <KeyboardShortcutsPanel />
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
