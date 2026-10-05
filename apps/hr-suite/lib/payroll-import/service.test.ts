import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PayrollImportAnalysis } from './model'
import { createEmployment } from '@/lib/employment/employment-service'
import { analyzePayrollImport, finalizePayrollImport, listRecoverablePayrollImports, stagePayrollImport } from './service'

const mocks = vi.hoisted(() => {
  class MockEmploymentServiceError extends Error {
    constructor(readonly code: string, readonly status = 500, readonly databaseCode?: string) {
      super(code)
    }
  }

  return {
    getRequestAuthorizationContext: vi.fn(),
    requirePermission: vi.fn(),
    createAdminClient: vi.fn(),
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
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))

type DbRow = Record<string, unknown>
type QueryError = { code: string; message: string }
type DbState = {
  tables: Record<string, DbRow[]>
  nextId: number
  simulateBatchInsertConflict: boolean
  simulateEmployeeMarkerUpdateFailure: boolean
  simulateCompletionAuditFailure: boolean
  simulateStagedAuditReadFailure: boolean
}
type QueryResult = { data: DbRow[] | null; error: QueryError | null }
type Filter = { column: string; kind: 'eq' | 'in' | 'is' | 'lte' | 'not'; value: unknown }
let employeeMatchRpcCalls = 0
let employeeCandidateSelectCalls = 0

class MemoryQuery {
  private operation: 'select' | 'insert' | 'update' = 'select'
  private payload: DbRow | DbRow[] | null = null
  private readonly filters: Filter[] = []

  constructor(private readonly state: DbState, private readonly table: string) {}

  select(_columns?: string): this { if (this.table === 'employees') employeeCandidateSelectCalls += 1; return this }
  eq(column: string, value: unknown): this { this.filters.push({ column, kind: 'eq', value }); return this }
  in(column: string, value: readonly unknown[]): this { this.filters.push({ column, kind: 'in', value }); return this }
  is(column: string, value: unknown): this { this.filters.push({ column, kind: 'is', value }); return this }
  not(column: string, _operator: string, value: unknown): this { this.filters.push({ column, kind: 'not', value }); return this }
  lte(column: string, value: unknown): this { this.filters.push({ column, kind: 'lte', value }); return this }
  or(_expression: string): this { return this }
  order(_column: string, _options?: { ascending?: boolean }): this { return this }
  limit(_count: number): this { return this }
  insert(payload: DbRow | DbRow[]): this { this.operation = 'insert'; this.payload = payload; return this }
  update(payload: DbRow): this { this.operation = 'update'; this.payload = payload; return this }

  maybeSingle(): Promise<{ data: DbRow | null; error: QueryError | null }> {
    const result = this.execute()
    return Promise.resolve({ data: result.data?.[0] ?? null, error: result.error })
  }

  single(): Promise<{ data: DbRow | null; error: QueryError | null }> {
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
      if (this.table === 'payroll_import_batches' && state.simulateBatchInsertConflict) {
        this.state.simulateBatchInsertConflict = false
        const raced = inputRows.map((input) => ({ ...input, id: 'raced-batch' }))
        rows.push(...raced)
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
      }
      if (this.table === 'audit_logs' && this.state.simulateCompletionAuditFailure) {
        const hasCompletionAudit = inputRows.some((input) => {
          const changes = input.changes
          if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) return false
          return (changes as Record<string, unknown>).operation === 'FINALIZE'
        })
        if (hasCompletionAudit) {
          this.state.simulateCompletionAuditFailure = false
          return { data: null, error: { code: 'AUDIT_UNAVAILABLE', message: 'audit sink unavailable' } }
        }
      }
      const inserted = inputRows.map((input) => {
        const row = { ...input }
        if (typeof row.id !== 'string') row.id = `${this.table}-${this.state.nextId++}`
        rows.push(row)
        return row
      })
      return { data: inserted.map((row) => ({ ...row })), error: null }
    }

    if (this.table === 'audit_logs' && this.state.simulateStagedAuditReadFailure) {
      this.state.simulateStagedAuditReadFailure = false
      return { data: null, error: { code: 'AUDIT_READ_UNAVAILABLE', message: 'audit readback unavailable' } }
    }

    const matches = rows.filter((row) => this.filters.every((filter) => {
      const value = row[filter.column]
      if (filter.kind === 'in') return Array.isArray(filter.value) && filter.value.includes(value)
      if (filter.kind === 'lte') return typeof value === 'string' && typeof filter.value === 'string' && value <= filter.value
      if (filter.kind === 'not') return value !== filter.value
      return value === filter.value
    }))

    if (this.operation === 'update' && this.payload) {
      if (this.table === 'payroll_import_persons'
        && this.state.simulateEmployeeMarkerUpdateFailure
        && Object.prototype.hasOwnProperty.call(this.payload, 'matched_employee_id')) {
        this.state.simulateEmployeeMarkerUpdateFailure = false
        return { data: null, error: { code: 'STAGING_MARKER_UNAVAILABLE', message: 'employee marker update failed' } }
      }
      for (const row of matches) Object.assign(row, this.payload)
    }
    return { data: matches.map((row) => ({ ...row })), error: null }
  }
}

