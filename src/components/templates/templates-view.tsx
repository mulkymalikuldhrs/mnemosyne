'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, FileCode2, Trash2, Copy, Loader2, Calendar,
  Briefcase, GitBranch, FileText, Star, X, Search,
  Sparkles, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  description: string
  content: string
  category: string
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

// Built-in templates
const BUILT_IN_TEMPLATES: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Daily Note',
    description: 'Capture your daily tasks, notes, and reflections',
    content: '# {{date}} - {{day_of_week}}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n',
    category: 'daily',
    isBuiltIn: true,
  },
  {
    name: 'Meeting Notes',
    description: 'Document meeting attendees, agenda, and action items',
    content: '# Meeting: {{title}}\n**Date**: {{date}}\n\n## Attendees\n- \n\n## Agenda\n1. \n\n## Discussion\n\n## Action Items\n- [ ] \n',
    category: 'meeting',
    isBuiltIn: true,
  },
  {
    name: 'Project Brief',
    description: 'Outline project overview, goals, timeline, and risks',
    content: '# {{title}}\n\n## Overview\n\n## Goals\n- \n\n## Timeline\n\n## Resources\n\n## Risks\n',
    category: 'project',
    isBuiltIn: true,
  },
  {
    name: 'Decision Record',
    description: 'Document context, options considered, and reasoning for decisions',
    content: '# Decision: {{title}}\n**Date**: {{date}}\n\n## Context\n\n## Options Considered\n1. \n\n## Decision\n\n## Reasoning\n\n## Outcome\n',
    category: 'decision',
    isBuiltIn: true,
  },
  {
    name: 'Weekly Review',
    description: 'Reflect on accomplishments, challenges, and plan next week',
    content: '# Weekly Review - {{date}}\n\n## Accomplishments\n- \n\n## Challenges\n- \n\n## Learnings\n- \n\n## Next Week\n- \n',
    category: 'review',
    isBuiltIn: true,
  },
]

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  daily: Calendar,
  meeting: Briefcase,
  project: FileText,
  review: Star,
  decision: GitBranch,
  general: FileCode2,
}

const CATEGORY_COLORS: Record<string, string> = {
  daily: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  meeting: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  project: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  review: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  decision: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  general: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
}

const CATEGORY_TEXT_COLORS: Record<string, string> = {
  daily: 'text-blue-500',
  meeting: 'text-emerald-500',
  project: 'text-amber-500',
  review: 'text-violet-500',
  decision: 'text-rose-500',
  general: 'text-gray-500',
}

const VARIABLE_PLACEHOLDERS = [
  { key: '{{date}}', desc: 'Current date (YYYY-MM-DD)' },
  { key: '{{title}}', desc: 'Note title' },
  { key: '{{time}}', desc: 'Current time (HH:MM)' },
  { key: '{{day_of_week}}', desc: 'Day of the week' },
]

