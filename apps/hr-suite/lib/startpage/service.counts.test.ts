import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@scope/db'
import { countEmployees, countRecurringAbsence } from './service'

type Row = Record<string, unknown>
type Filter =
  | { kind: 'eq' | 'neq' | 'is' | 'lte'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'or'; expression: string; referencedTable: string | null }

interface QueryCall {
  relation: string
  selection: string | null
  countExact: boolean
  head: boolean
  filters: Filter[]
  limit: number | null
  range: [number, number] | null
  rowsReturned: number | null
  responseBytes: number | null
}

interface QueryResult {
  data: Row[] | null
  count: number | null
  error: Error | null
}

interface EmployeeFixture extends Row {
  id: string
  tenant_id: string
  hr_group_id: string
  is_archived: boolean
  deleted_at: string | null
}

interface EmploymentFixture extends Row {
  employee_id: string
  tenant_id: string
  hr_group_id: string
  record_status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
  starts_on: string
  ends_on: string | null
  deleted_at: string | null
}

interface FakeDatabase {
  employees: EmployeeFixture[]
  employments: EmploymentFixture[]
  absenceCases: Row[]
  calls: QueryCall[]
  failureRelation: string | null
}

class FakeQuery implements PromiseLike<QueryResult> {
  private readonly call: QueryCall

  constructor(relation: string, private readonly database: FakeDatabase) {
    this.call = {
      relation,
      selection: null,
      countExact: false,
      head: false,
      filters: [],
      limit: null,
      range: null,
      rowsReturned: null,
      responseBytes: null,
    }
    database.calls.push(this.call)
  }

  select(selection: string, options?: { count?: string; head?: boolean }): this {
    this.call.selection = selection
    this.call.countExact = options?.count === 'exact'
    this.call.head = options?.head === true
    return this
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'eq', column, value })
    return this
  }

  neq(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'neq', column, value })
    return this
  }

  is(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'is', column, value })
    return this
  }

  in(column: string, values: readonly unknown[]): this {
    this.call.filters.push({ kind: 'in', column, values: [...values] })
    return this
  }

  lte(column: string, value: string): this {
    this.call.filters.push({ kind: 'lte', column, value })
    return this
  }

  or(expression: string, options?: { referencedTable?: string; foreignTable?: string }): this {
    this.call.filters.push({ kind: 'or', expression, referencedTable: options?.referencedTable ?? options?.foreignTable ?? null })
    return this
  }

  limit(value: number): this {
    this.call.limit = value
    return this
  }

  range(from: number, to: number): this {
    this.call.range = [from, to]
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }

  private execute(): QueryResult {
    if (this.database.failureRelation === this.call.relation) {
      this.call.rowsReturned = 0
      this.call.responseBytes = 0
      return { data: null, count: null, error: new Error('Synthetic database failure') }
    }

    const rows = this.call.relation === 'employees'
      ? this.employeeRows()
      : this.call.relation === 'absence_cases'
        ? this.database.absenceCases.filter((row) => this.call.filters.every((filter) => this.matches(row, filter)))
        : []
    const count = this.call.countExact ? rows.length : null

    if (this.call.head) {
      this.call.rowsReturned = 0
      this.call.responseBytes = 0
      return { data: null, count, error: null }
    }

    const limited = this.call.limit === null ? rows : rows.slice(0, this.call.limit)
    const columns = this.call.selection?.split(',').map((column) => column.trim()) ?? []
    const data = limited.map((row) => Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]])))
    this.call.rowsReturned = data.length
    this.call.responseBytes = Buffer.byteLength(JSON.stringify(data))
    return { data, count, error: null }
  }

  private employeeRows(): Row[] {
    const rootFilters = this.call.filters.filter((filter) => filter.kind === 'or'
      ? filter.referencedTable !== 'employments'
      : !filter.column.startsWith('employments.'))
    const employmentFilters = this.call.filters.filter((filter) => filter.kind === 'or'
      ? filter.referencedTable === 'employments'
      : filter.column.startsWith('employments.'))
    return this.database.employees.filter((employee) => {
      if (!rootFilters.every((filter) => this.matches(employee, filter))) return false
      return this.database.employments.some((employment) => employment.employee_id === employee.id
        && employmentFilters.every((filter) => this.matches(employment, this.withoutRelationPrefix(filter))))
    })
  }

  private withoutRelationPrefix(filter: Filter): Filter {
    if (!('column' in filter) || !filter.column.startsWith('employments.')) return filter
    return { ...filter, column: filter.column.slice('employments.'.length) }
  }

  private matches(row: Row, filter: Filter): boolean {
    if (filter.kind === 'or') {
      return filter.expression.split(',').some((part) => {
        const [column, operator, value] = part.split('.')
        if (operator === 'is' && value === 'null') return row[column] === null
        return operator === 'gte' && typeof row[column] === 'string' && row[column] >= value
      })
    }

    const value = row[filter.column]
    if (filter.kind === 'eq' || filter.kind === 'is') return value === filter.value
    if (filter.kind === 'neq') return value !== filter.value
    if (filter.kind === 'in') return filter.values.includes(value)
    return typeof value === 'string' && value <= String(filter.value)
  }
}

