import 'server-only'

import type { Database } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, type AuthContext } from '@/lib/auth/permissions'
import { isValidIsoDate, isValidLoonaangifteLhNr, type PayrollImportSourceType } from './model'

type SupabaseServerClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
type PayrollTaxNumberRow = Database['public']['Tables']['administration_payroll_tax_numbers']['Row']

export type PayrollImportReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_REQUIRED'

export type PayrollImportReadinessCheckKey =
  | 'ACTIVE_HR_GROUP'
  | 'ACTIVE_ADMINISTRATION'
  | 'IMPORT_PERMISSION'
  | 'PAYROLL_TAX_NUMBER'
  | 'SOURCE_SUPPORT'
  | 'SOURCE_LHNR_PERIOD'

export type PayrollImportReadinessCode =
  | 'ACTIVE_HR_GROUP_REQUIRED'
  | 'ACTIVE_ADMINISTRATION_REQUIRED'
  | 'IMPORT_PERMISSION_REQUIRED'
  | 'READINESS_DATE_INVALID'
  | 'PAYROLL_TAX_NUMBER_BINDING_REQUIRED'
  | 'PAYROLL_TAX_NUMBER_BINDING_INVALID'
  | 'PAYROLL_TAX_NUMBER_BINDING_AMBIGUOUS'
  | 'PAYROLL_TAX_NUMBER_INVALID'
  | 'SOURCE_SUPPORT_REQUIRED'
  | 'SOURCE_GAP'
  | 'SOURCE_REJECTED'
  | 'IMPORT_TAX_YEAR_SELECTION_MISMATCH'
  | 'SOURCE_TYPE_UNSUPPORTED'
  | 'SOURCE_NAMESPACE_REQUIRED'
  | 'SOURCE_TAX_YEAR_REQUIRED'
  | 'SOURCE_TAX_YEAR_INVALID'
  | 'IMPORT_PERIOD_REQUIRED'
  | 'IMPORT_PERIOD_INVALID'
  | 'IMPORT_PERIOD_YEAR_MISMATCH'
  | 'LHNR_INVALID'
  | 'LHNR_BINDING_REQUIRED'
  | 'LHNR_BINDING_INVALID'
  | 'LHNR_BINDING_AMBIGUOUS'
  | 'LHNR_PERIOD_NOT_COVERED'
  | 'LHNR_SCOPE_MISMATCH'
  | 'LHNR_PRIMARY_BINDING_REQUIRED'
  | 'SOURCE_FORMAL_VALIDATION_PENDING'

export interface PayrollTaxNumberBinding {
  readonly payrollTaxNumber: string
  readonly isPrimary: boolean
  readonly validFrom: string
  readonly validUntil: string | null
}
export interface PayrollImportReadinessCheck {
  readonly key: PayrollImportReadinessCheckKey
  readonly status: PayrollImportReadinessStatus
  readonly code?: PayrollImportReadinessCode
}

export interface HistoricalLhNrCheckInput {
  readonly payrollTaxNumber: string | null | undefined
  readonly periodStart: string | null | undefined
  readonly periodEnd: string | null | undefined
  readonly taxYear?: number | null
  readonly bindings: readonly PayrollTaxNumberBinding[]
}

export interface PayrollImportSourceReadinessInput {
  readonly sourceType: PayrollImportSourceType
  readonly parseStatus?: 'SUPPORTED_READ_ONLY' | 'SOURCE_GAP' | 'REJECTED'
  readonly supported?: boolean
  readonly namespace?: string | null
  readonly namespaceUri?: string | null
  readonly taxYear: number | null | undefined
  readonly requestedTaxYear?: number
  readonly payrollTaxNumber: string | null | undefined
  readonly periodStart: string | null | undefined
  readonly periodEnd: string | null | undefined
  /** False betekent dat de bron is geparsed maar nog geen formele XSD-validatie mag claimen. */
  readonly formallyValidated?: boolean
}

export interface PayrollImportReadinessInput {
  readonly tenantId: string
  readonly hrGroupId: string | null
  readonly administrationId: string | null
  readonly hasActiveHrGroup: boolean
  readonly hasActiveAdministration: boolean
  readonly hasImportPermission: boolean
  readonly asOf: string
  readonly bindings: readonly PayrollTaxNumberBinding[]
  readonly source?: PayrollImportSourceReadinessInput
}

export interface PayrollImportReadiness {
  readonly status: PayrollImportReadinessStatus
  readonly isReady: boolean
  readonly context: {
    readonly tenantId: string
    readonly hrGroupId: string | null
    readonly administrationId: string | null
  }
  readonly payrollTaxNumber: string | null
  readonly checks: readonly PayrollImportReadinessCheck[]
}

