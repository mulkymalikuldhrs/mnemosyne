'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Battery, Sun, Radio, Usb, Zap, AlertTriangle, Thermometer,
  RefreshCw, Loader2, Power, PowerOff,
} from 'lucide-react'
import { toast } from 'sonner'

interface PowerSource {
  id: string
  type: string
  name: string
  status: string
  capacity: number
  currentLevel: number
  voltage: number
  current: number
  temperature: number
  lastReading: string
}

interface PowerStatus {
  mainBattery: { voltage: number; percentage: number; status: string; estimatedMinutes: number }
  solar: { voltage: number; isCharging: boolean; wattage: number }
  gsm: { voltage: number; isConnected: boolean }
  emergencyMode: boolean
}

const SOURCE_ICONS: Record<string, typeof Battery> = {
  battery: Battery,
  solar: Sun,
  gsm: Radio,
  usb: Usb,
}

const STATUS_LABELS: Record<string, string> = {
  unknown: 'Unknown',
  charging: 'Charging',
  discharging: 'Discharging',
  full: 'Full',
  error: 'Error',
  offline: 'Offline',
}

export function PowerTab() {
  const [sources, setSources] = useState<PowerSource[]>([])
  const [status, setStatus] = useState<PowerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingSource, setTogglingSource] = useState<string | null>(null)
  const [sourceEnabledMap, setSourceEnabledMap] = useState<Record<string, boolean>>({})

  const fetchPower = useCallback(async (initializeEnabledMap = false) => {
    try {
      setError(null)
      const res = await fetch('/api/power')
      const data = await res.json()
      if (data.success) {
        setSources(data.data.sources)
        setStatus(data.data.status)
        if (initializeEnabledMap) {
          const enabledMap: Record<string, boolean> = {}
          data.data.sources.forEach((s: PowerSource) => {
            enabledMap[s.id] = s.status !== 'offline'
          })
          setSourceEnabledMap(enabledMap)
        }
      }
    } catch {
      setError('Gagal memuat data daya. Periksa koneksi server.')
      toast.error('Gagal memuat data power')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPower(true).finally(() => setLoading(false))
    const interval = setInterval(() => fetchPower(false), 5000)
    return () => { clearInterval(interval) }
  }, [fetchPower])

  const toggleSource = async (sourceId: string, enable: boolean) => {
    setTogglingSource(sourceId)
    try {
      const res = await fetch('/api/power', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          reading: { status: enable ? 'unknown' : 'offline' },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSourceEnabledMap(prev => ({ ...prev, [sourceId]: enable }))
        toast.success(enable ? 'Sumber daya diaktifkan' : 'Sumber daya dinonaktifkan')
        fetchPower()
      } else {
        toast.error('Gagal mengubah status sumber daya')
      }
    } catch {
      toast.error('Gagal mengubah status sumber daya')
    } finally {
      setTogglingSource(null)
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  // Error state
  if (error && !status) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Power Management</h2>
          <p className="text-sm text-slate-400 mt-1">Baterai, Panel Surya, GSM - monitoring daya real-time</p>
        </div>
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchPower(false)} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Power Management</h2>
          <p className="text-sm text-slate-400 mt-1">Baterai, Panel Surya, GSM - monitoring daya real-time</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchPower(false)} data-testid="power-refresh-btn" className="border-slate-700 text-slate-400">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Emergency Mode Banner */}
      {status?.emergencyMode && (
        <Card className="bg-red-900/30 border-red-500/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <p className="text-sm font-bold text-red-400">EMERGENCY POWER MODE</p>
              <p className="text-xs text-red-300">Baterai rendah, panel surya aktif sebagai backup</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Battery Status */}
      {status && (
        <Card aria-label="Main battery status" className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Battery className="w-4 h-4 text-teal-400" />
              Baterai Utama
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{status.mainBattery.voltage.toFixed(1)}V</span>
                <Badge variant="outline" className={
                  status.mainBattery.percentage > 50 ? 'border-emerald-500/50 text-emerald-400' :
                  status.mainBattery.percentage > 20 ? 'border-yellow-500/50 text-yellow-400' :
                  'border-red-500/50 text-red-400'
                }>
                  {STATUS_LABELS[status.mainBattery.status] || status.mainBattery.status}
                </Badge>
              </div>
              <Progress value={status.mainBattery.percentage} role="progressbar" aria-valuenow={status.mainBattery.percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Battery level: ${status.mainBattery.percentage}%`} className="h-3" />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{status.mainBattery.percentage}%</span>
                <span>Est. {status.mainBattery.estimatedMinutes} menit tersisa</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Power Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((source) => {
          const IconComp = SOURCE_ICONS[source.type] || Battery
          const isEnabled = sourceEnabledMap[source.id] !== false
          const isToggling = togglingSource === source.id
          return (
            <Card key={source.id} aria-label={`Power source: ${source.name}`} className={`bg-slate-900/50 border-slate-700/50 transition-opacity ${!isEnabled ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComp className="w-5 h-5 text-teal-400" />
                    <CardTitle className="text-sm text-white">{source.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABELS[source.status] || source.status}
                    </Badge>
                    {/* Toggle control */}
                    <button
                      onClick={() => toggleSource(source.id, !isEnabled)}
                      disabled={isToggling}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
                      style={{ backgroundColor: isEnabled ? '#14b8a6' : '#475569' }}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3 h-3 text-white absolute left-1/2 -translate-x-1/2 animate-spin" />
                      ) : (
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      )}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span className="text-slate-400">Voltage:</span>
                    <span className="text-white">{source.voltage.toFixed(2)}V</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-blue-400" />
                    <span className="text-slate-400">Current:</span>
                    <span className="text-white">{source.current.toFixed(2)}A</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3 h-3 text-red-400" />
                    <span className="text-slate-400">Temp:</span>
                    <span className="text-white">{source.temperature.toFixed(1)}°C</span>
                  </div>
                  {source.capacity > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Battery className="w-3 h-3 text-emerald-400" />
                      <span className="text-slate-400">Capacity:</span>
                      <span className="text-white">{source.capacity}mAh</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleSource(source.id, true)}
                    disabled={isEnabled || isToggling}
                    className="flex-1 text-[10px] h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Power className="w-3 h-3 mr-1" />
                    Enable
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleSource(source.id, false)}
                    disabled={!isEnabled || isToggling}
                    className="flex-1 text-[10px] h-7 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <PowerOff className="w-3 h-3 mr-1" />
                    Disable
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Solar Panel Info */}
      {status && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Sun className="w-4 h-4 text-yellow-400" />
              Panel Surya Darurat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-white">{status.solar.voltage.toFixed(1)}V</p>
                <p className="text-[10px] text-slate-400">Voltage</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{status.solar.wattage}W</p>
                <p className="text-[10px] text-slate-400">Panel Wattage</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${status.solar.isCharging ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {status.solar.isCharging ? 'Active' : 'Standby'}
                </p>
                <p className="text-[10px] text-slate-400">Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
