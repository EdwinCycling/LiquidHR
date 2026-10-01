import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayrollImportAnalysis } from './model'
import { createEmployment } from '@/lib/employment/employment-service'
import { finalizePayrollImport, stagePayrollImport } from './service'

const mocks = vi.hoisted(() => {
  class MockEmploymentServiceError extends Error {
    constructor(readonly code: string, readonly status = 500, readonly databaseCode?: string) {
      super(code)
    }
  }

  return {
    getRequestAuthorizationContext: vi.fn(),
    requirePermission: vi.fn(),
    createEmployee: vi.fn(),
    createEmployment: vi.fn(),
    ensureEmployeeAdministrationAssignment: vi.fn(),
    nextAvailableEmploymentNumber: vi.fn(),
    MockEmploymentServiceError,
  }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  getRequestAuthorizationContext: mocks.getRequestAuthorizationContext,
  requirePermission: mocks.requirePermission,
}))
vi.mock('@/lib/employees/employee-service', () => ({ createEmployee: mocks.createEmployee }))
vi.mock('@/lib/employment/employment-service', () => ({
  EmploymentServiceError: mocks.MockEmploymentServiceError,
  createEmployment: mocks.createEmployment,
  ensureEmployeeAdministrationAssignment: mocks.ensureEmployeeAdministrationAssignment,
}))
vi.mock('@/lib/employment/employment-number', () => ({ nextAvailableEmploymentNumber: mocks.nextAvailableEmploymentNumber }))

type DbRow = Record<string, unknown>
type DbState = { tables: Record<string, DbRow[]>; nextId: number }
type QueryResult = { data: DbRow[] | null; error: null }
type Filter = { column: string; kind: 'eq' | 'in' | 'is' | 'lte'; value: unknown }

class MemoryQuery {
  private operation: 'select' | 'insert' | 'update' = 'select'
  private payload: DbRow | DbRow[] | null = null
  private readonly filters: Filter[] = []

  constructor(private readonly state: DbState, private readonly table: string) {}

  select(_columns?: string): this { return this }
  eq(column: string, value: unknown): this { this.filters.push({ column, kind: 'eq', value }); return this }
  in(column: string, value: readonly unknown[]): this { this.filters.push({ column, kind: 'in', value }); return this }
  is(column: string, value: unknown): this { this.filters.push({ column, kind: 'is', value }); return this }
  lte(column: string, value: unknown): this { this.filters.push({ column, kind: 'lte', value }); return this }
  or(_expression: string): this { return this }
  order(_column: string, _options?: { ascending?: boolean }): this { return this }
  limit(_count: number): this { return this }
  insert(payload: DbRow | DbRow[]): this { this.operation = 'insert'; this.payload = payload; return this }
  update(payload: DbRow): this { this.operation = 'update'; this.payload = payload; return this }

  maybeSingle(): Promise<{ data: DbRow | null; error: null }> {
    return Promise.resolve({ data: this.execute().data?.[0] ?? null, error: null })
  }

