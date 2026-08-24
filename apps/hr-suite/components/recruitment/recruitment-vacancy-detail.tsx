'use client'

import Link from 'next/link'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { DetailColumns } from '@/components/layout/detail-columns'
import { PageShell } from '@/components/layout/page-shell'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { InfoList } from '@/components/patterns/info-list'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { ApplicationCard } from '@/lib/recruitment/application-service'
import { vacancyInputSchema, type VacancyDetail, type VacancyInput } from '@/lib/recruitment/vacancy-service'
import { ManualApplicationForm } from './manual-application-form'
import { PipelineBoard } from './pipeline-board'
import { PublicationPanel, type PublicationPanelLabels } from './publication-panel'

type WorkMode = NonNullable<VacancyInput['workMode']>

type VacancyDetailLabels = {
  readonly eyebrow: string
  readonly back: string
  readonly edit: string
  readonly status: string
  readonly statusDraft: string
  readonly statusActive: string
  readonly statusClosed: string
  readonly statusArchived: string
  readonly updatedAt: string
  readonly version: string
  readonly vacancyData: string
  readonly title: string
  readonly location: string
  readonly workMode: string
  readonly onSite: string
  readonly hybrid: string
  readonly remote: string
  readonly hours: string
  readonly salary: string
  readonly salaryVisible: string
  readonly salaryHidden: string
  readonly content: string
  readonly emptyContent: string
  readonly applications: string
  readonly noCandidateAccess: string
  readonly invalid: string
  readonly conflict: string
  readonly error: string
  readonly saved: string
  readonly close: string
  readonly sectionTitle: string
  readonly sectionContent: string
  readonly sectionVisible: string
  readonly sectionHint: string
  readonly save: string
  readonly saving: string
  readonly discardTitle: string
  readonly discardDescription: string
  readonly discardConfirm: string
  readonly discardCancel: string
  readonly pipeline: {
    readonly title: string
    readonly allStages: string
    readonly empty: string
    readonly candidate: string
    readonly stage: string
    readonly source: string
    readonly possibleDuplicate: string
    readonly move: string
    readonly reject: string
    readonly reopen: string
    readonly hire: string
  }
  readonly manual: {
    readonly title: string
    readonly firstName: string
    readonly lastName: string
    readonly email: string
    readonly phone: string
    readonly motivation: string
    readonly save: string
    readonly saving: string
    readonly saved: string
    readonly error: string
  }
  readonly publication: PublicationPanelLabels
}

type Draft = {
  title: string
  locationLabel: string
  workMode: '' | WorkMode
  minHours: string
  maxHours: string
  salaryMin: string
  salaryMax: string
  salaryVisible: boolean
  sections: VacancyInput['sections']
}

type Feedback = 'invalid' | 'conflict' | 'error' | null

function toDraft(vacancy: VacancyDetail): Draft {
  return {
    title: vacancy.title,
    locationLabel: vacancy.locationLabel ?? '',
    workMode: vacancy.workMode ?? '',
    minHours: vacancy.minHours?.toString() ?? '',
    maxHours: vacancy.maxHours?.toString() ?? '',
    salaryMin: vacancy.salaryMin?.toString() ?? '',
    salaryMax: vacancy.salaryMax?.toString() ?? '',
    salaryVisible: vacancy.salaryVisible,
    sections: vacancy.sections,
  }
}

function toInput(draft: Draft, jobId: string | null): unknown {
  return {
    title: draft.title,
    jobId,
    locationLabel: draft.locationLabel,
    workMode: draft.workMode || null,
    minHours: draft.minHours ? Number(draft.minHours) : null,
    maxHours: draft.maxHours ? Number(draft.maxHours) : null,
    salaryMin: draft.salaryMin ? Number(draft.salaryMin) : null,
    salaryMax: draft.salaryMax ? Number(draft.salaryMax) : null,
    salaryVisible: draft.salaryVisible,
    sections: draft.sections,
  }
}

function statusLabel(vacancy: VacancyDetail, labels: VacancyDetailLabels): string {
  if (vacancy.status === 'DRAFT') return labels.statusDraft
  if (vacancy.status === 'ACTIVE') return labels.statusActive
  if (vacancy.status === 'CLOSED') return labels.statusClosed
  return labels.statusArchived
}

function statusTone(status: VacancyDetail['status']): BadgeTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'CLOSED') return 'warning'
  if (status === 'ARCHIVED') return 'neutral'
  return 'info'
}

