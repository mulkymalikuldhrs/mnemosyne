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
  isFavorite?: boolean
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

export type ActiveSection = 'dashboard' | 'notes' | 'chat' | 'search' | 'decisions' | 'settings' | 'mcp' | 'graph' | 'daily' | 'canvas' | 'templates' | 'storage' | 'email' | 'integrations' | 'temporal' | 'agents' | 'llm-marketplace' | 'agent-chat' | 'api-hub'

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
  isLoading: boolean
  setNotes: (notes: Note[]) => void
  addNote: (note: Note) => void
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sort: 'date' | 'title') => void
  setViewMode: (mode: 'grid' | 'list') => void
  setSelectedNoteId: (id: string | null) => void
  setIsEditing: (editing: boolean) => void
  setIsLoading: (loading: boolean) => void
  getFilteredNotes: () => Note[]
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  searchQuery: '',
  sortBy: 'date',
  viewMode: 'grid',
  selectedNoteId: null,
  isEditing: false,
  isLoading: false,
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
  setIsLoading: (isLoading) => set({ isLoading }),
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
  resetChat: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isLoading: false,
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setIsLoading: (isLoading) => set({ isLoading }),
  addConversation: (conversation) => set((s) => ({ conversations: [conversation, ...s.conversations] })),
  resetChat: () => set({ messages: [], currentConversationId: null }),
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
  insights: null,
  relatedNotes: [],
  isLoadingInsights: false,
  setInsights: (insights) => set({ insights }),
  setRelatedNotes: (relatedNotes) => set({ relatedNotes }),
  setIsLoadingInsights: (isLoadingInsights) => set({ isLoadingInsights }),
}))

// ─── Decisions Store ─────────────────────────────────────────────────────────

interface DecisionsState {
  decisions: Decision[]
  isLoading: boolean
  setDecisions: (decisions: Decision[]) => void
  addDecision: (decision: Decision) => void
  updateDecision: (id: string, updates: Partial<Decision>) => void
  setIsLoading: (loading: boolean) => void
}

export const useDecisionsStore = create<DecisionsState>((set) => ({
  decisions: [],
  isLoading: false,
  setDecisions: (decisions) => set({ decisions }),
  addDecision: (decision) => set((s) => ({ decisions: [decision, ...s.decisions] })),
  updateDecision: (id, updates) =>
    set((s) => ({
      decisions: s.decisions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
  setIsLoading: (isLoading) => set({ isLoading }),
}))

// ─── Favorites Store ─────────────────────────────────────────────────────────

interface FavoritesState {
  favoriteNoteIds: string[]
  setFavoriteNoteIds: (ids: string[]) => void
  toggleFavorite: (noteId: string) => void
  isFavorite: (noteId: string) => boolean
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteNoteIds: [],
  setFavoriteNoteIds: (favoriteNoteIds) => set({ favoriteNoteIds }),
  toggleFavorite: (noteId) => set((s) => ({
    favoriteNoteIds: s.favoriteNoteIds.includes(noteId)
      ? s.favoriteNoteIds.filter((id) => id !== noteId)
      : [...s.favoriteNoteIds, noteId],
  })),
  isFavorite: (noteId) => get().favoriteNoteIds.includes(noteId),
}))
