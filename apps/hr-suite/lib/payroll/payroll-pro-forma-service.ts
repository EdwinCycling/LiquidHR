import 'server-only'

import {
  FixedDecimal,
  type PayrollSerializedValue,
  type PayrollSourceGap,
  type PayrollSourceProviderInput,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { z } from 'zod'
import { calculatePayrollSnapshot } from './employee-payroll-calculation-service'
import { LiquidHrPayrollSourceProvider } from './source/liquid-hr-source-provider'
import { authorizeMySalaryPayrollAccess, type EmployeePayrollAccess } from './payroll-professional-service'

const decimalText = z.string().max(24).regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/)
const moneyText = z.string().max(16).regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)

export const payrollProFormaScenarioSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('BONUS'), amount: moneyText }).strict(),
  z.object({ type: z.literal('EXTRA_PAID_HOURS'), hours: decimalText }).strict(),
  z.object({ type: z.literal('SALARY_INCREASE'), percentage: decimalText }).strict(),
  z.object({ type: z.literal('CONTRACT_HOURS'), hoursPerWeek: decimalText }).strict(),
])

export type PayrollProFormaScenario = z.infer<typeof payrollProFormaScenarioSchema>

export type PayrollProFormaAmounts = {
  readonly gross: string
  readonly employeePension: string
  readonly employerPension: string
  readonly taxableWage: string
  readonly wageTax: string
  readonly net: string
  readonly employerCosts: string
}

export type PayrollProFormaResult = {
  readonly status: 'CALCULATED' | 'SOURCE_GAP' | 'UNSUPPORTED' | 'INCOMPLETE' | 'CALCULATION_FAILED'
  readonly sourceStatus: 'READY' | 'SOURCE_GAP' | 'INCOMPLETE'
  readonly scenarioType: PayrollProFormaScenario['type']
  readonly period: { readonly year: number; readonly month: number }
  readonly sourceHash: string | null
  readonly baseline: PayrollProFormaAmounts | null
  readonly scenario: PayrollProFormaAmounts | null
  readonly difference: PayrollProFormaAmounts | null
  readonly hashes: {
    readonly baselineInput: string | null
    readonly baselineResult: string | null
    readonly scenarioInput: string | null
    readonly scenarioResult: string | null
  }
  readonly traceSteps: number
  readonly gaps: readonly PayrollSourceGap[]
}

export class PayrollProFormaError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 409 | 503 = 409) {
    super(code)
    this.name = 'PayrollProFormaError'
  }
}

function validateScenario(scenario: PayrollProFormaScenario): void {
  const zero = FixedDecimal.fromInteger(BigInt(0))
  if (scenario.type === 'BONUS') {
    const amount = decimal(scenario.amount)
    if (!amount || amount.compare(zero) <= 0) throw new PayrollProFormaError('SCENARIO_INPUT_INVALID', 400)
    return
  }
  const value = decimal(scenario.type === 'EXTRA_PAID_HOURS' ? scenario.hours
    : scenario.type === 'SALARY_INCREASE' ? scenario.percentage : scenario.hoursPerWeek)
  if (!value || value.compare(zero) <= 0) throw new PayrollProFormaError('SCENARIO_INPUT_INVALID', 400)
  if (scenario.type === 'EXTRA_PAID_HOURS' && value.compare(FixedDecimal.fromInteger(BigInt(80))) > 0) {
    throw new PayrollProFormaError('SCENARIO_INPUT_INVALID', 400)
  }
  if (scenario.type === 'SALARY_INCREASE' && value.compare(FixedDecimal.fromInteger(BigInt(100))) > 0) {
    throw new PayrollProFormaError('SCENARIO_INPUT_INVALID', 400)
  }
}

export type PayrollProFormaDependencies = {
  readonly authorizeSelf: () => Promise<EmployeePayrollAccess | null>
  readonly readSource: (input: PayrollSourceProviderInput, access: EmployeePayrollAccess) => Promise<PayrollSourceSnapshot>
  readonly now: () => Date
}

