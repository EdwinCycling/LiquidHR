import 'server-only'

import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

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
    readonly startsOn: string
    readonly endsOn: string | null
  }[]
  readonly taxProfiles: readonly Pick<TaxProfileRow,
    | 'id' | 'employee_id' | 'employment_id' | 'income_relationship_id' | 'employment_income_relationship_id'
    | 'residence_country_code' | 'wage_tax_table' | 'herleiding_code' | 'time_period' | 'regular_wage_only'
    | 'full_period_only' | 'has_special_situation' | 'payroll_tax_credit_applies' | 'source_classification'
    | 'source_reference' | 'effective_from' | 'effective_to' | 'version_number' | 'supersedes_profile_id'
    | 'confirmed_by_user_id' | 'confirmed_at' | 'created_at'
  >[]
}

export type ConfirmEmploymentPayrollTaxProfileInput = {
  readonly employeeId: string
  readonly employmentId: string
  readonly incomeRelationshipId: string
  readonly effectiveFrom: string
  readonly effectiveTo?: string | null
  readonly payrollTaxCreditApplies: boolean
  readonly sourceReference: string
  readonly idempotencyKey: string
}

export class EmploymentPayrollTaxProfileError extends Error {
  constructor(readonly code: string, readonly status: number) {
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

  const start = payrollPeriodStart(period)
  const end = payrollPeriodEnd(period)
  const supabase = await createClient()
  const [employeeResult, incomeResult, linkResult, employmentResult, profileResult] = await Promise.all([
    supabase.from('employees').select('birth_date, updated_at')
      .eq('id', employeeId).eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', salaryContext.hrGroupId)
      .is('deleted_at', null).maybeSingle(),
    supabase.from('income_relationships')
      .select('id, reporting_status, relationship_type, starts_on, ends_on, updated_at')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', salaryContext.administrationId)
      .eq('employee_id', employeeId).is('deleted_at', null).lte('starts_on', end)
      .or(`ends_on.is.null,ends_on.gte.${start}`).limit(100),
    supabase.from('employment_income_relationships')
      .select('id, employment_id, income_relationship_id, valid_from, valid_until, updated_at')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', salaryContext.administrationId)
      .eq('employee_id', employeeId).lte('valid_from', end)
      .or(`valid_until.is.null,valid_until.gte.${start}`).limit(100),
    supabase.from('employments').select('id, starts_on, ends_on, record_status, deleted_at')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', salaryContext.hrGroupId)
      .eq('administration_id', salaryContext.administrationId).eq('employee_id', employeeId)
      .eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', end)
      .or(`ends_on.is.null,ends_on.gte.${start}`).limit(100),
    supabase.from('employment_payroll_tax_profiles').select('*')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', salaryContext.hrGroupId)
      .eq('administration_id', salaryContext.administrationId).eq('employee_id', employeeId)
      .lte('effective_from', end).or(`effective_to.is.null,effective_to.gte.${start}`)
      .order('effective_from').order('version_number').limit(200),
  ])
  if (employeeResult.error || incomeResult.error || linkResult.error || employmentResult.error || profileResult.error) {
    throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_SOURCE_UNAVAILABLE', 503)
  }
  if (!employeeResult.data) throw new EmploymentPayrollTaxProfileError('PAYROLL_TAX_PROFILE_EMPLOYEE_NOT_FOUND', 404)

  const activeEmployments = (employmentResult.data ?? []).filter((row) =>
    row.starts_on <= end && (row.ends_on === null || row.ends_on >= start),
  )
  const activeEmploymentIds = new Set(activeEmployments.map((row) => row.id))
  const activeLinks = (linkResult.data ?? []).filter((link) =>
    activeEmploymentIds.has(link.employment_id)
    && link.valid_from <= end
    && (link.valid_until === null || link.valid_until >= start),
  )
  const activeIncomeRelationships = (incomeResult.data ?? []).filter((income) =>
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

  const age = employeeResult.data.birth_date
    ? ageOn(employeeResult.data.birth_date, end)
    : null
  const ageCategory = age === null ? null : age < 67 ? 'UNDER_AOW' : 'AT_OR_ABOVE_AOW'

  const taxProfiles = (profileResult.data ?? []).filter((profile) =>
    profile.employment_id === employmentId
    || activeLinkedIds.has(profile.income_relationship_id),
  )
  return {
    ageCategory,
    ageSourceUpdatedAt: employeeResult.data.updated_at,
    activeIncomeRelationshipCount: activeLinkedIds.size,
    incomeRelationshipLinkGap,
    incomeRelationships: activeIncomeRelationships.map((income) => ({
      id: income.id,
      updatedAt: income.updated_at,
      reportingStatus: income.reporting_status,
      startsOn: income.starts_on,
      endsOn: income.ends_on,
    })),
    taxProfiles: taxProfiles as EmploymentPayrollTaxSourceProjection['taxProfiles'],
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
    || !input.sourceReference.trim()
    || input.sourceReference.trim().length > 160
    || /[\x00-\x1f\x7f]/.test(input.sourceReference)
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
    source_reference: input.sourceReference.trim(),
    idempotency_key: input.idempotencyKey,
  } satisfies Record<string, string | boolean | null>
  const { data, error } = await supabase.rpc('confirm_employment_payroll_tax_profile', {
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
