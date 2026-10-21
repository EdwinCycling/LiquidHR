import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Button } from '@/components/ui/button'
import { Suspense } from 'react'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunSummaryList } from '@/components/payroll/payroll-professional-view'
import { PayrollProfessionalRunWorkbench } from '@/components/payroll/payroll-professional-run-workbench'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import type { Translator } from '@/lib/i18n/translator'
import { AuthorizationError } from '@/lib/auth/permissions'
import { listPayrollProfessionalRuns } from '@/lib/payroll/payroll-professional-service'
import { getPayrollProfessionalRunWorkspace } from '@/lib/payroll/payroll-professional-run-service'

const workbenchLabelKeys = [
  'runWorkspaceTitle','runWorkspaceDescription','administration','period','noSelectedPeriod','selectPeriod','showPeriod',
  'openPeriodTitle','openPeriodDescription','openPeriodMonth','openPeriodAction','openPeriodOpening','openPeriodInvalid',
  'openPeriodClosed','openPeriodAccessDenied','openPeriodFailed',
  'period_OPEN','period_DRAFT','period_CLOSED','periodStatusUnknown','noPeriods','periodNotOpen','selectEmployees',
  'employmentNumber','employmentRange','primaryEmployment','secondaryEmployment','unknownDate','currentEmployment',
  'noEmployeesForPeriod','rosterTooLarge','calculating','calculateSelected','calculateEmployee','recalculateEmployee',
  'reviewEmployee','finalizeEmployee','openPayslip','openDetail','conceptRunHint',
  'periodSummaryTitle','periodSummaryDescription','periodStatusLabel','employeesTotal','grossTotal','netTotal',
  'employerCostsTotal','exceptionsSummary','exceptions','noExceptions','lastCalculated','notCalculatedYet','noAmount',
  'status_NOT_CALCULATED','status_CONCEPT','status_REVIEWED','status_FINALIZED','status_BLOCKED',
  'sourceDiagnostics','sourceCategory','errorCode','correlationId','diagnosticUnavailable',
  'controlException','calculationException','staleException','correctionSuccessor',
  'batchResults','incompleteNetNotice','gross','net','wageTaxWithheld','remainingAfterWageTax','employerCost','notCalculated',
  'missingData','missingSalary','missingSchedule','missingContract','missingLaborConditions','missingIncomeRelationship',
  'missingTaxProfile','missingActualWork','missingSupportedRules','missingOtherData','unsupported_missingSalary',
  'unsupported_missingSchedule','unsupported_missingContract','unsupported_missingLaborConditions',
  'unsupported_missingIncomeRelationship','unsupported_missingTaxProfile','unsupported_missingActualWork',
  'unsupported_missingSupportedRules','unsupportedOtherData','missingEmployeePension','missingEmployerPension',
  'missingEmployerCosts','missingReserves','missingCumulativeTax','missingVariableWage','calculation_SOURCE_GAP',
  'calculation_UNSUPPORTED','calculation_INCOMPLETE','calculation_CALCULATED','calculation_CORRECTION_REQUIRED','calculation_FAILED',
  'batch_emptySelection','batch_tooManySelected','batch_periodUnavailable','batch_scopeChanged','batch_sourceNotReady','batch_partial',
  'batch_accessDenied','batch_failed','batch_success',
]

function PayrollDataLoading({ label, rows }: { readonly label: string; readonly rows: number }) {
  return <section aria-busy="true" aria-label={label} className="space-y-3">
    <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{label}</p>
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: rows }, (_, index) => <div className="h-14 animate-pulse rounded-[var(--radius-surface)] border border-border-subtle bg-surface-subtle" key={index} />)}
    </div>
  </section>
}

