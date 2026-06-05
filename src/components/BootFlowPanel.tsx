'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, CheckCircle2, Loader2, Circle, Zap } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BootStageInfo {
  stage: string
  label: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  details?: string
}

interface BootFlowData {
  currentStage: string
  stages: BootStageInfo[]
  isComplete: boolean
  startedAt?: string
  completedAt?: string
}

const STAGE_ICONS: Record<string, typeof Zap> = {
  power_on: Zap,
  hardware_detection: Zap,
  hal_initialization: Zap,
  agent_startup: Zap,
  system_ready: Zap,
}

export function BootFlowPanel() {
  const [bootFlow, setBootFlow] = useState<BootFlowData | null>(null)
  const [starting, setStarting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/bootflow')
        const json = await res.json()
        if (mounted && json.success) setBootFlow(json.data)
      } catch (err) {
        toast.error('Failed to load boot flow: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
    }
    load()
    return () => { mounted = false }
  }, [refreshKey])

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  const handleStartBoot = async () => {
    setStarting(true)
    try {
      await fetch('/api/bootflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      refresh()
    } catch (err) {
      toast.error('Failed to start boot sequence: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    // Allow boot sequence to run for a bit
    setTimeout(() => setStarting(false), 15000)
  }

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
      case 'failed':
        return <Circle className="w-4 h-4 text-rose-400" />
      default:
        return <Circle className="w-4 h-4 text-slate-600" />
    }
  }

  const completedCount = bootFlow?.stages.filter(s => s.status === 'completed').length || 0
  const totalStages = bootFlow?.stages.length || 5
  const progressPct = (completedCount / totalStages) * 100

  return (
    <Card className="bg-slate-900 border-white/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm text-slate-200">Boot Sequence</CardTitle>
            <CardDescription className="text-xs">
              {bootFlow?.isComplete ? 'System ready' : bootFlow?.startedAt ? 'Boot in progress...' : 'Awaiting boot command'}
            </CardDescription>
          </div>
          {!bootFlow?.isComplete && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartBoot}
              disabled={starting || bootFlow?.stages.some(s => s.status === 'in_progress') || false}
              className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10 h-7 text-xs"
            >
              <Play className="w-3 h-3 mr-1" />
              Boot
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">
              {completedCount}/{totalStages} stages
            </span>
            <span className="text-[10px] text-slate-500">{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="space-y-2">
          {bootFlow?.stages.map((stage, index) => {
            const StageIcon = STAGE_ICONS[stage.stage] || Zap
            return (
              <div key={stage.stage} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  {getStageIcon(stage.status)}
                  {index < (bootFlow.stages.length - 1) && (
                    <div className={`w-px h-4 mt-0.5 ${stage.status === 'completed' ? 'bg-emerald-500/30' : 'bg-slate-700'}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StageIcon className={`w-3 h-3 ${stage.status === 'completed' ? 'text-emerald-400' : stage.status === 'in_progress' ? 'text-teal-400' : 'text-slate-600'}`} />
                    <p className={`text-xs font-medium ${stage.status === 'completed' ? 'text-slate-300' : stage.status === 'in_progress' ? 'text-teal-300' : 'text-slate-500'}`}>
                      {stage.label}
                    </p>
                  </div>
                  {stage.status === 'in_progress' && (
                    <p className="text-[10px] text-slate-500 ml-5">{stage.description}</p>
                  )}
                  {stage.details && stage.status === 'completed' && (
                    <p className="text-[10px] text-slate-600 ml-5 truncate">{stage.details}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
