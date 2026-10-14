import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { requireComponentLibraryAccess } from './component-library-access'
import {
  calculateEmployeePayroll,
  inspectEmployeePayrollSource,
  type EmployeePayrollCalculationView,
  type EmployeePayrollPeriod,
  type EmployeePayrollPreflightView,
} from './employee-payroll-calculation-service'
import { createPayrollCalculationRepository } from './calculation-repository'
import type { PayrollScope } from './scope'

export type PayrollProfessionalEmployee = {
  readonly employeeId: string
  readonly employmentId: string
  readonly employeeNumber: string
  readonly employeeName: string
  readonly employmentNumber: string
  readonly startsOn: string
  readonly endsOn: string | null
  readonly isPrimary: boolean
}

export type PayrollProfessionalPeriod = {
  readonly key: string
  readonly year: number
  readonly month: number
  readonly startsOn: string
  readonly endsOn: string
  readonly status: string
}

export type PayrollProfessionalRunWorkspace = {
  readonly administrationName: string
  readonly periods: readonly PayrollProfessionalPeriod[]
  readonly selectedPeriod: PayrollProfessionalPeriod | null
  readonly employees: readonly PayrollProfessionalEmployee[]
  readonly rosterComplete: boolean
  readonly canOpenPayrollCycle: boolean
}

export type PayrollProfessionalRunItem = {
  readonly employeeNumber: string
  readonly employeeName: string
  readonly employmentNumber: string
  readonly state: 'SOURCE_GAP' | 'UNSUPPORTED' | 'INCOMPLETE' | 'CALCULATED' | 'FAILED'
  readonly grossAmount: string | null
  readonly wageTaxAmount: string | null
  readonly remainingAfterWageTax: string | null
  readonly employerCosts: string | null
  readonly missingFields: readonly { field: string; unsupported: boolean }[]
  readonly incompleteComponents: readonly string[]
}

export type PayrollProfessionalBatchResult = {
  readonly message: 'success' | 'partial' | 'emptySelection' | 'tooManySelected' | 'periodUnavailable' | 'scopeChanged' | 'sourceNotReady' | 'accessDenied' | 'failed'
  readonly items: readonly PayrollProfessionalRunItem[]
}

const MAX_ROSTER_SIZE = 5000
const MAX_BATCH_SIZE = 50