function currentPayrollPeriod(now: Date): { readonly year: number; readonly month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new PayrollProFormaError('PAYROLL_PERIOD_UNAVAILABLE', 503)
  }
  return { year, month }
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function atPath(value: unknown, path: readonly (string | number)[]): unknown {
  let current: unknown = value
  for (const key of path) {
    current = typeof key === 'number'
      ? Array.isArray(current) ? current[key] : undefined
      : object(current)?.[key]
    if (current === undefined) return undefined
  }
  return current
}

function decimal(value: unknown): FixedDecimal | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  try { return FixedDecimal.parse(String(value)) } catch { return null }
}

function serialized(valueType: PayrollSerializedValue['valueType'], value: FixedDecimal): PayrollSerializedValue {
  return { valueType, value: value.toString(value.scale) }
}

function scenarioGap(reasonCode: string, field = 'scenario', status: PayrollSourceGap['status'] = 'UNSUPPORTED'): PayrollSourceGap {
  return { field, status, reasonCode }
}

function withOverride(
  overrides: Record<string, PayrollSerializedValue>,
  key: string,
  valueType: PayrollSerializedValue['valueType'],
  value: FixedDecimal,
): void {
  overrides[key] = serialized(valueType, value)
}

function withBooleanOverride(overrides: Record<string, PayrollSerializedValue>, key: string, value: boolean): void {
  overrides[key] = { valueType: 'BOOLEAN', value }
}

function fixedSalarySource(source: Record<string, unknown>): {
  readonly fullTimeSalary: FixedDecimal
  readonly contractHours: FixedDecimal
  readonly fullTimeHours: FixedDecimal
  readonly caoApplied: boolean
  readonly caoGross: FixedDecimal | null
} | null {
  const rows = atPath(source, ['compensation', 'entries'])
  if (!Array.isArray(rows) || rows.length !== 1) return null
  const row = object(rows[0])
  const regularWage = object(source.regularWage)
  if (!row || row.paymentType !== 'PERIODIC_FIXED') return null
  const fullTimeSalary = decimal(regularWage?.fulltimeMonthlyAmount ?? row.fulltimeAmount)
  const contractHours = decimal(regularWage?.contractHoursPerWeek ?? atPath(source, ['schedule', 'entries', 0, 'averageHoursPerWeek']))
  const fullTimeHours = decimal(regularWage?.fulltimeHoursPerWeek ?? atPath(source, ['schedule', 'entries', 0, 'fulltimeHoursPerWeek']))
  const caoApplied = regularWage?.caoApplied === true
  const caoGross = caoApplied ? decimal(regularWage?.caoGrossAmount) : null
  if (!fullTimeSalary || !contractHours || !fullTimeHours || (caoApplied && !caoGross)) return null
  return { fullTimeSalary, contractHours, fullTimeHours, caoApplied, caoGross }
}

