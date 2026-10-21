'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import {
  calculateSelectedPayroll,
  openSelectedPayrollPeriod,
  recalculatePayrollEmployee,
  type PayrollPeriodActionState,
  type PayrollProfessionalBatchActionState,
} from '@/app/(dashboard)/payroll/runs/actions'
import type {
  PayrollProfessionalEmployee,
  PayrollProfessionalPeriod,
} from '@/lib/payroll/payroll-professional-run-service'
import type {
  PayrollProfessionalEmployeeStatus,
  PayrollProfessionalException,
  PayrollProfessionalPeriodSummary,
} from '@/lib/payroll/payroll-professional-workspace-model'

type WorkbenchProps = {
  readonly administrationName: string
  readonly periods: readonly PayrollProfessionalPeriod[]
  readonly selectedPeriod: PayrollProfessionalPeriod | null
  readonly employees: readonly PayrollProfessionalEmployee[]
  readonly summary: PayrollProfessionalPeriodSummary
  readonly rosterComplete: boolean
  readonly canOpenPayrollCycle: boolean
  readonly locale: string
  readonly labels: Readonly<Record<string, string>>
}

const initialState: PayrollProfessionalBatchActionState = { message: null, items: [] }
const initialPeriodState: PayrollPeriodActionState = { message: null }

const sourceFieldLabels: Readonly<Record<string, string>> = {
  contractualSalary: 'missingSalary',
  contractualHours: 'missingSchedule',
  contract: 'missingContract',
  laborCondition: 'missingLaborConditions',
  incomeRelationship: 'missingIncomeRelationship',
  taxProfile: 'missingTaxProfile',
  actualWork: 'missingActualWork',
  rulePackage: 'missingSupportedRules',
  sourceSnapshot: 'missingOtherData',
}

const incompleteComponentLabels: Readonly<Record<string, string>> = {
  PENSION_EMPLOYEE_ALLOCATION: 'missingEmployeePension',
  PENSION_EMPLOYER_ALLOCATION: 'missingEmployerPension',
  EMPLOYER_SOCIAL_COSTS: 'missingEmployerCosts',
  HOLIDAY_AND_YEAR_END_RESERVES: 'missingReserves',
  CUMULATIVE_WAGE_TAX: 'missingCumulativeTax',
  VARIABLE_AND_NON_REGULAR_WAGE: 'missingVariableWage',
}

const statusLabelKeys: Readonly<Record<PayrollProfessionalEmployeeStatus, string>> = {
  NOT_CALCULATED: 'status_NOT_CALCULATED',
  CONCEPT: 'status_CONCEPT',
  REVIEWED: 'status_REVIEWED',
  FINALIZED: 'status_FINALIZED',
  BLOCKED: 'status_BLOCKED',
}

function formatPeriod(period: PayrollProfessionalPeriod, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(period.year, period.month - 1, 1)))
}

function formatDate(value: string | null, locale: string, missing: string): string {
  if (!value) return missing
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return missing
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function formatDateOnly(value: string | null, locale: string, missing: string): string {
  if (!value) return missing
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return missing
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed)
}

function formatMoney(value: string | null, locale: string, missing: string): string {
  if (value === null || !/^-?\d{1,12}(?:\.\d{1,4})?$/.test(value)) return missing
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(value))
}

function statusClasses(status: PayrollProfessionalEmployeeStatus): string {
  if (status === 'FINALIZED') return 'border-emerald-300 bg-emerald-50 text-emerald-900'
  if (status === 'BLOCKED') return 'border-amber-300 bg-amber-50 text-amber-950'
  if (status === 'REVIEWED') return 'border-sky-300 bg-sky-50 text-sky-950'
  if (status === 'CONCEPT') return 'border-violet-300 bg-violet-50 text-violet-950'
  return 'border-border-subtle bg-surface-subtle text-muted-foreground'
}

