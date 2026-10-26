import 'server-only'

import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { loadQueriesInBatches } from '@/lib/supabase/bounded-query-loader'
import { createClient } from '@/lib/supabase/server'
import { buildPayrollSourceIncomeRelationshipProjection } from './payroll-source-income-relationship-projection'

type TaxProfileRow = Database['public']['Tables']['employment_payroll_tax_profiles']['Row']

export type EmploymentPayrollTaxSourceProjection = {
  readonly ageCategory: 'UNDER_AOW' | 'AT_OR_ABOVE_AOW' | null
  readonly ageSourceUpdatedAt: string | null
  readonly activeIncomeRelationshipCount: number
  readonly incomeRelationshipLinkGap: boolean
  readonly incomeRelationships: readonly {
    readonly id: string
    readonly updatedAt: string
    readonly reportingStatus: string
    readonly ikvNumber: number
    readonly startsOn: string
    readonly endsOn: string | null
  }[]
  readonly payrollIncomeRelationshipProjection?: {
    readonly complete: boolean
    readonly rows: readonly {
      readonly id: string
      readonly incomeRelationshipId: string
      readonly validFrom: string
      readonly validUntil: string | null
      readonly linkUpdatedAt: string
      readonly reportingStatus: 'DRAFT' | 'READY' | 'REPORTED' | 'CLOSED'
      readonly startsOn: string
      readonly endsOn: string | null
      readonly incomeRelationshipUpdatedAt: string
    }[]
  }
  readonly taxProfiles: readonly Pick<TaxProfileRow,
    | 'id' | 'employee_id' | 'employment_id' | 'income_relationship_id' | 'employment_income_relationship_id'
    | 'residence_country_code' | 'wage_tax_table' | 'herleiding_code' | 'time_period' | 'regular_wage_only'
    | 'full_period_only' | 'has_special_situation' | 'payroll_tax_credit_applies' | 'source_classification'
    | 'source_reference' | 'effective_from' | 'effective_to' | 'version_number' | 'supersedes_profile_id'
    | 'confirmed_by_user_id' | 'confirmed_at' | 'created_at'
  >[]
}

export type EmploymentPayrollTaxDossier = {
  readonly employee: { readonly id: string; readonly employeeNumber: string; readonly displayName: string }
  readonly employment: {
    readonly id: string
    readonly number: string
    readonly startsOn: string
    readonly endsOn: string | null
    readonly recordStatus: string
    readonly employmentType: string | null
    readonly contractType: string | null
  }
  readonly administration: { readonly id: string; readonly name: string }
  readonly incomeRelationships: readonly {
    readonly linkId: string
    readonly incomeRelationshipId: string
    readonly ikvNumber: number
    readonly relationshipType: string
    readonly reportingStatus: string
    readonly startsOn: string
    readonly endsOn: string | null
    readonly validFrom: string
    readonly validUntil: string | null
  }[]
  readonly payrollTaxNumbers: readonly {
    readonly payrollTaxNumber: string
    readonly isPrimary: boolean
    readonly validFrom: string
    readonly validUntil: string | null
  }[]
  readonly schedules: readonly {
    readonly startsOn: string
    readonly endsOn: string | null
    readonly isOnCall: boolean
    readonly onCallObligation: boolean | null
    readonly workScope: string | null
    readonly averageHoursPerWeek: number
  }[]
  readonly taxProfiles: EmploymentPayrollTaxSourceProjection['taxProfiles']
  readonly auditHistory: readonly {
    readonly id: string
    readonly taxProfileId: string
    readonly action: string
    readonly recordedAt: string
    readonly sourceReference: string | null
  }[]
  readonly ageCategory: EmploymentPayrollTaxSourceProjection['ageCategory']
}

export type PayrollFiscalAdministrationSettings = {
  readonly administration: { readonly id: string; readonly name: string }
  readonly canManagePayrollTaxNumbers: boolean
  readonly payrollTaxNumbers: readonly {
    readonly id: string
    readonly payrollTaxNumber: string
    readonly payrollTaxSubnumber: string
    readonly isPrimary: boolean
    readonly validFrom: string
    readonly validUntil: string | null
    readonly linkedIncomeRelationships: readonly {
      readonly employeeId: string
      readonly employeeName: string
      readonly employeeNumber: string
      readonly ikvNumber: number
      readonly reportingStatus: string
    }[]
  }[]
  readonly rows: readonly {
    readonly employeeId: string
    readonly employeeNumber: string
    readonly employeeName: string
    readonly employmentId: string
    readonly employmentNumber: string
    readonly startsOn: string
    readonly endsOn: string | null
    readonly active: boolean
    readonly incomeRelationshipCount: number
    readonly fiscalProfilePresent: boolean
  }[]
}

export type ConfirmEmploymentPayrollTaxProfileInput = {
  readonly employeeId: string
  readonly employmentId: string
  readonly incomeRelationshipId: string
  readonly effectiveFrom: string
  readonly effectiveTo?: string | null
  readonly payrollTaxCreditApplies: boolean
  readonly sourceClassification: 'HR_ADMIN_CONFIRMED'
  readonly sourceReference: string
  readonly idempotencyKey: string
}

