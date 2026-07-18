'use client'

import { useState } from 'react'
import { Check, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'

type ModuleItem = { code: string; status: 'AVAILABLE' | 'COMING_SOON'; toggleable: boolean; state: { is_enabled: boolean } | null }
type Labels = { save: string; saving: string; saved: string; failed: string; comingSoon: string; descriptions: Record<string, string>; names: Record<string, string> }

export function ModuleSettingsForm({ modules, labels }: { modules: ModuleItem[]; labels: Labels }) {
  const [enabled, setEnabled] = useState(() => new Set(modules.filter((module) => module.state?.is_enabled).map((module) => module.code)))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  async function save() {
    setStatus('saving')
    const response = await fetch('/api/settings/modules', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: [...enabled] }) })
    setStatus(response.ok ? 'saved' : 'failed')
  }
  return <div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map((module) => { const active = enabled.has(module.code); return <article className={`flex min-h-56 flex-col rounded-2xl border bg-surface p-5 shadow-sm ${module.toggleable && active ? 'border-primary/40' : ''}`} key={module.code}><div className="flex items-start justify-between gap-4"><span className={`grid size-11 place-items-center rounded-xl ${module.toggleable ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}>{module.toggleable ? <Sparkles size={20} /> : <LockKeyhole size={19} />}</span>{!module.toggleable ? <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{labels.comingSoon}</span> : null}</div><h2 className="mt-5 text-lg font-semibold">{labels.names[module.code]}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.descriptions[module.code]}</p><div className="mt-auto pt-5">{module.toggleable ? <button aria-pressed={active} className={`relative h-7 w-12 rounded-full transition ${active ? 'bg-primary' : 'bg-muted-foreground/30'}`} onClick={() => setEnabled((current) => { const next = new Set(current); if (next.has(module.code)) next.delete(module.code); else next.add(module.code); return next })} type="button"><span className={`absolute top-1 grid size-5 place-items-center rounded-full bg-white transition ${active ? 'left-6' : 'left-1'}`}>{active ? <Check className="text-primary" size={12} strokeWidth={3} /> : null}</span></button> : null}</div></article>})}</div><div className="sticky bottom-0 mt-6 flex items-center justify-end gap-4 border-t bg-background/95 py-4 backdrop-blur">{status === 'saved' ? <span className="text-sm text-success">{labels.saved}</span> : null}{status === 'failed' ? <span className="text-sm text-destructive">{labels.failed}</span> : null}<button className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={status === 'saving'} onClick={save} type="button">{status === 'saving' ? <LoaderCircle className="animate-spin" size={17} /> : null}{status === 'saving' ? labels.saving : labels.save}</button></div></div>
}
