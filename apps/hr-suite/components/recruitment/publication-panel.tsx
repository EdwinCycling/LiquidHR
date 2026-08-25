'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import { ActionMenu } from '@/components/ui/action-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { createVacancySlug, type PublicationStatus, type VacancyStatus } from '@/lib/recruitment/vacancy-service'

export type PublicationPanelLabels = {
  readonly title: string
  readonly statusDraft: string
  readonly statusOpen: string
  readonly statusClosed: string
  readonly statusArchived: string
  readonly publish: string
  readonly close: string
  readonly reopen: string
  readonly archive: string
  readonly formTitle: string
  readonly phone: string
  readonly cv: string
  readonly motivation: string
  readonly hidden: string
  readonly optional: string
  readonly required: string
  readonly save: string
  readonly slug: string
  readonly publicLink: string
  readonly error: string
  readonly closeLabel: string
  readonly discardTitle: string
  readonly discardDescription: string
  readonly discardConfirm: string
  readonly discardCancel: string
  readonly confirmCloseTitle: string
  readonly confirmCloseDescription: string
  readonly confirmArchiveTitle: string
  readonly confirmArchiveDescription: string
  readonly confirm: string
}

type PublicationField = 'HIDDEN' | 'OPTIONAL' | 'REQUIRED'
type PublicationDraft = { readonly slug: string; readonly phone: PublicationField; readonly cv: PublicationField; readonly motivation: PublicationField }

function valueFromConfig(config: Record<string, unknown>, key: string): PublicationField {
  const value = config[key]
  return value === 'HIDDEN' || value === 'OPTIONAL' || value === 'REQUIRED' ? value : 'OPTIONAL'
}

function draftFromPublication(vacancyTitle: string, publication: VacancyDetailPublicationPanelProps['publication']): PublicationDraft {
  const payload = publication?.payload
  const formConfig = typeof payload?.formConfig === 'object' && payload.formConfig !== null ? payload.formConfig as Record<string, unknown> : {}
  return {
    slug: publication?.slug ?? createVacancySlug(vacancyTitle),
    phone: valueFromConfig(formConfig, 'phone'),
    cv: valueFromConfig(formConfig, 'cv'),
    motivation: valueFromConfig(formConfig, 'motivation'),
  }
}
type PublicationSection = { readonly sectionType: string; readonly title: string; readonly content: string; readonly sortOrder: number; readonly isVisible: boolean }
type FieldValue = 'HIDDEN' | 'OPTIONAL' | 'REQUIRED'

interface VacancyDetailPublicationPanelProps {
  readonly canPublish: boolean
  readonly vacancyId: string
  readonly vacancyTitle: string
  readonly sections: readonly { readonly title: string; readonly content: string; readonly isVisible: boolean }[]
  readonly publication: { readonly id: string; readonly slug: string; readonly status: PublicationStatus; readonly payload: Record<string, unknown> } | null
  readonly labels: PublicationPanelLabels
}

