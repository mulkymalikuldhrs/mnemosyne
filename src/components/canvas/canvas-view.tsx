'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2, Plus, ZoomIn, ZoomOut, Trash2, Save, Move,
  Type, FileText, Link2, Download, Minimize2, X, ChevronDown,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CanvasNode {
  id: string
  type: 'text' | 'note'
  x: number
  y: number
  width: number
  height: number
  content: string
  noteId?: string
  color: string
}

interface CanvasEdge {
  id: string
  from: string
  to: string
  label?: string
}

interface CanvasData {
  id: string
  title: string
  description: string
  data: string
  createdAt: string
  updatedAt: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_COLORS = [
  { name: 'Default', value: 'default', bg: 'bg-background', border: 'border-border' },
  { name: 'Violet', value: 'violet', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  { name: 'Emerald', value: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { name: 'Amber', value: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { name: 'Rose', value: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  { name: 'Cyan', value: 'cyan', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
]

const COLOR_SVG: Record<string, string> = {
  default: '#888888',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  cyan: '#06b6d4',
}

const COLOR_BG: Record<string, string> = {
  default: 'rgba(128,128,128,0.06)',
  violet: 'rgba(139,92,246,0.08)',
  emerald: 'rgba(16,185,129,0.08)',
  amber: 'rgba(245,158,11,0.08)',
  rose: 'rgba(244,63,94,0.08)',
  cyan: 'rgba(6,182,212,0.08)',
}

const COLOR_STROKE: Record<string, string> = {
  default: 'rgba(128,128,128,0.3)',
  violet: 'rgba(139,92,246,0.3)',
  emerald: 'rgba(16,185,129,0.3)',
  amber: 'rgba(245,158,11,0.3)',
  rose: 'rgba(244,63,94,0.3)',
  cyan: 'rgba(6,182,212,0.3)',
}

function getColorClasses(color: string) {
  const c = NODE_COLORS.find((nc) => nc.value === color) || NODE_COLORS[0]
  return `${c.bg} ${c.border}`
}

// ─── Minimap Component ───────────────────────────────────────────────────────

function Minimap({
  nodes,
  edges,
  panOffset,
  zoom,
  containerSize,
}: {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  panOffset: { x: number; y: number }
  zoom: number
  containerSize: { width: number; height: number }
}) {
  if (nodes.length === 0) return null

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  })

  const padding = 100
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  const mapW = 160
  const mapH = 100
  const scaleX = mapW / (maxX - minX)
  const scaleY = mapH / (maxY - minY)
  const scale = Math.min(scaleX, scaleY)

  const ox = (mapW - (maxX - minX) * scale) / 2
  const oy = (mapH - (maxY - minY) * scale) / 2

  const toMapX = (x: number) => ox + (x - minX) * scale
  const toMapY = (y: number) => oy + (y - minY) * scale

  // Viewport rect
  const vpX = -panOffset.x / zoom
  const vpY = -panOffset.y / zoom
  const vpW = containerSize.width / zoom
  const vpH = containerSize.height / zoom

  return (
    <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-background/90 backdrop-blur-sm shadow-lg overflow-hidden">
      <svg width={mapW} height={mapH} className="block">
        {/* Edges */}
        {edges.map((edge) => {
          const from = nodes.find((n) => n.id === edge.from)
          const to = nodes.find((n) => n.id === edge.to)
          if (!from || !to) return null
          return (
            <line
              key={edge.id}
              x1={toMapX(from.x + from.width / 2)}
              y1={toMapY(from.y + from.height / 2)}
              x2={toMapX(to.x + to.width / 2)}
              y2={toMapY(to.y + to.height / 2)}
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.15}
            />
          )
        })}
        {/* Nodes */}
        {nodes.map((node) => (
          <rect
            key={node.id}
            x={toMapX(node.x)}
            y={toMapY(node.y)}
            width={Math.max(3, node.width * scale)}
            height={Math.max(2, node.height * scale)}
            rx={1}
            fill={COLOR_SVG[node.color] || COLOR_SVG.default}
            opacity={0.5}
          />
        ))}
        {/* Viewport indicator */}
        <rect
          x={toMapX(vpX)}
          y={toMapY(vpY)}
          width={vpW * scale}
          height={vpH * scale}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.3}
          rx={1}
        />
      </svg>
    </div>
  )
}

// ─── Canvas Switcher ─────────────────────────────────────────────────────────

function CanvasSwitcher({
  canvases,
  activeCanvas,
  onSelect,
  onCreate,
  onDelete,
}: {
  canvases: CanvasData[]
  activeCanvas: CanvasData | null
  onSelect: (c: CanvasData) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CanvasData | null>(null)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {activeCanvas?.title || 'Select Canvas'}
        <ChevronDown className="w-3 h-3" />
      </Button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 mt-1 w-56 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          >
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {canvases.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors',
                      activeCanvas?.id === c.id && 'bg-accent'
                    )}
                    onClick={() => {
                      onSelect(c)
                      setIsOpen(false)
                    }}
                  >
                    <span className="truncate">{c.title}</span>
                    <button
                      className="shrink-0 ml-2 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(c)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {canvases.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">No canvases yet</p>
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-border p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-7 text-xs"
                onClick={() => {
                  onCreate()
                  setIsOpen(false)
                }}
              >
                <Plus className="w-3 h-3 mr-1.5" />
                New Canvas
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Canvas</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title || 'Untitled'}&rdquo;? All nodes and edges in this canvas will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget.id)
                  setDeleteTarget(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Canvas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Inline Editable Text Node ───────────────────────────────────────────────

function InlineEditable({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (val: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onChange(text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setText(value)
            setEditing(false)
          }
          e.stopPropagation()
        }}
        className={cn('w-full h-full bg-transparent border-none outline-none resize-none text-sm p-0', className)}
      />
    )
  }

