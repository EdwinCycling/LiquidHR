import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import { createPayrollCalculationRepository } from '@/lib/payroll/calculation-repository'
import {
  isLocalPayrollAcceptanceRuntime,
  isLocalPayrollAcceptanceScope,
  LOCAL_PAYROLL_ACCEPTANCE_PERIOD,
} from '@/lib/payroll/local-payroll-acceptance-runtime'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { LocalPayrollAcceptanceWorkbench } from './workbench'

const labelKeys = [
  'localAcceptanceTitle','localAcceptanceDescription','localAcceptanceScope','localAcceptancePeriod',
  'localAcceptanceRestricted','localAcceptanceAssumptions','localAcceptanceAssumptionsDetail','localAcceptanceAssumptionsSummary',
  'localAcceptancePeriodOpen','localAcceptancePeriodMissing','localAcceptancePeriodDraft','localAcceptancePeriodClosed',
  'localAcceptanceOpenPeriod','localAcceptanceOpeningPeriod','localAcceptancePeriodOpened','localAcceptancePeriodAlreadyOpen',
  'localAcceptanceOpenFailed','localAcceptanceAccessDenied','localAcceptanceUnavailable','localAcceptanceFailed',
  'localAcceptanceRun','localAcceptanceRunning','localAcceptancePreflightBlocked','localAcceptanceSaved',
  'localAcceptancePartial','localAcceptancePreflight','localAcceptanceCandidate','localAcceptanceEligible',
  'calculation_FAILED',
  'localAcceptanceBlockedReadOnly','localAcceptanceGaps','localAcceptanceResults','localAcceptanceConcept',
  'localAcceptanceIncomplete','localAcceptanceGross','localAcceptanceWageTax','localAcceptanceAfterWageTax',
  'localAcceptanceNotNet','localAcceptanceIdempotent','localAcceptanceIdempotentYes','localAcceptanceIdempotentNo',
  'localAcceptanceProvenance','localAcceptanceRunId','localAcceptanceSourceSnapshotId','localAcceptanceInputSetId',
  'localAcceptanceInputReferenceId','localAcceptanceTraceId','localAcceptanceConceptEventId',
  'localAcceptanceComponentCount','localAcceptanceControlCount','localAcceptanceControls','localAcceptanceStatus',
  'control_PASS','control_WARN','control_FAIL',
  'localAcceptanceSourceHash','localAcceptanceCoreSourceHash','localAcceptanceAssumptionsHash',
  'localAcceptanceInputHash','localAcceptanceResultHash','localAcceptanceMissing',
  'localAcceptanceMissingEmployeePension','localAcceptanceMissingEmployerPension',
  'localAcceptanceMissingEmployerCosts','localAcceptanceMissingReserves','localAcceptanceMissingCumulativeTax',
  'localAcceptanceMissingVariableWage','localAcceptanceNoEmployerCosts','localAcceptanceOracleMatches',
  'localAcceptanceOracleMismatch','localAcceptanceSalaryMismatch','localAcceptanceUnknownGap',
] as const

export default async function LocalPayrollAcceptancePage() {
  const host = (await headers()).get('host')
  if (!isLocalPayrollAcceptanceRuntime(host)) notFound()

  let access: Awaited<ReturnType<typeof requireComponentLibraryAccess>>
  try {
    access = await requireComponentLibraryAccess(true)
  } catch {
    notFound()
  }
  if (!isLocalPayrollAcceptanceScope(access.scope, access.administration.id)) notFound()

  const repository = createPayrollCalculationRepository()
  const period = await repository.getPayrollPeriod(
    access.scope,
    access.administration.id,
    LOCAL_PAYROLL_ACCEPTANCE_PERIOD.year,
    LOCAL_PAYROLL_ACCEPTANCE_PERIOD.month,
  )
  const [t, locale] = await Promise.all([getTranslator('payrollProfessional'), getLocale()])
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(key)]))
  const periodStatusLabel = period?.status === 'OPEN'
    ? t('localAcceptancePeriodOpen')
    : period?.status === 'DRAFT'
      ? t('localAcceptancePeriodDraft')
      : period?.status === 'CLOSED'
        ? t('localAcceptancePeriodClosed')
        : t('localAcceptancePeriodMissing')
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('localAcceptanceTitle')} description={t('localAcceptanceDescription')} />
    <LocalPayrollAcceptanceWorkbench
      periodStatus={period?.status ?? null}
      periodStatusLabel={periodStatusLabel}
      locale={locale}
      labels={labels}
    />
  </PageShell>
}