export interface PayrollImportReadinessDependencies {
  readonly auth: Pick<AuthContext, 'tenantId' | 'hrGroupId' | 'administrationId' | 'permissions'>
  readonly supabase: SupabaseServerClient
}

export class PayrollImportReadinessError extends Error {
  constructor(
    readonly code: 'PAYROLL_IMPORT_READINESS_READ_FAILED' | 'CONVERGENCE_REQUIRED',
    readonly status: 409 | 500,
  ) {
    super(code)
    this.name = 'PayrollImportReadinessError'
  }
}

function statusFromChecks(checks: readonly PayrollImportReadinessCheck[]): PayrollImportReadinessStatus {
  if (checks.some((check) => check.status === 'BLOCKED')) return 'BLOCKED'
  if (checks.some((check) => check.status === 'WARNING')) return 'WARNING'
  if (checks.some((check) => check.status === 'READY')) return 'READY'
  return 'NOT_REQUIRED'
}

function check(
  key: PayrollImportReadinessCheckKey,
  status: PayrollImportReadinessStatus,
  code?: PayrollImportReadinessCode,
): PayrollImportReadinessCheck {
  return code ? { key, status, code } : { key, status }
}

function isValidBinding(binding: PayrollTaxNumberBinding): boolean {
  if (!isValidLoonaangifteLhNr(binding.payrollTaxNumber)) return false
  if (!isValidIsoDate(binding.validFrom)) return false
  if (binding.validUntil !== null && (!isValidIsoDate(binding.validUntil) || binding.validUntil < binding.validFrom)) return false
  return true
}

function coversPeriod(binding: PayrollTaxNumberBinding, periodStart: string, periodEnd: string): boolean {
  return binding.validFrom <= periodStart
    && (binding.validUntil === null || binding.validUntil >= periodEnd)
}

function isValidTaxYear(taxYear: number | null | undefined): taxYear is number {
  return typeof taxYear === 'number' && Number.isInteger(taxYear) && taxYear >= 1900 && taxYear <= 9999
}

/**
 * Controleert een geïmporteerd LhNr tegen de bronperiode, niet tegen vandaag.
 * Het bindingsinterval is aan beide kanten inclusief, conform de bestaande
 * importautorisatiequery en de administratiebindingskolommen.
 */
export function checkHistoricalLhNr(input: HistoricalLhNrCheckInput): PayrollImportReadinessCheck {
  const payrollTaxNumber = input.payrollTaxNumber?.trim() ?? ''
  if (!payrollTaxNumber || !isValidLoonaangifteLhNr(payrollTaxNumber)) {
    return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_INVALID')
  }

  if (!input.periodStart || !input.periodEnd) {
    return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'IMPORT_PERIOD_REQUIRED')
  }
  if (!isValidIsoDate(input.periodStart) || !isValidIsoDate(input.periodEnd) || input.periodStart > input.periodEnd) {
    return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'IMPORT_PERIOD_INVALID')
  }
  if (input.taxYear !== undefined && input.taxYear !== null) {
    if (!isValidTaxYear(input.taxYear)) return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'SOURCE_TAX_YEAR_INVALID')
    const year = String(input.taxYear)
    if (!input.periodStart.startsWith(year) || !input.periodEnd.startsWith(year)) {
      return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'IMPORT_PERIOD_YEAR_MISMATCH')
    }
  }

  if (input.bindings.length === 0) return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_BINDING_REQUIRED')

  const invalidBindingExists = input.bindings.some((binding) => !isValidBinding(binding))
  const validBindings = input.bindings.filter(isValidBinding)
  if (validBindings.length === 0) return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_BINDING_INVALID')

  const coveringPrimaryBindings = validBindings.filter((binding) => binding.isPrimary && coversPeriod(binding, input.periodStart!, input.periodEnd!))
  if (coveringPrimaryBindings.length > 1) return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_BINDING_AMBIGUOUS')
  const matchingBindings = coveringPrimaryBindings.filter((binding) => binding.payrollTaxNumber.trim() === payrollTaxNumber)
  if (matchingBindings.length === 1) return check('SOURCE_LHNR_PERIOD', 'READY')

  const sameNumberBindings = validBindings.filter((binding) => binding.payrollTaxNumber.trim() === payrollTaxNumber)
  if (sameNumberBindings.some((binding) => !binding.isPrimary)) {
    return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_PRIMARY_BINDING_REQUIRED')
  }
  if (sameNumberBindings.length > 0) return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_PERIOD_NOT_COVERED')
  if (coveringPrimaryBindings.length > 0) return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_SCOPE_MISMATCH')
  if (invalidBindingExists) return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_BINDING_INVALID')
  return check('SOURCE_LHNR_PERIOD', 'BLOCKED', 'LHNR_BINDING_REQUIRED')
}

