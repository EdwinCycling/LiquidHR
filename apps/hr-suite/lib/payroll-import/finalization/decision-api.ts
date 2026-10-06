import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'

import {
  getRequestAuthorizationContext,
  requirePermission,
  type AuthContext,
} from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PayrollImportClient } from '../database'
import {
  confirmPayrollImportDecision,
  isPayrollImportDecisionAuthentic,
  isPayrollImportDecisionFresh,
  payrollImportPersonDecisionSchema,
  stableSerialize,
  validatePayrollImportDecision,
  type ConfirmedPayrollImportDecision,
  type PayrollImportDecisionSource,
  type PayrollImportPersonDecision,
} from './decision-contract'
import {
  FinalizationLedgerError,
  invalidateFinalizationPlansAfterDecisionChange,
  persistFinalizationPlan,
  persistConfirmedPayrollImportDecision,
  readFinalizationPlan,
  type FinalizationLedgerAction,
  type PersistedDecision,
} from './ledger-repository'
import type {
  Control02FinalizationClient,
  PayrollImportDecisionRow,
} from './ledger-database'
import { normalizeIdentityPart } from '../model'
import {
  buildPayrollFinalizationPlan,
  type PayrollFinalizationEmployee,
  type PayrollFinalizationEmployment,
  type PayrollFinalizationIncomeRelationship,
  type PayrollFinalizationPlan,
  type PayrollFinalizationPlannerInput,
  type PayrollFinalizationPlannerPersonInput,
} from './planner'
import { summarizePayrollFinalizationResult, type PayrollFinalizationResultSummary } from './result-summary'

const uuidSchema = z.guid()

/**
 * The request body deliberately has no actor, tenant, HR-group,
 * administration, provenance hash or confirmation timestamp. All of those
 * values are read from the authenticated server context and current state.
 */
export const payrollImportDecisionPutSchema = z.object({
  decision: payrollImportPersonDecisionSchema,
  // Required optimistic concurrency marker. Use 0 for the first save.
  expectedDecisionVersion: z.number().int().min(0).max(10_000_000),
}).strict()

export const payrollImportPlanPostSchema = z.object({}).strict()

export type PayrollImportDecisionPutInput = z.infer<typeof payrollImportDecisionPutSchema>

type DecisionApiClient = PayrollImportClient & Control02FinalizationClient
type RequestAuthorizationContext = Awaited<ReturnType<typeof getRequestAuthorizationContext>>

export type PayrollImportDecisionApiDependencies = {
  readonly authorize?: (permission: 'payroll-import:read' | 'payroll-import:write') => Promise<AuthorizedRequest>
  readonly now?: () => string
  readonly scopeInvariantMigrationApplied?: boolean
}

type AuthorizedRequest = {
  readonly context: AuthContext
  readonly supabase: DecisionApiClient
}

type PayrollImportBatch = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string
  source_type: 'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'
  source_hash: string
  tax_year: number
  period_start: string | null
  period_end: string | null
  payroll_tax_number: string | null
  status: string
  source_deleted_at: string | null
}

type PayrollImportPerson = {
  id: string
  tenant_id: string
  hr_group_id: string
  batch_id: string
  source_row_number: number
  external_employee_number: string | null
  bsn_fingerprint: string | null
  initials: string | null
  prefix: string | null
  first_name: string | null
  birth_name: string | null
  birth_date: string | null
  gender: string | null
  nationality: string | null
  address: unknown
  status: string
  match_status: string
  matched_employee_id: string | null
  validation_codes: unknown
  source_metadata: unknown
}

type PayrollImportIncome = {
  id: string
  tenant_id: string
  hr_group_id: string
  batch_id: string
  import_person_id: string
  administration_id: string
  payroll_tax_number: string
  ikv_number: number
  income_code: string | null
  employment_relation_code: string | null
  cao_code: string | null
  flags: unknown
  hours_per_week: number | null
  salary_amount: number | null
  starts_on: string | null
  ends_on: string | null
  status: string
  matched_income_relationship_id: string | null
  source_metadata: unknown
}

type TaxNumberBinding = {
  payroll_tax_number: string
  is_primary: boolean
  valid_from: string
  valid_until: string | null
}

type EmployeeAdministrationAssignment = {
  employee_id: string
  administration_id: string
}

type CoreEmployee = {
  id: string
  tenant_id: string
  hr_group_id: string
  employee_number: string
  initials: string | null
  first_name: string
  birth_name: string
  birth_date: string | null
  gender: string
  nationality: string | null
}

type CoreEmployeeAddress = {
  id: string
  tenant_id: string
  employee_id: string
  address_type: string
  address_line_1: string
  address_line_2: string | null
  street: string | null
  house_number: string | null
  house_number_addition: string | null
  postal_code: string | null
  region: string | null
  city: string
  country_code: string
  valid_from: string
  valid_until: string | null
}


type PublicEmployeeCandidate = {
  id: string
  employeeNumber: string
  displayName: string
  administrationIds: readonly string[]
}

type EmployeeCandidateSource = Pick<PayrollImportPerson, 'match_status' | 'bsn_fingerprint' | 'external_employee_number' | 'birth_name' | 'birth_date' | 'matched_employee_id'>
type EmployeeCandidateRow = Pick<CoreEmployee, 'id' | 'employee_number' | 'first_name' | 'birth_name' | 'birth_date'>

type CoreEmployment = {
  id: string
  employee_id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string
  record_status: string
  starts_on: string
  ends_on: string | null
}

type CoreIncomeRelationship = {
  id: string
  employee_id: string
  tenant_id: string
  administration_id: string
  payroll_tax_subnumber: string
  ikv_number: number
  starts_on: string | null
  ends_on: string | null
}

type EmploymentIncomeLink = {
  income_relationship_id: string
  employment_id: string
  employee_id: string
  valid_from: string
  valid_until: string | null
}

type LoadedDecisionState = {
  readonly batch: PayrollImportBatch
  readonly people: readonly PayrollImportPerson[]
  readonly incomes: readonly PayrollImportIncome[]
  readonly coreEmployeeRows: readonly CoreEmployee[]
  readonly administrationIdsByEmployee: ReadonlyMap<string, readonly string[]>
  readonly bsnEmployeeMatches: BsnEmployeeMatches
  readonly includeEmployeeCandidates: boolean
  readonly plannerInput: PayrollFinalizationPlannerInput
  readonly latestDecisions: ReadonlyMap<string, PersistedDecision>
}

export type PayrollImportDecisionResponse = {
  id: string
  personId: string
  sourceRowNumber: number
  status: 'SAVED' | 'STALE' | 'CONFLICT' | 'BLOCKED'
  blockers: readonly string[]
  decision: PayrollImportPersonDecision
  decisionVersion: number
  decisionHash: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  confirmerUserId: string
  confirmedAt: string
}

export type PayrollImportDecisionSnapshot = {
  batchId: string
  tenantId: string
  hrGroupId: string
  administrationId: string
  sourceType: PayrollImportBatch['source_type']
  taxYear: number
  periodStart: string | null
  periodEnd: string | null
  payrollTaxNumber: string | null
  batchStatus: string
  sourceImmutable: boolean
  schemaVersion: string | null
  officialSchemaValidated: boolean
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  people: readonly PayrollImportDecisionPersonSnapshot[]
  decisions: readonly PayrollImportDecisionResponse[]
}

export type PayrollImportPlanResponse = PayrollFinalizationPlan & {
  /** Server readback is empty while the global XML-finalization gate is closed. */
  ledgerReadback: readonly FinalizationLedgerAction[]
  /** Summary counts are derived from the server plan and persisted ledger readback. */
  resultSummary: PayrollFinalizationResultSummary
}