function formatMoney(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat(undefined, { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' }).format(value)
}

function VacancyEditorDrawer({
  labels,
  onClose,
  onSaved,
  open,
  vacancy,
}: {
  readonly labels: VacancyDetailLabels
  readonly onClose: () => void
  readonly onSaved: () => void
  readonly open: boolean
  readonly vacancy: VacancyDetail
}): ReactElement {
  const [draft, setDraft] = useState<Draft>(() => toDraft(vacancy))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const initialDraft = useMemo(() => toDraft(vacancy), [vacancy])
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)

  function updateDraft(changes: Partial<Draft>): void {
    setDraft((current) => ({ ...current, ...changes }))
    setFeedback(null)
  }

  function updateSection(index: number, changes: Partial<VacancyInput['sections'][number]>): void {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...changes } : section),
    }))
    setFeedback(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving) return
    const parsed = vacancyInputSchema.safeParse(toInput(draft, vacancy.jobId))
    if (!parsed.success) {
      setFeedback('invalid')
      return
    }

    setSaving(true)
    const response = await fetch(`/api/recruitment/vacancies/${vacancy.id}`, {
      body: JSON.stringify({ expectedVersion: vacancy.version, input: parsed.data }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    }).catch(() => null)

    if (!response?.ok) {
      setFeedback(response?.status === 409 ? 'conflict' : response?.status === 400 ? 'invalid' : 'error')
      setSaving(false)
      return
    }

    setSaving(false)
    onClose()
    onSaved()
  }

  const feedbackText = feedback === 'invalid' ? labels.invalid : feedback === 'conflict' ? labels.conflict : feedback === 'error' ? labels.error : null

  return (
    <FormDrawer
      cancelLabel={labels.close}
      closeLabel={labels.close}
      description={labels.sectionHint}
      dirty={dirty}
      dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
      onDiscard={() => { setDraft(toDraft(vacancy)); setFeedback(null) }}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}
      onSubmit={(event) => void submit(event)}
      open={open}
      saveLabel={labels.save}
      saving={saving}
      title={labels.edit}
    >
      {feedbackText ? <p aria-live="polite" className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{feedbackText}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField className="sm:col-span-2" control={<TextInput onChange={(event) => updateDraft({ title: event.target.value })} value={draft.title} />} label={labels.title} required />
        <FormField control={<TextInput onChange={(event) => updateDraft({ locationLabel: event.target.value })} value={draft.locationLabel} />} label={labels.location} />
        <FormField
          control={<DropdownSelect onChange={(event) => updateDraft({ workMode: event.target.value as Draft['workMode'] })} value={draft.workMode}>
            <option value="">—</option>
            <option value="ON_SITE">{labels.onSite}</option>
            <option value="HYBRID">{labels.hybrid}</option>
            <option value="REMOTE">{labels.remote}</option>
          </DropdownSelect>}
          label={labels.workMode}
        />
        <div className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-foreground">{labels.hours}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput aria-label={`${labels.hours} min`} max="168" min="0" onChange={(event) => updateDraft({ minHours: event.target.value })} type="number" value={draft.minHours} />
            <TextInput aria-label={`${labels.hours} max`} max="168" min="0" onChange={(event) => updateDraft({ maxHours: event.target.value })} type="number" value={draft.maxHours} />
          </div>
        </div>
        <div className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-foreground">{labels.salary}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput aria-label={`${labels.salary} min`} min="0" onChange={(event) => updateDraft({ salaryMin: event.target.value })} type="number" value={draft.salaryMin} />
            <TextInput aria-label={`${labels.salary} max`} min="0" onChange={(event) => updateDraft({ salaryMax: event.target.value })} type="number" value={draft.salaryMax} />
          </div>
        </div>
      </div>
      <Checkbox checked={draft.salaryVisible} label={labels.salaryVisible} onChange={(event) => updateDraft({ salaryVisible: event.target.checked })} />
      <div className="grid gap-3 border-t border-border-subtle pt-4">
        <div>
          <h3 className="font-semibold text-foreground">{labels.content}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{labels.sectionHint}</p>
        </div>
        {draft.sections.map((section, index) => (
          <Surface className="grid gap-4 p-4" key={section.sectionType} variant="subtle">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <FormField control={<TextInput onChange={(event) => updateSection(index, { title: event.target.value })} value={section.title} />} label={labels.sectionTitle} required />
              <Checkbox checked={section.isVisible} label={labels.sectionVisible} onChange={(event) => updateSection(index, { isVisible: event.target.checked })} />
            </div>
            <FormField control={<Textarea onChange={(event) => updateSection(index, { content: event.target.value })} value={section.content} />} label={labels.sectionContent} />
          </Surface>
        ))}
      </div>
    </FormDrawer>
  )
}

