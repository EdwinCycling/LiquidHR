import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requirePermission, createClient } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requirePermission,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import {
  getEmploymentPayrollTaxSourceProjection,
  getEmploymentPayrollTaxSourceProjectionsBatch,
} from './employment-payroll-tax-profile-service'

type Row = Record<string, unknown>
type TestClient = { readonly from: (table: string) => Record<string, unknown> }

const tenantId = '10000000-0000-4000-8000-000000000010'
const hrGroupId = '20000000-0000-4000-8000-000000000020'
const administrationId = '30000000-0000-4000-8000-000000000030'
const employeeIds = [
  '40000000-0000-4000-8000-000000000040',
  '40000000-0000-4000-8000-000000000041',
] as const
const employmentIds = [
  '50000000-0000-4000-8000-000000000050',
  '50000000-0000-4000-8000-000000000051',
] as const

function payrollRows(): Record<string, readonly Row[]> {
  return {
    employees: employeeIds.map((id, index) => ({
      id,
      birth_date: index === 0 ? '1990-04-03' : '1960-01-01',
      updated_at: `2026-09-0${index + 1}T08:00:00.000Z`,
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      deleted_at: null,
    })),
    income_relationships: employeeIds.map((employee_id, index) => ({
      id: `60000000-0000-4000-8000-00000000006${index}`,
      employee_id,
      ikv_number: index + 1,
      reporting_status: 'READY',
      relationship_type: 'EMPLOYMENT',
      starts_on: '2026-01-01',
      ends_on: null,
      updated_at: `2026-09-1${index}T08:00:00.000Z`,
      tenant_id: tenantId,
      administration_id: administrationId,
      deleted_at: null,
    })),
    employment_income_relationships: employeeIds.map((employee_id, index) => ({
      id: `70000000-0000-4000-8000-00000000007${index}`,
      employee_id,
      employment_id: employmentIds[index],
      income_relationship_id: `60000000-0000-4000-8000-00000000006${index}`,
      valid_from: '2026-01-01',
      valid_until: null,
      updated_at: `2026-09-1${index}T08:10:00.000Z`,
      tenant_id: tenantId,
      administration_id: administrationId,
    })),
    employments: employeeIds.map((employee_id, index) => ({
      id: employmentIds[index],
      employee_id,
      starts_on: '2024-01-01',
      ends_on: null,
      record_status: 'CONFIRMED',
      deleted_at: null,
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
    })),
    employment_payroll_tax_profiles: employeeIds.map((employee_id, index) => ({
      id: `80000000-0000-4000-8000-00000000008${index}`,
      employee_id,
      employment_id: employmentIds[index],
      income_relationship_id: `60000000-0000-4000-8000-00000000006${index}`,
      employment_income_relationship_id: `70000000-0000-4000-8000-00000000007${index}`,
      residence_country_code: 'NL',
      wage_tax_table: index === 0 ? 'WHITE' : 'GREEN',
      herleiding_code: 'STD',
      time_period: 'MONTH',
      regular_wage_only: true,
      full_period_only: true,
      has_special_situation: false,
      payroll_tax_credit_applies: index === 0,
      source_classification: 'HR_ADMIN_CONFIRMED',
      source_reference: `fixture-${index}`,
      effective_from: '2026-01-01',
      effective_to: null,
      version_number: 1,
      supersedes_profile_id: null,
      confirmed_by_user_id: '90000000-0000-4000-8000-000000000090',
      confirmed_at: '2026-01-01T09:00:00.000Z',
      created_at: '2026-01-01T09:00:00.000Z',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
    })),
  }
}

