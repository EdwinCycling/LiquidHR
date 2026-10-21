import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Button } from '@/components/ui/button'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunSummaryList } from '@/components/payroll/payroll-professional-view'
import { PayrollProfessionalRunWorkbench } from '@/components/payroll/payroll-professional-run-workbench'
import { getLocale, getTranslator } from '@/lib/i18n/server'
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
  const pageCopyPromise = Promise.all([getTranslator('payrollProfessional'), getLocale()])
  const pageDataPromise = Promise.all([
    listPayrollProfessionalRuns(),
    getPayrollProfessionalRunWorkspace(periodKey),
  ]).then(([runs, workspace]) => ({ ok: true as const, runs, workspace }))
    .catch((error: unknown) => ({ ok: false as const, error }))
  const [pageData, [t, locale]] = await Promise.all([pageDataPromise, pageCopyPromise])
  if (!pageData.ok) {
    const message = pageData.error instanceof AuthorizationError
      ? t('runWorkspaceAccessDenied')
      : t('runWorkspaceLoadFailed')
    return <PageShell className="space-y-6 py-6 sm:py-8">
      <PageHeader title={t('runs')} description={t('runsDescription')} />
      <section aria-labelledby="payroll-runs-error-title" className="space-y-4 rounded-[var(--radius-surface)] border border-destructive/30 bg-destructive-surface p-4">
        <h2 className="text-base font-semibold" id="payroll-runs-error-title">{t('runWorkspaceErrorTitle')}</h2>
        <p aria-live="assertive" className="text-sm text-destructive" role="alert">{message}</p>
        <form action="/payroll/runs" method="get">
          <Button type="submit" variant="secondary">{t('runWorkspaceRetry')}</Button>
        </form>
      </section>
    </PageShell>
  }
  const { runs, workspace } = pageData
  const recalculationMessage = recalculationOutcome && [
    'calculated','incomplete','sourceGap','unsupported','correctionRequired','inProgress','accessDenied','invalid','failed',
  ].includes(recalculationOutcome) ? t(`recalculation_${recalculationOutcome}`) : null
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('runs')} description={t('runsDescription')} />
    <PayrollProfessionalNavigation active="runs" labels={nav} />
    <PayrollProfessionalRunWorkbench
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
    {recalculationMessage ? <p role="status" aria-live="polite" className="rounded-[var(--radius-surface)] border border-border-subtle p-4 text-sm">{recalculationMessage}</p> : null}
    <PayrollRunSummaryList runs={runs} labels={Object.fromEntries(['empty','period','employee','status','runId','action','openDetail','runHashesHint','run_SUCCEEDED','run_FAILED','run_RUNNING','run_PENDING'].map((key) => [key, t(key)]))} />
  </PageShell>
}
