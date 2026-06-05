'use client'

import { useState, useEffect } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bot, CheckCircle2, Circle, AlertTriangle, Plus,
  Scan, ChevronRight, Package, Wrench, Upload,
  Loader2, AlertCircle, RefreshCw, Filter,
} from 'lucide-react'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  description: string
  category: string
  icon: string
  difficulty: string
  estimatedBuildHours: number
  isOfficial: boolean
  version: string
}

interface HardwareReq {
  deviceType: string
  name: string
  protocol: string
  required: boolean
  alternatives?: string[]
  notes?: string
}

interface FirmwareReq {
  target: string
  version: string
  url: string
}

interface AssemblyStep {
  step: number
  title: string
  description: string
  duration: string
  tools: string[]
  parts: string[]
  warnings: string[]
  completed?: boolean
}

interface TemplateDetail extends Template {
  requiredHardware: HardwareReq[]
  requiredFirmware: FirmwareReq[]
  capabilities: string[]
  autoConfig: Record<string, unknown>
  assemblyGuide: AssemblyStep[]
  wiringDiagram: Record<string, unknown>
  codeTemplate?: string | null
}

interface Project {
  id: string
  name: string
  description?: string | null
  templateId?: string | null
  status: string
  buildProgress: number
  currentStep?: string | null
  isOffline: boolean
  createdAt: string
}

