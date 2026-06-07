'use client'

/**
 * Memorix v4.0 — LLM Marketplace Component
 *
 * Professional-grade dashboard showing all available LLM models,
 * grouped by provider, with search, compare, and selection capabilities.
 * This is what makes Memorix the biggest multi-LLM hub.
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Zap, Globe, Bot, ChevronDown,
  Check, Sparkles, List,
  Loader2, Eye, Code, MessageSquare, Wrench, Brain, Crown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  MODEL_REGISTRY, PROVIDER_GROUPS, getFreeModels, searchModels,
  type LLMModel,
} from '@/lib/llm/providers'

function CapabilityIcon({ cap }: { cap: string }) {
  switch (cap) {
    case 'chat': return <MessageSquare className="w-3 h-3" />
    case 'vision': return <Eye className="w-3 h-3" />
    case 'code': return <Code className="w-3 h-3" />
    case 'reasoning': return <Brain className="w-3 h-3" />
    case 'tool_use': return <Wrench className="w-3 h-3" />
    case 'streaming': return <Zap className="w-3 h-3" />
    default: return null
  }
}

function ModelCard({ model, selected, onSelect }: {
  model: LLMModel
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'cursor-pointer transition-all hover:shadow-lg',
          selected && 'ring-2 ring-primary border-primary/50 bg-primary/5',
          model.isFree && 'border-emerald-500/20'
        )}
        onClick={() => onSelect(model.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{PROVIDER_GROUPS[model.providerLabel]?.icon || '🤖'}</span>
              <div>
                <p className="text-sm font-semibold leading-tight">{model.name}</p>
                <p className="text-[10px] text-muted-foreground">{model.providerLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {model.isFree ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] h-5">
                  <Zap className="w-2.5 h-2.5 mr-0.5" />
                  FREE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] h-5">
                  <Crown className="w-2.5 h-2.5 mr-0.5" />
                  BYOK
                </Badge>
              )}
              {selected && <Check className="w-4 h-4 text-primary" />}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {model.capabilities.map(cap => (
              <Badge key={cap} variant="secondary" className="text-[8px] h-4 gap-0.5">
                <CapabilityIcon cap={cap} />
                {cap}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Context: {(model.contextWindow / 1000).toFixed(0)}K</span>
            {model.pricing && (
              <span>${model.pricing.input}/${model.pricing.output} per 1M</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ProviderGroupSection({ providerKey, group, selectedModel, onSelectModel }: {
  providerKey: string
  group: { label: string; icon: string; color: string; models: LLMModel[] }
  selectedModel: string | null
  onSelectModel: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left hover:bg-accent/50 rounded-lg p-2 transition-colors"
      >
        <span className="text-xl">{group.icon}</span>
        <div className="flex-1">
          <span className="text-sm font-semibold">{group.label}</span>
          <span className="text-[10px] text-muted-foreground ml-2">
            {group.models.length} model{group.models.length !== 1 ? 's' : ''}
            {group.models.some(m => m.isFree) && ' — Free via Puter.js'}
          </span>
        </div>
        <Badge variant="secondary" className="text-[9px] h-5">{group.models.length}</Badge>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pl-2"
          >
            {group.models.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                selected={selectedModel === model.id}
                onSelect={onSelectModel}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function LLMMarketplace() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [filterFree, setFilterFree] = useState(false)
  const [filterCap, setFilterCap] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped')

  const filteredGroups = useMemo(() => {
    let models = searchQuery ? searchModels(searchQuery) : [...MODEL_REGISTRY]

    if (filterFree) {
      models = models.filter(m => m.isFree)
    }

    if (filterCap !== 'all') {
      models = models.filter(m => m.capabilities.includes(filterCap as any))
    }

    const groups: Record<string, { label: string; icon: string; color: string; models: LLMModel[] }> = {}
    for (const model of models) {
      const key = model.providerLabel
      if (!groups[key]) {
        groups[key] = {
          label: key,
          icon: PROVIDER_GROUPS[key]?.icon || '🤖',
          color: PROVIDER_GROUPS[key]?.color || '#6b7280',
          models: [],
        }
      }
      groups[key].models.push(model)
    }

    return groups
  }, [searchQuery, filterFree, filterCap])

  const freeCount = useMemo(() => getFreeModels().length, [])
  const totalCount = MODEL_REGISTRY.length

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            LLM Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} models from {Object.keys(PROVIDER_GROUPS).length} providers — {freeCount} FREE via Puter.js
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <Zap className="w-3 h-3 mr-1" />
            {freeCount} Free Models
          </Badge>
          <Badge variant="outline">
            <Crown className="w-3 h-3 mr-1" />
            BYOK Support
          </Badge>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search models, providers, capabilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={filterFree} onCheckedChange={setFilterFree} id="free-filter" />
            <Label htmlFor="free-filter" className="text-xs">Free only</Label>
          </div>
          <Select value={filterCap} onValueChange={setFilterCap}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Capability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Capabilities</SelectItem>
              <SelectItem value="chat">Chat</SelectItem>
              <SelectItem value="vision">Vision</SelectItem>
              <SelectItem value="code">Code</SelectItem>
              <SelectItem value="reasoning">Reasoning</SelectItem>
              <SelectItem value="tool_use">Tool Use</SelectItem>
              <SelectItem value="streaming">Streaming</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Models', value: totalCount, icon: Bot, color: 'text-violet-500' },
          { label: 'Free Models', value: freeCount, icon: Zap, color: 'text-emerald-500' },
          { label: 'Providers', value: Object.keys(PROVIDER_GROUPS).length, icon: Globe, color: 'text-blue-500' },
          { label: 'With Tool Use', value: MODEL_REGISTRY.filter(m => m.capabilities.includes('tool_use')).length, icon: Wrench, color: 'text-amber-500' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <stat.icon className={cn('w-5 h-5', stat.color)} />
              <div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Models */}
      {viewMode === 'grouped' ? (
        <div className="space-y-4">
          {Object.entries(filteredGroups).map(([key, group]) => (
            <ProviderGroupSection
              key={key}
              providerKey={key}
              group={group}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {MODEL_REGISTRY
            .filter(m => !filterFree || m.isFree)
            .filter(m => filterCap === 'all' || m.capabilities.includes(filterCap as any))
            .map(model => (
              <ModelCard
                key={model.id}
                model={model}
                selected={selectedModel === model.id}
                onSelect={setSelectedModel}
              />
            ))
          }
        </div>
      )}

      {Object.keys(filteredGroups).length === 0 && (
        <div className="py-12 text-center">
          <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No models found matching your criteria</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearchQuery(''); setFilterFree(false); setFilterCap('all') }}>
            Clear filters
          </Button>
        </div>
      )}

      {/* Puter.js Info Banner */}
      <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-500">Powered by Puter.js — Free LLM Access</p>
              <p className="text-xs text-muted-foreground mt-1">
                All models marked &quot;FREE&quot; are accessible through Puter.js with zero API keys and zero cost.
                End-users authenticate with their free Puter.com account and cover their own usage.
                This makes Memorix the biggest free multi-LLM hub — portable yet powerful.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