function currentPayrollTaxNumberCheck(
  bindings: readonly PayrollTaxNumberBinding[],
  asOf: string,
): { check: PayrollImportReadinessCheck; payrollTaxNumber: string | null } {
  if (!isValidIsoDate(asOf)) {
    return { check: check('PAYROLL_TAX_NUMBER', 'BLOCKED', 'READINESS_DATE_INVALID'), payrollTaxNumber: null }
  }
  if (bindings.length === 0) {
    return { check: check('PAYROLL_TAX_NUMBER', 'BLOCKED', 'PAYROLL_TAX_NUMBER_BINDING_REQUIRED'), payrollTaxNumber: null }
  }

  const validBindings = bindings.filter(isValidBinding)
  if (validBindings.length === 0) {
    return { check: check('PAYROLL_TAX_NUMBER', 'BLOCKED', 'PAYROLL_TAX_NUMBER_BINDING_INVALID'), payrollTaxNumber: null }
  }
  const currentPrimaryBindings = validBindings.filter((binding) => binding.isPrimary && coversPeriod(binding, asOf, asOf))
  if (currentPrimaryBindings.length > 1) {
    return { check: check('PAYROLL_TAX_NUMBER', 'BLOCKED', 'PAYROLL_TAX_NUMBER_BINDING_AMBIGUOUS'), payrollTaxNumber: null }
  }
  const currentBinding = currentPrimaryBindings[0]
  if (!currentBinding) {
    return { check: check('PAYROLL_TAX_NUMBER', 'BLOCKED', 'PAYROLL_TAX_NUMBER_BINDING_REQUIRED'), payrollTaxNumber: null }
  }
  return { check: check('PAYROLL_TAX_NUMBER', 'READY'), payrollTaxNumber: currentBinding.payrollTaxNumber.trim() }
}

function sourceCheck(
  source: PayrollImportSourceReadinessInput,
  bindings: readonly PayrollTaxNumberBinding[],
): PayrollImportReadinessCheck[] {
  if (source.parseStatus === 'REJECTED') {
    return [check('SOURCE_SUPPORT', 'BLOCKED', 'SOURCE_REJECTED')]
  }
  const supportCheck = source.supported === true
    ? check('SOURCE_SUPPORT', 'READY')
    : check('SOURCE_SUPPORT', 'BLOCKED', source.supported === false ? 'SOURCE_GAP' : 'SOURCE_SUPPORT_REQUIRED')
  if (supportCheck.status === 'BLOCKED') return [supportCheck]

  const namespace = source.namespace ?? source.namespaceUri
  if (source.sourceType === 'LOONAANGIFTE_XML' && !namespace?.trim()) {
    return [supportCheck, check('SOURCE_SUPPORT', 'BLOCKED', 'SOURCE_NAMESPACE_REQUIRED')]
  }
  if (source.taxYear === undefined || source.taxYear === null) {
    return [supportCheck, check('SOURCE_SUPPORT', 'BLOCKED', 'SOURCE_TAX_YEAR_REQUIRED')]
  }
  if (!isValidTaxYear(source.taxYear)) {
    return [supportCheck, check('SOURCE_SUPPORT', 'BLOCKED', 'SOURCE_TAX_YEAR_INVALID')]
  }

  const taxYearSelectionCheck = source.requestedTaxYear !== undefined && source.requestedTaxYear !== source.taxYear
    ? check('SOURCE_SUPPORT', 'BLOCKED', 'IMPORT_TAX_YEAR_SELECTION_MISMATCH')
    : null

  const historicalCheck = checkHistoricalLhNr({
    payrollTaxNumber: source.payrollTaxNumber,
    periodStart: source.periodStart,
    periodEnd: source.periodEnd,
    taxYear: source.taxYear,
    bindings,
  })
  const checks = [
    source.formallyValidated === false
      ? check('SOURCE_SUPPORT', 'WARNING', 'SOURCE_FORMAL_VALIDATION_PENDING')
      : supportCheck,
    ...(taxYearSelectionCheck ? [taxYearSelectionCheck] : []),
    historicalCheck,
  ]
  if (historicalCheck.status === 'BLOCKED') return checks
  return checks
}

