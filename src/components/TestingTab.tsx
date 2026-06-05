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
  TestTube,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Shield,
  Cpu,
  Activity,
  Play,
  PlayCircle,
  FlaskConical,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ---- Types ----
type TestCategory = 'unit' | 'integration' | 'hardware' | 'firmware' | 'e2e' | 'safety'
type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error'

interface TestAssertion {
  description: string
  expected: string
  actual?: string
  passed?: boolean
}

interface TestResult {
  status: TestStatus
  duration: number
  assertionsPassed: number
  assertionsFailed: number
  output: string
  error?: string
  timestamp: string
}

interface TestCase {
  id: string
  name: string
  category: TestCategory
  description: string
  code: string
  target: string
  assertions: TestAssertion[]
  status: TestStatus
  result?: TestResult
  createdAt: string
}

interface TestSuite {
  id: string
  name: string
  category: TestCategory
  tests: TestCase[]
  status: TestStatus
  startedAt: string | null
  completedAt: string | null
  results: {
    total: number
    passed: number
    failed: number
    skipped: number
    duration: number
  }
}

interface TestOverview {
  suites: number
  tests: number
  categoryCounts: Record<string, number>
  statusCounts: Record<string, number>
  recentSuites: TestSuite[]
  recentTests: TestCase[]
}

interface TestResultsSummary {
  summary: {
    total: number
    withResults: number
    passed: number
    failed: number
    error: number
    skipped: number
    pending: number
    running: number
  }
  results: Array<{
    id: string
    name: string
    category: TestCategory
    target: string
    status: TestStatus
    result?: TestResult
  }>
}

