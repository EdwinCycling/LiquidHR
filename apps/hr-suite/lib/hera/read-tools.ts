import { z } from 'zod'
import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { HeRaEvidenceEnvelope } from './data-contract'

export const salaryThresholdInputSchema = z.object({
  amount: z.number().finite().nonnegative().max(1_000_000),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict()

export type SalaryThresholdInput = z.infer<typeof salaryThresholdInputSchema>

export const employeeSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(25).default(10),
}).strict()
export const visibleEmploymentInputSchema = z.object({
  employeeId: z.string().min(1).max(100),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict()
export const visibleOrganizationInputSchema = z.object({
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departmentId: z.string().uuid().optional(),
}).strict()

export type EmployeeSearchInput = z.infer<typeof employeeSearchInputSchema>
export type VisibleEmploymentInput = z.infer<typeof visibleEmploymentInputSchema>
export type VisibleOrganizationInput = z.infer<typeof visibleOrganizationInputSchema>

interface SalaryRow {
  employeeId: string
  amount: number | null
  currency: string
  paymentType: 'PERIODIC_FIXED' | 'HOURLY_VARIABLE'
  paymentFrequency: 'MONTHLY' | 'FOUR_WEEKLY'
}

interface SalaryScope {
  tenantId: string
  administrationId: string | null
  asOfDate: string
}

interface EmployeeSearchRow {
  employeeId: string
  employeeNumber: string
  firstName: string
  lastName: string
}

interface EmployeeSearchItem {
  employeeId: string
  employeeNumber: string
  displayName: string
}

interface VisibleEmploymentRow {
  employmentId: string
  startsOn: string
  endsOn: string | null
  contractType: string
  employmentType: string
}

interface VisibleOrganizationRows {
  departments: Array<{ departmentId: string; code: string; name: string }>
  placements: Array<{ departmentId: string }>
}

export interface SalaryThresholdResult {
  matchedCount: number
  populationCount: number
  currency: 'EUR'
  salaryBasis: 'MONTHLY_BASE'
  canRevealIndividuals: false
}

export interface HeRaReadToolDependencies {
  authorizeSalaryRead?: () => Promise<AuthContext>
  listVisibleCurrentSalaries?: (scope: SalaryScope) => Promise<SalaryRow[]>
  authorizeEmployeeRead?: () => Promise<AuthContext>
  searchEmployees?: (scope: SalaryScope & EmployeeSearchInput) => Promise<EmployeeSearchRow[]>
  authorizeEmploymentRead?: (employeeId: string) => Promise<AuthContext>
  loadEmployment?: (scope: SalaryScope & { employeeId: string }) => Promise<VisibleEmploymentRow | null>
  authorizeOrganizationRead?: () => Promise<AuthContext>
  loadOrganization?: (scope: SalaryScope & { departmentId?: string }) => Promise<VisibleOrganizationRows>
}

export class HeRaReadToolError extends Error {
  constructor(readonly code: 'HERA_SCOPE_MISMATCH' | 'HERA_READ_FAILED' | 'HERA_NOT_FOUND') {
    super(code)
  }
}

function assertSameContext(expected: AuthContext, actual: AuthContext): void {
  if (
    actual.userId !== expected.userId
    || actual.tenantId !== expected.tenantId
    || actual.administrationId !== expected.administrationId
  ) {
    throw new HeRaReadToolError('HERA_SCOPE_MISMATCH')
  }
}

async function authorizeSalaryRead(): Promise<AuthContext> {
  return requirePermission('salary:read')
}

async function listVisibleCurrentSalaries(scope: SalaryScope): Promise<SalaryRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('employment_salaries')
    .select('employee_id, fulltime_amount, currency_code, payment_type, payment_frequency, valid_from')
    .eq('tenant_id', scope.tenantId)
    .lte('valid_from', scope.asOfDate)
    .or(`valid_until.is.null,valid_until.gte.${scope.asOfDate}`)
    .order('valid_from', { ascending: false })
    .limit(5_000)

  if (scope.administrationId) {
    query = query.eq('administration_id', scope.administrationId)
  }

  const { data, error } = await query
  if (error) throw new HeRaReadToolError('HERA_READ_FAILED')

  const latestPerEmployee = new Map<string, SalaryRow>()
  for (const row of data) {
    if (latestPerEmployee.has(row.employee_id)) continue
    latestPerEmployee.set(row.employee_id, {
      employeeId: row.employee_id,
      amount: row.fulltime_amount,
      currency: row.currency_code,
      paymentType: row.payment_type,
      paymentFrequency: row.payment_frequency,
    })
  }
  return [...latestPerEmployee.values()]
}

export async function countVisibleSalariesAbove(
  context: AuthContext,
  input: SalaryThresholdInput,
  dependencies: HeRaReadToolDependencies = {},
): Promise<HeRaEvidenceEnvelope<SalaryThresholdResult>> {
  const parsed = salaryThresholdInputSchema.parse(input)
  const authorizedContext = await (dependencies.authorizeSalaryRead ?? authorizeSalaryRead)()
  assertSameContext(context, authorizedContext)

  const rows = await (dependencies.listVisibleCurrentSalaries ?? listVisibleCurrentSalaries)({
    tenantId: context.tenantId,
    administrationId: context.administrationId,
    asOfDate: parsed.asOfDate,
  })
  const population = rows.filter((row) =>
    row.paymentType === 'PERIODIC_FIXED'
    && row.paymentFrequency === 'MONTHLY'
    && row.currency === 'EUR'
    && row.amount !== null,
  )
  const matchedCount = population.filter((row) => (row.amount ?? 0) > parsed.amount).length

  return {
    source: 'LIQUID_HR',
    data: {
      matchedCount,
      populationCount: population.length,
      currency: 'EUR',
      salaryBasis: 'MONTHLY_BASE',
      canRevealIndividuals: false,
    },
    scope: {
      population: 'Zichtbare actuele vaste maandsalarissen',
      visibleCount: population.length,
    },
    filters: [
      { field: 'fulltime_amount', operator: '>', value: String(parsed.amount) },
      { field: 'payment_type', operator: '=', value: 'PERIODIC_FIXED' },
      { field: 'payment_frequency', operator: '=', value: 'MONTHLY' },
      { field: 'currency_code', operator: '=', value: 'EUR' },
    ],
    asOfDate: parsed.asOfDate,
    uncertainties: ['Variabele beloning, toeslagen en vierwekensalarissen zijn niet meegerekend.'],
  }
}

async function authorizeEmployeeRead(): Promise<AuthContext> {
  const employeeContext = await requirePermission('employee:read')
  const contractContext = await requirePermission('contract:read')
  assertSameContext(employeeContext, contractContext)
  return employeeContext
}

function escapeLikePattern(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

async function searchEmployees(scope: SalaryScope & EmployeeSearchInput): Promise<EmployeeSearchRow[]> {
  const supabase = await createClient()
  const pattern = `%${escapeLikePattern(scope.query)}%`
  let employmentQuery = supabase
    .from('employments')
    .select('employee_id')
    .eq('tenant_id', scope.tenantId)
    .is('deleted_at', null)
    .lte('starts_on', scope.asOfDate)
    .or(`ends_on.is.null,ends_on.gte.${scope.asOfDate}`)
    .limit(5_000)
  if (scope.administrationId) {
    employmentQuery = employmentQuery.eq('administration_id', scope.administrationId)
  }
  const employmentResult = await employmentQuery
  if (employmentResult.error) throw new HeRaReadToolError('HERA_READ_FAILED')
  const employeeIds = [...new Set((employmentResult.data ?? []).map((row) => row.employee_id))]
  if (employeeIds.length === 0) return []

  const createQuery = (column: 'first_name' | 'birth_name') => {
    return supabase
      .from('employees')
      .select('id, employee_number, first_name, birth_name')
      .eq('tenant_id', scope.tenantId)
      .in('id', employeeIds)
      .is('deleted_at', null)
      .ilike(column, pattern)
      .order('birth_name')
      .limit(scope.limit)
  }
  const [firstNameResult, lastNameResult] = await Promise.all([
    createQuery('first_name'),
    createQuery('birth_name'),
  ])
  if (firstNameResult.error || lastNameResult.error) {
    throw new HeRaReadToolError('HERA_READ_FAILED')
  }
  const rows = [...(firstNameResult.data ?? []), ...(lastNameResult.data ?? [])]
  const unique = new Map(rows.map((row) => [row.id, {
    employeeId: row.id,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.birth_name,
  }]))
  return [...unique.values()].slice(0, scope.limit)
}

export async function searchVisibleEmployees(
  context: AuthContext,
  input: EmployeeSearchInput,
  dependencies: HeRaReadToolDependencies = {},
): Promise<HeRaEvidenceEnvelope<{ items: EmployeeSearchItem[] }>> {
  const parsed = employeeSearchInputSchema.parse(input)
  const authorized = await (dependencies.authorizeEmployeeRead ?? authorizeEmployeeRead)()
  assertSameContext(context, authorized)
  const rows = await (dependencies.searchEmployees ?? searchEmployees)({
    tenantId: context.tenantId,
    administrationId: context.administrationId,
    asOfDate: new Date().toISOString().slice(0, 10),
    ...parsed,
  })
  const items: EmployeeSearchItem[] = rows.map((row) => ({
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    displayName: `${row.firstName} ${row.lastName}`.trim(),
  }))
  return {
    source: 'LIQUID_HR',
    data: { items },
    scope: { population: 'Zichtbare medewerkers', visibleCount: items.length },
    filters: [{ field: 'name', operator: 'contains', value: parsed.query }],
    asOfDate: new Date().toISOString().slice(0, 10),
    uncertainties: [],
  }
}

async function authorizeEmploymentRead(employeeId: string): Promise<AuthContext> {
  return requirePermission('contract:read', employeeId)
}

async function loadEmployment(
  scope: SalaryScope & { employeeId: string },
): Promise<VisibleEmploymentRow | null> {
  const supabase = await createClient()
  let query = supabase
    .from('employments')
    .select('id, starts_on, ends_on, contract_type, employment_type')
    .eq('tenant_id', scope.tenantId)
    .eq('employee_id', scope.employeeId)
    .is('deleted_at', null)
    .lte('starts_on', scope.asOfDate)
    .or(`ends_on.is.null,ends_on.gte.${scope.asOfDate}`)
    .order('starts_on', { ascending: false })
    .limit(1)
  if (scope.administrationId) {
    query = query.eq('administration_id', scope.administrationId)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw new HeRaReadToolError('HERA_READ_FAILED')
  return data ? {
    employmentId: data.id,
    startsOn: data.starts_on,
    endsOn: data.ends_on,
    contractType: data.contract_type,
    employmentType: data.employment_type,
  } : null
}

export async function getVisibleEmployment(
  context: AuthContext,
  input: VisibleEmploymentInput,
  dependencies: HeRaReadToolDependencies = {},
): Promise<HeRaEvidenceEnvelope<VisibleEmploymentRow>> {
  const parsed = visibleEmploymentInputSchema.parse(input)
  const authorized = await (dependencies.authorizeEmploymentRead ?? authorizeEmploymentRead)(parsed.employeeId)
  assertSameContext(context, authorized)
  const employment = await (dependencies.loadEmployment ?? loadEmployment)({
    tenantId: context.tenantId,
    administrationId: context.administrationId,
    employeeId: parsed.employeeId,
    asOfDate: parsed.asOfDate,
  })
  if (!employment) throw new HeRaReadToolError('HERA_NOT_FOUND')
  return {
    source: 'LIQUID_HR',
    data: employment,
    scope: { population: 'Zichtbaar dienstverband van één medewerker', visibleCount: 1 },
    filters: [{ field: 'employee_id', operator: '=', value: parsed.employeeId }],
    asOfDate: parsed.asOfDate,
    uncertainties: [],
  }
}

async function authorizeOrganizationRead(): Promise<AuthContext> {
  const departmentContext = await requirePermission('department:read')
  const placementContext = await requirePermission('organization-placement:read')
  assertSameContext(departmentContext, placementContext)
  return departmentContext
}

async function loadOrganization(
  scope: SalaryScope & { departmentId?: string },
): Promise<VisibleOrganizationRows> {
  const supabase = await createClient()
  let departmentQuery = supabase
    .from('departments')
    .select('id, code, name')
    .eq('tenant_id', scope.tenantId)
    .eq('is_active', true)
    .order('code')
    .limit(500)
  let placementQuery = supabase
    .from('employee_organizations')
    .select('department_id')
    .eq('tenant_id', scope.tenantId)
    .lte('effective_from', scope.asOfDate)
    .or(`effective_to.is.null,effective_to.gte.${scope.asOfDate}`)
    .limit(5_000)
  if (scope.administrationId) {
    departmentQuery = departmentQuery.eq('administration_id', scope.administrationId)
    placementQuery = placementQuery.eq('administration_id', scope.administrationId)
  }
  if (scope.departmentId) {
    departmentQuery = departmentQuery.eq('id', scope.departmentId)
    placementQuery = placementQuery.eq('department_id', scope.departmentId)
  }
  const [departmentResult, placementResult] = await Promise.all([departmentQuery, placementQuery])
  if (departmentResult.error || placementResult.error) {
    throw new HeRaReadToolError('HERA_READ_FAILED')
  }
  return {
    departments: (departmentResult.data ?? []).map((department) => ({
      departmentId: department.id,
      code: department.code,
      name: department.name,
    })),
    placements: (placementResult.data ?? []).map((placement) => ({
      departmentId: placement.department_id,
    })),
  }
}

export async function getVisibleOrganization(
  context: AuthContext,
  input: VisibleOrganizationInput,
  dependencies: HeRaReadToolDependencies = {},
): Promise<HeRaEvidenceEnvelope<{ departments: Array<VisibleOrganizationRows['departments'][number] & { visiblePlacementCount: number }> }>> {
  const parsed = visibleOrganizationInputSchema.parse(input)
  const authorized = await (dependencies.authorizeOrganizationRead ?? authorizeOrganizationRead)()
  assertSameContext(context, authorized)
  const rows = await (dependencies.loadOrganization ?? loadOrganization)({
    tenantId: context.tenantId,
    administrationId: context.administrationId,
    asOfDate: parsed.asOfDate,
    ...(parsed.departmentId ? { departmentId: parsed.departmentId } : {}),
  })
  const counts = new Map<string, number>()
  for (const placement of rows.placements) {
    counts.set(placement.departmentId, (counts.get(placement.departmentId) ?? 0) + 1)
  }
  const departments = rows.departments.map((department) => ({
    ...department,
    visiblePlacementCount: counts.get(department.departmentId) ?? 0,
  }))
  return {
    source: 'LIQUID_HR',
    data: { departments },
    scope: { population: 'Zichtbare organisatieplaatsingen', visibleCount: rows.placements.length },
    filters: parsed.departmentId
      ? [{ field: 'department_id', operator: '=', value: parsed.departmentId }]
      : [],
    asOfDate: parsed.asOfDate,
    uncertainties: ['Tellingen omvatten uitsluitend plaatsingen die de gebruiker mag zien.'],
  }
}
