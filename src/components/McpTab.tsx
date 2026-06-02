'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Puzzle,
  Play,
  Code,
  Zap,
  Shield,
  Map,
  Activity,
  Wrench,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'

interface McpInputSchemaProperty {
  type: string
  description?: string
  enum?: string[]
  properties?: Record<string, McpInputSchemaProperty>
}

interface McpTool {
  name: string
  description: string
  status: 'available' | 'unavailable' | 'error'
  inputSchema: {
    type: string
    properties: Record<string, McpInputSchemaProperty>
    required?: string[]
  }
}

interface McpToolsData {
  tools: McpTool[]
  totalTools: number
  availableTools: number
}

const TOOL_ICONS: Record<string, typeof Puzzle> = {
  mavlink_command: Zap,
  telemetry_query: Activity,
  mission_generate: Map,
  hardware_diagnostic: Wrench,
  calibration_control: Code,
  safety_assessment: Shield,
}

const TOOL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  mavlink_command: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },
  telemetry_query: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/25' },
  mission_generate: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
  hardware_diagnostic: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/25' },
  calibration_control: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/25' },
  safety_assessment: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/25' },
}

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  unavailable: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  error: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

export function McpTab() {
  const [toolsData, setToolsData] = useState<McpToolsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({})
  const [executing, setExecuting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { data: Record<string, unknown> | null; error?: string; success: boolean }>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/mcp')
        const json = await res.json()
        if (mounted && json.success) {
          setToolsData(json.data)
        }
      } catch (err) {
        toast.error('Failed to load MCP tools: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [refreshKey])

  const toggleExpand = (toolName: string) => {
    setExpandedTool(expandedTool === toolName ? null : toolName)
    // Initialize form values for this tool
    if (expandedTool !== toolName) {
      const tool = toolsData?.tools.find(t => t.name === toolName)
      if (tool && !formValues[toolName]) {
        const defaults: Record<string, string> = {}
        Object.entries(tool.inputSchema.properties).forEach(([key, prop]) => {
          if (prop.enum && prop.enum.length > 0) {
            defaults[key] = prop.enum[0]
          } else if (prop.type === 'boolean') {
            defaults[key] = 'true'
          } else if (prop.type === 'number') {
            defaults[key] = ''
          } else {
            defaults[key] = ''
          }
        })
        setFormValues(prev => ({ ...prev, [toolName]: defaults }))
      }
    }
  }

  const handleFormChange = (toolName: string, field: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [toolName]: {
        ...prev[toolName],
        [field]: value,
      },
    }))
  }

  const buildArguments = (tool: McpTool): Record<string, unknown> => {
    const values = formValues[tool.name] || {}
    const args: Record<string, unknown> = {}

    Object.entries(tool.inputSchema.properties).forEach(([key, prop]) => {
      const raw = values[key]
      if (raw === undefined || raw === '') return

      if (prop.type === 'number') {
        const num = parseFloat(raw)
        if (!isNaN(num)) args[key] = num
      } else if (prop.type === 'boolean') {
        args[key] = raw === 'true'
      } else if (prop.type === 'object') {
        try {
          args[key] = JSON.parse(raw)
        } catch {
          // skip invalid JSON
        }
      } else {
        args[key] = raw
      }
    })

    return args
  }

  const handleExecute = async (tool: McpTool) => {
    setExecuting(tool.name)
    setResults(prev => {
      const next = { ...prev }
      delete next[tool.name]
      return next
    })

    try {
      const args = buildArguments(tool)
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: tool.name, arguments: args }),
      })
      const json = await res.json()

      setResults(prev => ({
        ...prev,
        [tool.name]: {
          success: json.success,
          data: json.data,
          error: json.error,
        },
      }))
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [tool.name]: {
          success: false,
          data: null,
          error: err instanceof Error ? err.message : 'Request failed',
        },
      }))
    }

    setExecuting(null)
  }

  const renderFormField = (toolName: string, key: string, prop: McpInputSchemaProperty, required: boolean) => {
    const value = formValues[toolName]?.[key] || ''

    if (prop.enum && prop.enum.length > 0) {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-[10px] text-slate-400 flex items-center gap-1">
            {key}
            {required && <span className="text-rose-400">*</span>}
          </Label>
          <Select value={value} onValueChange={(v) => handleFormChange(toolName, key, v)}>
            <SelectTrigger className="h-7 text-[11px] bg-slate-800 border-white/10 text-white">
              <SelectValue placeholder={`Select ${key}`} />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-white/10">
              {prop.enum.map(opt => (
                <SelectItem key={opt} value={opt} className="text-[11px] text-slate-200">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {prop.description && (
            <p className="text-[9px] text-slate-600">{prop.description}</p>
          )}
        </div>
      )
    }

    if (prop.type === 'object') {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-[10px] text-slate-400 flex items-center gap-1">
            {key}
            {required && <span className="text-rose-400">*</span>}
          </Label>
          <Input
            value={value}
            onChange={(e) => handleFormChange(toolName, key, e.target.value)}
            placeholder='{"key": "value"}'
            className="h-7 text-[11px] bg-slate-800 border-white/10 text-white font-mono"
          />
          {prop.description && (
            <p className="text-[9px] text-slate-600">{prop.description}</p>
          )}
        </div>
      )
    }

    return (
      <div key={key} className="space-y-1">
        <Label className="text-[10px] text-slate-400 flex items-center gap-1">
          {key}
          {required && <span className="text-rose-400">*</span>}
        </Label>
        <Input
          type={prop.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => handleFormChange(toolName, key, e.target.value)}
          placeholder={prop.description || key}
          className="h-7 text-[11px] bg-slate-800 border-white/10 text-white"
        />
        {prop.description && (
          <p className="text-[9px] text-slate-600">{prop.description}</p>
        )}
      </div>
    )
  }

  const renderResult = (toolName: string) => {
    const result = results[toolName]
    if (!result) return null

    return (
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5 mb-2">
          {result.success ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span className="text-[10px] font-medium text-slate-300">
            {result.success ? 'Execution Successful' : 'Execution Failed'}
          </span>
        </div>
        {result.error && (
          <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 mb-2">
            <p className="text-[10px] text-rose-300">{result.error}</p>
          </div>
        )}
        {result.data && (
          <ScrollArea className="max-h-48">
            <pre className="text-[10px] text-slate-300 bg-slate-800/50 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </ScrollArea>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-900 rounded-xl animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    )
  }

  if (!toolsData) {
    return (
      <div className="p-4 md:p-6">
        <Card className="bg-slate-900 border-white/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Puzzle className="w-10 h-10 mb-3 text-slate-600" />
            <p className="text-sm">Failed to load MCP tools</p>
            <Button size="sm" variant="outline" onClick={refresh} className="mt-3 border-white/10 text-slate-400">
              <RotateCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">MCP Tools</h3>
          </div>
          <Badge variant="outline" className="text-[10px] text-teal-400 border-teal-500/30">
            {toolsData.availableTools}/{toolsData.totalTools} available
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          className="h-7 text-[10px] border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
        >
          <RotateCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {toolsData.tools.map((tool) => {
          const ToolIcon = TOOL_ICONS[tool.name] || Puzzle
          const colors = TOOL_COLORS[tool.name] || { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/25' }
          const isExpanded = expandedTool === tool.name
          const isExecuting = executing === tool.name
          const hasResult = !!results[tool.name]

          return (
            <Card
              key={tool.name}
              className={`bg-slate-900 border-white/5 hover:border-white/10 transition-colors ${
                isExpanded ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <CardContent className="p-4">
                {/* Tool Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                      <ToolIcon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{tool.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">mcp://{tool.name}</p>
                    </div>
                  </div>
                  <Badge className={`${STATUS_BADGE[tool.status]} border text-[9px]`}>
                    {tool.status}
                  </Badge>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{tool.description}</p>

                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(tool.name)}
                  className="flex items-center gap-1 text-[10px] text-teal-400/70 hover:text-teal-400 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isExpanded ? 'Hide' : 'Execute'}
                </button>

                {/* Expanded: Form + Execute + Results */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
                    {/* Input Schema Form */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 font-medium">Input Parameters</p>
                      {Object.entries(tool.inputSchema.properties).map(([key, prop]) =>
                        renderFormField(tool.name, key, prop, tool.inputSchema.required?.includes(key) || false)
                      )}
                      {Object.keys(tool.inputSchema.properties).length === 0 && (
                        <p className="text-[10px] text-slate-600 italic">No input parameters required</p>
                      )}
                    </div>

                    {/* Execute Button */}
                    <Button
                      size="sm"
                      onClick={() => handleExecute(tool)}
                      disabled={isExecuting || tool.status !== 'available'}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white h-8 text-[11px]"
                    >
                      {isExecuting ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {isExecuting ? 'Executing...' : 'Execute Tool'}
                    </Button>

                    {/* Results */}
                    {hasResult && renderResult(tool.name)}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Protocol Info */}
      <Card className="bg-slate-900 border-white/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300 mb-1">About MCP Integration</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Model Context Protocol (MCP) provides a standardized interface for AI agents and external tools to interact with
                Nanggroe IoT subsystems. Each tool exposes a JSON Schema input definition and returns structured responses.
                Tools like <span className="text-teal-400">mission_generate</span> use the ZAI SDK for AI-powered waypoint generation,
                while <span className="text-amber-400">safety_assessment</span> leverages PicoClaw&apos;s deterministic safety analysis engine.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
