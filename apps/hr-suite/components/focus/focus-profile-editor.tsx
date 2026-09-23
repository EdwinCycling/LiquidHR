'use client'

import { Pencil } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'

type NameUsage = 'BIRTH_NAME' | 'PARTNER_NAME' | 'PARTNER_BEFORE_BIRTH_NAME' | 'BIRTH_NAME_BEFORE_PARTNER_NAME'

export interface FocusProfileEditorValues {
  title: string | null
  initials: string | null
  firstName: string
  birthNamePrefix: string | null
  birthName: string
  partnerNamePrefix: string | null
  partnerName: string | null
  nameUsage: NameUsage
  privateEmail: string | null
  privatePhone: string | null
  privateMobile: string | null
}

export interface FocusProfileEditorLabels {
  edit: string
  editTitle: string
  nameSection: string
  contactSection: string
  title: string
  initials: string
  firstName: string
  birthNamePrefix: string
  birthName: string
  partnerNamePrefix: string
  partnerName: string
  nameUsage: string
  nameUsageBirth: string
  nameUsagePartner: string
  nameUsagePartnerBirth: string
  nameUsageBirthPartner: string
  privateEmail: string
  privatePhone: string
  privateMobile: string
  save: string
  cancel: string
  close: string
  saving: string
  saved: string
  failed: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
}

interface EmployeeUpdateResponse {
  data?: { updatedAt?: unknown }
}

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function updatedAtFromResponse(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return null
  const data = (payload as EmployeeUpdateResponse).data
  return typeof data?.updatedAt === 'string' ? data.updatedAt : null
}

export function FocusProfileEditor({ employeeId, actAsToken, initialValues, initialUpdatedAt, labels }: { employeeId: string; actAsToken?: string | null; initialValues: FocusProfileEditorValues; initialUpdatedAt: string; labels: FocusProfileEditorLabels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [draft, setDraft] = useState<FocusProfileEditorValues>(initialValues)

  function setField<K extends keyof FocusProfileEditorValues>(field: K, value: FocusProfileEditorValues[K]): void {
    setDraft((current) => ({ ...current, [field]: value }))
    setDirty(true)
    setState('idle')
  }

  function openEditor(): void {
    setDraft(initialValues)
    setDirty(false)
    setState('idle')
    setOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (state === 'saving' || !draft.firstName.trim() || !draft.birthName.trim()) return
    setState('saving')
    try {
      const response = await fetch(`/api/focus/profile/${employeeId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          title: nullable(draft.title ?? ''),
          initials: nullable(draft.initials ?? ''),
          firstName: draft.firstName.trim(),
          birthNamePrefix: nullable(draft.birthNamePrefix ?? ''),
          birthName: draft.birthName.trim(),
          partnerNamePrefix: nullable(draft.partnerNamePrefix ?? ''),
          partnerName: nullable(draft.partnerName ?? ''),
          privateEmail: nullable(draft.privateEmail ?? '')?.toLowerCase() ?? null,
          privatePhone: nullable(draft.privatePhone ?? ''),
          privateMobile: nullable(draft.privateMobile ?? ''),
          updatedAt,
          actAs: actAsToken ?? null,
        }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error('FOCUS_PROFILE_UPDATE_FAILED')
      const nextUpdatedAt = updatedAtFromResponse(payload)
      if (nextUpdatedAt) setUpdatedAt(nextUpdatedAt)
      setDirty(false)
      setState('saved')
      setOpen(false)
      router.refresh()
    } catch {
      setState('failed')
    }
  }

  return <>
    <div className="flex flex-wrap items-center gap-2">
      {state === 'saved' ? <span aria-live="polite" className="text-xs text-success">{labels.saved}</span> : null}
      <Button aria-label={labels.edit} onClick={openEditor} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>
    </div>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.editTitle} dirty={dirty} dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel }} onDiscard={() => setDirty(false)} onOpenChange={setOpen} onSubmit={(event) => void save(event)} open={open} saveLabel={labels.save} saving={state === 'saving'} title={labels.editTitle}>
      <section className="grid gap-3" aria-labelledby="focus-profile-name-fields">
        <h3 className="font-semibold" id="focus-profile-name-fields">{labels.nameSection}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.title}><TextInput name="title" onChange={(event) => setField('title', event.currentTarget.value)} value={draft.title ?? ''} /></Field>
          <Field label={labels.initials}><TextInput name="initials" onChange={(event) => setField('initials', event.currentTarget.value)} value={draft.initials ?? ''} /></Field>
          <Field label={labels.firstName}><TextInput name="firstName" onChange={(event) => setField('firstName', event.currentTarget.value)} required value={draft.firstName} /></Field>
          <Field label={labels.birthNamePrefix}><TextInput name="birthNamePrefix" onChange={(event) => setField('birthNamePrefix', event.currentTarget.value)} value={draft.birthNamePrefix ?? ''} /></Field>
          <Field label={labels.birthName}><TextInput name="birthName" onChange={(event) => setField('birthName', event.currentTarget.value)} required value={draft.birthName} /></Field>
          <Field label={labels.partnerNamePrefix}><TextInput name="partnerNamePrefix" onChange={(event) => setField('partnerNamePrefix', event.currentTarget.value)} value={draft.partnerNamePrefix ?? ''} /></Field>
          <Field label={labels.partnerName}><TextInput name="partnerName" onChange={(event) => setField('partnerName', event.currentTarget.value)} value={draft.partnerName ?? ''} /></Field>
          <Field label={labels.nameUsage}>
            <DropdownSelect aria-label={labels.nameUsage} name="nameUsage" onChange={(event) => setField('nameUsage', event.currentTarget.value as NameUsage)} searchable value={draft.nameUsage} searchPlaceholder={labels.nameUsage}>
              <option value="BIRTH_NAME">{labels.nameUsageBirth}</option>
              <option value="PARTNER_NAME">{labels.nameUsagePartner}</option>
              <option value="PARTNER_BEFORE_BIRTH_NAME">{labels.nameUsagePartnerBirth}</option>
              <option value="BIRTH_NAME_BEFORE_PARTNER_NAME">{labels.nameUsageBirthPartner}</option>
            </DropdownSelect>
          </Field>
        </div>
      </section>
      <section className="grid gap-3 border-t border-border-subtle pt-4" aria-labelledby="focus-profile-private-fields">
        <h3 className="font-semibold" id="focus-profile-private-fields">{labels.contactSection}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.privateEmail}><TextInput name="privateEmail" onChange={(event) => setField('privateEmail', event.currentTarget.value)} type="email" value={draft.privateEmail ?? ''} /></Field>
          <Field label={labels.privatePhone}><TextInput name="privatePhone" onChange={(event) => setField('privatePhone', event.currentTarget.value)} type="tel" value={draft.privatePhone ?? ''} /></Field>
          <Field label={labels.privateMobile}><TextInput name="privateMobile" onChange={(event) => setField('privateMobile', event.currentTarget.value)} type="tel" value={draft.privateMobile ?? ''} /></Field>
        </div>
      </section>
      {state === 'failed' ? <p aria-live="assertive" className="text-sm text-destructive">{labels.failed}</p> : null}
    </FormDrawer>
  </>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium text-foreground">{label}{children}</label>
}
