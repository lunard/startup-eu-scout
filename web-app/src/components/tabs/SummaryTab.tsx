import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Sparkles, Download, Tags, X, Plus, Loader2, Eye, Code2 } from 'lucide-react'
import { marked } from 'marked'
import { useAppStore } from '@/store/appStore'
import { saveProfile } from '@/lib/storage'

const EU_SUMMARY_PROMPT = (p: { ragioneSociale: string; description?: string; rawText?: string }) => `
You are an expert in EU funding programmes. Analyze this startup and produce a structured EU funding summary in Markdown.

Company: ${p.ragioneSociale}
Description: ${p.description ?? 'N/A'}
Website content: ${p.rawText?.slice(0, 2000) ?? 'N/A'}

Produce a Markdown document with these sections:
## Company Overview
## Core Technologies & Innovation
## Target Market & Geography
## EU Programme Alignment (Horizon Europe, EIC, DIGITAL Europe, etc.)
## Key Strengths for EU Grants
## Recommended Search Keywords
List 10-15 keywords as a bullet list that would match EU calls.

Be specific and concrete. Focus on what makes this startup fundable by EU grants.
`.trim()

export default function SummaryTab() {
  const { profile, setProfile, llmReady, addLog } = useAppStore()
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const [generating, setGenerating] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')

  async function generateSummary() {
    if (!profile || !llmReady) return
    setGenerating(true)
    addLog('llm', 'Generating EU summary with local LLM…')
    try {
      // Dynamic import to avoid loading WebLLM until needed
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await (window as any).__euScoutEngine
      if (!engine) throw new Error('LLM engine not initialized. Load it from Settings first.')
      const prompt = EU_SUMMARY_PROMPT(profile)
      const stream = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 900,
        stream: true as const,
      })
      let summary = ''
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          summary += delta
          setProfile({ ...profile, schedaEU: summary })
        }
      }
      const keywords = extractKeywords(summary)
      const updated = { ...profile, schedaEU: summary, keywords }
      await saveProfile(updated)
      setProfile(updated)
      addLog('success', 'EU summary generated and saved')
    } catch (e) {
      addLog('error', `Summary generation failed: ${(e as Error).message}`)
    } finally {
      setGenerating(false)
    }
  }

  function extractKeywords(md: string): string[] {
    const section = md.split(/##.*keywords/i)[1] ?? ''
    return section.match(/[-•]\s*(.+)/g)?.map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean).slice(0, 15) ?? []
  }

  function addKeyword() {
    if (!newKeyword.trim() || !profile) return
    const updated = { ...profile, keywords: [...(profile.keywords ?? []), newKeyword.trim()] }
    setProfile(updated); saveProfile(updated); setNewKeyword('')
  }

  function removeKeyword(kw: string) {
    if (!profile) return
    const updated = { ...profile, keywords: (profile.keywords ?? []).filter(k => k !== kw) }
    setProfile(updated); saveProfile(updated)
  }

  function downloadMarkdown() {
    if (!profile?.schedaEU) return
    const blob = new Blob([profile.schedaEU], { type: 'text/markdown' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `eu-summary-${profile.ragioneSociale.replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
  }

  if (!profile) return (
    <EmptyState icon="🇪🇺" title="No profile loaded" desc="Build a startup profile first to generate an EU summary." />
  )

  return (
    <div className="px-4 py-5 space-y-4 pb-4">
      {/* Header actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass p-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-eu-muted">Startup</p>
          <p className="text-sm font-semibold text-white truncate">{profile.ragioneSociale}</p>
        </div>
        <button className="btn-primary px-4 py-2.5 text-sm" disabled={!llmReady || generating}
          onClick={generateSummary}>
          {generating
            ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
            : <><Sparkles size={14} /> Generate</>}
        </button>
      </motion.div>

      {!llmReady && !generating && (
        <div className="glass-dark p-4 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <p className="text-xs text-white/50 leading-relaxed">
            Load the local AI model from <strong className="text-white/70">Settings → Local LLM</strong> to generate summaries on-device,
            or configure your Claude API key.
          </p>
        </div>
      )}

      {/* Summary content */}
      {profile.schedaEU && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass overflow-hidden">
          {/* View toggle */}
          <div className="flex border-b border-white/[0.06]">
            {(['preview', 'source'] as const).map(v => (
              <button key={v}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors
                  ${view === v ? 'text-white border-b-2 border-eu-gold -mb-px' : 'text-eu-muted'}`}
                onClick={() => setView(v)}>
                {v === 'preview' ? <Eye size={13} /> : <Code2 size={13} />}
                {v === 'preview' ? 'Preview' : 'Markdown'}
              </button>
            ))}
            <button className="px-4 py-3 text-eu-muted active:text-white transition-colors" onClick={downloadMarkdown}>
              <Download size={14} />
            </button>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto">
            {view === 'preview' ? (
              <div className="prose-eu"
                dangerouslySetInnerHTML={{ __html: marked.parse(profile.schedaEU) as string }} />
            ) : (
              <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap leading-relaxed">
                {profile.schedaEU}
              </pre>
            )}
          </div>
        </motion.div>
      )}

      {/* Keywords */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Tags size={14} className="text-eu-sky" />
          <p className="text-sm font-medium text-white">Search Keywords</p>
          <span className="ml-auto text-[10px] text-eu-muted">{profile.keywords?.length ?? 0}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {(profile.keywords ?? []).map(kw => (
            <span key={kw}
              className="flex items-center gap-1 bg-eu-blue/20 border border-eu-blue/30 text-eu-sky rounded-full px-2.5 py-1 text-xs">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="opacity-60 hover:opacity-100">
                <X size={10} />
              </button>
            </span>
          ))}
          {(profile.keywords?.length ?? 0) === 0 && (
            <p className="text-xs text-eu-muted">No keywords yet — generate a summary to auto-extract them.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input className="input flex-1 py-2 text-xs" placeholder="Add keyword…"
            value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()} />
          <button className="btn-secondary px-3 py-2" onClick={addKeyword}>
            <Plus size={14} />
          </button>
        </div>
      </motion.div>
    </div>
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