function makeEmployee(id: string, overrides: Partial<EmployeeFixture> = {}): EmployeeFixture {
  return { id, tenant_id: 'tenant-a', hr_group_id: 'group-a', is_archived: false, deleted_at: null, ...overrides }
}

function makeEmployment(employeeId: string, overrides: Partial<EmploymentFixture> = {}): EmploymentFixture {
  return {
    employee_id: employeeId,
    tenant_id: 'tenant-a',
    hr_group_id: 'group-a',
    record_status: 'CONFIRMED',
    starts_on: '2020-01-01',
    ends_on: null,
    deleted_at: null,
    ...overrides,
  }
}

function makeDatabase(employees: EmployeeFixture[], employments: EmploymentFixture[], failureRelation: string | null = null, absenceCases: Row[] = []): FakeDatabase {
  return { employees, employments, absenceCases, calls: [], failureRelation }
}

function makeAuth(permissions: string[] = ['employee:read']): Parameters<typeof countEmployees>[0] {
  return { tenantId: 'tenant-a', hrGroupId: 'group-a', permissions } as Parameters<typeof countEmployees>[0]
}

function makeSupabase(database: FakeDatabase): Parameters<typeof countEmployees>[2] {
  return { from: (relation: string) => new FakeQuery(relation, database) } as unknown as Parameters<typeof countEmployees>[2]
}

function makeAbsenceCase(id: string, employeeId: string, overrides: Row = {}): Row {
  return {
    id,
    employee_id: employeeId,
    tenant_id: 'tenant-a',
    hr_group_id: 'group-a',
    pending_confirmation: false,
    archived_at: null,
    ...overrides,
  }
}

function legacyLimitedCount(database: FakeDatabase, today: string, employeeScope: string[] | null): { count: number; rows: number; bytes: number } {
  const employees = database.employees.filter((employee) => employee.tenant_id === 'tenant-a'
    && employee.hr_group_id === 'group-a'
    && !employee.is_archived
    && employee.deleted_at === null
    && (employeeScope === null || employeeScope.includes(employee.id))).slice(0, 10_000)
  const employments = database.employments.filter((employment) => employment.tenant_id === 'tenant-a'
    && employment.hr_group_id === 'group-a'
    && employment.record_status !== 'CANCELLED'
    && employment.starts_on <= today
    && (employment.ends_on === null || employment.ends_on >= today)
    && employment.deleted_at === null
    && (employeeScope === null || employeeScope.includes(employment.employee_id))).slice(0, 10_000)
  const employeeIds = new Set(employees.map((employee) => employee.id))
  const activeEmployeeIds = new Set(employments.map((employment) => employment.employee_id).filter((id) => employeeIds.has(id)))
  const employeePayload = employees.map(({ id }) => ({ id }))
  const employmentPayload = employments.map(({ employee_id }) => ({ employee_id }))
  return {
    count: activeEmployeeIds.size,
    rows: employees.length + employments.length,
    bytes: Buffer.byteLength(JSON.stringify(employeePayload)) + Buffer.byteLength(JSON.stringify(employmentPayload)),
  }
}

