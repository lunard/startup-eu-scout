import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Building2, Globe, Search, Trash2, Clock, ChevronRight, Loader2, ExternalLink } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { saveProfile, getAllProfiles, deleteProfile } from '@/lib/storage'
import type { StartupProfile } from '@/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64) || crypto.randomUUID()
}

async function fetchProfileData(name: string, url: string, log: (t: any, m: string) => void): Promise<StartupProfile> {
  log('api', `Fetching registry data for "${name}"…`)
  const query = encodeURIComponent(name)
  let profileData: Partial<StartupProfile> = { ragioneSociale: name, url, id: slugify(name) }

  // OpenCorporates
  try {
    const res = await fetch(`/api/opencorporates/v0.4/companies/search?q=${query}&jurisdiction_code=it&format=json`)
    if (res.ok) {
      const json = await res.json()
      const company = json?.results?.companies?.[0]?.company
      if (company) {
        profileData = {
          ...profileData,
          piva: company.company_number,
          jurisdiction: company.jurisdiction_code,
          incorporatedOn: company.incorporation_date,
          registryUrl: company.opencorporates_url,
        }
        log('success', `Registry data found: ${company.jurisdiction_code?.toUpperCase()} · ${company.company_number}`)
      }
    }
  } catch (e) { log('warn', `Registry lookup failed: ${(e as Error).message}`) }

  // Web scrape
  if (url) {
    try {
      log('api', `Fetching website: ${url}`)
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`)
      if (res.ok) {
        const html = await res.text()
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const title = doc.querySelector('title')?.textContent?.trim() ?? ''
        const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
        const bodyText = doc.body?.innerText?.replace(/\s+/g, ' ').slice(0, 3000) ?? ''
        profileData = { ...profileData, pageTitle: title, description: desc, rawText: bodyText }
        log('success', `Website scraped: "${title}"`)
      }
    } catch (e) { log('warn', `Website fetch failed: ${(e as Error).message}`) }
  }

  return { ...profileData, lastUpdated: new Date().toISOString() } as StartupProfile
}

export default function ProfileTab() {
  const { profile, setProfile, setActiveTab, addLog } = useAppStore()
  const qc = useQueryClient()
  const [name, setName] = useState(profile?.ragioneSociale ?? '')
  const [url, setUrl] = useState(profile?.url ?? '')

  const { data: recentProfiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: getAllProfiles,
  })

  const buildMutation = useMutation({
    mutationFn: () => fetchProfileData(name.trim(), url.trim(), addLog),
    onSuccess: async (p) => {
      await saveProfile(p)
      setProfile(p)
      qc.invalidateQueries({ queryKey: ['profiles'] })
      addLog('success', `Profile saved: ${p.ragioneSociale}`)
    },
    onError: (e) => addLog('error', `Profile build failed: ${(e as Error).message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

  function loadRecent(p: StartupProfile) {
    setProfile(p); setName(p.ragioneSociale); setUrl(p.url ?? '')
    addLog('storage', `Loaded profile: ${p.ragioneSociale}`)
  }

  const isBusy = buildMutation.isPending

  return (
    <div className="px-4 py-5 space-y-5 pb-4">
      {/* Input card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-eu-sky" />
          <h2 className="text-sm font-semibold text-white">Startup Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="input-label">Company name *</label>
            <input className="input" placeholder="e.g. Innovatech S.r.l."
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Website URL</label>
            <input className="input" placeholder="https://yourcompany.eu" type="url"
              value={url} onChange={e => setUrl(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn-primary flex-1" disabled={!name.trim() || isBusy}
            onClick={() => buildMutation.mutate()}>
            {isBusy ? <><Loader2 size={15} className="animate-spin" /> Building…</> : <><Search size={15} /> Build Profile</>}
          </button>
          {profile && (
            <button className="btn-ghost px-3" onClick={() => { setProfile(null); setName(''); setUrl('') }}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Current profile result */}
      {profile && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass p-5 border-eu-sky/20">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex-1 pr-2">{profile.ragioneSociale}</h3>
            {profile.lastUpdated && (
              <span className="text-[10px] text-eu-muted flex items-center gap-1 shrink-0">
                <Clock size={10} />{new Date(profile.lastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: 'Jurisdiction', value: profile.jurisdiction?.toUpperCase() },
              { label: 'VAT / Reg. No', value: profile.piva },
              { label: 'Founded',       value: profile.incorporatedOn },
              { label: 'Keywords',      value: profile.keywords?.length ? `${profile.keywords.length} tags` : undefined },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="bg-white/[0.04] rounded-lg px-3 py-2">
                <p className="text-[10px] text-eu-muted uppercase tracking-wide">{r.label}</p>
                <p className="text-xs text-white mt-0.5 font-medium truncate">{r.value}</p>
              </div>
            ))}
          </div>

          {profile.description && (
            <p className="text-xs text-white/50 leading-relaxed line-clamp-2 mb-3">{profile.description}</p>
          )}

          {profile.registryUrl && (
            <a href={profile.registryUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-eu-sky">
              <ExternalLink size={11} /> View on OpenCorporates
            </a>
          )}

          <div className="border-t border-white/[0.06] mt-3 pt-3 flex gap-2">
            <button className="btn-secondary flex-1 text-xs py-2.5"
              onClick={() => setActiveTab('summary')}>
              Generate EU Summary →
            </button>
            <button className="btn-secondary flex-1 text-xs py-2.5"
              onClick={() => setActiveTab('grants')}>
              Search Grants →
            </button>
          </div>
        </motion.div>
      )}

      {/* Recent profiles */}
      {recentProfiles.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <p className="text-xs text-eu-muted uppercase tracking-wide mb-2 px-1">Recent profiles</p>
          <div className="glass divide-y divide-white/[0.06] overflow-hidden">
            {recentProfiles.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-eu-blue/30 flex items-center justify-center text-xs font-bold text-eu-sky shrink-0">
                  {p.ragioneSociale.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0" onClick={() => loadRecent(p)}>
                  <p className="text-sm text-white font-medium truncate">{p.ragioneSociale}</p>
                  <p className="text-[10px] text-eu-muted">{p.jurisdiction?.toUpperCase()} · {new Date(p.lastUpdated ?? '').toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-2 active:bg-white/10 rounded-lg transition-colors"
                    onClick={() => loadRecent(p)}>
                    <ChevronRight size={14} className="text-eu-muted" />
                  </button>
                  <button className="p-2 active:bg-red-500/10 rounded-lg transition-colors"
                    onClick={() => deleteMutation.mutate(p.id)}>
                    <Trash2 size={13} className="text-red-400/60" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