export function RecruitmentVacancyDetail({ applications, canManageApplications, canPublish, canWrite, labels, vacancy }: {
  readonly applications: readonly ApplicationCard[]
  readonly canManageApplications: boolean
  readonly canPublish: boolean
  readonly canWrite: boolean
  readonly labels: VacancyDetailLabels
  readonly vacancy: VacancyDetail
}): ReactElement {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const workMode = vacancy.workMode === 'ON_SITE' ? labels.onSite : vacancy.workMode === 'HYBRID' ? labels.hybrid : vacancy.workMode === 'REMOTE' ? labels.remote : '—'
  const salary = vacancy.salaryVisible ? `${formatMoney(vacancy.salaryMin)} – ${formatMoney(vacancy.salaryMax)}` : labels.salaryHidden
  const status = statusLabel(vacancy, labels)

  return (
    <PageShell className="space-y-6 py-6 lg:py-8" width="wide">
      <PageHeader
        actions={<div className="flex flex-wrap items-center gap-2">
          <Link className={buttonClasses({ className: 'gap-2', variant: 'secondary' })} href="/recruitment"><ArrowLeft aria-hidden="true" />{labels.back}</Link>
          {canWrite ? <Button onClick={() => setEditorOpen(true)} type="button" variant="primary"><Edit3 aria-hidden="true" />{labels.edit}</Button> : null}
        </div>}
        description={<div className="flex flex-wrap items-center gap-x-3 gap-y-2"><Badge tone={statusTone(vacancy.status)}>{status}</Badge><span>{vacancy.locationLabel ?? '—'}</span><span>{vacancy.activeApplicationCount} {labels.applications}</span></div>}
        title={<><span className="eyebrow block">{labels.eyebrow}</span><span className="mt-1 block break-words">{vacancy.title}</span></>}
      />

      <DetailColumns
        aside={<aside className="space-y-6">
          <PublicationPanel canPublish={canPublish} labels={labels.publication} publication={vacancy.publication} sections={vacancy.sections} vacancyId={vacancy.id} vacancyTitle={vacancy.title} />
          <Surface className="p-5">
            <SectionHeader title={labels.vacancyData} />
            <InfoList className="mt-5" columns={1} items={[
              { label: labels.status, value: <Badge tone={statusTone(vacancy.status)}>{status}</Badge> },
              { label: labels.location, value: vacancy.locationLabel ?? '—' },
              { label: labels.workMode, value: workMode },
              { label: labels.hours, value: vacancy.minHours === null && vacancy.maxHours === null ? '—' : `${vacancy.minHours ?? '—'} – ${vacancy.maxHours ?? '—'}` },
              { label: labels.salary, value: salary },
              { label: labels.version, value: vacancy.version },
              { label: labels.updatedAt, value: new Date(vacancy.updatedAt).toLocaleString() },
            ]} />
          </Surface>
        </aside>}
        main={<div className="space-y-6">
          <Surface className="p-5 sm:p-6">
            <SectionHeader description={labels.sectionHint} title={labels.content} />
            <div className="mt-6 grid gap-4">
              {vacancy.sections.filter((section) => section.isVisible).map((section) => (
                <article className="border-b border-border-subtle pb-4 last:border-b-0 last:pb-0" key={section.sectionType}>
                  <h2 className="font-semibold text-foreground">{section.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{section.content.trim() || labels.emptyContent}</p>
                </article>
              ))}
            </div>
          </Surface>
          {applications.length > 0 || canManageApplications ? <Surface className="p-5 sm:p-6"><PipelineBoard applications={applications} labels={labels.pipeline} /></Surface> : <Surface className="p-5 sm:p-6"><SectionHeader title={labels.applications} /><p className="mt-4 text-sm text-muted-foreground">{labels.noCandidateAccess}</p></Surface>}
          {canManageApplications ? <ManualApplicationForm labels={labels.manual} vacancyId={vacancy.id} /> : null}
        </div>}
      />

      <VacancyEditorDrawer key={vacancy.version} labels={labels} onClose={() => setEditorOpen(false)} onSaved={() => router.refresh()} open={editorOpen} vacancy={vacancy} />
    </PageShell>
  )
}
