import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { PayrollStoredPayslipViewer } from '@/components/payroll/payroll-stored-payslip-viewer'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { PayrollRunReconciliation } from '@/components/payroll/payroll-professional-view'
import { finalizePayrollRun, generatePayrollPayslipPdfArtifact, reviewPayrollRun } from '../actions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import {
  getPayrollProfessionalPayslipPdfArtifactStatusForRun,
  getPayrollProfessionalRun,
} from '@/lib/payroll/payroll-professional-service'

export default async function PayrollRunDetailPage({ params, searchParams: searchParamsPromise }: {
  readonly params: Promise<{ readonly runId: string }>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { runId } = await params
  const [run, t, locale, queryParams, tDocuments] = await Promise.all([
    getPayrollProfessionalRun(runId), getTranslator('payrollProfessional'), getLocale(), searchParamsPromise, getTranslator('documents'),
  ])
  if (!run) notFound()
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  const labels = Object.fromEntries([
    'gross','net','netAfterTaxIncomplete','sourceHash','inputHash','resultHash','engine','notAvailable','employeeArithmetic','employerCost','cumulative','otherComponents','controls','calculationTrace','lifecycle','finalized','notFinalized','notSucceeded','downloadJson','downloadPdf','viewStandardPayslip','downloadStandardPayslip','generatePersistedPayslip','persistedPayslipAvailable','downloadPersistedPayslip','persistedPayslipGenerationFailed','persistedPayslipReadbackFailed','compare','component','liquidHr','external','difference','exact','cent','larger','manualComparisonHint',
    'contractual_salary','additional_cash_amount','additional_hours_pay','gross_salary','employee_pension','taxable_wage','employee_insurance_wage','zvw_wage','wage_tax','net_salary','employer_insurance','employer_pension','holiday_allowance_reserve','holiday_reserve','year_end_reserve','total_employer_cost','cumulative_gross','cumulative_holiday_reserve','cumulative_year_end_reserve','control_PASS','control_WARN','control_FAIL','event_BLOCKED','event_CONCEPT','event_REVIEWED','event_FINALIZED',
    'expandCalculation','componentCode','componentVersion','notRecorded','effectivePeriod','processingScope','INCOME_RELATIONSHIP','assessmentInputs','noPersistedInputs','savedResult','roundingMethod','decimalPlaces','rulePackage','ruleSource','calculationProvenance','traceStep','calculationSource','persistedCalculationTrace','dependencies','noComponentTrace','formula','formulaNotRecorded','formulaGrossWage','formulaTaxableWage','formulaWageTaxTable','formulaEmployerInsurance','formulaNetPay','formulaReserve','formulaCumulative','formulaTotalEmployerCost','assessmentBaseTimesRate','employerPremiumBreakdown','premium_awf','premium_aof','premium_whk','premium_wko','premium_zvw','assessmentBase','percentage','reconciliationFlow','employeeReconciliationFormula','employerReconciliationFormula','distinctFiscalBases','fiscalBaseWageTax','fiscalBaseEmployeeInsurance','fiscalBaseZvw','notCalculated','finalizedStatus','conceptStatus','pensionReadinessTitle','pensionReadinessWarning','pensionSourceVerificationRequired','netNotDefinitive','pensionCalculationDetail','ruleProvenance','ruleReference','unroundedValue','fiscalYear','table','timePeriod','residence','fullPeriod','payrollTaxCredit','grossSalary','additionalCashAmount','wageTaxBase','wageTax','rate','amount','annualizationMonths','fullTimeMonthlyPensionableSalary','ageForTier','partTimeFactor','annualFranchise','adjustedFranchise','annualPensionableSalaryCap','cappedPensionableSalary','selectedTierMinAge','selectedTierMaxAge','annualRatePercent','annualPensionableBase','monthlyTotal','employeeSharePercent','employerSharePercent','pension_PENSION_ANNUALIZED_PENSIONABLE_SALARY','pension_PENSION_PENSIONABLE_BASE','pension_PENSION_AGE_TIER_RATE','pension_PENSION_MONTHLY_TOTAL','pension_PENSION_EMPLOYEE_SHARE','pension_PENSION_EMPLOYER_SHARE','pension_PENSION_EMPLOYEE_TAX_ASSESSMENT_BASES','cumulative_taxable_wage','cumulative_wage_tax','cumulative_employee_insurance_wage','cumulative_zvw_wage','net_reimbursement','net_deduction','net_correction','variable_regular_wage','special_reward_wage','special_reward_wage_tax','pensionable_wage','PAYRUN01-CTRL-009-PENSION-RULE-READY','payslipPdfUnavailable','savePayslipPdf','savingPayslipPdf','storedPayslipPdf','verifyPayslipPdf','payslipPdfMetadata',
  ].map((key) => [key, t(key)]))
  const period = `${run.payrollPeriod.period_year}-${String(run.payrollPeriod.period_month).padStart(2, '0')}`
  const runEvents = run.lifecycleEvents.filter((event) => event.calculation_run_id === runId)
  const latestEvent = [...runEvents].sort((left, right) => right.event_sequence - left.event_sequence)[0]
  const payslipArtifact = latestEvent?.event_type === 'FINALIZED'
    ? await getPayrollProfessionalPayslipPdfArtifactStatusForRun(runId)
    : null
  const controlsPass = run.controls.every((control) => control.status === 'PASS')
  const canReview = run.canTransition && run.run.status === 'SUCCEEDED' && controlsPass
    && latestEvent?.event_type === 'CONCEPT' && latestEvent.event_sequence === 1
  const canFinalize = run.canTransition && run.run.status === 'SUCCEEDED' && controlsPass
    && latestEvent?.event_type === 'REVIEWED' && latestEvent.event_sequence === 2
  const lifecycleValue = queryParams.lifecycle
  const lifecycleOutcome = typeof lifecycleValue === 'string' ? lifecycleValue : undefined
  const artifactOutcome = typeof queryParams.artifact === 'string' ? queryParams.artifact : undefined
  const lifecycleMessage = lifecycleOutcome === 'reviewed' ? t('transitionReviewed')
    : lifecycleOutcome === 'finalized' ? t('transitionFinalized')
      : lifecycleOutcome === 'incomplete' ? t('transitionIncomplete')
        : lifecycleOutcome === 'sourceChanged' ? t('transitionSourceChanged')
          : lifecycleOutcome === 'accessDenied' ? t('transitionAccessDenied')
            : lifecycleOutcome === 'transitionInvalid' || lifecycleOutcome === 'invalid' ? t('transitionInvalid')
              : lifecycleOutcome === 'failed' ? t('transitionFailed') : null
  const artifactMessage = artifactOutcome === 'created'
    ? payslipArtifact ? t('persistedPayslipAvailable') : t('persistedPayslipReadbackFailed')
    : artifactOutcome === 'failed' ? t('persistedPayslipGenerationFailed') : null
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('reconciliation')} description={t('reconciliationDescription', { period })} />
    <PayrollProfessionalNavigation active="runs" labels={nav} />
    <Surface className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{t('employee')} · {run.sourceSnapshot.source_employee_id.slice(-8)}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{t('runId')}: {run.run.id}</p></div><Link href="/payroll/runs" className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t('backToRuns')}</Link></div>
      {lifecycleMessage ? <p role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{lifecycleMessage}</p> : null}
      {canReview ? <form action={reviewPayrollRun}>
        <input type="hidden" name="runId" value={run.run.id} />
        <input type="hidden" name="employeeId" value={run.sourceSnapshot.source_employee_id} />
        <input type="hidden" name="employmentId" value={run.sourceSnapshot.source_employment_id} />
        <input type="hidden" name="period" value={period} />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t('reviewRun')}</button>
      </form> : null}
      {canFinalize ? <form action={finalizePayrollRun}>
        <input type="hidden" name="runId" value={run.run.id} />
        <input type="hidden" name="employeeId" value={run.sourceSnapshot.source_employee_id} />
        <input type="hidden" name="employmentId" value={run.sourceSnapshot.source_employment_id} />
        <input type="hidden" name="period" value={period} />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t('finalizeRun')}</button>
      </form> : null}
      {latestEvent?.event_type === 'FINALIZED' ? <div className="space-y-2 rounded-md border border-border p-3">
        {artifactMessage ? <p role="status" className="text-sm">{artifactMessage}</p> : null}
        {payslipArtifact ? <>
          <p className="text-sm text-muted-foreground">{payslipArtifact.fileName} · {payslipArtifact.sizeBytes} bytes · SHA-256 {payslipArtifact.sha256}</p>
          <PayrollStoredPayslipViewer
            filename={payslipArtifact.fileName}
            labels={{
              close: tDocuments('viewerClose'),
              download: tDocuments('download'),
              previewLoading: tDocuments('viewerPreviewLoading'),
              previewRetry: tDocuments('viewerPreviewRetry'),
              previewUnavailable: tDocuments('viewerPreviewUnavailable'),
              unsupported: tDocuments('viewerUnsupported'),
              view: tDocuments('view'),
            }}
            period={period}
            runId={run.run.id}
          />
          <Link href={`/api/payroll/runs/${encodeURIComponent(run.run.id)}/artifact/PAYSLIP_PDF`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t('downloadPersistedPayslip')}</Link>
        </> : <form action={generatePayrollPayslipPdfArtifact}>
          <input type="hidden" name="runId" value={run.run.id} />
          <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm font-medium">{t('generatePersistedPayslip')}</button>
        </form>}
      </div> : null}
      <PayrollRunReconciliation run={run} locale={locale} labels={labels} />
    </Surface>
  </PageShell>
}