function calculateScenarioOverrides(
  snapshot: PayrollSourceSnapshot,
  scenario: PayrollProFormaScenario,
): { readonly overrides: Readonly<Record<string, PayrollSerializedValue>>; readonly gap: PayrollSourceGap | null } {
  const source = object(snapshot.canonicalSource)
  const payrollOwned = object(source?.payrollOwned)
  if (!source || !payrollOwned) return { overrides: {}, gap: scenarioGap('SCENARIO_PAYROLL_SOURCE_UNAVAILABLE') }
  const overrides: Record<string, PayrollSerializedValue> = {}

  if (scenario.type === 'BONUS') {
    const amount = decimal(scenario.amount)
    const currentBonus = decimal(atPath(source, ['payrollOwned', 'amounts', 'specialRewardWage']))
    const annualWageResolved = atPath(source, ['payrollOwned', 'taxProfile', 'specialRewardAnnualWageResolved']) === true
    const bonusPensionable = atPath(source, ['payrollOwned', 'controls', 'specialRewardPensionable'])
    if (!amount || amount.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) return { overrides, gap: scenarioGap('BONUS_AMOUNT_MUST_BE_POSITIVE') }
    if (!currentBonus || !annualWageResolved || bonusPensionable !== false) {
      return { overrides, gap: scenarioGap('SPECIAL_REWARD_TAX_OR_PENSION_PROFILE_UNRESOLVED', 'payrollConfiguration', 'SOURCE_GAP') }
    }
    withOverride(overrides, 'PAYFULL02_SPECIAL_REWARD_WAGE.amount', 'MONEY', currentBonus.add(amount).round(2, 'HALF_UP'))
    return { overrides, gap: null }
  }

  if (scenario.type === 'SALARY_INCREASE') {
    const percentage = decimal(scenario.percentage)
    if (!percentage || percentage.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0
      || percentage.compare(FixedDecimal.fromInteger(BigInt(100))) > 0) {
      return { overrides, gap: scenarioGap('SALARY_INCREASE_MUST_BE_BETWEEN_0_AND_100_PERCENT') }
    }
    const fixed = fixedSalarySource(source)
    if (fixed) {
      const increaseFactor = FixedDecimal.fromInteger(BigInt(100)).add(percentage)
        .divide(FixedDecimal.fromInteger(BigInt(100)), 8, 'HALF_UP')
      withOverride(overrides, 'PAYRUN01_FULLTIME_MONTHLY.amount', 'MONEY', fixed.fullTimeSalary.multiply(increaseFactor).round(2, 'HALF_UP'))
      if (fixed.caoApplied && fixed.caoGross) {
        withOverride(overrides, 'PAYFULL02_CAO_EXACT_GROSS_AMOUNT.amount', 'MONEY', fixed.caoGross.multiply(increaseFactor).round(2, 'HALF_UP'))
      }
      return { overrides, gap: null }
    }
    const variableAmount = decimal(atPath(source, ['payrollOwned', 'amounts', 'variableRegularWage']))
    const hourlyRate = decimal(atPath(source, ['payrollOwned', 'pension', 'variableHourlyBasis', 'hourlyRate']))
    if (!variableAmount || !hourlyRate) return { overrides, gap: scenarioGap('SUPPORTED_SALARY_BASIS_UNAVAILABLE', 'contractualSalary') }
    const increaseFactor = FixedDecimal.fromInteger(BigInt(100)).add(percentage)
      .divide(FixedDecimal.fromInteger(BigInt(100)), 8, 'HALF_UP')
    withOverride(overrides, 'PAYFULL02_VARIABLE_REGULAR_WAGE.amount', 'MONEY', variableAmount.multiply(increaseFactor).round(2, 'HALF_UP'))
    return { overrides, gap: null }
  }

  if (scenario.type === 'CONTRACT_HOURS') {
    const hours = decimal(scenario.hoursPerWeek)
    const fixed = fixedSalarySource(source)
    if (!fixed) return { overrides, gap: scenarioGap('CONTRACT_HOUR_SCENARIO_REQUIRES_FIXED_MONTHLY_SALARY', 'contractualHours') }
    if (fixed.caoApplied) return { overrides, gap: scenarioGap('CAO_CONTRACT_HOURS_REQUIRE_RECALCULATED_GROSS', 'contractualHours') }
    if (!hours || hours.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0 || hours.compare(fixed.fullTimeHours) > 0) {
      return { overrides, gap: scenarioGap('CONTRACT_HOURS_MUST_BE_POSITIVE_AND_AT_MOST_FULL_TIME', 'contractualHours') }
    }
    const factor = hours.divide(fixed.fullTimeHours, 4, 'HALF_UP')
    withOverride(overrides, 'PAYRUN01_CONTRACT_HOURS.hours', 'DECIMAL', hours)
    withOverride(overrides, 'PAYFULL02_PENSION_PART_TIME_FACTOR.factor', 'DECIMAL', factor)
    return { overrides, gap: null }
  }

  const hours = decimal(scenario.hours)
  const salaryRows = atPath(source, ['compensation', 'entries'])
  const salaryRow = Array.isArray(salaryRows) && salaryRows.length === 1 ? object(salaryRows[0]) : null
  const variableHourly = salaryRow?.paymentType === 'HOURLY_VARIABLE'
  if (!hours || hours.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0
    || hours.compare(FixedDecimal.fromInteger(BigInt(80))) > 0) {
    return { overrides, gap: scenarioGap('EXTRA_HOURS_MUST_BE_BETWEEN_0_AND_80') }
  }

  let hourlyRate: FixedDecimal | null = null
  let paidHours: FixedDecimal | null = null
  let fullTimeMonthlyHours: FixedDecimal | null = null
  let currentFactor: FixedDecimal | null = null
  const currentVariableAmount = decimal(atPath(source, ['payrollOwned', 'amounts', 'variableRegularWage']))
  if (variableHourly) {
    hourlyRate = decimal(atPath(source, ['payrollOwned', 'pension', 'variableHourlyBasis', 'hourlyRate']))
    paidHours = decimal(atPath(source, ['payrollOwned', 'pension', 'variableHourlyBasis', 'paidHours']))
    fullTimeMonthlyHours = decimal(atPath(source, ['payrollOwned', 'pension', 'variableHourlyBasis', 'fulltimeMonthlyHours']))
    currentFactor = decimal(atPath(source, ['payrollOwned', 'pension', 'partTimeFactor']))
  } else {
    const fixed = fixedSalarySource(source)
    if (!fixed) return { overrides, gap: scenarioGap('EXTRA_HOURS_REQUIRE_SUPPORTED_FIXED_OR_ON_CALL_SOURCE', 'actualWork') }
    fullTimeMonthlyHours = fixed.fullTimeHours.multiply(FixedDecimal.fromInteger(BigInt(52)))
      .divide(FixedDecimal.fromInteger(BigInt(12)), 8, 'HALF_UP')
    const salaryTable = object(source.salaryTableSource)
    const resolvedHourlyAmount = salaryTable?.status === 'RESOLVED'
      && atPath(source, ['salaryTableSource', 'source', 'currencyCode']) === 'EUR'
      ? decimal(atPath(source, ['salaryTableSource', 'source', 'hourlyAmount']))
      : null
    hourlyRate = resolvedHourlyAmount ?? fixed.fullTimeSalary.divide(fullTimeMonthlyHours, 8, 'HALF_UP')
    currentFactor = decimal(atPath(source, ['payrollOwned', 'pension', 'partTimeFactor']))
  }
  if (!hourlyRate || !fullTimeMonthlyHours || !currentVariableAmount || !currentFactor
    || hourlyRate.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0
    || fullTimeMonthlyHours.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) {
    return { overrides, gap: scenarioGap('EXTRA_HOURS_RATE_OR_PENSION_BASIS_UNAVAILABLE', 'actualWork') }
  }
  const addedFraction = hours.divide(fullTimeMonthlyHours, 8, 'HALF_UP')
  const scenarioFactor = (variableHourly && paidHours
    ? paidHours.add(hours).divide(fullTimeMonthlyHours, 8, 'HALF_UP')
    : currentFactor.add(addedFraction))
  const one = FixedDecimal.fromInteger(BigInt(1))
  const boundedFactor = scenarioFactor.compare(one) > 0 ? one : scenarioFactor
  const extraWage = hourlyRate.multiply(hours).round(2, 'HALF_UP')
  const regularWage = object(source.regularWage)
  const caoGross = !variableHourly && regularWage?.caoApplied === true ? decimal(regularWage.caoGrossAmount) : null
  if (caoGross) {
    withOverride(overrides, 'PAYFULL02_CAO_EXACT_GROSS_AMOUNT.amount', 'MONEY', caoGross.add(extraWage).round(2, 'HALF_UP'))
  } else {
    withOverride(overrides, 'PAYFULL02_VARIABLE_REGULAR_WAGE.amount', 'MONEY',
      currentVariableAmount.add(extraWage).round(2, 'HALF_UP'))
  }
  withBooleanOverride(overrides, 'PAYFULL02_RECURRING_WAGE_CLASSIFIED.value', true)
  withOverride(overrides, 'PAYFULL02_PENSION_PART_TIME_FACTOR.factor', 'DECIMAL', boundedFactor.round(4, 'HALF_UP'))
  return { overrides, gap: null }
}

