'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Save, Archive, FileText, X, Sparkles, Loader2, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { useNotesStore } from '@/lib/store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SmartTags } from './smart-tags'
import { BacklinksPanel } from './backlinks-panel'
import { OutlineView } from './outline-view'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Refs for auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestTitleRef = useRef(title)
  const latestContentRef = useRef(content)
  const latestTagsRef = useRef(tagsInput)

  // Keep refs in sync
  useEffect(() => { latestTitleRef.current = title }, [title])
  useEffect(() => { latestContentRef.current = content }, [content])
  useEffect(() => { latestTagsRef.current = tagsInput }, [tagsInput])

  // Parse tags from input
  const currentTags = useMemo(() => {
    return tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
  }, [tagsInput])

  // ── Auto-save logic ──
  const performAutoSave = useCallback(async () => {
    if (!existingNote) return // Don't auto-save new notes (no id yet)
    if (isSaving) return

    const currentTitle = latestTitleRef.current
    const currentContent = latestContentRef.current
    const currentTags = latestTagsRef.current

    if (!currentTitle.trim() && !currentContent.trim()) return

    setSaveStatus('saving')
    try {
      const tags = currentTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const res = await api.updateNote(existingNote.id, {
        title: currentTitle,
        content: currentContent,
        tags: tags.join(', '),
      })
      if (res.success && res.data) {
        updateNote(existingNote.id, {
          title: res.data.title,
          content: res.data.content,
          tags: res.data.tags ? res.data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          updatedAt: res.data.updatedAt,
        })
        setSaveStatus('saved')
        // Reset to idle after 3 seconds
        setTimeout(() => setSaveStatus((prev) => prev === 'saved' ? 'idle' : prev), 3000)
      } else {
        setSaveStatus('unsaved')
      }
    } catch {
      setSaveStatus('unsaved')
    }
  }, [existingNote, isSaving, updateNote])

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    setSaveStatus('unsaved')
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave()
    }, 1500)
  }, [performAutoSave])

  const cancelAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // ── Handlers ──
  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (existingNote) scheduleAutoSave()
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    if (existingNote) scheduleAutoSave()
  }

  const handleTagsChange = (value: string) => {
    setTagsInput(value)
    if (existingNote) scheduleAutoSave()
  }

  const handleSave = async () => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    // Cancel any pending auto-save
    cancelAutoSave()
    setIsSaving(true)
    setSaveStatus('saving')
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
          setSaveStatus('saved')
          toast.success('Note updated')
          setIsEditing(false)
          onClose?.()
        } else {
          setSaveStatus('unsaved')
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
          setSaveStatus('saved')
          toast.success('Note created')
          setIsEditing(false)
          onClose?.()
        } else {
          setSaveStatus('unsaved')
          toast.error(res.error || 'Failed to create note')
        }
      }
    } catch {
      setSaveStatus('unsaved')
      toast.error('Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!existingNote) return
    cancelAutoSave()
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
    cancelAutoSave()
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

  const handleAddTag = (tag: string) => {
    if (!currentTags.includes(tag)) {
      const newTagsInput = tagsInput ? `${tagsInput}, ${tag}` : tag
      setTagsInput(newTagsInput)
      if (existingNote) scheduleAutoSave()
    }
  }

  const handleRemoveTag = (tag: string) => {
    const newTagsInput = tagsInput
      .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== tag)
        .join(', ')
    setTagsInput(newTagsInput)
    if (existingNote) scheduleAutoSave()
  }

  const handleHeadingClick = (headingIndex: number) => {
    // Scroll to heading in textarea (simple approach)
    const lines = content.split('\n')
    let headingCount = 0
    let charIndex = 0
    for (let i = 0; i < lines.length; i++) {
      if (/^#{1,3}\s+/.test(lines[i])) {
        if (headingCount === headingIndex) {
          const textarea = document.querySelector('textarea')
          if (textarea) {
            textarea.focus()
            textarea.setSelectionRange(charIndex, charIndex)
          }
          break
        }
        headingCount++
      }
      charIndex += lines[i].length + 1
    }
  }

  // Get related notes based on tag overlap
  const relatedNotes = notes.filter((n) => {
    if (n.id === noteId || n.isArchived) return false
    const currentTagsLower = currentTags.map((t) => t.toLowerCase())
    return n.tags.some((t) => currentTagsLower.includes(t.toLowerCase()))
  })

  // Save status indicator
  const statusIndicator = useMemo(() => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </span>
        )
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-500">
            <Check className="w-3 h-3" />
            Saved
          </span>
        )
      case 'unsaved':
        return (
          <span className="text-xs text-amber-500">Unsaved changes</span>
        )
      default:
        return null
    }
  }, [saveStatus])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{existingNote ? 'Edit Note' : 'New Note'}</h2>
          {statusIndicator}
        </div>
        <div className="flex items-center gap-2">
          {existingNote && (
            <>
              <Button variant="ghost" size="sm" onClick={handleArchive} className="text-muted-foreground">
                <Archive className="w-4 h-4 mr-1.5" />
                Archive
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={isDeleting}>
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Note</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &ldquo;{existingNote.title || 'Untitled Note'}&rdquo;? This action cannot be undone and will permanently remove this note from your memory.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Note
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

      {/* Main content area with side panel */}
      <div className="flex-1 flex min-h-0">
        {/* Editor Body */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          <Input
            placeholder="Note title..."
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-xl font-semibold border-0 px-0 h-auto py-1 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/50"
          />

          <div className="relative">
            <Textarea
              placeholder="Write your note here... Markdown is supported. Use [[wiki-links]] to connect notes."
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
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
              onChange={(e) => handleTagsChange(e.target.value)}
              className="h-9"
            />
            {currentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {currentTags.map((tag, i) => (
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

        {/* Right Side Panel - Outline, Smart Tags, Backlinks */}
        {existingNote && (
          <div className="hidden md:flex w-[280px] border-l border-border flex-col shrink-0 overflow-y-auto">
            <OutlineView
              content={content}
              onHeadingClick={handleHeadingClick}
            />
            <SmartTags
              content={content}
              existingTags={currentTags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
            <BacklinksPanel
              noteId={existingNote.id}
              onNavigateToNote={(id) => {
                setSelectedNoteId(id)
                setIsEditing(true)
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