function PayrollDataError({ t, id, error, periodKey }: {
  readonly t: Translator
  readonly id: string
  readonly error: unknown
  readonly periodKey?: string
}) {
  const message = error instanceof AuthorizationError
    ? t('runWorkspaceAccessDenied')
    : t('runWorkspaceLoadFailed')
  return <section aria-labelledby={id} className="space-y-4 rounded-[var(--radius-surface)] border border-destructive/30 bg-destructive-surface p-4">
    <h2 className="text-base font-semibold" id={id}>{t('runWorkspaceErrorTitle')}</h2>
    <p aria-live="assertive" className="text-sm text-destructive" role="alert">{message}</p>
    <form action="/payroll/runs" method="get">
      {periodKey ? <input name="period" type="hidden" value={periodKey} /> : null}
      <Button type="submit" variant="secondary">{t('runWorkspaceRetry')}</Button>
    </form>
  </section>
}

function PayrollRunListContent({ t, runs, error, periodKey }: {
  readonly t: Translator
  readonly runs: Awaited<ReturnType<typeof listPayrollProfessionalRuns>> | null
  readonly error: unknown | null
  readonly periodKey?: string
}) {
  if (error !== null) return <PayrollDataError t={t} id="payroll-runs-list-error-title" error={error} periodKey={periodKey} />
  return <PayrollRunSummaryList runs={runs ?? []} labels={Object.fromEntries(['empty','period','employee','status','runId','action','openDetail','runHashesHint','run_SUCCEEDED','run_FAILED','run_RUNNING','run_PENDING'].map((key) => [key, t(key)]))} />
}

async function PayrollRunWorkspaceContent({
  t,
  locale,
  periodKey,
}: {
  readonly t: Translator
  readonly locale: Awaited<ReturnType<typeof getLocale>>
  readonly periodKey?: string
}) {
  try {
    const workspace = await getPayrollProfessionalRunWorkspace(periodKey)
    return <PayrollProfessionalRunWorkbench
      administrationName={workspace.administrationName}
      periods={workspace.periods}
      selectedPeriod={workspace.selectedPeriod}
      employees={workspace.employees}
      summary={workspace.summary}
      rosterComplete={workspace.rosterComplete}
      canOpenPayrollCycle={workspace.canOpenPayrollCycle}
      locale={locale}
      labels={Object.fromEntries(workbenchLabelKeys.map((key) => [key, t(key)]))}
    />
  } catch (error) {
    return <PayrollDataError t={t} id="payroll-run-workspace-error-title" error={error} periodKey={periodKey} />
  }
}

export default async function PayrollRunsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const periodValue = query.period
  const periodKey = typeof periodValue === 'string' ? periodValue : Array.isArray(periodValue) ? periodValue[0] : undefined
  const recalculationValue = query.recalculation
  const recalculationOutcome = typeof recalculationValue === 'string' ? recalculationValue : undefined
  const runListPromise = listPayrollProfessionalRuns()
    .then((runs) => ({ ok: true as const, runs }))
    .catch((error: unknown) => ({ ok: false as const, error }))
  const [t, locale, runList] = await Promise.all([
    getTranslator('payrollProfessional'),
    getLocale(),
    runListPromise,
  ])
  const recalculationMessage = recalculationOutcome && [
    'calculated','incomplete','sourceGap','unsupported','correctionRequired','inProgress','accessDenied','invalid','failed',
  ].includes(recalculationOutcome) ? t(`recalculation_${recalculationOutcome}`) : null
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('runs')} description={t('runsDescription')} />
    <PayrollProfessionalNavigation active="runs" labels={nav} />
    {recalculationMessage ? <p role="status" aria-live="polite" className="rounded-[var(--radius-surface)] border border-border-subtle p-4 text-sm">{recalculationMessage}</p> : null}
    <PayrollRunListContent t={t} runs={runList.ok ? runList.runs : null} error={runList.ok ? null : runList.error} periodKey={periodKey} />
    <Suspense fallback={<PayrollDataLoading label={t('runWorkspaceLoading')} rows={2} />}>
      <PayrollRunWorkspaceContent t={t} locale={locale} periodKey={periodKey} />
    </Suspense>
  </PageShell>
}