function testClient(fixtures: Record<string, readonly Row[]>): { readonly client: TestClient; readonly from: ReturnType<typeof vi.fn> } {
  const from = vi.fn((table: string) => {
    const filters: ((row: Row) => boolean)[] = []
    let range: readonly [number, number] | undefined
    let limit: number | undefined
    const builder: Record<string, unknown> = {}
    const chain = (): Record<string, unknown> => builder

    builder.select = chain
    builder.eq = (column: string, value: unknown) => {
      filters.push((row) => row[column] === value)
      return builder
    }
    builder.in = (column: string, values: readonly unknown[]) => {
      filters.push((row) => values.includes(row[column]))
      return builder
    }
    builder.is = (column: string, value: unknown) => {
      filters.push((row) => row[column] === value)
      return builder
    }
    builder.lte = (column: string, value: string) => {
      filters.push((row) => typeof row[column] === 'string' && String(row[column]) <= value)
      return builder
    }
    builder.or = (expression: string) => {
      const match = /^([a-z_]+)\.is\.null,\1\.gte\.(\d{4}-\d{2}-\d{2})$/.exec(expression)
      if (match?.[1] && match[2]) {
        const column = match[1]
        const value = match[2]
        filters.push((row) => row[column] === null || (typeof row[column] === 'string' && String(row[column]) >= value))
      }
      return builder
    }
    builder.order = chain
    builder.range = (start: number, end: number) => {
      range = [start, end]
      return builder
    }
    builder.limit = (value: number) => {
      limit = value
      return builder
    }
    const execute = () => {
      const rows = (fixtures[table] ?? []).filter((row) => filters.every((filter) => filter(row)))
      const selected = range ? rows.slice(range[0], range[1] + 1) : limit === undefined ? rows : rows.slice(0, limit)
      return { data: selected, error: null }
    }
    builder.maybeSingle = async () => ({ data: execute().data[0] ?? null, error: null })
    builder.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve().then(execute).then(resolve, reject)
    return builder
  })
  return { client: { from }, from }
}

describe('employment payroll tax source batch read', () => {
  beforeEach(() => {
    requirePermission.mockReset()
    createClient.mockReset()
    requirePermission.mockImplementation(async (_permission: string, employeeId: string) => ({
      tenantId,
      hrGroupId,
      administrationId,
      employeeId,
    }))
  })

  it('matches individual source projections while reading bounded scoped batches', async () => {
    const fixtures = payrollRows()
    const singleDb = testClient(fixtures)
    const batchDb = testClient(fixtures)
    let batchMode = false
    createClient.mockImplementation(async () => (batchMode ? batchDb.client : singleDb.client))
    const inputs = employeeIds.map((employeeId, index) => ({
      employeeId,
      employmentId: employmentIds[index]!,
      period: { year: 2026, month: 9 },
    }))

    const singles = await Promise.all(inputs.map((input) => getEmploymentPayrollTaxSourceProjection(
      input.employeeId,
      input.employmentId,
      input.period,
    )))
    batchMode = true
    const batch = await getEmploymentPayrollTaxSourceProjectionsBatch(inputs)

    expect(batch).toEqual(singles)
    expect(batch.map((projection) => projection.taxProfiles[0]?.employee_id)).toEqual([...employeeIds])
    expect(batch.map((projection) => projection.incomeRelationships[0]?.id)).toEqual([
      '60000000-0000-4000-8000-000000000060',
      '60000000-0000-4000-8000-000000000061',
    ])
    expect(batchDb.from).toHaveBeenCalledTimes(5)
    expect(singleDb.from).toHaveBeenCalledTimes(10)
    expect(requirePermission).toHaveBeenCalledTimes(8)
  })

  it('rejects mixed authorized tenant scopes before reading any source row', async () => {
    const db = testClient(payrollRows())
    requirePermission.mockImplementation(async (_permission: string, employeeId: string) => ({
      tenantId: employeeId === employeeIds[0] ? tenantId : 'foreign-tenant',
      hrGroupId,
      administrationId,
      employeeId,
    }))
    createClient.mockResolvedValue(db.client)

    await expect(getEmploymentPayrollTaxSourceProjectionsBatch(employeeIds.map((employeeId, index) => ({
      employeeId,
      employmentId: employmentIds[index]!,
      period: { year: 2026, month: 9 },
    })))).rejects.toMatchObject({ code: 'PAYROLL_TAX_PROFILE_SCOPE_UNAVAILABLE', status: 404 })

    expect(createClient).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
  })

  it('rejects mixed payroll periods before authorization or database reads', async () => {
    const db = testClient(payrollRows())
    createClient.mockResolvedValue(db.client)

    await expect(getEmploymentPayrollTaxSourceProjectionsBatch([
      { employeeId: employeeIds[0], employmentId: employmentIds[0], period: { year: 2026, month: 9 } },
      { employeeId: employeeIds[1], employmentId: employmentIds[1], period: { year: 2026, month: 10 } },
    ])).rejects.toMatchObject({ code: 'PAYROLL_TAX_PROFILE_INPUT_INVALID', status: 400 })

    expect(requirePermission).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })
})
