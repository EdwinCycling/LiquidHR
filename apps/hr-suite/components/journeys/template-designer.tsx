'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Send, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormActions } from '@/components/patterns/form-actions'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { JourneyTemplateDetail, JourneyTemplateDraft } from '@/lib/journeys'
import type { JourneyLabels } from '@/lib/journeys/labels'

type Phase = JourneyTemplateDraft['phases'][number]
type Role = JourneyTemplateDraft['roles'][number]
type Moment = JourneyTemplateDraft['moments'][number]
type Topic = JourneyTemplateDraft['topics'][number]
type OperationState = 'idle' | 'saving' | 'publishing' | 'retiring' | 'saved' | 'published' | 'failed'
type Confirmation = 'publish' | 'retire' | 'discard' | null

type ApiIssue = { readonly code: string; readonly path: readonly (string | number)[] }
type ApiPayload<T> = { readonly data?: T; readonly error?: string; readonly issues?: readonly ApiIssue[] }

function nextOrder(items: readonly { sortOrder: number }[]): number {
  return (items.at(-1)?.sortOrder ?? 0) + 10
}

function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return items.map((current, currentIndex) => currentIndex === index ? item : current)
}

function move<T extends { sortOrder: number }>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return [...items]
  const result = [...items]
  const current = result[index]
  const targetItem = result[target]
  if (!current || !targetItem) return result
  result[index] = targetItem
  result[target] = current
  return result.map((item, itemIndex) => ({ ...item, sortOrder: (itemIndex + 1) * 10 }))
}

function LocalizedFields({
  disabled,
  fieldLabel,
  labels,
  multiline = false,
  onChange,
  value,
}: {
  disabled: boolean
  fieldLabel: string
  labels: JourneyLabels
  multiline?: boolean
  onChange: (value: { nl: string; en: string }) => void
  value: { nl: string; en: string }
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={multiline
          ? <Textarea disabled={disabled} onChange={(event) => onChange({ ...value, nl: event.target.value })} required value={value.nl} />
          : <TextInput disabled={disabled} onChange={(event) => onChange({ ...value, nl: event.target.value })} required value={value.nl} />}
        label={`${fieldLabel} · ${labels.nl}`}
        required
      />
      <FormField
        control={multiline
          ? <Textarea disabled={disabled} onChange={(event) => onChange({ ...value, en: event.target.value })} required value={value.en} />
          : <TextInput disabled={disabled} onChange={(event) => onChange({ ...value, en: event.target.value })} required value={value.en} />}
        label={`${fieldLabel} · ${labels.en}`}
        required
      />
    </div>
  )
}

function OrderButtons({
  disabled,
  index,
  label,
  labels,
  length,
  onMove,
}: {
  disabled: boolean
  index: number
  label: string
  labels: JourneyLabels
  length: number
  onMove: (direction: -1 | 1) => void
}) {
  return (
    <div className="flex gap-1">
      <Button aria-label={`${label}: ${labels.moveUp}`} disabled={disabled || index === 0} onClick={() => onMove(-1)} size="sm" type="button" variant="secondary">
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button aria-label={`${label}: ${labels.moveDown}`} disabled={disabled || index === length - 1} onClick={() => onMove(1)} size="sm" type="button" variant="secondary">
        <ArrowDown aria-hidden="true" />
      </Button>
    </div>
  )
}

function lifecycleTone(lifecycle: JourneyTemplateDetail['lifecycle']): 'info' | 'success' | 'neutral' {
  if (lifecycle === 'PUBLISHED') return 'success'
  if (lifecycle === 'RETIRED') return 'neutral'
  return 'info'
}

