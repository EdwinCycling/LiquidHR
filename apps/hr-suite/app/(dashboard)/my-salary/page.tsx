import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { EmployeePayslips } from '@/components/documents/employee-payslips'
import { parseImportedPayslipMonth, type EmployeePayslipDocument } from '@/components/documents/payslip-periods'
import { MySalaryDashboard } from '@/components/payroll/my-salary-dashboard'
import { AuthenticationError, AuthorizationError, requireAuthContext } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { listEmployeePayslips } from '@/lib/documents/payslip-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getMySalaryStatements } from '@/lib/payroll/payroll-professional-service'

interface MySalaryPageProps {
  searchParams: Promise<{ period?: string }>
}

const ESS_LABELS: Readonly<Record<string, string>> = {
  contractual_salary: 'contractualSalary', additional_cash_amount: 'additionalPayment', additional_hours_pay: 'additionalHoursPay',
  gross_salary: 'gross', employee_pension: 'pension', taxable_wage: 'taxableWage', employee_insurance_wage: 'employeeInsuranceWage',
  zvw_wage: 'zvwWage', wage_tax: 'tax', net_salary: 'net', employer_insurance: 'employerInsurance',
  employer_pension: 'employerPension', holiday_allowance_reserve: 'holidayReserve', holiday_reserve: 'holidayReserve',
  year_end_reserve: 'yearEndReserve', total_employer_cost: 'totalEmployerCost', cumulative_gross: 'cumulative_gross',
  cumulative_taxable_wage: 'cumulative_taxable_wage', cumulative_wage_tax: 'cumulative_wage_tax',
  cumulative_employee_insurance_wage: 'cumulative_employee_insurance_wage', cumulative_zvw_wage: 'cumulative_zvw_wage',
  cumulative_holiday_reserve: 'cumulative_holiday_reserve', cumulative_year_end_reserve: 'cumulative_year_end_reserve',
}

function payrollPayslip(periodYear: number, periodMonth: number): EmployeePayslipDocument {
  const period = `${periodYear}-${String(periodMonth).padStart(2, '0')}`
  const href = `/api/my-salary/payslips/${period}`
  return {
    id: `payroll:${period}`,
    periodYear,
    periodMonth,
    source: 'PAYROLL',
    contentType: 'application/pdf',
    viewHref: href,
    downloadHref: `${href}?download=1`,
  }
}

