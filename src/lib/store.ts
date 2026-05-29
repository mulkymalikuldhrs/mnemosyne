import { create } from 'zustand'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  isArchived: boolean
  relationScore?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  memoryReferences?: MemoryReference[]
}

export interface MemoryReference {
  noteId: string
  noteTitle: string
  relevance: number
}

export interface Conversation {
  id: string
  title: string
  lastMessageAt: string
  messageCount: number
}

export interface Decision {
  id: string
  title: string
  context: string
  reasoning: string
  alternatives: string
  outcome: string
  status: 'pending' | 'decided' | 'revisited'
  createdAt: string
}

export interface MemoryInsight {
  totalMemories: number
  totalConversations: number
  totalDecisions: number
  topTopics: { tag: string; count: number }[]
  recentPatterns: { type: string; description: string; confidence: number }[]
  weeklyGrowth: { week: string; notes: number }[]
}

export type ActiveSection = 'dashboard' | 'notes' | 'chat' | 'search' | 'decisions' | 'settings' | 'mcp'

// ─── UI Store ────────────────────────────────────────────────────────────────

interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'
  activeSection: ActiveSection
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setActiveSection: (section: ActiveSection) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  theme: 'dark',
  activeSection: 'dashboard',
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setActiveSection: (activeSection) => set({ activeSection }),
}))

// ─── Notes Store ─────────────────────────────────────────────────────────────

interface NotesState {
  notes: Note[]
  searchQuery: string
  sortBy: 'date' | 'title'
  viewMode: 'grid' | 'list'
  selectedNoteId: string | null
  isEditing: boolean
  setNotes: (notes: Note[]) => void
  addNote: (note: Note) => void
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sort: 'date' | 'title') => void
  setViewMode: (mode: 'grid' | 'list') => void
  setSelectedNoteId: (id: string | null) => void
  setIsEditing: (editing: boolean) => void
  getFilteredNotes: () => Note[]
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [
    {
      id: '1',
      title: 'Getting Started with Memorix',
      content: 'Memorix is your AI-powered memory infrastructure. It helps you store, search, and connect your notes, decisions, and conversations using semantic understanding. Start by creating your first note!',
      tags: ['getting-started', 'intro', 'tutorial'],
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      isArchived: false,
    },
    {
      id: '2',
      title: 'Architecture Decision: Embedding Strategy',
      content: 'We chose a hybrid embedding approach that uses external API embeddings when available and falls back to n-gram-based pseudo-embeddings for local development. This ensures the system works offline while maintaining semantic search quality when connected. The n-gram hashing produces vectors where texts with shared substrings have higher cosine similarity.',
      tags: ['architecture', 'embeddings', 'decision'],
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      isArchived: false,
    },
    {
      id: '3',
      title: 'Memory Context Window Design',
      content: 'The memory context window determines how many relevant memories are injected into the LLM prompt. We limit it to the top 5 most relevant memories with a combined token budget of ~2000 tokens. This prevents prompt overflow while maintaining sufficient context for accurate responses. Memories are ranked by cosine similarity to the user query.',
      tags: ['architecture', 'context', 'llm', 'design'],
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      isArchived: false,
    },
    {
      id: '4',
      title: 'MCP Server Integration Notes',
      content: 'The Model Context Protocol server allows AI assistants like Claude and Cursor to directly access your Memorix memory. The server runs as a standalone process communicating via stdio, implementing JSON-RPC 2.0. Eight tools are available: search, add_note, get_note, list_notes, chat, get_related, detect_patterns, and add_decision.',
      tags: ['mcp', 'integration', 'ai-assistant'],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      isArchived: false,
    },
    {
      id: '5',
      title: 'Pattern Detection Algorithms',
      content: 'Memorix detects four types of patterns in your memory: 1) Keyword frequency analysis (stop-word filtered), 2) Temporal focus shifts showing emerging and fading topics, 3) Note volume trends over time, and 4) Knowledge graph connectivity ratio measuring how interconnected your notes are. These patterns help surface insights you might miss.',
      tags: ['algorithms', 'patterns', 'insights', 'ai'],
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      isArchived: false,
    },
    {
      id: '6',
      title: 'Product Roadmap Q3 2025',
      content: 'Key initiatives for Q3: 1) Real-time collaboration on notes, 2) Advanced graph visualization of memory connections, 3) Mobile app with offline sync, 4) API for third-party integrations, 5) Custom embedding model fine-tuning for domain-specific memory. Priority is on collaboration and graph visualization based on user feedback.',
      tags: ['roadmap', 'planning', 'product'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
    },
  ],
  searchQuery: '',
  sortBy: 'date',
  viewMode: 'grid',
  selectedNoteId: null,
  isEditing: false,
  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n)),
    })),
  deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedNoteId: (selectedNoteId) => set({ selectedNoteId }),
  setIsEditing: (isEditing) => set({ isEditing }),
  getFilteredNotes: () => {
    const { notes, searchQuery, sortBy } = get()
    let filtered = notes.filter((n) => !n.isArchived)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    filtered.sort((a, b) => {
      if (sortBy === 'date') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return a.title.localeCompare(b.title)
    })
    return filtered
  },
}))