  return (
    <div
      className={cn('whitespace-pre-wrap cursor-text', className)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
    >
      {value || 'Double-click to edit'}
    </div>
  )
}

// ─── Main Canvas Component ───────────────────────────────────────────────────

export function CanvasView() {
  const [canvases, setCanvases] = useState<CanvasData[]>([])
  const [activeCanvas, setActiveCanvas] = useState<CanvasData | null>(null)
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const svgContainerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeIdCounter = useRef(0)

  // ── Fetch canvases on mount ──
  useEffect(() => {
    const fetchCanvases = async () => {
      setIsLoading(true)
      try {
        const res = await api.getCanvases()
        if (res.success && res.data?.canvases) {
          setCanvases(res.data.canvases)
          if (res.data.canvases.length > 0) {
            loadCanvas(res.data.canvases[0])
          }
        }
      } catch {
        console.error('Failed to fetch canvases')
      } finally {
        setIsLoading(false)
      }
    }
    fetchCanvases()
  }, [])

  // ── Container size tracking ──
  useEffect(() => {
    if (!svgContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(svgContainerRef.current)
    return () => observer.disconnect()
  }, [])

  // ── Keyboard events ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) {
        e.preventDefault()
        setSpaceHeld(true)
      }
      if (e.key === 'Backspace' && selectedNode && !(e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) {
        e.preventDefault()
        deleteNode(selectedNode)
      }
      if (e.key === 'Escape') {
        setSelectedNode(null)
        setConnectingFrom(null)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
        if (isPanning) setIsPanning(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedNode, isPanning])

  // ── Auto-save with debounce ──
  const scheduleSave = useCallback((updatedNodes: CanvasNode[], updatedEdges: CanvasEdge[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!activeCanvas) return
      setIsSaving(true)
      try {
        await api.updateCanvas(activeCanvas.id, {
          data: JSON.stringify({ nodes: updatedNodes, edges: updatedEdges }),
        })
        setLastSaved(new Date())
      } catch {
        // Silent fail for auto-save
      } finally {
        setIsSaving(false)
      }
    }, 1500)
  }, [activeCanvas])

  // ── Load canvas ──
  const loadCanvas = (canvas: CanvasData) => {
    setActiveCanvas(canvas)
    setSelectedNode(null)
    setConnectingFrom(null)
    try {
      const data = JSON.parse(canvas.data)
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
    } catch {
      setNodes([])
      setEdges([])
    }
    setPanOffset({ x: 0, y: 0 })
    setZoom(1)
  }

  // ── Create new canvas ──
  const createNewCanvas = async () => {
    try {
      const res = await api.createCanvas({
        title: `Canvas ${canvases.length + 1}`,
        description: '',
        data: JSON.stringify({ nodes: [], edges: [] }),
      })
      if (res.success && res.data) {
        setCanvases((prev) => [res.data, ...prev])
        loadCanvas(res.data)
        toast.success('Canvas created')
      }
    } catch {
      toast.error('Failed to create canvas')
    }
  }

  // ── Delete canvas ──
  const deleteCanvas = async (id: string) => {
    try {
      const res = await api.deleteCanvas(id)
      if (res.success) {
        const updated = canvases.filter((c) => c.id !== id)
        setCanvases(updated)
        if (activeCanvas?.id === id) {
          if (updated.length > 0) {
            loadCanvas(updated[0])
          } else {
            setActiveCanvas(null)
            setNodes([])
            setEdges([])
          }
        }
        toast.success('Canvas deleted')
      }
    } catch {
      toast.error('Failed to delete canvas')
    }
  }