function toPeriod(row: {
  readonly period_year: number
  readonly period_month: number
  readonly starts_on: string
  readonly ends_on: string
  readonly status: string
}): PayrollProfessionalPeriod {
  return {
    key: `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
    year: row.period_year,
    month: row.period_month,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
  }
}

function parsePeriodKey(value: string | undefined): { readonly key: string; readonly year: number; readonly month: number } | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  const [yearPart, monthPart] = value.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  return Number.isInteger(year) && year >= 2000 && year <= 2200 ? { key: value, year, month } : null
}

async function listScopedEmployments(scope: PayrollScope, period: PayrollProfessionalPeriod) {
  const supabase = await createClient()
  const { data, count, error } = await supabase.from('employments')
    .select('id,employee_id,employment_number,starts_on,ends_on,is_primary', { count: 'exact' })
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('administration_id', scope.administrationId)
    .eq('record_status', 'CONFIRMED')
    .is('deleted_at', null)
    .lte('starts_on', period.endsOn)
    .or(`ends_on.is.null,ends_on.gte.${period.startsOn}`)
    .order('employment_number', { ascending: true })
    .range(0, MAX_ROSTER_SIZE - 1)
  if (error) throw error
  return { rows: data ?? [], complete: (count ?? 0) <= MAX_ROSTER_SIZE }
}

async function projectScopedEmployees(scope: PayrollScope, employments: Awaited<ReturnType<typeof listScopedEmployments>>['rows']) {
  const employeeIds = [...new Set(employments.map((employment) => employment.employee_id))]
  if (employeeIds.length === 0) return [] as PayrollProfessionalEmployee[]

  const supabase = await createClient()
  const { data, error } = await supabase.from('employees')
    .select('id,employee_number,first_name,birth_name_prefix,birth_name')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .in('id', employeeIds)
    .is('deleted_at', null)
    .order('employee_number', { ascending: true })
    .limit(MAX_ROSTER_SIZE)
  if (error) throw error

  const employeeById = new Map((data ?? []).map((employee) => [employee.id, employee]))
  return employments.flatMap((employment) => {
    const employee = employeeById.get(employment.employee_id)
    if (!employee) return []
    const employeeName = [employee.first_name, employee.birth_name_prefix, employee.birth_name]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join(' ')
    return [{
      employeeId: employment.employee_id,
      employmentId: employment.id,
      employeeNumber: employee.employee_number,
      employeeName,
      employmentNumber: employment.employment_number,
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      isPrimary: employment.is_primary,
    }]
  })
}

export async function getPayrollProfessionalRunWorkspace(periodKey?: string): Promise<PayrollProfessionalRunWorkspace> {
  const access = await requireComponentLibraryAccess(false)
  const repository = createPayrollCalculationRepository()
  const periodRows = await repository.listPayrollPeriods(access.scope, access.administration.id)
  const periods = periodRows.map(toPeriod)
  const parsed = parsePeriodKey(periodKey)
  const selectedPeriod = parsed
    ? periods.find((period) => period.key === parsed.key) ?? null
    : periods.find((period) => period.status === 'OPEN') ?? null

  const supabase = await createClient()
  const { data: administration, error: administrationError } = await supabase.from('administrations')
    .select('name')
    .eq('id', access.scope.administrationId)
    .eq('tenant_id', access.scope.tenantId)
    .eq('hr_group_id', access.scope.hrGroupId)
    .eq('is_active', true)
    .maybeSingle()
  if (administrationError) throw administrationError
  if (!administration) throw new Error('Active payroll administration is unavailable.')

  if (!selectedPeriod) {
    return {
      administrationName: administration.name,
      periods,
      selectedPeriod: null,
      employees: [],
      rosterComplete: true,
      canOpenPayrollCycle: access.canCopy,
    }
  }
  const roster = await listScopedEmployments(access.scope, selectedPeriod)
  const employees = await projectScopedEmployees(access.scope, roster.rows)
  return {
    administrationName: administration.name,
    periods,
    selectedPeriod,
    employees,
    rosterComplete: roster.complete,
    canOpenPayrollCycle: access.canCopy,
  }
}

function isBlockingGap(preflight: EmployeePayrollPreflightView): boolean {
  return !preflight.eligibleForCalculation
}

function stateForCalculation(result: EmployeePayrollCalculationView): PayrollProfessionalRunItem['state'] {
  if (result.status === 'SOURCE_GAP') return 'SOURCE_GAP'
  if (result.status === 'UNSUPPORTED') return 'UNSUPPORTED'
  if (result.status === 'INCOMPLETE' || result.completeness === 'INCOMPLETE') return 'INCOMPLETE'
  if (result.status === 'CALCULATED') return 'CALCULATED'
  return 'FAILED'
}

function displayMissingFields(gaps: readonly { field: string; status: string; reasonCode: string }[]) {
  const fiscalProfileMissing = gaps.some((gap) => gap.field === 'taxProfile')
  return gaps
    .filter((gap) => !(fiscalProfileMissing && gap.reasonCode === 'SUPPORTED_REGULAR_WAGE_INPUT_UNAVAILABLE'))
    .map((gap) => ({ field: gap.field, unsupported: gap.status === 'UNSUPPORTED' }))
}

function toRunItem(
  employee: PayrollProfessionalEmployee,
  result: EmployeePayrollCalculationView,
): PayrollProfessionalRunItem {
  return {
    employeeNumber: employee.employeeNumber,
    employeeName: employee.employeeName,
    employmentNumber: employee.employmentNumber,
    state: stateForCalculation(result),
    grossAmount: result.grossAmount,
    wageTaxAmount: result.wageTaxAmount,
    remainingAfterWageTax: result.netAfterWageTax,
    employerCosts: null,
    missingFields: displayMissingFields(result.gaps),
    incompleteComponents: [...result.incompleteComponents],
  }
}

function toPreflightItem(
  employee: PayrollProfessionalEmployee,
  result: EmployeePayrollPreflightView,
): PayrollProfessionalRunItem {
  const unsupported = result.gaps.some((gap) => gap.status === 'UNSUPPORTED')
  return {
    employeeNumber: employee.employeeNumber,
    employeeName: employee.employeeName,
    employmentNumber: employee.employmentNumber,
    state: unsupported ? 'UNSUPPORTED' : 'SOURCE_GAP',
    grossAmount: null,
    wageTaxAmount: null,
    remainingAfterWageTax: null,
    employerCosts: null,
    missingFields: displayMissingFields(result.gaps),
    incompleteComponents: [],
  }
}

export async function calculatePayrollProfessionalBatch(input: {
  readonly periodKey: string
  readonly employmentIds: readonly string[]
}): Promise<PayrollProfessionalBatchResult> {
  if (input.employmentIds.length === 0) return { message: 'emptySelection', items: [] }
  if (input.employmentIds.length > MAX_BATCH_SIZE || new Set(input.employmentIds).size !== input.employmentIds.length) {
    return { message: 'tooManySelected', items: [] }
  }
  const parsedPeriod = parsePeriodKey(input.periodKey)
  if (!parsedPeriod) return { message: 'periodUnavailable', items: [] }

  try {
    const access = await requireComponentLibraryAccess(true)
    const repository = createPayrollCalculationRepository()
    const periods = await repository.listPayrollPeriods(access.scope, access.administration.id)
    const period = periods.find((candidate) => candidate.period_year === parsedPeriod.year
      && candidate.period_month === parsedPeriod.month)
    if (!period || period.status !== 'OPEN') return { message: 'periodUnavailable', items: [] }

    const selectedPeriod = toPeriod(period)
    const roster = await listScopedEmployments(access.scope, selectedPeriod)
    if (!roster.complete) return { message: 'scopeChanged', items: [] }
    const selectedIds = new Set(input.employmentIds)
    const selectedRows = roster.rows.filter((employment) => selectedIds.has(employment.id))
    if (selectedRows.length !== selectedIds.size) return { message: 'scopeChanged', items: [] }
    const employees = await projectScopedEmployees(access.scope, selectedRows)
    if (employees.length !== selectedRows.length) return { message: 'scopeChanged', items: [] }

    const periodReference: EmployeePayrollPeriod = { year: parsedPeriod.year, month: parsedPeriod.month }
    const preflight = await Promise.all(employees.map((employee) => inspectEmployeePayrollSource({
      employeeId: employee.employeeId,
      employmentId: employee.employmentId,
      period: periodReference,
    })))
    const employeeByEmployment = new Map(employees.map((employee) => [employee.employmentId, employee]))
    const blockedItems = preflight.flatMap((result) => {
      if (!isBlockingGap(result)) return []
      const employee = employeeByEmployment.get(result.employmentId)
      return employee ? [toPreflightItem(employee, result)] : []
    })
    const eligibleIds = new Set(preflight.filter((result) => !isBlockingGap(result)).map((result) => result.employmentId))
    const eligibleEmployees = employees.filter((employee) => eligibleIds.has(employee.employmentId))
    if (eligibleEmployees.length === 0) return { message: 'sourceNotReady', items: blockedItems }

    const items: PayrollProfessionalRunItem[] = [...blockedItems]
    for (const employee of eligibleEmployees) {
      try {
        const result = await calculateEmployeePayroll({
          employeeId: employee.employeeId,
          employmentId: employee.employmentId,
          period: periodReference,
        })
        items.push(toRunItem(employee, result))
      } catch {
        items.push({
          employeeNumber: employee.employeeNumber,
          employeeName: employee.employeeName,
          employmentNumber: employee.employmentNumber,
          state: 'FAILED',
          grossAmount: null,
          wageTaxAmount: null,
          remainingAfterWageTax: null,
          employerCosts: null,
          missingFields: [],
          incompleteComponents: [],
        })
      }
    }
    const hasCalculationFailure = items.some((item) => item.state === 'FAILED')
    return { message: blockedItems.length > 0 || hasCalculationFailure ? 'partial' : 'success', items }
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') return { message: 'accessDenied', items: [] }
    return { message: 'failed', items: [] }
  }
}
