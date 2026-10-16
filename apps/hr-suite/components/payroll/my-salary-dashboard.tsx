'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { EmployeePayrollStatement } from '@/lib/payroll/payroll-professional-service'
import { formatPayrollMoney } from './payroll-professional-view'
import {
  previousAvailableSalaryStatement,
  salaryComponentAmount,
  salaryComponentChanges,
  salaryPeriodKey,
  salaryTrendPoints,
  type SalaryTrendRange,
} from './my-salary-dashboard-data'

type Labels = {
  readonly gross: string
  readonly net: string
  readonly period: string
  readonly historyEmpty: string
  readonly historyEmptyTitle: string
  readonly chartTitle: string
  readonly chartDescription: string
  readonly chartRange: string
  readonly range6: string
  readonly range12: string
  readonly range24: string
  readonly rangeAll: string
  readonly month: string
  readonly selectedPeriod: string
  readonly previousPeriod: string
  readonly noPreviousPeriod: string
  readonly comparison: string
  readonly amountChange: string
  readonly percentChange: string
  readonly componentsChanged: string
  readonly noComponentChanges: string
  readonly salaryBreakdown: string
  readonly taxDetails: string
  readonly taxExplanation: string
  readonly pensionExplanation: string
  readonly allowanceTitle: string
  readonly allowanceExplanation: string
  readonly reserves: string
  readonly reserveExplanation: string
  readonly employerContributions: string
  readonly grossToNetExplanation: string
  readonly grossToNetIntro: string
  readonly pensionDetails: string
  readonly pensionSourceGap: string
  readonly pensionReview: string
  readonly pensionTestAssumptions: string
  readonly pensionExplanationText: string
  readonly netNotDefinitive: string
  readonly salaryAmountMissing: string
  readonly changeUp: string
  readonly changeDown: string
  readonly notComparable: string
  readonly pensionArrangement: string
  readonly pensionableBase: string
  readonly pensionRate: string
  readonly howCalculated: string
  readonly thisYear: string
  readonly componentLabels: Readonly<Record<string, string>>
}

function periodLabel(periodYear: number, periodMonth: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(periodYear, periodMonth - 1, 1)))
}

function chartAxisMoney(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(amount)
}

function visibleArrangementName(value: string | null): string | null {
  if (!value || /\b(?:synthetic|synthetisch(?:e|en)?|test(?:medewerker)?|demo)\b/i.test(value)) return null
  return value
}

function MetricCard({ label, value, missing, missingLabel, emphasis }: { label: string; value: string; missing: boolean; missingLabel: string; emphasis: 'gross' | 'net' }) {
  return <Surface className={`min-w-0 p-5 ${emphasis === 'net' ? 'bg-chart-2/10' : 'bg-chart-1/10'}`}>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{value}</p>
    {missing ? <p className="mt-2 text-xs text-muted-foreground">{missingLabel}</p> : null}
  </Surface>
}

function SalaryChartTooltip({
  active,
  payload,
  label,
  locale,
  grossLabel,
  netLabel,
}: {
  active?: boolean
  payload?: readonly { dataKey?: string | number; value?: number | string }[]
  label?: string | number
  locale: string
  grossLabel: string
  netLabel: string
}) {
  if (!active || !payload?.length) return null
  return <div className="rounded-xl border border-border-subtle bg-surface p-3 shadow-lg">
    <p className="mb-2 text-sm font-semibold">{label}</p>
    <dl className="space-y-1.5">
      {payload.map((entry) => <div className="flex items-center justify-between gap-6 text-sm" key={String(entry.dataKey)}>
        <dt className="text-muted-foreground">{entry.dataKey === 'gross' ? grossLabel : netLabel}</dt>
        <dd className="font-semibold tabular-nums">{typeof entry.value === 'number' ? formatPayrollMoney(entry.value, locale) : '—'}</dd>
      </div>)}
    </dl>
  </div>
}

