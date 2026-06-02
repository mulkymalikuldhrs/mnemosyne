const API_BASE = '/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  warning?: string
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    if (res.status === 401) {
      window.location.href = '/login'
      return { success: false, error: 'Unauthorized' }
    }

    const data = await res.json()
    return data
  } catch (error) {
    console.error('API Error:', error)
    return { success: false, error: 'Network error' }
  }
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  // Notes
  getNotes: (params?: string) =>
    apiFetch<any>(`/notes${params ? `?${params}` : ''}`),
  getNote: (id: string) =>
    apiFetch<any>(`/notes/${id}`),
  createNote: (data: { title: string; content: string; markdown?: string; tags?: string }) =>
    apiFetch<any>('/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id: string, data: any) =>
    apiFetch<any>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id: string) =>
    apiFetch<any>(`/notes/${id}`, { method: 'DELETE' }),
  getBacklinks: (noteId: string) =>
    apiFetch<any>(`/notes/${noteId}/backlinks`),

  // Chat
  getConversations: () =>
    apiFetch<any>('/chat'),
  getConversation: (id: string) =>
    apiFetch<any>(`/chat/${id}`),
  sendMessage: (message: string, conversationId?: string) =>
    apiFetch<any>('/chat', { method: 'POST', body: JSON.stringify({ message, conversationId }) }),
  deleteConversation: (id: string) =>
    apiFetch<any>(`/chat/${id}`, { method: 'DELETE' }),

  // Search
  semanticSearch: (query: string, limit?: number) =>
    apiFetch<any>(`/search?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`),

  // Memory
  getMemoryContext: (query: string) =>
    apiFetch<any>(`/memory?q=${encodeURIComponent(query)}`),
  getRelatedNotes: (noteId: string) =>
    apiFetch<any>(`/memory/related/${noteId}`),
  getPatterns: () =>
    apiFetch<any>('/memory/patterns'),
  reindexMemory: () =>
    apiFetch<any>('/memory', { method: 'POST' }),

  // Decisions
  getDecisions: (params?: string) =>
    apiFetch<any>(`/decisions${params ? `?${params}` : ''}`),
  getDecision: (id: string) =>
    apiFetch<any>(`/decisions/${id}`),
  createDecision: (data: any) =>
    apiFetch<any>('/decisions', { method: 'POST', body: JSON.stringify(data) }),
  updateDecision: (id: string, data: any) =>
    apiFetch<any>(`/decisions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDecision: (id: string) =>
    apiFetch<any>(`/decisions/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () =>
    apiFetch<any>('/settings'),
  updateSettings: (data: any) =>
    apiFetch<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // API Keys
  getApiKeys: () =>
    apiFetch<any>('/api-keys'),
  createApiKey: (name: string) =>
    apiFetch<any>('/api-keys', { method: 'POST', body: JSON.stringify({ name }) }),

  // Daily Notes
  getDailyNotes: (params?: string) =>
    apiFetch<any>(`/daily-notes${params ? `?${params}` : ''}`),
  getDailyNoteByDate: (date: string) =>
    apiFetch<any>(`/daily-notes/${date}`),
  upsertDailyNote: (data: { date: string; content: string; markdown?: string }) =>
    apiFetch<any>('/daily-notes', { method: 'POST', body: JSON.stringify(data) }),
  updateDailyNote: (date: string, data: { content?: string; markdown?: string }) =>
    apiFetch<any>(`/daily-notes/${date}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDailyNote: (date: string) =>
    apiFetch<any>(`/daily-notes/${date}`, { method: 'DELETE' }),

  // Templates
  getTemplates: (category?: string) =>
    apiFetch<any>(`/templates${category ? `?category=${category}` : ''}`),
  getTemplate: (id: string) =>
    apiFetch<any>(`/templates/${id}`),
  createTemplate: (data: { name: string; description?: string; content: string; category?: string }) =>
    apiFetch<any>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: any) =>
    apiFetch<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    apiFetch<any>(`/templates/${id}`, { method: 'DELETE' }),

  // Favorites
  getFavorites: () =>
    apiFetch<any>('/favorites'),
  addFavorite: (noteId: string) =>
    apiFetch<any>('/favorites', { method: 'POST', body: JSON.stringify({ noteId }) }),
  removeFavorite: (noteId: string) =>
    apiFetch<any>(`/favorites/${noteId}`, { method: 'DELETE' }),

  // Canvas
  getCanvases: () =>
    apiFetch<any>('/canvas'),
  getCanvas: (id: string) =>
    apiFetch<any>(`/canvas/${id}`),
  createCanvas: (data: { title: string; description?: string; data?: string }) =>
    apiFetch<any>('/canvas', { method: 'POST', body: JSON.stringify(data) }),
  updateCanvas: (id: string, data: any) =>
    apiFetch<any>(`/canvas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCanvas: (id: string) =>
    apiFetch<any>(`/canvas/${id}`, { method: 'DELETE' }),

  // Knowledge Graph
  getGraphData: () =>
    apiFetch<any>('/graph'),

  // Wiki Links
  searchWikiLinks: (query: string) =>
    apiFetch<any>(`/wiki-links?q=${encodeURIComponent(query)}`),
  syncWikiLinks: (noteId: string, content: string) =>
    apiFetch<any>('/wiki-links', { method: 'POST', body: JSON.stringify({ noteId, content }) }),
  searchNoteTitles: (query: string) =>
    apiFetch<any>(`/wiki-links?q=${encodeURIComponent(query)}`),
  createWikiLinks: (noteId: string, links: Array<{ targetTitle: string; linkText: string }>) =>
    apiFetch<any>('/wiki-links', { method: 'POST', body: JSON.stringify({ noteId, links }) }),

  // Smart Tags
  generateSmartTags: (data: { content: string; title?: string }) =>
    apiFetch<any>('/smart-tags', { method: 'POST', body: JSON.stringify(data) }),
  getSmartTags: (content: string, existingTags?: string[]) =>
    apiFetch<any>('/smart-tags', { method: 'POST', body: JSON.stringify({ content, existingTags }) }),

  // Daily Notes (additional aliases)
  getDailyNote: (date: string) =>
    apiFetch<any>(`/daily-notes/${date}`),
  saveDailyNote: (date: string, content: string) =>
    apiFetch<any>('/daily-notes', { method: 'POST', body: JSON.stringify({ date, content }) }),
}