// ---- Config ----
const CATEGORY_CONFIG: Record<TestCategory, { label: string; color: string; bg: string; border: string; icon: typeof TestTube }> = {
  unit: { label: 'Unit', color: 'text-slate-300', bg: 'bg-slate-500/15', border: 'border-slate-500/30', icon: FlaskConical },
  integration: { label: 'Integration', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', icon: Activity },
  hardware: { label: 'Hardware', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: Cpu },
  firmware: { label: 'Firmware', color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', icon: Zap },
  safety: { label: 'Safety', color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', icon: Shield },
  e2e: { label: 'E2E', color: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/30', icon: PlayCircle },
}

const STATUS_CONFIG: Record<TestStatus, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/30', label: 'Pending' },
  running: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Running' },
  passed: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', label: 'Passed' },
  failed: { color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', label: 'Failed' },
  skipped: { color: 'text-slate-500', bg: 'bg-slate-500/15', border: 'border-slate-500/30', label: 'Skipped' },
  error: { color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', label: 'Error' },
}

export function TestingTab() {
  const [overview, setOverview] = useState<TestOverview | null>(null)
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [resultsData, setResultsData] = useState<TestResultsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [generateTarget, setGenerateTarget] = useState('')
  const [generateCategory, setGenerateCategory] = useState<TestCategory>('hardware')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)
  const [runLoading, setRunLoading] = useState<string | null>(null)
  const [verifyLoading, setVerifyLoading] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<TestResult | null>(null)
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null)
  const [expandedTest, setExpandedTest] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchAll = useCallback(async () => {
    try {
      const [overviewRes, suitesRes, resultsRes] = await Promise.all([
        fetch('/api/testing'),
        fetch('/api/testing?suites=true'),
        fetch('/api/testing?results=true'),
      ])
      const overviewJson = await overviewRes.json()
      const suitesJson = await suitesRes.json()
      const resultsJson = await resultsRes.json()

      if (overviewJson.success) setOverview(overviewJson.data)
      if (suitesJson.success) setSuites(suitesJson.data)
      if (resultsJson.success) setResultsData(resultsJson.data)
    } catch (err) {
      toast.error('Failed to fetch test data: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [overviewRes, suitesRes, resultsRes] = await Promise.all([
          fetch('/api/testing'),
          fetch('/api/testing?suites=true'),
          fetch('/api/testing?results=true'),
        ])
        const overviewJson = await overviewRes.json()
        const suitesJson = await suitesRes.json()
        const resultsJson = await resultsRes.json()

        if (!cancelled) {
          if (overviewJson.success) setOverview(overviewJson.data)
          if (suitesJson.success) setSuites(suitesJson.data)
          if (resultsJson.success) setResultsData(resultsJson.data)
        }
      } catch (err) {
        toast.error('Failed to load test data: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleGenerate = async () => {
    if (!generateTarget.trim()) return
    setGenerateLoading(true)
    try {
      await fetch('/api/testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', target: generateTarget.trim(), category: generateCategory }),
      })
      await fetchAll()
    } catch (err) {
      toast.error('Failed to generate tests: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setGenerateLoading(false)
  }

  const handleQuickGenerate = async (action: string, extra?: Record<string, string>) => {
    setQuickLoading(action)
    try {
      await fetch('/api/testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      await fetchAll()
    } catch (err) {
      toast.error('Failed to generate quick tests: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setQuickLoading(null)
  }

  const handleRunSuite = async (suiteId: string) => {
    setRunLoading(suiteId)
    try {
      await fetch('/api/testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_suite', suiteId }),
      })
      await fetchAll()
    } catch (err) {
      toast.error('Failed to run test suite: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setRunLoading(null)
  }

  const handleRunAll = async () => {
    setRunLoading('all')
    try {
      await fetch('/api/testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_all' }),
      })
      await fetchAll()
    } catch (err) {
      toast.error('Failed to run all tests: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setRunLoading(null)
  }

  const handleVerify = async (action: string, extra?: Record<string, string>) => {
    setVerifyLoading(action)
    setVerifyResult(null)
    try {
      const res = await fetch('/api/testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const json = await res.json()
      if (json.success && json.data?.result) {
        setVerifyResult(json.data.result)
      }
    } catch (err) {
      toast.error('Failed to run verification: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setVerifyLoading(null)
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

  const summary = resultsData?.summary

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <TestTube className="w-4 h-4 text-teal-400" />
          AI-Powered Testing
        </h3>
        {summary && (
          <div className="flex items-center gap-3 text-[10px]">
            {summary.passed > 0 && (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />{summary.passed} passed
              </span>
            )}
            {summary.failed > 0 && (
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" />{summary.failed} failed
              </span>
            )}
            {summary.pending > 0 && (
              <span className="text-slate-400">{summary.pending} pending</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI Test Generation */}
          <Card className="bg-slate-900 border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                AI Test Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Target</label>
                  <input
                    type="text"
                    value={generateTarget}
                    onChange={(e) => setGenerateTarget(e.target.value)}
                    placeholder="e.g., flight_controller, pixhawk, system"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['unit', 'integration', 'hardware', 'firmware', 'safety', 'e2e'] as TestCategory[]).map((cat) => {
                      const cfg = CATEGORY_CONFIG[cat]
                      return (
                        <button
                          key={cat}
                          onClick={() => setGenerateCategory(cat)}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                            generateCategory === cat
                              ? `${cfg.bg} ${cfg.color} ${cfg.border} border`
                              : 'bg-slate-800 text-slate-500 border border-white/5 hover:border-white/10'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateLoading || !generateTarget.trim()}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                {generateLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate Tests
                  </>
                )}
              </Button>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickGenerate('generate_hardware', { deviceType: 'flight_controller' })}
                  disabled={quickLoading === 'generate_hardware'}
                  className="h-7 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  {quickLoading === 'generate_hardware' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Cpu className="w-3 h-3 mr-1" />}
                  Hardware Tests
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickGenerate('generate_safety')}
                  disabled={quickLoading === 'generate_safety'}
                  className="h-7 text-[10px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                >
                  {quickLoading === 'generate_safety' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                  Safety Tests
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickGenerate('generate_firmware', { firmwareVersion: 'ArduPilot 4.5.7' })}
                  disabled={quickLoading === 'generate_firmware'}
                  className="h-7 text-[10px] border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                >
                  {quickLoading === 'generate_firmware' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  Firmware Tests
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Suites */}
          <Card className="bg-slate-900 border-white/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-400" />
                  Test Suites
                  <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 border text-[9px]">
                    {suites.length}
                  </Badge>
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleRunAll}
                  disabled={runLoading === 'all' || suites.length === 0}
                  className="h-7 text-[10px] bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {runLoading === 'all' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                  Run All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {suites.length === 0 ? (
                <p className="text-[11px] text-slate-600 text-center py-4">No test suites yet. Generate tests above to create suites.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {suites.map((suite) => {
                    const catCfg = CATEGORY_CONFIG[suite.category]
                    const statusCfg = STATUS_CONFIG[suite.status]
                    const isExpanded = expandedSuite === suite.id
                    const isRunning = runLoading === suite.id

                    return (
                      <div key={suite.id} className="p-3 bg-slate-800/50 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`${catCfg.bg} ${catCfg.color} ${catCfg.border} border text-[9px]`}>
                              {catCfg.label}
                            </Badge>
                            <span className="text-xs text-slate-300 font-medium">{suite.name}</span>
                            <Badge className={`${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} border text-[9px]`}>
                              {statusCfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {suite.status !== 'running' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRunSuite(suite.id)}
                                disabled={isRunning}
                                className="h-6 text-[10px] border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                              >
                                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                              </Button>
                            )}
                            <button
                              onClick={() => setExpandedSuite(isExpanded ? null : suite.id)}
                              className="text-[10px] text-teal-400/70 hover:text-teal-400 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {/* Suite results summary */}
                        {suite.results.total > 0 && (
                          <div className="flex items-center gap-3 mt-2 text-[10px]">
                            <span className="text-emerald-400">{suite.results.passed} passed</span>
                            <span className="text-rose-400">{suite.results.failed} failed</span>
                            <span className="text-slate-500">{suite.results.skipped} skipped</span>
                            {suite.results.duration > 0 && (
                              <span className="text-slate-600 font-mono ml-auto">{suite.results.duration}ms</span>
                            )}
                          </div>
                        )}

                        {/* Expanded: individual tests */}
                        {isExpanded && (
                          <div className="mt-2 space-y-1.5">
                            {suite.tests.map((test) => {
                              const testStatusCfg = STATUS_CONFIG[test.status]
                              const isTestExpanded = expandedTest === test.id

                              return (
                                <div key={test.id} className="p-2 bg-slate-900/50 rounded-md border border-white/5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {test.status === 'passed' ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      ) : test.status === 'failed' || test.status === 'error' ? (
                                        <XCircle className="w-3 h-3 text-rose-400" />
                                      ) : test.status === 'running' ? (
                                        <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                                      ) : (
                                        <div className="w-3 h-3 rounded-full bg-slate-600" />
                                      )}
                                      <span className="text-[11px] text-slate-300">{test.name}</span>
                                    </div>
                                    <button
                                      onClick={() => setExpandedTest(isTestExpanded ? null : test.id)}
                                      className="text-slate-500 hover:text-slate-300"
                                    >
                                      {isTestExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  </div>

                                  {isTestExpanded && (
                                    <div className="mt-2 space-y-1.5">
                                      <p className="text-[10px] text-slate-500">{test.description}</p>
                                      {test.result && (
                                        <>
                                          <div className="flex items-center gap-3 text-[10px]">
                                            <Badge className={`${testStatusCfg.bg} ${testStatusCfg.color} ${testStatusCfg.border} border text-[9px]`}>
                                              {testStatusCfg.label}
                                            </Badge>
                                            <span className="text-slate-500 font-mono">{test.result.duration}ms</span>
                                            <span className="text-emerald-400">{test.result.assertionsPassed} passed</span>
                                            <span className="text-rose-400">{test.result.assertionsFailed} failed</span>
                                          </div>
                                          {test.result.error && (
                                            <div className="p-2 bg-rose-500/5 rounded border border-rose-500/20">
                                              <p className="text-[10px] text-rose-400">{test.result.error}</p>
                                            </div>
                                          )}
                                          {test.result.output && (
                                            <div className="p-2 bg-slate-800 rounded border border-white/5 max-h-24 overflow-y-auto">
                                              <pre className="text-[9px] text-slate-400 whitespace-pre-wrap font-mono">{test.result.output}</pre>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Test Results Summary */}
          {summary && (
            <Card className="bg-slate-900 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-400" />
                  Test Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/20 text-center">
                    <p className="text-lg font-bold text-emerald-400">{summary.passed}</p>
                    <p className="text-[9px] text-emerald-400/70 uppercase">Passed</p>
                  </div>
                  <div className="p-2.5 bg-rose-500/5 rounded-lg border border-rose-500/20 text-center">
                    <p className="text-lg font-bold text-rose-400">{summary.failed}</p>
                    <p className="text-[9px] text-rose-400/70 uppercase">Failed</p>
                  </div>
                  <div className="p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/20 text-center">
                    <p className="text-lg font-bold text-amber-400">{summary.running}</p>
                    <p className="text-[9px] text-amber-400/70 uppercase">Running</p>
                  </div>
                  <div className="p-2.5 bg-slate-500/5 rounded-lg border border-slate-500/20 text-center">
                    <p className="text-lg font-bold text-slate-400">{summary.pending}</p>
                    <p className="text-[9px] text-slate-400/70 uppercase">Pending</p>
                  </div>
                </div>
                {summary.total > 0 && (
                  <div className="mt-2">
                    <Progress
                      value={summary.total > 0 ? ((summary.passed + summary.failed + summary.error) / summary.total) * 100 : 0}
                      className="h-2 bg-white/5 [&>div]:bg-emerald-500"
                    />
                    <p className="text-[9px] text-slate-500 mt-1 text-center">
                      {summary.withResults} of {summary.total} tests completed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Verification */}
          <Card className="bg-slate-900 border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleVerify('verify_hardware', { deviceId: 'dev_flight_controller_001' })}
                disabled={verifyLoading === 'verify_hardware'}
                className="w-full h-8 text-[11px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10 justify-start"
              >
                {verifyLoading === 'verify_hardware' ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Cpu className="w-3.5 h-3.5 mr-2" />}
                Verify Hardware
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleVerify('verify_firmware', { target: 'pixhawk' })}
                disabled={verifyLoading === 'verify_firmware'}
                className="w-full h-8 text-[11px] border-purple-500/30 text-purple-400 hover:bg-purple-500/10 justify-start"
              >
                {verifyLoading === 'verify_firmware' ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-2" />}
                Verify Firmware
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleVerify('verify_health')}
                disabled={verifyLoading === 'verify_health'}
                className="w-full h-8 text-[11px] border-teal-500/30 text-teal-400 hover:bg-teal-500/10 justify-start"
              >
                {verifyLoading === 'verify_health' ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-2" />}
                Verify System Health
              </Button>

              {/* Verification Result */}
              {verifyResult && (
                <div className={`mt-2 p-3 rounded-lg border ${
                  verifyResult.status === 'passed'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-rose-500/5 border-rose-500/20'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verifyResult.status === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className={`text-xs font-medium ${verifyResult.status === 'passed' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {verifyResult.status === 'passed' ? 'Verification Passed' : 'Verification Failed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] mb-2">
                    <span className="text-emerald-400">{verifyResult.assertionsPassed} passed</span>
                    <span className="text-rose-400">{verifyResult.assertionsFailed} failed</span>
                    <span className="text-slate-500 font-mono ml-auto">{verifyResult.duration}ms</span>
                  </div>
                  {verifyResult.error && (
                    <p className="text-[10px] text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {verifyResult.error}
                    </p>
                  )}
                  {verifyResult.output && (
                    <div className="mt-2 p-2 bg-slate-800 rounded border border-white/5 max-h-32 overflow-y-auto">
                      <pre className="text-[9px] text-slate-400 whitespace-pre-wrap font-mono">{verifyResult.output}</pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
