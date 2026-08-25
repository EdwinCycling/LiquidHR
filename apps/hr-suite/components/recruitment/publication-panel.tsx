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
import { createVacancySlug } from '@/lib/recruitment/vacancy-service'

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

type PublicationStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED'
type PublicationField = 'HIDDEN' | 'OPTIONAL' | 'REQUIRED'
type PublicationDraft = { readonly slug: string; readonly phone: PublicationField; readonly cv: PublicationField; readonly motivation: PublicationField }

function valueFromConfig(config: Record<string, unknown>, key: string): PublicationField {
  const value = config[key]
  return value === 'HIDDEN' || value === 'OPTIONAL' || value === 'REQUIRED' ? value : 'OPTIONAL'
}

function draftFromPublication(vacancyTitle: string, publication: PublicationPanelProps['publication']): PublicationDraft {
  const payload = publication?.payload
  const formConfig = typeof payload?.formConfig === 'object' && payload.formConfig !== null ? payload.formConfig as Record<string, unknown> : {}
  return {
    slug: publication?.slug ?? createVacancySlug(vacancyTitle),
    phone: valueFromConfig(formConfig, 'phone'),
    cv: valueFromConfig(formConfig, 'cv'),
    motivation: valueFromConfig(formConfig, 'motivation'),
  }
}

interface PublicationPanelProps {
  readonly canPublish: boolean
  readonly vacancyId: string
  readonly vacancyTitle: string
  readonly sections: readonly { readonly title: string; readonly content: string; readonly isVisible: boolean }[]
  readonly publication: { readonly id: string; readonly slug: string; readonly status: PublicationStatus; readonly payload: Record<string, unknown> } | null
  readonly labels: PublicationPanelLabels
}

export function PublicationPanel({ canPublish, labels, publication, sections, vacancyId, vacancyTitle }: PublicationPanelProps): ReactElement {
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
