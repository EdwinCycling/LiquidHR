import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { PayrollProForma } from '@/components/payroll/payroll-pro-forma'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export async function PayrollProFormaView({ endpoint }: { readonly endpoint: string }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslator('payrollProfessional')])
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader description={t('proFormaDescription')} title={t('proFormaTitle')} />
    <PayrollProForma locale={locale} endpoint={endpoint} labels={{
      scenarioType: t('proFormaScenarioType'), bonus: t('proFormaBonus'), bonusUnavailable: t('proFormaBonusUnavailable'), extraPaidHours: t('proFormaExtraPaidHours'),
      salaryIncrease: t('proFormaSalaryIncrease'), contractHours: t('proFormaContractHours'), amount: t('proFormaAmount'),
      hours: t('proFormaHours'), percentage: t('proFormaPercentage'), hoursPerWeek: t('proFormaHoursPerWeek'),
      calculate: t('proFormaCalculate'), calculating: t('proFormaCalculating'), baseline: t('proFormaBaseline'),
      scenario: t('proFormaScenario'), difference: t('proFormaDifference'), metric: t('proFormaMetric'), gross: t('gross'),
      employeePension: t('pension'), employerPension: t('employerPension'), taxableWage: t('taxableWage'),
      wageTax: t('tax'), net: t('net'), employerCosts: t('totalEmployerCost'), sourceReady: t('proFormaSourceReady'),
      sourceGap: t('proFormaSourceGap'), sourceIncomplete: t('proFormaSourceIncomplete'),
      scenarioUnsupported: t('proFormaScenarioUnsupported'), calculationFailed: t('proFormaCalculationFailed'),
      warning: t('proFormaWarning'), explanation: t('proFormaExplanation'), inputInstruction: t('proFormaInputInstruction'),
      noResult: t('proFormaNoResult'), paySlip: t('proFormaPaySlip'), netDifference: t('proFormaNetDifference'),
      sourceHash: t('proFormaSourceHash'),
      inputHash: t('proFormaInputHash'), resultHash: t('proFormaResultHash'), traceSteps: t('proFormaTraceSteps'),
      serviceUnavailable: t('proFormaServiceUnavailable'), period: t('period'),
    }} />
  </PageShell>
}
