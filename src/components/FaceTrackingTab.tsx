'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Eye, EyeOff, Camera, Users, UserPlus, Trash2, Loader2,
  RefreshCw, AlertCircle, Play, Square, Scan, Settings,
  Shield, Target, Fingerprint, Clock, MapPin, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ---- Types ----
interface TrackingState {
  status: string
  mode: string
  backend: string
  activeFace: DetectedFace | null
  allFaces: DetectedFace[]
  servoPosition: { pan: number; tilt: number }
  frameCount: number
  fps: number
  lastDetectionTime: string | null
  isRunning: boolean
}

interface DetectedFace {
  id: string
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
    centerX: number
    centerY: number
    area: number
  }
  confidence: number
  label?: string
  recognizedPerson?: {
    faceProfileId: string
    name: string
    label: string
    confidence: number
    sightings: number
    lastSeen: string
  }
  timestamp: string
}

interface FaceProfileEntry {
  id: string
  name: string
  label: string
  encoding: number[]
  photoPath?: string
  metadata?: Record<string, unknown>
  confidence: number
  sightings: number
  lastSeen: string
  createdAt: string
  updatedAt: string
}

interface TrackingConfig {
  enabled: boolean
  modelPath: string
  confidenceThreshold: number
  trackingMode: string
  maxFaces: number
  followDistance: number
}

interface TrackingStats {
  isRunning: boolean
  status: string
  backend: string
  mode: string
  frameCount: number
  fps: number
  facesDetected: number
  facesRegistered: number
  lastDetectionTime: string | null
  servoPosition: { pan: number; tilt: number }
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-slate-500',
  detecting: 'bg-blue-500',
  tracking: 'bg-emerald-500',
  identifying: 'bg-yellow-500',
  error: 'bg-red-500',
}

const MODE_LABELS: Record<string, string> = {
  follow: 'Follow Mode',
  detect: 'Detect Mode',
  identify: 'Identify Mode',
}