export function VacancyPublicationPanel({ canPublish, labels, publication, sections, vacancyId, vacancyTitle }: VacancyDetailPublicationPanelProps): ReactElement {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<PublicationDraft>(() => draftFromPublication(vacancyTitle, publication))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<PublicationStatus | null>(null)
  const savedDraft = useMemo(() => draftFromPublication(vacancyTitle, publication), [publication, vacancyTitle])
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft)
  const status = publication?.status ?? 'DRAFT'

  function statusLabel(): string {
    if (status === 'OPEN') return labels.statusOpen
    if (status === 'CLOSED') return labels.statusClosed
    if (status === 'ARCHIVED') return labels.statusArchived
    return labels.statusDraft
  }

  function buildPayload(current: PublicationDraft): Record<string, unknown> {
    return {
      companyName: 'LiquidHR',
      formConfig: { cv: current.cv, motivation: current.motivation, phone: current.phone },
      sections,
    }
  }

  async function update(statusToSet: PublicationStatus, current = draft): Promise<boolean> {
    if (saving) return false
    setSaving(true)
    const response = await fetch(`/api/recruitment/vacancies/${vacancyId}/publication`, {
      body: JSON.stringify({ payload: buildPayload(current), slug: current.slug, status: statusToSet }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    }).catch(() => null)
    if (!response?.ok) {
      setFeedback(true)
      setSaving(false)
      return false
    }
    setFeedback(false)
    setSaving(false)
    router.refresh()
    return true
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const targetStatus: PublicationStatus = publication?.status === 'OPEN' ? 'OPEN' : publication?.status === 'CLOSED' ? 'CLOSED' : 'OPEN'
    if (await update(targetStatus)) setEditorOpen(false)
  }

  async function confirmMutation(): Promise<void> {
    const target = confirmStatus
    if (target && await update(target)) setConfirmStatus(null)
  }

  const actionItems = publication?.status === 'OPEN'
    ? [
      { id: 'close', label: labels.close, onSelect: () => setConfirmStatus('CLOSED') },
      { destructive: true, id: 'archive', label: labels.archive, onSelect: () => setConfirmStatus('ARCHIVED') },
    ]
    : publication?.status === 'CLOSED'
      ? [
        { id: 'reopen', label: labels.reopen, onSelect: () => void update('OPEN') },
        { destructive: true, id: 'archive', label: labels.archive, onSelect: () => setConfirmStatus('ARCHIVED') },
      ]
      : []

  return (
    <>
      <Surface className="p-5">
        <SectionHeader
          actions={canPublish ? <div className="flex flex-wrap items-center gap-2">
            {!publication ? <Button disabled={saving} loading={saving} onClick={() => void update('OPEN')} size="sm" type="button">{labels.publish}</Button> : null}
            {publication && actionItems.length > 0 ? <ActionMenu items={actionItems} label={labels.title} /> : null}
          </div> : undefined}
          title={labels.title}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone={status === 'OPEN' ? 'success' : status === 'CLOSED' ? 'warning' : status === 'ARCHIVED' ? 'neutral' : 'info'}>{statusLabel()}</Badge>{feedback ? <span className="text-sm text-destructive" role="alert">{labels.error}</span> : null}</div>
        {canPublish && status !== 'ARCHIVED' ? <Button className="mt-4" onClick={() => { setDraft(savedDraft); setEditorOpen(true) }} size="sm" type="button" variant="secondary">{labels.formTitle}</Button> : null}
        {publication?.status === 'OPEN' ? <Link className="mt-4 inline-flex min-w-0 items-center gap-2 break-all text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/vacancies/${publication.id}/${publication.slug}`} target="_blank"><ExternalLink aria-hidden="true" className="size-4 shrink-0" />{labels.publicLink}</Link> : null}
      </Surface>

      {canPublish && status !== 'ARCHIVED' ? <FormDrawer
        cancelLabel={labels.closeLabel}
        closeLabel={labels.closeLabel}
        description={labels.formTitle}
        dirty={dirty}
        dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
        onDiscard={() => { setDraft(savedDraft); setFeedback(false) }}
        onOpenChange={(open) => { if (!open) setEditorOpen(false) }}
        onSubmit={(event) => void saveSettings(event)}
        open={editorOpen}
        saveLabel={labels.save}
        saving={saving}
        title={labels.formTitle}
      >
        <FormField control={<TextInput onChange={(event) => { setDraft((current) => ({ ...current, slug: event.target.value })); setFeedback(false) }} value={draft.slug} />} label={labels.slug} required />
        <div className="grid gap-4 sm:grid-cols-3">
          {([[labels.phone, 'phone'], [labels.cv, 'cv'], [labels.motivation, 'motivation']] as const).map(([label, key]) => (
            <FormField control={<DropdownSelect onChange={(event) => { const value = event.target.value as PublicationField; setDraft((current) => ({ ...current, [key]: value })); setFeedback(false) }} value={draft[key]}><option value="HIDDEN">{labels.hidden}</option><option value="OPTIONAL">{labels.optional}</option><option value="REQUIRED">{labels.required}</option></DropdownSelect>} key={key} label={label} />
          ))}
        </div>
      </FormDrawer> : null}

      <ConfirmDialog
        cancelLabel={labels.closeLabel}
        confirmLabel={labels.confirm}
        description={confirmStatus === 'ARCHIVED' ? labels.confirmArchiveDescription : labels.confirmCloseDescription}
        destructive={confirmStatus === 'ARCHIVED'}
        onConfirm={() => void confirmMutation()}
        onOpenChange={(open) => { if (!open && !saving) setConfirmStatus(null) }}
        open={confirmStatus !== null}
        pending={saving}
        title={confirmStatus === 'ARCHIVED' ? labels.confirmArchiveTitle : labels.confirmCloseTitle}
      />
    </>
  )
}

interface PublicationPanelProps {
  readonly vacancyId: string
  readonly vacancyStatus: VacancyStatus
  readonly vacancyTitle: string
  readonly sections: readonly PublicationSection[]
  readonly publication: { readonly id: string; readonly slug: string; readonly status: PublicationStatus; readonly payload: Record<string, unknown> } | null
  readonly labels: {
    readonly title: string; readonly description: string; readonly status: string; readonly draft: string; readonly active: string; readonly closed: string; readonly archived: string
    readonly previewTitle: string; readonly previewDescription: string; readonly emptySection: string; readonly formTitle: string; readonly phone: string; readonly cv: string; readonly motivation: string
    readonly hidden: string; readonly optional: string; readonly required: string; readonly slug: string; readonly save: string; readonly saving: string; readonly saved: string; readonly openConfigurationNotice: string; readonly configurationRequiresPublication: string
    readonly actionsTitle: string; readonly actionsDescription: string; readonly publish: string; readonly close: string; readonly archive: string; readonly publicLink: string; readonly archivedNotice: string; readonly error: string
    readonly confirmPublishTitle: string; readonly confirmPublishDescription: string; readonly confirmCloseTitle: string; readonly confirmCloseDescription: string; readonly confirmArchiveTitle: string; readonly confirmArchiveDescription: string; readonly confirm: string; readonly cancel: string
  }
}

function fieldValue(payload: Record<string, unknown> | null, field: 'phone' | 'cv' | 'motivation'): FieldValue {
  const config = payload?.formConfig
  if (typeof config !== 'object' || config === null) return 'OPTIONAL'
  const value = (config as Record<string, unknown>)[field]
  return value === 'HIDDEN' || value === 'REQUIRED' ? value : 'OPTIONAL'
}

export function PublicationPanel({ labels, publication, sections, vacancyId, vacancyStatus, vacancyTitle }: PublicationPanelProps): ReactElement {
  const router = useRouter()
  const initialPayload = publication?.payload ?? null
  const [state, setState] = useState<'IDLE' | 'SAVING' | 'ERROR'>('IDLE')
  const [slug, setSlug] = useState(publication?.slug ?? createVacancySlug(vacancyTitle))
  const [phone, setPhone] = useState<FieldValue>(fieldValue(initialPayload, 'phone'))
  const [cv, setCv] = useState<FieldValue>(fieldValue(initialPayload, 'cv'))
  const [motivation, setMotivation] = useState<FieldValue>(fieldValue(initialPayload, 'motivation'))
  const [pendingAction, setPendingAction] = useState<PublicationStatus | null>(null)
  const isArchived = vacancyStatus === 'ARCHIVED'
  const isSaving = state === 'SAVING'
  const status = publication?.status ?? 'DRAFT'
  const statusLabel = status === 'OPEN' ? labels.active : status === 'CLOSED' ? labels.closed : status === 'ARCHIVED' ? labels.archived : labels.draft
  const choices = [[labels.hidden, 'HIDDEN'], [labels.optional, 'OPTIONAL'], [labels.required, 'REQUIRED']] as const

  async function update(requestedStatus: PublicationStatus): Promise<boolean> {
    setState('SAVING')
    const response = await fetch(`/api/recruitment/vacancies/${vacancyId}/publication`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: requestedStatus, slug: slug.trim(), payload: { companyName: 'LiquidHR', sections, formConfig: { phone, cv, motivation } } }) }).catch(() => null)
    if (!response?.ok) { setState('ERROR'); return false }
    setState('IDLE')
    router.refresh()
    return true
  }

  async function confirmAction(): Promise<void> {
    if (!pendingAction) return
    const confirmed = await update(pendingAction)
    if (confirmed) setPendingAction(null)
  }

  const actionDialog = pendingAction === 'OPEN'
    ? { title: labels.confirmPublishTitle, description: labels.confirmPublishDescription }
    : pendingAction === 'CLOSED'
      ? { title: labels.confirmCloseTitle, description: labels.confirmCloseDescription }
      : { title: labels.confirmArchiveTitle, description: labels.confirmArchiveDescription }

  return <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div className="min-w-0 space-y-6">
      <Surface className="p-5 sm:p-6">
        <SectionHeader description={labels.previewDescription} title={labels.previewTitle} />
        <div className="mt-5 space-y-5">
          {sections.filter((section) => section.isVisible).map((section) => <article className="border-b border-border-subtle pb-5 last:border-b-0 last:pb-0" key={section.sectionType}><h3 className="font-semibold text-foreground">{section.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{section.content.trim() || labels.emptySection}</p></article>)}
        </div>
      </Surface>
      <Surface className="p-5 sm:p-6">
        <SectionHeader description={labels.description} title={labels.title} />
        <div className="mt-5 space-y-5">
          <div><label className="text-sm font-medium" htmlFor="publication-slug">{labels.slug}</label><TextInput disabled={isArchived || isSaving || status === 'OPEN'} id="publication-slug" onChange={(event) => setSlug(event.target.value)} value={slug} /></div>
          <div><h3 className="font-semibold text-foreground">{labels.formTitle}</h3><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-3">{([[labels.phone, phone, setPhone, 'publication-phone'], [labels.cv, cv, setCv, 'publication-cv'], [labels.motivation, motivation, setMotivation, 'publication-motivation']] as const).map(([label, value, setter, id]) => <div className="min-w-0" key={id}><label className="text-sm font-medium" htmlFor={id}>{label}</label><DropdownSelect aria-label={label} className="mt-2" disabled={isArchived || isSaving || status === 'OPEN'} id={id} onChange={(event) => setter(event.target.value as FieldValue)} value={value}>{choices.map(([choiceLabel, choiceValue]) => <option key={choiceValue} value={choiceValue}>{choiceLabel}</option>)}</DropdownSelect></div>)}</div></div>
          {status === 'OPEN' ? <p className="text-sm text-muted-foreground">{labels.openConfigurationNotice}</p> : null}
          {!publication ? <p className="text-sm text-muted-foreground">{labels.configurationRequiresPublication}</p> : null}
          <div className="flex flex-wrap items-center gap-3"><Button disabled={isArchived || isSaving || status === 'OPEN' || !publication} loading={isSaving} onClick={() => void update('CLOSED')} type="button">{labels.save}</Button>{state === 'IDLE' && publication ? <span className="text-sm text-success" role="status">{labels.saved}</span> : null}{state === 'ERROR' ? <p className="text-sm text-destructive" role="alert">{labels.error}</p> : null}</div>
        </div>
      </Surface>
    </div>
    <aside className="min-w-0 space-y-6">
      <Surface className="p-5 sm:p-6" variant="subtle">
        <SectionHeader description={labels.actionsDescription} title={labels.actionsTitle} />
        <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-[var(--radius-control)] border border-border px-3 py-1 text-sm font-medium">{labels.status}: {statusLabel}</span></div>
        {isArchived ? <p className="mt-4 text-sm text-muted-foreground">{labels.archivedNotice}</p> : null}
        <div className="mt-5 flex flex-col gap-2">{status !== 'OPEN' ? <Button disabled={isArchived || isSaving} onClick={() => setPendingAction('OPEN')} type="button">{labels.publish}</Button> : <Button disabled={isSaving} onClick={() => setPendingAction('CLOSED')} type="button" variant="secondary">{labels.close}</Button>}{publication && status !== 'ARCHIVED' ? <Button disabled={isSaving} onClick={() => setPendingAction('ARCHIVED')} type="button" variant="danger">{labels.archive}</Button> : null}{publication?.status === 'OPEN' ? <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/vacancies/${publication.id}/${publication.slug}`} rel="noreferrer" target="_blank">{labels.publicLink}</Link> : null}</div>
      </Surface>
    </aside>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.confirm} description={actionDialog.description} destructive={pendingAction === 'ARCHIVED'} onConfirm={() => void confirmAction()} onOpenChange={(open) => { if (!open && state !== 'SAVING') setPendingAction(null) }} open={pendingAction !== null} title={actionDialog.title} />
  </div>
}