export class EmploymentPayrollTaxProfileError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly sourceCategory?: string,
    readonly databaseCode?: string,
  ) {
    super(code)
    this.name = 'EmploymentPayrollTaxProfileError'
  }
}

function isHrPayrollAdmin(context: AuthContext): boolean {
  return context.activeRoles.includes('HR_ADMIN') || context.activeRoles.includes('TENANT_ADMIN')
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function containsSensitiveSourceReference(value: string): boolean {
  return /\b\d{8,9}\b|\bNL\d{2}[A-Z]{4}\d{10}\b|\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(value)
}

function payrollPeriodStart(period: { readonly year: number; readonly month: number }): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function payrollPeriodEnd(period: { readonly year: number; readonly month: number }): string {
  return new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10)
}

function ageOn(birthDate: string, date: string): number | null {
  if (!isIsoDate(birthDate) || !isIsoDate(date)) return null
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [year, month, day] = date.split('-').map(Number)
  if (birthYear === undefined || birthMonth === undefined || birthDay === undefined
    || year === undefined || month === undefined || day === undefined) return null
  const birthdayPassed = month > birthMonth || (month === birthMonth && day >= birthDay)
  return year - birthYear - (birthdayPassed ? 0 : 1)
}

type PayrollTaxEmployeeSource = Pick<Database['public']['Tables']['employees']['Row'], 'birth_date' | 'updated_at'>
type PayrollTaxIncomeSource = Pick<Database['public']['Tables']['income_relationships']['Row'],
  'id' | 'ikv_number' | 'reporting_status' | 'relationship_type' | 'starts_on' | 'ends_on' | 'updated_at'
>
type PayrollTaxIncomeLinkSource = Pick<Database['public']['Tables']['employment_income_relationships']['Row'],
  'id' | 'employment_id' | 'income_relationship_id' | 'valid_from' | 'valid_until' | 'updated_at'
>
type PayrollTaxEmploymentSource = Pick<Database['public']['Tables']['employments']['Row'],
  'id' | 'starts_on' | 'ends_on' | 'record_status' | 'deleted_at'
>

function projectEmploymentPayrollTaxSource(input: {
  readonly employmentId: string
  readonly period: { readonly year: number; readonly month: number }
  readonly employee: PayrollTaxEmployeeSource
  readonly incomeRelationships: readonly PayrollTaxIncomeSource[]
  readonly links: readonly PayrollTaxIncomeLinkSource[]
  readonly employments: readonly PayrollTaxEmploymentSource[]
  readonly taxProfiles: readonly EmploymentPayrollTaxSourceProjection['taxProfiles'][number][]
}): EmploymentPayrollTaxSourceProjection {
  const start = payrollPeriodStart(input.period)
  const end = payrollPeriodEnd(input.period)
  const activeEmployments = input.employments.filter((row) =>
    row.starts_on <= end && (row.ends_on === null || row.ends_on >= start),
  )
  const activeEmploymentIds = new Set(activeEmployments.map((row) => row.id))
  const activeLinks = input.links.filter((link) =>
    activeEmploymentIds.has(link.employment_id)
    && link.valid_from <= end
    && (link.valid_until === null || link.valid_until >= start),
  )
  const activeIncomeRelationships = input.incomeRelationships.filter((income) =>
    income.relationship_type === 'EMPLOYMENT'
    && income.reporting_status !== 'DRAFT'
    && income.starts_on <= end
    && (income.ends_on === null || income.ends_on >= start),
  )
  const incomeIds = new Set(activeIncomeRelationships.map((income) => income.id))
  const activeLinkedIds = new Set(activeLinks
    .filter((link) => incomeIds.has(link.income_relationship_id))
    .map((link) => link.income_relationship_id))
  const linkCounts = new Map<string, number>()
  for (const link of activeLinks) {
    if (incomeIds.has(link.income_relationship_id)) {
      linkCounts.set(link.income_relationship_id, (linkCounts.get(link.income_relationship_id) ?? 0) + 1)
    }
  }
  const incomeRelationshipLinkGap = activeIncomeRelationships.some((income) => linkCounts.get(income.id) !== 1)
    || [...linkCounts.values()].some((count) => count !== 1)

  const age = input.employee.birth_date ? ageOn(input.employee.birth_date, end) : null
  const ageCategory = age === null ? null : age < 67 ? 'UNDER_AOW' : 'AT_OR_ABOVE_AOW'
  const taxProfiles = input.taxProfiles.filter((profile) =>
    profile.employment_id === input.employmentId
    || activeLinkedIds.has(profile.income_relationship_id),
  )
  const payrollIncomeRelationshipProjection = buildPayrollSourceIncomeRelationshipProjection({
    employmentId: input.employmentId,
    complete: input.employments.length < 100
      && input.links.length < 100
      && input.incomeRelationships.length < 100,
    links: activeLinks,
    incomeRelationships: input.incomeRelationships,
  })
  return {
    ageCategory,
    ageSourceUpdatedAt: input.employee.updated_at,
    activeIncomeRelationshipCount: activeLinkedIds.size,
    incomeRelationshipLinkGap,
    incomeRelationships: activeIncomeRelationships.map((income) => ({
      id: income.id,
      updatedAt: income.updated_at,
      reportingStatus: income.reporting_status,
      ikvNumber: income.ikv_number,
      startsOn: income.starts_on,
      endsOn: income.ends_on,
    })),
    payrollIncomeRelationshipProjection,
    taxProfiles: taxProfiles as EmploymentPayrollTaxSourceProjection['taxProfiles'],
  }
}

