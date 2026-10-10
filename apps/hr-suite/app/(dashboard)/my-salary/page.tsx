import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getMySalaryStatement } from '@/lib/payroll/payroll-professional-service'
import { formatPayrollMoney } from '@/components/payroll/payroll-professional-view'

const ESS_LABELS: Readonly<Record<string, string>> = {
  contractual_salary: 'contractualSalary', additional_cash_amount: 'additionalPayment', additional_hours_pay: 'additionalHoursPay',
  gross_salary: 'gross', employee_pension: 'pension', taxable_wage: 'taxableWage', employee_insurance_wage: 'employeeInsuranceWage',
  zvw_wage: 'zvwWage', wage_tax: 'tax', net_salary: 'net', employer_insurance: 'employerInsurance',
  employer_pension: 'employerPension', holiday_allowance_reserve: 'holidayReserve', holiday_reserve: 'holidayReserve',
  year_end_reserve: 'yearEndReserve', total_employer_cost: 'totalEmployerCost',
}

const YTD_LABELS: Readonly<Record<string, string>> = {
  cumulative_gross: 'cumulative_gross',
  cumulative_holiday_reserve: 'cumulative_holiday_reserve',
  cumulative_year_end_reserve: 'cumulative_year_end_reserve',
}

export default async function MySalaryPage() {
  let statement
  try { statement = await getMySalaryStatement() } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }
  const [t, locale] = await Promise.all([getTranslator('payrollProfessional'), getLocale()])
  if (!statement) return <PageShell className="space-y-6 py-6 sm:py-8"><PageHeader title={t('mySalary')} description={t('mySalaryDescription')} /><p className="rounded-xl border border-dashed border-border-subtle p-6 text-sm text-muted-foreground">{t('noFinalizedSalary')}</p></PageShell>
  const visible = statement.components.flatMap((row) => {
    const key = row.key
    const amount = row.amount
    return amount !== null && !key.startsWith('cumulative_') ? [{ key, label: t(ESS_LABELS[key] ?? 'otherComponent'), amount }] : []
  })
  const ytd = statement.components.flatMap((row) => {
    const labelKey = YTD_LABELS[row.key]
    const amount = row.amount
    return labelKey && amount !== null ? [{ key: row.key, label: t(labelKey), amount }] : []
  })
  const value = (key: string) => visible.find((entry) => entry.key === key)?.amount ?? null
  const pensions = visible.filter((row) => row.key.includes('pension'))
  const taxes = visible.filter((row) => ['taxable_wage', 'employee_insurance_wage', 'zvw_wage', 'wage_tax'].includes(row.key))
  const reserves = visible.filter((row) => row.key.includes('reserve'))
  const employerContributions = visible.filter((row) => row.key.startsWith('employer_') || row.key === 'total_employer_cost')
  const salaryComponents = visible.filter((row) => !row.key.includes('pension')
    && !['taxable_wage', 'employee_insurance_wage', 'zvw_wage', 'wage_tax', 'net_salary', 'total_employer_cost'].includes(row.key)
    && !row.key.startsWith('employer_') && !row.key.includes('reserve'))
  const period = `${statement.periodYear}-${String(statement.periodMonth).padStart(2, '0')}`
  const grossToNetRows = ['gross_salary', 'employee_pension', 'taxable_wage', 'wage_tax', 'net_salary'].map((key) => ({
    key,
    label: t(ESS_LABELS[key] ?? 'otherComponent'),
    amount: value(key),
  }))
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('mySalary')} description={t('mySalaryPeriodDescription', { period })} />
    <Surface className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4"><p className="text-xs text-muted-foreground">{t('gross')}</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatPayrollMoney(value('gross_salary'), locale)}</p></div>
        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4"><p className="text-xs text-muted-foreground">{t('net')}</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatPayrollMoney(value('net_salary'), locale)}</p></div>
      </div>
      <section className="rounded-xl border border-border-subtle p-4">
        <h2 className="font-semibold">{t('grossToNetExplanation')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('grossToNetIntro')}</p>
        <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{grossToNetRows.map((row) => <div key={row.key} className="min-w-0 rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{row.label}</dt><dd className="mt-1 break-words font-medium tabular-nums">{row.amount === null ? t('salaryAmountMissing') : formatPayrollMoney(row.amount, locale)}</dd></div>)}</dl>
      </section>
      {statement.pensionReadiness === 'SOURCE_VERIFICATION_REQUIRED' ? <div role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm"><p className="font-semibold">{t('essPensionSourceGap')}</p><p className="mt-1">{t('netNotDefinitive')}</p></div> : null}
      {statement.pensionReadiness === 'REVIEW_REQUIRED' ? <div role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm"><p className="font-semibold">{t('essPensionReview')}</p><p className="mt-1">{t('pensionReadinessWarning')}</p></div> : null}
      <details className="rounded-xl border border-border-subtle p-4" open><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{t('salaryBreakdown')}</summary><dl className="mt-3 divide-y divide-border-subtle">{salaryComponents.map((row) => <div key={row.key} className="flex justify-between gap-4 py-3 text-sm"><dt>{row.label}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd></div>)}</dl></details>
      <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{t('pensionExplanation')}</summary><p className="mt-3 text-sm text-muted-foreground">{t('pensionExplanationText')}</p><dl className="mt-3 grid gap-3 sm:grid-cols-2">{pensions.map((row) => <div key={row.key} className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{row.label}</dt><dd className="mt-1 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd></div>)}</dl></details>
      <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{t('taxDetails')}</summary><dl className="mt-3 divide-y divide-border-subtle">{taxes.map((row) => <div key={row.key} className="flex justify-between gap-4 py-3 text-sm"><dt>{row.label}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd></div>)}</dl></details>
      <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{t('reserves')}</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{reserves.map((row) => <div key={row.key} className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{row.label}</dt><dd className="mt-1 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd></div>)}</dl></details>
      <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{t('employerContributions')}</summary><dl className="mt-3 divide-y divide-border-subtle">{employerContributions.map((row) => <div key={row.key} className="flex justify-between gap-4 py-3 text-sm"><dt>{row.label}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd></div>)}</dl></details>
      {statement.pension ? <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{t('howCalculated')}</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {statement.pension.arrangementName ? <div className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{t('pensionArrangement')}</dt><dd className="mt-1 font-medium">{statement.pension.arrangementName}</dd></div> : null}
        {statement.pension.pensionableBase && /^\d{1,12}(?:\.\d{1,4})?$/.test(statement.pension.pensionableBase) ? <div className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{t('pensionableBase')}</dt><dd className="mt-1 font-medium tabular-nums">{formatPayrollMoney(Number(statement.pension.pensionableBase), locale)}</dd></div> : null}
        {statement.pension.rate && /^\d{1,4}(?:\.\d{1,4})?$/.test(statement.pension.rate) ? <div className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{t('pensionRate')}</dt><dd className="mt-1 font-medium tabular-nums">{new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(statement.pension.rate))}%</dd></div> : null}
      </dl></details> : null}
      {ytd.length > 0 ? <details className="rounded-xl border border-border-subtle p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{t('thisYear')}</summary><dl className="mt-3 divide-y divide-border-subtle">{ytd.map((row) => <div key={row.key} className="flex justify-between gap-4 py-3 text-sm"><dt>{row.label}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd></div>)}</dl></details> : null}
      <p className="text-xs text-muted-foreground">{t('selfServicePrivacy')}</p>
    </Surface>
  </PageShell>
}