const CATEGORY_LABELS: Record<string, string> = {
  drone: 'Drone / UAV',
  rover: 'Rover / UGV',
  boat: 'Boat / USV',
  amphibious: 'Amphibious',
  arm: 'Robotic Arm',
  custom: 'Custom',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const CATEGORY_FILTERS = ['all', 'drone', 'rover', 'boat', 'arm', 'custom', 'amphibious']

export function RobotBuilderTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ detected: number; missing: number } | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [tplRes, projRes] = await Promise.all([
          fetch('/api/robot-templates'),
          fetch('/api/projects'),
        ])
        const tplData = await tplRes.json()
        const projData = await projRes.json()
        if (active) {
          if (tplData.success) setTemplates(tplData.data)
          if (projData.success) setProjects(projData.data)
        }
      } catch {
        if (active) {
          setError('Gagal memuat data robot builder. Periksa koneksi server.')
          toast.error('Gagal memuat data robot builder')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const refreshData = async () => {
    try {
      const [tplRes, projRes] = await Promise.all([
        fetch('/api/robot-templates'),
        fetch('/api/projects'),
      ])
      const tplData = await tplRes.json()
      const projData = await projRes.json()
      if (tplData.success) setTemplates(tplData.data)
      if (projData.success) setProjects(projData.data)
    } catch {
      toast.error('Gagal memuat ulang data')
    }
  }

  const fetchTemplateDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/robot-templates/${id}`)
      const data = await res.json()
      if (data.success) {
        setSelectedTemplate(data.data)
        setShowDetail(true)
      } else {
        toast.error('Gagal memuat detail template')
      }
    } catch {
      toast.error('Gagal memuat detail template')
    }
  }

  const createProject = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) {
      toast.error('Template tidak ditemukan')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          name: `My ${template.name}`,
          description: `Auto-created from template: ${template.name}`,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Project "${template.name}" berhasil dibuat`)
        refreshData()
      } else {
        toast.error(data.error || 'Gagal membuat project')
      }
    } catch {
      toast.error('Gagal membuat project')
    } finally {
      setCreating(false)
    }
  }

  const scanHardware = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/auto-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' }),
      })
      const data = await res.json()
      if (data.success) {
        setScanResult({
          detected: data.data.detected.length,
          missing: data.data.missing.length,
        })
        toast.success(`Scan selesai: ${data.data.detected.length} hardware terdeteksi`)
      } else {
        toast.error('Hardware scan gagal')
      }
    } catch {
      toast.error('Hardware scan gagal')
    } finally {
      setScanning(false)
    }
  }

  // Filter templates by category
  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter(t => t.category === categoryFilter)

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="flex gap-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error && templates.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Robot Builder</h2>
          <p className="text-sm text-slate-400 mt-1">Pilih template, auto-detect hardware, dan build robot Anda</p>
        </div>
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
            <Button variant="outline" size="sm" onClick={refreshData} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <RefreshCw className="w-4 h-4 mr-2" />
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Robot Builder</h2>
          <p className="text-sm text-slate-400 mt-1">Pilih template, auto-detect hardware, dan build robot Anda</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={scanHardware} disabled={scanning}>
            <Scan className="w-4 h-4 mr-2" />
            {scanning ? 'Scanning...' : 'Scan Hardware'}
          </Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => {
              if (templates.length > 0) {
                createProject(templates[0].id)
              } else {
                toast.error('Tidak ada template tersedia')
              }
            }}
            disabled={creating || templates.length === 0}
          >
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Quick Create
          </Button>
        </div>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-white">{scanResult.detected} hardware terdeteksi</span>
              </div>
              {scanResult.missing > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-yellow-400">{scanResult.missing} hardware belum terhubung</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-500" />
        {CATEGORY_FILTERS.map(cat => (
          <Button
            key={cat}
            size="sm"
            variant={categoryFilter === cat ? 'default' : 'outline'}
            className={`text-xs h-7 rounded-full ${
              categoryFilter === cat
                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Template Robot</h3>
        {filteredTemplates.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-8 text-center">
              <Bot className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                {categoryFilter === 'all'
                  ? 'Belum ada template robot tersedia'
                  : `Tidak ada template untuk kategori "${CATEGORY_LABELS[categoryFilter] || categoryFilter}"`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="bg-slate-900/50 border-slate-700/50 hover:border-teal-500/50 transition-colors cursor-pointer"
                onClick={() => fetchTemplateDetail(template.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{template.icon}</div>
                      <div>
                        <CardTitle className="text-base text-white">{template.name}</CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                          {CATEGORY_LABELS[template.category] || template.category}
                        </CardDescription>
                      </div>
                    </div>
                    {template.isOfficial && (
                      <Badge variant="outline" className="text-[10px] border-teal-500/50 text-teal-400">Official</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">{template.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={DIFFICULTY_COLORS[template.difficulty] || ''}>
                      {template.difficulty}
                    </Badge>
                    <span className="text-[10px] text-slate-500">{template.estimatedBuildHours}h build</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Existing Projects */}
      {projects.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Projects</h3>
          <div className="space-y-3">
            {projects.map((project) => (
              <Card key={project.id} className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-white">{project.name}</h4>
                      <p className="text-xs text-slate-400">{project.currentStep || project.status}</p>
                    </div>
                    <Badge variant="outline" className={
                      project.status === 'ready' ? 'border-emerald-500/50 text-emerald-400' :
                      project.status === 'active' ? 'border-blue-500/50 text-blue-400' :
                      project.status === 'error' ? 'border-red-500/50 text-red-400' :
                      'border-slate-500/50 text-slate-400'
                    }>
                      {project.status}
                    </Badge>
                  </div>
                  <Progress value={project.buildProgress} className="h-2" />
                  <p className="text-[10px] text-slate-500 mt-1">{project.buildProgress}% complete</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Template Detail Sheet */}
      <Sheet open={showDetail} onOpenChange={setShowDetail}>
        <SheetContent className="bg-slate-950 border-slate-700/50 w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <span className="text-2xl">{selectedTemplate?.icon}</span>
              {selectedTemplate?.name}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              {selectedTemplate?.description}
            </SheetDescription>
          </SheetHeader>

          {selectedTemplate && (
            <div className="mt-6 space-y-6">
              {/* Capabilities */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Kemampuan</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.capabilities.map((cap) => (
                    <Badge key={cap} variant="outline" className="text-[10px] border-teal-500/30 text-teal-400">
                      {cap.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Required Hardware */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-400" />
                  Hardware Diperlukan
                </h4>
                <div className="space-y-2">
                  {selectedTemplate.requiredHardware.map((hw, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-slate-900/50">
                      {hw.required ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs text-white">{hw.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {hw.protocol} {hw.notes ? `— ${hw.notes}` : ''}
                        </p>
                        {hw.alternatives && hw.alternatives.length > 0 && (
                          <p className="text-[10px] text-slate-500">Alternatif: {hw.alternatives.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Firmware */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-teal-400" />
                  Firmware
                </h4>
                <div className="space-y-1">
                  {selectedTemplate.requiredFirmware.map((fw, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <ChevronRight className="w-3 h-3 text-teal-500" />
                      <span className="font-medium">{fw.target}:</span>
                      <span>{fw.version}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assembly Guide */}
              {selectedTemplate.assemblyGuide.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-teal-400" />
                    Panduan Perakitan
                  </h4>
                  <div className="space-y-2">
                    {selectedTemplate.assemblyGuide.map((step) => (
                      <div key={step.step} className="p-3 rounded bg-slate-900/50 border border-slate-700/30">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
                            {step.step}
                          </div>
                          <span className="text-sm font-medium text-white">{step.title}</span>
                          <span className="text-[10px] text-slate-500 ml-auto">{step.duration}</span>
                        </div>
                        <p className="text-xs text-slate-400 ml-8">{step.description}</p>
                        {step.warnings.length > 0 && (
                          <div className="ml-8 mt-1">
                            {step.warnings.map((w, wi) => (
                              <p key={wi} className="text-[10px] text-yellow-400">⚠ {w}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    createProject(selectedTemplate.id)
                    setShowDetail(false)
                  }}
                  disabled={creating}
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Buat Project
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    scanHardware()
                  }}
                  disabled={scanning}
                >
                  {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scan className="w-4 h-4 mr-2" />}
                  Scan
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