export function evaluatePayrollImportReadiness(input: PayrollImportReadinessInput): PayrollImportReadiness {
  const checks: PayrollImportReadinessCheck[] = [
    check(
      'ACTIVE_HR_GROUP',
      input.hasActiveHrGroup ? 'READY' : 'BLOCKED',
      input.hasActiveHrGroup ? undefined : 'ACTIVE_HR_GROUP_REQUIRED',
    ),
    check(
      'ACTIVE_ADMINISTRATION',
      input.hasActiveAdministration ? 'READY' : 'BLOCKED',
      input.hasActiveAdministration ? undefined : 'ACTIVE_ADMINISTRATION_REQUIRED',
    ),
    check(
      'IMPORT_PERMISSION',
      input.hasImportPermission ? 'READY' : 'BLOCKED',
      input.hasImportPermission ? undefined : 'IMPORT_PERMISSION_REQUIRED',
    ),
  ]

  const current = input.source
    ? { check: check('PAYROLL_TAX_NUMBER', 'NOT_REQUIRED'), payrollTaxNumber: null }
    : input.hasActiveAdministration
    ? currentPayrollTaxNumberCheck(input.bindings, input.asOf)
    : { check: check('PAYROLL_TAX_NUMBER', 'NOT_REQUIRED'), payrollTaxNumber: null }
  checks.push(current.check)

  if (input.source) checks.push(...sourceCheck(input.source, input.bindings))
  else checks.push(check('SOURCE_SUPPORT', 'NOT_REQUIRED'))

  const status = statusFromChecks(checks)
  return {
    status,
    isReady: status === 'READY',
    context: {
      tenantId: input.tenantId,
      hrGroupId: input.hrGroupId,
      administrationId: input.administrationId,
    },
    payrollTaxNumber: current.payrollTaxNumber,
    checks,
  }
}

function mapTaxNumberBinding(row: Pick<PayrollTaxNumberRow, 'payroll_tax_number' | 'is_primary' | 'valid_from' | 'valid_until'>): PayrollTaxNumberBinding {
  return {
    payrollTaxNumber: row.payroll_tax_number,
    isPrimary: row.is_primary,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
  }
}

function readinessReadError(error: { message?: string } | null): PayrollImportReadinessError {
  const message = error?.message?.toLowerCase() ?? ''
  if (message.includes('administration_payroll_tax_numbers')) {
    return new PayrollImportReadinessError('CONVERGENCE_REQUIRED', 409)
  }
  return new PayrollImportReadinessError('PAYROLL_IMPORT_READINESS_READ_FAILED', 500)
}

/**
 * Laadt alleen de geauthenticeerde context en de read-only configuratie.
 * Er wordt geen staging, medewerker-, dienstverband-, IKV- of setupmutatie uitgevoerd.
 */
export async function getPayrollImportReadiness(options: {
  source?: PayrollImportSourceReadinessInput
  asOf?: string
  dependencies?: PayrollImportReadinessDependencies
} = {}): Promise<PayrollImportReadiness> {
  const request = options.dependencies ? null : await getRequestAuthorizationContext()
  const auth = options.dependencies?.auth ?? request!.context
  const supabase = options.dependencies?.supabase ?? request!.supabase

  if (!auth.permissions.includes('payroll-import:write')) {
    throw new AuthorizationError('Je hebt geen recht om loonimporten uit te voeren.')
  }

  const hrGroupId = auth.hrGroupId ?? null
  const administrationId = auth.administrationId ?? null
  let hasActiveHrGroup = false
  let hasActiveAdministration = false
  let bindings: PayrollTaxNumberBinding[] = []

  if (hrGroupId) {
    const groupResult = await supabase
      .from('hr_groups')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('id', hrGroupId)
      .eq('is_active', true)
      .maybeSingle()
    if (groupResult.error) throw readinessReadError(groupResult.error)
    hasActiveHrGroup = Boolean(groupResult.data)
  }

  if (hasActiveHrGroup && hrGroupId && administrationId) {
    const administrationResult = await supabase
      .from('administrations')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('id', administrationId)
      .eq('is_active', true)
      .maybeSingle()
    if (administrationResult.error) throw readinessReadError(administrationResult.error)
    hasActiveAdministration = Boolean(administrationResult.data)
  }

  if (hasActiveAdministration && hrGroupId && administrationId) {
    const bindingResult = await supabase
      .from('administration_payroll_tax_numbers')
      .select('payroll_tax_number,is_primary,valid_from,valid_until')
      .eq('tenant_id', auth.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('administration_id', administrationId)
      .order('valid_from', { ascending: false })
      .limit(200)
    if (bindingResult.error) throw readinessReadError(bindingResult.error)
    bindings = (bindingResult.data ?? []).map(mapTaxNumberBinding)
  }

  return evaluatePayrollImportReadiness({
    tenantId: auth.tenantId,
    hrGroupId,
    administrationId,
    hasActiveHrGroup,
    hasActiveAdministration,
    hasImportPermission: true,
    asOf: options.asOf ?? new Date().toISOString().slice(0, 10),
    bindings,
    source: options.source,
  })
}