let state: DbState

function createState(): DbState {
  return {
    nextId: 1,
    simulateBatchInsertConflict: false,
    simulateEmployeeMarkerUpdateFailure: false,
    simulateCompletionAuditFailure: false,
    simulateStagedAuditReadFailure: false,
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
      hr_groups: [{ id: 'group-1', tenant_id: 'tenant-1', is_active: true }],
      administrations: [{ id: 'admin-1', tenant_id: 'tenant-1', hr_group_id: 'group-1', is_active: true }],
      payroll_import_batches: [],
      payroll_import_persons: [],
      payroll_import_income_relationships: [],
      employees: [],
      employee_administration_assignments: [],
      employments: [],
      income_relationships: [],
      employment_income_relationships: [],
      audit_logs: [],
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
  employeeMatchRpcCalls = 0
  employeeCandidateSelectCalls = 0
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
  const client = {
    from: (table: string) => new MemoryQuery(state, table),
    rpc: async () => { employeeMatchRpcCalls += 1; return { data: [], error: null } },
  }
  mocks.createAdminClient.mockReset().mockReturnValue(client as never)
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
  it('analyseert XML tegen de historische periode zonder actuele LhNr-binding of writes te eisen', async () => {
    const previousKey = process.env.BSN_HASH_KEY
    process.env.BSN_HASH_KEY = 'control02-test-key-that-is-not-production-0001'
    state.tables.administration_payroll_tax_numbers = [{
      tenant_id: 'tenant-1',
      hr_group_id: 'group-1',
      administration_id: 'admin-1',
      payroll_tax_number: '123456789L01',
      valid_from: '2026-01-01',
      valid_until: '2026-01-31',
      is_primary: true,
    }]
    try {
      const bytes = readFileSync(new URL('./xml/fixtures/loonaangifte-2026-v2.0.synthetic.xml', import.meta.url))
      const analysis = await analyzePayrollImport({
        sourceType: 'LOONAANGIFTE_XML',
        filename: 'synthetic-loonaangifte.xml',
        bytes,
        taxYear: 2026,
        administrationId: 'admin-1',
      })

      expect(analysis.sourceContext).toMatchObject({ status: 'SUPPORTED_READ_ONLY', taxYear: 2026, payrollTaxNumber: '123456789L01', xsdValidation: 'VALIDATED' })
      expect(analysis.rows[0]).toMatchObject({ significantSurnamePart: 'Voorbeeld', nationalityCode: 999, genderCode: 1 })
      expect(analysis.rows[0]?.birthName).toBeUndefined()
      expect(analysis.readiness).toMatchObject({ status: 'READY', isReady: true })
      expect(analysis.readiness?.checks).toContainEqual(expect.objectContaining({ key: 'PAYROLL_TAX_NUMBER', status: 'NOT_REQUIRED' }))
      expect(analysis.readiness?.checks).toContainEqual(expect.objectContaining({ key: 'SOURCE_LHNR_PERIOD', status: 'READY' }))
      expect(analysis.readiness?.checks).not.toContainEqual(expect.objectContaining({ code: 'SOURCE_FORMAL_VALIDATION_PENDING' }))
      expect(analysis.summary.blocking).toBeGreaterThan(0)
      expect(employeeMatchRpcCalls).toBe(0)
      expect(employeeCandidateSelectCalls).toBe(0)
      expect(state.tables.payroll_import_batches).toHaveLength(0)
      expect(state.tables.employees).toHaveLength(0)
      expect(state.tables.employments).toHaveLength(0)
      expect(state.tables.income_relationships).toHaveLength(0)
      expect(mocks.createAdminClient).not.toHaveBeenCalled()
    } finally {
      if (previousKey === undefined) delete process.env.BSN_HASH_KEY
      else process.env.BSN_HASH_KEY = previousKey
    }
  })

  it('houdt XML-import analyse-only en blokkeert staging en finalisatie fail-closed', async () => {
    const xmlAnalysis: PayrollImportAnalysis = { ...makeAnalysis(), sourceType: 'LOONAANGIFTE_XML' }

    await expect(stagePayrollImport({ analysis: xmlAnalysis, taxYear: 2026, administrationId: 'admin-1' }))
      .rejects.toMatchObject({ code: 'REAL_XML_STAGING_PENDING', status: 409 })
    expect(state.tables.payroll_import_batches).toHaveLength(0)
    expect(state.tables.payroll_import_persons).toHaveLength(0)
    expect(state.tables.payroll_import_income_relationships).toHaveLength(0)

    state.tables.payroll_import_batches.push({
      id: 'xml-batch',
      tenant_id: 'tenant-1',
      hr_group_id: 'group-1',
      administration_id: 'admin-1',
      source_type: 'LOONAANGIFTE_XML',
      status: 'STAGED',
      preview_confirmed_at: null,
    })
    await expect(finalizePayrollImport({ batchId: 'xml-batch', administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'REAL_XML_FINALIZATION_PENDING', status: 409 })
    expect(state.tables.payroll_import_batches[0]?.status).toBe('STAGED')
    expect(state.tables.employees).toHaveLength(0)
    expect(state.tables.employments).toHaveLength(0)
    expect(state.tables.income_relationships).toHaveLength(0)
  })

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
    expect(state.tables.audit_logs).toHaveLength(1)
    expect(state.tables.audit_logs[0]).toMatchObject({ entity_name: 'payroll_import_batch', action: 'CREATE' })
    expect(JSON.stringify(state.tables.audit_logs)).not.toContain(rawMarker)
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(2)
  })

  it('geeft geen bestaande stagingbatch terug zonder duurzame CREATE/STAGE-audit', async () => {
    const analysis = makeAnalysis({ status: 'NEW' }, { incomeCount: 1 })
    const batchId = await stageFixture(analysis)
    state.tables.audit_logs.pop()

    await expect(stagePayrollImport({ analysis, taxYear: 2026, administrationId: 'admin-1' }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_AUDIT_FAILED', status: 500 })
    expect(state.tables.payroll_import_batches).toHaveLength(1)
    expect(state.tables.payroll_import_batches[0]?.id).toBe(batchId)
  })

  it('faalt gesloten bij een fout tijdens de CREATE/STAGE-audit-readback', async () => {
    const analysis = makeAnalysis({ status: 'NEW' }, { incomeCount: 1 })
    const batchId = await stageFixture(analysis)
    state.simulateStagedAuditReadFailure = true

    await expect(stagePayrollImport({ analysis, taxYear: 2026, administrationId: 'admin-1' }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_AUDIT_FAILED', status: 500 })
    expect(state.tables.payroll_import_batches).toHaveLength(1)
    expect(state.tables.payroll_import_batches[0]?.id).toBe(batchId)
  })

  it('blokkeert een concurrerende maar nog lege staging-insert en herhaalt dezelfde 409', async () => {
    state.simulateBatchInsertConflict = true

    await expect(stageFixture()).rejects.toMatchObject({ code: 'PAYROLL_IMPORT_BATCH_IN_PROGRESS', status: 409 })
    await expect(stageFixture()).rejects.toMatchObject({ code: 'PAYROLL_IMPORT_BATCH_IN_PROGRESS', status: 409 })

    expect(state.tables.payroll_import_batches).toHaveLength(1)
    expect(state.tables.payroll_import_persons).toHaveLength(0)
    expect(mocks.createAdminClient).toHaveBeenCalledOnce()
  })

  it('blokkeert een bestaande batch met ontbrekende inkomensrijen bij iedere idempotente lookup', async () => {
    const analysis = makeAnalysis({ status: 'NEW' }, { incomeCount: 2 })
    await stageFixture(analysis)
    state.tables.payroll_import_income_relationships.pop()

    const request = { analysis, taxYear: 2026, administrationId: 'admin-1' }
    await expect(stagePayrollImport(request)).rejects.toMatchObject({ code: 'PAYROLL_IMPORT_BATCH_IN_PROGRESS', status: 409 })
    await expect(stagePayrollImport(request)).rejects.toMatchObject({ code: 'PAYROLL_IMPORT_BATCH_IN_PROGRESS', status: 409 })
    expect(state.tables.payroll_import_batches).toHaveLength(1)
    expect(state.tables.payroll_import_persons).toHaveLength(1)
    expect(state.tables.payroll_import_income_relationships).toHaveLength(1)
  })

  it('blokkeert hergebruik van een idempotency-key met een andere bronperiode', async () => {
    await stageFixture()

    await expect(stagePayrollImport({ analysis: makeAnalysis(), taxYear: 2026, periodStart: '2026-01-01', administrationId: 'admin-1' }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_IDEMPOTENCY_CONFLICT', status: 409 })
    expect(state.tables.payroll_import_batches).toHaveLength(1)
    expect(state.tables.payroll_import_persons).toHaveLength(1)
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
    expect(state.tables.audit_logs.map((row) => row.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE'])
    expect(mocks.createEmployee).toHaveBeenCalledOnce()
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(2)
  })

  it('finaliseert geen legacy-inkomensrij uit een andere administratie', async () => {
    const batchId = await stageFixture(makeAnalysis({ status: 'NEW' }, { incomeCount: 1 }))
    const income = state.tables.payroll_import_income_relationships[0]
    if (!income) throw new Error('test fixture was not staged')
    income.administration_id = 'admin-2'

    await expect(finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_INCOME_INVALID', status: 422 })

    expect(state.tables.employees).toHaveLength(0)
    expect(state.tables.employments).toHaveLength(0)
    expect(state.tables.payroll_import_batches[0]?.status).toBe('STAGED')
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

  it('toont recovery voor een employment die alleen in een andere administratie staat', async () => {
    const batchId = await stageFixture(makeAnalysis({ status: 'EXACT', employeeId: 'employee-existing' }, { incomeCount: 1 }))
    linkExistingEmployee('employee-existing')
    const person = state.tables.payroll_import_persons[0]
    if (!person) throw new Error('test fixture was not staged')
    state.tables.employments.push({
      id: 'employment-other-administration',
      tenant_id: 'tenant-1',
      hr_group_id: 'group-1',
      administration_id: 'admin-2',
      payroll_import_person_id: person.id,
      record_status: 'DRAFT',
    })

    const recoverable = await listRecoverablePayrollImports('admin-1')

    expect(recoverable).toHaveLength(1)
    expect(recoverable[0]?.batchId).toBe(batchId)
    expect(recoverable[0]?.rows[0]).toMatchObject({ rowNumber: 1, missingEmployment: true, pendingIncomeCount: 0 })
  })

  it('kan na een complete domain-write een FAILED batchstatus veilig afronden', async () => {
    const batchId = await stageFixture(makeAnalysis({ status: 'EXACT', employeeId: 'employee-existing' }, { incomeCount: 1 }))
    linkExistingEmployee('employee-existing')
    const person = state.tables.payroll_import_persons[0]
    if (!person) throw new Error('test fixture was not staged')
    state.tables.employments.push({
      id: 'employment-existing',
      tenant_id: 'tenant-1',
      hr_group_id: 'group-1',
      administration_id: 'admin-1',
      payroll_import_person_id: person.id,
      employment_number: 'EMP-EXISTING',
      record_status: 'CONFIRMED',
    })

    const result = await finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] })

    expect(result.employeesImported).toBe(0)
    expect(result.employmentsCreated).toBe(0)
    expect(result.incomeRelationshipsImported).toBe(0)
    expect(state.tables.payroll_import_batches[0]?.status).toBe('COMPLETED')
  })

  it('toont een FAILED rij zonder employee-marker maar blokkeert een onveilige retry', async () => {
    const batchId = await stageFixture(makeAnalysis({ status: 'NEW' }, { incomeCount: 1 }))
    state.simulateEmployeeMarkerUpdateFailure = true

    await expect(finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_EMPLOYEE_CREATE_FAILED', status: 500 })
    expect(state.tables.employees).toHaveLength(1)
    expect(state.tables.payroll_import_persons[0]?.matched_employee_id).toBeNull()
    expect(state.tables.payroll_import_batches[0]?.status).toBe('FAILED')

    const recoverable = await listRecoverablePayrollImports('admin-1')
    expect(recoverable[0]?.rows[0]).toMatchObject({ rowNumber: 1, missingEmployment: true })

    await expect(finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE', status: 409 })
    expect(mocks.createEmployee).toHaveBeenCalledOnce()
    expect(state.tables.employees).toHaveLength(1)
  })

  it('laat een finalisatie zonder duurzame completion-audit niet als COMPLETED eindigen', async () => {
    const batchId = await stageFixture(makeAnalysis({ status: 'NEW' }, { incomeCount: 1 }))
    state.simulateCompletionAuditFailure = true

    await expect(finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_AUDIT_FAILED', status: 500 })

    expect(state.tables.payroll_import_batches[0]?.status).toBe('FAILED')
    expect(state.tables.audit_logs.map((row) => (row.changes as Record<string, unknown> | undefined)?.operation))
      .not.toContain('FINALIZE')
    expect(state.tables.audit_logs.map((row) => (row.changes as Record<string, unknown> | undefined)?.operation))
      .toContain('FINALIZE_FAILED')
  })

  it('blokkeert herstel van COMPLETED_WITH_WARNINGS zonder durable employee-marker', async () => {
    const batchId = await stageFixture(makeAnalysis({ status: 'NEW' }, { incomeCount: 1 }))
    const batch = state.tables.payroll_import_batches[0]
    if (!batch) throw new Error('test fixture was not staged')
    batch.status = 'COMPLETED_WITH_WARNINGS'

    await expect(finalizePayrollImport({ batchId, administrationId: 'admin-1', selectedRowNumbers: [1] }))
      .rejects.toMatchObject({ code: 'PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE', status: 409 })
    expect(mocks.createEmployee).not.toHaveBeenCalled()
    expect(state.tables.payroll_import_batches[0]?.status).toBe('COMPLETED_WITH_WARNINGS')
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
