import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requirePermission } = vi.hoisted(() => ({ createClient: vi.fn(), requirePermission: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/auth/permissions', () => ({ AuthorizationError: class extends Error {}, requirePermission }))

import { getEmploymentPayrollSourceProjection, getEmploymentPayrollSourceProjectionsBatch } from './employment-detail-service'
import { readPayrollTimelineBatch } from './payroll-timeline-batch-reader'

type Row = Record<string, unknown>
const scope = { tenantId: '10000000-0000-4000-8000-000000000001', hrGroupId: '20000000-0000-4000-8000-000000000001', administrationId: '30000000-0000-4000-8000-000000000001' }
const period = { year: 2026, month: 10 }
const inputs = Array.from({ length: 5 }, (_, index) => ({
  employeeId: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  employmentId: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  payrollPeriod: period,
}))

function fixtures(): Record<string, Row[]> {
  const base = inputs.map((input) => ({
    tenant_id: scope.tenantId, hr_group_id: scope.hrGroupId, administration_id: scope.administrationId,
    employee_id: input.employeeId, employment_id: input.employmentId,
  }))
  return {
    employments: base.map((row) => ({ ...row, id: row.employment_id, starts_on: '2024-01-01', ends_on: null, deleted_at: null, record_status: 'CONFIRMED', employment_type: 'PRIMARY', contract_type: 'PERMANENT', original_hire_date: '2024-01-01', seniority_date: '2024-01-01', updated_at: '2026-10-01T00:00:00Z' })),
    employment_salaries: base.map((row, index) => ({ ...row, id: `salary-${index}`, salary_basis: 'MONTH', fulltime_amount: 2500 + index, parttime_amount: 2000 + index, valid_from: '2025-01-01', valid_until: null, updated_at: '2026-09-01T00:00:00Z' })),
    employment_schedules: base.map((row, index) => ({ ...row, id: `schedule-${index}`, average_hours_per_week: 32, fulltime_hours_per_week: 40, part_time_factor: 0.8, valid_from: '2025-01-01', valid_until: null, updated_at: '2026-09-01T00:00:00Z' })),
    employment_contracts: base.map((row, index) => ({ ...row, id: `contract-${index}`, labor_condition_set_id: 'labor-set', fulltime_hours_per_week: 40, starts_on: '2024-01-01', ends_on: null, updated_at: '2026-09-01T00:00:00Z' })),
    employment_labor_conditions: base.map((row, index) => ({ ...row, id: `labor-${index}`, employment_contract_id: `contract-${index}`, condition_group: 'CAO', valid_from: '2024-01-01', valid_until: null, updated_at: '2026-09-01T00:00:00Z' })),
    employee_organizations: [], employment_pension_arrangement_assignments: [], labor_condition_pension_arrangements: [],
  }
}

function database(rows: Record<string, Row[]>, failedTable?: string) {
  const queries: { table: string; pairs: string[]; eq: [string, unknown][] }[] = []
  const from = vi.fn((table: string) => {
    const query = { table, pairs: [] as string[], eq: [] as [string, unknown][] }
    queries.push(query)
    const predicates: ((row: Row) => boolean)[] = []
    let columns: string[] = [], order: string | undefined, limit = Infinity, single = false
    const builder: Record<string, unknown> = {}
    builder.select = (value: string) => { columns = value.split(',').map((column) => column.trim()); return builder }
    builder.eq = (column: string, value: unknown) => { query.eq.push([column, value]); predicates.push((row) => row[column] === value); return builder }
    builder.in = (column: string, values: unknown[]) => { predicates.push((row) => values.includes(row[column])); return builder }
    builder.or = (expression: string) => {
      query.pairs.push(expression)
      const pairs = [...expression.matchAll(/and\(employee_id\.eq\.([^,]+),(id|employment_id)\.eq\.([^\)]+)\)/g)]
      predicates.push((row) => pairs.some((pair) => row.employee_id === pair[1] && row[pair[2]!] === pair[3]))
      return builder
    }
    builder.order = (value: string) => { order = value; return builder }
    builder.limit = (value: number) => { limit = value; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    builder.then = (resolve: (value: unknown) => unknown) => {
      if (table === failedTable) return Promise.resolve({ data: null, error: { code: '42501', message: 'FORBIDDEN' } }).then(resolve)
      let data = (rows[table] ?? []).filter((row) => predicates.every((predicate) => predicate(row)))
      if (order) { const key = order; data = [...data].sort((a, b) => String(a[key]).localeCompare(String(b[key]))) }
      data = data.slice(0, limit).map((row) => Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]])))
      return Promise.resolve({ data: single ? data[0] ?? null : data, error: null }).then(resolve)
    }
    return builder
  })
  return { client: { from }, queries }
}