/**
 * Reads only the minimum Core data needed to classify the bounded tax rule.
 * Raw birth date is deliberately reduced to an age category before return.
 */
export async function getEmploymentPayrollTaxSourceProjection(
  employeeId: string,
  employmentId: string,
  period: { readonly year: number; readonly month: number },
): Promise<EmploymentPayrollTaxSourceProjection> {
  const salaryContext = await requirePermission('salary:read', employeeId)
  const identityContext = await requirePermission('employee:read', employeeId)
  if (!salaryContext.administrationId || !salaryContext.hrGroupId
    || identityContext.tenantId !== salaryContext.tenantId
    || identityContext.hrGroupId !== salaryContext.hrGroupId
    || identityContext.administrationId !== salaryContext.administrationId) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SCOPE_UNAVAILABLE', 404)
  }
  const administrationId = salaryContext.administrationId
  const hrGroupId = salaryContext.hrGroupId

  const start = payrollPeriodStart(period)
  const end = payrollPeriodEnd(period)
  const supabase = await createClient()
  const [employeeResult, incomeResult, linkResult, employmentResult, profileResult] = await loadQueriesInBatches([
    () => supabase.from('employees').select('birth_date, updated_at')
      .eq('id', employeeId).eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', hrGroupId)
      .is('deleted_at', null).maybeSingle(),
    () => supabase.from('income_relationships')
      .select('id, ikv_number, reporting_status, relationship_type, starts_on, ends_on, updated_at')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', administrationId)
      .eq('employee_id', employeeId).is('deleted_at', null).lte('starts_on', end)
      .or(`ends_on.is.null,ends_on.gte.${start}`).limit(100),
    () => supabase.from('employment_income_relationships')
      .select('id, employment_id, income_relationship_id, valid_from, valid_until, updated_at')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', administrationId)
      .eq('employee_id', employeeId).lte('valid_from', end)
      .or(`valid_until.is.null,valid_until.gte.${start}`).limit(100),
    () => supabase.from('employments').select('id, starts_on, ends_on, record_status, deleted_at')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', hrGroupId)
      .eq('administration_id', administrationId).eq('employee_id', employeeId)
      .eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', end)
      .or(`ends_on.is.null,ends_on.gte.${start}`).limit(100),
    () => supabase.from('employment_payroll_tax_profiles').select('*')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', hrGroupId)
      .eq('administration_id', administrationId).eq('employee_id', employeeId)
      .lte('effective_from', end).or(`effective_to.is.null,effective_to.gte.${start}`)
      .order('effective_from').order('version_number').limit(200),
  ], 4)
  const failedRead = [
    { sourceCategory: 'employees', error: employeeResult.error },
    { sourceCategory: 'income-relationships', error: incomeResult.error },
    { sourceCategory: 'employment-income-relationships', error: linkResult.error },
    { sourceCategory: 'employments', error: employmentResult.error },
    { sourceCategory: 'employment-payroll-tax-profiles', error: profileResult.error },
  ].find((result) => result.error)
  if (failedRead?.error) {
    const code = failedRead.error.code
    const databaseCode = typeof code === 'string' && /^(?:PGRST\d{3}|[0-9A-Z]{5})$/.test(code) ? code : undefined
    throw new EmploymentPayrollTaxProfileError(
      'PAYROLL_TAX_PROFILE_SOURCE_UNAVAILABLE',
      503,
      failedRead.sourceCategory,
      databaseCode,
    )
  }
  if (!employeeResult.data) throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_EMPLOYEE_NOT_FOUND', 404)

  return projectEmploymentPayrollTaxSource({
    employmentId,
    period,
    employee: employeeResult.data,
    incomeRelationships: incomeResult.data ?? [],
    links: linkResult.data ?? [],
    employments: employmentResult.data ?? [],
    taxProfiles: profileResult.data ?? [],
  })
}

