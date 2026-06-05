// ============================================================
// MEMORIX — TypeScript Type Definitions
// AI Memory SaaS: notes, conversations, decisions, insights,
// wiki-links, canvases, templates, and API responses.
// ============================================================

// --- Core Domain Types ---

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

// --- Active Section (Navigation) ---

export type ActiveSection =
  | 'dashboard'
  | 'notes'
  | 'chat'
  | 'search'
  | 'decisions'
  | 'settings'
  | 'mcp'
  | 'graph'
  | 'daily'
  | 'canvas'
  | 'templates'

// --- API Response Types ---

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number
  page?: number
  limit?: number
}

// --- Canvas Types ---

export interface Canvas {
  id: string
  title: string
  description?: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  createdAt: string
  updatedAt: string
}

export interface CanvasNode {
  id: string
  type: 'note' | 'text' | 'image' | 'link'
  x: number
  y: number
  width: number
  height: number
  data: Record<string, unknown>
}

export interface CanvasEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  label?: string
}

// --- Template Types ---

export interface Template {
  id: string
  name: string
  description: string
  category: TemplateCategory
  content: string
  variables: TemplateVariable[]
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

export type TemplateCategory =
  | 'meeting'
  | 'decision'
  | 'review'
  | 'brainstorm'
  | 'daily'
  | 'custom'

export interface TemplateVariable {
  name: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'list' | 'select'
  defaultValue?: string
  options?: string[]
  required?: boolean
}

// --- Daily Note Types ---

export interface DailyNote {
  id: string
  date: string // YYYY-MM-DD
  content: string
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible'
  highlights: string[]
  tasks: DailyNoteTask[]
  createdAt: string
  updatedAt: string
}

export interface DailyNoteTask {
  id: string
  text: string
  completed: boolean
}

// --- WikiLink Types ---

export interface WikiLink {
  id: string
  sourceNoteId: string
  targetNoteId: string
  context?: string
  createdAt: string
}

export interface WikiLinkSuggestion {
  id: string
  title: string
}

// --- Memory Link Types ---

export interface MemoryLink {
  id: string
  sourceNoteId: string
  targetNoteId: string
  relationScore: number
  reason?: string
  createdAt: string
}

// --- Search Types ---

export interface SearchResult {
  noteId: string
  title: string
  excerpt: string
  score: number
  highlights: string[]
}

// --- Pattern Types ---

export interface Pattern {
  id: string
  type: string
  description: string
  confidence: number
  relatedNoteIds: string[]
  createdAt: string
}

// --- User Plan Types ---

export type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE'

// --- API Key Types ---

export interface ApiKeyInfo {
  id: string
  name: string
  keyMasked: string
  lastUsedAt?: string | null
  createdAt: string
}
