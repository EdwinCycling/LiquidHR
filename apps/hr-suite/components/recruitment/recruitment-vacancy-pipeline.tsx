'use client'

import Link from 'next/link'
import { CheckCircle2, MoveRight, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type ChangeEvent, type ReactElement } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { ApplicationCard, RecruitmentVacancyPipeline as PipelineData } from '@/lib/recruitment/application-service'

const REJECTED_OUTCOME = 'AFGEWEZEN'
const HIRED_OUTCOME = 'AANGENOMEN'
const ALL_COLUMNS = 'ALL'

export interface RecruitmentVacancyPipelineLabels {
  readonly title: string
  readonly description: string
  readonly total: string
  readonly active: string
  readonly terminal: string
  readonly filter: string
  readonly allStages: string
  readonly terminalRejected: string
  readonly terminalHired: string
  readonly empty: string
  readonly source: string
  readonly manualSource: string
  readonly publicSource: string
  readonly stage: string
  readonly move: string
  readonly reject: string
  readonly hire: string
  readonly actionFailed: string
  readonly conflict: string
  readonly invalidTransition: string
  readonly moved: string
  readonly rejected: string
}

type PipelineColumn = {
  readonly id: string
  readonly label: string
  readonly count: number
  readonly applications: readonly ApplicationCard[]
  readonly terminalOutcome?: 'AFGEWEZEN' | 'AANGENOMEN'
}

function applicationSourceLabel(application: ApplicationCard, labels: RecruitmentVacancyPipelineLabels): string {
  return application.source === 'PUBLIC' ? labels.publicSource : labels.manualSource
}

function outcomeLabel(outcome: 'AFGEWEZEN' | 'AANGENOMEN', labels: RecruitmentVacancyPipelineLabels): string {
  return outcome === REJECTED_OUTCOME ? labels.terminalRejected : labels.terminalHired
}

function columnsForPipeline(pipeline: PipelineData, labels: RecruitmentVacancyPipelineLabels): PipelineColumn[] {
  const stageColumns = pipeline.stages
    .filter((stage) => stage.isActive || stage.applicationCount > 0)
    .map((stage) => ({
      id: stage.id,
      label: stage.name,
      count: stage.applicationCount,
      applications: pipeline.applications.filter((application) => application.stageId === stage.id),
    }))
  const terminalColumns = ([
    { id: REJECTED_OUTCOME, label: labels.terminalRejected },
    { id: HIRED_OUTCOME, label: labels.terminalHired },
  ] as const).map((outcome) => ({
    id: outcome.id,
    label: outcome.label,
    count: pipeline.applications.filter((application) => application.terminalOutcome === outcome.id).length,
    applications: pipeline.applications.filter((application) => application.terminalOutcome === outcome.id),
    terminalOutcome: outcome.id,
  }))
  return [...stageColumns, ...terminalColumns]
}

function responseErrorMessage(status: number, code: string | null, labels: RecruitmentVacancyPipelineLabels): string {
  if (status === 409 || code === 'RECRUITMENT_VERSION_CONFLICT') return labels.conflict
  if (status === 422 || code === 'RECRUITMENT_STAGE_INVALID') return labels.invalidTransition
  return labels.actionFailed
}

