'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Plus, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

interface TaskTemplate { id: string; code: string; title: string; description: string | null; due_after_effective_days: number; evidence_required: boolean; evidence_category: string | null; source: string; is_active: boolean; is_system: boolean }
interface Labels { title: string; subtitle: string; code: string; taskTitle: string; description: string; dueDays: string; evidenceRequired: string; evidenceCategory: string; add: string; saving: string; activate: string; deactivate: string; custom: string; system: string; empty: string; failed: string; codeConflict: string; cancel: string }
type Draft = { code: string; title: string; description: string; dueAfterEffectiveDays: string; evidenceRequired: boolean; evidenceCategory: string }
const emptyDraft: Draft = { code: '', title: '', description: '', dueAfterEffectiveDays: '', evidenceRequired: false, evidenceCategory: '' }

export function AbsenceTaskTemplateManager({ templates, labels }: { templates: TaskTemplate[]; labels: Labels }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [initialDraft, setInitialDraft] = useState<Draft>(emptyDraft)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openCreate(): void { setDraft(emptyDraft); setInitialDraft(emptyDraft); setError(null); setDrawerOpen(true) }
  function closeCreate(): void { setDrawerOpen(false); setDraft(emptyDraft); setInitialDraft(emptyDraft) }
  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft.code.trim() || !draft.title.trim() || !draft.dueAfterEffectiveDays) return
    setSaving(true); setError(null)
    const response = await fetch('/api/settings/absence/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: draft.code.trim(), title: draft.title.trim(), description: draft.description.trim() || null, dueAfterEffectiveDays: draft.dueAfterEffectiveDays, evidenceRequired: draft.evidenceRequired, evidenceCategory: draft.evidenceCategory.trim() || null }) })
    setSaving(false)
    if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; setError(body?.error === 'ABSENCE_TASK_CODE_CONFLICT' ? labels.codeConflict : labels.failed); return }
    closeCreate(); router.refresh()
  }
  async function toggle(template: TaskTemplate): Promise<void> {
    setSavingId(template.id); setError(null)
    const response = await fetch('/api/settings/absence/tasks', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: template.id, isActive: !template.is_active }) })
    setSavingId(null)
    if (!response.ok) setError(labels.failed); else router.refresh()
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  return <section className="mt-8 space-y-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.subtitle}</p></div><Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button></div>{error ? <p className="text-sm font-medium text-destructive" role="alert">{error}</p> : null}{templates.length === 0 ? <EmptyState title={labels.empty} /> : <Surface><ul className="divide-y divide-border-subtle">{templates.map((template) => <li className="flex flex-wrap items-start justify-between gap-4 px-4 py-4" key={template.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{template.title}</h3><Badge tone="neutral">{template.code}</Badge><Badge tone={template.is_system ? 'info' : 'neutral'}>{template.is_system ? labels.system : labels.custom}</Badge>{!template.is_active ? <Badge tone="warning">{labels.deactivate}</Badge> : null}</div>{template.description ? <p className="mt-1 text-sm text-muted-foreground">{template.description}</p> : null}<p className="mt-2 text-xs text-muted-foreground">{template.due_after_effective_days} {labels.dueDays}{template.evidence_required && template.evidence_category ? ` · ${template.evidence_category}` : ''}</p></div>{!template.is_system ? <RowActions menuLabel={template.is_active ? labels.deactivate : labels.activate} menuItems={[{ id: 'toggle', label: template.is_active ? labels.deactivate : labels.activate, icon: <Power aria-hidden="true" />, onSelect: () => { if (template.is_active) setConfirmId(template.id); else void toggle(template) } }]} /> : null}</li>)}</ul></Surface>}
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.subtitle} dirty={dirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeCreate} onOpenChange={(open) => { if (!open && !dirty) closeCreate() }} onSubmit={(event) => void create(event)} open={drawerOpen} saveLabel={labels.add} saving={saving} title={labels.add}><FormField control={<TextInput maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} required value={draft.code} />} label={labels.code} required /><FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required value={draft.title} />} label={labels.taskTitle} required /><FormField control={<Textarea maxLength={1000} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description} />} label={labels.description} /><FormField control={<TextInput max={3650} min={1} onChange={(event) => setDraft((current) => ({ ...current, dueAfterEffectiveDays: event.target.value }))} required type="number" value={draft.dueAfterEffectiveDays} />} label={labels.dueDays} required /><Checkbox checked={draft.evidenceRequired} label={labels.evidenceRequired} onChange={(event) => setDraft((current) => ({ ...current, evidenceRequired: event.target.checked }))} /><FormField control={<TextInput maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, evidenceCategory: event.target.value }))} value={draft.evidenceCategory} />} label={labels.evidenceCategory} />{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</FormDrawer>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.deactivate} destructive description={labels.failed} onConfirm={() => { const item = templates.find((template) => template.id === confirmId); if (item) return toggle(item) }} onOpenChange={(open) => { if (!open) setConfirmId(null) }} open={confirmId !== null} pending={savingId !== null} title={labels.deactivate} />
  </section>
}