export type PayrollImportDecisionPersonSnapshot = {
  personId: string
  sourceRowNumber: number
  externalEmployeeNumber: string | null
  initials: string | null
  prefix: string | null
  firstName: string | null
  birthName: string | null
  birthDate: string | null
  gender: string | null
  nationality: string | null
  address: Record<string, string>
  status: 'GREEN' | 'WARNING' | 'BLOCKING'
  sourceRef: string
  matchStatus: PayrollImportDecisionSource['matchStatus']
  proposedEmployeeId: string | null
  employeeCandidate: {
    id: string
    administrationIds: readonly string[]
  } | null
  /**
   * Server-derived, HR-group scoped candidates for manual review. The list is
   * bounded and contains no secure identifiers such as a BSN fingerprint.
   */
  employeeCandidates: readonly PublicEmployeeCandidate[]
  sourceFields: readonly string[]
  issues: readonly { code: string; severity: 'WARNING' | 'BLOCKING' }[]
  sourceMetadata: Record<string, string | number | boolean | null>
  incomeRelationships: readonly {
    sourceRef: string
    payrollTaxNumber: string
    ikvNumber: number
    incomeCode: string | null
    employmentRelationCode: string | null
    caoCode: string | null
    flags: Record<string, boolean>
    hoursPerWeek: number | null
    salaryAmount: number | null
    startsOn: string | null
    endsOn: string | null
    sourceMetadata: Record<string, string | number | boolean | null>
    coreIncomeCandidates: readonly {
      id: string
      employeeId: string
      payrollTaxNumber: string
      ikvNumber: number
      startsOn: string | null
      endsOn: string | null
      employmentId: string | null
    }[]
    employmentCandidates: readonly {
      id: string
      employeeId: string
      administrationId: string
      status: PayrollFinalizationEmployment['status']
      validFrom: string
      validUntilExclusive: string | null
    }[]
  }[]
}

export class PayrollImportDecisionApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 422 | 500 = 500,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(code)
    this.name = 'PayrollImportDecisionApiError'
  }
}

function asDecisionApiClient(value: unknown): DecisionApiClient {
  return value as DecisionApiClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

type PublicMetadataValue = string | number | boolean | null

function publicMetadata(value: unknown): Record<string, PublicMetadataValue> {
  const allowedKeys = new Set(['sourceSystem', 'sourcePath', 'fieldGroup', 'period', 'sourceRow'])
  return Object.fromEntries(Object.entries(jsonRecord(value)).flatMap(([key, item]) => {
    if (!allowedKeys.has(key)) return []
    if (item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      return [[key, item]]
    }
    return []
  }))
}

function publicAddress(value: unknown): Record<string, string> {
  const allowedKeys = new Set(['street', 'houseNumber', 'houseNumberAddition', 'postalCode', 'city', 'countryCode'])
  return Object.fromEntries(Object.entries(jsonRecord(value)).flatMap(([key, item]) => {
    return allowedKeys.has(key) && typeof item === 'string' ? [[key, item]] : []
  }))
}

function publicFlags(value: unknown): Record<string, boolean> {
  return Object.fromEntries(Object.entries(jsonRecord(value)).flatMap(([key, item]) => {
    return typeof item === 'boolean' ? [[key, item]] : []
  }))
}

function validationCodes(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : []
}

function publicRowStatus(value: string): 'GREEN' | 'WARNING' | 'BLOCKING' {
  return value === 'GREEN' || value === 'WARNING' || value === 'BLOCKING' ? value : 'BLOCKING'
}

function hash(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex')
}

const PAGE_SIZE = 1_000
const MAX_PAGES = 100
const MAX_EMPLOYEE_CANDIDATES = 25
const MAX_BSN_MATCHES = 5
const MAX_BSN_FINGERPRINT_LOOKUPS = 500
const MAX_PAYROLL_IMPORT_RESPONSE_BYTES = 2 * 1024 * 1024

export function assertBoundedPayrollImportResponse<T>(response: T): T {
  const serialized = JSON.stringify(response)
  const byteLength = serialized === undefined ? 0 : new TextEncoder().encode(serialized).byteLength
  if (byteLength > MAX_PAYROLL_IMPORT_RESPONSE_BYTES) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_RESPONSE_TOO_LARGE', 413)
  }
  return response
}

export function employeeAddressIdsForScope(
  employeeIds: readonly string[],
  assignments: readonly { employee_id: string; administration_id: string }[],
  administrationId: string,
): readonly string[] {
  const inGroup = new Set(employeeIds)
  return [...new Set(assignments
    .filter((assignment) => assignment.administration_id === administrationId && inGroup.has(assignment.employee_id))
    .map((assignment) => assignment.employee_id))].sort()
}

export function resolveScopedEmploymentId(
  income: { id: string; employeeId: string; startsOn: string | null; endsOn: string | null },
  links: readonly {
    income_relationship_id: string
    employment_id: string
    employee_id: string
    valid_from: string
    valid_until: string | null
  }[],
  employmentsById: ReadonlyMap<string, {
    id: string
    employee_id: string
    tenant_id: string
    hr_group_id: string
    administration_id: string
  }>,
  scope: { tenantId: string; hrGroupId: string; administrationId: string },
): string | null {
  const employmentIds = new Set(links
    .filter((link) => link.income_relationship_id === income.id && link.employee_id === income.employeeId)
    .filter((link) => link.valid_from <= (income.startsOn ?? link.valid_from))
    .filter((link) => link.valid_until === null || (income.endsOn !== null && link.valid_until >= income.endsOn))
    .filter((link) => {
      const employment = employmentsById.get(link.employment_id)
      return employment !== undefined
        && employment.employee_id === income.employeeId
        && employment.tenant_id === scope.tenantId
        && employment.hr_group_id === scope.hrGroupId
        && employment.administration_id === scope.administrationId
    })
    .map((link) => link.employment_id))
  return employmentIds.size === 1 ? [...employmentIds][0]! : null
}

export function canReadPayrollImportEmployeeCandidates(permissions: readonly string[]): boolean {
  return permissions.includes('payroll-import:write')
}

export function payrollImportBsnMatcherArguments(
  tenantId: string,
  hrGroupId: string,
  administrationId: string,
  fingerprints: readonly string[],
): {
  requested_tenant_id: string
  requested_hr_group_id: string
  requested_administration_id: string
  requested_bsn_fingerprints: string[]
} {
  return {
    requested_tenant_id: tenantId,
    requested_hr_group_id: hrGroupId,
    requested_administration_id: administrationId,
    requested_bsn_fingerprints: [...fingerprints],
  }
}

export function employeeInPayrollImportAdministrationScope(
  employee: Pick<PayrollFinalizationEmployee, 'administrationIds'>,
  administrationId: string,
): boolean {
  return employee.administrationIds.includes(administrationId)
}

export function scopedPayrollImportEmployeeId(
  candidateEmployeeId: string | null | undefined,
  employees: readonly Pick<PayrollFinalizationEmployee, 'id' | 'administrationIds'>[],
  administrationId: string,
): string | null {
  if (!candidateEmployeeId) return null
  const employee = employees.find((candidate) => candidate.id === candidateEmployeeId)
  return employee && employeeInPayrollImportAdministrationScope(employee, administrationId)
    ? employee.id
    : null
}

export function boundedPayrollImportBsnFingerprints(
  people: readonly Pick<PayrollImportPerson, 'match_status' | 'bsn_fingerprint'>[],
): readonly string[] {
  const fingerprints = [...new Set(people
    .filter((person) => person.match_status === 'MANUAL_REVIEW')
    .map((person) => person.bsn_fingerprint?.toLowerCase())
    .filter((value): value is string => Boolean(value)))]
  if (fingerprints.some((value) => !/^[0-9a-f]{64}$/i.test(value))) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_EMPLOYEE_CANDIDATES_INVALID', 409)
  }
  if (fingerprints.length > MAX_BSN_FINGERPRINT_LOOKUPS) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_EMPLOYEE_CANDIDATES_TRUNCATED', 409)
  }
  return fingerprints
}