export function RecruitmentVacancyPipeline({ pipeline, labels }: { readonly pipeline: PipelineData; readonly labels: RecruitmentVacancyPipelineLabels }): ReactElement {
  const router = useRouter()
  const [mobileColumn, setMobileColumn] = useState(ALL_COLUMNS)
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const columns = useMemo(() => columnsForPipeline(pipeline, labels), [labels, pipeline])
  const activeStages = useMemo(() => pipeline.stages.filter((stage) => stage.isActive), [pipeline.stages])
  const activeApplications = pipeline.applications.filter((application) => application.terminalOutcome === null).length
  const terminalApplications = pipeline.applications.length - activeApplications
  const mobileColumnApplications = mobileColumn === ALL_COLUMNS
    ? pipeline.applications
    : columns.find((column) => column.id === mobileColumn)?.applications ?? []

  async function mutate(application: ApplicationCard, action: 'move' | 'reject', stageId?: string): Promise<void> {
    setPendingApplicationId(application.id)
    setMessage(null)
    const endpoint = action === 'move' ? 'stage' : 'reject'
    const body = action === 'move'
      ? { stageId, expectedVersion: application.version, idempotencyKey: crypto.randomUUID() }
      : { reason: 'Handmatige beoordeling', expectedVersion: application.version, idempotencyKey: crypto.randomUUID() }
    const response = await fetch(`/api/recruitment/applications/${application.id}/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!response) {
      setMessage(labels.actionFailed)
      setPendingApplicationId(null)
      return
    }
    const payload = await response.json().catch(() => null) as { readonly code?: unknown } | null
    if (!response.ok) {
      const code = typeof payload?.code === 'string' ? payload.code : null
      setMessage(responseErrorMessage(response.status, code, labels))
      setPendingApplicationId(null)
      return
    }
    setMessage(action === 'move' ? labels.moved : labels.rejected)
    setPendingApplicationId(null)
    router.refresh()
  }

  function onMoveChange(application: ApplicationCard, event: ChangeEvent<HTMLSelectElement>): void {
    const nextStageId = event.target.value
    if (nextStageId && nextStageId !== application.stageId) void mutate(application, 'move', nextStageId)
  }

  function renderApplication(application: ApplicationCard): ReactElement {
    const isPending = pendingApplicationId === application.id
    const moveOptions = activeStages.filter((stage) => stage.id !== application.stageId)
    return <li className="min-w-0 rounded-[var(--radius-surface)] border border-border-subtle bg-surface p-4" key={application.id}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="block break-words font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/recruitment/applications/${application.id}`}>{application.candidateName}</Link>
          <p className="mt-1 break-words text-xs text-muted-foreground">{labels.source}: {applicationSourceLabel(application, labels)}</p>
        </div>
        {application.terminalOutcome ? <Badge tone={application.terminalOutcome === HIRED_OUTCOME ? 'success' : 'danger'}>{outcomeLabel(application.terminalOutcome, labels)}</Badge> : null}
      </div>
      <dl className="mt-4 grid min-w-0 gap-2 text-sm">
        <div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">{labels.stage}</dt>
          <dd className="min-w-0 break-words text-right font-medium">{application.stageName ?? '—'}</dd>
        </div>
      </dl>
      {application.terminalOutcome === null ? <div className="mt-4 grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <DropdownSelect aria-label={`${labels.move}: ${application.candidateName}`} className="w-full sm:max-w-56" emptyLabel={labels.empty} onChange={(event) => onMoveChange(application, event)} placeholder={labels.move} searchable searchPlaceholder={labels.move} value="" disabled={isPending}>
          <option value="">{labels.move}</option>
          {moveOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </DropdownSelect>
        <Button disabled={isPending} loading={isPending} onClick={() => void mutate(application, 'reject')} size="sm" type="button" variant="danger"><XCircle aria-hidden="true" />{labels.reject}</Button>
        <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/recruitment/applications/${application.id}`}><CheckCircle2 aria-hidden="true" />{labels.hire}</Link>
      </div> : null}
    </li>
  }

  function renderColumn(column: PipelineColumn): ReactElement {
    return <Surface className="min-w-0 p-4" key={column.id} variant="subtle">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-semibold text-foreground">{column.label}</h3>
        <Badge>{column.count}</Badge>
      </div>
      {column.applications.length === 0 ? <EmptyState className="mt-4 px-3 py-6" title={labels.empty} /> : <ol aria-label={column.label} className="mt-4 grid min-w-0 gap-3">{column.applications.map(renderApplication)}</ol>}
    </Surface>
  }

  return <section aria-labelledby="recruitment-vacancy-pipeline-title" className="min-w-0 space-y-5">
    <Surface className="p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-primary"><MoveRight aria-hidden="true" className="size-4" />{labels.title}</div>
          <h2 className="mt-1 break-words text-xl font-semibold" id="recruitment-vacancy-pipeline-title">{pipeline.vacancyTitle}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{labels.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label={labels.title}>
          <div className="min-w-0 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2"><p className="text-xs text-muted-foreground">{labels.total}</p><p className="mt-1 text-lg font-semibold tabular-nums">{pipeline.applications.length}</p></div>
          <div className="min-w-0 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2"><p className="text-xs text-muted-foreground">{labels.active}</p><p className="mt-1 text-lg font-semibold tabular-nums">{activeApplications}</p></div>
          <div className="min-w-0 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2"><p className="text-xs text-muted-foreground">{labels.terminal}</p><p className="mt-1 text-lg font-semibold tabular-nums">{terminalApplications}</p></div>
        </div>
      </div>
      <div aria-live="polite" className="mt-4 min-h-5 text-sm text-muted-foreground">{message}</div>
      <div className="mt-1 max-w-md">
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="recruitment-vacancy-pipeline-filter"><span>{labels.filter}</span><DropdownSelect aria-label={labels.filter} id="recruitment-vacancy-pipeline-filter" onChange={(event) => setMobileColumn(event.target.value)} searchable searchPlaceholder={labels.filter} value={mobileColumn}>
          <option value={ALL_COLUMNS}>{labels.allStages}</option>
          {columns.filter((column) => !column.terminalOutcome).map((column) => <option key={column.id} value={column.id}>{column.label} ({column.count})</option>)}
          <option value={REJECTED_OUTCOME}>{labels.terminalRejected} ({columns.find((column) => column.id === REJECTED_OUTCOME)?.count ?? 0})</option>
          <option value={HIRED_OUTCOME}>{labels.terminalHired} ({columns.find((column) => column.id === HIRED_OUTCOME)?.count ?? 0})</option>
        </DropdownSelect></label>
      </div>
    </Surface>
    <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-3">{columns.map(renderColumn)}</div>
    <div className="min-w-0 lg:hidden">
      {mobileColumn === ALL_COLUMNS ? (mobileColumnApplications.length === 0 ? <EmptyState title={labels.empty} /> : <ol aria-label={labels.title} className="grid min-w-0 gap-3">{mobileColumnApplications.map(renderApplication)}</ol>) : <div className="grid min-w-0 gap-3">{columns.filter((column) => column.id === mobileColumn).map(renderColumn)}</div>}
    </div>
  </section>
}