export function TemplatesView() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setIsLoading(true)
    try {
      const res = await api.getTemplates()
      if (res.success && res.data?.templates) {
        // Merge built-in templates with server templates
        const serverIds = new Set(res.data.templates.map((t: Template) => t.name))
        const builtInToAdd = BUILT_IN_TEMPLATES
          .filter((bit) => !serverIds.has(bit.name))
          .map((bit, i) => ({
            ...bit,
            id: `builtin-${bit.category}-${i}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))

        // Built-in first, then custom
        const allTemplates = [
          ...builtInToAdd,
          ...res.data.templates.sort((a: Template, b: Template) => {
            if (a.isBuiltIn && !b.isBuiltIn) return -1
            if (!a.isBuiltIn && b.isBuiltIn) return 1
            return a.name.localeCompare(b.name)
          }),
        ]
        setTemplates(allTemplates)
      } else {
        // No server templates — use built-in only
        setTemplates(
          BUILT_IN_TEMPLATES.map((bit, i) => ({
            ...bit,
            id: `builtin-${bit.category}-${i}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err)
      // Fallback to built-in templates
      setTemplates(
        BUILT_IN_TEMPLATES.map((bit, i) => ({
          ...bit,
          id: `builtin-${bit.category}-${i}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return
    setIsCreating(true)
    try {
      const res = await api.createTemplate({
        name: newName,
        description: newDescription,
        content: newContent,
        category: newCategory,
      })
      if (res.success && res.data) {
        setTemplates((prev) => [...prev, res.data])
        setShowCreateDialog(false)
        setNewName('')
        setNewDescription('')
        setNewContent('')
        setNewCategory('general')
        toast.success('Template created')
      } else {
        toast.error(res.error || 'Failed to create template')
      }
    } catch {
      toast.error('Failed to create template')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const template = templates.find((t) => t.id === id)
    if (template?.isBuiltIn) {
      toast.error('Built-in templates cannot be deleted')
      return
    }
    try {
      const res = await api.deleteTemplate(id)
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
        if (selectedTemplate?.id === id) setSelectedTemplate(null)
        toast.success('Template deleted')
      } else {
        toast.error(res.error || 'Failed to delete template')
      }
    } catch {
      toast.error('Failed to delete template')
    }
  }

  const applyVariables = (templateContent: string, templateName: string) => {
    const now = new Date()
    return templateContent
      .replace(/\{\{date\}\}/g, now.toISOString().split('T')[0])
      .replace(/\{\{time\}\}/g, now.toTimeString().slice(0, 5))
      .replace(/\{\{title\}\}/g, templateName)
      .replace(/\{\{day_of_week\}\}/g, now.toLocaleDateString('en-US', { weekday: 'long' }))
  }

  const handleUseTemplate = async (template: Template) => {
    const content = applyVariables(template.content, template.name)

    // Create a new note with the template content
    try {
      const res = await api.createNote({
        title: template.name,
        content,
        markdown: content,
        tags: template.category,
      })
      if (res.success && res.data) {
        toast.success(`Note created from "${template.name}" template`)
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(content)
        toast.success('Template content copied to clipboard')
      }
    } catch {
      await navigator.clipboard.writeText(content)
      toast.success('Template content copied to clipboard')
    }
  }

  const handleCopyContent = async (template: Template) => {
    const content = applyVariables(template.content, template.name)
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Template content copied to clipboard')
    } catch {
      toast.error('Failed to copy template')
    }
  }

  const categories = useMemo(() => {
    return [...new Set(templates.map((t) => t.category))]
  }, [templates])

  const filteredTemplates = useMemo(() => {
    let result = templates
    if (filterCategory) {
      result = result.filter((t) => t.category === filterCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q)
      )
    }
    return result
  }, [templates, filterCategory, searchQuery])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-primary" />
            Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage note templates for consistent workflows
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Custom Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Template name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <div className="space-y-2">
                <Textarea
                  placeholder="Template content... Use {{date}}, {{time}}, {{title}}, {{day_of_week}} as variable placeholders"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={8}
                  className="text-sm font-mono"
                />
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_PLACEHOLDERS.map((v) => (
                    <button
                      key={v.key}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors font-mono"
                      onClick={() => setNewContent((prev) => prev + v.key)}
                      title={v.desc}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newContent.trim() || isCreating}
                >
                  {isCreating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                  Create Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={filterCategory === null ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setFilterCategory(null)}
          >
            All ({templates.length})
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={filterCategory === cat ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer text-xs',
                filterCategory === cat && CATEGORY_COLORS[cat] ? '' : ''
              )}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
            >
              {cat} ({templates.filter((t) => t.category === cat).length})
            </Badge>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredTemplates.map((template, i) => {
            const Icon = CATEGORY_ICONS[template.category] || FileCode2
            const textColor = CATEGORY_TEXT_COLORS[template.category] || 'text-gray-500'
            const bgColor = CATEGORY_COLORS[template.category] || 'text-gray-500 bg-gray-500/10 border-gray-500/20'
            const isSelected = selectedTemplate?.id === template.id

            return (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className={cn(
                    'hover:shadow-md transition-all cursor-pointer group',
                    isSelected && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedTemplate(isSelected ? null : template)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', bgColor.split(' ').slice(1).join(' '))}>
                          <Icon className={cn('w-3.5 h-3.5', textColor)} />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm truncate">{template.name}</CardTitle>
                          {template.isBuiltIn && (
                            <span className="text-[9px] text-muted-foreground">Built-in</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUseTemplate(template)
                          }}
                          title="Use template (create note)"
                        >
                          <Sparkles className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyContent(template)
                          }}
                          title="Copy content"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        {!template.isBuiltIn && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(template.id)
                            }}
                            title="Delete template"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {template.description || template.content.slice(0, 100)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('text-[9px] h-4', bgColor)}
                      >
                        {template.category}
                      </Badge>
                      <button
                        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedTemplate(template)
                        }}
                      >
                        <Eye className="w-2.5 h-2.5" />
                        Preview
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Template Preview Panel */}
      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Card>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = CATEGORY_ICONS[selectedTemplate.category] || FileCode2
                      return <Icon className={cn('w-4 h-4', CATEGORY_TEXT_COLORS[selectedTemplate.category] || 'text-gray-500')} />
                    })()}
                    <CardTitle className="text-sm">{selectedTemplate.name}</CardTitle>
                    {selectedTemplate.isBuiltIn && (
                      <Badge variant="secondary" className="text-[9px] h-4">Built-in</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedTemplate(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {selectedTemplate.description && (
                  <p className="text-xs text-muted-foreground mb-3">{selectedTemplate.description}</p>
                )}
                <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {selectedTemplate.content}
                </pre>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" onClick={() => handleUseTemplate(selectedTemplate)}>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Use Template
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCopyContent(selectedTemplate)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Content
                  </Button>
                  {!selectedTemplate.isBuiltIn && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(selectedTemplate.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileCode2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery || filterCategory
              ? 'No templates match your search'
              : 'No templates yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Create your first template to get started</p>
        </div>
      )}
    </div>
  )
}
