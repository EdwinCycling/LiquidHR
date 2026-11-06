import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { PayrollProForma } from '@/components/payroll/payroll-pro-forma'
import { AuthenticationError, AuthorizationError, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export default async function MySalaryProFormaPage() {
  try {
    const context = await requireAuthContext()
    if (!context.employeeId) throw new AuthorizationError('Persoonlijke salarisgegevens zijn niet beschikbaar.')
    await requirePermission('salary:read', context.employeeId)
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }
  const [locale, t] = await Promise.all([getLocale(), getTranslator('payrollProfessional')])
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader description={t('proFormaDescription')} title={t('proFormaTitle')} />
    <PayrollProForma locale={locale} labels={{
      scenarioType: t('proFormaScenarioType'), bonus: t('proFormaBonus'), extraPaidHours: t('proFormaExtraPaidHours'),
      salaryIncrease: t('proFormaSalaryIncrease'), contractHours: t('proFormaContractHours'), amount: t('proFormaAmount'),
      hours: t('proFormaHours'), percentage: t('proFormaPercentage'), hoursPerWeek: t('proFormaHoursPerWeek'),
      calculate: t('proFormaCalculate'), calculating: t('proFormaCalculating'), baseline: t('proFormaBaseline'),
      scenario: t('proFormaScenario'), difference: t('proFormaDifference'), metric: t('proFormaMetric'), gross: t('gross'),
      employeePension: t('pension'), employerPension: t('employerPension'), taxableWage: t('taxableWage'),
      wageTax: t('tax'), net: t('net'), employerCosts: t('totalEmployerCost'), sourceReady: t('proFormaSourceReady'),
      sourceGap: t('proFormaSourceGap'), sourceIncomplete: t('proFormaSourceIncomplete'),
      scenarioUnsupported: t('proFormaScenarioUnsupported'), calculationFailed: t('proFormaCalculationFailed'),
      warning: t('proFormaWarning'), explanation: t('proFormaExplanation'), sourceHash: t('proFormaSourceHash'),
      inputHash: t('proFormaInputHash'), resultHash: t('proFormaResultHash'), traceSteps: t('proFormaTraceSteps'),
      serviceUnavailable: t('proFormaServiceUnavailable'), period: t('period'),
    }} />
  </PageShell>
}
