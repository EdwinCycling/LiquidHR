'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function AnniversaryRulesManager({ rules, labels }: { rules: Array<{ id: string; years: number; is_active: boolean }>; labels: { add: string; years: string; save: string; delete: string; saved: string; failed: string; empty: string } }) {
  const router = useRouter(); const [years, setYears] = useState(''); const [message, setMessage] = useState<string | null>(null)
  async function create(): Promise<void> { const response = await fetch('/api/settings/anniversary-rules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ years: Number(years) }) }); if (!response.ok) { setMessage(labels.failed); return }; setYears(''); setMessage(labels.saved); router.refresh() }
  async function remove(id: string): Promise<void> { const response = await fetch('/api/settings/anniversary-rules', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); if (!response.ok) { setMessage(labels.failed); return }; setMessage(labels.saved); router.refresh() }
  return <section className="mt-7 max-w-3xl rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap gap-3"><label className="grid gap-1.5 text-sm font-medium">{labels.years}<input className="form-field w-36" min="1" onChange={(event) => setYears(event.target.value)} type="number" value={years} /></label><button className="button-primary mt-6 inline-flex items-center gap-2" disabled={!years} onClick={() => void create()} type="button"><Plus size={16} />{labels.add}</button></div>{message ? <p aria-live="polite" className="mt-4 text-sm">{message}</p> : null}{rules.length ? <ul className="mt-5 divide-y rounded-xl border">{rules.map((rule) => <li className="flex items-center justify-between px-4 py-3" key={rule.id}><span>{rule.years} {labels.years}</span><button aria-label={labels.delete} className="text-destructive" onClick={() => void remove(rule.id)} type="button"><Trash2 size={16} /></button></li>)}</ul> : <p className="mt-5 text-sm text-muted-foreground">{labels.empty}</p>}</section>
}
