import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunReconciliation } from '@/components/payroll/payroll-professional-view'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getPayrollProfessionalRun } from '@/lib/payroll/payroll-professional-service'

export default async function PayrollRunDetailPage({ params }: { readonly params: Promise<{ readonly runId: string }> }) {
  const { runId } = await params
  const [run, t, locale] = await Promise.all([getPayrollProfessionalRun(runId), getTranslator('payrollProfessional'), getLocale()])
  if (!run) notFound()
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  const labels = Object.fromEntries([
    'gross','net','sourceHash','inputHash','resultHash','engine','notAvailable','employeeArithmetic','employerCost','cumulative','otherComponents','controls','calculationTrace','lifecycle','finalized','notFinalized','notSucceeded','downloadJson','downloadPdf','compare','component','liquidHr','external','difference','exact','cent','larger','manualComparisonHint',
    'contractual_salary','additional_cash_amount','additional_hours_pay','gross_salary','employee_pension','taxable_wage','employee_insurance_wage','zvw_wage','wage_tax','net_salary','employer_insurance','employer_pension','holiday_allowance_reserve','holiday_reserve','year_end_reserve','total_employer_cost','cumulative_gross','cumulative_holiday_reserve','cumulative_year_end_reserve','control_PASS','control_WARN','control_FAIL','event_BLOCKED','event_CONCEPT','event_REVIEWED','event_FINALIZED',
    'expandCalculation','componentCode','componentVersion','notRecorded','effectivePeriod','processingScope','INCOME_RELATIONSHIP','assessmentInputs','noPersistedInputs','savedResult','roundingMethod','decimalPlaces','rulePackage','ruleSource','calculationProvenance','traceStep','calculationSource','persistedCalculationTrace','dependencies','noComponentTrace','formula','formulaNotRecorded','formulaGrossWage','formulaTaxableWage','formulaWageTaxTable','formulaEmployerInsurance','formulaNetPay','formulaReserve','formulaCumulative','formulaTotalEmployerCost','assessmentBaseTimesRate','employerPremiumBreakdown','premium_awf','premium_aof','premium_whk','premium_wko','premium_zvw','assessmentBase','percentage','reconciliationFlow','employeeReconciliationFormula','employerReconciliationFormula','distinctFiscalBases','fiscalBaseWageTax','fiscalBaseEmployeeInsurance','fiscalBaseZvw','notCalculated','finalizedStatus','conceptStatus','pensionReadinessTitle','pensionReadinessWarning','pensionSourceVerificationRequired','netNotDefinitive','pensionCalculationDetail','ruleProvenance','ruleReference','unroundedValue','fiscalYear','table','timePeriod','residence','fullPeriod','payrollTaxCredit','grossSalary','additionalCashAmount','wageTaxBase','wageTax','rate','amount','annualizationMonths','fullTimeMonthlyPensionableSalary','ageForTier','partTimeFactor','annualFranchise','adjustedFranchise','annualPensionableSalaryCap','cappedPensionableSalary','selectedTierMinAge','selectedTierMaxAge','annualRatePercent','annualPensionableBase','monthlyTotal','employeeSharePercent','employerSharePercent','pension_PENSION_ANNUALIZED_PENSIONABLE_SALARY','pension_PENSION_PENSIONABLE_BASE','pension_PENSION_AGE_TIER_RATE','pension_PENSION_MONTHLY_TOTAL','pension_PENSION_EMPLOYEE_SHARE','pension_PENSION_EMPLOYER_SHARE','pension_PENSION_EMPLOYEE_TAX_ASSESSMENT_BASES','PAYRUN01-CTRL-009-PENSION-RULE-READY',
  ].map((key) => [key, t(key)]))
  const period = `${run.payrollPeriod.period_year}-${String(run.payrollPeriod.period_month).padStart(2, '0')}`
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('reconciliation')} description={t('reconciliationDescription', { period })} />
    <PayrollProfessionalNavigation active="runs" labels={nav} />
    <Surface className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{t('employee')} · {run.sourceSnapshot.source_employee_id.slice(-8)}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{t('runId')}: {run.run.id}</p></div><Link href="/payroll/runs" className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t('backToRuns')}</Link></div>
      <PayrollRunReconciliation run={run} locale={locale} labels={labels} />
    </Surface>
  </PageShell>
}