  // ── Add text node ──
  const addTextNode = () => {
    const cx = (containerSize.width / 2 - panOffset.x) / zoom
    const cy = (containerSize.height / 2 - panOffset.y) / zoom
    const newNode: CanvasNode = {
      id: `node-${Date.now()}-${nodeIdCounter.current++}`,
      type: 'text',
      x: cx - 100 + (Math.random() - 0.5) * 40,
      y: cy - 40 + (Math.random() - 0.5) * 40,
      width: 200,
      height: 80,
      content: 'New text node',
      color: 'default',
    }
    setNodes((prev) => {
      const next = [...prev, newNode]
      scheduleSave(next, edges)
      return next
    })
    setSelectedNode(newNode.id)
  }

  // ── Add note reference node ──
  const addNoteNode = () => {
    const cx = (containerSize.width / 2 - panOffset.x) / zoom
    const cy = (containerSize.height / 2 - panOffset.y) / zoom
    const newNode: CanvasNode = {
      id: `node-${Date.now()}-${nodeIdCounter.current++}`,
      type: 'note',
      x: cx - 120 + (Math.random() - 0.5) * 40,
      y: cy - 60 + (Math.random() - 0.5) * 40,
      width: 240,
      height: 120,
      content: 'Note reference — double-click to edit',
      color: 'violet',
    }
    setNodes((prev) => {
      const next = [...prev, newNode]
      scheduleSave(next, edges)
      return next
    })
    setSelectedNode(newNode.id)
  }

