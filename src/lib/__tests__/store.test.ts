import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore, useNotesStore } from '../store'

describe('UI Store', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeSection: 'dashboard',
      sidebarCollapsed: false,
    })
  })

  it('should have correct initial state', () => {
    const state = useUIStore.getState()
    expect(state.activeSection).toBe('dashboard')
    expect(state.sidebarCollapsed).toBe(false)
  })

  it('should set active section', () => {
    useUIStore.getState().setActiveSection('notes')
    expect(useUIStore.getState().activeSection).toBe('notes')
  })

  it('should set active section to different values', () => {
    const sections = ['dashboard', 'notes', 'chat', 'search', 'decisions', 'settings', 'mcp', 'graph', 'llm-marketplace', 'agent-chat', 'api-hub']
    for (const section of sections) {
      useUIStore.getState().setActiveSection(section)
      expect(useUIStore.getState().activeSection).toBe(section)
    }
  })

  it('should toggle sidebar from false to true', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
  })

  it('should toggle sidebar back from true to false', () => {
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should handle multiple rapid section changes', () => {
    useUIStore.getState().setActiveSection('notes')
    useUIStore.getState().setActiveSection('chat')
    useUIStore.getState().setActiveSection('search')
    expect(useUIStore.getState().activeSection).toBe('search')
  })

  it('should handle setting same section value', () => {
    useUIStore.getState().setActiveSection('dashboard')
    useUIStore.getState().setActiveSection('dashboard')
    expect(useUIStore.getState().activeSection).toBe('dashboard')
  })

  it('should maintain independent state for section and sidebar', () => {
    useUIStore.getState().setActiveSection('llm-marketplace')
    useUIStore.getState().toggleSidebar()
    const state = useUIStore.getState()
    expect(state.activeSection).toBe('llm-marketplace')
    expect(state.sidebarCollapsed).toBe(true)
  })
})

describe('Notes Store', () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [],
      selectedNoteId: null,
      searchQuery: '',
    })
  })

  it('should have correct initial state', () => {
    const state = useNotesStore.getState()
    expect(state.notes).toEqual([])
    expect(state.selectedNoteId).toBeNull()
    expect(state.searchQuery).toBe('')
  })

  it('should set search query', () => {
    useNotesStore.getState().setSearchQuery('machine learning')
    expect(useNotesStore.getState().searchQuery).toBe('machine learning')
  })

  it('should set selected note id', () => {
    useNotesStore.getState().setSelectedNoteId('note-123')
    expect(useNotesStore.getState().selectedNoteId).toBe('note-123')
  })

  it('should clear search query', () => {
    useNotesStore.getState().setSearchQuery('test')
    useNotesStore.getState().setSearchQuery('')
    expect(useNotesStore.getState().searchQuery).toBe('')
  })

  it('should set selected note id to null', () => {
    useNotesStore.getState().setSelectedNoteId('note-123')
    useNotesStore.getState().setSelectedNoteId(null)
    expect(useNotesStore.getState().selectedNoteId).toBeNull()
  })

  it('should add a note', () => {
    const note = { id: 'n1', title: 'Test', content: 'Hello', tags: [], createdAt: '', updatedAt: '', isArchived: false }
    useNotesStore.getState().addNote(note)
    expect(useNotesStore.getState().notes).toHaveLength(1)
    expect(useNotesStore.getState().notes[0].id).toBe('n1')
  })

  it('should delete a note', () => {
    const note = { id: 'n1', title: 'Test', content: 'Hello', tags: [], createdAt: '', updatedAt: '', isArchived: false }
    useNotesStore.getState().addNote(note)
    useNotesStore.getState().deleteNote('n1')
    expect(useNotesStore.getState().notes).toHaveLength(0)
  })

  it('should maintain independent state for different properties', () => {
    useNotesStore.getState().setSearchQuery('test query')
    useNotesStore.getState().setSelectedNoteId('note-456')
    const state = useNotesStore.getState()
    expect(state.searchQuery).toBe('test query')
    expect(state.selectedNoteId).toBe('note-456')
  })
})
