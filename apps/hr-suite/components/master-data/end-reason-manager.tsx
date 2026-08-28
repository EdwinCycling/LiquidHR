'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CountryPicker } from '@/components/ui/country-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

interface Reason { id: string; code: string; country_code: string; name_nl: string; name_en: string; is_active: boolean }
interface Labels { country: string; addCountry: string; code: string; nameNl: string; nameEn: string; add: string; edit: string; save: string; cancel: string; active: string; inactive: string; activate: string; deactivate: string; delete: string; inUse: string; failed: string; emptyCountry: string; fallbackReason: string }
type Draft = { code: string; nameNl: string; nameEn: string }
type Confirmation = { action: 'delete' | 'toggle'; reason: Reason } | null
const commonCountries = ['NL', 'BE', 'DE', 'FR', 'GB', 'ES', 'PL']
const emptyDraft: Draft = { code: '', nameNl: '', nameEn: '' }

export function EndReasonManager({ reasons, countries, countryCode, labels }: { reasons: Reason[]; countries: string[]; countryCode: string; labels: Labels }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Reason | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [initialDraft, setInitialDraft] = useState<Draft>(emptyDraft)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [message, setMessage] = useState<string | null>(null)
  const countryOptions = [...new Set([...commonCountries, ...countries, countryCode])].sort().map((code) => ({ code, name: code }))

  async function request(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object): Promise<boolean> {
    setMessage(null)
    const response = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    if (!response.ok) { const payload = await response.json().catch(() => null) as { error?: string } | null; setMessage(payload?.error === 'END_REASON_IN_USE' ? labels.inUse : labels.failed); return false }
    router.refresh(); return true
  }
  function openCreate(): void { setEditing(null); setDraft(emptyDraft); setInitialDraft(emptyDraft); setMessage(null); setDrawerOpen(true) }
  function openEdit(reason: Reason): void { const next = { code: reason.code, nameNl: reason.name_nl, nameEn: reason.name_en }; setEditing(reason); setDraft(next); setInitialDraft(next); setMessage(null); setDrawerOpen(true) }
  function closeDrawer(): void { setDrawerOpen(false); setEditing(null); setDraft(emptyDraft); setInitialDraft(emptyDraft) }
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft.code.trim() || !draft.nameNl.trim() || !draft.nameEn.trim()) return
    const ok = editing ? await request(`/api/master-data/end-reasons/${editing.id}`, 'PATCH', { code: draft.code.trim(), nameNl: draft.nameNl.trim(), nameEn: draft.nameEn.trim() }) : await request('/api/master-data/end-reasons', 'POST', { countryCode, code: draft.code.trim(), nameNl: draft.nameNl.trim(), nameEn: draft.nameEn.trim() })
    if (ok) closeDrawer()
  }
  async function confirmAction(): Promise<void> {
    if (!confirmation) return
    const { action, reason } = confirmation
    const ok = action === 'delete' ? await request(`/api/master-data/end-reasons/${reason.id}`, 'DELETE') : await request(`/api/master-data/end-reasons/${reason.id}`, 'PATCH', { isActive: !reason.is_active })
    if (ok) setConfirmation(null)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  return <div className="space-y-5"><Surface className="flex flex-wrap items-end gap-4 p-5"><div className="grid min-w-52 gap-1.5 text-sm"><span className="font-medium">{labels.country}</span><CountryPicker emptyLabel={labels.emptyCountry} onChange={(value) => router.push(`/master-data/end-reasons?country=${value}`)} options={countryOptions} searchLabel={labels.country} value={countryCode} /></div><div className="grid min-w-52 gap-1.5 text-sm"><label className="font-medium" htmlFor="add-end-reason-country">{labels.addCountry}</label><TextInput id="add-end-reason-country" maxLength={2} onKeyDown={(event) => { if (event.key !== 'Enter') return; event.preventDefault(); const value = event.currentTarget.value.trim().toUpperCase(); if (/^[A-Z]{2}$/.test(value)) router.push(`/master-data/end-reasons?country=${value}`) }} /></div><Button className="ml-auto" onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button></Surface>{message ? <p aria-live="polite" className="text-sm text-destructive" role="alert">{message}</p> : null}{reasons.length === 0 ? <EmptyState description={labels.fallbackReason} title={labels.emptyCountry} /> : <Surface><ul className="divide-y divide-border-subtle">{reasons.map((reason) => <li className={`flex flex-wrap items-center gap-3 px-4 py-4 ${reason.is_active ? '' : 'opacity-60'}`} key={reason.id}><div className="min-w-0 flex-1"><p className="font-semibold">{reason.code} · {reason.name_nl}</p><p className="text-xs text-muted-foreground">{reason.name_en}</p></div><Badge tone={reason.is_active ? 'success' : 'neutral'}>{reason.is_active ? labels.active : labels.inactive}</Badge><RowActions menuLabel={labels.edit} primaryAction={<Button aria-label={`${labels.edit}: ${reason.code}`} onClick={() => openEdit(reason)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>} menuItems={[{ id: 'toggle', label: reason.is_active ? labels.deactivate : labels.activate, onSelect: () => reason.is_active ? setConfirmation({ action: 'toggle', reason }) : void request(`/api/master-data/end-reasons/${reason.id}`, 'PATCH', { isActive: true }) }, { id: 'delete', label: labels.delete, destructive: true, icon: <Trash2 aria-hidden="true" />, onSelect: () => setConfirmation({ action: 'delete', reason }) }]} /></li>)}</ul></Surface>}
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.country} dirty={dirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeDrawer} onOpenChange={(open) => { if (!open && !dirty) closeDrawer() }} onSubmit={(event) => void save(event)} open={drawerOpen} saveLabel={editing ? labels.save : labels.add} title={editing ? labels.edit : labels.add}><FormField control={<TextInput maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} required value={draft.code} />} label={labels.code} required /><FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, nameNl: event.target.value }))} required value={draft.nameNl} />} label={labels.nameNl} required /><FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, nameEn: event.target.value }))} required value={draft.nameEn} />} label={labels.nameEn} required />{message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}</FormDrawer>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={confirmation?.action === 'delete' ? labels.delete : confirmation?.reason.is_active ? labels.deactivate : labels.activate} destructive={confirmation?.action === 'delete' || confirmation?.reason.is_active === true} description={labels.failed} onConfirm={() => void confirmAction()} onOpenChange={(open) => { if (!open) setConfirmation(null) }} open={confirmation !== null} title={confirmation?.action === 'delete' ? labels.delete : confirmation?.reason.is_active ? labels.deactivate : labels.activate} />
  </div>
}
