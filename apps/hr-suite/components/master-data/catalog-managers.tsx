'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { DocumentCategory, RelationType } from '@/lib/master-data/catalogs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { RowActions } from '@/components/patterns/row-actions'

type Labels = Record<string, string>
export type DocumentCategoryDraft = { code: string; name: string; description: string; requiresSalaryPermission: boolean }
const emptyDocumentDraft: DocumentCategoryDraft = { code: '', name: '', description: '', requiresSalaryPermission: false }

export function applyDocumentCategorySalaryPermissionChange(
  event: Pick<ChangeEvent<HTMLInputElement>, 'currentTarget'>,
  setDraft: Dispatch<SetStateAction<DocumentCategoryDraft>>,
): void {
  const checked = event.currentTarget.checked
  setDraft((current) => ({ ...current, requiresSalaryPermission: checked }))
}

export function DocumentCategoryManager({ categories, labels }: { categories: DocumentCategory[]; labels: Labels }) {
  const router = useRouter()
  const [draft, setDraft] = useState<DocumentCategoryDraft>(emptyDocumentDraft)
  const [initialDraft, setInitialDraft] = useState<DocumentCategoryDraft>(emptyDocumentDraft)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<{ action: 'delete' | 'toggle'; item: DocumentCategory } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  function openCreate(): void { setEditingCategoryId(null); setDraft(emptyDocumentDraft); setInitialDraft(emptyDocumentDraft); setError(null); setDrawerOpen(true) }
  function openEdit(item: DocumentCategory): void {
    setEditingCategoryId(item.id)
    const next = { code: item.code, name: item.name, description: item.description ?? '', requiresSalaryPermission: item.requires_salary_permission }
    setDraft(next); setInitialDraft(next); setError(null); setDrawerOpen(true)
  }
  function closeDrawer(): void { setEditingCategoryId(null); setDrawerOpen(false); setDraft(emptyDocumentDraft); setInitialDraft(emptyDocumentDraft) }
  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (savingRef.current || !draft.code.trim() || !draft.name.trim()) return
    savingRef.current = true
    setSaving(true); setError(null)
    try {
      const editingId = editingCategoryId
      const response = await fetch(editingId ? `/api/master-data/document-categories/${editingId}` : '/api/master-data/document-categories', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editingId
          ? { name: draft.name.trim(), description: draft.description.trim() || null, requiresSalaryPermission: draft.requiresSalaryPermission }
          : { code: draft.code.trim(), name: draft.name.trim(), description: draft.description.trim() || null, requiresSalaryPermission: draft.requiresSalaryPermission }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setError(body?.error === 'MASTER_DATA_DUPLICATE' ? labels.duplicate : body?.error === 'MASTER_DATA_INPUT_INVALID' ? labels.invalid : labels.failed ?? labels.deleteFailed)
        return
      }
      closeDrawer(); router.refresh()
    } catch {
      setError(labels.failed ?? labels.deleteFailed)
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }
  async function confirmAction(): Promise<void> {
    if (!confirmation || savingRef.current) return
    savingRef.current = true
    setSaving(true); setError(null)
    try {
      const { action, item } = confirmation
      const response = action === 'delete' ? await fetch(`/api/master-data/document-categories/${item.id}`, { method: 'DELETE' }) : await fetch(`/api/master-data/document-categories/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: !item.is_active }) })
      if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; setError(body?.error === 'DOCUMENT_CATEGORY_IN_USE' ? labels.inUse : labels.deleteFailed); return }
      setConfirmation(null); router.refresh()
    } catch {
      setError(labels.deleteFailed)
    } finally {
      savingRef.current = false; setSaving(false)
    }
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  return <section className="space-y-4"><div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{labels.description}</p><Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button></div>{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}{categories.length === 0 ? <EmptyState title={labels.empty ?? labels.add} /> : <Surface><ul className="divide-y divide-border-subtle">{categories.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4" key={item.id}><div className="min-w-0"><p className="font-semibold">{item.name} <Badge className="ml-2" tone="neutral">{item.code}</Badge>{item.requires_salary_permission ? <Badge className="ml-2" tone="warning">{labels.salarySensitive}</Badge> : null}</p>{item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}</div><RowActions menuLabel={labels.toggle ?? labels.delete} menuItems={[{ id: 'edit', label: labels.edit, icon: <Pencil aria-hidden="true" />, onSelect: () => openEdit(item) }, { id: 'toggle', label: item.is_active ? labels.deactivate : labels.activate, icon: <Power aria-hidden="true" />, onSelect: () => item.is_active ? setConfirmation({ action: 'toggle', item }) : void (async () => { const response = await fetch(`/api/master-data/document-categories/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: true }) }); if (!response.ok) setError(labels.deleteFailed); else router.refresh() })() }, { id: 'delete', label: labels.delete, destructive: true, icon: <Trash2 aria-hidden="true" />, onSelect: () => setConfirmation({ action: 'delete', item }) }]} /></li>)}</ul></Surface>}
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.description} dirty={dirty} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }} onDiscard={closeDrawer} onOpenChange={(open) => { if (!open && !dirty) closeDrawer() }} onSubmit={(event) => void create(event)} open={drawerOpen} saveLabel={editingCategoryId ? labels.save : labels.add} saving={saving} title={editingCategoryId ? labels.edit : labels.add}>{!editingCategoryId ? <FormField control={<TextInput autoCapitalize="none" autoCorrect="off" maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} required value={draft.code} />} label={labels.code} required /> : null}<FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required value={draft.name} />} label={labels.name} required /><FormField control={<Textarea maxLength={1000} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description} />} label={labels.description} /><Checkbox checked={draft.requiresSalaryPermission} label={labels.salarySensitive} onChange={(event) => applyDocumentCategorySalaryPermissionChange(event, setDraft)} />{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</FormDrawer>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={confirmation?.action === 'delete' ? labels.delete : confirmation?.item.is_active ? labels.deactivate : labels.activate} destructive={confirmation?.action === 'delete' || confirmation?.item.is_active === true} description={confirmation?.action === 'delete' ? labels.deleteConfirm : labels.toggleConfirm} onConfirm={() => void confirmAction()} onOpenChange={(open) => { if (!open) setConfirmation(null) }} open={confirmation !== null} pending={saving} title={confirmation?.action === 'delete' ? labels.delete : confirmation?.item.is_active ? labels.deactivate : labels.activate} />
  </section>
}

