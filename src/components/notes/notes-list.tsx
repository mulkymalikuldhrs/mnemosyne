'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Grid3X3, List, Search, SlidersHorizontal, FileText, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NoteCard } from './note-card'
import { NoteEditor } from './note-editor'
import { useNotesStore } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function NotesList() {
  const {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    selectedNoteId,
    setSelectedNoteId,
    isEditing,
    setIsEditing,
    isLoading,
    setIsLoading,
    setNotes,
    getFilteredNotes,
  } = useNotesStore()

  const [showEditor, setShowEditor] = useState(false)

  // Fetch notes from API on mount
  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true)
      try {
        const res = await api.getNotes('limit=100')
        if (res.success && res.data?.notes) {
          const mapped = res.data.notes.map((n: any) => ({
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
      } catch (err) {
        console.error('Failed to fetch notes:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchNotes()
  }, [setNotes, setIsLoading])

  const filteredNotes = useMemo(() => getFilteredNotes(), [getFilteredNotes, searchQuery, sortBy])

  const handleNewNote = () => {
    setSelectedNoteId(null)
    setIsEditing(true)
    setShowEditor(true)
  }

  const handleNoteClick = (id: string) => {
    setSelectedNoteId(id)
    setIsEditing(true)
    setShowEditor(true)
  }

  if (showEditor) {
    return (
      <NoteEditor
        noteId={selectedNoteId}
        onClose={() => {
          setShowEditor(false)
          setIsEditing(false)
          setSelectedNoteId(null)
        }}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0"
          />
        </div>

        <Select value={sortBy} onValueChange={(v: 'date' | 'title') => setSortBy(v)}>
          <SelectTrigger className="w-[130px] h-9">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="title">Sort by Title</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex border border-border rounded-md overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 rounded-none', viewMode === 'grid' && 'bg-accent')}
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 rounded-none', viewMode === 'list' && 'bg-accent')}
            onClick={() => setViewMode('list')}
          >
            <List className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button size="sm" onClick={handleNewNote}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Note
        </Button>
      </div>

      {/* Notes Grid/List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {filteredNotes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No notes found</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first note to start building your memory'}
            </p>
            <Button onClick={handleNewNote}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Note
            </Button>
          </motion.div>
        ) : (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'flex flex-col gap-3 max-w-3xl'
            )}
          >
            <AnimatePresence mode="popLayout">
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={() => handleNoteClick(note.id)}
                  compact={viewMode === 'list'}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
