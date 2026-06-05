'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wrench,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Search,
  Loader2,
  Cable,
  ShieldAlert,
  CircleDot,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ---- Types ----
interface CommonError {
  error: string
  cause: string
  solution: string
}

interface WiringInfo {
  description: string
  connections: string[]
}

interface AssemblyStep {
  step: number
  title: string
  description: string
  tools: string[]
  parts: string[]
  warnings: string[]
  wiring?: WiringInfo
  commonErrors: CommonError[]
}

interface AssemblyData {
  steps: AssemblyStep[]
  totalSteps: number
  droneModel: string
  region: string
}

interface TroubleshootingResult {
  errorDescription: string
  troubleshooting: string
  timestamp: string
  relatedSteps: number[]
}

interface TemplateOption {
  id: string
  name: string
}

const STORAGE_KEY = 'memorix-assembly-completed'

export function AssemblyTab() {
  const [assemblyData, setAssemblyData] = useState<AssemblyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [storedCompleted, setStoredCompleted] = useState<number[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as number[]
      }
    } catch {
      // ignore
    }
    return []
  })
  const completedSteps = useMemo(() => new Set(storedCompleted), [storedCompleted])
  const [errorDescription, setErrorDescription] = useState('')
  const [diagnosing, setDiagnosing] = useState(false)
  const [troubleshooting, setTroubleshooting] = useState<TroubleshootingResult | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const { toast } = useToast()

  // Load templates list for dropdown
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch('/api/robot-templates')
        const data = await res.json()
        if (data.success) {
          const tplOptions = data.data.map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          }))
          setTemplates(tplOptions)
        }
      } catch {
        // templates list is optional
      }
    }
    loadTemplates()
  }, [])

  // Load assembly data
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const url = selectedTemplateId
          ? `/api/assembly?templateId=${selectedTemplateId}`
          : '/api/assembly'
        const res = await fetch(url)
        const json = await res.json()
        if (!cancelled && json.success) {
          setAssemblyData(json.data)
        }
      } catch (err) {
        toast.error('Failed to load assembly data: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [selectedTemplateId])

  // Persist completed steps to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedCompleted))
    } catch {
      // ignore
    }
  }, [storedCompleted])

  const toggleStep = (step: number) => {
    setExpandedStep(expandedStep === step ? null : step)
  }

  const toggleCompleted = (step: number) => {
    setStoredCompleted(prev => {
      const set = new Set(prev)
      if (set.has(step)) {
        set.delete(step)
      } else {
        set.add(step)
      }
      return Array.from(set)
    })
  }

  const handleDiagnose = async () => {
    if (!errorDescription.trim()) return
    setDiagnosing(true)
    setTroubleshooting(null)
    try {
      const res = await fetch('/api/assembly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorDescription }),
      })
      const json = await res.json()
      if (json.success) {
        setTroubleshooting(json.data)
      }
    } catch (err) {
      toast.error('Failed to diagnose error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setDiagnosing(false)
  }

  const progressPercent = assemblyData
    ? Math.round((completedSteps.size / assemblyData.totalSteps) * 100)
    : 0

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
          <div className="h-96 bg-slate-900 rounded-xl animate-pulse border border-white/5" />
        </div>
      </div>
    )
  }

  if (!assemblyData) return null

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header with progress and template selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-teal-400" />
            {assemblyData.droneModel} — Assembly Guide
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {assemblyData.region} region • {assemblyData.totalSteps} steps
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Template Selector */}
          {templates.length > 0 && (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700 text-white text-xs h-8">
                <SelectValue placeholder="Pilih Template..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id} className="text-white text-xs">
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-3 min-w-[200px]">
            <Progress value={progressPercent} className="h-2 bg-white/5 [&>div]:bg-teal-500 flex-1" />
            <span className="text-xs text-slate-400 font-mono w-10 text-right">{progressPercent}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel: Assembly Steps */}
        <div className="lg:col-span-2 space-y-2">
          {assemblyData.steps.map((step) => {
            const isExpanded = expandedStep === step.step
            const isCompleted = completedSteps.has(step.step)

            return (
              <Card
                key={step.step}
                className={`bg-slate-900 border transition-colors ${
                  isCompleted ? 'border-emerald-500/30' : isExpanded ? 'border-teal-500/30' : 'border-white/5'
                }`}
              >
                <CardContent className="p-0">
                  {/* Step header — clickable */}
                  <button
                    onClick={() => toggleStep(step.step)}
                    className="w-full flex items-center gap-3 p-3 md:p-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Step number / completion indicator */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCompleted(step.step) }}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-500/15 border-emerald-500/30'
                          : 'bg-slate-800 border-white/10 hover:border-teal-500/30'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <span className="text-xs font-bold text-slate-500">{step.step}</span>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isCompleted ? 'text-emerald-400' : 'text-white'}`}>
                        {step.title}
                      </p>
                    </div>

                    {/* Warnings badge */}
                    {step.warnings.length > 0 && (
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 border text-[9px]">
                        {step.warnings.length} {step.warnings.length === 1 ? 'warning' : 'warnings'}
                      </Badge>
                    )}

                    {/* Expand icon */}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 space-y-4">
                      {/* Description */}
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {step.description}
                      </p>

                      {/* Tools and Parts */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-white/5">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Wrench className="w-3 h-3" /> Tools Needed
                          </p>
                          <ul className="space-y-1">
                            {step.tools.map((tool, i) => (
                              <li key={i} className="text-[10px] text-slate-300 flex items-start gap-1.5">
                                <CircleDot className="w-2.5 h-2.5 text-teal-500 mt-0.5 shrink-0" />
                                {tool}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg border border-white/5">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Cable className="w-3 h-3" /> Parts
                          </p>
                          <ul className="space-y-1">
                            {step.parts.map((part, i) => (
                              <li key={i} className="text-[10px] text-slate-300 flex items-start gap-1.5">
                                <CircleDot className="w-2.5 h-2.5 text-slate-400 mt-0.5 shrink-0" />
                                {part}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Wiring Instructions */}
                      {step.wiring && (
                        <div className="p-3 bg-teal-500/5 rounded-lg border border-teal-500/20">
                          <p className="text-[10px] text-teal-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Cable className="w-3 h-3" /> Wiring — {step.wiring.description}
                          </p>
                          <div className="space-y-1">
                            {step.wiring.connections.map((conn, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-[9px] text-teal-500/60 font-mono w-4 shrink-0 text-right">{i + 1}.</span>
                                <code className="text-[10px] text-teal-300/90 font-mono leading-relaxed break-all">{conn}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {step.warnings.length > 0 && (
                        <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                          <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShieldAlert className="w-3 h-3" /> Safety Warnings
                          </p>
                          <ul className="space-y-1.5">
                            {step.warnings.map((warning, i) => (
                              <li key={i} className="text-[10px] text-amber-300/80 leading-relaxed flex items-start gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Common Errors */}
                      {step.commonErrors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" /> Common Errors & Solutions
                          </p>
                          {step.commonErrors.map((err, i) => (
                            <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-white/5">
                              <p className="text-[11px] text-rose-400 font-medium mb-1">
                                {err.error}
                              </p>
                              <p className="text-[10px] text-slate-500 mb-1">
                                <span className="text-slate-400">Cause:</span> {err.cause}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                <span className="text-teal-400">Fix:</span> {err.solution}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Right panel: Error Diagnostics */}
        <div className="space-y-4">
          <Card className="bg-slate-900 border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                Hardware Error Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                placeholder="Describe the hardware error you're experiencing... e.g., 'GPS not getting satellite fix' or 'Motor 2 not spinning'"
                className="bg-slate-800 border-white/10 text-slate-300 text-xs min-h-[100px] placeholder:text-slate-600 resize-none"
              />
              <Button
                size="sm"
                onClick={handleDiagnose}
                disabled={diagnosing || !errorDescription.trim()}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                {diagnosing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Diagnosing...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Diagnose Error
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Troubleshooting Results */}
          {troubleshooting && (
            <Card className="bg-slate-900 border-white/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-teal-400" />
                    Diagnosis Result
                  </CardTitle>
                  <span className="text-[9px] text-slate-600 font-mono">
                    {new Date(troubleshooting.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Related steps */}
                {troubleshooting.relatedSteps.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500">Related steps:</span>
                    {troubleshooting.relatedSteps.map((stepNum) => (
                      <Badge
                        key={stepNum}
                        className="bg-teal-500/15 text-teal-400 border-teal-500/30 border text-[9px] cursor-pointer"
                        onClick={() => {
                          setExpandedStep(stepNum)
                        }}
                      >
                        Step {stepNum}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Troubleshooting text */}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-white/5 max-h-96 overflow-y-auto">
                  <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {troubleshooting.troubleshooting}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Reference Card */}
          <Card className="bg-slate-900 border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Cable className="w-4 h-4 text-teal-400" />
                Quick Pin Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[
                  { label: 'Pixhawk TELEM1', value: 'SiK Radio (57600 baud)' },
                  { label: 'Pixhawk TELEM2', value: 'RPi UART (57600 baud)' },
                  { label: 'Pixhawk GPS1', value: 'u-blox NEO-M8N + Compass' },
                  { label: 'Pixhawk MAIN 1-3', value: 'ESC signals (Motor 1-3)' },
                  { label: 'Pixhawk MAIN 4', value: 'Tail Yaw Servo' },
                  { label: 'RPi GPIO 2/3', value: 'I2C-1 SDA/SCL' },
                  { label: 'RPi GPIO 14/15', value: 'UART TXD/RXD → Pixhawk' },
                  { label: 'RPi CSI-2', value: 'Camera V2 (IMX219)' },
                  { label: 'BME280 Address', value: '0x76 on I2C-1' },
                  { label: 'MPU6050 Address', value: '0x68 on I2C-1' },
                ].map((ref, i) => (
                  <div key={i} className="flex justify-between items-center text-[10px] py-1 border-b border-white/5 last:border-0">
                    <span className="text-slate-500">{ref.label}</span>
                    <span className="text-slate-300 font-mono">{ref.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
