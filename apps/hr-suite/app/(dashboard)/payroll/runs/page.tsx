import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunSummaryList } from '@/components/payroll/payroll-professional-view'
import { PayrollProfessionalRunWorkbench } from '@/components/payroll/payroll-professional-run-workbench'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listPayrollProfessionalRuns } from '@/lib/payroll/payroll-professional-service'
import { getPayrollProfessionalRunWorkspace } from '@/lib/payroll/payroll-professional-run-service'

const workbenchLabelKeys = [
  'runWorkspaceTitle','runWorkspaceDescription','administration','period','noSelectedPeriod','selectPeriod','showPeriod',
  'period_OPEN','period_DRAFT','period_CLOSED','periodStatusUnknown','noPeriods','periodNotOpen','selectEmployees',
  'employmentNumber','noEmployeesForPeriod','rosterTooLarge','calculating','calculateSelected','conceptRunHint',
  'batchResults','incompleteNetNotice','gross','wageTaxWithheld','remainingAfterWageTax','employerCost','notCalculated',
  'missingData','missingSalary','missingSchedule','missingContract','missingLaborConditions','missingIncomeRelationship',
  'missingTaxProfile','missingActualWork','missingSupportedRules','missingOtherData','unsupported_missingSalary',
  'unsupported_missingSchedule','unsupported_missingContract','unsupported_missingLaborConditions',
  'unsupported_missingIncomeRelationship','unsupported_missingTaxProfile','unsupported_missingActualWork',
  'unsupported_missingSupportedRules','unsupportedOtherData','missingEmployeePension','missingEmployerPension',
  'missingEmployerCosts','missingReserves','missingCumulativeTax','missingVariableWage','calculation_SOURCE_GAP',
  'calculation_UNSUPPORTED','calculation_INCOMPLETE','calculation_CALCULATED','calculation_FAILED',
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
  const [runs, t, locale, workspace] = await Promise.all([
    listPayrollProfessionalRuns(),
    getTranslator('payrollProfessional'),
    getLocale(),
    getPayrollProfessionalRunWorkspace(periodKey),
  ])
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('runs')} description={t('runsDescription')} />
    <PayrollProfessionalNavigation active="runs" labels={nav} />
    <PayrollProfessionalRunWorkbench
      administrationName={workspace.administrationName}
      periods={workspace.periods}
      selectedPeriod={workspace.selectedPeriod}
      employees={workspace.employees}
      rosterComplete={workspace.rosterComplete}
      locale={locale}
      labels={Object.fromEntries(workbenchLabelKeys.map((key) => [key, t(key)]))}
    />
    <PayrollRunSummaryList runs={runs} labels={Object.fromEntries(['empty','period','employee','status','runId','action','openDetail','runHashesHint','run_SUCCEEDED','run_FAILED','run_RUNNING','run_PENDING'].map((key) => [key, t(key)]))} />
  </PageShell>
}