function exceptionLabel(exception: PayrollProfessionalException, labels: Readonly<Record<string, string>>): string {
  if (exception.kind === 'SOURCE_GAP' || exception.kind === 'UNSUPPORTED') {
    const key = sourceFieldLabels[exception.field ?? ''] ?? 'missingOtherData'
    return exception.kind === 'UNSUPPORTED'
      ? labels[`unsupported_${key}`] ?? labels.unsupportedOtherData
      : labels[key] ?? labels.missingOtherData
  }
  if (exception.kind === 'INCOMPLETE') {
    return labels[incompleteComponentLabels[exception.component ?? ''] ?? 'missingOtherData'] ?? labels.missingOtherData
  }
  if (exception.kind === 'CONTROL') return labels.controlException
  if (exception.kind === 'CALCULATION') return labels.calculationException
  return exception.reasonCode === 'FINALIZED_RUN_REQUIRES_CORRECTION_SUCCESSOR'
    ? labels.correctionSuccessor
    : labels.staleException
}

function safeDiagnosticValue(value: string, kind: 'category' | 'code' | 'correlation', unavailable: string): string {
  const pattern = kind === 'category'
    ? /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
    : kind === 'code'
      ? /^[A-Z0-9_]{1,96}$/
      : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return pattern.test(value) ? value : unavailable
}

function runLink(runId: string): string {
  return `/payroll/runs/${encodeURIComponent(runId)}`
}

function employeeStatusLabel(status: PayrollProfessionalEmployeeStatus, labels: Readonly<Record<string, string>>): string {
  return labels[statusLabelKeys[status]]
}

function summaryCount(status: PayrollProfessionalEmployeeStatus, summary: PayrollProfessionalPeriodSummary): string {
  return String(summary.counts[status])
}