describe('authorized Payroll timeline batches', () => {
  beforeEach(() => {
    createClient.mockReset(); requirePermission.mockReset()
    requirePermission.mockResolvedValue(scope)
  })

  it('preserves individual projections and reduces five employee reads to two groups per table', async () => {
    const rows = fixtures(), singleDb = database(rows), batchDb = database(rows)
    createClient.mockResolvedValue(singleDb.client)
    const single = await Promise.all(inputs.map((input) => getEmploymentPayrollSourceProjection(input.employeeId, input.employmentId, period)))
    createClient.mockResolvedValue(batchDb.client)
    const batch = await getEmploymentPayrollSourceProjectionsBatch(inputs)
    expect(batch).toEqual(single)
    expect(batch.map((row) => row.salaries[0]?.parttime_amount)).toEqual([2000, 2001, 2002, 2003, 2004])
    for (const table of ['employments', 'employment_contracts', 'employment_labor_conditions', 'employee_organizations', 'employment_salaries', 'employment_schedules', 'employment_pension_arrangement_assignments']) {
      expect(singleDb.queries.filter((query) => query.table === table)).toHaveLength(5)
      expect(batchDb.queries.filter((query) => query.table === table)).toHaveLength(2)
    }
    expect(batchDb.queries.every((query) => query.eq.some(([key, value]) => key === 'tenant_id' && value === scope.tenantId))).toBe(true)
    expect(batchDb.queries.every((query) => query.eq.some(([key, value]) => key === 'administration_id' && value === scope.administrationId))).toBe(true)
  })

  it('excludes cross-pair and foreign-tenant rows without altering source dates', async () => {
    const rows = fixtures()
    rows.employment_salaries!.push({ ...rows.employment_salaries![0], employee_id: inputs[1]!.employeeId, id: 'cross-pair', parttime_amount: 999999 })
    rows.employment_salaries!.push({ ...rows.employment_salaries![0], tenant_id: 'foreign', id: 'foreign' })
    createClient.mockResolvedValue(database(rows).client)
    const result = await getEmploymentPayrollSourceProjectionsBatch(inputs)
    expect(result[0]?.salaries).toHaveLength(1)
    expect(result.flatMap((row) => row.salaries).map((row) => row.id)).not.toContain('cross-pair')
    expect(result[0]?.salaries[0]?.valid_from).toBe('2025-01-01')
  })

  it.each(['tenantId', 'hrGroupId', 'administrationId'] as const)('rejects mixed %s before reading', async (key) => {
    requirePermission.mockImplementation(async (_permission: string, employeeId: string) => employeeId === inputs[0]!.employeeId ? scope : { ...scope, [key]: 'foreign' })
    await expect(getEmploymentPayrollSourceProjectionsBatch(inputs)).rejects.toMatchObject({ status: 404 })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects a denied employee before any source read', async () => {
    requirePermission.mockImplementation(async (_permission: string, employeeId: string) => { if (employeeId === inputs[1]!.employeeId) throw new Error('DENIED'); return scope })
    await expect(getEmploymentPayrollSourceProjectionsBatch(inputs)).rejects.toThrow('DENIED')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('preserves source failures and missing employment without producing a successful empty timeline', async () => {
    createClient.mockResolvedValue(database(fixtures(), 'employment_salaries').client)
    await expect(getEmploymentPayrollSourceProjectionsBatch(inputs)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403, sourceCategory: 'employment-salaries' })
    const rows = fixtures(); rows.employments = []
    createClient.mockResolvedValue(database(rows).client)
    await expect(getEmploymentPayrollSourceProjectionsBatch(inputs)).rejects.toMatchObject({ code: 'EMPLOYMENT_NOT_FOUND', status: 404 })
  })

  it('preserves full effective-date histories and the existing order within each target', async () => {
    const rows = fixtures()
    rows.employment_salaries!.unshift({ ...rows.employment_salaries![0], id: 'earlier', valid_from: '2024-01-01', valid_until: '2025-01-01' })
    createClient.mockResolvedValue(database(rows).client)
    const single = await getEmploymentPayrollSourceProjection(inputs[0]!.employeeId, inputs[0]!.employmentId, period)
    const batch = await getEmploymentPayrollSourceProjectionsBatch(inputs)
    expect(batch[0]).toEqual(single)
    expect(batch[0]?.salaries.map((row) => row.id)).toEqual(['earlier', 'salary-0'])
  })

  it('rejects mixed periods before authorization', async () => {
    await expect(getEmploymentPayrollSourceProjectionsBatch([inputs[0]!, { ...inputs[1]!, payrollPeriod: { year: 2026, month: 9 } }])).rejects.toMatchObject({ status: 400 })
    expect(requirePermission).not.toHaveBeenCalled()
  })

  it.each(['limit', 'ambiguous-order'] as const)('requires original-reader fallback at %s', async (mode) => {
    const rows = fixtures(), salary = rows.employment_salaries![0]!
    rows.employment_salaries = Array.from({ length: mode === 'limit' ? 100 : 2 }, (_, index) => ({ ...salary, id: `salary-${index}` }))
    createClient.mockResolvedValue(database(rows).client)
    await expect(getEmploymentPayrollSourceProjectionsBatch(inputs)).rejects.toThrow('PAYROLL_TIMELINE_BATCH_FALLBACK_REQUIRED')
  })

  it('rejects oversized groups and unsafe filter identifiers before reading', async () => {
    const db = database(fixtures())
    await expect(readPayrollTimelineBatch(db.client as unknown as Parameters<typeof readPayrollTimelineBatch>[0], scope, inputs)).rejects.toThrow('PAYROLL_TIMELINE_BATCH_INVALID')
    await expect(readPayrollTimelineBatch(db.client as unknown as Parameters<typeof readPayrollTimelineBatch>[0], scope, [{ employeeId: 'id),or(id.neq.null', employmentId: inputs[0]!.employmentId }])).rejects.toThrow('PAYROLL_TIMELINE_BATCH_INVALID')
    expect(db.queries).toHaveLength(0)
  })
})