export default async function MySalaryPage({ searchParams }: MySalaryPageProps) {
  const { period: requestedPeriod } = await searchParams
  let employeeId: string
  let statements
  try {
    const authContext = await requireAuthContext()
    if (!authContext.employeeId) throw new AuthorizationError('Persoonlijke salarisgegevens zijn niet beschikbaar.')
    employeeId = authContext.employeeId
    statements = await getMySalaryStatements()
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }

  let importedPayslips: Awaited<ReturnType<typeof listEmployeePayslips>> = []
  try {
    importedPayslips = await listEmployeePayslips(employeeId)
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error
  }

  const [locale, t, tDocuments] = await Promise.all([
    getLocale(),
    getTranslator('payrollProfessional'),
    getTranslator('documents'),
  ])
  const initialPeriod = requestedPeriod && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod)
    && statements.some((statement) => `${statement.periodYear}-${String(statement.periodMonth).padStart(2, '0')}` === requestedPeriod)
    ? requestedPeriod
    : statements[0]
      ? `${statements[0].periodYear}-${String(statements[0].periodMonth).padStart(2, '0')}`
      : null
  const componentLabels = Object.fromEntries(Object.entries(ESS_LABELS).map(([key, labelKey]) => [key, t(labelKey)]))
  const payrollDocuments = statements.map((statement) => payrollPayslip(statement.periodYear, statement.periodMonth))
  const importedDocuments: EmployeePayslipDocument[] = importedPayslips.map((payslip) => {
    const href = `/api/employees/${encodeURIComponent(employeeId)}/payslips/${encodeURIComponent(payslip.id)}/download`
    return {
      id: `imported:${payslip.id}`,
      periodYear: payslip.calendar_year,
      periodMonth: parseImportedPayslipMonth(payslip.period_label, payslip.calendar_year),
      source: 'IMPORTED',
      contentType: payslip.content_type,
      viewHref: href,
      downloadHref: href,
    }
  })

  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader description={t('mySalaryDescription')} title={t('mySalary')} />
    <MySalaryDashboard
      initialPeriod={initialPeriod}
      locale={locale}
      statements={statements}
      labels={{
        gross: t('gross'), net: t('net'), period: t('period'), historyEmpty: t('salaryHistoryEmpty'),
        historyEmptyTitle: t('noFinalizedSalary'),
        chartTitle: t('salaryChartTitle'), chartDescription: t('salaryChartDescription'), chartRange: t('salaryChartRange'),
        range6: t('salaryRange6'), range12: t('salaryRange12'), range24: t('salaryRange24'), rangeAll: t('salaryRangeAll'),
        month: t('month'), selectedPeriod: t('salarySelectedPeriod'), previousPeriod: t('salaryPreviousPeriod'),
        noPreviousPeriod: t('salaryNoPreviousPeriod'), comparison: t('salaryComparison'), amountChange: t('salaryAmountChange'),
        percentChange: t('salaryPercentChange'), componentsChanged: t('salaryComponentsChanged'),
        noComponentChanges: t('salaryNoComponentChanges'), salaryBreakdown: t('salaryBreakdown'),
        taxDetails: t('salaryTaxDetails'), taxExplanation: t('salaryTaxExplanation'),
        pensionExplanation: t('salaryPensionExplanation'), allowanceTitle: t('salaryAllowanceDetails'),
        allowanceExplanation: t('salaryAllowanceExplanation'),
        reserves: t('reserves'), reserveExplanation: t('salaryReserveExplanation'),
        employerContributions: t('salaryEmployerContributions'), grossToNetExplanation: t('grossToNetExplanation'),
        grossToNetIntro: t('grossToNetIntro'), pensionDetails: t('salaryPensionDetails'),
        pensionSourceGap: t('salaryPensionSourceGap'), pensionReview: t('salaryPensionReview'),
        pensionTestAssumptions: t('salaryPensionTestAssumptions'),
        pensionExplanationText: t('pensionExplanationText'), netNotDefinitive: t('netNotDefinitive'),
        salaryAmountMissing: t('salaryAmountMissing'),
        changeUp: t('salaryChangeUp'), changeDown: t('salaryChangeDown'), notComparable: t('salaryChangeNotComparable'),
        pensionArrangement: t('salaryPensionArrangement'), pensionableBase: t('salaryPensionableBase'),
        pensionRate: t('salaryPensionRate'), howCalculated: t('salaryHowCalculated'), thisYear: t('salaryThisYear'),
        componentLabels,
      }}
    />
    <EmployeePayslips
      documents={[...importedDocuments, ...payrollDocuments]}
      locale={locale}
      labels={{
        title: tDocuments('payslipsTitle'), subtitle: tDocuments('payslipsSubtitle'), empty: tDocuments('payslipsEmpty'),
        view: tDocuments('view'), download: tDocuments('download'), close: tDocuments('viewerClose'),
        unsupported: tDocuments('viewerUnsupported'), previewLoading: tDocuments('viewerPreviewLoading'),
        previewUnavailable: tDocuments('viewerPreviewUnavailable'), previewRetry: tDocuments('viewerPreviewRetry'),
        imported: tDocuments('payslipImported'),
        payroll: tDocuments('payslipPayroll'), unspecifiedPeriod: tDocuments('payslipUnspecifiedPeriod'),
        document: tDocuments('payslipDocument'),
      }}
    />
  </PageShell>
}