export function MySalaryDashboard({
  statements,
  initialPeriod,
  locale,
  labels,
}: {
  statements: readonly EmployeePayrollStatement[]
  initialPeriod: string | null
  locale: string
  labels: Labels
}) {
  const router = useRouter()
  const [range, setRange] = useState<SalaryTrendRange>(12)
  const initialKey = initialPeriod && statements.some((statement) => salaryPeriodKey(statement) === initialPeriod)
    ? initialPeriod
    : statements[0] ? salaryPeriodKey(statements[0]) : null
  const selectedStatement = statements.find((statement) => salaryPeriodKey(statement) === initialKey) ?? statements[0] ?? null
  const previousStatement = selectedStatement ? previousAvailableSalaryStatement(selectedStatement, statements) : null
  const points = useMemo(() => salaryTrendPoints(statements, range), [range, statements])
  const currentGross = selectedStatement ? salaryComponentAmount(selectedStatement, 'gross_salary') : null
  const currentNet = selectedStatement ? salaryComponentAmount(selectedStatement, 'net_salary') : null
  const previousGross = previousStatement ? salaryComponentAmount(previousStatement, 'gross_salary') : null
  const previousNet = previousStatement ? salaryComponentAmount(previousStatement, 'net_salary') : null
  const changes = selectedStatement && previousStatement ? salaryComponentChanges(selectedStatement, previousStatement) : []
  const pensionArrangement = selectedStatement?.pension ? visibleArrangementName(selectedStatement.pension.arrangementName) : null
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'

  const selectPeriod = (period: string) => {
    if (!statements.some((statement) => salaryPeriodKey(statement) === period)) return
    router.replace(`/my-salary?period=${encodeURIComponent(period)}`, { scroll: false })
  }

  const componentGroups = selectedStatement ? [
    {
      id: 'salary', title: labels.salaryBreakdown, explanation: labels.grossToNetIntro,
      rows: selectedStatement.components.filter((row) => row.amount !== null && !row.key.startsWith('cumulative_')
        && !['gross_salary', 'net_salary', 'wage_tax', 'taxable_wage', 'employee_insurance_wage', 'zvw_wage', 'employee_pension', 'employer_pension', 'employer_insurance', 'total_employer_cost'].includes(row.key)
        && !row.key.includes('reserve') && !/allowance|additional_cash|additional_hours/i.test(row.key)),
    },
    {
      id: 'tax', title: labels.taxDetails, explanation: labels.taxExplanation,
      rows: selectedStatement.components.filter((row) => row.amount !== null && ['wage_tax', 'taxable_wage', 'employee_insurance_wage', 'zvw_wage'].includes(row.key)),
    },
    {
      id: 'pension', title: labels.pensionDetails, explanation: labels.pensionExplanationText,
      rows: selectedStatement.components.filter((row) => row.amount !== null && ['employee_pension', 'employer_pension'].includes(row.key)),
    },
    {
      id: 'allowances', title: labels.allowanceTitle, explanation: labels.allowanceExplanation,
      rows: selectedStatement.components.filter((row) => row.amount !== null && !row.key.includes('reserve') && /allowance|additional_cash|additional_hours/i.test(row.key)),
    },
    {
      id: 'reserves', title: labels.reserves, explanation: labels.reserveExplanation,
      rows: selectedStatement.components.filter((row) => row.amount !== null && row.key.includes('reserve')),
    },
    {
      id: 'employer', title: labels.employerContributions, explanation: labels.employerContributions,
      rows: selectedStatement.components.filter((row) => row.amount !== null && row.key !== 'employer_pension' && (row.key.startsWith('employer_') || row.key === 'total_employer_cost')),
    },
  ] : []

  return <div className="space-y-6">
    {selectedStatement ? <>
      <div className="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-border-subtle bg-surface p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.selectedPeriod}</p>
          <p className="mt-1 text-lg font-semibold capitalize">{periodLabel(selectedStatement.periodYear, selectedStatement.periodMonth, dateLocale)}</p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:min-w-64">
          <span>{labels.period}</span>
          <select className="min-h-11 rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 text-foreground focus-visible:outline-2 focus-visible:outline-focus" onChange={(event) => selectPeriod(event.currentTarget.value)} value={salaryPeriodKey(selectedStatement)}>
            {statements.map((statement) => {
              const key = salaryPeriodKey(statement)
              return <option key={key} value={key}>{periodLabel(statement.periodYear, statement.periodMonth, dateLocale)}</option>
            })}
          </select>
        </label>
      </div>

      <section aria-label={labels.selectedPeriod} className="grid gap-4 sm:grid-cols-2">
        <MetricCard emphasis="gross" label={labels.gross} missing={currentGross === null} missingLabel={labels.salaryAmountMissing} value={formatPayrollMoney(currentGross, locale)} />
        <MetricCard emphasis="net" label={labels.net} missing={currentNet === null} missingLabel={labels.salaryAmountMissing} value={formatPayrollMoney(currentNet, locale)} />
      </section>

      <details className="rounded-[var(--radius-surface)] border border-border-subtle bg-surface p-4 sm:p-5">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.grossToNetExplanation}</summary>
        <p className="mt-3 text-sm text-muted-foreground">{labels.grossToNetIntro}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {['gross_salary', 'employee_pension', 'taxable_wage', 'wage_tax', 'net_salary'].map((key) => {
            const amount = salaryComponentAmount(selectedStatement, key)
            return <div className="min-w-0 rounded-lg bg-surface-subtle p-3" key={key}>
              <dt className="text-sm text-muted-foreground">{labels.componentLabels[key] ?? key.replaceAll('_', ' ')}</dt>
              <dd className="mt-1 break-words font-medium tabular-nums">{amount === null ? labels.salaryAmountMissing : formatPayrollMoney(amount, locale)}</dd>
            </div>
          })}
        </dl>
      </details>

      {selectedStatement.pensionReadiness === 'SOURCE_VERIFICATION_REQUIRED' ? <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm" role="status"><p className="font-semibold">{labels.pensionSourceGap}</p><p className="mt-1">{labels.netNotDefinitive}</p></div> : null}
      {selectedStatement.pensionReadiness === 'REVIEW_REQUIRED' ? <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm" role="status"><p className="font-semibold">{labels.pensionReview}</p><p className="mt-1">{labels.pensionExplanationText}</p></div> : null}
      {selectedStatement.pensionReadiness === 'CALCULATED_TEST_ASSUMPTIONS' ? <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm" role="status">{labels.pensionTestAssumptions}</div> : null}

      <Surface className="min-w-0 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="text-lg font-semibold">{labels.chartTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.chartDescription}</p></div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <span className="sr-only">{labels.chartRange}</span>
            <select className="min-h-10 rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3" onChange={(event) => setRange(event.currentTarget.value === 'all' ? 'all' : Number(event.currentTarget.value) as 6 | 12 | 24)} value={range}>
              <option value={6}>{labels.range6}</option><option value={12}>{labels.range12}</option><option value={24}>{labels.range24}</option><option value="all">{labels.rangeAll}</option>
            </select>
          </label>
        </div>
        <figure aria-label={labels.chartTitle} className="mt-5 min-w-0">
          <div className="h-72 min-w-0">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart accessibilityLayer data={points.map((point) => ({ ...point, label: periodLabel(point.periodYear, point.periodMonth, dateLocale) }))} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="label" minTickGap={18} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} tickLine={false} />
              <YAxis axisLine={false} tickFormatter={(value: number) => chartAxisMoney(value, locale)} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} tickLine={false} width={62} />
              <Tooltip content={<SalaryChartTooltip grossLabel={labels.gross} locale={locale} netLabel={labels.net} />} />
              <Legend />
              <Line activeDot={{ r: 6 }} connectNulls={false} dataKey="gross" dot={{ r: 3 }} name={labels.gross} stroke="var(--color-chart-1)" strokeWidth={2.5} type="monotone" />
              <Line activeDot={{ r: 6 }} connectNulls={false} dataKey="net" dot={{ r: 3 }} name={labels.net} stroke="var(--color-chart-2)" strokeWidth={2.5} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
          </div>
          <figcaption className="mt-3 text-xs text-muted-foreground">{labels.chartDescription}</figcaption>
        </figure>
      </Surface>

      <Surface className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{labels.comparison}</h2><p className="mt-1 text-sm text-muted-foreground">{previousStatement ? `${periodLabel(selectedStatement.periodYear, selectedStatement.periodMonth, dateLocale)} · ${labels.previousPeriod}: ${periodLabel(previousStatement.periodYear, previousStatement.periodMonth, dateLocale)}` : labels.noPreviousPeriod}</p></div>
        </div>
        {previousStatement ? <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {([
            [labels.gross, currentGross, previousGross],
            [labels.net, currentNet, previousNet],
          ] as const).map(([name, current, previous]) => {
            const beforeCents = previous === null ? null : Math.round(previous * 100)
            const afterCents = current === null ? null : Math.round(current * 100)
            const difference = beforeCents === null || afterCents === null ? null : (afterCents - beforeCents) / 100
            const percentage = beforeCents === null || afterCents === null || beforeCents === 0
              ? null
              : Math.round(((afterCents - beforeCents) / beforeCents) * 10000) / 100
            const ChangeIcon = difference === null || difference === 0 ? Minus : difference > 0 ? ArrowUpRight : ArrowDownRight
            return <div className="rounded-xl bg-surface-subtle p-4" key={name}>
              <p className="text-sm text-muted-foreground">{name}</p>
              {difference === null ? <p className="mt-2 text-sm">{labels.salaryAmountMissing}</p> : <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold tabular-nums"><ChangeIcon aria-hidden="true" className="size-4" /><span>{difference > 0 ? '+' : ''}{formatPayrollMoney(difference, locale)}</span><span className="text-sm font-medium text-muted-foreground">({percentage === null ? labels.notComparable : `${percentage > 0 ? '+' : ''}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(percentage)}%`})</span></div>}
            </div>
          })}
        </div> : null}
        <h3 className="mt-6 text-sm font-semibold">{labels.componentsChanged}</h3>
        {!previousStatement || changes.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.noComponentChanges}</p> : <ul className="mt-2 divide-y divide-border-subtle">
          {changes.map((change) => <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between" key={change.key}>
            <span className="text-sm font-medium">{labels.componentLabels[change.key] ?? change.key.replaceAll('_', ' ')}</span>
            <span className="text-sm tabular-nums">{formatPayrollMoney(change.before, locale)} → {formatPayrollMoney(change.after, locale)} <strong className="ml-1">({change.difference > 0 ? '+' : ''}{formatPayrollMoney(change.difference, locale)}; {change.percentage === null ? labels.notComparable : `${change.percentage > 0 ? '+' : ''}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(change.percentage)}%`})</strong></span>
          </li>)}
        </ul>}
      </Surface>

      <section className="space-y-3" aria-label={labels.salaryBreakdown}>
        <h2 className="text-lg font-semibold">{labels.salaryBreakdown}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {componentGroups.map((group) => group.rows.length > 0 ? <details className="rounded-[var(--radius-surface)] border border-border-subtle bg-surface p-4 sm:p-5" key={group.id}>
            <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{group.title}</summary>
            <p className="mt-3 text-sm text-muted-foreground">{group.explanation}</p>
            <dl className="mt-3 divide-y divide-border-subtle">
              {group.rows.map((row, index) => <div className="flex justify-between gap-4 py-3 text-sm" key={`${row.key}-${index}`}>
                <dt>{labels.componentLabels[row.key] ?? row.key.replaceAll('_', ' ')}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd>
              </div>)}
            </dl>
          </details> : null)}
        </div>
      </section>

      {selectedStatement.components.some((row) => row.key.startsWith('cumulative_') && row.amount !== null) ? <details className="rounded-[var(--radius-surface)] border border-border-subtle bg-surface p-4 sm:p-5">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.thisYear}</summary>
        <dl className="mt-3 divide-y divide-border-subtle">
          {selectedStatement.components.filter((row) => row.key.startsWith('cumulative_') && row.amount !== null).map((row) => <div className="flex justify-between gap-4 py-3 text-sm" key={row.key}>
            <dt>{labels.componentLabels[row.key] ?? row.key.replaceAll('_', ' ')}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPayrollMoney(row.amount, locale)}</dd>
          </div>)}
        </dl>
      </details> : null}

      {selectedStatement.pension ? <details className="rounded-[var(--radius-surface)] border border-border-subtle bg-surface p-4 sm:p-5">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-focus">{labels.howCalculated}</summary>
        <p className="mt-3 text-sm text-muted-foreground">{labels.pensionExplanation}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {pensionArrangement ? <div className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{labels.pensionArrangement}</dt><dd className="mt-1 font-medium">{pensionArrangement}</dd></div> : null}
          {selectedStatement.pension.pensionableBase && /^\d{1,12}(?:\.\d{1,4})?$/.test(selectedStatement.pension.pensionableBase) ? <div className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{labels.pensionableBase}</dt><dd className="mt-1 font-medium tabular-nums">{formatPayrollMoney(Number(selectedStatement.pension.pensionableBase), locale)}</dd></div> : null}
          {selectedStatement.pension.rate && /^\d{1,4}(?:\.\d{1,4})?$/.test(selectedStatement.pension.rate) ? <div className="rounded-lg bg-surface-subtle p-3"><dt className="text-sm text-muted-foreground">{labels.pensionRate}</dt><dd className="mt-1 font-medium tabular-nums">{new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(selectedStatement.pension.rate))}%</dd></div> : null}
        </dl>
      </details> : null}
    </> : <Surface className="p-6"><EmptyState description={labels.historyEmpty} title={labels.historyEmptyTitle} /></Surface>}
  </div>
}