// ─── Chat Store ──────────────────────────────────────────────────────────────

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  messages: Message[]
  isLoading: boolean
  setConversations: (conversations: Conversation[]) => void
  setCurrentConversationId: (id: string | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  setIsLoading: (loading: boolean) => void
  addConversation: (conversation: Conversation) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [
    { id: 'conv-1', title: 'Memory Architecture Discussion', lastMessageAt: new Date(Date.now() - 3600000).toISOString(), messageCount: 8 },
    { id: 'conv-2', title: 'Embedding Strategy Q&A', lastMessageAt: new Date(Date.now() - 86400000).toISOString(), messageCount: 5 },
    { id: 'conv-3', title: 'Pattern Detection Help', lastMessageAt: new Date(Date.now() - 86400000 * 2).toISOString(), messageCount: 12 },
  ],
  currentConversationId: 'conv-1',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'How does the memory context window work in Memorix?',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'The memory context window in Memorix determines how many relevant memories are injected into the LLM prompt. When you ask a question, Memorix searches your stored notes using semantic similarity, ranks them by relevance, and includes the top results within a ~2000 token budget. This ensures the AI has access to your most relevant knowledge without overflowing the prompt. The system uses cosine similarity between your query embedding and stored note embeddings to rank relevance.',
      timestamp: new Date(Date.now() - 7100000).toISOString(),
      memoryReferences: [
        { noteId: '3', noteTitle: 'Memory Context Window Design', relevance: 0.95 },
        { noteId: '2', noteTitle: 'Architecture Decision: Embedding Strategy', relevance: 0.72 },
      ],
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'What happens when I\'m offline?',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: 'When offline, Memorix falls back to n-gram-based pseudo-embeddings for semantic search. These use character n-gram hashing (3-6 grams) and word-level hashing to produce 768-dimensional vectors. While not as accurate as the external API embeddings, they still provide meaningful similarity search because texts with shared substrings will have higher cosine similarity. Your core functionality — storing, searching, and connecting notes — continues to work seamlessly.',
      timestamp: new Date(Date.now() - 3500000).toISOString(),
      memoryReferences: [
        { noteId: '2', noteTitle: 'Architecture Decision: Embedding Strategy', relevance: 0.92 },
        { noteId: '5', noteTitle: 'Pattern Detection Algorithms', relevance: 0.45 },
      ],
    },
  ],
  isLoading: false,
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setIsLoading: (isLoading) => set({ isLoading }),
  addConversation: (conversation) => set((s) => ({ conversations: [conversation, ...s.conversations] })),
}))

// ─── Memory Store ────────────────────────────────────────────────────────────

interface MemoryState {
  insights: MemoryInsight | null
  relatedNotes: Note[]
  isLoadingInsights: boolean
  setInsights: (insights: MemoryInsight) => void
  setRelatedNotes: (notes: Note[]) => void
  setIsLoadingInsights: (loading: boolean) => void
}

export const useMemoryStore = create<MemoryState>((set) => ({
  insights: {
    totalMemories: 6,
    totalConversations: 3,
    totalDecisions: 2,
    topTopics: [
      { tag: 'architecture', count: 3 },
      { tag: 'ai', count: 2 },
      { tag: 'embeddings', count: 2 },
      { tag: 'integration', count: 1 },
      { tag: 'patterns', count: 1 },
    ],
    recentPatterns: [
      { type: 'emerging_topic', description: 'Growing focus on embedding and vector strategies', confidence: 0.87 },
      { type: 'knowledge_cluster', description: 'Architecture decisions are forming a connected cluster', confidence: 0.79 },
      { type: 'temporal_shift', description: 'Recent notes focus more on integration patterns', confidence: 0.65 },
    ],
    weeklyGrowth: [
      { week: 'W1', notes: 1 },
      { week: 'W2', notes: 2 },
      { week: 'W3', notes: 1 },
      { week: 'W4', notes: 2 },
      { week: 'W5', notes: 0 },
      { week: 'W6', notes: 3 },
      { week: 'W7', notes: 1 },
    ],
  },
  relatedNotes: [],
  isLoadingInsights: false,
  setInsights: (insights) => set({ insights }),
  setRelatedNotes: (relatedNotes) => set({ relatedNotes }),
  setIsLoadingInsights: (isLoadingInsights) => set({ isLoadingInsights }),
}))

// ─── Decisions Store ─────────────────────────────────────────────────────────

interface DecisionsState {
  decisions: Decision[]
  addDecision: (decision: Decision) => void
  updateDecision: (id: string, updates: Partial<Decision>) => void
}

export const useDecisionsStore = create<DecisionsState>((set) => ({
  decisions: [
    {
      id: 'dec-1',
      title: 'Use SQLite for Local-First Storage',
      context: 'Need a database that works locally without external dependencies',
      reasoning: 'SQLite provides zero-config, file-based storage perfect for a local-first SaaS. It supports full SQL, is highly reliable, and can be easily migrated to PostgreSQL for production.',
      alternatives: 'PostgreSQL (requires server), IndexedDB (limited query support), LevelDB (no SQL)',
      outcome: 'Enables offline-first architecture with simple deployment',
      status: 'decided',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: 'dec-2',
      title: 'Hybrid Embedding Strategy',
      context: 'Need semantic search that works both online and offline',
      reasoning: 'Using external API embeddings when available provides best quality. N-gram fallback ensures the system remains functional offline with reasonable similarity search capability.',
      alternatives: 'Always-online embeddings, always-local embeddings, no semantic search',
      outcome: 'Best of both worlds — quality when connected, functionality when offline',
      status: 'decided',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ],
  addDecision: (decision) => set((s) => ({ decisions: [decision, ...s.decisions] })),
  updateDecision: (id, updates) =>
    set((s) => ({
      decisions: s.decisions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
}))