/** Bounded same-scope batch read for the Payroll worklist tax source. */
export async function getEmploymentPayrollTaxSourceProjectionsBatch(
  inputs: readonly {
    readonly employeeId: string
    readonly employmentId: string
    readonly period: { readonly year: number; readonly month: number }
  }[],
): Promise<EmploymentPayrollTaxSourceProjection[]> {
  if (inputs.length === 0) return []
  const period = inputs[0]?.period
  if (!period || inputs.some((input) => input.period.year !== period.year || input.period.month !== period.month)) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_INPUT_INVALID', 400)
  }

  const authorization = await loadQueriesInBatches(inputs.map((input) => async () => {
    const salaryContext = await requirePermission('salary:read', input.employeeId)
    const identityContext = await requirePermission('employee:read', input.employeeId)
    if (!salaryContext.administrationId || !salaryContext.hrGroupId
      || identityContext.tenantId !== salaryContext.tenantId
      || identityContext.hrGroupId !== salaryContext.hrGroupId
      || identityContext.administrationId !== salaryContext.administrationId) {
      throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SCOPE_UNAVAILABLE', 404)
    }
    return { tenantId: salaryContext.tenantId, hrGroupId: salaryContext.hrGroupId, administrationId: salaryContext.administrationId }
  }), 12)
  const first = authorization[0]
  if (!first) return []
  if (authorization.some((scope) => scope.tenantId !== first.tenantId
    || scope.hrGroupId !== first.hrGroupId
    || scope.administrationId !== first.administrationId)) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SCOPE_UNAVAILABLE', 404)
  }

  const supabase = await createClient()
  const sourceByEmployee = new Map<string, {
    readonly employee: PayrollTaxEmployeeSource
    readonly incomeRelationships: readonly PayrollTaxIncomeSource[]
    readonly links: readonly PayrollTaxIncomeLinkSource[]
    readonly employments: readonly PayrollTaxEmploymentSource[]
    readonly taxProfiles: readonly EmploymentPayrollTaxSourceProjection['taxProfiles'][number][]
  }>()
  const uniqueEmployeeIds = [...new Set(inputs.map((input) => input.employeeId))]
  const employeeGroups = Array.from({ length: Math.ceil(uniqueEmployeeIds.length / 4) }, (_, index) =>
    uniqueEmployeeIds.slice(index * 4, index * 4 + 4),
  )
  const queryLimits = { incomeRelationships: 100, links: 100, employments: 100, taxProfiles: 200 } as const
  const sourceGroups = await loadQueriesInBatches(employeeGroups.map((employeeIds) => async () => {
    const [employeesResult, incomeResult, linksResult, employmentsResult, profilesResult] = await loadQueriesInBatches([
      () => supabase.from('employees').select('id,birth_date,updated_at')
        .eq('tenant_id', first.tenantId).eq('hr_group_id', first.hrGroupId)
        .in('id', employeeIds).is('deleted_at', null).range(0, employeeIds.length),
      () => supabase.from('income_relationships')
        .select('id,employee_id,ikv_number,reporting_status,relationship_type,starts_on,ends_on,updated_at')
        .eq('tenant_id', first.tenantId).eq('administration_id', first.administrationId)
        .in('employee_id', employeeIds).is('deleted_at', null).lte('starts_on', payrollPeriodEnd(period))
        .or(`ends_on.is.null,ends_on.gte.${payrollPeriodStart(period)}`)
        .range(0, queryLimits.incomeRelationships * employeeIds.length),
      () => supabase.from('employment_income_relationships')
        .select('id,employee_id,employment_id,income_relationship_id,valid_from,valid_until,updated_at')
        .eq('tenant_id', first.tenantId).eq('administration_id', first.administrationId)
        .in('employee_id', employeeIds).lte('valid_from', payrollPeriodEnd(period))
        .or(`valid_until.is.null,valid_until.gte.${payrollPeriodStart(period)}`)
        .range(0, queryLimits.links * employeeIds.length),
      () => supabase.from('employments').select('id,employee_id,starts_on,ends_on,record_status,deleted_at')
        .eq('tenant_id', first.tenantId).eq('hr_group_id', first.hrGroupId)
        .eq('administration_id', first.administrationId).in('employee_id', employeeIds)
        .eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', payrollPeriodEnd(period))
        .or(`ends_on.is.null,ends_on.gte.${payrollPeriodStart(period)}`)
        .range(0, queryLimits.employments * employeeIds.length),
      () => supabase.from('employment_payroll_tax_profiles').select('*')
        .eq('tenant_id', first.tenantId).eq('hr_group_id', first.hrGroupId)
        .eq('administration_id', first.administrationId).in('employee_id', employeeIds)
        .lte('effective_from', payrollPeriodEnd(period))
        .or(`effective_to.is.null,effective_to.gte.${payrollPeriodStart(period)}`)
        .order('effective_from').order('version_number')
        .range(0, queryLimits.taxProfiles * employeeIds.length),
    ], 4)
    return { employeeIds, employeesResult, incomeResult, linksResult, employmentsResult, profilesResult }
  }), 3)
  for (const { employeeIds, employeesResult, incomeResult, linksResult, employmentsResult, profilesResult } of sourceGroups) {
    const failedRead = [
      { sourceCategory: 'employees', error: employeesResult.error },
      { sourceCategory: 'income-relationships', error: incomeResult.error },
      { sourceCategory: 'employment-income-relationships', error: linksResult.error },
      { sourceCategory: 'employments', error: employmentsResult.error },
      { sourceCategory: 'employment-payroll-tax-profiles', error: profilesResult.error },
    ].find((result) => result.error)
    if (failedRead?.error) {
      const code = failedRead.error.code
      const databaseCode = typeof code === 'string' && /^(?:PGRST\d{3}|[0-9A-Z]{5})$/.test(code) ? code : undefined
      throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SOURCE_UNAVAILABLE', 503, failedRead.sourceCategory, databaseCode)
    }

    const employees = employeesResult.data ?? []
    const incomeRows = incomeResult.data ?? []
    const linkRows = linksResult.data ?? []
    const employmentRows = employmentsResult.data ?? []
    const profileRows = profilesResult.data ?? []
    const overReadLimit = employees.length > employeeIds.length
      || incomeRows.length > queryLimits.incomeRelationships * employeeIds.length
      || linkRows.length > queryLimits.links * employeeIds.length
      || employmentRows.length > queryLimits.employments * employeeIds.length
      || profileRows.length > queryLimits.taxProfiles * employeeIds.length
      || employeeIds.some((employeeId) => incomeRows.filter((row) => row.employee_id === employeeId).length > queryLimits.incomeRelationships
        || linkRows.filter((row) => row.employee_id === employeeId).length > queryLimits.links
        || employmentRows.filter((row) => row.employee_id === employeeId).length > queryLimits.employments
        || profileRows.filter((row) => row.employee_id === employeeId).length > queryLimits.taxProfiles)
    if (overReadLimit) {
      throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_BATCH_LIMIT_REACHED', 503)
    }

    for (const employeeId of employeeIds) {
      const employee = employees.find((row) => row.id === employeeId)
      if (!employee) throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_EMPLOYEE_NOT_FOUND', 404)
      sourceByEmployee.set(employeeId, {
        employee,
        incomeRelationships: incomeRows.filter((row) => row.employee_id === employeeId),
        links: linkRows.filter((row) => row.employee_id === employeeId),
        employments: employmentRows.filter((row) => row.employee_id === employeeId),
        taxProfiles: profileRows.filter((row) => row.employee_id === employeeId),
      })
    }
  }

  return inputs.map((input) => {
    const source = sourceByEmployee.get(input.employeeId)
    if (!source) throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_EMPLOYEE_NOT_FOUND', 404)
    return projectEmploymentPayrollTaxSource({ employmentId: input.employmentId, period, ...source })
  })
}