  // ── Delete node ──
  const deleteNode = (id: string) => {
    setNodes((prev) => {
      const next = prev.filter((n) => n.id !== id)
      scheduleSave(next, edges.filter((e) => e.from !== id && e.to !== id))
      return next
    })
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id))
    setSelectedNode(null)
  }

  // ── Update node ──
  const updateNode = (id: string, updates: Partial<CanvasNode>) => {
    setNodes((prev) => {
      const next = prev.map((n) => n.id === id ? { ...n, ...updates } : n)
      scheduleSave(next, edges)
      return next
    })
  }

  // ── Change node color ──
  const changeNodeColor = (nodeId: string, color: string) => {
    updateNode(nodeId, { color })
  }

  // ── Mouse handlers for drag/pan ──
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-node]')) return

    // Middle click or space+click for panning
    if (e.button === 1 || spaceHeld || e.button === 0) {
      if (e.button === 0 && !spaceHeld) {
        // Left click on empty canvas: deselect
        if (target === svgContainerRef.current || target.tagName === 'svg' || target.closest('[data-canvas-bg]')) {
          setSelectedNode(null)
          setConnectingFrom(null)
          // Start panning on left click on background
          setIsPanning(true)
          setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
        }
        return
      }
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (e.button !== 0) return

    // Shift+click: start or complete connection
    if (e.shiftKey) {
      if (!connectingFrom) {
        setConnectingFrom(nodeId)
        return
      } else if (connectingFrom !== nodeId) {
        // Create edge
        const edgeExists = edges.some(
          (ed) => (ed.from === connectingFrom && ed.to === nodeId) ||
                  (ed.from === nodeId && ed.to === connectingFrom)
        )
        if (!edgeExists) {
          setEdges((prev) => {
            const next = [...prev, {
              id: `edge-${Date.now()}-${nodeIdCounter.current++}`,
              from: connectingFrom,
              to: nodeId,
            }]
            scheduleSave(nodes, next)
            return next
          })
        }
        setConnectingFrom(null)
        return
      }
      setConnectingFrom(null)
      return
    }

    // Normal click: start drag
    if (connectingFrom) {
      // Click second node to connect
      if (connectingFrom !== nodeId) {
        const edgeExists = edges.some(
          (ed) => (ed.from === connectingFrom && ed.to === nodeId) ||
                  (ed.from === nodeId && ed.to === connectingFrom)
        )
        if (!edgeExists) {
          setEdges((prev) => {
            const next = [...prev, {
              id: `edge-${Date.now()}-${nodeIdCounter.current++}`,
              from: connectingFrom,
              to: nodeId,
            }]
            scheduleSave(nodes, next)
            return next
          })
        }
      }
      setConnectingFrom(null)
      return
    }

    setSelectedNode(nodeId)
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setDragging(nodeId)
    const rect = svgContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    setDragOffset({
      x: (e.clientX - rect.left - panOffset.x) / zoom - node.x,
      y: (e.clientY - rect.top - panOffset.y) / zoom - node.y,
    })
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const rect = svgContainerRef.current?.getBoundingClientRect()
      if (!rect) return
      const newX = (e.clientX - rect.left - panOffset.x) / zoom - dragOffset.x
      const newY = (e.clientY - rect.top - panOffset.y) / zoom - dragOffset.y
      setNodes((prev) => prev.map((n) => n.id === dragging ? { ...n, x: newX, y: newY } : n))
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }, [dragging, dragOffset, isPanning, panStart, zoom])

  const handleMouseUp = () => {
    if (dragging) {
      scheduleSave(nodes, edges)
    }
    setDragging(null)
    setIsPanning(false)
  }

  // ── Double-click to add node ──
  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-node]')) return
    if (!svgContainerRef.current) return

    const rect = svgContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - panOffset.x) / zoom - 100
    const y = (e.clientY - rect.top - panOffset.y) / zoom - 40

    const newNode: CanvasNode = {
      id: `node-${Date.now()}-${nodeIdCounter.current++}`,
      type: 'text',
      x,
      y,
      width: 200,
      height: 80,
      content: '',
      color: 'default',
    }
    setNodes((prev) => {
      const next = [...prev, newNode]
      scheduleSave(next, edges)
      return next
    })
    setSelectedNode(newNode.id)
  }

  // ── Zoom with scroll ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.92 : 1.08
    const newZoom = Math.max(0.15, Math.min(4, zoom * delta))

    // Zoom toward mouse position
    if (svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const scaleChange = newZoom / zoom
      const newPanX = mouseX - scaleChange * (mouseX - panOffset.x)
      const newPanY = mouseY - scaleChange * (mouseY - panOffset.y)

      setPanOffset({ x: newPanX, y: newPanY })
    }

    setZoom(newZoom)
  }, [zoom, panOffset])

  // ── Manual save ──
  const handleManualSave = async () => {
    if (!activeCanvas) return
    setIsSaving(true)
    try {
      await api.updateCanvas(activeCanvas.id, {
        data: JSON.stringify({ nodes, edges }),
      })
      setLastSaved(new Date())
      toast.success('Canvas saved')
    } catch {
      toast.error('Failed to save canvas')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Export ──
  const exportCanvas = () => {
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <rect fill="white" width="1200" height="800"/>
  ${edges.map((edge) => {
    const from = nodes.find((n) => n.id === edge.from)
    const to = nodes.find((n) => n.id === edge.to)
    if (!from || !to) return ''
    return `<line x1="${from.x + from.width / 2}" y1="${from.y + from.height / 2}" x2="${to.x + to.width / 2}" y2="${to.y + to.height / 2}" stroke="#999" stroke-width="2"/>`
  }).join('\n  ')}
  ${nodes.map((n) => `
  <rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" fill="${COLOR_BG[n.color] || COLOR_BG.default}" stroke="${COLOR_STROKE[n.color] || COLOR_STROKE.default}" rx="8" stroke-width="2"/>
  <text x="${n.x + 12}" y="${n.y + 22}" font-size="13" font-weight="600">${n.content.slice(0, 30)}</text>
  `).join('\n  ')}
</svg>`
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeCanvas?.title || 'canvas'}.svg`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Canvas exported')
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading canvas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <CanvasSwitcher
            canvases={canvases}
            activeCanvas={activeCanvas}
            onSelect={loadCanvas}
            onCreate={createNewCanvas}
            onDelete={deleteCanvas}
          />
          <Badge variant="outline" className="text-[10px] h-5">
            {nodes.length} nodes · {edges.length} edges
          </Badge>
          {lastSaved && (
            <span className="text-[9px] text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addTextNode}>
            <Type className="w-3.5 h-3.5 mr-1" />
            Text
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addNoteNode}>
            <FileText className="w-3.5 h-3.5 mr-1" />
            Note
          </Button>
          <Button
            variant={connectingFrom ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setConnectingFrom(connectingFrom ? null : '__start__')}
          >
            <Link2 className="w-3.5 h-3.5 mr-1" />
            {connectingFrom ? 'Cancel' : 'Connect'}
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(4, z * 1.2))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-10 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.15, z * 0.8))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }) }}>
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportCanvas}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Export
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleManualSave} disabled={isSaving || !activeCanvas}>
            {isSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Save
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={createNewCanvas}>
            <Plus className="w-3 h-3 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* ── Canvas Area ── */}
      <div
        ref={svgContainerRef}
        className="flex-1 relative overflow-hidden"
        style={{
          cursor: spaceHeld || isPanning ? 'grab' : 'default',
          ...(isPanning && { cursor: 'grabbing' }),
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {/* Background pattern */}
        <div
          data-canvas-bg="true"
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
            opacity: 0.5,
          }}
        />

        {/* Connecting indicator */}
        {connectingFrom && (
          <div className="absolute top-3 left-3 z-50 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg shadow-lg">
            {connectingFrom === '__start__'
              ? '⇧ Shift+Click or click two nodes to connect'
              : 'Click another node to complete connection'}
            <button className="ml-2 hover:opacity-70" onClick={() => setConnectingFrom(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* SVG layer for edges */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <defs>
            <marker
              id="canvas-arrowhead"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.5" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from)
            const toNode = nodes.find((n) => n.id === edge.to)
            if (!fromNode || !toNode) return null

            const x1 = fromNode.x + fromNode.width / 2
            const y1 = fromNode.y + fromNode.height / 2
            const x2 = toNode.x + toNode.width / 2
            const y2 = toNode.y + toNode.height / 2

            // Calculate edge offset to not overlap node
            const dx = x2 - x1
            const dy = y2 - y1
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const nx = dx / dist
            const ny = dy / dist

            const fromR = Math.min(fromNode.width, fromNode.height) / 2
            const toR = Math.min(toNode.width, toNode.height) / 2

            const sx = x1 + nx * fromR
            const sy = y1 + ny * fromR
            const ex = x2 - nx * toR
            const ey = y2 - ny * toR

            return (
              <g key={edge.id}>
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  opacity={0.25}
                  markerEnd="url(#canvas-arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize={9}
                    opacity={0.4}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* HTML layer for nodes */}
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            inset: 0,
          }}
        >
          {nodes.map((node) => (
            <ContextMenu key={node.id}>
              <ContextMenuTrigger asChild>
                <div
                  data-node="true"
                  className={cn(
                    'absolute rounded-lg border-2 shadow-sm select-none overflow-hidden transition-shadow',
                    getColorClasses(node.color),
                    selectedNode === node.id && 'ring-2 ring-primary shadow-lg',
                    connectingFrom === node.id && 'ring-2 ring-primary ring-offset-1',
                    dragging === node.id && 'shadow-xl',
                  )}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    cursor: spaceHeld ? 'grab' : 'move',
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (connectingFrom === '__start__') {
                      setConnectingFrom(node.id)
                    }
                    setSelectedNode(node.id)
                  }}
                >
                  {/* Node type indicator */}
                  {node.type === 'note' && (
                    <div className="absolute top-1 left-1.5 opacity-40">
                      <FileText className="w-3 h-3" />
                    </div>
                  )}

                  {/* Node content */}
                  <div className="p-3 h-full overflow-hidden pt-4">
                    <InlineEditable
                      value={node.content}
                      onChange={(val) => updateNode(node.id, { content: val })}
                      className="text-sm"
                    />
                  </div>

                  {/* Delete button */}
                  <AnimatePresence>
                    {selectedNode === node.id && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 shadow-sm z-10"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNode(node.id)
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Connection dot */}
                  <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-primary/30" />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Node Color</div>
                {NODE_COLORS.map((color) => (
                  <ContextMenuItem
                    key={color.value}
                    onClick={() => changeNodeColor(node.id, color.value)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-4 h-4 rounded border"
                      style={{
                        backgroundColor: COLOR_BG[color.value],
                        borderColor: COLOR_STROKE[color.value],
                      }}
                    />
                    <span className="text-xs">{color.name}</span>
                    {node.color === color.value && (
                      <span className="ml-auto text-primary text-xs">✓</span>
                    )}
                  </ContextMenuItem>
                ))}
                <div className="my-1 h-px bg-border" />
                <ContextMenuItem
                  onClick={() => deleteNode(node.id)}
                  variant="destructive"
                  className="text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Node
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>

        {/* Minimap */}
        <Minimap
          nodes={nodes}
          edges={edges}
          panOffset={panOffset}
          zoom={zoom}
          containerSize={containerSize}
        />

        {/* Empty state */}
        {nodes.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-3">
              <Move className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Double-click anywhere to add a node</p>
              <p className="text-xs text-muted-foreground/60">
                Shift+Click two nodes to connect them · Scroll to zoom · Drag background to pan
              </p>
            </div>
          </div>
        )}

        {/* Auto-save indicator */}
        {isSaving && (
          <div className="absolute bottom-4 left-4 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur-sm border border-border text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Auto-saving...
          </div>
        )}
      </div>
    </div>
  )
}
