'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Sparkles } from 'lucide-react'
import { FormActions } from '@/components/patterns/form-actions'
import { Badge } from '@/components/ui/badge'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'

type ModuleItem = { code: string; status: 'AVAILABLE' | 'COMING_SOON'; toggleable: boolean; state: { is_enabled: boolean } | null }
type Labels = { save: string; cancel: string; saving: string; saved: string; failed: string; comingSoon: string; descriptions: Record<string, string>; names: Record<string, string> }

export function ModuleSettingsForm({ modules, labels }: { modules: ModuleItem[]; labels: Labels }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(() => new Set(modules.filter((module) => module.state?.is_enabled).map((module) => module.code)))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  async function save(): Promise<void> {
    setStatus('saving')
    const response = await fetch('/api/settings/modules', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: [...enabled] }) })
    if (response.ok) { setStatus('saved'); router.refresh() } else setStatus('failed')
  }
  return <form onSubmit={(event) => { event.preventDefault(); void save() }}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map((module) => { const active = enabled.has(module.code); return <Surface className={`flex min-h-56 flex-col p-5 ${module.toggleable && active ? 'border-primary/40' : ''}`} key={module.code}><div className="flex items-start justify-between gap-4"><span aria-hidden="true" className={`grid size-11 place-items-center rounded-[var(--radius-control)] ${module.toggleable ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}>{module.toggleable ? <Sparkles size={20} /> : <LockKeyhole size={19} />}</span>{!module.toggleable ? <Badge tone="neutral">{labels.comingSoon}</Badge> : null}</div><h2 className="mt-5 text-lg font-semibold">{labels.names[module.code]}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.descriptions[module.code]}</p><div className="mt-auto pt-5">{module.toggleable ? <Switch aria-label={labels.names[module.code]} checked={active} onCheckedChange={(checked) => setEnabled((current) => { const next = new Set(current); if (checked) next.add(module.code); else next.delete(module.code); return next })} /> : null}</div></Surface>})}</div><p aria-live="polite" className={`mt-5 min-h-5 text-sm ${status === 'failed' ? 'text-destructive' : status === 'saved' ? 'text-success' : ''}`} role={status === 'failed' ? 'alert' : 'status'}>{status === 'saved' ? labels.saved : status === 'failed' ? labels.failed : ''}</p><FormActions cancelLabel={labels.cancel} onCancel={() => { setEnabled(new Set(modules.filter((module) => module.state?.is_enabled).map((module) => module.code))); setStatus('idle') }} saveLabel={labels.save} saving={status === 'saving'} sticky /></form>
}
