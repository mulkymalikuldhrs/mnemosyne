'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Calendar, Plus, Loader2,
  FileText, Clock, Link2, Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, isToday, isSameDay, parseISO } from 'date-fns'
import { toast } from 'sonner'

interface DailyNote {
  id: string
  date: string
  content: string
  markdown: string
  createdAt: string
  updatedAt: string
}

interface NoteItem {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function DailyNotes() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekOffset, setWeekOffset] = useState(0)
  const [dailyNote, setDailyNote] = useState<DailyNote | null>(null)
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [allDailyNotes, setAllDailyNotes] = useState<DailyNote[]>([])
  const [dayNotes, setDayNotes] = useState<NoteItem[]>([])
  const [autoCreated, setAutoCreated] = useState(false)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // Compute current week dates
  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return addDays(base, weekOffset * 7)
  }, [weekOffset])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  // Fetch all daily notes for indicators
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await api.getDailyNotes()
        if (res.success && res.data?.dailyNotes) {
          setAllDailyNotes(res.data.dailyNotes)
        }
      } catch (err) {
        console.error('Failed to fetch daily notes:', err)
      }
    }
    fetchAll()
  }, [])

  // Fetch or create daily note for selected date
  const fetchDailyNote = useCallback(async (date: string) => {
    setIsLoading(true)
    try {
      const res = await api.getDailyNoteByDate(date)
      if (res.success && res.data) {
        setDailyNote(res.data)
        setContent(res.data.content || res.data.markdown || '')
      } else {
        // No note found — auto-create today's note on first visit
        if (isToday(selectedDate) && !autoCreated) {
          setAutoCreated(true)
          await autoCreateDailyNote(date)
        } else {
          setDailyNote(null)
          setContent('')
        }
      }
    } catch {
      setDailyNote(null)
      setContent('')
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate, autoCreated])

  // Auto-create today's note with daily template
  const autoCreateDailyNote = async (date: string) => {
    try {
      // Try to get a daily template
      let templateContent = `# ${format(selectedDate, 'yyyy-MM-dd')} - ${format(selectedDate, 'EEEE')}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n`

      const templatesRes = await api.getTemplates('category=daily')
      if (templatesRes.success && templatesRes.data?.templates?.length > 0) {
        const dailyTemplate = templatesRes.data.templates[0]
        const now = new Date()
        templateContent = dailyTemplate.content
          .replace(/\{\{date\}\}/g, date)
          .replace(/\{\{day_of_week\}\}/g, format(selectedDate, 'EEEE'))
          .replace(/\{\{time\}\}/g, format(now, 'HH:mm'))
          .replace(/\{\{title\}\}/g, `Daily Note - ${date}`)
      }

      const res = await api.upsertDailyNote({
        date,
        content: templateContent,
        markdown: templateContent,
      })
      if (res.success && res.data) {
        setDailyNote(res.data)
        setContent(templateContent)
        setAllDailyNotes((prev) => {
          const exists = prev.find((dn) => dn.date === date)
          if (exists) return prev
          return [res.data, ...prev]
        })
        toast.success('Daily note created')
      }
    } catch (err) {
      console.error('Failed to auto-create daily note:', err)
      setDailyNote(null)
      setContent('')
    }
  }

  useEffect(() => {
    fetchDailyNote(dateStr)
  }, [dateStr, fetchDailyNote])

  // Fetch notes created on this day
  useEffect(() => {
    const fetchDayNotes = async () => {
      try {
        const startOfDay = new Date(selectedDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(selectedDate)
        endOfDay.setHours(23, 59, 59, 999)

        const res = await api.getNotes(`limit=20`)
        if (res.success && res.data?.notes) {
          const filtered = res.data.notes
            .filter((n: any) => {
              const created = new Date(n.createdAt)
              return created >= startOfDay && created <= endOfDay
            })
            .map((n: any) => ({
              id: n.id,
              title: n.title,
              content: n.content,
              tags: n.tags ? n.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
            }))
          setDayNotes(filtered)
        }
      } catch (err) {
        console.error('Failed to fetch day notes:', err)
      }
    }
    fetchDayNotes()
  }, [selectedDate])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await api.upsertDailyNote({
        date: dateStr,
        content,
        markdown: content,
      })
      if (res.success && res.data) {
        setDailyNote(res.data)
        setAllDailyNotes((prev) => {
          const exists = prev.find((dn) => dn.date === dateStr)
          if (exists) {
            return prev.map((dn) => dn.date === dateStr ? res.data : dn)
          }
          return [res.data, ...prev]
        })
        toast.success('Daily note saved')
      }
    } catch (err) {
      console.error('Failed to save daily note:', err)
      toast.error('Failed to save daily note')
    } finally {
      setIsSaving(false)
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekOffset((prev) => direction === 'next' ? prev + 1 : prev - 1)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
    setWeekOffset(0)
  }

  const hasNoteOnDate = (date: Date) => {
    const ds = format(date, 'yyyy-MM-dd')
    return allDailyNotes.some((dn) => dn.date === ds)
  }

  // Get wiki links from content
  const wikiLinks = useMemo(() => {
    const regex = /\[\[([^\]]+)\]\]/g
    const links: string[] = []
    let match
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1])
    }
    return [...new Set(links)]
  }, [content])

  // Recent activity for the day — show the last few updated notes
  const recentActivity = useMemo(() => {
    return dayNotes.slice(0, 5)
  }, [dayNotes])

  return (
    <div className="h-full flex flex-col">
      {/* Week Strip */}
      <div className="border-b border-border bg-card px-4 md:px-6 py-3 shrink-0">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => navigateWeek('prev')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 flex items-center justify-between gap-1">
            {weekDays.map((day, i) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr
              const isTodayDate = isToday(day)
              const hasNote = hasNoteOnDate(day)

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[48px]',
                    'hover:bg-accent/50',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                    !isSelected && isTodayDate && 'ring-2 ring-primary/40',
                  )}
                >
                  <span className={cn(
                    'text-[10px] font-medium uppercase tracking-wider',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}>
                    {WEEKDAYS[i]}
                  </span>
                  <span className={cn(
                    'text-lg font-semibold leading-none',
                    !isSelected && isTodayDate && 'text-primary',
                  )}>
                    {format(day, 'd')}
                  </span>
                  {hasNote && !isSelected && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                  {!hasNote && !isSelected && <div className="w-1 h-1" />}
                </button>
              )
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => navigateWeek('next')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Date Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h2>
                {isToday(selectedDate) && (
                  <Badge variant="secondary" className="text-[10px] h-4 mt-0.5">Today</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Today
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Textarea
                placeholder={`Write your daily note for ${format(selectedDate, 'MMMM d')}...\n\nUse [[wiki-links]] to connect to other notes.`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[400px] resize-none border-0 px-0 focus-visible:ring-0 bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/50"
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-4 md:px-6 py-2 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between shrink-0">
            <span>{dailyNote ? `Last updated ${format(new Date(dailyNote.updatedAt), 'h:mm a')}` : 'New daily note'}</span>
            <span>{content.split(/\s+/).filter(Boolean).length} words</span>
          </div>

          {/* Notes created on this day */}
          {dayNotes.length > 0 && (
            <div className="border-t border-border px-4 md:px-6 py-3 shrink-0">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-primary" />
                Notes created on this day ({dayNotes.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {dayNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer text-xs"
                  >
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[150px] font-medium">{note.title}</span>
                    {note.tags.length > 0 && (
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
                        {note.tags[0]}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Linked Notes & Recent Activity */}
        <div className="hidden md:flex w-[240px] border-l border-border bg-card/50 flex-col shrink-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              {/* Linked Notes */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3 h-3 text-primary" />
                  Linked Notes
                  {wikiLinks.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                      {wikiLinks.length}
                    </Badge>
                  )}
                </h4>
                {wikiLinks.length > 0 ? (
                  <div className="space-y-1">
                    {wikiLinks.map((link) => (
                      <div
                        key={link}
                        className="text-xs text-primary hover:underline cursor-pointer truncate py-1 px-2 rounded hover:bg-accent/30 transition-colors"
                      >
                        [[{link}]]
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground py-1">
                    Use [[wiki-links]] to connect notes
                  </p>
                )}
              </div>

              <Separator />

              {/* Recent Activity */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-primary" />
                  Recent Activity
                  {recentActivity.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                      {recentActivity.length}
                    </Badge>
                  )}
                </h4>
                {recentActivity.length > 0 ? (
                  <div className="space-y-1.5">
                    {recentActivity.map((note) => (
                      <div
                        key={note.id}
                        className="text-xs p-2 rounded-md border border-border hover:bg-accent/30 transition-colors cursor-pointer"
                      >
                        <p className="font-medium truncate">{note.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(note.createdAt), 'h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground py-1">
                    No activity on this day yet
                  </p>
                )}
              </div>

              <Separator />

              {/* Quick Stats */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-primary" />
                  Day Stats
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Words</span>
                    <span className="font-medium">{content.split(/\s+/).filter(Boolean).length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Links</span>
                    <span className="font-medium">{wikiLinks.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="font-medium">{dayNotes.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