/** Loads a fiscal dossier only for the active administration and HR/payroll administrators. */
export async function getEmploymentPayrollTaxDossier(
  employeeId: string,
  employmentId: string,
): Promise<EmploymentPayrollTaxDossier> {
  const salaryContext = await requirePermission('salary:read', employeeId)
  const identityContext = await requirePermission('employee:read', employeeId)
  if (!salaryContext.administrationId || !salaryContext.hrGroupId
    || identityContext.tenantId !== salaryContext.tenantId
    || identityContext.hrGroupId !== salaryContext.hrGroupId
    || identityContext.administrationId !== salaryContext.administrationId
    || !isHrPayrollAdmin(salaryContext)) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_FORBIDDEN', 403)
  }

  const supabase = await createClient()
  const [employeeResult, employmentResult, administrationResult, incomeResult, linkResult, scheduleResult, profileResult, auditResult, taxNumberResult] = await Promise.all([
    supabase.from('employees').select('id, employee_number, first_name, birth_name_prefix, birth_name')
      .eq('id', employeeId).eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', salaryContext.hrGroupId)
      .is('deleted_at', null).maybeSingle(),
    supabase.from('employments').select('id, employment_number, starts_on, ends_on, record_status, employment_type, contract_type')
      .eq('id', employmentId).eq('employee_id', employeeId).eq('tenant_id', salaryContext.tenantId)
      .eq('hr_group_id', salaryContext.hrGroupId).eq('administration_id', salaryContext.administrationId)
      .is('deleted_at', null).maybeSingle(),
    supabase.from('administrations').select('id, name')
      .eq('id', salaryContext.administrationId).eq('tenant_id', salaryContext.tenantId)
      .eq('hr_group_id', salaryContext.hrGroupId).maybeSingle(),
    supabase.from('income_relationships')
      .select('id, ikv_number, relationship_type, reporting_status, starts_on, ends_on, deleted_at')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', salaryContext.administrationId)
      .eq('employee_id', employeeId).is('deleted_at', null).order('starts_on').limit(200),
    supabase.from('employment_income_relationships')
      .select('id, income_relationship_id, valid_from, valid_until')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', salaryContext.administrationId)
      .eq('employee_id', employeeId).eq('employment_id', employmentId).order('valid_from').limit(200),
    supabase.from('employment_schedules').select('valid_from, valid_until, is_on_call, on_call_obligation, work_scope, average_hours_per_week')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', salaryContext.administrationId)
      .eq('employee_id', employeeId).eq('employment_id', employmentId)
      .order('valid_from').limit(500),
    supabase.from('employment_payroll_tax_profiles').select('*')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', salaryContext.hrGroupId)
      .eq('administration_id', salaryContext.administrationId).eq('employee_id', employeeId)
      .eq('employment_id', employmentId).order('version_number', { ascending: false }).limit(500),
    supabase.from('employment_payroll_tax_profile_audit')
      .select('id, tax_profile_id, action, audit_payload, recorded_at')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', salaryContext.hrGroupId)
      .eq('administration_id', salaryContext.administrationId).eq('employee_id', employeeId)
      .eq('employment_id', employmentId).order('recorded_at', { ascending: false }).limit(500),
    supabase.from('administration_payroll_tax_numbers').select('payroll_tax_number, is_primary, valid_from, valid_until')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', salaryContext.hrGroupId)
      .eq('administration_id', salaryContext.administrationId).order('valid_from', { ascending: false }).limit(200),
  ])

  const results = [employeeResult, employmentResult, administrationResult, incomeResult, linkResult, scheduleResult, profileResult, auditResult, taxNumberResult]
  if (results.some((result) => result.error)) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SOURCE_UNAVAILABLE', 503)
  }
  if (!employeeResult.data || !employmentResult.data || !administrationResult.data) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_EMPLOYMENT_NOT_FOUND', 404)
  }

  const incomeById = new Map((incomeResult.data ?? []).map((income) => [income.id, income]))
  const incomeRelationships = (linkResult.data ?? []).flatMap((link) => {
    const income = incomeById.get(link.income_relationship_id)
    if (!income) return []
    return [{
      linkId: link.id,
      incomeRelationshipId: income.id,
      ikvNumber: income.ikv_number,
      relationshipType: income.relationship_type,
      reportingStatus: income.reporting_status,
      startsOn: income.starts_on,
      endsOn: income.ends_on,
      validFrom: link.valid_from,
      validUntil: link.valid_until,
    }]
  })
  const taxProfiles = (profileResult.data ?? []) as EmploymentPayrollTaxDossier['taxProfiles']
  const profilesById = new Map(taxProfiles.map((profile) => [profile.id, profile]))
  const auditHistory = (auditResult.data ?? []).map((audit) => {
    const payload = audit.audit_payload
    const sourceReference = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      && typeof payload.sourceReference === 'string'
      ? payload.sourceReference
      : profilesById.get(audit.tax_profile_id)?.source_reference ?? null
    return {
      id: audit.id,
      taxProfileId: audit.tax_profile_id,
      action: audit.action,
      recordedAt: audit.recorded_at,
      sourceReference,
    }
  })
  const today = new Date().toISOString().slice(0, 10)
  const ageProjection = await getEmploymentPayrollTaxSourceProjection(employeeId, employmentId, {
    year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)),
  })

  return {
    employee: {
      id: employeeResult.data.id,
      employeeNumber: employeeResult.data.employee_number,
      displayName: [employeeResult.data.first_name, employeeResult.data.birth_name_prefix, employeeResult.data.birth_name]
        .filter((part): part is string => Boolean(part?.trim())).join(' '),
    },
    employment: {
      id: employmentResult.data.id,
      number: employmentResult.data.employment_number,
      startsOn: employmentResult.data.starts_on,
      endsOn: employmentResult.data.ends_on,
      recordStatus: employmentResult.data.record_status,
      employmentType: employmentResult.data.employment_type,
      contractType: employmentResult.data.contract_type,
    },
    administration: administrationResult.data,
    incomeRelationships,
    payrollTaxNumbers: (taxNumberResult.data ?? []).map((row) => ({
      payrollTaxNumber: row.payroll_tax_number,
      isPrimary: row.is_primary,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
    })),
    schedules: (scheduleResult.data ?? []).map((schedule) => ({
      startsOn: schedule.valid_from,
      endsOn: schedule.valid_until,
      isOnCall: schedule.is_on_call,
      onCallObligation: schedule.on_call_obligation,
      workScope: schedule.work_scope,
      averageHoursPerWeek: Number(schedule.average_hours_per_week),
    })),
    taxProfiles,
    auditHistory,
    ageCategory: ageProjection.ageCategory,
  }
}

