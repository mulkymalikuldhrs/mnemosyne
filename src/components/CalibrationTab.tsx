'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Compass,
  RotateCw,
  Cpu,
  Zap,
  Radio,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface CalibrationRecord {
  id: string
  deviceType: string
  deviceId?: string | null
  status: string
  parameters?: string | null
  results?: string | null
  performedAt: string
  createdAt: string
  updatedAt: string
}

interface CalibrationStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  failed: number
}

interface CalibrationData {
  calibrations: CalibrationRecord[]
  stats: CalibrationStats
}

type CalDeviceType = 'compass' | 'accelerometer' | 'gyro' | 'esc' | 'radio'

const CALIBRATION_TYPES: CalDeviceType[] = ['compass', 'accelerometer', 'gyro', 'esc', 'radio']

const TYPE_ICONS: Record<CalDeviceType, typeof Compass> = {
  compass: Compass,
  accelerometer: RotateCw,
  gyro: Cpu,
  esc: Zap,
  radio: Radio,
}

const TYPE_COLORS: Record<CalDeviceType, { bg: string; text: string; border: string; label: string }> = {
  compass: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25', label: 'Compass' },
  accelerometer: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/25', label: 'Accelerometer' },
  gyro: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25', label: 'Gyroscope' },
  esc: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/25', label: 'ESC' },
  radio: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/25', label: 'Radio' },
}

const TYPE_DESCRIPTIONS: Record<CalDeviceType, string> = {
  compass: 'Magnetometer calibration — compensates for hard/soft iron interference to ensure accurate heading',
  accelerometer: 'Accelerometer calibration — corrects offset and scaling for level sensing and motion detection',
  gyro: 'Gyroscope calibration — zeroes out bias drift for stable attitude estimation',
  esc: 'ESC calibration — synchronizes throttle range between flight controller and motor controllers',
  radio: 'Radio calibration — verifies link quality, frequency tuning, and signal integrity',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  in_progress: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  in_progress: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
}

// Calibration durations (ms) for progress bar
const CAL_DURATIONS: Record<CalDeviceType, number> = {
  compass: 3000,
  accelerometer: 2000,
  gyro: 2500,
  esc: 4000,
  radio: 1500,
}

