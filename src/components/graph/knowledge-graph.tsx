'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search, ZoomIn, ZoomOut, Maximize2, Filter, X, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { useUIStore, useNotesStore } from '@/lib/store'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  tags: string[]
  connectionCount: number
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  type: 'memory' | 'wiki'
  reason?: string
  linkText?: string
  relationScore?: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ─── Tag Color Palette ───────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  ai: '#8b5cf6',
  'knowledge-management': '#6366f1',
  rag: '#a78bfa',
  embeddings: '#7c3aed',
  trading: '#f59e0b',
  'risk-management': '#d97706',
  strategy: '#eab308',
  momentum: '#fbbf24',
  'business-idea': '#10b981',
  startup: '#059669',
  productivity: '#14b8a6',
  meetings: '#06b6d4',
  'decision-making': '#ec4899',
  framework: '#f43f5e',
  programming: '#3b82f6',
  research: '#8b5cf6',
  finance: '#f59e0b',
  health: '#22c55e',
  learning: '#06b6d4',
  personal: '#ec4899',
}

const FALLBACK_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#84cc16', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
]

function getTagColor(tags: string[]): string {
  for (const tag of tags) {
    const key = tag.toLowerCase()
    if (TAG_COLORS[key]) return TAG_COLORS[key]
  }
  // Deterministic fallback based on first tag
  if (tags.length > 0) {
    const idx = tags[0].split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % FALLBACK_COLORS.length
    return FALLBACK_COLORS[idx]
  }
  return FALLBACK_COLORS[0]
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function GraphSkeleton() {
  return (
    <div className="h-full flex">
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="flex justify-center gap-8 mt-8">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="w-[280px] border-l border-border p-4 space-y-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-14 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tooltip Component ───────────────────────────────────────────────────────

function NodeTooltip({ node, position }: { node: GraphNode; position: { x: number; y: number } }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className="fixed z-50 pointer-events-none"
      style={{ left: position.x + 12, top: position.y - 8 }}
    >
      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 max-w-xs">
        <p className="text-sm font-medium truncate">{node.title}</p>
        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {node.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${TAG_COLORS[tag.toLowerCase()] || '#6b7280'}20`,
                  color: TAG_COLORS[tag.toLowerCase()] || '#6b7280',
                }}
              >
                {tag}
              </span>
            ))}
            {node.tags.length > 5 && (
              <span className="text-[9px] text-muted-foreground">+{node.tags.length - 5}</span>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {node.connectionCount} connection{node.connectionCount !== 1 ? 's' : ''}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Node Preview Popup ──────────────────────────────────────────────────────

function NodePreviewPopup({
  node,
  onClose,
  onNavigate,
}: {
  node: GraphNode
  onClose: () => void
  onNavigate: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      className="absolute z-40 w-72"
      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
    >
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm leading-tight line-clamp-2">{node.title}</CardTitle>
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 ml-2" onClick={onClose}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="flex flex-wrap gap-1">
            {node.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] h-5"
                style={{
                  borderColor: TAG_COLORS[tag.toLowerCase()] || '#6b7280',
                  color: TAG_COLORS[tag.toLowerCase()] || '#6b7280',
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {node.connectionCount} connection{node.connectionCount !== 1 ? 's' : ''}
            </span>
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onNavigate}>
              <ExternalLink className="w-3 h-3 mr-1" />
              Open Note
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [zoomLevel, setZoomLevel] = useState(1)
  const [showFilterPanel, setShowFilterPanel] = useState(true)

  // Fetch graph data
  useEffect(() => {
    const fetchGraph = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await api.getGraphData()
        if (res.success && res.data) {
          const data = res.data as GraphData
          setGraphData(data)
          const tags = new Set<string>()
          data.nodes.forEach((n: GraphNode) => n.tags.forEach((t: string) => tags.add(t)))
          setAllTags(Array.from(tags).sort())
        } else {
          setError(res.error || 'Failed to load graph data')
        }
      } catch {
        setError('Network error')
      } finally {
        setIsLoading(false)
      }
    }
    fetchGraph()
  }, [])

  // Filter data based on search and tag filters
  const getFilteredData = useCallback(() => {
    if (!graphData) return { nodes: [], edges: [] }

    let nodes = graphData.nodes
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      nodes = nodes.filter(
        (n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (filterTags.length > 0) {
      nodes = nodes.filter((n) => n.tags.some((t) => filterTags.includes(t)))
    }

    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = graphData.edges.filter((e) => {
      const srcId = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
      const tgtId = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
      return nodeIds.has(srcId) && nodeIds.has(tgtId)
    })

    return { nodes, edges }
  }, [graphData, searchQuery, filterTags])

  // D3 force simulation rendering
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const { nodes, edges } = getFilteredData()
    if (nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    svg.attr('width', width).attr('height', height)

    // Defs for arrow markers
    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'arrow-wiki')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#8b5cf6')
      .attr('opacity', 0.5)

    defs.append('marker')
      .attr('id', 'arrow-memory')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#6b7280')
      .attr('opacity', 0.4)

    // Create main group
    const g = svg.append('g')

    // Zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    svg.call(zoomBehavior)
    zoomBehaviorRef.current = zoomBehavior

    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
        .id((d) => d.id)
        .distance(120)
        .strength(0.4)
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => Math.max(12, 8 + d.connectionCount * 3) + 5))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))

    simulationRef.current = simulation

    // Draw edges
    const link = g.append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => d.type === 'wiki' ? '#8b5cf6' : '#6b7280')
      .attr('stroke-opacity', (d) => {
        const score = d.relationScore ?? 0.5
        return d.type === 'wiki' ? 0.5 : Math.max(0.15, Math.min(0.5, score))
      })
      .attr('stroke-width', (d) => d.type === 'wiki' ? 2 : 1.5)
      .attr('stroke-dasharray', (d) => d.type === 'wiki' ? '6,4' : 'none')
      .attr('marker-end', (d) => d.type === 'wiki' ? 'url(#arrow-wiki)' : 'url(#arrow-memory)')

    // Draw node groups
    const nodeGroup = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .style('cursor', 'pointer')

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    nodeGroup.call(drag)

    // Node outer glow
    nodeGroup.append('circle')
      .attr('r', (d) => Math.max(12, 8 + d.connectionCount * 3) + 4)
      .attr('fill', (d) => getTagColor(d.tags))
      .attr('opacity', 0.1)

    // Node circles
    nodeGroup.append('circle')
      .attr('r', (d) => Math.max(12, 8 + d.connectionCount * 3))
      .attr('fill', (d) => getTagColor(d.tags))
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d) => getTagColor(d.tags))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.4)

    // Node inner highlight
    nodeGroup.append('circle')
      .attr('r', (d) => Math.max(4, 3 + d.connectionCount))
      .attr('fill', 'white')
      .attr('opacity', 0.3)

    // Node labels
    nodeGroup.append('text')
      .text((d) => d.title.length > 18 ? d.title.slice(0, 18) + '…' : d.title)
      .attr('font-size', '10px')
      .attr('dx', (d) => Math.max(12, 8 + d.connectionCount * 3) + 6)
      .attr('dy', 4)
      .attr('fill', 'currentColor')
      .attr('opacity', 0.75)
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Edge labels for wiki links
    const edgeLabels = g.append('g')
      .attr('class', 'edge-labels')
      .selectAll<SVGTextElement, GraphEdge>('text')
      .data(edges.filter((e) => e.type === 'wiki' && e.linkText))
      .join('text')
      .text((d) => d.linkText || '')
      .attr('font-size', '8px')
      .attr('fill', '#8b5cf6')
      .attr('opacity', 0.5)
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none')

    // Hover interactions
    nodeGroup
      .on('mouseover', function (_event, d) {
        d3.select(this).selectAll('circle').transition().duration(150)
          .attr('fill-opacity', 1)
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 0.7)

        // Highlight connected edges
        link.transition().duration(150)
          .attr('stroke-opacity', (e) => {
            const srcId = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
            const tgtId = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
            return srcId === d.id || tgtId === d.id ? 0.8 : 0.1
          })
          .attr('stroke-width', (e) => {
            const srcId = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
            const tgtId = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
            return srcId === d.id || tgtId === d.id ? 3 : 1
          })

        // Dim other nodes
        nodeGroup.transition().duration(150)
          .attr('opacity', (n) => {
            const isDirect = edges.some((e) => {
              const srcId = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
              const tgtId = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
              return (srcId === d.id && tgtId === n.id) || (tgtId === d.id && srcId === n.id)
            })
            return n.id === d.id || isDirect ? 1 : 0.2
          })

        setHoveredNode(d)
        setTooltipPos({ x: _event.clientX, y: _event.clientY })
      })
      .on('mousemove', function (_event, d) {
        setHoveredNode(d)
        setTooltipPos({ x: _event.clientX, y: _event.clientY })
      })
      .on('mouseout', function () {
        d3.select(this).selectAll('circle').transition().duration(150)
          .attr('fill-opacity', 0.85)
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.4)

        link.transition().duration(150)
          .attr('stroke-opacity', (d) => {
            const score = d.relationScore ?? 0.5
            return d.type === 'wiki' ? 0.5 : Math.max(0.15, Math.min(0.5, score))
          })
          .attr('stroke-width', (d) => d.type === 'wiki' ? 2 : 1.5)

        nodeGroup.transition().duration(150)
          .attr('opacity', 1)

        setHoveredNode(null)
      })
      .on('click', function (_event, d) {
        _event.stopPropagation()
        setSelectedNode(d)
      })
      .on('dblclick', function (_event, d) {
        _event.preventDefault()
        _event.stopPropagation()
        // Navigate to the note (set active section to notes + select note)
        useUIStore.getState().setActiveSection('notes')
        useNotesStore.getState().setSelectedNoteId(d.id)
      })

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

      edgeLabels
        .attr('x', (d) => { const sx = (d.source as GraphNode).x ?? 0; const tx = (d.target as GraphNode).x ?? 0; return (sx + tx) / 2 })
        .attr('y', (d) => { const sy = (d.source as GraphNode).y ?? 0; const ty = (d.target as GraphNode).y ?? 0; return (sy + ty) / 2 - 4 })
    })

    // Cleanup
    return () => {
      simulation.stop()
      simulationRef.current = null
    }
  }, [getFilteredData])

  // Resize handler
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return
    const observer = new ResizeObserver(() => {
      if (containerRef.current && svgRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        d3.select(svgRef.current).attr('width', clientWidth).attr('height', clientHeight)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Zoom controls
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(
      zoomBehaviorRef.current.scaleBy, 1.4
    )
  }

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(
      zoomBehaviorRef.current.scaleBy, 0.7
    )
  }

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(500).call(
      zoomBehaviorRef.current.transform, d3.zoomIdentity
    )
  }

  const toggleTagFilter = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterTags([])
  }

  const hasActiveFilters = searchQuery.length > 0 || filterTags.length > 0

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full">
        <GraphSkeleton />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state
  if (graphData && graphData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-lg font-medium text-muted-foreground">No nodes yet</p>
            <p className="text-sm text-muted-foreground">Create some notes to see your knowledge graph grow.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full flex relative">
      {/* Main Graph Area */}
      <div className="flex-1 relative overflow-hidden" ref={containerRef}>
        <svg ref={svgRef} className="w-full h-full" />

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredNode && !selectedNode && (
            <NodeTooltip node={hoveredNode} position={tooltipPos} />
          )}
        </AnimatePresence>

        {/* Node Preview Popup */}
        <AnimatePresence>
          {selectedNode && (
            <NodePreviewPopup
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onNavigate={() => {
                useUIStore.getState().setActiveSection('notes')
                useNotesStore.getState().setSelectedNoteId(selectedNode.id)
              }}
            />
          )}
        </AnimatePresence>

        {/* Zoom Controls */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-background/90 backdrop-blur-sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-background/90 backdrop-blur-sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-background/90 backdrop-blur-sm" onClick={handleResetZoom}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Zoom Indicator */}
        <div className="absolute top-4 left-4 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur-sm border border-border text-xs text-muted-foreground font-mono">
          {Math.round(zoomLevel * 100)}%
        </div>

        {/* Legend */}
        <div className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-background/90 backdrop-blur-sm border border-border text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 bg-gray-400" />
            <span className="text-muted-foreground">Memory Link</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 border-t-2 border-dashed border-violet-500" />
            <span className="text-muted-foreground">Wiki Link</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400 opacity-60" />
            <span className="text-muted-foreground">Node (size = connections)</span>
          </div>
        </div>

        {/* Toggle Filter Panel (mobile) */}
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 md:hidden h-8 w-8 bg-background/90 backdrop-blur-sm"
          onClick={() => setShowFilterPanel(!showFilterPanel)}
        >
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Sidebar Filter Panel */}
      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-border bg-card overflow-hidden shrink-0"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Graph Controls</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 md:hidden"
                    onClick={() => setShowFilterPanel(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Search */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Search className="w-3 h-3" />
                    Search Nodes
                  </h3>
                  <div className="relative">
                    <Input
                      placeholder="Search by title or tag..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 text-sm pr-8"
                    />
                    {searchQuery && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tag Filters */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Filter className="w-3 h-3" />
                      Filter by Tags
                    </h3>
                    {filterTags.length > 0 && (
                      <button
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => setFilterTags([])}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => {
                      const isActive = filterTags.includes(tag)
                      const color = TAG_COLORS[tag.toLowerCase()] || '#6b7280'
                      return (
                        <Badge
                          key={tag}
                          variant={isActive ? 'default' : 'outline'}
                          className="text-[10px] cursor-pointer h-5 transition-all hover:scale-105"
                          onClick={() => toggleTagFilter(tag)}
                          style={isActive ? {
                            backgroundColor: color,
                            borderColor: color,
                          } : {
                            borderColor: `${color}40`,
                            color: color,
                          }}
                        >
                          {tag}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                {/* Active Filters */}
                {hasActiveFilters && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Active Filters
                      </h3>
                      <button
                        className="text-[10px] text-destructive hover:underline"
                        onClick={clearFilters}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {searchQuery && (
                        <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                          &ldquo;{searchQuery}&rdquo;
                          <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setSearchQuery('')} />
                        </Badge>
                      )}
                      {filterTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] h-5 gap-1">
                          {tag}
                          <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => toggleTagFilter(tag)} />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Node Info */}
                <AnimatePresence>
                  {selectedNode && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      <Card>
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Selected Node
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2">
                          <p className="text-sm font-medium">{selectedNode.title}</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[10px] h-4"
                                style={{
                                  borderColor: TAG_COLORS[tag.toLowerCase()] || '#6b7280',
                                  color: TAG_COLORS[tag.toLowerCase()] || '#6b7280',
                                }}
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {selectedNode.connectionCount} connection{selectedNode.connectionCount !== 1 ? 's' : ''}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Graph Stats */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Graph Stats</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold">{graphData?.nodes.length || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Nodes</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold">{graphData?.edges.length || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Edges</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold">{allTags.length}</p>
                      <p className="text-[10px] text-muted-foreground">Tags</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold">
                        {graphData ? Math.round(graphData.edges.length / Math.max(1, graphData.nodes.length) * 10) / 10 : 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Avg Links</p>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Controls</h4>
                  <ul className="text-[10px] text-muted-foreground space-y-1">
                    <li>Scroll to zoom in/out</li>
                    <li>Drag background to pan</li>
                    <li>Drag nodes to reposition</li>
                    <li>Click node for preview</li>
                    <li>Double-click to open note</li>
                    <li>Hover for tooltip</li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