export function FaceTrackingTab() {
  const [trackingState, setTrackingState] = useState<TrackingState | null>(null)
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([])
  const [faceDatabase, setFaceDatabase] = useState<FaceProfileEntry[]>([])
  const [stats, setStats] = useState<TrackingStats | null>(null)
  const [config, setConfig] = useState<TrackingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Action states
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [deletingFace, setDeletingFace] = useState<string | null>(null)
  const [updatingConfig, setUpdatingConfig] = useState(false)

  // Register form
  const [registerName, setRegisterName] = useState('')
  const [registerLabel, setRegisterLabel] = useState('')

  // Config controls
  const [selectedMode, setSelectedMode] = useState<string>('detect')
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7)

  const fetchAllData = useCallback(async () => {
    try {
      setError(null)
      const [statusRes, facesRes, statsRes] = await Promise.all([
        fetch('/api/face-tracking?action=status'),
        fetch('/api/face-tracking?action=faces'),
        fetch('/api/face-tracking?action=stats'),
      ])

      const statusData = await statusRes.json()
      const facesData = await facesRes.json()
      const statsData = await statsRes.json()

      if (statusData.success) {
        setTrackingState(statusData.data)
        if (statusData.data.mode) setSelectedMode(statusData.data.mode)
      }
      if (facesData.success) setFaceDatabase(facesData.data.faces || [])
      if (statsData.success) setStats(statsData.data)

      // Also try to get detected faces
      try {
        const detectRes = await fetch('/api/face-tracking?action=detect')
        const detectData = await detectRes.json()
        if (detectData.success) setDetectedFaces(detectData.data.faces || [])
      } catch {
        // detection may fail if tracking not running
      }
    } catch {
      setError('Gagal memuat data face tracking. Periksa koneksi server.')
      toast.error('Gagal memuat data face tracking')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAllData().finally(() => setLoading(false))

    // Poll for updates when tracking is running
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch('/api/face-tracking?action=status')
        const statusData = await statusRes.json()
        if (statusData.success && statusData.data.isRunning) {
          setTrackingState(statusData.data)
          // Also refresh detected faces
          const detectRes = await fetch('/api/face-tracking?action=detect')
          const detectData = await detectRes.json()
          if (detectData.success) setDetectedFaces(detectData.data.faces || [])
        }
      } catch {
        // polling errors are fine
      }
    }, 3000)

    return () => { clearInterval(interval) }
  }, [fetchAllData])

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/face-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode: selectedMode }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Face tracking dimulai dalam mode ${selectedMode}`)
        fetchAllData()
      } else {
        toast.error(data.error || 'Gagal memulai tracking')
      }
    } catch {
      toast.error('Gagal memulai face tracking')
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    setStopping(true)
    try {
      const res = await fetch('/api/face-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Face tracking dihentikan')
        setDetectedFaces([])
        fetchAllData()
      } else {
        toast.error(data.error || 'Gagal menghentikan tracking')
      }
    } catch {
      toast.error('Gagal menghentikan face tracking')
    } finally {
      setStopping(false)
    }
  }

  const handleRegisterFace = async () => {
    if (!registerName || !registerLabel) {
      toast.error('Nama dan label wajib diisi')
      return
    }
    setRegistering(true)
    try {
      // NOTE: This uses SIMULATED bounding box data, not actual camera input.
      // Face registration with real camera input is not yet implemented.
      const res = await fetch('/api/face-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: registerName,
          label: registerLabel,
          face: {
            id: `face-register-${Date.now()}`,
            boundingBox: { x: 150, y: 100, width: 120, height: 150, centerX: 210, centerY: 175, area: 18000 },
            confidence: 0.85,
            timestamp: new Date().toISOString(),
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Wajah "${registerName}" berhasil didaftarkan`)
        setRegisterName('')
        setRegisterLabel('')
        fetchAllData()
      } else {
        toast.error(data.error || 'Gagal mendaftarkan wajah')
      }
    } catch {
      toast.error('Gagal mendaftarkan wajah')
    } finally {
      setRegistering(false)
    }
  }

  const handleDeleteFace = async (faceProfileId: string) => {
    setDeletingFace(faceProfileId)
    try {
      const res = await fetch('/api/face-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', faceProfileId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Profil wajah berhasil dihapus')
        fetchAllData()
      } else {
        toast.error(data.error || 'Gagal menghapus profil wajah')
      }
    } catch {
      toast.error('Gagal menghapus profil wajah')
    } finally {
      setDeletingFace(null)
    }
  }

  const handleUpdateConfig = async (updates: Record<string, unknown>) => {
    setUpdatingConfig(true)
    try {
      const res = await fetch('/api/face-tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Konfigurasi berhasil di-update')
        fetchAllData()
      } else {
        toast.error(data.error || 'Gagal mengupdate konfigurasi')
      }
    } catch {
      toast.error('Gagal mengupdate konfigurasi')
    } finally {
      setUpdatingConfig(false)
    }
  }

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
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (error && !trackingState) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Face Tracking</h2>
          <p className="text-sm text-slate-400 mt-1">Deteksi, tracking, dan identifikasi wajah</p>
        </div>
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAllData} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <RefreshCw className="w-4 h-4 mr-2" />
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isRunning = trackingState?.isRunning ?? false

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Face Tracking</h2>
          <p className="text-sm text-slate-400 mt-1">Deteksi, tracking, dan identifikasi wajah</p>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Start
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleStop}
              disabled={stopping}
            >
              {stopping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
              Stop
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchAllData} className="border-slate-700 text-slate-400">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tracking Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            {isRunning ? (
              <Eye className="w-5 h-5 text-emerald-400 mb-1" />
            ) : (
              <EyeOff className="w-5 h-5 text-slate-500 mb-1" />
            )}
            <span className="text-sm font-bold text-white">{isRunning ? 'Active' : 'Inactive'}</span>
            <span className="text-[10px] text-slate-400">Tracking Status</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <Target className="w-5 h-5 text-teal-400 mb-1" />
            <span className="text-sm font-bold text-white">{MODE_LABELS[selectedMode] || selectedMode}</span>
            <span className="text-[10px] text-slate-400">Mode</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <Camera className="w-5 h-5 text-yellow-400 mb-1" />
            <span className="text-sm font-bold text-white">{stats?.fps ?? 0} FPS</span>
            <span className="text-[10px] text-slate-400">Frame Rate</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <Users className="w-5 h-5 text-purple-400 mb-1" />
            <span className="text-sm font-bold text-white">{detectedFaces.length}</span>
            <span className="text-[10px] text-slate-400">Faces Detected</span>
          </CardContent>
        </Card>
      </div>

      {/* Camera Preview Placeholder */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-400" />
            Camera Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative bg-slate-800 rounded-lg aspect-video flex items-center justify-center overflow-hidden border border-slate-700/50">
            {isRunning ? (
              <>
                {/* Simulated camera feed */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-700/50 to-slate-800">
                  {/* Face bounding boxes */}
                  {detectedFaces.map((face) => (
                    <div
                      key={face.id}
                      className="absolute border-2 border-emerald-400 rounded-sm"
                      style={{
                        left: `${(face.boundingBox.x / 640) * 100}%`,
                        top: `${(face.boundingBox.y / 480) * 100}%`,
                        width: `${(face.boundingBox.width / 640) * 100}%`,
                        height: `${(face.boundingBox.height / 480) * 100}%`,
                      }}
                    >
                      <span className="absolute -top-5 left-0 text-[9px] bg-emerald-500/80 text-white px-1 rounded-sm whitespace-nowrap">
                        {face.recognizedPerson?.name || `Face ${(face.confidence * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="relative z-10 text-center">
                  <Camera className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Camera feed active</p>
                  <p className="text-[10px] text-slate-500">Backend: {trackingState?.backend || 'simulation'}</p>
                </div>
                {/* Status overlay */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[trackingState?.status || 'idle']} animate-pulse`} />
                  <span className="text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">{trackingState?.status || 'idle'}</span>
                </div>
                <div className="absolute top-2 right-2 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">
                  {stats?.fps ?? 0} FPS
                </div>
              </>
            ) : (
              <div className="text-center">
                <EyeOff className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Tracking tidak aktif</p>
                <p className="text-xs text-slate-600 mt-1">Klik &quot;Start&quot; untuk memulai</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Detected Faces */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Scan className="w-4 h-4 text-teal-400" />
              Detected Faces
            </CardTitle>
            <CardDescription>Wajah yang terdeteksi saat ini</CardDescription>
          </CardHeader>
          <CardContent>
            {detectedFaces.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                {isRunning ? 'Belum ada wajah terdeteksi' : 'Tracking tidak aktif'}
              </p>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {detectedFaces.map((face) => (
                    <div key={face.id} className="p-2 rounded-lg bg-slate-800/50 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                          <Fingerprint className="w-4 h-4 text-teal-400" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">
                            {face.recognizedPerson?.name || 'Unknown'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Confidence: {(face.confidence * 100).toFixed(1)}%
                            {face.recognizedPerson && ` • ${face.recognizedPerson.label}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-teal-500/30 text-teal-400">
                        {face.boundingBox.area}px²
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Face Database */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" />
              Face Database
            </CardTitle>
            <CardDescription>{faceDatabase.length} wajah terdaftar</CardDescription>
          </CardHeader>
          <CardContent>
            {faceDatabase.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Belum ada wajah terdaftar</p>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {faceDatabase.map((face) => (
                    <div key={face.id} className="p-2 rounded-lg bg-slate-800/50 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-teal-400">
                            {face.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">{face.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{face.label}</span>
                            <span>•</span>
                            <span>{face.sightings} sightings</span>
                            <span>•</span>
                            <Clock className="w-2.5 h-2.5" />
                            <span>{new Date(face.lastSeen).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] border-slate-600 text-slate-400">
                          {(face.confidence * 100).toFixed(0)}%
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                              disabled={deletingFace === face.id}
                            >
                              {deletingFace === face.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-900 border-slate-700">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Delete Face Profile</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-400">
                                Are you sure you want to delete the face profile for &quot;{face.name}&quot;? This will permanently remove their facial encoding and sighting history. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-slate-700 text-slate-300">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteFace(face.id)} className="bg-rose-600 hover:bg-rose-700 text-white">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-400" />
            Tracking Controls
          </CardTitle>
          <CardDescription>Konfigurasi mode tracking dan threshold</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mode Selector */}
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">Tracking Mode</label>
              <Select
                value={selectedMode}
                onValueChange={(val) => {
                  setSelectedMode(val)
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-xs h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="detect">Detect Mode</SelectItem>
                  <SelectItem value="follow">Follow Mode</SelectItem>
                  <SelectItem value="identify">Identify Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Confidence Threshold */}
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">
                Confidence Threshold: {confidenceThreshold.toFixed(2)}
              </label>
              <Slider
                value={[confidenceThreshold]}
                onValueChange={([val]) => setConfidenceThreshold(val)}
                min={0.1}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>
          </div>

          <Button
            onClick={() => handleUpdateConfig({
              trackingMode: selectedMode,
              confidenceThreshold,
            })}
            disabled={updatingConfig}
            className="bg-teal-600 hover:bg-teal-700 w-full"
          >
            {updatingConfig ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 mr-2" />
                Apply Configuration
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Register Face */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-400" />
            Register Face
          </CardTitle>
          <CardDescription>Daftarkan wajah baru ke database</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Simulated Data Warning */}
          <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300">
              <strong>Simulated Data:</strong> Face registration currently uses simulated bounding box data instead of actual camera input. The registered face profile will not contain real facial encoding from a camera feed.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">Nama</label>
              <Input
                placeholder="Nama orang"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">Label</label>
              <Input
                placeholder="Label unik (contoh: operator_01)"
                value={registerLabel}
                onChange={(e) => setRegisterLabel(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-xs"
              />
            </div>
          </div>
          <Button
            onClick={handleRegisterFace}
            disabled={registering || !registerName || !registerLabel}
            className="bg-teal-600 hover:bg-teal-700 w-full"
          >
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Register Face
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Servo Position Info */}
      {trackingState && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-400" />
              Servo Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-white">{trackingState.servoPosition.pan.toFixed(1)}°</p>
                <p className="text-[10px] text-slate-400">Pan (Horizontal)</p>
                <Progress
                  value={((trackingState.servoPosition.pan + 90) / 180) * 100}
                  className="h-1.5 mt-1"
                />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{trackingState.servoPosition.tilt.toFixed(1)}°</p>
                <p className="text-[10px] text-slate-400">Tilt (Vertical)</p>
                <Progress
                  value={((trackingState.servoPosition.tilt + 45) / 90) * 100}
                  className="h-1.5 mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
