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
  createDecision: (data: any) =>
    apiFetch<any>('/decisions', { method: 'POST', body: JSON.stringify(data) }),

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
}