async function readAllPages<T>(
  readPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>,
  errorCode: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const result = await readPage(from, from + PAGE_SIZE - 1)
    if (result.error) throw new PayrollImportDecisionApiError(errorCode, 500)
    const values = result.data ?? []
    rows.push(...values)
    if (values.length < PAGE_SIZE) return rows
  }
  throw new PayrollImportDecisionApiError(`${errorCode}_TRUNCATED`, 500)
}

type BsnEmployeeMatches = ReadonlyMap<string, readonly string[]>
type BsnEmployeeBatchMatch = {
  requested_bsn_fingerprint: string
  employee_id: string
}

export function groupBoundedPayrollImportBsnMatches(
  fingerprints: readonly string[],
  rows: readonly BsnEmployeeBatchMatch[],
): BsnEmployeeMatches {
  const normalizedFingerprints = [...new Set(fingerprints.map((fingerprint) => fingerprint.toLowerCase()))]
  const requested = new Set(normalizedFingerprints)
  const matches = new Map<string, string[]>(normalizedFingerprints.map((fingerprint) => [fingerprint, []]))
  for (const row of rows) {
    const fingerprint = row.requested_bsn_fingerprint.toLowerCase()
    if (!requested.has(fingerprint) || typeof row.employee_id !== 'string') continue
    const current = matches.get(fingerprint) ?? []
    if (!current.includes(row.employee_id)) current.push(row.employee_id)
    matches.set(fingerprint, current)
  }
  if ([...matches.values()].some((employeeIds) => employeeIds.length >= MAX_BSN_MATCHES)) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_EMPLOYEE_CANDIDATES_TRUNCATED', 409)
  }
  return matches
}

/**
 * The secure identifier table is intentionally only reachable through the
 * existing SECURITY DEFINER batch matcher. Keep the fingerprint server-side
 * and return only Employee ids to the candidate builder. The migration's
 * scalar matcher remains for legacy callers; this path is one bounded RPC for
 * the whole manual-review batch.
 */
async function readBsnEmployeeMatches(
  client: DecisionApiClient,
  context: AuthContext,
  people: readonly PayrollImportPerson[],
): Promise<BsnEmployeeMatches> {
  const fingerprints = boundedPayrollImportBsnFingerprints(people)
  if (fingerprints.length === 0) return new Map()
  const result = await client.rpc('match_payroll_import_employee_bsn_fingerprints', {
    ...payrollImportBsnMatcherArguments(context.tenantId, context.hrGroupId!, context.administrationId!, fingerprints),
  })
  if (result.error) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_CORE_STATE_READ_FAILED', 500)
  }
  return groupBoundedPayrollImportBsnMatches(
    fingerprints,
    (result.data ?? []) as BsnEmployeeBatchMatch[],
  )
}

export function publicEmployeeCandidates(
  person: EmployeeCandidateSource,
  employeeRows: readonly EmployeeCandidateRow[],
  administrationIdsByEmployee: ReadonlyMap<string, readonly string[]>,
  bsnEmployeeMatches: BsnEmployeeMatches,
): readonly PublicEmployeeCandidate[] {
  if (person.match_status !== 'MANUAL_REVIEW') return []

  const ids = new Set<string>()
  const bsnFingerprint = person.bsn_fingerprint
  for (const id of bsnFingerprint ? (bsnEmployeeMatches.get(bsnFingerprint) ?? []) : []) ids.add(id)

  const externalEmployeeNumber = normalizeIdentityPart(person.external_employee_number)
  if (externalEmployeeNumber) {
    for (const employee of employeeRows) {
      if (normalizeIdentityPart(employee.employee_number) === externalEmployeeNumber) ids.add(employee.id)
    }
  }

  const birthName = normalizeIdentityPart(person.birth_name)
  if (birthName && person.birth_date) {
    for (const employee of employeeRows) {
      if (normalizeIdentityPart(employee.birth_name) === birthName && employee.birth_date === person.birth_date) {
        ids.add(employee.id)
      }
    }
  }

  if (person.matched_employee_id) ids.add(person.matched_employee_id)
  const candidates = employeeRows
    .filter((employee) => ids.has(employee.id)
      && (administrationIdsByEmployee.get(employee.id) ?? []).length > 0)
    .sort((left, right) => left.id.localeCompare(right.id))
  if (candidates.length > MAX_EMPLOYEE_CANDIDATES) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_EMPLOYEE_CANDIDATES_TRUNCATED', 409)
  }
  return candidates.map((employee) => ({
    id: employee.id,
    employeeNumber: employee.employee_number,
    displayName: [employee.first_name, employee.birth_name].filter(Boolean).join(' ').trim(),
    administrationIds: [...new Set(administrationIdsByEmployee.get(employee.id) ?? [])].sort(),
  }))
}

function assertUuid(value: string, field: string): void {
  if (!uuidSchema.safeParse(value).success) throw new PayrollImportDecisionApiError(`${field.toUpperCase()}_INVALID`, 400)
}

function assertHash(value: string, field: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new PayrollImportDecisionApiError(`${field.toUpperCase()}_HASH_INVALID`, 409)
}

function normalizeMatchStatus(value: string): PayrollImportDecisionSource['matchStatus'] {
  if (value === 'EXACT' || value === 'PROPOSED' || value === 'MANUAL_REVIEW' || value === 'NEW') return value
  return 'UNMATCHED'
}

function sourceRef(row: PayrollImportPerson, income: PayrollImportIncome, index: number): string {
  return `row-${row.source_row_number}:income-${index}:${income.payroll_tax_number}:${income.ikv_number}:${income.starts_on ?? ''}`
}

function sourceFields(row: PayrollImportPerson): readonly string[] {
  const fields: Array<[string, boolean]> = [
    ['firstName', Boolean(row.first_name)],
    ['birthName', Boolean(row.birth_name)],
    ['birthDate', Boolean(row.birth_date)],
    ['gender', Boolean(row.gender)],
    ['nationality', Boolean(row.nationality)],
    ['address', isRecord(row.address) && Object.keys(row.address).length > 0],
  ]
  return fields.filter(([, present]) => present).map(([field]) => field)
}

function decisionSourceForPerson(
  person: PayrollImportPerson,
  incomes: readonly PayrollImportIncome[],
  inScopeEmployeeIds: ReadonlySet<string>,
): PayrollImportDecisionSource {
  const proposedEmployeeId = person.matched_employee_id
  // A legacy staging row can contain a tenant-only employee reference. Never
  // pass such a reference to the planner as an exact/proposed target.
  if (proposedEmployeeId && !inScopeEmployeeIds.has(proposedEmployeeId)) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_PERSON_SCOPE_INVALID', 409)
  }
  const personIncomes = incomes
    .filter((income) => income.import_person_id === person.id)
    .sort((left, right) => left.id.localeCompare(right.id))
  return {
    personId: person.id,
    matchStatus: normalizeMatchStatus(person.match_status),
    ...(proposedEmployeeId ? { proposedEmployeeId } : {}),
    sourceFields: sourceFields(person),
    conflictingFields: [],
    incomeRelationships: personIncomes.map((income, index) => ({ sourceRef: sourceRef(person, income, index) })),
  }
}

function inclusiveEndToExclusive(value: string | null): string | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function employmentCoversSourcePeriod(
  employment: PayrollFinalizationEmployment,
  startsOn: string | null,
  endsOn: string | null,
): boolean {
  if (!startsOn) return true
  if (employment.validFrom > startsOn) return false
  if (employment.validUntilExclusive && (!endsOn || endsOn >= employment.validUntilExclusive)) return false
  return true
}

function bindingCovers(binding: TaxNumberBinding, startsOn: string | null, endsOn: string | null): boolean {
  if (!startsOn || binding.valid_from > startsOn) return false
  return binding.valid_until === null || (endsOn !== null && binding.valid_until >= endsOn)
}