function amounts(result: ReturnType<typeof calculatePayrollSnapshot>['result']): PayrollProFormaAmounts | null {
  if (!result) return null
  const read = (key: string) => {
    const row = result.resultRows.find((item) => item.key === key)
    return row && typeof row.value === 'string' ? row.value : null
  }
  const values = {
    gross: read('gross_salary'),
    employeePension: read('employee_pension'),
    employerPension: read('employer_pension'),
    taxableWage: read('taxable_wage'),
    wageTax: read('wage_tax'),
    net: read('net_salary'),
    employerCosts: read('total_employer_cost'),
  }
  return Object.values(values).every((value): value is string => value !== null)
    ? values as PayrollProFormaAmounts
    : null
}

function difference(before: PayrollProFormaAmounts, after: PayrollProFormaAmounts): PayrollProFormaAmounts {
  return Object.fromEntries(Object.keys(before).map((key) => {
    const name = key as keyof PayrollProFormaAmounts
    return [name, FixedDecimal.parse(after[name]).subtract(FixedDecimal.parse(before[name])).toString(2)]
  })) as PayrollProFormaAmounts
}

const defaultDependencies: PayrollProFormaDependencies = {
  authorizeSelf: authorizeMySalaryPayrollAccess,
  readSource: async (input, access) => {
    // authorizeSelf has already enforced the existing own-employee salary
    // permission and returned the active Payroll scope. Keep the actual source
    // read under the same authenticated database/RLS session.
    return await new LiquidHrPayrollSourceProvider().getPayrollSourceSnapshotForAuthorizedEmployee(input, {
      employeeId: access.employeeId,
      scope: access.scope,
    })
  },
  now: () => new Date(),
}