export function PayrollProfessionalRunWorkbench({
  administrationName,
  periods,
  selectedPeriod,
  employees,
  summary,
  rosterComplete,
  canOpenPayrollCycle,
  locale,
  labels,
}: WorkbenchProps) {
  const [state, action, pending] = useActionState(calculateSelectedPayroll, initialState)
  const [periodState, openPeriodAction, openingPeriod] = useActionState(openSelectedPayrollPeriod, initialPeriodState)
  const canCalculate = selectedPeriod?.status === 'OPEN'
    && employees.some((employee) => employee.canCalculate)
    && rosterComplete

  return <div className="space-y-6">
    <section className="space-y-4 rounded-[var(--radius-surface)] border border-border-subtle p-4 sm:p-5" aria-labelledby="payroll-run-scope-heading">
      <div>
        <h2 className="text-base font-semibold" id="payroll-run-scope-heading">{labels.runWorkspaceTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.runWorkspaceDescription}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.administration}</dt>
          <dd className="mt-1 font-medium">{administrationName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{labels.period}</dt>
          <dd className="mt-1">{selectedPeriod ? formatPeriod(selectedPeriod, locale) : labels.noSelectedPeriod}</dd>
        </div>
      </dl>

      <form action="/payroll/runs" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="payroll-period" className="mb-1 block text-sm font-medium">{labels.selectPeriod}</label>
          <select id="payroll-period" name="period" defaultValue={selectedPeriod?.key ?? ''} className="min-h-11 w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-focus">
            <option value="">{labels.noSelectedPeriod}</option>
            {periods.map((period) => <option key={period.key} value={period.key}>
              {formatPeriod(period, locale)} · {labels[`period_${period.status}`] ?? labels.periodStatusUnknown}
            </option>)}
          </select>
        </div>
        <button type="submit" disabled={periods.length === 0} className="min-h-11 rounded-[var(--radius-control)] border border-border-subtle px-4 text-sm font-medium hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50">
          {labels.showPeriod}
        </button>
      </form>
      {periods.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noPeriods}</p> : null}
      {selectedPeriod && selectedPeriod.status !== 'OPEN' ? <p className="text-sm text-muted-foreground">{labels.periodNotOpen}</p> : null}
      {canOpenPayrollCycle ? <section className="space-y-3 border-t border-border-subtle pt-4">
        <div>
          <h3 className="text-sm font-semibold">{labels.openPeriodTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{labels.openPeriodDescription}</p>
        </div>
        <form action={openPeriodAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="open-payroll-period" className="mb-1 block text-sm font-medium">{labels.openPeriodMonth}</label>
            <input
              id="open-payroll-period"
              name="period"
              type="month"
              min="2000-01"
              max="2200-12"
              defaultValue={selectedPeriod?.status === 'DRAFT' ? selectedPeriod.key : ''}
              required
              disabled={openingPeriod}
              className="min-h-11 w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
            />
          </div>
          <button type="submit" disabled={openingPeriod} className="min-h-11 rounded-[var(--radius-control)] border border-border-subtle px-4 text-sm font-medium hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50">
            {openingPeriod ? labels.openPeriodOpening : labels.openPeriodAction}
          </button>
        </form>
        {periodState.message ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{labels[`openPeriod${periodState.message[0]?.toUpperCase()}${periodState.message.slice(1)}`] ?? labels.openPeriodFailed}</p> : null}
      </section> : null}
    </section>

    {selectedPeriod ? <>
      <section className="space-y-4 rounded-[var(--radius-surface)] border border-border-subtle p-4 sm:p-5" aria-labelledby="payroll-period-summary-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 id="payroll-period-summary-heading" className="text-base font-semibold">{labels.periodSummaryTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.periodSummaryDescription}</p>
          </div>
          <p className="text-sm"><span className="text-muted-foreground">{labels.periodStatusLabel}: </span><span className="font-medium">{labels[`period_${selectedPeriod.status}`] ?? labels.periodStatusUnknown}</span></p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-md bg-surface-subtle p-3"><dt className="text-xs text-muted-foreground">{labels.employeesTotal}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{summary.totalEmployees}</dd></div>
          {(['NOT_CALCULATED', 'CONCEPT', 'REVIEWED', 'FINALIZED', 'BLOCKED'] as const).map((status) => <div key={status} className="rounded-md bg-surface-subtle p-3"><dt className="text-xs text-muted-foreground">{employeeStatusLabel(status, labels)}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{summaryCount(status, summary)}</dd></div>)}
        </dl>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">{labels.grossTotal}</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(summary.grossTotal, locale, labels.noAmount)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.netTotal}</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(summary.netTotal, locale, labels.noAmount)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.employerCostsTotal}</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(summary.employerCostsTotal, locale, labels.noAmount)}</dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">{labels.exceptionsSummary.replace('{employees}', String(summary.employeesWithExceptions)).replace('{exceptions}', String(summary.exceptionCount))}</p>
      </section>

      <form id="payroll-batch-form" action={action}>
        <input type="hidden" name="periodKey" value={selectedPeriod.key} />
      </form>
      <fieldset className="min-w-0 space-y-3">
          <legend className="text-base font-semibold">{labels.selectEmployees}</legend>
          {employees.length === 0
            ? <p className="rounded-[var(--radius-surface)] border border-border-subtle p-4 text-sm text-muted-foreground">{labels.noEmployeesForPeriod}</p>
            : <>
              {!rosterComplete ? <p className="rounded-[var(--radius-surface)] border border-border-subtle p-4 text-sm text-muted-foreground">{labels.rosterTooLarge}</p> : null}
              <ul className="divide-y divide-border-subtle rounded-[var(--radius-surface)] border border-border-subtle">
                {employees.map((employee) => {
                  const detailHref = employee.runId ? runLink(employee.runId) : null
                  return <li key={employee.employmentId} className="p-4 sm:p-5">
                    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(14rem,1.5fr)_repeat(3,minmax(8rem,1fr))_minmax(13rem,1.1fr)] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start gap-3">
                          <input id={`employment-${employee.employmentId}`} form="payroll-batch-form" type="checkbox" name="employmentId" value={employee.employmentId} disabled={!canCalculate || pending || !employee.canCalculate} className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-focus" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <label htmlFor={`employment-${employee.employmentId}`} className="min-w-0 break-words font-medium">{employee.employeeName} <span className="font-normal text-muted-foreground">({employee.employeeNumber})</span></label>
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClasses(employee.status)}`}>{employeeStatusLabel(employee.status, labels)}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{labels.employmentNumber}: {employee.employmentNumber} · {employee.isPrimary ? labels.primaryEmployment : labels.secondaryEmployment}</p>
                            <p className="text-xs text-muted-foreground">{labels.employmentRange}: {formatDateOnly(employee.startsOn, locale, labels.unknownDate)} – {formatDateOnly(employee.endsOn, locale, labels.currentEmployment)}</p>
                          </div>
                        </div>
                        {employee.exceptions.length > 0 ? <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                          <p className="font-medium">{labels.exceptions}</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5">{employee.exceptions.map((exception) => <li key={[exception.kind, exception.field, exception.component, exception.controlKey, exception.reasonCode].join('|')}>{exceptionLabel(exception, labels)}</li>)}</ul>
                            {employee.sourceDiagnostics.length > 0 ? <details className="mt-2 text-xs">
                              <summary className="cursor-pointer font-medium">{labels.sourceDiagnostics}</summary>
                              <ul className="mt-1 space-y-1 pl-1">
                                {employee.sourceDiagnostics.map((diagnostic, index) => <li key={`${diagnostic.sourceCategory}-${diagnostic.errorCode}-${index}`}>
                                  <span>{labels.sourceCategory}: </span><code>{safeDiagnosticValue(diagnostic.sourceCategory, 'category', labels.diagnosticUnavailable)}</code>
                                  <span> · {labels.errorCode}: </span><code>{safeDiagnosticValue(diagnostic.errorCode, 'code', labels.diagnosticUnavailable)}</code>
                                  {diagnostic.correlationId ? <><span> · {labels.correlationId}: </span><code>{safeDiagnosticValue(diagnostic.correlationId, 'correlation', labels.diagnosticUnavailable)}</code></> : null}
                                </li>)}
                              </ul>
                            </details> : null}
                        </div> : <p className="mt-3 text-xs text-muted-foreground">{labels.noExceptions}</p>}
                      </div>
                      <div><dt className="text-xs text-muted-foreground">{labels.gross}</dt><dd className="mt-1 font-medium tabular-nums">{formatMoney(employee.grossAmount, locale, labels.noAmount)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.net}</dt><dd className="mt-1 font-medium tabular-nums">{formatMoney(employee.netAmount, locale, labels.noAmount)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.employerCost}</dt><dd className="mt-1 font-medium tabular-nums">{formatMoney(employee.employerCosts, locale, labels.noAmount)}</dd></div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{labels.lastCalculated}</p>
                        <p className="mt-1 text-sm">{formatDate(employee.lastCalculatedAt, locale, labels.notCalculatedYet)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {employee.canCalculate ? <form action={recalculatePayrollEmployee} className="contents">
                            <input type="hidden" name="periodKey" value={selectedPeriod.key} />
                            <input type="hidden" name="employeeId" value={employee.employeeId} />
                            <input type="hidden" name="employmentId" value={employee.employmentId} />
                            <button type="submit" disabled={!canCalculate || pending} className="min-h-9 rounded-[var(--radius-control)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50">
                              {employee.status === 'NOT_CALCULATED' || employee.status === 'BLOCKED' ? labels.calculateEmployee : labels.recalculateEmployee}
                            </button>
                          </form> : null}
                          {employee.canReview && detailHref ? <Link href={detailHref} className="min-h-9 rounded-[var(--radius-control)] border border-border-subtle px-3 py-1.5 text-xs font-medium hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus">{labels.reviewEmployee}</Link> : null}
                          {employee.canFinalize && detailHref ? <Link href={detailHref} className="min-h-9 rounded-[var(--radius-control)] border border-border-subtle px-3 py-1.5 text-xs font-medium hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus">{labels.finalizeEmployee}</Link> : null}
                          {employee.canViewPayslip && employee.runId ? <Link href={`/api/payroll/runs/${encodeURIComponent(employee.runId)}/payslip-preview`} target="_blank" rel="noreferrer" className="min-h-9 rounded-[var(--radius-control)] border border-border-subtle px-3 py-1.5 text-xs font-medium hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus">{labels.openPayslip}</Link> : null}
                          {detailHref ? <Link href={detailHref} className="min-h-9 rounded-[var(--radius-control)] px-2 py-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{labels.openDetail}</Link> : null}
                        </div>
                      </div>
                    </div>
                  </li>
                })}
              </ul>
            </>}
      </fieldset>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" form="payroll-batch-form" disabled={!canCalculate || pending} className="min-h-11 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? labels.calculating : labels.calculateSelected}
          </button>
          {selectedPeriod.status === 'OPEN' ? <p className="text-sm text-muted-foreground">{labels.conceptRunHint}</p> : null}
        </div>
    </> : null}

    {state.message ? <p role="status" aria-live="polite" className="rounded-[var(--radius-surface)] border border-border-subtle p-4 text-sm">{labels[`batch_${state.message}`] ?? labels.batch_failed}</p> : null}
    {state.items.length > 0 ? <section className="space-y-3" aria-labelledby="payroll-batch-results-heading">
      <div>
        <h2 id="payroll-batch-results-heading" className="text-base font-semibold">{labels.batchResults}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.incompleteNetNotice}</p>
      </div>
      <ul className="divide-y divide-border-subtle rounded-[var(--radius-surface)] border border-border-subtle">
        {state.items.map((item) => {
          const gaps = item.missingFields.map(({ field, unsupported }) => {
            const key = sourceFieldLabels[field] ?? 'missingOtherData'
            return unsupported ? labels[`unsupported_${key}`] ?? labels.unsupportedOtherData : labels[key] ?? labels.missingOtherData
          })
          const incomplete = item.incompleteComponents.map((code) => labels[incompleteComponentLabels[code] ?? 'missingOtherData'] ?? labels.missingOtherData)
          const missingItems = [...new Set([...gaps, ...incomplete])]
          return <li key={`${item.employeeNumber}-${item.employmentNumber}`} className="space-y-3 p-4">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><p className="break-words font-medium">{item.employeeName} <span className="font-normal text-muted-foreground">({item.employeeNumber})</span></p><p className="text-xs text-muted-foreground">{labels.employmentNumber}: {item.employmentNumber}</p></div>
              <span className="text-sm font-medium">{labels[`calculation_${item.state}`] ?? labels.calculation_FAILED}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">{labels.gross}</dt><dd className="mt-1 font-medium tabular-nums">{formatMoney(item.grossAmount, locale, labels.notCalculated)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{labels.wageTaxWithheld}</dt><dd className="mt-1 font-medium tabular-nums">{formatMoney(item.wageTaxAmount, locale, labels.notCalculated)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{labels.remainingAfterWageTax}</dt><dd className="mt-1 font-medium tabular-nums">{formatMoney(item.remainingAfterWageTax, locale, labels.notCalculated)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{labels.employerCost}</dt><dd className="mt-1 font-medium tabular-nums">{formatMoney(item.employerCosts, locale, labels.notCalculated)}</dd></div>
            </dl>
            {missingItems.length > 0 ? <div><h3 className="text-xs font-semibold text-muted-foreground">{labels.missingData}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{missingItems.map((itemLabel) => <li key={itemLabel}>{itemLabel}</li>)}</ul></div> : null}
          </li>
        })}
      </ul>
    </section> : null}
  </div>
}