/** Lists fiscal-record completeness for the single active administration context. */
export async function getPayrollFiscalAdministrationSettings(): Promise<PayrollFiscalAdministrationSettings> {
  const context = await requirePermission('salary:read')
  if (!context.administrationId || !context.hrGroupId || !isHrPayrollAdmin(context)) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_FORBIDDEN', 403)
  }
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [administrationResult, employmentResult, taxNumberResult, boundIncomeRelationshipsResult] = await Promise.all([
    supabase.from('administrations').select('id, name')
      .eq('id', context.administrationId).eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).maybeSingle(),
    supabase.from('employments').select('id, employee_id, employment_number, starts_on, ends_on')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .eq('record_status', 'CONFIRMED').is('deleted_at', null).order('starts_on', { ascending: false }).limit(2000),
    supabase.from('administration_payroll_tax_numbers').select('id, payroll_tax_number, is_primary, valid_from, valid_until')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .order('valid_from', { ascending: false }).limit(200),
    supabase.from('income_relationships').select('id, employee_id, ikv_number, payroll_tax_binding_id, reporting_status')
      .eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId)
      .is('deleted_at', null).not('payroll_tax_binding_id', 'is', null).limit(5000),
  ])
  if (administrationResult.error || employmentResult.error || taxNumberResult.error || boundIncomeRelationshipsResult.error) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SOURCE_UNAVAILABLE', 503)
  }
  if (!administrationResult.data) throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SCOPE_UNAVAILABLE', 404)

  const employments = employmentResult.data ?? []
  const boundIncomeRelationships = boundIncomeRelationshipsResult.data ?? []
  const employmentIds = employments.map((employment) => employment.id)
  const employeeIds = [...new Set([
    ...employments.map((employment) => employment.employee_id),
    ...boundIncomeRelationships.map((relationship) => relationship.employee_id),
  ])]
  if (employmentIds.length === 0) {
    return {
      administration: administrationResult.data,
      canManagePayrollTaxNumbers: context.permissions.includes('salary:write') && isHrPayrollAdmin(context),
      payrollTaxNumbers: (taxNumberResult.data ?? []).map((row) => ({
        id: row.id,
        payrollTaxNumber: row.payroll_tax_number,
        payrollTaxSubnumber: row.payroll_tax_number.slice(-3),
        isPrimary: row.is_primary,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        linkedIncomeRelationships: boundIncomeRelationships.filter((relationship) => relationship.payroll_tax_binding_id === row.id).map((relationship) => ({
          employeeId: relationship.employee_id,
          employeeName: '',
          employeeNumber: '',
          ikvNumber: relationship.ikv_number,
          reportingStatus: relationship.reporting_status,
        })),
      })),
      rows: [],
    }
  }

  const [employeeResult, linksResult, profilesResult] = await Promise.all([
    supabase.from('employees').select('id, employee_number, first_name, birth_name_prefix, birth_name')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).is('deleted_at', null)
      .in('id', employeeIds).limit(2000),
    supabase.from('employment_income_relationships').select('employment_id, income_relationship_id, valid_from, valid_until')
      .eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId)
      .in('employment_id', employmentIds).limit(5000),
    supabase.from('employment_payroll_tax_profiles')
      .select('id, employee_id, employment_id, income_relationship_id, effective_from, effective_to, version_number')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId)
      .eq('administration_id', context.administrationId).order('effective_from', { ascending: false }).limit(10000),
  ])
  if (employeeResult.error || linksResult.error || profilesResult.error) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SOURCE_UNAVAILABLE', 503)
  }

  const incomeRelationshipIds = [...new Set((linksResult.data ?? []).map((link) => link.income_relationship_id))]
  const incomeResult = incomeRelationshipIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('income_relationships')
      .select('id, employee_id, ikv_number, payroll_tax_binding_id, relationship_type, reporting_status, starts_on, ends_on, deleted_at')
      .eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId)
      .is('deleted_at', null).in('id', incomeRelationshipIds).limit(5000)
  if (incomeResult.error) throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SOURCE_UNAVAILABLE', 503)

  const employeeById = new Map((employeeResult.data ?? []).map((employee) => [employee.id, employee]))
  const incomeById = new Map((incomeResult.data ?? []).map((income) => [income.id, income]))
  const rows = employments.map((employment) => {
    const employee = employeeById.get(employment.employee_id)
    const employmentActive = employment.starts_on <= today && (employment.ends_on === null || employment.ends_on >= today)
    const activeLinks = (linksResult.data ?? []).filter((link) => link.employment_id === employment.id
      && link.valid_from <= today && (link.valid_until === null || link.valid_until >= today))
      .flatMap((link) => {
        const income = incomeById.get(link.income_relationship_id)
        if (!income || income.relationship_type !== 'EMPLOYMENT' || income.reporting_status === 'DRAFT'
          || income.starts_on > today || (income.ends_on !== null && income.ends_on < today)) return []
        return [income.id]
      })
    const currentProfileCandidates = employmentActive && activeLinks.length === 1
      ? (profilesResult.data ?? []).filter((profile) => profile.employment_id === employment.id
        && profile.income_relationship_id === activeLinks[0]
        && profile.effective_from <= today)
        .sort((left, right) => right.effective_from.localeCompare(left.effective_from)
          || right.version_number - left.version_number)
      : []
    const latestProfileStart = currentProfileCandidates[0]?.effective_from
    const currentProfiles = latestProfileStart
      ? currentProfileCandidates.filter((profile) => profile.effective_from === latestProfileStart
        && profile.version_number === currentProfileCandidates[0]?.version_number)
      : []
    const fiscalProfilePresent = currentProfiles.length === 1
      && (currentProfiles[0]?.effective_to === null || (currentProfiles[0]?.effective_to ?? '') >= today)
    return {
      employeeId: employment.employee_id,
      employeeNumber: employee?.employee_number ?? '',
      employeeName: employee
        ? [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter((part): part is string => Boolean(part?.trim())).join(' ')
        : '',
      employmentId: employment.id,
      employmentNumber: employment.employment_number,
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      active: employmentActive,
      incomeRelationshipCount: activeLinks.length,
      fiscalProfilePresent,
    }
  })

  return {
    administration: administrationResult.data,
    canManagePayrollTaxNumbers: context.permissions.includes('salary:write') && isHrPayrollAdmin(context),
    payrollTaxNumbers: (taxNumberResult.data ?? []).map((row) => ({
      id: row.id,
      payrollTaxNumber: row.payroll_tax_number,
      payrollTaxSubnumber: row.payroll_tax_number.slice(-3),
      isPrimary: row.is_primary,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      linkedIncomeRelationships: boundIncomeRelationships.filter((relationship) => relationship.payroll_tax_binding_id === row.id).map((relationship) => {
        const employee = employeeById.get(relationship.employee_id)
        return {
          employeeId: relationship.employee_id,
          employeeName: employee
            ? [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter((part): part is string => Boolean(part?.trim())).join(' ')
            : '',
          employeeNumber: employee?.employee_number ?? '',
          ikvNumber: relationship.ikv_number,
          reportingStatus: relationship.reporting_status,
        }
      }),
    })),
    rows,
  }
}

export async function confirmEmploymentPayrollTaxProfile(input: ConfirmEmploymentPayrollTaxProfileInput) {
  const context = await requirePermission('salary:write', input.employeeId)
  if (!context.administrationId || !context.hrGroupId || !isHrPayrollAdmin(context)) {
    throw new AuthorizationError('Alleen een HR Admin kan deze fiscale verklaring vastleggen.')
  }
  if (!isIsoDate(input.effectiveFrom)
    || (input.effectiveTo !== undefined && input.effectiveTo !== null && !isIsoDate(input.effectiveTo))
    || (input.effectiveTo !== undefined && input.effectiveTo !== null && input.effectiveTo < input.effectiveFrom)
    || typeof input.payrollTaxCreditApplies !== 'boolean'
    || input.sourceClassification !== 'HR_ADMIN_CONFIRMED'
    || !input.sourceReference.trim()
    || input.sourceReference.trim().length > 160
    || /[\x00-\x1f\x7f]/.test(input.sourceReference)
    || containsSensitiveSourceReference(input.sourceReference)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_INPUT_INVALID', 400)
  }

  const supabase = await createClient()
  const rpcInput = {
    employee_id: input.employeeId,
    employment_id: input.employmentId,
    income_relationship_id: input.incomeRelationshipId,
    effective_from: input.effectiveFrom,
    effective_to: input.effectiveTo ?? null,
    payroll_tax_credit_applies: input.payrollTaxCreditApplies,
    source_classification: input.sourceClassification,
    source_reference: input.sourceReference.trim(),
    idempotency_key: input.idempotencyKey,
  } satisfies Record<string, string | boolean | null>
  const { data, error } = await supabase.rpc('confirm_employment_payroll_tax_profile_v2', {
    p_input: rpcInput as Json,
  })
  if (error) {
    const allowedCodes = new Set([
      'PAYROLL_TAX_PROFILE_EMPLOYMENT_NOT_FOUND', 'PAYROLL_TAX_PROFILE_FORBIDDEN',
      'PAYROLL_TAX_PROFILE_EMPLOYMENT_PERIOD_INVALID', 'PAYROLL_TAX_PROFILE_IKV_INVALID',
      'PAYROLL_TAX_PROFILE_IKV_NOT_READY', 'PAYROLL_TAX_PROFILE_IKV_LINK_INVALID',
      'PAYROLL_TAX_PROFILE_CREDIT_ALREADY_APPLIES', 'PAYROLL_TAX_PROFILE_IDEMPOTENCY_CONFLICT',
      'PAYROLL_TAX_PROFILE_BACKDATED_CHANGE_UNSUPPORTED', 'PAYROLL_TAX_PROFILE_INPUT_INVALID',
    ])
    const errorCode = typeof error.message === 'string'
      ? [...allowedCodes].find((code) => error.message.includes(code))
      : undefined
    throw new EmploymentPayrollTaxProfileError(errorCode ?? 'PAYROLL_TAX_PROFILE_CONFIRMATION_FAILED',
      errorCode?.includes('FORBIDDEN') ? 403 : 409)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_CONFIRMATION_FAILED', 503)
  }
  const result = data as { readonly profile_id?: unknown; readonly version_number?: unknown; readonly reused?: unknown }
  if (typeof result.profile_id !== 'string' || typeof result.version_number !== 'number'
    || typeof result.reused !== 'boolean') {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_CONFIRMATION_FAILED', 503)
  }
  return { profileId: result.profile_id, version: result.version_number, reused: result.reused }
}
