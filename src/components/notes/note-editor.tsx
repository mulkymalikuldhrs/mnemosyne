'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Archive, FileText, X, Sparkles, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useNotesStore } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NoteEditorProps {
  noteId?: string | null
  onClose?: () => void
}

export function NoteEditor({ noteId, onClose }: NoteEditorProps) {
  const { notes, addNote, updateNote, deleteNote, setSelectedNoteId, setIsEditing } = useNotesStore()
  const existingNote = noteId ? notes.find((n) => n.id === noteId) : null

  const [title, setTitle] = useState(existingNote?.title ?? '')
  const [content, setContent] = useState(existingNote?.content ?? '')
  const [tagsInput, setTagsInput] = useState(existingNote?.tags.join(', ') ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSave = async () => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setIsSaving(true)
    try {
      if (existingNote) {
        // Update existing note via API
        const res = await api.updateNote(existingNote.id, {
          title,
          content,
          tags: tags.join(', '),
        })
        if (res.success && res.data) {
          updateNote(existingNote.id, {
            title: res.data.title,
            content: res.data.content,
            tags: res.data.tags ? res.data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
            updatedAt: res.data.updatedAt,
          })
          toast.success('Note updated')
          setIsEditing(false)
          onClose?.()
        } else {
          toast.error(res.error || 'Failed to update note')
        }
      } else {
        // Create new note via API
        const res = await api.createNote({
          title: title || 'Untitled Note',
          content,
          tags: tags.join(', '),
        })
        if (res.success && res.data) {
          const newNote = {
            id: res.data.id,
            title: res.data.title,
            content: res.data.content,
            tags: res.data.tags ? res.data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
            createdAt: res.data.createdAt,
            updatedAt: res.data.updatedAt,
            isArchived: res.data.isArchived,
          }
          addNote(newNote)
          setSelectedNoteId(newNote.id)
          toast.success('Note created')
          setIsEditing(false)
          onClose?.()
        } else {
          toast.error(res.error || 'Failed to create note')
        }
      }
    } catch {
      toast.error('Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!existingNote) return
    try {
      const res = await api.updateNote(existingNote.id, { isArchived: true })
      if (res.success) {
        updateNote(existingNote.id, { isArchived: true })
        setSelectedNoteId(null)
        setIsEditing(false)
        onClose?.()
        toast.success('Note archived')
      } else {
        toast.error(res.error || 'Failed to archive note')
      }
    } catch {
      toast.error('Failed to archive note')
    }
  }

  const handleDelete = async () => {
    if (!existingNote) return
    setIsDeleting(true)
    try {
      const res = await api.deleteNote(existingNote.id)
      if (res.success) {
        deleteNote(existingNote.id)
        setSelectedNoteId(null)
        setIsEditing(false)
        onClose?.()
        toast.success('Note deleted')
      } else {
        toast.error(res.error || 'Failed to delete note')
      }
    } catch {
      toast.error('Failed to delete note')
    } finally {
      setIsDeleting(false)
    }
  }

  // Get related notes based on tag overlap
  const relatedNotes = notes.filter((n) => {
    if (n.id === noteId || n.isArchived) return false
    const currentTags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    return n.tags.some((t) => currentTags.includes(t.toLowerCase()))
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{existingNote ? 'Edit Note' : 'New Note'}</h2>
        </div>
        <div className="flex items-center gap-2">
          {existingNote && (
            <>
              <Button variant="ghost" size="sm" onClick={handleArchive} className="text-muted-foreground">
                <Archive className="w-4 h-4 mr-1.5" />
                Archive
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive" disabled={isDeleting}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </>
          )}
          <Button size="sm" onClick={handleSave} disabled={(!title.trim() && !content.trim()) || isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        <Input
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-semibold border-0 px-0 h-auto py-1 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/50"
        />

        <div className="relative">
          <Textarea
            placeholder="Write your note here... Markdown is supported"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] resize-none border-0 px-0 focus-visible:ring-0 bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/50"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <Sparkles className="w-3 h-3" />
            Markdown
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</label>
          <Input
            placeholder="Enter tags separated by commas..."
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="h-9"
          />
          {tagsInput && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tagsInput
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
            </div>
          )}
        </div>

        {/* Related Notes */}
        {relatedNotes.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Related Notes
              </h3>
              <div className="space-y-2">
                {relatedNotes.slice(0, 5).map((note) => (
                  <button
                    key={note.id}
                    onClick={() => {
                      setSelectedNoteId(note.id)
                      setIsEditing(true)
                    }}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{note.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {note.content.slice(0, 80)}...
                    </p>
                    <div className="flex gap-1 mt-1.5">
                      {note.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1.5">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
