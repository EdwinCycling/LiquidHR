'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'

export interface FocusProfileRelation {
  id: string
  relationType: string
  isEmergencyContact: boolean
  firstName: string | null
  initials: string | null
  prefix: string | null
  lastName: string
  gender: Gender | null
  birthDate: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  notes: string | null
}

export interface FocusRelationTypeOption {
  code: string
  nameNl: string
  nameEn: string
}

export interface FocusRelationEditorLabels {
  noRelations: string
  add: string
  edit: string
  editTitle: string
  addTitle: string
  relationType: string
  firstName: string
  initials: string
  prefix: string
  lastName: string
  gender: string
  genderMale: string
  genderFemale: string
  genderOther: string
  genderUndisclosed: string
  birthDate: string
  phone: string
  mobile: string
  email: string
  notes: string
  emergencyContact: string
  save: string
  cancel: string
  close: string
  saving: string
  failed: string
  saved: string
  delete: string
  deleteTitle: string
  deleteDescription: string
  deleteConfirm: string
  deleteCancel: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  relationTypeSearch: string
  genderSearch: string
}

interface RelationDraft {
  relationType: string
  isEmergencyContact: boolean
  firstName: string
  initials: string
  prefix: string
  lastName: string
  gender: Gender | ''
  birthDate: string
  phone: string
  mobile: string
  email: string
  notes: string
}

function emptyDraft(relationType: string): RelationDraft {
  return { relationType, isEmergencyContact: false, firstName: '', initials: '', prefix: '', lastName: '', gender: '', birthDate: '', phone: '', mobile: '', email: '', notes: '' }
}

function draftFromRelation(relation: FocusProfileRelation): RelationDraft {
  return { relationType: relation.relationType, isEmergencyContact: relation.isEmergencyContact, firstName: relation.firstName ?? '', initials: relation.initials ?? '', prefix: relation.prefix ?? '', lastName: relation.lastName, gender: relation.gender ?? '', birthDate: relation.birthDate ?? '', phone: relation.phone ?? '', mobile: relation.mobile ?? '', email: relation.email ?? '', notes: relation.notes ?? '' }
}

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