function fullPayrollTaxNumber(
  subnumber: string,
  startsOn: string | null,
  endsOn: string | null,
  bindings: readonly TaxNumberBinding[],
): string {
  const candidates = bindings
    .filter((binding) => binding.payroll_tax_number.endsWith(subnumber) && bindingCovers(binding, startsOn, endsOn))
    .map((binding) => binding.payroll_tax_number)
  return new Set(candidates).size === 1 ? candidates[0]! : ''
}

function mapDecisionRow(row: PayrollImportDecisionRow): PersistedDecision {
  if (!isRecord(row.decision_payload)) throw new PayrollImportDecisionApiError('PAYROLL_FINALIZATION_DECISION_INVALID', 500)
  const parsed = payrollImportPersonDecisionSchema.safeParse(row.decision_payload)
  if (!parsed.success) throw new PayrollImportDecisionApiError('PAYROLL_FINALIZATION_DECISION_INVALID', 500)
  const decision: ConfirmedPayrollImportDecision = {
    decision: parsed.data,
    decisionVersion: row.decision_version,
    confirmerUserId: row.confirmer_user_id,
    confirmedAt: row.confirmed_at,
    sourceHash: row.source_hash,
    analysisHash: row.analysis_hash,
    coreStateHash: row.core_state_hash,
    decisionHash: row.decision_hash,
  }
  if (!isPayrollImportDecisionAuthentic(decision)) {
    throw new PayrollImportDecisionApiError('PAYROLL_FINALIZATION_DECISION_INVALID', 500)
  }
  return {
    id: row.id,
    scope: {
      tenantId: row.tenant_id,
      hrGroupId: row.hr_group_id,
      batchId: row.batch_id,
      administrationId: row.administration_id,
      importPersonId: row.import_person_id,
    },
    decision: parsed.data,
    decisionVersion: row.decision_version,
    decisionHash: row.decision_hash,
    sourceHash: row.source_hash,
    analysisHash: row.analysis_hash,
    coreStateHash: row.core_state_hash,
    contractVersion: row.contract_version,
    schemaVersion: row.schema_version,
    confirmerUserId: row.confirmer_user_id,
    confirmedAt: row.confirmed_at,
  }
}

function publicDecision(
  personId: string,
  sourceRowNumber: number,
  decision: PersistedDecision,
  status: PayrollImportDecisionResponse['status'] = 'SAVED',
  blockers: readonly string[] = [],
): PayrollImportDecisionResponse {
  return {
    id: decision.id,
    personId,
    sourceRowNumber,
    status,
    blockers,
    decision: decision.decision,
    decisionVersion: decision.decisionVersion,
    decisionHash: decision.decisionHash,
    sourceHash: decision.sourceHash,
    analysisHash: decision.analysisHash,
    coreStateHash: decision.coreStateHash,
    confirmerUserId: decision.confirmerUserId,
    confirmedAt: decision.confirmedAt,
  }
}

export function getPayrollImportDecisionStatus(
  decision: PersistedDecision,
  current: Pick<PayrollImportDecisionResponse, 'sourceHash' | 'analysisHash' | 'coreStateHash'>,
  currentUserId: string,
): Pick<PayrollImportDecisionResponse, 'status' | 'blockers'> {
  const blockers: string[] = []
  if (decision.sourceHash !== current.sourceHash) blockers.push('DECISION_SOURCE_STALE')
  if (decision.analysisHash !== current.analysisHash) blockers.push('DECISION_ANALYSIS_STALE')
  if (decision.coreStateHash !== current.coreStateHash) blockers.push('DECISION_CORE_STATE_STALE')
  if (decision.confirmerUserId !== currentUserId) blockers.push('DECISION_ACTOR_MISMATCH')
  return blockers.length > 0
    ? { status: 'STALE', blockers }
    : { status: 'SAVED', blockers: [] }
}

export function selectedEmployeeIdForDecisionSnapshot(
  decision: PersistedDecision | undefined,
  source: PayrollImportDecisionSource,
  current: Pick<PayrollImportDecisionResponse, 'sourceHash' | 'analysisHash' | 'coreStateHash'>,
  currentUserId: string,
): string | null {
  if (!decision
    || decision.confirmerUserId !== currentUserId
    || !isPayrollImportDecisionAuthentic(decision)
    || !isPayrollImportDecisionFresh(decision, current)) {
    return null
  }
  const validation = validatePayrollImportDecision(decision.decision, source)
  if (!validation.valid || decision.decision.match.action !== 'REUSE_EMPLOYEE') return null
  return decision.decision.match.employeeId ?? null
}

export function isExpectedPayrollImportDecisionVersion(
  latest: Pick<PersistedDecision, 'decisionVersion'> | undefined,
  expectedVersion: number,
): boolean {
  return expectedVersion === (latest?.decisionVersion ?? 0)
}

async function authorizeDefault(permission: 'payroll-import:read' | 'payroll-import:write'): Promise<AuthorizedRequest> {
  const authorizedContext = await requirePermission(permission)
  const requestContext: RequestAuthorizationContext = await getRequestAuthorizationContext()
  const context = requestContext.context
  if (authorizedContext.userId !== context.userId
    || authorizedContext.tenantId !== context.tenantId
    || authorizedContext.hrGroupId !== context.hrGroupId
    || authorizedContext.administrationId !== context.administrationId) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_AUTH_CONTEXT_CHANGED', 409)
  }
  if (!context.hrGroupId || !context.administrationId) {
    throw new PayrollImportDecisionApiError('IMPORT_ADMINISTRATION_CONTEXT_REQUIRED', 409)
  }
  return { context, supabase: asDecisionApiClient(requestContext.supabase) }
}

async function authorize(
  permission: 'payroll-import:read' | 'payroll-import:write',
  dependencies: PayrollImportDecisionApiDependencies,
): Promise<AuthorizedRequest> {
  return dependencies.authorize ? dependencies.authorize(permission) : authorizeDefault(permission)
}

async function readLatestDecisionRows(
  client: DecisionApiClient,
  scope: Pick<PayrollImportBatch, 'tenant_id' | 'hr_group_id' | 'administration_id' | 'id'>,
  importPersonIds: readonly string[],
): Promise<ReadonlyMap<string, PersistedDecision>> {
  if (importPersonIds.length === 0) return new Map()
  const requested = new Set(importPersonIds)
  const rows = await readAllPages<PayrollImportDecisionRow>(
    async (from, to) => {
      const result = await client
        .from('payroll_import_decisions')
        .select('*')
        .eq('tenant_id', scope.tenant_id)
        .eq('hr_group_id', scope.hr_group_id)
        .eq('batch_id', scope.id)
        .eq('administration_id', scope.administration_id)
        .order('decision_version', { ascending: false })
        .order('import_person_id', { ascending: true })
        .range(from, to)
      return { data: result.data as PayrollImportDecisionRow[] | null, error: result.error }
    },
    'PAYROLL_FINALIZATION_DECISION_READ_FAILED',
  )
  const latest = new Map<string, PersistedDecision>()
  for (const row of rows) {
    if (!requested.has(row.import_person_id)) continue
    if (!latest.has(row.import_person_id)) latest.set(row.import_person_id, mapDecisionRow(row))
  }
  return latest
}

async function loadBatch(
  client: DecisionApiClient,
  context: AuthContext,
  batchId: string,
): Promise<PayrollImportBatch> {
  assertUuid(batchId, 'batch_id')
  const result = await client
    .from('payroll_import_batches')
    .select('id,tenant_id,hr_group_id,administration_id,source_type,source_hash,tax_year,period_start,period_end,payroll_tax_number,status,source_deleted_at')
    .eq('id', batchId)
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId!)
    .eq('administration_id', context.administrationId!)
    .maybeSingle()
  if (result.error) throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_BATCH_READ_FAILED', 500)
  if (!result.data) throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_BATCH_NOT_FOUND', 404)
  return result.data as PayrollImportBatch
}