export function CalibrationTab() {
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([])
  const [stats, setStats] = useState<CalibrationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedType, setExpandedType] = useState<CalDeviceType | null>(null)
  const [startingCal, setStartingCal] = useState<CalDeviceType | null>(null)
  const [progressMap, setProgressMap] = useState<Record<CalDeviceType, number>>({} as Record<CalDeviceType, number>)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Load data
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/calibration?limit=20')
        const json = await res.json()
        if (mounted && json.success) {
          setCalibrations(json.data.calibrations)
          setStats(json.data.stats)
        }
      } catch (err) {
        toast.error('Failed to load calibration data: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [refreshKey])

  // Poll every 2 seconds when any calibration is in progress
  useEffect(() => {
    const hasInProgress = calibrations.some(c => c.status === 'in_progress' || c.status === 'pending')

    if (hasInProgress) {
      pollingRef.current = setInterval(() => {
        setRefreshKey(k => k + 1)
      }, 2000)
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [calibrations])

  // Animate progress for in-progress calibrations
  useEffect(() => {
    const inProgressTypes = calibrations
      .filter(c => c.status === 'in_progress')
      .map(c => c.deviceType as CalDeviceType)

    if (inProgressTypes.length === 0) return

    const interval = setInterval(() => {
      setProgressMap(prev => {
        const next = { ...prev }
        for (const type of inProgressTypes) {
          const current = next[type] || 0
          const increment = 100 / (CAL_DURATIONS[type] / 200)
          next[type] = Math.min(current + increment, 95) // Cap at 95% until complete
        }
        return next
      })
    }, 200)

    return () => clearInterval(interval)
  }, [calibrations])

  // Compute completed progress values derived from calibration data
  const completedProgress = useCallback((): Record<CalDeviceType, number> => {
    const map = {} as Record<CalDeviceType, number>
    for (const cal of calibrations) {
      const type = cal.deviceType as CalDeviceType
      if (cal.status === 'completed') {
        map[type] = 100
      } else if (cal.status === 'failed') {
        map[type] = map[type] || 0
      }
    }
    return map
  }, [calibrations])

  const handleStartCalibration = async (deviceType: CalDeviceType) => {
    setStartingCal(deviceType)
    setProgressMap(prev => ({ ...prev, [deviceType]: 0 }))

    try {
      const res = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceType }),
      })
      const json = await res.json()
      if (json.success) {
        // Refresh to get updated data
        setTimeout(() => refresh(), 500)
      }
    } catch (err) {
      toast.error('Failed to start calibration: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }

    setStartingCal(null)
  }

  const getLatestCalibration = (deviceType: CalDeviceType): CalibrationRecord | null => {
    return calibrations
      .filter(c => c.deviceType === deviceType)
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0] || null
  }

  const getCalibrationHistory = (deviceType: CalDeviceType): CalibrationRecord[] => {
    return calibrations
      .filter(c => c.deviceType === deviceType)
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
  }

  const getCurrentStatus = (deviceType: CalDeviceType): string => {
    const latest = getLatestCalibration(deviceType)
    return latest?.status || 'pending'
  }

  const renderResultSummary = (results: string) => {
    try {
      const parsed = JSON.parse(results)
      return (
        <div className="space-y-1">
          {Object.entries(parsed).map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              return (
                <div key={key} className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 min-w-[80px]">{key}:</span>
                  <span className="text-slate-300 font-mono">{JSON.stringify(value)}</span>
                </div>
              )
            }
            return (
              <div key={key} className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-500 min-w-[80px]">{key}:</span>
                <span className="text-slate-300 font-mono">{String(value)}</span>
              </div>
            )
          })}
        </div>
      )
    } catch {
      return <p className="text-[10px] text-slate-500">{results}</p>
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-900 rounded-xl animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">Sensor Calibration</h3>
          </div>
          {stats && (
            <div className="hidden sm:flex items-center gap-2 text-[10px]">
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                {stats.completed} done
              </Badge>
              {stats.inProgress > 0 && (
                <Badge variant="outline" className="text-[9px] bg-teal-500/10 text-teal-400 border-teal-500/30">
                  {stats.inProgress} active
                </Badge>
              )}
              {stats.failed > 0 && (
                <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-400 border-rose-500/30">
                  {stats.failed} failed
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          className="h-7 text-[10px] border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
        >
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Calibration Type Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CALIBRATION_TYPES.map((deviceType) => {
          const TypeIcon = TYPE_ICONS[deviceType]
          const colors = TYPE_COLORS[deviceType]
          const currentStatus = getCurrentStatus(deviceType)
          const latestCal = getLatestCalibration(deviceType)
          const isExpanded = expandedType === deviceType
          const isStarting = startingCal === deviceType
          const isInProgress = currentStatus === 'in_progress'
          const isPending = currentStatus === 'pending'
          const completedProg = completedProgress()
          const progress = completedProg[deviceType] ?? progressMap[deviceType] ?? 0
          const StatusIcon = STATUS_ICONS[currentStatus] || Clock
          const history = getCalibrationHistory(deviceType)

          return (
            <Card
              key={deviceType}
              className={`bg-slate-900 border-white/5 hover:border-white/10 transition-colors ${
                isExpanded ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <CardContent className="p-4">
                {/* Type Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                      <TypeIcon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{colors.label}</p>
                      <p className="text-[10px] text-slate-500">{TYPE_DESCRIPTIONS[deviceType].split('—')[0].trim()}</p>
                    </div>
                  </div>
                  <Badge className={`${STATUS_BADGE_COLORS[currentStatus] || STATUS_BADGE_COLORS.pending} border text-[9px]`}>
                    {currentStatus.replace('_', ' ')}
                  </Badge>
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                  {TYPE_DESCRIPTIONS[deviceType].split('—')[1]?.trim() || TYPE_DESCRIPTIONS[deviceType]}
                </p>

                {/* Progress bar for in-progress calibration */}
                {(isInProgress || isPending) && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-teal-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {isPending ? 'Waiting...' : 'Calibrating...'}
                      </span>
                      <span className="text-[9px] text-slate-500">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-slate-800" />
                  </div>
                )}

                {/* Last calibration info */}
                {latestCal && !isInProgress && !isPending && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
                    <StatusIcon className={`w-3 h-3 ${
                      currentStatus === 'completed' ? 'text-emerald-400' :
                      currentStatus === 'failed' ? 'text-rose-400' : 'text-slate-500'
                    } ${currentStatus === 'in_progress' ? 'animate-spin' : ''}`} />
                    <span>Last: {new Date(latestCal.performedAt).toLocaleString()}</span>
                  </div>
                )}

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedType(isExpanded ? null : deviceType)}
                  className="flex items-center gap-1 text-[10px] text-teal-400/70 hover:text-teal-400 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isExpanded ? 'Less' : 'Details & History'}
                </button>

                {/* Expanded: Start Button + Results + History */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                    {/* Start Calibration Button */}
                    <Button
                      size="sm"
                      onClick={() => handleStartCalibration(deviceType)}
                      disabled={isStarting || isInProgress || isPending}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white h-8 text-[11px]"
                    >
                      {isStarting ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : isInProgress || isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {isStarting ? 'Starting...' :
                        isInProgress ? 'Calibrating...' :
                        isPending ? 'Queued...' :
                        `Calibrate ${colors.label}`}
                    </Button>

                    {/* Latest Results */}
                    {latestCal?.results && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-medium mb-1.5">Latest Results</p>
                        <div className="p-2.5 bg-slate-800/50 rounded-lg border border-white/5">
                          {renderResultSummary(latestCal.results)}
                        </div>
                      </div>
                    )}

                    {/* Calibration History */}
                    {history.length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 font-medium mb-1.5">
                          History ({history.length})
                        </p>
                        <ScrollArea className="max-h-40">
                          <div className="space-y-1.5">
                            {history.map((cal) => (
                              <div
                                key={cal.id}
                                className="flex items-center justify-between p-2 bg-slate-800/30 rounded border border-white/5"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    cal.status === 'completed' ? 'bg-emerald-400' :
                                    cal.status === 'failed' ? 'bg-rose-400' :
                                    cal.status === 'in_progress' ? 'bg-teal-400 animate-pulse' :
                                    'bg-amber-400'
                                  }`} />
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(cal.performedAt).toLocaleString()}
                                  </span>
                                </div>
                                <Badge className={`${STATUS_BADGE_COLORS[cal.status] || ''} border text-[8px]`}>
                                  {cal.status.replace('_', ' ')}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {history.length === 0 && (
                      <p className="text-[10px] text-slate-600 italic">No calibration history</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Stats Summary */}
      {stats && (
        <Card className="bg-slate-900 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-500">Total</p>
                <span className="text-sm font-semibold text-white">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <p className="text-[10px] text-slate-500">Pending</p>
                <span className="text-sm font-semibold text-amber-400">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <p className="text-[10px] text-slate-500">In Progress</p>
                <span className="text-sm font-semibold text-teal-400">{stats.inProgress}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <p className="text-[10px] text-slate-500">Completed</p>
                <span className="text-sm font-semibold text-emerald-400">{stats.completed}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <p className="text-[10px] text-slate-500">Failed</p>
                <span className="text-sm font-semibold text-rose-400">{stats.failed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-slate-900 border-white/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300 mb-1">Calibration Guidelines</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Ensure the drone is on a stable, level surface before starting accelerometer or gyro calibration.
                For compass calibration, perform the calibration outdoors away from metal structures and electromagnetic interference.
                ESC calibration requires all propellers to be removed for safety. Radio calibration is best performed with
                the transmitter and receiver at the intended operating distance. Each calibration typically takes 1–4 seconds.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