  single(): Promise<{ data: DbRow | null; error: null }> {
    return this.maybeSingle()
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute(): QueryResult {
    const rows = this.state.tables[this.table] ?? (this.state.tables[this.table] = [])
    if (this.operation === 'insert') {
      const inputRows = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : []
      const inserted = inputRows.map((input) => {
        const row = { ...input }
        if (typeof row.id !== 'string') row.id = `${this.table}-${this.state.nextId++}`
        rows.push(row)
        return row
      })
      return { data: inserted.map((row) => ({ ...row })), error: null }
    }

    const matches = rows.filter((row) => this.filters.every((filter) => {
      const value = row[filter.column]
      if (filter.kind === 'in') return Array.isArray(filter.value) && filter.value.includes(value)
      if (filter.kind === 'lte') return typeof value === 'string' && typeof filter.value === 'string' && value <= filter.value
      return value === filter.value
    }))

    if (this.operation === 'update' && this.payload) {
      for (const row of matches) Object.assign(row, this.payload)
    }
    return { data: matches.map((row) => ({ ...row })), error: null }
  }
}

let state: DbState

function createState(): DbState {
  return {
    nextId: 1,
    tables: {
      administration_payroll_tax_numbers: [{
        tenant_id: 'tenant-1',
        hr_group_id: 'group-1',
        administration_id: 'admin-1',
        payroll_tax_number: '123456789L01',
        valid_from: '2026-01-01',
        valid_until: null,
        is_primary: true,
      }],
      payroll_import_batches: [],
      payroll_import_persons: [],
      payroll_import_income_relationships: [],
      employees: [],
      employee_administration_assignments: [],
      employments: [],
      income_relationships: [],
      employment_income_relationships: [],
    },
  }
}

function makeAnalysis(
  match: PayrollImportAnalysis['rows'][number]['match'] = { status: 'NEW' },
  options: { incomeCount?: number; rawMarker?: string } = {},
): PayrollImportAnalysis {
  const incomes = Array.from({ length: options.incomeCount ?? 2 }, (_, index) => ({
    payrollTaxNumber: '123456789L01',
    ikvNumber: index + 1,
    flags: {},
    startsOn: '2026-01-01',
  }))
  return {
    sourceType: 'INTERNAL_REPRESENTATIVE',
    sourceFilename: 'synthetic-convergence.json',
    sourceHash: 'a'.repeat(64),
    rows: [{
      sourceRowNumber: 1,
      bsnFingerprint: 'b'.repeat(64),
      initials: 'SP',
      firstName: 'Synthetic',
      birthName: 'Person',
      birthDate: '1990-01-01',
      incomeRelationships: incomes,
      sourceMetadata: { sourceRow: 1, ...(options.rawMarker ? { rawBsn: options.rawMarker } : {}) },
      status: 'GREEN',
      match,
      issues: [],
    }],
    summary: { total: 1, green: 1, warnings: 0, blocking: 0, incomeRelationships: incomes.length, ambiguousMatches: 0 },
  }
}

async function stageFixture(analysis = makeAnalysis()): Promise<string> {
  const result = await stagePayrollImport({ analysis, taxYear: 2026, administrationId: 'admin-1' })
  return result.batchId
}

function linkExistingEmployee(employeeId: string): void {
  const person = state.tables.payroll_import_persons[0]
  const batch = state.tables.payroll_import_batches[0]
  if (!person || !batch) throw new Error('test fixture was not staged')
  person.matched_employee_id = employeeId
  person.match_status = 'EXACT'
  person.status = 'WARNING'
  batch.status = 'FAILED'
  state.tables.employees.push({ id: employeeId, tenant_id: 'tenant-1', hr_group_id: 'group-1' })
  for (const stagedIncome of state.tables.payroll_import_income_relationships) {
    const id = `domain-income-${String(stagedIncome.ikv_number)}`
    stagedIncome.status = 'IMPORTED'
    stagedIncome.matched_income_relationship_id = id
    state.tables.income_relationships.push({
      id,
      tenant_id: 'tenant-1',
      administration_id: 'admin-1',
      employee_id: employeeId,
      payroll_tax_subnumber: '01',
      ikv_number: stagedIncome.ikv_number,
      deleted_at: null,
    })
  }
}

beforeEach(() => {
  state = createState()
  mocks.getRequestAuthorizationContext.mockReset()
  mocks.requirePermission.mockReset().mockResolvedValue(undefined)
  mocks.createEmployee.mockReset().mockImplementation(async () => {
    const id = `employee-${state.nextId++}`
    state.tables.employees.push({ id, tenant_id: 'tenant-1', hr_group_id: 'group-1' })
    return { id } as never
  })
  mocks.ensureEmployeeAdministrationAssignment.mockReset().mockImplementation(async (employeeId: string, startsOn: string, administrationId: string) => {
    const exists = state.tables.employee_administration_assignments.some((row) => row.employee_id === employeeId && row.administration_id === administrationId)
    if (!exists) state.tables.employee_administration_assignments.push({
      id: `assignment-${state.nextId++}`,
      tenant_id: 'tenant-1',
      hr_group_id: 'group-1',
      administration_id: administrationId,
      employee_id: employeeId,
      effective_from: startsOn,
    })
  })
  mocks.nextAvailableEmploymentNumber.mockReset().mockResolvedValue('EMP-TEST-1')
  mocks.createEmployment.mockReset().mockImplementation(async (
    input: Parameters<typeof createEmployment>[0],
    options: Parameters<typeof createEmployment>[1],
  ) => {
    const sourcePersonId = options?.payrollImportPersonId
    const existing = state.tables.employments.find((row) => row.payroll_import_person_id === sourcePersonId)
    if (existing) return { employment: existing, isRehire: false, wasCreated: false } as never

    const employment: DbRow = {
      id: `employment-${state.nextId++}`,
      tenant_id: 'tenant-1',
      hr_group_id: 'group-1',
      administration_id: 'admin-1',
      employee_id: input.employeeId,
      payroll_import_person_id: sourcePersonId,
      employment_number: input.employmentNumber,
      starts_on: input.startsOn,
      record_status: 'DRAFT',
    }
    state.tables.employments.push(employment)
    return { employment, isRehire: false, wasCreated: true } as never
  })
  const client = { from: (table: string) => new MemoryQuery(state, table) }
  mocks.getRequestAuthorizationContext.mockResolvedValue({
    context: {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      permissions: ['payroll-import:write', 'salary:write'],
    },
    supabase: client,
  } as never)
})

describe('payroll import staging and finalization', () => {
  it('houdt preview-staging idempotent en schrijft geen domeinrecords of raw BSN', async () => {
    const rawMarker = 'SYNTHETIC_RAW_BSN_MARKER'
    const analysis = makeAnalysis({ status: 'NEW' }, { rawMarker })

    const first = await stageFixture(analysis)
    const second = await stageFixture(analysis)

    expect(second).toBe(first)
    expect(state.tables.payroll_import_batches).toHaveLength(1)
    expect(state.tables.payroll_import_persons).toHaveLength(1)
    expect(state.tables.payroll_import_income_relationships).toHaveLength(2)
    expect(state.tables.employees).toHaveLength(0)
    expect(state.tables.employments).toHaveLength(0)
    expect(state.tables.employee_administration_assignments).toHaveLength(0)
    expect(state.tables.income_relationships).toHaveLength(0)
    expect(JSON.stringify(state.tables.payroll_import_persons)).not.toContain(rawMarker)
  })

  it('maakt voor een nieuwe persoon één employee, één draft employment en verwerkt alle IKV’s', async () => {
    const batchId = await stageFixture(makeAnalysis({ status: 'NEW' }, { incomeCount: 2 }))

    const result = await finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] })

    expect(result.employeesImported).toBe(1)
    expect(result.employmentsCreated).toBe(1)
    expect(result.incomeRelationshipsImported).toBe(2)
    expect(result.warnings).toContain('ROW_1_EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING')
    expect(state.tables.employees).toHaveLength(1)
    expect(state.tables.employee_administration_assignments).toHaveLength(1)
    expect(state.tables.employments).toHaveLength(1)
    expect(state.tables.employments[0]?.record_status).toBe('DRAFT')
    expect(state.tables.income_relationships).toHaveLength(2)
    expect(state.tables.payroll_import_income_relationships.filter((row) => row.status === 'IMPORTED')).toHaveLength(2)
    expect(state.tables.payroll_import_persons[0]?.validation_codes).toEqual(expect.arrayContaining(['EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING']))
    expect(state.tables.payroll_import_batches[0]?.status).toBe('COMPLETED_WITH_WARNINGS')
    expect(mocks.createEmployee).toHaveBeenCalledOnce()
  })

  it('hergebruikt een bestaande employee-match uit de stagingrij', async () => {
    state.tables.employees.push({ id: 'employee-existing', tenant_id: 'tenant-1', hr_group_id: 'group-1' })
    const batchId = await stageFixture(makeAnalysis({ status: 'EXACT', employeeId: 'employee-existing' }, { incomeCount: 1 }))

    await finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] })

    expect(mocks.createEmployee).not.toHaveBeenCalled()
    expect(state.tables.employees).toHaveLength(1)
    expect(state.tables.employments).toHaveLength(1)
    expect(state.tables.employments[0]?.employee_id).toBe('employee-existing')
  })

  it('hervat na employee-creatie zonder employment en voorkomt duplicaten bij herhaalde retry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const rawMarker = 'SYNTHETIC_RAW_BSN_MARKER'
    const batchId = await stageFixture(makeAnalysis({ status: 'NEW' }, { incomeCount: 2, rawMarker }))
    mocks.createEmployment.mockRejectedValueOnce(new mocks.MockEmploymentServiceError('EMPLOYMENT_CREATE_FAILED', 500, '23503'))

    await expect(finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_FINALIZATION_FAILED' })
    expect(state.tables.payroll_import_batches[0]?.status).toBe('FAILED')
    expect(state.tables.employees).toHaveLength(1)
    expect(state.tables.payroll_import_persons[0]?.matched_employee_id).toBe(state.tables.employees[0]?.id)
    expect(state.tables.employments).toHaveLength(0)
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(rawMarker)
    expect(JSON.stringify(state.tables.payroll_import_persons)).not.toContain(rawMarker)

    const employeeId = String(state.tables.employees[0]?.id)
    const recovered = await finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] })
    expect(recovered.employeesImported).toBe(0)
    expect(recovered.employmentsCreated).toBe(1)
    expect(state.tables.employees).toHaveLength(1)
    expect(state.tables.employee_administration_assignments).toHaveLength(1)
    expect(state.tables.employments).toHaveLength(1)
    expect(state.tables.employments[0]?.employee_id).toBe(employeeId)
    expect(state.tables.income_relationships).toHaveLength(2)
    expect(state.tables.payroll_import_income_relationships.filter((row) => row.status === 'IMPORTED')).toHaveLength(2)
    expect(state.tables.payroll_import_persons[0]?.validation_codes).toEqual(expect.arrayContaining(['EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING']))
    expect(state.tables.payroll_import_batches[0]?.status).toBe('COMPLETED_WITH_WARNINGS')

    await expect(finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE' })
    expect(mocks.createEmployee).toHaveBeenCalledOnce()
    expect(mocks.createEmployment).toHaveBeenCalledTimes(2)
    expect(state.tables.employees).toHaveLength(1)
    expect(state.tables.employments).toHaveLength(1)
    expect(state.tables.income_relationships).toHaveLength(2)
    errorSpy.mockRestore()
  })
})