export function createPayrollProFormaService(dependencies: PayrollProFormaDependencies = defaultDependencies) {
  return {
    async calculate(scenario: PayrollProFormaScenario): Promise<PayrollProFormaResult> {
      validateScenario(scenario)
      const access = await dependencies.authorizeSelf()
      if (!access) throw new PayrollProFormaError('PAYROLL_SELF_ACCESS_UNAVAILABLE', 403)
      const period = currentPayrollPeriod(dependencies.now())
      const snapshot = await dependencies.readSource({
        ...access.scope,
        employeeId: access.employeeId,
        payrollPeriod: period,
      }, access)
      if (snapshot.sourceEmployeeId !== access.employeeId
        || snapshot.sourceTenantId !== access.scope.tenantId
        || snapshot.sourceHrGroupId !== access.scope.hrGroupId
        || snapshot.sourceAdministrationId !== access.scope.administrationId
        || snapshot.periodReference.year !== period.year || snapshot.periodReference.month !== period.month) {
        throw new PayrollProFormaError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
      }

      const baselineCalculation = calculatePayrollSnapshot(snapshot)
      const emptyHashes = { baselineInput: baselineCalculation.inputHash, baselineResult: baselineCalculation.resultHash, scenarioInput: null, scenarioResult: null }
      if (baselineCalculation.status !== 'CALCULATED') {
        return {
          status: baselineCalculation.status,
          sourceStatus: baselineCalculation.status === 'SOURCE_GAP' ? 'SOURCE_GAP' : 'INCOMPLETE',
          scenarioType: scenario.type, period, sourceHash: snapshot.sourceHash,
          baseline: null, scenario: null, difference: null, hashes: emptyHashes, traceSteps: 0,
          gaps: baselineCalculation.gaps,
        }
      }
      const baselineAmounts = amounts(baselineCalculation.result)
      if (!baselineAmounts) {
        return {
          status: 'INCOMPLETE', sourceStatus: 'INCOMPLETE', scenarioType: scenario.type, period,
          sourceHash: snapshot.sourceHash, baseline: null, scenario: null, difference: null,
          hashes: emptyHashes, traceSteps: baselineCalculation.result?.trace.length ?? 0,
          gaps: [{ field: 'calculation', status: 'SOURCE_GAP', reasonCode: 'REQUIRED_RESULT_AMOUNT_UNAVAILABLE' }],
        }
      }

      const scenarioValues = calculateScenarioOverrides(snapshot, scenario)
      if (scenarioValues.gap) {
        return {
          status: scenarioValues.gap.status === 'SOURCE_GAP' ? 'SOURCE_GAP' : 'UNSUPPORTED',
          sourceStatus: 'READY', scenarioType: scenario.type, period, sourceHash: snapshot.sourceHash,
          baseline: baselineAmounts, scenario: null, difference: null,
          hashes: { ...emptyHashes }, traceSteps: baselineCalculation.result?.trace.length ?? 0,
          gaps: [scenarioValues.gap],
        }
      }
      const scenarioCalculation = calculatePayrollSnapshot(snapshot, scenarioValues.overrides)
      if (scenarioCalculation.status !== 'CALCULATED') {
        return {
          status: scenarioCalculation.status, sourceStatus: 'READY', scenarioType: scenario.type,
          period, sourceHash: snapshot.sourceHash, baseline: baselineAmounts, scenario: null, difference: null,
          hashes: { ...emptyHashes, scenarioInput: scenarioCalculation.inputHash, scenarioResult: scenarioCalculation.resultHash },
          traceSteps: baselineCalculation.result?.trace.length ?? 0,
          gaps: scenarioCalculation.gaps,
        }
      }
      const scenarioAmounts = amounts(scenarioCalculation.result)
      if (!scenarioAmounts) {
        return {
          status: 'INCOMPLETE', sourceStatus: 'INCOMPLETE', scenarioType: scenario.type,
          period, sourceHash: snapshot.sourceHash, baseline: baselineAmounts, scenario: null, difference: null,
          hashes: { ...emptyHashes, scenarioInput: scenarioCalculation.inputHash, scenarioResult: scenarioCalculation.resultHash },
          traceSteps: baselineCalculation.result?.trace.length ?? 0,
          gaps: [{ field: 'scenario', status: 'SOURCE_GAP', reasonCode: 'REQUIRED_RESULT_AMOUNT_UNAVAILABLE' }],
        }
      }
      if (baselineCalculation.sourceHash !== scenarioCalculation.sourceHash) {
        throw new PayrollProFormaError('PAYROLL_PRO_FORMA_SOURCE_MISMATCH')
      }
      return {
        status: 'CALCULATED', sourceStatus: 'READY', scenarioType: scenario.type, period,
        sourceHash: snapshot.sourceHash, baseline: baselineAmounts, scenario: scenarioAmounts,
        difference: difference(baselineAmounts, scenarioAmounts),
        hashes: {
          baselineInput: baselineCalculation.inputHash, baselineResult: baselineCalculation.resultHash,
          scenarioInput: scenarioCalculation.inputHash, scenarioResult: scenarioCalculation.resultHash,
        },
        traceSteps: (baselineCalculation.result?.trace.length ?? 0) + (scenarioCalculation.result?.trace.length ?? 0),
        gaps: [],
      }
    },
  }
}

export async function calculateMySalaryProForma(scenario: PayrollProFormaScenario): Promise<PayrollProFormaResult> {
  return await createPayrollProFormaService().calculate(scenario)
}