export function FocusRelationManager({ employeeId, actAsToken, canEdit, locale, relations, relationTypes, labels }: { employeeId: string; actAsToken?: string | null; canEdit: boolean; locale: string; relations: FocusProfileRelation[]; relationTypes: FocusRelationTypeOption[]; labels: FocusRelationEditorLabels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [relation, setRelation] = useState<FocusProfileRelation | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<FocusProfileRelation | null>(null)
  const [draft, setDraft] = useState<RelationDraft>(() => emptyDraft(relationTypes[0]?.code ?? 'OTHER'))

  function setField<K extends keyof RelationDraft>(field: K, value: RelationDraft[K]): void {
    setDraft((current) => ({ ...current, [field]: value }))
    setDirty(true)
    setState('idle')
  }

  function openCreate(): void {
    setRelation(null)
    setDraft(emptyDraft(relationTypes[0]?.code ?? 'OTHER'))
    setDirty(false)
    setState('idle')
    setOpen(true)
  }

  function openEdit(nextRelation: FocusProfileRelation): void {
    setRelation(nextRelation)
    setDraft(draftFromRelation(nextRelation))
    setDirty(false)
    setState('idle')
    setOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (state === 'saving' || !draft.relationType || !draft.lastName.trim()) return
    setState('saving')
    const payload = {
      ...draft,
      firstName: nullable(draft.firstName), initials: nullable(draft.initials), prefix: nullable(draft.prefix), lastName: draft.lastName.trim(),
      gender: draft.gender || null, birthDate: nullable(draft.birthDate), phone: nullable(draft.phone), mobile: nullable(draft.mobile), email: nullable(draft.email)?.toLowerCase() ?? null, notes: nullable(draft.notes),
      actAs: actAsToken ?? null,
    }
    try {
      const response = await fetch(`/api/focus/profile/${employeeId}/relations${relation ? `/${relation.id}` : ''}`, { method: relation ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error('FOCUS_RELATION_SAVE_FAILED')
      setDirty(false)
      setOpen(false)
      router.refresh()
    } catch {
      setState('failed')
    }
  }

  async function remove(): Promise<void> {
    if (!deleteCandidate) return
    const candidate = deleteCandidate
    try {
      const response = await fetch(`/api/focus/profile/${employeeId}/relations/${candidate.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actAs: actAsToken ?? null }) })
      if (!response.ok) throw new Error('FOCUS_RELATION_DELETE_FAILED')
      setDeleteCandidate(null)
      router.refresh()
    } catch {
      setDeleteCandidate(null)
      setState('failed')
    }
  }

  const relationTypeLabel = (code: string): string => {
    const option = relationTypes.find((item) => item.code === code)
    return option ? (locale.startsWith('en') ? option.nameEn : option.nameNl) : code
  }

  return <>
    <div className="space-y-3">
      {relations.length ? relations.map((item) => <div className="flex flex-wrap items-start gap-3 border-b border-border-subtle pb-3 last:border-0 last:pb-0" key={item.id}>
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{[item.firstName, item.prefix, item.lastName].filter(Boolean).join(' ')}</p><p className="text-sm text-muted-foreground">{relationTypeLabel(item.relationType)}{item.isEmergencyContact ? ` · ${labels.emergencyContact}` : ''}</p>{item.email || item.mobile || item.phone ? <p className="mt-1 break-words text-sm text-muted-foreground">{item.email ?? item.mobile ?? item.phone}</p> : null}</div>
        {canEdit ? <div className="flex shrink-0 gap-1"><Button aria-label={`${labels.edit}: ${item.lastName}`} onClick={() => openEdit(item)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" /></Button><Button aria-label={`${labels.delete}: ${item.lastName}`} onClick={() => setDeleteCandidate(item)} size="sm" title={labels.delete} type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button></div> : null}
      </div>) : <p className="text-sm text-muted-foreground">{labels.noRelations}</p>}
      {canEdit ? <Button onClick={openCreate} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />{labels.add}</Button> : null}
    </div>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={relation ? labels.editTitle : labels.addTitle} dirty={dirty} dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel }} onDiscard={() => setDirty(false)} onOpenChange={setOpen} onSubmit={(event) => void save(event)} open={open} saveLabel={relation ? labels.edit : labels.save} saving={state === 'saving'} title={relation ? labels.editTitle : labels.addTitle}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={labels.relationType}><DropdownSelect aria-label={labels.relationType} name="relationType" onChange={(event) => setField('relationType', event.currentTarget.value)} searchable searchPlaceholder={labels.relationTypeSearch} value={draft.relationType}>{relationTypes.map((item) => <option key={item.code} value={item.code}>{locale.startsWith('en') ? item.nameEn : item.nameNl}</option>)}</DropdownSelect></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium"><input checked={draft.isEmergencyContact} className="size-4 accent-primary" name="isEmergencyContact" onChange={(event) => setField('isEmergencyContact', event.currentTarget.checked)} type="checkbox" />{labels.emergencyContact}</label>
        <Field label={labels.firstName}><TextInput name="firstName" onChange={(event) => setField('firstName', event.currentTarget.value)} value={draft.firstName} /></Field>
        <Field label={labels.initials}><TextInput name="initials" onChange={(event) => setField('initials', event.currentTarget.value)} value={draft.initials} /></Field>
        <Field label={labels.prefix}><TextInput name="prefix" onChange={(event) => setField('prefix', event.currentTarget.value)} value={draft.prefix} /></Field>
        <Field label={labels.lastName}><TextInput name="lastName" onChange={(event) => setField('lastName', event.currentTarget.value)} required value={draft.lastName} /></Field>
        <Field label={labels.gender}><DropdownSelect aria-label={labels.gender} name="gender" onChange={(event) => setField('gender', event.currentTarget.value as Gender | '')} searchable searchPlaceholder={labels.genderSearch} value={draft.gender}><option value="">—</option><option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option><option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option></DropdownSelect></Field>
        <Field label={labels.birthDate}><TextInput name="birthDate" onChange={(event) => setField('birthDate', event.currentTarget.value)} type="date" value={draft.birthDate} /></Field>
        <Field label={labels.mobile}><TextInput name="mobile" onChange={(event) => setField('mobile', event.currentTarget.value)} type="tel" value={draft.mobile} /></Field>
        <Field label={labels.phone}><TextInput name="phone" onChange={(event) => setField('phone', event.currentTarget.value)} type="tel" value={draft.phone} /></Field>
        <Field label={labels.email}><TextInput name="email" onChange={(event) => setField('email', event.currentTarget.value)} type="email" value={draft.email} /></Field>
        <Field label={labels.notes}><textarea className="min-h-24 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50" name="notes" onChange={(event) => setField('notes', event.currentTarget.value)} rows={3} value={draft.notes} /></Field>
      </div>
      {state === 'failed' ? <p aria-live="assertive" className="text-sm text-destructive">{labels.failed}</p> : null}
    </FormDrawer>
    <ConfirmDialog cancelLabel={labels.deleteCancel} confirmLabel={labels.deleteConfirm} description={labels.deleteDescription} destructive onConfirm={() => void remove()} onOpenChange={(nextOpen) => { if (!nextOpen) setDeleteCandidate(null) }} open={Boolean(deleteCandidate)} title={labels.deleteTitle} />
  </>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium text-foreground">{label}{children}</label>
}
