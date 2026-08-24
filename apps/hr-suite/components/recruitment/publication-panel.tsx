'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { SectionHeader } from '@/components/patterns/section-header'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { createVacancySlug, type PublicationStatus, type VacancyStatus } from '@/lib/recruitment/vacancy-service'

type PublicationSection = { readonly sectionType: string; readonly title: string; readonly content: string; readonly sortOrder: number; readonly isVisible: boolean }
type FieldValue = 'HIDDEN' | 'OPTIONAL' | 'REQUIRED'

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