export function TemplateDesigner({
  template,
  labels,
  canWrite,
  canPublish,
  employeeOptions,
  managementRoleOptions,
  locale,
}: {
  template: JourneyTemplateDetail
  labels: JourneyLabels
  canWrite: boolean
  canPublish: boolean
  employeeOptions: readonly { id: string; label: string }[]
  managementRoleOptions: readonly { code: string; label: string }[]
  locale: 'nl' | 'en'
}) {
  const router = useRouter()
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB'), [locale])
  const [draft, setDraft] = useState(template.draft)
  const [savedDraft, setSavedDraft] = useState(template.draft)
  const [revision, setRevision] = useState(template.draftRevision)
  const [state, setState] = useState<OperationState>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [errorIssues, setErrorIssues] = useState<readonly ApiIssue[]>([])
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [retired, setRetired] = useState(template.lifecycle === 'RETIRED')
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft)
  const busy = state === 'saving' || state === 'publishing' || state === 'retiring'
  const lifecycle = retired ? 'RETIRED' : template.lifecycle
  const formId = 'journey-template-designer-form'

  useEffect(() => {
    if (!dirty) return undefined
    const protectBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectBeforeUnload)
    return () => window.removeEventListener('beforeunload', protectBeforeUnload)
  }, [dirty])

  function clearError(): void {
    setErrorCode(null)
    setErrorIssues([])
  }

  function failed(payload?: ApiPayload<unknown>): void {
    setErrorCode(payload?.error ?? null)
    setErrorIssues(payload?.issues ?? [])
    setState('failed')
  }

  async function readPayload<T>(response: Response): Promise<ApiPayload<T>> {
    try {
      return await response.json() as ApiPayload<T>
    } catch {
      return {}
    }
  }

  async function save(): Promise<void> {
    if (!canWrite || busy || !dirty) return
    clearError()
    setState('saving')
    try {
      const response = await fetch(`/api/journeys/template-drafts/${template.draftId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, draft }),
      })
      const payload = await readPayload<{ readonly revision: number }>(response)
      if (!response.ok || !payload.data) {
        failed(payload)
        return
      }
      setRevision(payload.data.revision)
      setSavedDraft(draft)
      setState('saved')
      router.refresh()
    } catch {
      failed()
    }
  }

  async function publish(): Promise<void> {
    if (!canPublish || busy || dirty || retired) return
    clearError()
    setState('publishing')
    try {
      const response = await fetch(`/api/journeys/template-drafts/${template.draftId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision }),
      })
      const payload = await readPayload<{ readonly versionNumber: number }>(response)
      if (!response.ok || !payload.data) {
        failed(payload)
        return
      }
      setPublishedVersion(payload.data.versionNumber)
      setState('published')
      router.refresh()
    } catch {
      failed()
    }
  }

  async function retire(): Promise<void> {
    if (!canPublish || busy || dirty || retired) return
    clearError()
    setState('retiring')
    try {
      const response = await fetch(`/api/journeys/templates/${template.id}/retire`, { method: 'POST' })
      const payload = await readPayload<{ readonly lifecycle: 'RETIRED' }>(response)
      if (!response.ok || payload.data?.lifecycle !== 'RETIRED') {
        failed(payload)
        return
      }
      setRetired(true)
      setState('saved')
      router.refresh()
    } catch {
      failed()
    }
  }

  async function confirm(): Promise<void> {
    if (!confirmation) return
    const action = confirmation
    if (action === 'discard') {
      setConfirmation(null)
      router.push('/settings/journeys')
      return
    }
    if (action === 'publish') await publish()
    if (action === 'retire') await retire()
    setConfirmation(null)
  }

  function requestNavigation(): void {
    if (dirty) setConfirmation('discard')
    else router.push('/settings/journeys')
  }

  function updateDraft(update: (current: JourneyTemplateDraft) => JourneyTemplateDraft): void {
    setDraft(update)
    if (state !== 'idle' && state !== 'failed') setState('idle')
  }

  function setPhases(phases: Phase[]): void {
    updateDraft((current) => ({ ...current, phases }))
  }

  function setRoles(roles: Role[]): void {
    updateDraft((current) => ({ ...current, roles }))
  }

  function setMoments(moments: Moment[]): void {
    updateDraft((current) => ({ ...current, moments }))
  }

  function setTopics(topics: Topic[]): void {
    updateDraft((current) => ({ ...current, topics }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void save()
  }

  const confirmationCopy = confirmation === 'publish'
    ? { cancelLabel: labels.cancel, confirmLabel: labels.publish, description: labels.publishConfirm, title: labels.publish }
    : confirmation === 'retire'
      ? { cancelLabel: labels.cancel, confirmLabel: labels.retire, description: labels.retireConfirm, title: labels.retire }
      : { cancelLabel: labels.keepEditing, confirmLabel: labels.discardChanges, description: labels.discardDescription, title: labels.discardChangesTitle }

  return (
    <>
      <PageHeader
        actions={<Button onClick={requestNavigation} size="sm" type="button" variant="ghost"><ArrowLeft aria-hidden="true" />{labels.backToCatalog}</Button>}
        description={labels.designerSubtitle}
        title={<span className="break-words">{labels.designerTitle} <span className="text-muted-foreground">· {draft.name[locale]}</span></span>}
      />

      <Surface className="mt-6 p-4 sm:p-5" variant="subtle">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{labels.key}: <span className="font-mono font-normal">{template.key}</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.immutableHint}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
            <Badge tone={lifecycleTone(lifecycle)}>{lifecycle === 'PUBLISHED' ? labels.published : lifecycle === 'RETIRED' ? labels.retired : labels.draft}</Badge>
            <span className="text-muted-foreground">{labels.draftRevision} {revision}</span>
          </div>
        </div>
        {!canWrite ? <p className="mt-4 border-t border-border-subtle pt-3 text-sm text-muted-foreground">{labels.readOnlyDescription}</p> : null}
      </Surface>

      <form className="mt-6 space-y-6 pb-4" id={formId} onSubmit={handleSubmit}>
        <Surface className="p-4 sm:p-5">
          <SectionHeader description={labels.languageHint} title={labels.name} />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <LocalizedFields disabled={!canWrite} fieldLabel={labels.name} labels={labels} onChange={(name) => updateDraft((current) => ({ ...current, name }))} value={draft.name} />
            <LocalizedFields disabled={!canWrite} fieldLabel={labels.description} labels={labels} multiline onChange={(description) => updateDraft((current) => ({ ...current, description }))} value={draft.description} />
            <FormField
              control={<DropdownSelect aria-label={labels.type} disabled={!canWrite} onChange={(event) => updateDraft((current) => ({ ...current, journeyType: event.target.value as JourneyTemplateDraft['journeyType'] }))} searchable value={draft.journeyType}>{Object.entries(labels.types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DropdownSelect>}
              label={labels.type}
              required
            />
            <FormField
              control={<DropdownSelect aria-label={labels.anchor} disabled={!canWrite} onChange={(event) => updateDraft((current) => ({ ...current, anchorRule: event.target.value as JourneyTemplateDraft['anchorRule'] }))} searchable value={draft.anchorRule}>{Object.entries(labels.anchors).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DropdownSelect>}
              label={labels.anchor}
              required
            />
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <SectionHeader actions={canWrite ? <Button onClick={() => setPhases([...draft.phases, { key: `phase-${draft.phases.length + 1}`, name: { nl: '', en: '' }, sortOrder: nextOrder(draft.phases) }])} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />{labels.addPhase}</Button> : undefined} title={labels.phases} />
          <div className="mt-5 divide-y divide-border-subtle">
            {draft.phases.map((phase, index) => {
              const inUse = draft.moments.some((moment) => moment.phaseKey === phase.key)
              return <article className="py-5 first:pt-0 last:pb-0" key={`${phase.key}-${index}`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-xs font-semibold text-accent-foreground">{index + 1}</span>
                  <div className="flex gap-2">
                    <OrderButtons disabled={!canWrite || busy} index={index} label={labels.phase} labels={labels} length={draft.phases.length} onMove={(direction) => setPhases(move(draft.phases, index, direction))} />
                    {canWrite && draft.phases.length > 1 ? <Button aria-label={`${labels.remove}: ${phase.key}`} disabled={busy || inUse} onClick={() => setPhases(draft.phases.filter((_, itemIndex) => itemIndex !== index))} size="sm" title={inUse ? labels.cannotRemoveInUse : undefined} type="button" variant="danger"><Trash2 aria-hidden="true" />{labels.remove}</Button> : null}
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.35fr)_minmax(0,1fr)]">
                  <FormField control={<TextInput disabled={!canWrite} onChange={(event) => setPhases(replaceAt(draft.phases, index, { ...phase, key: event.target.value }))} pattern="[a-z][a-z0-9_-]*" required value={phase.key} />} label={labels.key} required />
                  <LocalizedFields disabled={!canWrite} fieldLabel={labels.name} labels={labels} onChange={(name) => setPhases(replaceAt(draft.phases, index, { ...phase, name }))} value={phase.name} />
                </div>
              </article>
            })}
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <SectionHeader actions={canWrite ? <Button onClick={() => setRoles([...draft.roles, { key: `role-${draft.roles.length + 1}`, name: { nl: '', en: '' }, required: false, cardinality: 'ONE', resolverType: 'MANUAL', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: nextOrder(draft.roles) }])} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />{labels.addRole}</Button> : undefined} title={labels.roles} />
          <div className="mt-5 divide-y divide-border-subtle">
            {draft.roles.map((role, index) => {
              const inUse = draft.topics.some((topic) => topic.ownerRoleKey === role.key || topic.audienceRoleKeys.includes(role.key))
              return <article className="py-5 first:pt-0 last:pb-0" key={`${role.key}-${index}`}>
                <div className="mb-4 flex justify-end gap-2">
                  <OrderButtons disabled={!canWrite || busy} index={index} label={labels.ownerRole} labels={labels} length={draft.roles.length} onMove={(direction) => setRoles(move(draft.roles, index, direction))} />
                  {canWrite && draft.roles.length > 1 ? <Button aria-label={`${labels.remove}: ${role.key}`} disabled={busy || inUse} onClick={() => setRoles(draft.roles.filter((_, itemIndex) => itemIndex !== index))} size="sm" title={inUse ? labels.cannotRemoveInUse : undefined} type="button" variant="danger"><Trash2 aria-hidden="true" />{labels.remove}</Button> : null}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField control={<TextInput disabled={!canWrite} onChange={(event) => setRoles(replaceAt(draft.roles, index, { ...role, key: event.target.value }))} pattern="[a-z][a-z0-9_-]*" required value={role.key} />} label={labels.key} required />
                  <Checkbox checked={role.required} disabled={!canWrite} label={labels.required} onChange={(event) => setRoles(replaceAt(draft.roles, index, { ...role, required: event.target.checked }))} />
                  <div className="lg:col-span-2"><LocalizedFields disabled={!canWrite} fieldLabel={labels.name} labels={labels} onChange={(name) => setRoles(replaceAt(draft.roles, index, { ...role, name }))} value={role.name} /></div>
                  <FormField control={<DropdownSelect aria-label={labels.cardinality} disabled={!canWrite} onChange={(event) => setRoles(replaceAt(draft.roles, index, { ...role, cardinality: event.target.value as Role['cardinality'] }))} searchable value={role.cardinality}><option value="ONE">{labels.one}</option><option value="MANY">{labels.many}</option></DropdownSelect>} label={labels.cardinality} required />
                  <FormField
                    control={<DropdownSelect aria-label={labels.resolver} disabled={!canWrite} onChange={(event) => { const resolverType = event.target.value as Role['resolverType']; setRoles(replaceAt(draft.roles, index, { ...role, resolverType, resolverRoleCode: resolverType === 'DEPARTMENT_MANAGER' ? role.resolverRoleCode ?? managementRoleOptions[0]?.code ?? null : null, resolverEmployeeId: resolverType === 'SPECIFIC_EMPLOYEE' ? role.resolverEmployeeId ?? employeeOptions[0]?.id ?? null : null })) }} searchable value={role.resolverType}>{Object.entries(labels.resolvers).map(([key, label]) => <option disabled={(key === 'SPECIFIC_EMPLOYEE' && employeeOptions.length === 0) || (key === 'DEPARTMENT_MANAGER' && managementRoleOptions.length === 0)} key={key} value={key}>{label}</option>)}</DropdownSelect>}
                    label={labels.resolver}
                    required
                  />
                  {role.resolverType === 'DEPARTMENT_MANAGER' ? <FormField className="lg:col-span-2" control={<DropdownSelect aria-label={labels.resolverRole} disabled={!canWrite} onChange={(event) => setRoles(replaceAt(draft.roles, index, { ...role, resolverRoleCode: event.target.value }))} searchable value={role.resolverRoleCode ?? ''}>{managementRoleOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</DropdownSelect>} label={labels.resolverRole} required /> : null}
                  {role.resolverType === 'SPECIFIC_EMPLOYEE' ? <FormField className="lg:col-span-2" control={<DropdownSelect aria-label={labels.specificEmployee} disabled={!canWrite} onChange={(event) => setRoles(replaceAt(draft.roles, index, { ...role, resolverEmployeeId: event.target.value }))} searchable value={role.resolverEmployeeId ?? ''}>{employeeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</DropdownSelect>} label={labels.specificEmployee} required /> : null}
                </div>
              </article>
            })}
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <SectionHeader actions={canWrite ? <Button onClick={() => { const phaseKey = draft.phases[0]?.key; if (phaseKey) setMoments([...draft.moments, { key: `moment-${draft.moments.length + 1}`, phaseKey, name: { nl: '', en: '' }, dateOffsetDays: 0, availabilityOffsetDays: 0, sortOrder: nextOrder(draft.moments) }]) }} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />{labels.addMoment}</Button> : undefined} title={labels.moments} />
          <div className="mt-5 divide-y divide-border-subtle">
            {draft.moments.map((moment, index) => {
              const inUse = draft.topics.some((topic) => topic.momentKey === moment.key)
              return <article className="py-5 first:pt-0 last:pb-0" key={`${moment.key}-${index}`}>
                <div className="mb-4 flex justify-end gap-2">
                  <OrderButtons disabled={!canWrite || busy} index={index} label={labels.moment} labels={labels} length={draft.moments.length} onMove={(direction) => setMoments(move(draft.moments, index, direction))} />
                  {canWrite && draft.moments.length > 1 ? <Button aria-label={`${labels.remove}: ${moment.key}`} disabled={busy || inUse} onClick={() => setMoments(draft.moments.filter((_, itemIndex) => itemIndex !== index))} size="sm" title={inUse ? labels.cannotRemoveInUse : undefined} type="button" variant="danger"><Trash2 aria-hidden="true" />{labels.remove}</Button> : null}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField control={<TextInput disabled={!canWrite} onChange={(event) => setMoments(replaceAt(draft.moments, index, { ...moment, key: event.target.value }))} pattern="[a-z][a-z0-9_-]*" required value={moment.key} />} label={labels.key} required />
                  <FormField control={<DropdownSelect aria-label={labels.phase} disabled={!canWrite} onChange={(event) => setMoments(replaceAt(draft.moments, index, { ...moment, phaseKey: event.target.value }))} searchable value={moment.phaseKey}>{draft.phases.map((phase) => <option key={phase.key} value={phase.key}>{phase.name[locale]}</option>)}</DropdownSelect>} label={labels.phase} required />
                  <div className="lg:col-span-2"><LocalizedFields disabled={!canWrite} fieldLabel={labels.name} labels={labels} onChange={(name) => setMoments(replaceAt(draft.moments, index, { ...moment, name }))} value={moment.name} /></div>
                  <FormField control={<TextInput disabled={!canWrite} max="730" min="-730" onChange={(event) => setMoments(replaceAt(draft.moments, index, { ...moment, dateOffsetDays: Number(event.target.value) }))} required type="number" value={moment.dateOffsetDays} />} label={labels.dateOffset} required />
                  <FormField control={<TextInput disabled={!canWrite} max={moment.dateOffsetDays} min="-730" onChange={(event) => setMoments(replaceAt(draft.moments, index, { ...moment, availabilityOffsetDays: Number(event.target.value) }))} required type="number" value={moment.availabilityOffsetDays} />} label={labels.availabilityOffset} required />
                </div>
              </article>
            })}
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <SectionHeader actions={canWrite ? <Button onClick={() => { const momentKey = draft.moments[0]?.key; const ownerRoleKey = draft.roles[0]?.key; if (momentKey && ownerRoleKey) setTopics([...draft.topics, { key: `topic-${draft.topics.length + 1}`, momentKey, ownerRoleKey, topicType: 'INFORMATION', title: { nl: '', en: '' }, body: { nl: '', en: '' }, actionUrl: null, required: false, sortOrder: nextOrder(draft.topics), audienceRoleKeys: [ownerRoleKey] }]) }} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />{labels.addTopic}</Button> : undefined} title={labels.topics} />
          {draft.topics.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">{labels.noTopics}</p> : <div className="mt-5 divide-y divide-border-subtle">
            {draft.topics.map((topic, index) => <article className="py-5 first:pt-0 last:pb-0" key={`${topic.key}-${index}`}>
              <div className="mb-4 flex justify-end gap-2">
                <OrderButtons disabled={!canWrite || busy} index={index} label={labels.topicType} labels={labels} length={draft.topics.length} onMove={(direction) => setTopics(move(draft.topics, index, direction))} />
                {canWrite ? <Button aria-label={`${labels.remove}: ${topic.key}`} disabled={busy} onClick={() => setTopics(draft.topics.filter((_, itemIndex) => itemIndex !== index))} size="sm" type="button" variant="danger"><Trash2 aria-hidden="true" />{labels.remove}</Button> : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField control={<TextInput disabled={!canWrite} onChange={(event) => setTopics(replaceAt(draft.topics, index, { ...topic, key: event.target.value }))} pattern="[a-z][a-z0-9_-]*" required value={topic.key} />} label={labels.key} required />
                <Checkbox checked={topic.required} disabled={!canWrite} label={labels.required} onChange={(event) => setTopics(replaceAt(draft.topics, index, { ...topic, required: event.target.checked }))} />
                <FormField control={<DropdownSelect aria-label={labels.moment} disabled={!canWrite} onChange={(event) => setTopics(replaceAt(draft.topics, index, { ...topic, momentKey: event.target.value }))} searchable value={topic.momentKey}>{draft.moments.map((moment) => <option key={moment.key} value={moment.key}>{moment.name[locale]}</option>)}</DropdownSelect>} label={labels.moment} required />
                <FormField control={<DropdownSelect aria-label={labels.ownerRole} disabled={!canWrite} onChange={(event) => setTopics(replaceAt(draft.topics, index, { ...topic, ownerRoleKey: event.target.value }))} searchable value={topic.ownerRoleKey}>{draft.roles.map((role) => <option key={role.key} value={role.key}>{role.name[locale]}</option>)}</DropdownSelect>} label={labels.ownerRole} required />
                <FormField className="lg:col-span-2" control={<DropdownSelect aria-label={labels.topicType} disabled={!canWrite} onChange={(event) => { const topicType = event.target.value as Topic['topicType']; setTopics(replaceAt(draft.topics, index, { ...topic, topicType, actionUrl: topicType === 'ACTION' ? topic.actionUrl : null })) }} searchable value={topic.topicType}>{Object.entries(labels.topicTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DropdownSelect>} label={labels.topicType} required />
                <div className="lg:col-span-2"><LocalizedFields disabled={!canWrite} fieldLabel={labels.name} labels={labels} onChange={(title) => setTopics(replaceAt(draft.topics, index, { ...topic, title }))} value={topic.title} /></div>
                <div className="lg:col-span-2"><LocalizedFields disabled={!canWrite} fieldLabel={labels.body} labels={labels} multiline onChange={(body) => setTopics(replaceAt(draft.topics, index, { ...topic, body }))} value={topic.body} /></div>
                {topic.topicType === 'ACTION' ? <FormField className="lg:col-span-2" control={<TextInput disabled={!canWrite} onChange={(event) => setTopics(replaceAt(draft.topics, index, { ...topic, actionUrl: event.target.value }))} placeholder="https://" required type="url" value={topic.actionUrl ?? ''} />} label={labels.actionUrl} required /> : null}
                <fieldset className="lg:col-span-2">
                  <legend className="text-sm font-medium">{labels.audience}</legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {draft.roles.map((role) => {
                      const checked = topic.audienceRoleKeys.includes(role.key)
                      return <Checkbox checked={checked} disabled={!canWrite} key={role.key} label={role.name[locale]} onChange={(event) => setTopics(replaceAt(draft.topics, index, { ...topic, audienceRoleKeys: event.target.checked ? [...topic.audienceRoleKeys, role.key] : topic.audienceRoleKeys.filter((key) => key !== role.key) }))} />
                    })}
                  </div>
                </fieldset>
              </div>
            </article>)}
          </div>}
        </Surface>

        {template.versions.length > 0 || publishedVersion !== null ? <Surface className="p-4 sm:p-5" variant="subtle">
          <SectionHeader description={labels.immutableHint} title={labels.published} />
          <div className="mt-4 flex flex-wrap gap-2">
            {template.versions.map((version) => <Badge key={version.id} tone="success">{labels.version} {version.versionNumber} · {dateFormatter.format(new Date(version.publishedAt))}</Badge>)}
            {publishedVersion !== null && !template.versions.some((version) => version.versionNumber === publishedVersion) ? <Badge tone="success">{labels.version} {publishedVersion} · {labels.publishedMessage}</Badge> : null}
          </div>
        </Surface> : null}

        {state === 'failed' ? <Surface className="border-destructive bg-destructive-surface p-4" role="alert" variant="subtle">
          <p className="text-sm font-semibold text-destructive">{errorCode === 'JOURNEY_TEMPLATE_INVALID' ? labels.invalid : labels.failed}</p>
          {errorIssues.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-destructive">{errorIssues.slice(0, 5).map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.path.map(String).join(' · ')}</li>)}</ul> : null}
        </Surface> : null}

        {canWrite || canPublish ? <FormActions
          cancelLabel={labels.cancel}
          destructiveAction={canPublish && !retired ? { disabled: dirty || busy, label: labels.retire, onClick: () => setConfirmation('retire') } : undefined}
          disabled={busy}
          form={formId}
          leading={<div className="flex flex-wrap items-center gap-3" aria-live="polite">
            {state === 'saved' ? <span className="text-sm text-success">{labels.saved}</span> : null}
            {state === 'published' ? <span className="text-sm text-success">{labels.publishedMessage}</span> : null}
            {canPublish && !retired ? <Button disabled={dirty || busy} onClick={() => setConfirmation('publish')} size="sm" title={dirty ? labels.publishNeedsSave : undefined} type="button" variant="secondary"><Send aria-hidden="true" />{labels.publish}</Button> : null}
          </div>}
          onCancel={requestNavigation}
          saveLabel={labels.save}
          saving={state === 'saving'}
          sticky
        /> : <div className="sticky bottom-0 z-10 flex justify-end border-t border-border-subtle bg-surface px-4 py-3"><Button onClick={requestNavigation} size="sm" type="button" variant="secondary">{labels.cancel}</Button></div>}
      </form>

      <ConfirmDialog
        cancelLabel={confirmationCopy.cancelLabel}
        confirmLabel={confirmationCopy.confirmLabel}
        description={confirmationCopy.description}
        destructive={confirmation === 'retire' || confirmation === 'discard'}
        onConfirm={confirm}
        onOpenChange={(open) => { if (!open && !busy) setConfirmation(null) }}
        open={confirmation !== null}
        pending={busy}
        title={confirmationCopy.title}
      />
    </>
  )
}