const EMPLOYEE_ADDRESS_BATCH_SIZE = 200
const EMPLOYEE_ADDRESS_QUERY_CONCURRENCY = 8

async function readScopedEmployeeAddresses(
  supabase: DecisionApiClient,
  context: AuthContext,
  employeeIds: readonly string[],
): Promise<CoreEmployeeAddress[]> {
  const uniqueIds = [...new Set(employeeIds)].sort()
  const idBatches: string[][] = []
  for (let offset = 0; offset < uniqueIds.length; offset += EMPLOYEE_ADDRESS_BATCH_SIZE) {
    idBatches.push(uniqueIds.slice(offset, offset + EMPLOYEE_ADDRESS_BATCH_SIZE))
  }

  const addresses: CoreEmployeeAddress[] = []
  for (let offset = 0; offset < idBatches.length; offset += EMPLOYEE_ADDRESS_QUERY_CONCURRENCY) {
    const results = await Promise.all(idBatches
      .slice(offset, offset + EMPLOYEE_ADDRESS_QUERY_CONCURRENCY)
      .map((ids) => readAllPages<CoreEmployeeAddress>(async (from, to) => {
        const result = await supabase.from('employee_addresses')
          .select('id,tenant_id,employee_id,address_type,address_line_1,address_line_2,street,house_number,house_number_addition,postal_code,region,city,country_code,valid_from,valid_until')
          .eq('tenant_id', context.tenantId)
          .in('employee_id', ids)
          .is('deleted_at', null)
          .order('employee_id', { ascending: true })
          .order('valid_from', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
        return { data: result.data as unknown as CoreEmployeeAddress[] | null, error: result.error }
      }, 'PAYROLL_IMPORT_CORE_STATE_READ_FAILED')))
    for (const result of results) {
      addresses.push(...result)
      if (addresses.length > MAX_PAGES * PAGE_SIZE) {
        throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_CORE_STATE_TOO_LARGE', 413)
      }
    }
  }
  return addresses
}

async function loadPlannerState(
  authorized: AuthorizedRequest,
  batchId: string,
  dependencies: PayrollImportDecisionApiDependencies,
  options: { readonly includeEmployeeCandidates: boolean } = {
    includeEmployeeCandidates: canReadPayrollImportEmployeeCandidates(authorized.context.permissions),
  },
): Promise<LoadedDecisionState> {
  const { context, supabase } = authorized
  const batch = await loadBatch(supabase, context, batchId)
  assertHash(batch.source_hash, 'source')

  const [people, incomes, employeeRows, employmentRows, bindings, assignments, coreIncomeRows, employmentIncomeLinks] = await Promise.all([
    readAllPages<PayrollImportPerson>(async (from, to) => {
      const result = await supabase.from('payroll_import_persons')
        .select('id,tenant_id,hr_group_id,batch_id,source_row_number,external_employee_number,bsn_fingerprint,initials,prefix,first_name,birth_name,birth_date,gender,nationality,address,status,match_status,matched_employee_id,validation_codes,source_metadata')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', context.hrGroupId!)
        .eq('batch_id', batch.id)
        .order('source_row_number', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as PayrollImportPerson[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_PERSON_READ_FAILED'),
    readAllPages<PayrollImportIncome>(async (from, to) => {
      const result = await supabase.from('payroll_import_income_relationships')
        .select('id,tenant_id,hr_group_id,batch_id,import_person_id,administration_id,payroll_tax_number,ikv_number,income_code,employment_relation_code,cao_code,flags,hours_per_week,salary_amount,starts_on,ends_on,status,matched_income_relationship_id,source_metadata')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', context.hrGroupId!)
        .eq('batch_id', batch.id)
        .eq('administration_id', context.administrationId!)
        .order('id', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as PayrollImportIncome[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_INCOME_READ_FAILED'),
    readAllPages<CoreEmployee>(async (from, to) => {
      const result = await supabase.from('employees')
        .select('id,tenant_id,hr_group_id,employee_number,initials,first_name,birth_name,birth_date,gender,nationality')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', context.hrGroupId!)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as CoreEmployee[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_CORE_STATE_READ_FAILED'),
    readAllPages<CoreEmployment>(async (from, to) => {
      const result = await supabase.from('employments')
        .select('id,employee_id,tenant_id,hr_group_id,administration_id,record_status,starts_on,ends_on')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', context.hrGroupId!)
        .eq('administration_id', context.administrationId!)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as CoreEmployment[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_CORE_STATE_READ_FAILED'),
    readAllPages<TaxNumberBinding>(async (from, to) => {
      const result = await supabase.from('administration_payroll_tax_numbers')
        .select('payroll_tax_number,is_primary,valid_from,valid_until')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', context.hrGroupId!)
        .eq('administration_id', context.administrationId!)
        .order('valid_from', { ascending: true })
        .order('payroll_tax_number', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as TaxNumberBinding[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_CORE_STATE_READ_FAILED'),
    readAllPages<EmployeeAdministrationAssignment>(async (from, to) => {
      const result = await supabase.from('employee_administration_assignments')
        .select('employee_id,administration_id')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', context.hrGroupId!)
        .eq('administration_id', context.administrationId!)
        .order('employee_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as EmployeeAdministrationAssignment[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_CORE_STATE_READ_FAILED'),
    readAllPages<CoreIncomeRelationship>(async (from, to) => {
      const result = await supabase.from('income_relationships')
        .select('id,employee_id,tenant_id,administration_id,payroll_tax_subnumber,ikv_number,starts_on,ends_on')
        .eq('tenant_id', context.tenantId)
        .eq('administration_id', context.administrationId!)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as CoreIncomeRelationship[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_CORE_STATE_READ_FAILED'),
    readAllPages<EmploymentIncomeLink>(async (from, to) => {
      const result = await supabase.from('employment_income_relationships')
        .select('income_relationship_id,employment_id,employee_id,valid_from,valid_until')
        .eq('tenant_id', context.tenantId)
        .eq('administration_id', context.administrationId!)
        .order('income_relationship_id', { ascending: true })
        .order('valid_from', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      return { data: result.data as unknown as EmploymentIncomeLink[] | null, error: result.error }
    }, 'PAYROLL_IMPORT_CORE_STATE_READ_FAILED'),

  ])
  const employeeIds = new Set(employeeRows.map((row) => row.id))
  const administrationIdsByEmployee = new Map<string, string[]>()
  for (const assignment of assignments.filter((row) => employeeIds.has(row.employee_id))) {
    administrationIdsByEmployee.set(assignment.employee_id, [
      ...(administrationIdsByEmployee.get(assignment.employee_id) ?? []),
      assignment.administration_id,
    ])
  }
  const employeeAddresses = await readScopedEmployeeAddresses(
    supabase,
    context,
    employeeAddressIdsForScope(employeeRows.map((row) => row.id), assignments, context.administrationId!),
  )
  const bsnEmployeeMatches = options.includeEmployeeCandidates
    ? await readBsnEmployeeMatches(supabase, context, people)
    : new Map<string, readonly string[]>()

  const coreEmployees: PayrollFinalizationEmployee[] = employeeRows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    hrGroupId: row.hr_group_id,
    administrationIds: [...new Set(administrationIdsByEmployee.get(row.id) ?? [])].sort(),
  }))
  const coreEmployments: PayrollFinalizationEmployment[] = employmentRows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    tenantId: row.tenant_id,
    hrGroupId: row.hr_group_id,
    administrationId: row.administration_id,
    status: (() => {
      const recordStatus = String(row.record_status)
      return recordStatus === 'CONFIRMED' || recordStatus === 'DRAFT' || recordStatus === 'ENDED' ? recordStatus : 'OTHER'
    })(),
    validFrom: row.starts_on,
    validUntilExclusive: inclusiveEndToExclusive(row.ends_on),
  }))

  const employmentById = new Map(employmentRows.map((row) => [row.id, row]))
  const employmentIncomeLinksByIncome = new Map<string, EmploymentIncomeLink[]>()
  for (const link of employmentIncomeLinks) {
    employmentIncomeLinksByIncome.set(link.income_relationship_id, [
      ...(employmentIncomeLinksByIncome.get(link.income_relationship_id) ?? []),
      link,
    ])
  }
  const coreIncomeRelationships: PayrollFinalizationIncomeRelationship[] = coreIncomeRows
    .filter((row) => employeeIds.has(row.employee_id))
    .map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    tenantId: row.tenant_id,
    // The Core income table has no HR-group column. The employee set above is
    // already constrained to the active HR group; keep that derived scope
    // explicit at the planner boundary.
    hrGroupId: context.hrGroupId!,
    administrationId: row.administration_id,
    payrollTaxNumber: fullPayrollTaxNumber(row.payroll_tax_subnumber, row.starts_on, row.ends_on, bindings),
    ikvNumber: row.ikv_number,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    employmentId: resolveScopedEmploymentId(
      {
        id: row.id,
        employeeId: row.employee_id,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      },
      employmentIncomeLinksByIncome.get(row.id) ?? [],
      employmentById,
      { tenantId: context.tenantId, hrGroupId: context.hrGroupId!, administrationId: context.administrationId! },
    ),
  }))

  const peopleForPlanner: PayrollFinalizationPlannerPersonInput[] = people.map((person) => {
    const personIncomes = incomes
      .filter((income) => income.import_person_id === person.id)
      .sort((left, right) => left.id.localeCompare(right.id))
    return {
      sourceRef: `row-${person.source_row_number}`,
      decisionSource: decisionSourceForPerson(person, incomes, employeeIds),
      confirmedDecision: null,
      incomeRelationships: personIncomes.map((income, index) => ({
        sourceRef: sourceRef(person, income, index),
        payrollTaxNumber: income.payroll_tax_number,
        ikvNumber: income.ikv_number,
        startsOn: income.starts_on,
        endsOn: income.ends_on,
      })),
    }
  })

  const analysisHash = hash({
    batchId: batch.id,
    tenantId: batch.tenant_id,
    hrGroupId: batch.hr_group_id,
    administrationId: batch.administration_id,
    sourceHash: batch.source_hash,
    people: people.map((person) => ({
      id: person.id,
      tenantId: person.tenant_id,
      hrGroupId: person.hr_group_id,
      batchId: person.batch_id,
      sourceRowNumber: person.source_row_number,
      externalEmployeeNumber: person.external_employee_number,
      bsnFingerprint: person.bsn_fingerprint,
      initials: person.initials,
      prefix: person.prefix,
      firstName: person.first_name,
      birthName: person.birth_name,
      birthDate: person.birth_date,
      gender: person.gender,
      nationality: person.nationality,
      address: person.address,
      status: person.status,
      matchStatus: person.match_status,
      matchedEmployeeId: person.matched_employee_id,
      validationCodes: person.validation_codes,
      sourceMetadata: person.source_metadata,
      incomes: incomes.filter((income) => income.import_person_id === person.id).map((income) => ({
        id: income.id,
        tenantId: income.tenant_id,
        hrGroupId: income.hr_group_id,
        batchId: income.batch_id,
        administrationId: income.administration_id,
        importPersonId: income.import_person_id,
        payrollTaxNumber: income.payroll_tax_number,
        ikvNumber: income.ikv_number,
        startsOn: income.starts_on,
        endsOn: income.ends_on,
        status: income.status,
        matchedIncomeRelationshipId: income.matched_income_relationship_id,
        sourceMetadata: income.source_metadata,
      })),
    })),
  })
  const coreState = {
    employees: coreEmployees,
    employments: coreEmployments,
    incomeRelationships: coreIncomeRelationships,
    // These fields stay server-side inside the digest. They are the Core
    // values that a source-field decision may update; returning them would
    // unnecessarily expand the decision workspace payload.
    employeeFields: employeeRows.map((row) => ({
      id: row.id,
      employeeNumber: row.employee_number,
      initials: row.initials,
      firstName: row.first_name,
      birthName: row.birth_name,
      birthDate: row.birth_date,
      gender: row.gender,
      nationality: row.nationality,
    })),
    employeeAddresses: employeeAddresses
      .filter((row) => employeeIds.has(row.employee_id))
      .map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        addressType: row.address_type,
        addressLine1: row.address_line_1,
        addressLine2: row.address_line_2,
        street: row.street,
        houseNumber: row.house_number,
        houseNumberAddition: row.house_number_addition,
        postalCode: row.postal_code,
        region: row.region,
        city: row.city,
        countryCode: row.country_code,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
      })),
  }
  const coreStateHash = hash(coreState)
  const plannerInput: PayrollFinalizationPlannerInput = {
    batch: {
      batchId: batch.id,
      tenantId: batch.tenant_id,
      hrGroupId: batch.hr_group_id,
      administrationId: batch.administration_id,
      sourceType: batch.source_type,
      sourceHash: batch.source_hash,
      analysisHash,
      // Staging currently retains no XSD evidence. A future approved staging
      // contract can populate these values; until then planning stays blocked.
      schemaVersion: null,
      officialSchemaValidated: false,
      sourceImmutable: batch.source_deleted_at === null,
    },
    contractVersion: null,
    scopeInvariantMigrationApplied: dependencies.scopeInvariantMigrationApplied ?? false,
    currentUserId: context.userId,
    currentCoreStateHash: coreStateHash,
    people: peopleForPlanner,
    coreState,
  }
  const latestDecisions = await readLatestDecisionRows(supabase, batch, people.map((person) => person.id))
  const peopleWithDecisions = plannerInput.people.map((person) => {
    const decision = latestDecisions.get(person.decisionSource.personId)
    return decision ? { ...person, confirmedDecision: { ...decision, decision: decision.decision } } : person
  })
  return {
    batch,
    people,
    incomes,
    coreEmployeeRows: employeeRows,
    administrationIdsByEmployee,
    bsnEmployeeMatches,
    includeEmployeeCandidates: options.includeEmployeeCandidates,
    plannerInput: { ...plannerInput, people: peopleWithDecisions },
    latestDecisions,
  }
}

function ensureDecisionTargets(
  decision: PayrollImportPersonDecision,
  plannerPerson: PayrollFinalizationPlannerPersonInput,
  state: LoadedDecisionState,
): void {
  const employees = new Map(state.plannerInput.coreState.employees.map((employee) => [employee.id, employee]))
  const employments = new Map(state.plannerInput.coreState.employments.map((employment) => [employment.id, employment]))
  const incomes = new Map(state.plannerInput.coreState.incomeRelationships.map((income) => [income.id, income]))
  const selectedEmployeeId = decision.match.action === 'REUSE_EMPLOYEE' ? decision.match.employeeId : undefined
  if (selectedEmployeeId && !employees.has(selectedEmployeeId)) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_EMPLOYEE_SCOPE_INVALID', 403)
  }
  if (selectedEmployeeId) {
    const selectedEmployee = employees.get(selectedEmployeeId)
    if (!selectedEmployee || !employeeInPayrollImportAdministrationScope(selectedEmployee, state.batch.administration_id)) {
      throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_EMPLOYEE_ADMINISTRATION_SCOPE_INVALID', 403)
    }
  }
  for (const [sourceRef, employmentDecision] of Object.entries(decision.employmentByIncomeRelationship)) {
    if (employmentDecision.action !== 'REUSE_EMPLOYMENT') continue
    const employment = employmentDecision.employmentId ? employments.get(employmentDecision.employmentId) : undefined
    if (!employment || employment.employeeId !== selectedEmployeeId || employment.administrationId !== state.batch.administration_id) {
      throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_EMPLOYMENT_SCOPE_INVALID', 403)
    }
    if (!plannerPerson.incomeRelationships.some((income) => income.sourceRef === sourceRef)) {
      throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_DECISION_SOURCE_INVALID', 422)
    }
  }
  for (const [sourceRef, incomeDecision] of Object.entries(decision.incomeRelationshipBySourceRef)) {
    if (incomeDecision.action !== 'LINK') continue
    const income = incomeDecision.incomeRelationshipId ? incomes.get(incomeDecision.incomeRelationshipId) : undefined
    if (!income || income.employeeId !== selectedEmployeeId || income.administrationId !== state.batch.administration_id) {
      throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_INCOME_SCOPE_INVALID', 403)
    }
    if (!plannerPerson.incomeRelationships.some((candidate) => candidate.sourceRef === sourceRef)) {
      throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_DECISION_SOURCE_INVALID', 422)
    }
  }
}

function assertCompletePlanDecisions(state: LoadedDecisionState, currentUserId: string): void {
  const blockers: Array<{ personId: string; blockers: readonly string[] }> = []
  const current = {
    sourceHash: state.plannerInput.batch.sourceHash,
    analysisHash: state.plannerInput.batch.analysisHash,
    coreStateHash: state.plannerInput.currentCoreStateHash,
  }
  for (const plannerPerson of state.plannerInput.people) {
    const personId = plannerPerson.decisionSource.personId
    const decision = state.latestDecisions.get(personId)
    if (!decision) {
      blockers.push({ personId, blockers: ['DECISION_MISSING'] })
      continue
    }
    const personBlockers: string[] = []
    if (!isPayrollImportDecisionAuthentic({
      decision: decision.decision,
      decisionVersion: decision.decisionVersion,
      confirmerUserId: decision.confirmerUserId,
      confirmedAt: decision.confirmedAt,
      sourceHash: decision.sourceHash,
      analysisHash: decision.analysisHash,
      coreStateHash: decision.coreStateHash,
      decisionHash: decision.decisionHash,
    })) personBlockers.push('DECISION_CONFIRMATION_INVALID')
    const validation = validatePayrollImportDecision(decision.decision, plannerPerson.decisionSource)
    if (!validation.valid) personBlockers.push(...validation.blockers)
    if (!isPayrollImportDecisionFresh(decision, current)) {
      if (decision.sourceHash !== current.sourceHash || decision.analysisHash !== current.analysisHash) personBlockers.push('DECISION_SOURCE_STALE')
      if (decision.coreStateHash !== current.coreStateHash) personBlockers.push('DECISION_CORE_STATE_STALE')
    }
    if (decision.confirmerUserId !== currentUserId) personBlockers.push('DECISION_ACTOR_MISMATCH')
    try {
      ensureDecisionTargets(decision.decision, plannerPerson, state)
    } catch (error) {
      if (error instanceof PayrollImportDecisionApiError) personBlockers.push(error.code)
      else throw error
    }
    const uniqueBlockers = [...new Set(personBlockers)]
    if (uniqueBlockers.length > 0) blockers.push({ personId, blockers: uniqueBlockers })
  }
  if (blockers.length > 0) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_PLAN_CONFIRMATIONS_REQUIRED', 422, { blockers })
  }
}

export function assertPayrollImportPlanHasActions(
  plan: Pick<PayrollFinalizationPlan, 'people'>,
): void {
  const actionCount = plan.people.reduce((count, person) => count + person.actions.length, 0)
  if (actionCount === 0) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_PLAN_EMPTY', 422, {
      blockers: ['PAYROLL_IMPORT_PLAN_EMPTY'],
    })
  }
}

function getPlannerPerson(state: LoadedDecisionState, personId: string): PayrollFinalizationPlannerPersonInput {
  const person = state.plannerInput.people.find((candidate) => candidate.decisionSource.personId === personId)
  if (!person) throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_PERSON_NOT_FOUND', 404)
  return person
}

function getSourceRowNumber(state: LoadedDecisionState, personId: string): number {
  const person = state.people.find((candidate) => candidate.id === personId)
  if (!person) throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_PERSON_NOT_FOUND', 500)
  return person.source_row_number
}

export async function getPayrollImportDecisionSnapshot(
  batchId: string,
  dependencies: PayrollImportDecisionApiDependencies = {},
): Promise<PayrollImportDecisionSnapshot> {
  const authorized = await authorize('payroll-import:read', dependencies)
  const state = await loadPlannerState(authorized, batchId, dependencies)
  return assertBoundedPayrollImportResponse({
    batchId: state.batch.id,
    tenantId: state.batch.tenant_id,
    hrGroupId: state.batch.hr_group_id,
    administrationId: state.batch.administration_id,
    sourceType: state.batch.source_type,
    taxYear: state.batch.tax_year,
    periodStart: state.batch.period_start,
    periodEnd: state.batch.period_end,
    payrollTaxNumber: state.batch.payroll_tax_number,
    batchStatus: state.batch.status,
    sourceImmutable: state.plannerInput.batch.sourceImmutable,
    schemaVersion: state.plannerInput.batch.schemaVersion,
    officialSchemaValidated: state.plannerInput.batch.officialSchemaValidated,
    sourceHash: state.plannerInput.batch.sourceHash,
    analysisHash: state.plannerInput.batch.analysisHash,
    coreStateHash: state.plannerInput.currentCoreStateHash,
    people: state.plannerInput.people
      .map((person) => {
        const sourcePerson = state.people.find((candidate) => candidate.id === person.decisionSource.personId)
        if (!sourcePerson) throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_PERSON_NOT_FOUND', 500)
        const status = publicRowStatus(sourcePerson.status)
        const sourceIncomes = state.incomes
          .filter((income) => income.import_person_id === sourcePerson.id)
          .sort((left, right) => left.id.localeCompare(right.id))
        const candidateEmployeeId = selectedEmployeeIdForDecisionSnapshot(
          state.latestDecisions.get(sourcePerson.id),
          person.decisionSource,
          {
            sourceHash: state.plannerInput.batch.sourceHash,
            analysisHash: state.plannerInput.batch.analysisHash,
            coreStateHash: state.plannerInput.currentCoreStateHash,
          },
          authorized.context.userId,
        ) ?? person.decisionSource.proposedEmployeeId ?? null
        const scopedEmployeeId = scopedPayrollImportEmployeeId(
          candidateEmployeeId,
          state.plannerInput.coreState.employees,
          state.batch.administration_id,
        )
        const scopedEmployeeCandidate = scopedEmployeeId
          ? state.plannerInput.coreState.employees.find((candidate) => candidate.id === scopedEmployeeId) ?? null
          : null
        const employeeCandidates = state.includeEmployeeCandidates
          ? publicEmployeeCandidates(
            sourcePerson,
            state.coreEmployeeRows,
            state.administrationIdsByEmployee,
            state.bsnEmployeeMatches,
          )
          : []
        const codes = validationCodes(sourcePerson.validation_codes)
        return {
          personId: sourcePerson.id,
          sourceRowNumber: sourcePerson.source_row_number,
          externalEmployeeNumber: sourcePerson.external_employee_number,
          initials: sourcePerson.initials,
          prefix: sourcePerson.prefix,
          firstName: sourcePerson.first_name,
          birthName: sourcePerson.birth_name,
          birthDate: sourcePerson.birth_date,
          gender: sourcePerson.gender,
          nationality: sourcePerson.nationality,
          address: publicAddress(sourcePerson.address),
          status,
          sourceRef: person.sourceRef,
          matchStatus: person.decisionSource.matchStatus,
          proposedEmployeeId: scopedEmployeeId,
          employeeCandidate: scopedEmployeeCandidate
            ? { id: scopedEmployeeCandidate.id, administrationIds: scopedEmployeeCandidate.administrationIds }
            : null,
          employeeCandidates,
          sourceFields: person.decisionSource.sourceFields,
          issues: codes.map((code) => ({ code, severity: status === 'BLOCKING' ? 'BLOCKING' as const : 'WARNING' as const })),
          sourceMetadata: publicMetadata(sourcePerson.source_metadata),
          incomeRelationships: sourceIncomes.map((income, index) => ({
            sourceRef: sourceRef(sourcePerson, income, index),
            payrollTaxNumber: income.payroll_tax_number,
            ikvNumber: income.ikv_number,
            incomeCode: income.income_code,
            employmentRelationCode: income.employment_relation_code,
            caoCode: income.cao_code,
            flags: publicFlags(income.flags),
            hoursPerWeek: income.hours_per_week,
            salaryAmount: income.salary_amount,
            startsOn: income.starts_on,
            endsOn: income.ends_on,
            sourceMetadata: publicMetadata(income.source_metadata),
            coreIncomeCandidates: state.plannerInput.coreState.incomeRelationships
              .filter((candidate) => scopedEmployeeId !== null
                && candidate.employeeId === scopedEmployeeId
                && candidate.payrollTaxNumber === income.payroll_tax_number
                && candidate.ikvNumber === income.ikv_number
                && candidate.startsOn === income.starts_on
                && candidate.endsOn === income.ends_on)
              .map((candidate) => ({
                id: candidate.id,
                employeeId: candidate.employeeId,
                payrollTaxNumber: candidate.payrollTaxNumber,
                ikvNumber: candidate.ikvNumber,
                startsOn: candidate.startsOn,
                endsOn: candidate.endsOn,
                employmentId: candidate.employmentId,
              })),
            employmentCandidates: state.plannerInput.coreState.employments
              .filter((candidate) => scopedEmployeeId !== null
                && candidate.employeeId === scopedEmployeeId
                && candidate.administrationId === state.batch.administration_id
                && employmentCoversSourcePeriod(candidate, income.starts_on, income.ends_on))
              .map((candidate) => ({
                id: candidate.id,
                employeeId: candidate.employeeId,
                administrationId: candidate.administrationId,
                status: candidate.status,
                validFrom: candidate.validFrom,
                validUntilExclusive: candidate.validUntilExclusive,
              })),
          })),
        }
      })
      .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef)),
    decisions: [...state.latestDecisions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([personId, decision]) => {
        const person = state.people.find((candidate) => candidate.id === personId)
        if (!person) throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_PERSON_NOT_FOUND', 500)
        const status = getPayrollImportDecisionStatus(decision, {
          sourceHash: state.plannerInput.batch.sourceHash,
          analysisHash: state.plannerInput.batch.analysisHash,
          coreStateHash: state.plannerInput.currentCoreStateHash,
        }, authorized.context.userId)
        return publicDecision(personId, person.source_row_number, decision, status.status, status.blockers)
      }),
  })
}

export async function savePayrollImportDecision(
  batchId: string,
  personId: string,
  input: PayrollImportDecisionPutInput,
  dependencies: PayrollImportDecisionApiDependencies = {},
): Promise<PayrollImportDecisionResponse> {
  const authorized = await authorize('payroll-import:write', dependencies)
  assertUuid(personId, 'person_id')
  const parsed = payrollImportDecisionPutSchema.parse(input)
  const state = await loadPlannerState(authorized, batchId, dependencies)
  const plannerPerson = getPlannerPerson(state, personId)
  const validation = validatePayrollImportDecision(parsed.decision, plannerPerson.decisionSource)
  if (!validation.valid) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_DECISION_INCOMPLETE', 422, { blockers: validation.blockers })
  }
  ensureDecisionTargets(parsed.decision, plannerPerson, state)

  const latest = state.latestDecisions.get(personId)
  const sourceHash = state.plannerInput.batch.sourceHash
  const analysisHash = state.plannerInput.batch.analysisHash
  const coreStateHash = state.plannerInput.currentCoreStateHash
  const latestIsFresh = latest ? isPayrollImportDecisionFresh(latest, { sourceHash, analysisHash, coreStateHash }) : false
  if (latest && latestIsFresh
    && latest.confirmerUserId === authorized.context.userId
    && latest.sourceHash === sourceHash
    && latest.analysisHash === analysisHash
    && latest.coreStateHash === coreStateHash
    && stableSerialize(latest.decision) === stableSerialize(parsed.decision)) {
    await invalidateFinalizationPlansAfterDecisionChange({
      tenantId: state.batch.tenant_id,
      hrGroupId: state.batch.hr_group_id,
      administrationId: state.batch.administration_id,
      batchId: state.batch.id,
      actorUserId: authorized.context.userId,
    }, asDecisionApiClient(createAdminClient()))
    return publicDecision(personId, getSourceRowNumber(state, personId), latest)
  }

  const currentVersion = latest?.decisionVersion ?? 0
  if (!isExpectedPayrollImportDecisionVersion(latest, parsed.expectedDecisionVersion)) {
    throw new PayrollImportDecisionApiError('PAYROLL_IMPORT_DECISION_VERSION_CONFLICT', 409, {
      currentVersion,
      expectedVersion: parsed.expectedDecisionVersion,
    })
  }
  const confirmed = confirmPayrollImportDecision({
    decision: parsed.decision,
    decisionVersion: currentVersion + 1,
    confirmerUserId: authorized.context.userId,
    confirmedAt: (dependencies.now ?? (() => new Date().toISOString()))(),
    sourceHash,
    analysisHash,
    coreStateHash,
  })
  try {
    const persisted = await persistConfirmedPayrollImportDecision({
      tenantId: state.batch.tenant_id,
      hrGroupId: state.batch.hr_group_id,
      administrationId: state.batch.administration_id,
      batchId: state.batch.id,
      importPersonId: personId,
      decision: confirmed,
      actorUserId: authorized.context.userId,
      sourceHash,
      analysisHash,
      coreStateHash,
      contractVersion: state.plannerInput.contractVersion,
      schemaVersion: state.plannerInput.batch.schemaVersion,
    }, asDecisionApiClient(createAdminClient()))
    return publicDecision(personId, getSourceRowNumber(state, personId), persisted)
  } catch (error) {
    if (error instanceof FinalizationLedgerError) throw error
    throw new PayrollImportDecisionApiError('PAYROLL_FINALIZATION_DECISION_PERSIST_FAILED', 500)
  }
}

export async function previewPayrollImportPlan(
  batchId: string,
  dependencies: PayrollImportDecisionApiDependencies = {},
): Promise<PayrollImportPlanResponse> {
  const authorized = await authorize('payroll-import:write', dependencies)
  const state = await loadPlannerState(authorized, batchId, dependencies)
  assertCompletePlanDecisions(state, authorized.context.userId)
  const plan = buildPayrollFinalizationPlan(state.plannerInput)
  assertPayrollImportPlanHasActions(plan)
  const ledgerClient = asDecisionApiClient(createAdminClient())
  const persistedActions = await persistFinalizationPlan({
    plannerInput: state.plannerInput,
    actorUserId: authorized.context.userId,
  }, ledgerClient)
  const persistedPlan = await readFinalizationPlan({
    tenantId: state.batch.tenant_id,
    hrGroupId: state.batch.hr_group_id,
    administrationId: state.batch.administration_id,
    batchId: state.batch.id,
    planHash: plan.planHash,
    sourceHash: plan.sourceHash,
    analysisHash: plan.analysisHash,
    coreStateHash: plan.coreStateHash,
  }, ledgerClient)
  const ledgerReadback = persistedActions.filter(({ row }) => row.plan_id === persistedPlan.row.id)
  const expectedActionCount = plan.people.reduce((count, person) => count + person.actions.length, 0)
  if (ledgerReadback.length !== expectedActionCount) {
    throw new PayrollImportDecisionApiError('PAYROLL_FINALIZATION_PLAN_READBACK_INCOMPLETE', 500)
  }
  return assertBoundedPayrollImportResponse({
    ...plan,
    ledgerReadback,
    resultSummary: summarizePayrollFinalizationResult(plan, ledgerReadback),
  })
}