type RelationDraft = { code: string; nameNl: string; nameEn: string }
const emptyRelationDraft: RelationDraft = { code: '', nameNl: '', nameEn: '' }

export function RelationTypeManager({ relationTypes, labels }: { relationTypes: RelationType[]; labels: Labels }) {
  const router = useRouter()
  const [draft, setDraft] = useState<RelationDraft>(emptyRelationDraft)
  const [initialDraft, setInitialDraft] = useState<RelationDraft>(emptyRelationDraft)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<RelationType | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function openCreate(): void { setDraft(emptyRelationDraft); setInitialDraft(emptyRelationDraft); setError(null); setDrawerOpen(true) }
  function closeDrawer(): void { setDrawerOpen(false); setDraft(emptyRelationDraft); setInitialDraft(emptyRelationDraft) }
  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (!draft.code.trim() || !draft.nameNl.trim() || !draft.nameEn.trim()) return
    setSaving(true); setError(null)
    const response = await fetch('/api/master-data/relation-types', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: draft.code.trim(), nameNl: draft.nameNl.trim(), nameEn: draft.nameEn.trim() }) })
    setSaving(false)
    if (!response.ok) { setError(labels.failed); return }
    closeDrawer(); router.refresh()
  }
  async function toggle(item: RelationType): Promise<void> {
    setSaving(true); setError(null)
    const response = await fetch('/api/master-data/relation-types', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, isActive: !item.is_active }) })
    setSaving(false)
    if (!response.ok) { setError(labels.failed); return }
    setConfirmation(null); router.refresh()
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  return <section className="space-y-4"><div className="flex justify-end"><Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button></div>{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}{relationTypes.length === 0 ? <EmptyState title={labels.empty ?? labels.add} /> : <Surface><ul className="divide-y divide-border-subtle">{relationTypes.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4" key={item.id}><div className="min-w-0"><p className="font-semibold">{item.name_nl} <Badge className="ml-2" tone="neutral">{item.code}</Badge></p><p className="mt-1 text-sm text-muted-foreground">{item.name_en}</p></div><RowActions menuLabel={labels.toggle} menuItems={[{ id: 'toggle', label: item.is_active ? labels.deactivate : labels.activate, icon: <Power aria-hidden="true" />, onSelect: () => item.is_active ? setConfirmation(item) : void toggle(item) }]} /></li>)}</ul></Surface>}
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.description} dirty={dirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeDrawer} onOpenChange={(open) => { if (!open && !dirty) closeDrawer() }} onSubmit={(event) => void create(event)} open={drawerOpen} saveLabel={labels.add} saving={saving} title={labels.add}><FormField control={<TextInput maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} required value={draft.code} />} label={labels.code} required /><FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, nameNl: event.target.value }))} required value={draft.nameNl} />} label={labels.nameNl} required /><FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, nameEn: event.target.value }))} required value={draft.nameEn} />} label={labels.nameEn} required />{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</FormDrawer>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.deactivate} destructive description={labels.failed} onConfirm={() => { if (confirmation) return toggle(confirmation) }} onOpenChange={(open) => { if (!open) setConfirmation(null) }} open={confirmation !== null} pending={saving} title={labels.deactivate} />
  </section>
}
