'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

export function AnniversaryRulesManager({ rules, labels }: { rules: Array<{ id: string; years: number; is_active: boolean }>; labels: { add: string; years: string; save: string; cancel: string; delete: string; saved: string; failed: string; empty: string } }) {
  const router = useRouter()
  const [years, setYears] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openCreate(): void { setYears(''); setMessage(null); setDrawerOpen(true) }
  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!years || Number(years) < 1) return
    setSaving(true); setMessage(null)
    const response = await fetch('/api/settings/anniversary-rules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ years: Number(years) }) })
    setSaving(false)
    if (!response.ok) { setMessage(labels.failed); return }
    setDrawerOpen(false); setYears(''); setMessage(labels.saved); router.refresh()
  }
  async function remove(): Promise<void> {
    if (!confirmId) return
    setSaving(true); setMessage(null)
    const response = await fetch('/api/settings/anniversary-rules', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: confirmId }) })
    setSaving(false); setConfirmId(null)
    if (!response.ok) { setMessage(labels.failed); return }
    setMessage(labels.saved); router.refresh()
  }
  const dirty = years.trim() !== ''
  return <section className="mt-7 max-w-3xl space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.years}</h2></div><Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button></div>{message ? <p aria-live="polite" className="text-sm" role="status">{message}</p> : null}{rules.length ? <Surface><ul className="divide-y divide-border-subtle">{rules.map((rule) => <li className="flex items-center justify-between gap-3 px-4 py-3" key={rule.id}><span className="font-medium">{rule.years} {labels.years}</span><RowActions menuLabel={labels.delete} menuItems={[{ id: 'delete', label: labels.delete, destructive: true, icon: <Trash2 aria-hidden="true" />, onSelect: () => setConfirmId(rule.id) }]} /></li>)}</ul></Surface> : <EmptyState title={labels.empty} />}
    <FormDrawer cancelLabel={labels.save} closeLabel={labels.cancel} description={labels.years} dirty={dirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.save, title: labels.cancel }} onDiscard={() => setYears('')} onOpenChange={setDrawerOpen} onSubmit={(event) => void create(event)} open={drawerOpen} saveLabel={labels.save} saving={saving} title={labels.add}><FormField control={<TextInput min="1" onChange={(event) => setYears(event.target.value)} required type="number" value={years} />} label={labels.years} required /></FormDrawer>
    <ConfirmDialog cancelLabel={labels.save} confirmLabel={labels.delete} destructive description={labels.failed} onConfirm={() => void remove()} onOpenChange={(open) => { if (!open) setConfirmId(null) }} open={confirmId !== null} pending={saving} title={labels.delete} />
  </section>
}
