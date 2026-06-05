'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Zap,
  Code,
  History,
  Package,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ---- Types ----
type FlashTarget = 'pixhawk' | 'companion' | 'esc' | 'radio'
type CodeTarget = 'companion' | 'agent'
type FlashStatus = 'idle' | 'preparing' | 'flashing' | 'verifying' | 'completed' | 'failed'

interface FlashLogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
}

interface FlashOperation {
  id: string
  target: FlashTarget
  firmwareVersion: string
  status: FlashStatus
  progress: number
  startedAt: string
  completedAt: string | null
  error: string | null
  logs: FlashLogEntry[]
}

interface CodeDeployOperation {
  id: string
  target: CodeTarget
  codePath: string
  status: FlashStatus
  progress: number
  startedAt: string
  completedAt: string | null
  error: string | null
  logs: FlashLogEntry[]
}

interface FirmwareInfo {
  target: FlashTarget
  version: string
  releaseDate: string
  size: number
  checksum: string
  changelog: string
}

interface VerificationResult {
  verified: boolean
  currentVersion: string | null
  targetVersion: string
  checksumMatch: boolean | null
  details: Record<string, unknown>
}

// ---- Helpers ----
const STATUS_CONFIG: Record<FlashStatus, { color: string; bg: string; border: string; label: string }> = {
  idle: { color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/30', label: 'Idle' },
  preparing: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Preparing' },
  flashing: { color: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/30', label: 'Flashing' },
  verifying: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', label: 'Verifying' },
  completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', label: 'Completed' },
  failed: { color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', label: 'Failed' },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function FlashTab() {
  const [activeTab, setActiveTab] = useState<'firmware' | 'deploy'>('firmware')
  const [data, setData] = useState<{ activeOperations: (FlashOperation | CodeDeployOperation)[]; operationHistory: (FlashOperation | CodeDeployOperation)[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [firmwareTarget, setFirmwareTarget] = useState<FlashTarget>('pixhawk')
  const [firmwareList, setFirmwareList] = useState<FirmwareInfo[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [deployTarget, setDeployTarget] = useState<CodeTarget>('companion')
  const [codePath, setCodePath] = useState('/home/memorix/agent')
  const [flashLoading, setFlashLoading] = useState(false)
  const [deployLoading, setDeployLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState<Record<string, boolean>>({})
  const [verifyResults, setVerifyResults] = useState<Record<string, VerificationResult>>({})
  const [expandedOp, setExpandedOp] = useState<string | null>(null)
  const [firmwareLoading, setFirmwareLoading] = useState(false)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/flash')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      toast.error('Failed to fetch flash data: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setFirmwareLoading(true)
      try {
        const res = await fetch(`/api/flash?action=firmware&target=${firmwareTarget}`)
        const json = await res.json()
        if (!cancelled && json.success) {
          setFirmwareList(json.data.firmware)
          if (json.data.firmware.length > 0) {
            setSelectedVersion(json.data.firmware[0].version)
          }
        }
      } catch (err) {
        toast.error('Failed to load firmware list: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
      if (!cancelled) setFirmwareLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [firmwareTarget])

  // SSE polling: refresh operation status every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData()
    }, 2000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleFlash = async () => {
    if (!selectedVersion) return
    setFlashLoading(true)
    try {
      const res = await fetch('/api/flash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flash', target: firmwareTarget, firmwareVersion: selectedVersion }),
      })
      const json = await res.json()
      if (json.success) {
        await fetchData()
      }
    } catch (err) {
      toast.error('Failed to flash firmware: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setFlashLoading(false)
    }
  }

  const handleDeploy = async () => {
    if (!codePath.trim()) return
    setDeployLoading(true)
    try {
      const res = await fetch('/api/flash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy', target: deployTarget, codePath: codePath.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        await fetchData()
      }
    } catch (err) {
      toast.error('Failed to deploy code: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDeployLoading(false)
    }
  }

  const handleCancel = async (operationId: string) => {
    try {
      await fetch('/api/flash', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', operationId }),
      })
      await fetchData()
    } catch (err) {
      toast.error('Failed to cancel operation: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleVerify = async (target: FlashTarget) => {
    setVerifyLoading(prev => ({ ...prev, [target]: true }))
    try {
      const res = await fetch('/api/flash', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', target }),
      })
      const json = await res.json()
      if (json.success) {
        setVerifyResults(prev => ({ ...prev, [target]: json.data }))
      }
    } catch (err) {
      toast.error('Failed to verify firmware: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setVerifyLoading(prev => ({ ...prev, [target]: false }))
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-96 bg-slate-900 rounded-xl animate-pulse border border-white/5" />
          <div className="h-96 bg-slate-900 rounded-xl animate-pulse border border-white/5" />
        </div>
      </div>
    )
  }

  const activeOps = data?.activeOperations || []
  const historyOps = data?.operationHistory || []

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Upload className="w-4 h-4 text-teal-400" />
          Firmware Flash & Code Deploy
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === 'firmware' ? 'default' : 'outline'}
            onClick={() => setActiveTab('firmware')}
            data-testid="firmware-tab-btn"
            className={activeTab === 'firmware' ? 'bg-teal-600 hover:bg-teal-700 text-white h-8' : 'h-8 border-white/10 text-slate-300'}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Firmware Flash
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'deploy' ? 'default' : 'outline'}
            onClick={() => setActiveTab('deploy')}
            data-testid="code-deploy-tab-btn"
            className={activeTab === 'deploy' ? 'bg-teal-600 hover:bg-teal-700 text-white h-8' : 'h-8 border-white/10 text-slate-300'}
          >
            <Code className="w-3.5 h-3.5 mr-1.5" />
            Code Deploy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === 'firmware' ? (
            <Card className="bg-slate-900 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-400" />
                  Firmware Flash
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target selector */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Target Device</label>
                  <div className="flex flex-wrap gap-2">
                    {(['pixhawk', 'companion', 'esc', 'radio'] as FlashTarget[]).map((target) => (
                      <button
                        key={target}
                        onClick={() => setFirmwareTarget(target)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          firmwareTarget === target
                            ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                            : 'bg-slate-800 text-slate-400 border border-white/5 hover:border-white/10'
                        }`}
                      >
                        {target.charAt(0).toUpperCase() + target.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Available firmware */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Available Firmware</label>
                  {firmwareLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading firmware list...
                    </div>
                  ) : firmwareList.length === 0 ? (
                    <p className="text-[11px] text-slate-600">No firmware available for this target</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto" aria-label="Firmware list">
                      {firmwareList.map((fw) => (
                        <button
                          key={fw.version}
                          onClick={() => setSelectedVersion(fw.version)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedVersion === fw.version
                              ? 'bg-teal-500/5 border-teal-500/30'
                              : 'bg-slate-800/50 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${selectedVersion === fw.version ? 'text-teal-400' : 'text-slate-300'}`}>
                              {fw.version}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500">{formatBytes(fw.size)}</span>
                              <span className="text-[10px] text-slate-600">{fw.releaseDate}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{fw.changelog}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Flash button */}
                <Button
                  onClick={handleFlash}
                  disabled={flashLoading || !selectedVersion}
                  data-testid="flash-firmware-btn"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {flashLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting Flash...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Flash {selectedVersion || 'Firmware'} to {firmwareTarget}
                    </>
                  )}
                </Button>

                {/* Verify button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVerify(firmwareTarget)}
                  disabled={verifyLoading[firmwareTarget]}
                  className="w-full border-white/10 text-slate-300 hover:bg-white/5"
                >
                  {verifyLoading[firmwareTarget] ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Verify {firmwareTarget} Firmware
                </Button>

                {/* Verify Result */}
                {verifyResults[firmwareTarget] && (
                  <div className={`p-3 rounded-lg border ${
                    verifyResults[firmwareTarget].verified
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-rose-500/5 border-rose-500/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {verifyResults[firmwareTarget].verified ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className={`text-xs font-medium ${verifyResults[firmwareTarget].verified ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {verifyResults[firmwareTarget].verified ? 'Verified' : 'Verification Failed'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">Current Version</span>
                        <span className="text-slate-300 font-mono">{verifyResults[firmwareTarget].currentVersion || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">Target Version</span>
                        <span className="text-slate-300 font-mono">{verifyResults[firmwareTarget].targetVersion}</span>
                      </div>
                      {verifyResults[firmwareTarget].checksumMatch !== null && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Checksum Match</span>
                          <span className={verifyResults[firmwareTarget].checksumMatch ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                            {verifyResults[firmwareTarget].checksumMatch ? 'Yes' : 'No'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                  <Code className="w-4 h-4 text-teal-400" />
                  Code Deploy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target selector */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Deploy Target</label>
                  <div className="flex gap-2">
                    {(['companion', 'agent'] as CodeTarget[]).map((target) => (
                      <button
                        key={target}
                        onClick={() => setDeployTarget(target)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          deployTarget === target
                            ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                            : 'bg-slate-800 text-slate-400 border border-white/5 hover:border-white/10'
                        }`}
                      >
                        {target.charAt(0).toUpperCase() + target.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code path input */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Code Path</label>
                  <input
                    type="text"
                    value={codePath}
                    onChange={(e) => setCodePath(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-teal-500/30"
                    placeholder="/path/to/code"
                  />
                </div>

                {/* Deploy button */}
                <Button
                  onClick={handleDeploy}
                  disabled={deployLoading || !codePath.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {deployLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Deploy to {deployTarget}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Active Operations */}
          {activeOps.length > 0 && (
            <Card className="bg-slate-900 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                  Active Operations
                  <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/30 border text-[9px]">
                    {activeOps.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeOps.map((op) => {
                  const cfg = STATUS_CONFIG[op.status]
                  const isExpanded = expandedOp === op.id
                  const isCodeDeploy = 'codePath' in op

                  return (
                    <div key={op.id} className="p-3 bg-slate-800/50 rounded-lg border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} border text-[9px]`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-slate-300 font-medium">
                            {isCodeDeploy ? `Deploy: ${(op as CodeDeployOperation).codePath}` : `Flash: ${op.firmwareVersion}`}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{op.target}</span>
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <Progress value={op.progress} role="progressbar" aria-valuenow={op.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Flash progress: ${op.progress}%`} aria-busy={op.status === 'flashing' || op.status === 'preparing' || op.status === 'verifying'} className="h-1.5 bg-white/5 [&>div]:bg-teal-500 flex-1" />
                        <span className="text-xs text-slate-400 font-mono w-10 text-right">{op.progress}%</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {(op.status === 'preparing' || op.status === 'flashing' || op.status === 'verifying') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(op.id)}
                            className="h-6 text-[10px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                          >
                            Cancel
                          </Button>
                        )}
                        <button
                          onClick={() => setExpandedOp(isExpanded ? null : op.id)}
                          className="flex items-center gap-1 text-[10px] text-teal-400/70 hover:text-teal-400 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Logs
                        </button>
                      </div>

                      {isExpanded && op.logs.length > 0 && (
                        <div className="mt-2 p-2 bg-slate-900 rounded-lg border border-white/5 max-h-32 overflow-y-auto">
                          {op.logs.map((log, i) => (
                            <div key={i} className="flex items-start gap-2 text-[10px] py-0.5">
                              <span className={`shrink-0 ${
                                log.level === 'error' ? 'text-rose-400' :
                                log.level === 'warning' ? 'text-amber-400' : 'text-slate-500'
                              }`}>
                                {log.level === 'error' ? '✗' : log.level === 'warning' ? '⚠' : '›'}
                              </span>
                              <span className="text-slate-400">{log.message}</span>
                              <span className="text-slate-600 font-mono ml-auto shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel: History */}
        <div className="space-y-4">
          <Card className="bg-slate-900 border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Operation History
                <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 border text-[9px]">
                  {historyOps.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyOps.length === 0 ? (
                <p className="text-[11px] text-slate-600 text-center py-4">No operations yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {historyOps.slice().reverse().map((op) => {
                    const cfg = STATUS_CONFIG[op.status]
                    const isCodeDeploy = 'codePath' in op

                    return (
                      <div key={op.id} className="p-2.5 bg-slate-800/50 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} border text-[9px]`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-[9px] text-slate-600 font-mono">
                            {op.completedAt ? new Date(op.completedAt).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300">
                          {isCodeDeploy
                            ? `Deploy ${(op as CodeDeployOperation).codePath}`
                            : `Flash ${op.firmwareVersion}`
                          }
                        </p>
                        <p className="text-[9px] text-slate-500">Target: {op.target}</p>
                        {op.error && (
                          <p className="text-[9px] text-rose-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {op.error}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
