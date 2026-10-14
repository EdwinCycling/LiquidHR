'use client'

import { useActionState } from 'react'
import { calculateSelectedPayroll, type PayrollProfessionalBatchActionState } from '@/app/(dashboard)/payroll/runs/actions'
import type {
  PayrollProfessionalEmployee,
  PayrollProfessionalPeriod,
} from '@/lib/payroll/payroll-professional-run-service'

type WorkbenchProps = {
  readonly administrationName: string
  readonly periods: readonly PayrollProfessionalPeriod[]
  readonly selectedPeriod: PayrollProfessionalPeriod | null
  readonly employees: readonly PayrollProfessionalEmployee[]
  readonly rosterComplete: boolean
  readonly locale: string
  readonly labels: Readonly<Record<string, string>>
}

const initialState: PayrollProfessionalBatchActionState = { message: null, items: [] }

const sourceFieldLabels: Readonly<Record<string, string>> = {
  contractualSalary: 'missingSalary',
  contractualHours: 'missingSchedule',
  contract: 'missingContract',
  laborCondition: 'missingLaborConditions',
  incomeRelationship: 'missingIncomeRelationship',
  taxProfile: 'missingTaxProfile',
  actualWork: 'missingActualWork',
  rulePackage: 'missingSupportedRules',
}

const incompleteComponentLabels: Readonly<Record<string, string>> = {
  PENSION_EMPLOYEE_ALLOCATION: 'missingEmployeePension',
  PENSION_EMPLOYER_ALLOCATION: 'missingEmployerPension',
  EMPLOYER_SOCIAL_COSTS: 'missingEmployerCosts',
  HOLIDAY_AND_YEAR_END_RESERVES: 'missingReserves',
  CUMULATIVE_WAGE_TAX: 'missingCumulativeTax',
  VARIABLE_AND_NON_REGULAR_WAGE: 'missingVariableWage',
}

function formatPeriod(period: PayrollProfessionalPeriod, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(period.year, period.month - 1, 1)))
}

function formatMoney(value: string | null, locale: string, missing: string): string {
  if (value === null || !/^-?\d{1,12}(?:\.\d{1,4})?$/.test(value)) return missing
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(value))
}

export function PayrollProfessionalRunWorkbench({
  administrationName,
  periods,
  selectedPeriod,
  employees,
  rosterComplete,
  locale,
  labels,
}: WorkbenchProps) {
  const [state, action, pending] = useActionState(calculateSelectedPayroll, initialState)
  const canCalculate = selectedPeriod?.status === 'OPEN' && employees.length > 0 && rosterComplete

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
    </section>

    {selectedPeriod ? <form action={action} className="space-y-5">
      <input type="hidden" name="periodKey" value={selectedPeriod.key} />
      <fieldset disabled={!canCalculate || pending} className="min-w-0 space-y-3 disabled:opacity-70">
        <legend className="text-base font-semibold">{labels.selectEmployees}</legend>
        {employees.length === 0
          ? <p className="rounded-[var(--radius-surface)] border border-border-subtle p-4 text-sm text-muted-foreground">{labels.noEmployeesForPeriod}</p>
          : <>
            {!rosterComplete ? <p className="rounded-[var(--radius-surface)] border border-border-subtle p-4 text-sm text-muted-foreground">{labels.rosterTooLarge}</p> : null}
            <ul className="divide-y divide-border-subtle rounded-[var(--radius-surface)] border border-border-subtle">
              {employees.map((employee) => <li key={employee.employmentId} className="flex min-w-0 items-start gap-3 p-3 sm:items-center sm:px-4">
                <input id={`employment-${employee.employmentId}`} type="checkbox" name="employmentId" value={employee.employmentId} className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-focus sm:mt-0" />
                <label htmlFor={`employment-${employee.employmentId}`} className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,auto)] sm:items-center">
                  <span className="min-w-0 break-words font-medium">{employee.employeeName} <span className="font-normal text-muted-foreground">({employee.employeeNumber})</span></span>
                  <span className="text-xs text-muted-foreground">{labels.employmentNumber}: {employee.employmentNumber}</span>
                </label>
              </li>)}
            </ul>
          </>}
      </fieldset>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={!canCalculate || pending} className="min-h-11 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? labels.calculating : labels.calculateSelected}
        </button>
        {selectedPeriod.status === 'OPEN' ? <p className="text-sm text-muted-foreground">{labels.conceptRunHint}</p> : null}
      </div>
    </form> : null}

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
