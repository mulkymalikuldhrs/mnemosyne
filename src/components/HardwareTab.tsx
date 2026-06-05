'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Cpu,
  Radio,
  Camera,
  Satellite,
  Battery,
  Fan,
  CircuitBoard,
  MemoryStick,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Usb,
  Wifi,
} from 'lucide-react'
import { DEVICE_TYPE_LABELS, PROTOCOL_LABELS } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'

interface HardwareProfile {
  id: string
  adapterName: string
  config: string
  isDefault: boolean
}

interface HardwareDevice {
  id: string
  name: string
  deviceType: string
  protocol: string
  status: string
  vendorId?: string | null
  productId?: string | null
  port?: string | null
  address?: string | null
  capabilities?: string | null
  firmware?: string | null
  lastSeen: string
  profiles: HardwareProfile[]
}

interface HardwareStats {
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
}

const DEVICE_ICONS: Record<string, typeof Cpu> = {
  flight_controller: CircuitBoard,
  companion_computer: MemoryStick,
  gps: Satellite,
  camera: Camera,
  sensor: Cpu,
  radio: Radio,
  battery: Battery,
  motor: Fan,
  servo: Cpu,
  esc: CircuitBoard,
}

const STATUS_DOT_COLORS: Record<string, string> = {
  unknown: 'bg-slate-500',
  detected: 'bg-amber-500',
  initialized: 'bg-teal-500',
  active: 'bg-emerald-500 animate-pulse-dot',
  error: 'bg-rose-500',
  offline: 'bg-slate-600',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  unknown: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  detected: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  initialized: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  error: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  offline: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

export function HardwareTab() {
  const [devices, setDevices] = useState<HardwareDevice[]>([])
  const [stats, setStats] = useState<HardwareStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const url = statusFilter !== 'all' ? `/api/hardware?status=${statusFilter}` : '/api/hardware'
        const res = await fetch(url)
        const json = await res.json()
        if (mounted && json.success) {
          setDevices(json.data.devices)
          setStats(json.data.stats)
        }
      } catch (err) {
        toast.error('Failed to load hardware: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [refreshKey, statusFilter])

  const handleScan = async () => {
    setScanning(true)
    try {
      await fetch('/api/hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      refresh()
    } catch (err) {
      toast.error('Failed to scan hardware: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setScanning(false)
  }

  const handleStatusUpdate = async (deviceId: string, status: string) => {
    try {
      await fetch('/api/hardware', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, status }),
      })
      refresh()
    } catch (err) {
      toast.error('Failed to update device status: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const toggleExpand = (deviceId: string) => {
    setExpandedDevice(expandedDevice === deviceId ? null : deviceId)
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 bg-slate-900 border-white/10 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Devices</SelectItem>
              <SelectItem value="detected">Detected</SelectItem>
              <SelectItem value="initialized">Initialized</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500">{devices.length} devices</span>
          {stats && (
            <div className="hidden sm:flex items-center gap-2 text-[10px]">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <span key={status} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLORS[status] || 'bg-slate-500'}`} />
                  <span className="text-slate-500">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleScan}
          disabled={scanning}
          data-testid="scan-hardware-btn"
          className="bg-teal-600 hover:bg-teal-700 text-white h-8"
        >
          <Search className={`w-3.5 h-3.5 mr-1.5 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan Hardware'}
        </Button>
      </div>

      {/* Device Grid */}
      {devices.length === 0 ? (
        <Card className="bg-slate-900 border-white/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Cpu className="w-10 h-10 mb-3 text-slate-600" />
            <p className="text-sm">No hardware devices detected</p>
            <p className="text-xs text-slate-600 mt-1">Run a hardware scan to detect connected devices</p>
          </CardContent>
        </Card>
      ) : (
        <div role="list" aria-label="Device list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
            const DeviceIcon = DEVICE_ICONS[device.deviceType] || Cpu
            const isExpanded = expandedDevice === device.id
            let caps: unknown[] = []
            try { caps = JSON.parse(device.capabilities || '[]') } catch { caps = [] }
            const profiles = device.profiles || []

            return (
              <Card
                key={device.id}
                role="listitem"
                aria-label={`${device.name} - ${device.status}`}
                className={`bg-slate-900 border-white/5 hover:border-white/10 transition-colors ${
                  device.status === 'error' ? 'border-rose-500/30' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
                        <DeviceIcon className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{device.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {DEVICE_TYPE_LABELS[device.deviceType] || device.deviceType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[device.status] || 'bg-slate-500'}`} />
                      <Badge className={`${STATUS_BADGE_COLORS[device.status] || STATUS_BADGE_COLORS.unknown} border text-[9px]`}>
                        {device.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Usb className="w-3 h-3" />
                      {PROTOCOL_LABELS[device.protocol] || device.protocol}
                    </span>
                    {device.port && (
                      <span className="font-mono text-slate-600 truncate">{device.port}</span>
                    )}
                    {device.address && (
                      <span className="font-mono text-slate-600">{device.address}</span>
                    )}
                  </div>

                  {device.firmware && (
                    <p className="text-[9px] text-slate-600 mb-2">FW: {device.firmware}</p>
                  )}

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(device.id)}
                    className="flex items-center gap-1 text-[10px] text-teal-400/70 hover:text-teal-400 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Less' : 'More'}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                      {device.vendorId && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Vendor ID</span>
                          <span className="text-slate-300 font-mono">{device.vendorId}</span>
                        </div>
                      )}
                      {device.productId && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Product ID</span>
                          <span className="text-slate-300 font-mono">{device.productId}</span>
                        </div>
                      )}
                      {caps.length > 0 && (
                        <div className="text-[10px]">
                          <span className="text-slate-500">Capabilities: </span>
                          <span className="text-slate-300">{caps.join(', ')}</span>
                        </div>
                      )}
                      {profiles.length > 0 && (
                        <div className="text-[10px]">
                          <span className="text-slate-500">Adapter: </span>
                          <span className="text-slate-300">{profiles[0].adapterName}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">Last Seen</span>
                        <span className="text-slate-300 font-mono">{new Date(device.lastSeen).toLocaleTimeString()}</span>
                      </div>

                      {/* Status update */}
                      <div className="flex gap-1.5 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusUpdate(device.id, 'active')}
                          className="h-6 text-[9px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          Set Active
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusUpdate(device.id, 'offline')}
                          className="h-6 text-[9px] border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                        >
                          Set Offline
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
