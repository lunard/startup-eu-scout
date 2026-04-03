import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, ChevronDown, ChevronUp, CheckSquare, Square, ExternalLink,
  Loader2, Sparkles, Brain, Circle, ChevronRight, Copy } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { GrantResult } from '@/types'
import { saveAnalysis, getAnalysis } from '@/lib/storage'
import { marked } from 'marked'

const EU_API_BASE = '/api/eu/search-api/v1'

const PROGRAMMES = ['All', 'HORIZON', 'EIC', 'DIGITAL', 'COSME', 'EIT', 'LIFE']
const STATUSES   = ['open', 'forthcoming', 'closed']
const ACTIONS    = ['All', 'RIA', 'IA', 'CSA', 'EIC', 'MSCA', 'ERC']

export default function GrantsTab() {
  const { profile, grants, setGrants, selectedGrantIds, toggleGrantSelection,
    selectAllGrants, deselectAllGrants, addLog, llmReady, capabilities } = useAppStore()

  const [programme, setProgramme] = useState('All')
  const [statusFilter, setStatusFilter] = useState<string[]>(['open', 'forthcoming'])
  const [actionType, setActionType] = useState('All')
  const [directId, setDirectId] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null)
  const [analysisMap, setAnalysisMap] = useState<Record<string, string>>({})

  async function searchGrants() {
    if (!profile?.keywords?.length) {
      addLog('warn', 'No keywords found. Generate an EU Summary first.')
      return
    }
    setLoading(true)
    addLog('api', `Searching EU portal for: ${profile.keywords.slice(0, 5).join(', ')}…`)
    try {
      const params = new URLSearchParams({
        keyword: profile.keywords.slice(0, 8).join(' '),
        pageSize: '50', pageNumber: '1', order: 'desc', lang: 'en',
      })
      if (programme !== 'All') params.set('programmePart', programme)
      if (!statusFilter.includes('open') && !statusFilter.includes('forthcoming')) params.set('status', 'closed')
      else if (statusFilter.includes('open') && !statusFilter.includes('forthcoming')) params.set('status', 'open')
      if (actionType !== 'All') params.set('typesOfAction', actionType)

      const res = await fetch(`${EU_API_BASE}/opportunities?${params}`)
      if (!res.ok) throw new Error(`EU API error ${res.status}`)
      const json = await res.json()

      const items: GrantResult[] = (json?.fundingData ?? []).map((item: any, i: number) => ({
        id: item.identifier ?? item.id ?? `grant-${i}`,
        title: item.title ?? item.topicTitle ?? 'Untitled',
        status: item.status?.toLowerCase() ?? 'open',
        deadline: item.deadlineDate,
        openDate: item.openingDate,
        programme: item.programmePart ?? item.programme ?? 'EU',
        budget: item.budget ? `€${(item.budget / 1e6).toFixed(1)}M` : undefined,
        description: item.description?.slice(0, 300) ?? '',
        portalUrl: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${item.identifier}`,
        typeOfAction: item.typeOfAction,
        matchingScore: computeScore(item, profile.keywords ?? []),
      })).sort((a: GrantResult, b: GrantResult) => b.matchingScore - a.matchingScore)

      setGrants(items)
      addLog('success', `Found ${items.length} grants. Select and start AI analysis.`)
    } catch (e) {
      addLog('error', `Grant search failed: ${(e as Error).message}`)
    } finally { setLoading(false) }
  }

  async function runAnalysis() {
    if (!llmReady) { addLog('warn', 'Load the local LLM from Settings first.'); return }
    const selected = grants.filter(g => selectedGrantIds.has(g.id))
    if (!selected.length) { addLog('warn', 'Select at least one grant to analyse.'); return }

    setAnalyzing(true); setAnalyzeProgress(0)
    addLog('llm', `Analysing ${selected.length} grants with ${capabilities?.npuAvailable ? 'NPU' : 'GPU'} AI…`)

    const engine = (window as any).__euScoutEngine
    if (!engine) { addLog('error', 'LLM engine not ready.'); setAnalyzing(false); return }

    for (let i = 0; i < selected.length; i++) {
      const g = selected[i]
      setAnalyzeProgress(Math.round((i / selected.length) * 100))
      try {
        // Check cache
        const cached = await getAnalysis(g.id, profile!.id)
        if (cached) { setAnalysisMap(prev => ({ ...prev, [g.id]: cached.analysis })); continue }

        const prompt = `You are an EU grant expert. Analyse if this startup fits this EU grant opportunity.

Startup: ${profile!.ragioneSociale}
EU Summary: ${profile!.schedaEU?.slice(0, 800) ?? 'N/A'}

Grant: ${g.title} (${g.programme})
Description: ${g.description}
Type: ${g.typeOfAction ?? 'N/A'}  Budget: ${g.budget ?? 'N/A'}

Respond in Markdown:
## Fit Score: X/100
## Key Alignment
## Gaps / Risks
## Recommendation (1-2 sentences)

Be concise and specific.`

        const reply = await engine.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2, max_tokens: 500, stream: false,
        })
        const analysis = reply.choices[0].message.content ?? ''
        const fitScore = parseInt(analysis.match(/Fit Score:\s*(\d+)/)?.[1] ?? '0')

        await saveAnalysis({ grantId: g.id, profileId: profile!.id, analysis, fitScore, savedAt: new Date().toISOString() })
        setAnalysisMap(prev => ({ ...prev, [g.id]: analysis }))
        addLog('llm', `✓ ${g.title.slice(0, 40)}… score=${fitScore}`)
      } catch (e) {
        addLog('error', `Analysis failed for ${g.id}: ${(e as Error).message}`)
      }
    }
    setAnalyzeProgress(100)
    setAnalyzing(false)
    addLog('success', 'Analysis complete!')
  }

  function computeScore(item: any, keywords: string[]): number {
    const text = `${item.title ?? ''} ${item.description ?? ''}`.toLowerCase()
    const hits = keywords.filter(k => text.includes(k.toLowerCase())).length
    return Math.min(100, Math.round((hits / Math.max(keywords.length, 1)) * 100))
  }

  const filteredGrants = grants.filter(g => {
    if (searchQuery && !g.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (!statusFilter.includes(g.status)) return false
    return true
  })

  const statusToggle = (s: string) =>
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  if (!profile) return <EmptyState icon="📋" title="No profile loaded" desc="Build a startup profile before searching for grants." />

  return (
    <div className="px-4 py-5 space-y-4 pb-4">
      {/* Search + filter card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass overflow-hidden">
        {/* Direct ID row */}
        <div className="flex gap-2 p-4 pb-3">
          <input className="input flex-1 py-2.5 text-sm" placeholder="Direct grant ID or search…"
            value={directId} onChange={e => setDirectId(e.target.value)} />
          <button className="btn-primary px-4 py-2.5 text-sm shrink-0" onClick={searchGrants} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          </button>
        </div>

        {/* Filter toggle */}
        <button className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-white/[0.06] text-xs text-eu-muted active:bg-white/5"
          onClick={() => setFilterOpen(!filterOpen)}>
          <Filter size={12} />
          <span>Filters</span>
          <span className="ml-1 bg-eu-blue/30 text-eu-sky rounded-full px-1.5 py-0.5">
            {programme !== 'All' || actionType !== 'All' ? '•' : ''}
          </span>
          <span className="ml-auto">{filterOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
        </button>

        <AnimatePresence>
          {filterOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden border-t border-white/[0.06]">
              <div className="p-4 space-y-3">
                {/* Status */}
                <div>
                  <p className="input-label mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => statusToggle(s)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                          ${statusFilter.includes(s) ? 'bg-eu-blue/30 border-eu-sky/40 text-eu-sky' : 'bg-white/5 border-white/10 text-eu-muted'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Programme */}
                <div>
                  <p className="input-label mb-2">Programme</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROGRAMMES.map(p => (
                      <button key={p} onClick={() => setProgramme(p)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                          ${programme === p ? 'bg-eu-blue/30 border-eu-sky/40 text-eu-sky' : 'bg-white/5 border-white/10 text-eu-muted'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Action type */}
                <div>
                  <p className="input-label mb-2">Action type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ACTIONS.map(a => (
                      <button key={a} onClick={() => setActionType(a)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                          ${actionType === a ? 'bg-eu-blue/30 border-eu-sky/40 text-eu-sky' : 'bg-white/5 border-white/10 text-eu-muted'}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Results */}
      {grants.length > 0 && (
        <>
          {/* Toolbar */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2">
            <input className="input flex-1 py-2 text-xs" placeholder="Filter results…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button className="btn-ghost text-xs py-2 px-2.5" onClick={selectAllGrants}>All</button>
            <button className="btn-ghost text-xs py-2 px-2.5" onClick={deselectAllGrants}>None</button>
          </motion.div>

          {/* Grant list */}
          <div className="space-y-2">
            {filteredGrants.slice(0, 30).map((g, i) => (
              <GrantCard key={g.id} grant={g} index={i}
                selected={selectedGrantIds.has(g.id)}
                onToggle={() => toggleGrantSelection(g.id)}
                expanded={expandedGrant === g.id}
                onExpand={() => setExpandedGrant(expandedGrant === g.id ? null : g.id)}
                analysis={analysisMap[g.id]} />
            ))}
          </div>

          {/* Analyse button */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass p-4 flex flex-col gap-3">
            {analyzing && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-eu-muted">AI analysis in progress…</p>
                  <p className="text-xs text-eu-sky">{analyzeProgress}%</p>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-eu-blue to-eu-sky rounded-full"
                    animate={{ width: `${analyzeProgress}%` }} transition={{ duration: 0.3 }} />
                </div>
              </div>
            )}
            <button className="btn-primary w-full" disabled={!llmReady || analyzing || selectedGrantIds.size === 0}
              onClick={runAnalysis}>
              {analyzing
                ? <><Loader2 size={15} className="animate-spin" /> Analysing {selectedGrantIds.size} grants…</>
                : <><Brain size={15} /> Analyse {selectedGrantIds.size} selected grants {capabilities?.npuAvailable ? '(NPU)' : '(GPU)'}</>}
            </button>
            {!llmReady && (
              <p className="text-xs text-eu-muted text-center">Load AI model from Settings to enable analysis</p>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}

function GrantCard({ grant, index, selected, onToggle, expanded, onExpand, analysis }:
  { grant: GrantResult; index: number; selected: boolean; onToggle: () => void; expanded: boolean; onExpand: () => void; analysis?: string }) {

  const fitScore = analysis ? parseInt(analysis.match(/Fit Score:\s*(\d+)/)?.[1] ?? '0') : undefined
  const scoreColor = fitScore === undefined ? '' : fitScore >= 70 ? 'score-high' : fitScore >= 40 ? 'score-mid' : 'score-low'
  const statusCls = grant.status === 'open' ? 'badge-open' : grant.status === 'forthcoming' ? 'badge-forthcoming' : 'badge-closed'

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * Math.min(index, 15) }}
      className={`glass overflow-hidden transition-all ${selected ? 'border-eu-sky/25' : ''}`}>
      <div className="flex items-start gap-3 p-4">
        <button className="mt-0.5 shrink-0" onClick={onToggle}>
          {selected
            ? <CheckSquare size={18} className="text-eu-sky" />
            : <Square size={18} className="text-white/30" />}
        </button>
        <div className="flex-1 min-w-0" onClick={onExpand}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium text-white leading-snug flex-1">{grant.title}</p>
            {fitScore !== undefined && (
              <span className={`text-sm font-bold shrink-0 ${scoreColor}`}>{fitScore}%</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={statusCls}><Circle size={5} className="fill-current" />{grant.status}</span>
            <span className="badge-open bg-eu-blue/15 border-eu-blue/20 text-eu-sky">{grant.programme}</span>
            {grant.typeOfAction && <span className="badge-open bg-white/5 border-white/10 text-eu-muted">{grant.typeOfAction}</span>}
          </div>
          {!expanded && <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{grant.description}</p>}
          <div className="flex items-center gap-3 mt-2">
            {grant.deadline && <p className="text-[10px] text-eu-muted">📅 {grant.deadline.slice(0, 10)}</p>}
            {grant.budget    && <p className="text-[10px] text-eu-muted">💶 {grant.budget}</p>}
            <span className="text-[10px] text-eu-muted ml-auto flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${grant.matchingScore > 50 ? 'bg-green-400' : grant.matchingScore > 20 ? 'bg-yellow-400' : 'bg-white/20'}`} />
              {grant.matchingScore}% keyword match
            </span>
          </div>
        </div>
        <button className="shrink-0 mt-0.5" onClick={onExpand}>
          {expanded ? <ChevronUp size={14} className="text-eu-muted" /> : <ChevronDown size={14} className="text-eu-muted" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-white/[0.06]">
            <div className="p-4 space-y-3">
              {grant.description && (
                <p className="text-xs text-white/60 leading-relaxed">{grant.description}</p>
              )}
              {analysis && (
                <div className="bg-white/[0.04] rounded-xl p-3">
                  <p className="text-[10px] text-eu-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Sparkles size={10} /> AI Analysis
                  </p>
                  <div className="prose-eu text-xs"
                    dangerouslySetInnerHTML={{ __html: marked.parse(analysis) as string }} />
                </div>
              )}
              <div className="flex gap-2">
                <a href={grant.portalUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary flex-1 text-xs py-2.5 gap-1.5">
                  <ExternalLink size={13} /> EU Portal
                </a>
                <button className="btn-ghost px-3 py-2.5"
                  onClick={() => navigator.clipboard.writeText(grant.id)}>
                  <Copy size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm font-medium text-white mb-1">{title}</p>
      <p className="text-xs text-eu-muted leading-relaxed">{desc}</p>
    </div>
  )
}
