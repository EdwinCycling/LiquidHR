'use client'

import { Brain, Check, Pencil, Settings2, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { requestJson } from './hera-request'

interface MemoryItem {
  id: string
  content: string
  category: 'PREFERENCE' | 'WORKING_CONTEXT'
  updated_at: string
}

interface PreferenceState {
  tone: 'FRIENDLY' | 'BUSINESS' | 'DIRECT'
  detailLevel: 'COMPACT' | 'BALANCED' | 'EXTENDED'
  seniorityLevel: 'BASIC' | 'EXPERIENCED' | 'EXPERT'
}

export interface HeRaSettingsLabels {
  settings: string
  closeSettings: string
  memoryTitle: string
  memoryDescription: string
  noMemory: string
  edit: string
  delete: string
  save: string
  tone: string
  toneFriendly: string
  toneBusiness: string
  toneDirect: string
  detailLevel: string
  detailCompact: string
  detailBalanced: string
  detailExtended: string
  seniorityLevel: string
  seniorityBasic: string
  seniorityExperienced: string
  seniorityExpert: string
  preferencesSave: string
  preferencesSaved: string
  error: string
}

const DEFAULT_PREFERENCES: PreferenceState = {
  tone: 'BUSINESS', detailLevel: 'BALANCED', seniorityLevel: 'EXPERIENCED',
}

export function HeRaSettings({ open, onClose, labels }: { open: boolean; onClose: () => void; labels: HeRaSettingsLabels }) {
  const [memory, setMemory] = useState<MemoryItem[]>([])
  const [preferences, setPreferences] = useState<PreferenceState>(DEFAULT_PREFERENCES)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      try {
        const [memoryResult, preferenceResult] = await Promise.all([
          requestJson<{ data: MemoryItem[] }>('/api/hera/memory'),
          requestJson<{ data: { tone: PreferenceState['tone']; detail_level: PreferenceState['detailLevel']; seniority_level: PreferenceState['seniorityLevel'] } }>('/api/hera/preferences'),
        ])
        if (cancelled) return
        setMemory(memoryResult.data)
        setPreferences({
          tone: preferenceResult.data.tone,
          detailLevel: preferenceResult.data.detail_level,
          seniorityLevel: preferenceResult.data.seniority_level,
        })
      } catch { if (!cancelled) setStatus(labels.error) }
    }
    void load()
    return () => { cancelled = true }
  }, [labels.error, open])

  async function savePreferences() {
    try {
      await requestJson('/api/hera/preferences', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(preferences),
      })
      setStatus(labels.preferencesSaved)
    } catch { setStatus(labels.error) }
  }

  async function saveMemory(id: string) {
    try {
      const result = await requestJson<{ data: MemoryItem }>('/api/hera/memory', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, content: editingContent, explicitConsent: true }),
      })
      setMemory((items) => items.map((item) => item.id === id ? result.data : item))
      setEditingId(null)
    } catch { setStatus(labels.error) }
  }

  async function deleteMemory(id: string) {
    try {
      await requestJson(`/api/hera/memory?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setMemory((items) => items.filter((item) => item.id !== id))
    } catch { setStatus(labels.error) }
  }

  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-foreground/25 backdrop-blur-[2px]" role="presentation">
      <section aria-labelledby="hera-settings-title" aria-modal="true" className="flex h-full w-full max-w-lg flex-col border-l bg-surface shadow-2xl" role="dialog">
        <header className="flex items-center justify-between border-b px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground"><Settings2 aria-hidden="true" size={17} /></span><h2 className="font-semibold text-foreground" id="hera-settings-title">{labels.settings}</h2></div><button aria-label={labels.closeSettings} className="grid size-9 place-items-center rounded-lg hover:bg-muted" onClick={onClose} type="button"><X aria-hidden="true" size={17} /></button></header>
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
          <section><h3 className="text-sm font-semibold text-foreground">{labels.tone}</h3><div className="mt-3 grid grid-cols-3 gap-2">{([['FRIENDLY', labels.toneFriendly], ['BUSINESS', labels.toneBusiness], ['DIRECT', labels.toneDirect]] as const).map(([value, label]) => <button className={`rounded-xl border px-3 py-2 text-sm ${preferences.tone === value ? 'border-focus bg-accent text-accent-foreground' : 'bg-surface-raised'}`} key={value} onClick={() => setPreferences((current) => ({ ...current, tone: value }))} type="button">{label}</button>)}</div></section>
          <section><h3 className="text-sm font-semibold text-foreground">{labels.detailLevel}</h3><select className="mt-3 w-full rounded-xl border bg-surface-raised px-3 py-2.5 text-sm" onChange={(event) => setPreferences((current) => ({ ...current, detailLevel: event.target.value as PreferenceState['detailLevel'] }))} value={preferences.detailLevel}><option value="COMPACT">{labels.detailCompact}</option><option value="BALANCED">{labels.detailBalanced}</option><option value="EXTENDED">{labels.detailExtended}</option></select></section>
          <section><h3 className="text-sm font-semibold text-foreground">{labels.seniorityLevel}</h3><select className="mt-3 w-full rounded-xl border bg-surface-raised px-3 py-2.5 text-sm" onChange={(event) => setPreferences((current) => ({ ...current, seniorityLevel: event.target.value as PreferenceState['seniorityLevel'] }))} value={preferences.seniorityLevel}><option value="BASIC">{labels.seniorityBasic}</option><option value="EXPERIENCED">{labels.seniorityExperienced}</option><option value="EXPERT">{labels.seniorityExpert}</option></select></section>
          <button className="button-primary w-full justify-center gap-2" onClick={() => void savePreferences()} type="button"><Check aria-hidden="true" size={15} />{labels.preferencesSave}</button>
          <section className="border-t pt-6"><div className="flex items-center gap-2"><Brain aria-hidden="true" size={17} /><h3 className="font-semibold text-foreground">{labels.memoryTitle}</h3></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.memoryDescription}</p>{memory.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{labels.noMemory}</p> : <ul className="mt-4 space-y-3">{memory.map((item) => <li className="rounded-xl border bg-surface-raised p-3" key={item.id}>{editingId === item.id ? <div className="space-y-2"><textarea className="w-full rounded-lg border bg-surface px-3 py-2 text-sm" onChange={(event) => setEditingContent(event.target.value)} value={editingContent} /><button className="button-primary gap-2" onClick={() => void saveMemory(item.id)} type="button"><Check aria-hidden="true" size={14} />{labels.save}</button></div> : <><p className="text-sm leading-6 text-foreground">{item.content}</p><div className="mt-3 flex gap-2"><button className="button-secondary gap-2 text-xs" onClick={() => { setEditingId(item.id); setEditingContent(item.content) }} type="button"><Pencil aria-hidden="true" size={13} />{labels.edit}</button><button className="button-secondary gap-2 text-xs text-destructive" onClick={() => void deleteMemory(item.id)} type="button"><Trash2 aria-hidden="true" size={13} />{labels.delete}</button></div></>}</li>)}</ul>}</section>
          {status ? <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground" role="status">{status}</p> : null}
        </div>
      </section>
    </div>
  )
}
