import Link from 'next/link'
import { ArrowLeft, CircleAlert, Play, ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import {
  finalizePayrun01Action,
  generatePayrun01PayslipPdfAction,
  generatePayrun01TechnicalJsonAction,
  reviewPayrun01Action,
  runPayrun01Action,
} from './actions'
import {
  getPayrun01PayslipPdfArtifactForRun,
  getPayrun01TechnicalJsonArtifact,
  getLatestPayrun01Payroll,
  getPayrun01Lifecycle,
  listPayrun01Candidates,
  type Payrun01Candidate,
} from '@/lib/payroll/payrun01-service'
import type { SyntheticPayrollView } from '@/lib/payroll/synthetic-calculation-service'

type Payrun01Query = Record<string, string | string[] | undefined>
type Payrun01LifecycleView = Awaited<ReturnType<typeof getPayrun01Lifecycle>>

type CandidateRecord = {
  readonly candidate: Payrun01Candidate
  readonly latest: SyntheticPayrollView | null
  readonly lifecycle: Payrun01LifecycleView | null
  readonly runReadFailed: boolean
  readonly lifecycleReadFailed: boolean
  readonly technicalJsonAvailable: boolean
  readonly technicalJsonReadFailed: boolean
  readonly payslipPdfAvailable: boolean
  readonly payslipPdfReadFailed: boolean
}

const ERROR_KEYS = {
  'invalid-input': 'payrun01ErrorInvalidInput',
  blocked: 'payrun01ErrorBlocked',
  unsupported: 'payrun01ErrorUnsupported',
  unavailable: 'payrun01ErrorUnavailable',
  failed: 'payrun01ErrorFailed',
} as const

function isAuthenticationError(error: unknown): boolean {
  return error instanceof AuthenticationError || error instanceof ContextAuthenticationError
}

function isAuthorizationError(error: unknown): boolean {
  return error instanceof AuthorizationError || error instanceof ContextAccessError
}

function singleQueryValue(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function eventLabel(eventType: string, t: Awaited<ReturnType<typeof getTranslator>>): string {
  if (eventType === 'CONCEPT') return t('payrun01LifecycleConcept')
  if (eventType === 'REVIEWED') return t('payrun01LifecycleReviewed')
  if (eventType === 'FINALIZED') return t('payrun01LifecycleFinalized')
  if (eventType === 'BLOCKED') return t('payrun01LifecycleBlocked')
  return t('payrun01LifecycleOther')
}

function runStatusKey(status: SyntheticPayrollView['status']): string {
  if (status === 'SUCCEEDED') return 'payrun01StatusSucceeded'
  if (status === 'FAILED') return 'payrun01StatusFailed'
  if (status === 'RUNNING') return 'payrun01StatusRunning'
  return 'payrun01StatusPending'
}

function runStatusTone(status: SyntheticPayrollView['status']): BadgeTone {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED') return 'danger'
  return 'warning'
}

function controlStatusKey(status: 'PASS' | 'WARN' | 'FAIL'): string {
  if (status === 'PASS') return 'payrun01ControlPass'
  if (status === 'FAIL') return 'payrun01ControlFail'
  return 'payrun01ControlWarn'
}

function controlTone(status: 'PASS' | 'WARN' | 'FAIL'): BadgeTone {
  if (status === 'PASS') return 'success'
  if (status === 'FAIL') return 'danger'
  return 'warning'
}

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function MetadataItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className={`mt-1 break-all text-sm ${mono ? 'font-mono' : ''}`.trim()}>{value}</dd>
  </div>
}

function ActionMessage({ event, latest, lifecycle, requestedRun, requestedArtifact, technicalJsonAvailable, payslipPdfAvailable, t }: {
  event: string | null
  latest: SyntheticPayrollView | null
  lifecycle: Payrun01LifecycleView | null
  requestedRun: string | null
  requestedArtifact: string | null
  technicalJsonAvailable: boolean
  payslipPdfAvailable: boolean
  t: Awaited<ReturnType<typeof getTranslator>>
}) {
  if (!latest || !requestedRun || latest.runId !== requestedRun || !event) return null
  let messageKey: string | null = null
  if (event === 'run') {
    messageKey = latest.status === 'SUCCEEDED' ? 'payrun01RunSaved' : 'payrun01RunDidNotSucceed'
  } else if (event === 'reviewed' && lifecycle?.latestEvent?.event_type === 'REVIEWED'
    && lifecycle.latestEvent.calculation_run_id === requestedRun) {
    messageKey = 'payrun01ReviewSaved'
  } else if (event === 'finalized' && lifecycle?.latestEvent?.event_type === 'FINALIZED'
    && lifecycle.latestEvent.calculation_run_id === requestedRun) {
    messageKey = 'payrun01FinalizeSaved'
  } else if (event === 'artifact'
    && ((requestedArtifact === 'TECHNICAL_JSON' && technicalJsonAvailable)
      || (requestedArtifact === 'PAYSLIP_PDF' && payslipPdfAvailable))) {
    messageKey = 'payrun01ArtifactGenerated'
  }
  return messageKey ? <p className="mb-4 border-l-2 border-info-border pl-3 text-sm text-info" role="status">{t(messageKey)}</p> : null
}

function CandidatePanel({ record, canWrite, locale, t, event, requestedRun, requestedArtifact }: {
  record: CandidateRecord
  canWrite: boolean
  locale: string
  t: Awaited<ReturnType<typeof getTranslator>>
  event: string | null
  requestedRun: string | null
  requestedArtifact: string | null
}) {
  const { candidate, latest, lifecycle } = record
  const assignmentKey = candidate.scenarioKind === 'KINDEROPVANG_TEST'
    ? 'payrun01AssignmentKinderopvang'
    : 'payrun01AssignmentDemo'
  const latestLifecycle = lifecycle?.latestEvent
  const lifecycleMatchesRun = latestLifecycle?.calculation_run_id === latest?.runId
  const canReview = Boolean(canWrite && latest?.status === 'SUCCEEDED' && lifecycleMatchesRun && latestLifecycle?.event_type === 'CONCEPT')
  const canFinalize = Boolean(canWrite && latest?.status === 'SUCCEEDED' && lifecycleMatchesRun && latestLifecycle?.event_type === 'REVIEWED')
  const eventName = `person-${candidate.employeeId}`

  return <Surface className="space-y-5 p-4 sm:p-6" aria-labelledby={`payrun01-${eventName}`}>
    <SectionHeader
      actions={<Badge tone="info">{t('payrun01TestPersona')}</Badge>}
      description={t(assignmentKey)}
      title={<span id={`payrun01-${eventName}`}>{candidate.firstName}</span>}
    />
    <ActionMessage event={event} latest={latest} lifecycle={lifecycle} requestedRun={requestedRun} requestedArtifact={requestedArtifact} technicalJsonAvailable={record.technicalJsonAvailable} payslipPdfAvailable={record.payslipPdfAvailable} t={t} />

    <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      <MetadataItem label={t('payrun01Assignment')} value={t(assignmentKey)} />
      <MetadataItem label={t('payrun01Period')} value={t('payrun01PeriodOctober2026')} />
      <MetadataItem label={t('payrun01ConfirmedEmploymentCount')} value={String(candidate.confirmedOctoberEmploymentCount)} />
    </dl>

    {canWrite ? <form action={runPayrun01Action}>
      <input name="employeeId" type="hidden" value={candidate.employeeId} />
      <input name="scenarioKind" type="hidden" value={candidate.scenarioKind} />
      <Button type="submit"><Play aria-hidden="true" />{t('payrun01RunCalculation')}</Button>
    </form> : <p className="text-sm text-muted-foreground">{t('payrun01WritePermissionRequired')}</p>}

    {record.runReadFailed ? <p className="text-sm text-destructive" role="status">{t('payrun01RunReadUnavailable')}</p> : null}
    {!record.runReadFailed && !latest ? <p className="text-sm text-muted-foreground">{t('payrun01NoRun')}</p> : null}

    {latest ? <>
      <section aria-labelledby={`payrun01-run-${eventName}`} className="space-y-4 border-t border-subtle pt-5">
        <SectionHeader
          actions={<Badge tone={runStatusTone(latest.status)}>{t(runStatusKey(latest.status))}</Badge>}
          title={<span id={`payrun01-run-${eventName}`}>{t('payrun01CalculationState')}</span>}
        />
        {latest.errorCode ? <p className="flex items-start gap-2 text-sm text-destructive"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{t('payrun01RunErrorCode')}: <code>{latest.errorCode}</code></span></p> : null}
        <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetadataItem label={t('payrun01RunId')} value={latest.runId} mono />
          <MetadataItem label={t('payrun01RunType')} value={latest.runType} mono />
          <MetadataItem label={t('payrun01RuleComposition')} value={latest.rulePackageCompositionId} mono />
          <MetadataItem label={t('payrun01EngineVersion')} value={latest.engineVersion} mono />
          <MetadataItem label={t('payrun01SourceHash')} value={latest.sourceHash} mono />
          <MetadataItem label={t('payrun01InputHash')} value={latest.inputHash} mono />
          <MetadataItem label={t('payrun01ResultHash')} value={latest.resultHash ?? '—'} mono />
          <MetadataItem label={t('payrun01CreatedAt')} value={formatDateTime(latest.createdAt, locale)} />
          <MetadataItem label={t('payrun01FinishedAt')} value={formatDateTime(latest.finishedAt, locale)} />
        </dl>

        <div>
          <h3 className="text-sm font-semibold">{t('payrun01PersistedComponents')}</h3>
          {latest.components.length === 0
            ? <p className="mt-2 text-sm text-muted-foreground">{t('payrun01NoComponents')}</p>
            : <ul className="mt-2 divide-y divide-subtle border-y border-subtle">
              {latest.components.map((component) => <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm" key={component.key}>
                <code className="break-all">{component.key}</code>
                <span className="font-mono tabular-nums">{component.amount ?? '—'}</span>
              </li>)}
            </ul>}
        </div>

        <div>
          <h3 className="text-sm font-semibold">{t('payrun01Controls')}</h3>
          {latest.controls.length === 0
            ? <p className="mt-2 text-sm text-muted-foreground">{t('payrun01NoControls')}</p>
            : <ul className="mt-2 space-y-2">
              {latest.controls.map((control) => <li className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-subtle pt-2" key={control.key}>
                <code className="min-w-0 break-all text-sm">{control.key}</code>
                <Badge tone={controlTone(control.status)}>{t(controlStatusKey(control.status))}</Badge>
              </li>)}
            </ul>}
        </div>

        {canWrite && (canReview || canFinalize) ? <div className="flex flex-wrap gap-2 border-t border-subtle pt-4">
          {canReview ? <form action={reviewPayrun01Action}>
            <input name="employeeId" type="hidden" value={candidate.employeeId} />
            <input name="scenarioKind" type="hidden" value={candidate.scenarioKind} />
            <input name="runId" type="hidden" value={latest.runId} />
            <Button type="submit" variant="secondary"><ShieldCheck aria-hidden="true" />{t('payrun01Review')}</Button>
          </form> : null}
          {canFinalize ? <form action={finalizePayrun01Action}>
            <input name="employeeId" type="hidden" value={candidate.employeeId} />
            <input name="scenarioKind" type="hidden" value={candidate.scenarioKind} />
            <input name="runId" type="hidden" value={latest.runId} />
            <Button type="submit"><ShieldCheck aria-hidden="true" />{t('payrun01Finalize')}</Button>
          </form> : null}
        </div> : null}
      </section>

      <section aria-labelledby={`payrun01-downstream-${eventName}`} className="space-y-3 border-t border-subtle pt-5">
        <SectionHeader title={<span id={`payrun01-downstream-${eventName}`}>{t('payrun01DownstreamReadiness')}</span>} />
        <p className="text-sm text-muted-foreground">{t('payrun01DownstreamReadinessDescription')}</p>
        {record.lifecycleReadFailed ? <p className="text-sm text-destructive" role="status">{t('payrun01LifecycleReadUnavailable')}</p> : null}
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <MetadataItem label={t('payrun01PaymentReadiness')} value={t(lifecycle?.paymentStatus === 'DOWNSTREAM_PAYMENT_NOT_ASSESSED' ? 'payrun01PaymentNotAssessed' : 'payrun01NotAssessed')} />
          <MetadataItem label={t('payrun01DeclarationReadiness')} value={t(lifecycle?.declarationStatus === 'DECLARATION_PROJECTION_OUT_OF_SCOPE' ? 'payrun01DeclarationOutOfScope' : 'payrun01NotAssessed')} />
        </dl>
      </section>

      <section aria-labelledby={`payrun01-lifecycle-${eventName}`} className="space-y-3 border-t border-subtle pt-5">
        <SectionHeader title={<span id={`payrun01-lifecycle-${eventName}`}>{t('payrun01Lifecycle')}</span>} />
        {!lifecycle || lifecycle.events.length === 0
          ? <p className="text-sm text-muted-foreground">{t('payrun01NoLifecycleEvents')}</p>
          : <ol className="space-y-2">
            {lifecycle.events.map((lifecycleEvent) => <li className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle pt-2 text-sm" key={`${lifecycleEvent.calculation_run_id}-${lifecycleEvent.event_sequence}`}>
              <span>{eventLabel(lifecycleEvent.event_type, t)}</span>
              <span className="text-muted-foreground">{formatDateTime(lifecycleEvent.created_at, locale)}</span>
            </li>)}
          </ol>}
        {lifecycleMatchesRun && latestLifecycle?.event_type === 'FINALIZED' && latest
          ? <div className="flex flex-wrap gap-3">
            {record.technicalJsonAvailable
              ? <Link className={buttonClasses({ variant: 'secondary' })} href={`/api/payroll-lab/payrun01/${encodeURIComponent(latest.runId)}/artifact/TECHNICAL_JSON`}>{t('payrun01DownloadTechnicalJson')}</Link>
              : record.technicalJsonReadFailed
                ? <p className="text-sm text-destructive" role="status">{t('payrun01TechnicalJsonUnavailable')}</p>
                : canWrite
                  ? <form action={generatePayrun01TechnicalJsonAction}>
                    <input name="employeeId" type="hidden" value={candidate.employeeId} />
                    <input name="scenarioKind" type="hidden" value={candidate.scenarioKind} />
                    <input name="runId" type="hidden" value={latest.runId} />
                    <Button type="submit" variant="secondary">{t('payrun01GenerateTechnicalJson')}</Button>
                  </form>
                  : <p className="text-sm text-muted-foreground">{t('payrun01TechnicalJsonNotGenerated')}</p>}
            {record.payslipPdfAvailable
              ? <Link className={buttonClasses({ variant: 'secondary' })} href={`/api/payroll-lab/payrun01/${encodeURIComponent(latest.runId)}/artifact/PAYSLIP_PDF`}>{t('payrun01DownloadPayslipPdf')}</Link>
              : record.payslipPdfReadFailed
                ? <p className="text-sm text-destructive" role="status">{t('payrun01PayslipPdfUnavailable')}</p>
                : canWrite
                  ? <form action={generatePayrun01PayslipPdfAction}>
                    <input name="employeeId" type="hidden" value={candidate.employeeId} />
                    <input name="scenarioKind" type="hidden" value={candidate.scenarioKind} />
                    <input name="runId" type="hidden" value={latest.runId} />
                    <Button type="submit" variant="secondary">{t('payrun01GeneratePayslipPdf')}</Button>
                  </form>
                  : <p className="text-sm text-muted-foreground">{t('payrun01PayslipPdfNotGenerated')}</p>}
          </div>
          : null}
      </section>
    </> : null}
  </Surface>
}

export default async function Payrun01Page({ searchParams }: { searchParams?: Promise<Payrun01Query> }) {
  const [t, locale, query] = await Promise.all([
    getTranslator('navigation'),
    getLocale(),
    searchParams ?? Promise.resolve<Payrun01Query>({}),
  ])

  let access: Awaited<ReturnType<typeof requireComponentLibraryAccess>> | null = null
  try {
    access = await requireComponentLibraryAccess(false)
  } catch (error) {
    if (isAuthenticationError(error)) redirect('/login')
    if (isAuthorizationError(error)) redirect('/geen-toegang')
  }

  if (!access) {
    return <PageShell className="space-y-6 py-6 sm:py-8" role="status">
      <PageHeader title={t('payrun01Title')} description={t('payrun01Unavailable')} />
    </PageShell>
  }

  let candidates: readonly Payrun01Candidate[] = []
  let candidatesUnavailable = false
  try {
    candidates = await listPayrun01Candidates()
  } catch (error) {
    if (isAuthenticationError(error)) redirect('/login')
    if (isAuthorizationError(error)) redirect('/geen-toegang')
    candidatesUnavailable = true
  }

  let records: CandidateRecord[] = []
  let runReadsUnavailable = false
  try {
    records = await Promise.all(candidates.map(async (candidate): Promise<CandidateRecord> => {
      try {
        const latest = await getLatestPayrun01Payroll(
          access.scope,
          access.administration.id,
          candidate.scenarioKind,
        )
        if (!latest || latest.status !== 'SUCCEEDED') {
          return { candidate, latest, lifecycle: null, runReadFailed: false, lifecycleReadFailed: false, technicalJsonAvailable: false, technicalJsonReadFailed: false, payslipPdfAvailable: false, payslipPdfReadFailed: false }
        }
        try {
          const lifecycle = await getPayrun01Lifecycle({
            scope: access.scope,
            payrollAdministrationId: access.administration.id,
            actorUserId: access.actorUserId,
            employeeId: candidate.employeeId,
            kind: candidate.scenarioKind,
            runId: latest.runId,
          })
          let technicalJsonAvailable = false
          let technicalJsonReadFailed = false
          let payslipPdfAvailable = false
          let payslipPdfReadFailed = false
          if (lifecycle.latestEvent?.event_type === 'FINALIZED'
            && lifecycle.latestEvent.calculation_run_id === latest.runId) {
            try {
              const artifact = await getPayrun01TechnicalJsonArtifact({
                scope: access.scope,
                payrollAdministrationId: access.administration.id,
                actorUserId: access.actorUserId,
                employeeId: candidate.employeeId,
                kind: candidate.scenarioKind,
                runId: latest.runId,
              })
              technicalJsonAvailable = artifact !== null
            } catch (error) {
              if (isAuthenticationError(error) || isAuthorizationError(error)) throw error
              technicalJsonReadFailed = true
            }
            try {
              const artifact = await getPayrun01PayslipPdfArtifactForRun({
                scope: access.scope,
                payrollAdministrationId: access.administration.id,
                actorUserId: access.actorUserId,
                runId: latest.runId,
              })
              payslipPdfAvailable = artifact !== null
            } catch (error) {
              if (isAuthenticationError(error) || isAuthorizationError(error)) throw error
              payslipPdfReadFailed = true
            }
          }
          return { candidate, latest, lifecycle, runReadFailed: false, lifecycleReadFailed: false, technicalJsonAvailable, technicalJsonReadFailed, payslipPdfAvailable, payslipPdfReadFailed }
        } catch (error) {
          if (isAuthenticationError(error) || isAuthorizationError(error)) throw error
          return { candidate, latest, lifecycle: null, runReadFailed: false, lifecycleReadFailed: true, technicalJsonAvailable: false, technicalJsonReadFailed: false, payslipPdfAvailable: false, payslipPdfReadFailed: false }
        }
      } catch (error) {
        if (isAuthenticationError(error) || isAuthorizationError(error)) throw error
        return { candidate, latest: null, lifecycle: null, runReadFailed: true, lifecycleReadFailed: false, technicalJsonAvailable: false, technicalJsonReadFailed: false, payslipPdfAvailable: false, payslipPdfReadFailed: false }
      }
    }))
  } catch (error) {
    if (isAuthenticationError(error)) redirect('/login')
    if (isAuthorizationError(error)) redirect('/geen-toegang')
    runReadsUnavailable = true
  }

  const rawError = singleQueryValue(query.error)
  const errorKey = rawError && Object.hasOwn(ERROR_KEYS, rawError)
    ? ERROR_KEYS[rawError as keyof typeof ERROR_KEYS]
    : null
  const event = singleQueryValue(query.event)
  const requestedRun = singleQueryValue(query.run)
  const requestedArtifact = singleQueryValue(query.artifact)

  return <PageShell className="space-y-6 py-6 sm:py-8" width="standard">
    <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href="/payroll-lab">
      <ArrowLeft aria-hidden="true" className="size-4" />{t('payrollLabBackToOverview')}
    </Link>
    <PageHeader title={t('payrun01Title')} description={t('payrun01Description')} />
    <Surface className="p-4 sm:p-5">
      <SectionHeader title={t('payrun01PeriodHeading')} description={t('payrun01PeriodOctober2026')} />
      <p className="mt-3 text-sm text-muted-foreground">{t('payrun01ScopeNote')}</p>
    </Surface>

    {errorKey ? <Surface className="border-destructive/40 p-4 text-sm text-destructive" role="alert">{t(errorKey)}</Surface> : null}
    {candidatesUnavailable || runReadsUnavailable ? <Surface className="border-warning/40 p-4 text-sm" role="status">{t('payrun01DataUnavailable')}</Surface> : null}

    <section aria-labelledby="payrun01-personas" className="space-y-4">
      <SectionHeader title={<span id="payrun01-personas">{t('payrun01PersonasTitle')}</span>} description={t('payrun01PersonasDescription')} />
      {!candidatesUnavailable && candidates.length === 0
        ? <Surface className="p-5 text-sm text-muted-foreground" role="status">{t('payrun01NoCandidates')}</Surface>
        : <div className="grid gap-4">
          {records.map((record) => <CandidatePanel
            canWrite={access.canCopy}
            event={event}
            key={record.candidate.employeeId}
            locale={locale}
            record={record}
            requestedRun={requestedRun}
            requestedArtifact={requestedArtifact}
            t={t}
          />)}
        </div>}
    </section>
  </PageShell>
}