describe('countEmployees', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses an exact company-scope count and counts employees with multiple active employments once', async () => {
    const employees = [
      makeEmployee('employee-a'),
      makeEmployee('employee-b'),
      makeEmployee('future-only'),
      makeEmployee('ended-only'),
      makeEmployee('cancelled-only'),
      makeEmployee('archived', { is_archived: true }),
      makeEmployee('deleted', { deleted_at: '2026-01-01' }),
      makeEmployee('other-tenant', { tenant_id: 'tenant-b' }),
      makeEmployee('other-group', { hr_group_id: 'group-b' }),
    ]
    const employments = [
      makeEmployment('employee-a'),
      makeEmployment('employee-a', { starts_on: '2025-01-01' }),
      makeEmployment('employee-b'),
      makeEmployment('future-only', { starts_on: '2026-10-13' }),
      makeEmployment('ended-only', { ends_on: '2026-10-11' }),
      makeEmployment('cancelled-only', { record_status: 'CANCELLED' }),
      makeEmployment('archived'),
      makeEmployment('deleted', { deleted_at: '2026-01-01' }),
      makeEmployment('other-tenant', { tenant_id: 'tenant-b' }),
      makeEmployment('other-group', { hr_group_id: 'group-b' }),
    ]
    const database = makeDatabase(employees, employments)

    const result = await countEmployees(makeAuth(), null, makeSupabase(database))

    expect(result).toBe(2)
    expect(database.calls).toHaveLength(1)
    const query = database.calls[0]
    expect(query.relation).toBe('employees')
    expect(query.selection).toContain('employments!employments_employee_hr_group_fkey!inner')
    expect(query.countExact).toBe(true)
    expect(query.head).toBe(true)
    expect(query.limit).toBeNull()
    expect(query.range).toBeNull()
    expect(query.rowsReturned).toBe(0)
    expect(query.responseBytes).toBe(0)
    expect(query.filters).toContainEqual({ kind: 'eq', column: 'tenant_id', value: 'tenant-a' })
    expect(query.filters).toContainEqual({ kind: 'eq', column: 'hr_group_id', value: 'group-a' })
    expect(query.filters).toContainEqual({ kind: 'eq', column: 'is_archived', value: false })
    expect(query.filters).toContainEqual({ kind: 'is', column: 'deleted_at', value: null })
    expect(query.filters).toContainEqual({ kind: 'eq', column: 'employments.tenant_id', value: 'tenant-a' })
    expect(query.filters).toContainEqual({ kind: 'eq', column: 'employments.hr_group_id', value: 'group-a' })
    expect(query.filters).toContainEqual({ kind: 'neq', column: 'employments.record_status', value: 'CANCELLED' })
    expect(query.filters).toContainEqual({ kind: 'lte', column: 'employments.starts_on', value: '2026-10-12' })
    expect(query.filters).toContainEqual({ kind: 'is', column: 'employments.deleted_at', value: null })
    expect(query.filters).toContainEqual(expect.objectContaining({ kind: 'or', expression: 'ends_on.is.null,ends_on.gte.2026-10-12', referencedTable: 'employments' }))
  })

  it('sends the exact headcount as one HEAD request with parent scope and embedded employment filters', async () => {
    const requests: Request[] = []
    const client = createSupabaseClient<Database>('https://synthetic.supabase.co', 'synthetic-key', {
      global: {
        fetch: async (input, init) => {
          requests.push(new Request(input, init))
          return new Response(null, { status: 200, headers: { 'content-range': '*/10001' } })
        },
      },
    })

    const result = await countEmployees(makeAuth(), null, client as unknown as Parameters<typeof countEmployees>[2])

    expect(result).toBe(10_001)
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('HEAD')
    const url = new URL(requests[0].url)
    expect(url.pathname).toBe('/rest/v1/employees')
    expect(url.searchParams.get('select')).toBe('id,employments!employments_employee_hr_group_fkey!inner(id)')
    expect(url.searchParams.get('tenant_id')).toBe('eq.tenant-a')
    expect(url.searchParams.get('hr_group_id')).toBe('eq.group-a')
    expect(url.searchParams.get('employments.record_status')).toBe('neq.CANCELLED')
    expect(url.searchParams.get('employments.starts_on')).toBe('lte.2026-10-12')
    expect(url.searchParams.get('employments.or')).toBe('(ends_on.is.null,ends_on.gte.2026-10-12)')
  })

  it('keeps manager team filters while company scope remains HR-group-wide', async () => {
    const employees = [makeEmployee('employee-a'), makeEmployee('employee-b'), makeEmployee('employee-c')]
    const employments = [makeEmployment('employee-a'), makeEmployment('employee-b'), makeEmployment('employee-c', { starts_on: '2026-10-13' })]
    const companyDatabase = makeDatabase(employees, employments)
    const companyResult = await countEmployees(makeAuth(), null, makeSupabase(companyDatabase))

    const teamDatabase = makeDatabase(employees, employments)
    const teamResult = await countEmployees(makeAuth(), ['employee-b', 'employee-c'], makeSupabase(teamDatabase))

    expect(companyResult).toBe(2)
    expect(companyDatabase.calls[0].filters).not.toContainEqual(expect.objectContaining({ kind: 'in', column: 'id' }))
    expect(teamResult).toBe(1)
    expect(teamDatabase.calls[0].filters).toContainEqual({ kind: 'in', column: 'id', values: ['employee-b', 'employee-c'] })
  })

  it('does not query without permission or for an empty team scope', async () => {
    const deniedDatabase = makeDatabase([makeEmployee('employee-a')], [makeEmployment('employee-a')])
    const denied = await countEmployees(makeAuth([]), null, makeSupabase(deniedDatabase))

    const emptyTeamDatabase = makeDatabase([makeEmployee('employee-a')], [makeEmployment('employee-a')])
    const emptyTeam = await countEmployees(makeAuth(), [], makeSupabase(emptyTeamDatabase))

    expect(denied).toBeNull()
    expect(deniedDatabase.calls).toHaveLength(0)
    expect(emptyTeam).toBe(0)
    expect(emptyTeamDatabase.calls).toHaveLength(0)
  })

  it('returns null when the scoped aggregate request fails', async () => {
    const database = makeDatabase([makeEmployee('employee-a')], [makeEmployment('employee-a')], 'employees')

    const result = await countEmployees(makeAuth(), null, makeSupabase(database))

    expect(result).toBeNull()
    expect(database.calls).toHaveLength(1)
  })

  it('counts more than 10,000 unique employees without transporting employment rows', async () => {
    const employees = Array.from({ length: 10_001 }, (_, index) => makeEmployee(`employee-${String(index).padStart(5, '0')}`))
    const employments = employees.flatMap((employee) => [makeEmployment(employee.id), makeEmployment(employee.id, { starts_on: '2025-01-01' })])
    const database = makeDatabase(employees, employments)
    const legacy = legacyLimitedCount(database, '2026-10-12', null)

    const result = await countEmployees(makeAuth(), null, makeSupabase(database))

    expect(legacy.count).toBe(5_000)
    expect(legacy.rows).toBe(20_000)
    expect(legacy.bytes).toBeGreaterThan(0)
    expect(result).toBe(10_001)
    expect(database.calls).toHaveLength(1)
    expect(database.calls[0].rowsReturned).toBe(0)
    expect(database.calls[0].responseBytes).toBe(0)
    expect(database.calls[0].limit).toBeNull()
  })

  it('counts distinct recurring employees within company or manager-team scope', async () => {
    const cases = [
      makeAbsenceCase('a-1', 'employee-a'),
      makeAbsenceCase('a-2', 'employee-a'),
      makeAbsenceCase('b-1', 'employee-b'),
      makeAbsenceCase('b-pending', 'employee-b', { pending_confirmation: true }),
      makeAbsenceCase('c-1', 'employee-c'),
      makeAbsenceCase('c-archived', 'employee-c', { archived_at: '2026-01-01' }),
      makeAbsenceCase('other-tenant-1', 'employee-d', { tenant_id: 'tenant-b' }),
      makeAbsenceCase('other-tenant-2', 'employee-d', { tenant_id: 'tenant-b' }),
      makeAbsenceCase('other-group-1', 'employee-e', { hr_group_id: 'group-b' }),
      makeAbsenceCase('other-group-2', 'employee-e', { hr_group_id: 'group-b' }),
    ]
    const companyDatabase = makeDatabase([], [], null, cases)

    const companyResult = await countRecurringAbsence(makeAuth(['absence:read']), null, makeSupabase(companyDatabase))

    expect(companyResult).toBe(1)
    expect(companyDatabase.calls).toHaveLength(1)
    const companyQuery = companyDatabase.calls[0]
    expect(companyQuery.relation).toBe('absence_cases')
    expect(companyQuery.selection).toBe('employee_id')
    expect(companyQuery.countExact).toBe(true)
    expect(companyQuery.filters).toContainEqual({ kind: 'eq', column: 'tenant_id', value: 'tenant-a' })
    expect(companyQuery.filters).toContainEqual({ kind: 'eq', column: 'hr_group_id', value: 'group-a' })
    expect(companyQuery.filters).toContainEqual({ kind: 'eq', column: 'pending_confirmation', value: false })
    expect(companyQuery.filters).toContainEqual({ kind: 'is', column: 'archived_at', value: null })
    expect(companyQuery.filters).not.toContainEqual(expect.objectContaining({ kind: 'in', column: 'employee_id' }))

    const teamDatabase = makeDatabase([], [], null, cases)
    const teamResult = await countRecurringAbsence(makeAuth(['absence:read']), ['employee-b', 'employee-c'], makeSupabase(teamDatabase))

    expect(teamResult).toBe(0)
    expect(teamDatabase.calls[0].filters).toContainEqual({ kind: 'in', column: 'employee_id', values: ['employee-b', 'employee-c'] })
  })

  it('does not query recurring absence without permission or for an empty team scope', async () => {
    const deniedDatabase = makeDatabase([], [], null, [makeAbsenceCase('case-a', 'employee-a')])
    const denied = await countRecurringAbsence(makeAuth([]), null, makeSupabase(deniedDatabase))

    const emptyTeamDatabase = makeDatabase([], [], null, [makeAbsenceCase('case-a', 'employee-a')])
    const emptyTeam = await countRecurringAbsence(makeAuth(['absence:read']), [], makeSupabase(emptyTeamDatabase))

    expect(denied).toBeNull()
    expect(deniedDatabase.calls).toHaveLength(0)
    expect(emptyTeam).toBe(0)
    expect(emptyTeamDatabase.calls).toHaveLength(0)
  })

  it('returns null if an exact recurring-absence count cannot be read', async () => {
    const database = makeDatabase([], [], 'absence_cases', [makeAbsenceCase('case-a', 'employee-a')])

    const result = await countRecurringAbsence(makeAuth(['absence:read']), null, makeSupabase(database))

    expect(result).toBeNull()
    expect(database.calls).toHaveLength(1)
  })

  it('does not present an exact recurring count when the 10,000-row result is truncated', async () => {
    const cases = [makeAbsenceCase('case-first', 'employee-repeat')]
    for (let index = 0; index < 9_999; index += 1) cases.push(makeAbsenceCase(`case-${index}`, `employee-${index}`))
    cases.push(makeAbsenceCase('case-last', 'employee-repeat'))
    const database = makeDatabase([], [], null, cases)
    const legacyEmployeeCounts = new Map<string, number>()
    for (const absenceCase of cases.slice(0, 10_000)) {
      const employeeId = String(absenceCase.employee_id)
      legacyEmployeeCounts.set(employeeId, (legacyEmployeeCounts.get(employeeId) ?? 0) + 1)
    }

    const result = await countRecurringAbsence(makeAuth(['absence:read']), null, makeSupabase(database))

    expect([...legacyEmployeeCounts.values()].filter((count) => count > 1)).toHaveLength(0)
    expect(result).toBeNull()
    expect(database.calls).toHaveLength(1)
    expect(database.calls[0].countExact).toBe(true)
    expect(database.calls[0].limit).toBe(10_000)
    expect(database.calls[0].rowsReturned).toBe(10_000)
    expect(database.calls[0].responseBytes).toBeGreaterThan(0)
  })
})
