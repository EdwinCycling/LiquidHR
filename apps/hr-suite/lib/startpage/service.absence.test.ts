import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listActiveAbsences } from './service'

const MILLISECONDS_PER_DAY = 86_400_000

type Row = Record<string, unknown>
type AbsenceStatus = 'ACTIVE' | 'RECOVERY_WINDOW' | 'CLOSED'

interface AbsenceCaseFixture extends Row {
  id: string
  employee_id: string
  first_absence_on: string
  status: AbsenceStatus
  tenant_id: string
  hr_group_id: string
  archived_at: string | null
}

interface EmployeeFixture extends Row {
  id: string
  first_name: string
  birth_name: string | null
  avatar_url: string | null
  tenant_id: string
}

type Filter =
  | { kind: 'eq' | 'is'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'lte'; column: string; value: string }

interface QueryCall {
  relation: string
  selection: string | null
  countExact: boolean
  head: boolean
  filters: Filter[]
  orderBy: { column: string; ascending: boolean } | null
  limit: number | null
  rowsReturned: number | null
  responseBytes: number | null
}

interface QueryResult {
  data: Row[] | null
  count: number | null
  error: Error | null
}

interface FakeDatabase {
  cases: AbsenceCaseFixture[]
  employees: EmployeeFixture[]
  calls: QueryCall[]
  failure: { relation: string; head?: boolean } | null
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
      orderBy: null,
      limit: null,
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

  in(column: string, values: readonly unknown[]): this {
    this.call.filters.push({ kind: 'in', column, values: [...values] })
    return this
  }

  is(column: string, value: unknown): this {
    this.call.filters.push({ kind: 'is', column, value })
    return this
  }

  lte(column: string, value: string): this {
    this.call.filters.push({ kind: 'lte', column, value })
    return this
  }

  order(column: string, options: { ascending: boolean }): this {
    this.call.orderBy = { column, ascending: options.ascending }
    return this
  }

  limit(limit: number): this {
    this.call.limit = limit
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }

  private execute(): QueryResult {
    const failure = this.database.failure
    if (failure?.relation === this.call.relation && (failure.head === undefined || failure.head === this.call.head)) {
      this.call.rowsReturned = 0
      this.call.responseBytes = 0
      return { data: null, count: null, error: new Error('Synthetic database failure') }
    }

    let rows: Row[] = this.call.relation === 'absence_cases'
      ? this.database.cases
      : this.call.relation === 'employees'
        ? this.database.employees
        : []
    rows = rows.filter((row) => this.call.filters.every((filter) => this.matches(row, filter)))
    const count = this.call.countExact ? rows.length : null

    if (this.call.head) {
      this.call.rowsReturned = 0
      this.call.responseBytes = 0
      return { data: null, count, error: null }
    }

    if (this.call.orderBy) {
      const { column, ascending } = this.call.orderBy
      rows = [...rows].sort((left, right) => {
        const comparison = String(left[column]).localeCompare(String(right[column]))
        return ascending ? comparison : -comparison
      })
    }
    if (this.call.limit !== null) rows = rows.slice(0, this.call.limit)

    const columns = this.call.selection?.split(',').map((column) => column.trim()) ?? []
    const data = rows.map((row) => Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]])))
    this.call.rowsReturned = data.length
    this.call.responseBytes = Buffer.byteLength(JSON.stringify(data))
    return { data, count, error: null }
  }

  private matches(row: Row, filter: Filter): boolean {
    const value = row[filter.column]
    if (filter.kind === 'lte') return typeof value === 'string' && value <= filter.value
    if (filter.kind === 'in') return filter.values.includes(value)
    return value === filter.value
  }
}

function makeCase(id: string, employeeId: string, days: number, overrides: Partial<AbsenceCaseFixture> = {}): AbsenceCaseFixture {
  return {
    id,
    employee_id: employeeId,
    first_absence_on: firstAbsenceDateForDayCount(days),
    status: 'ACTIVE',
    tenant_id: 'tenant-a',
    hr_group_id: 'group-a',
    archived_at: null,
    ...overrides,
  }
}

function firstAbsenceDateForDayCount(days: number): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let elapsedDays = Math.max(0, days - 3); elapsedDays <= days + 3; elapsedDays += 1) {
    const candidate = new Date(today.getTime() - elapsedDays * MILLISECONDS_PER_DAY).toISOString().slice(0, 10)
    const firstDate = new Date(`${candidate}T00:00:00Z`)
    const calculatedDays = Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / MILLISECONDS_PER_DAY) + 1)
    if (calculatedDays === days) return candidate
  }
  throw new Error(`No date fixture found for absence day ${days}`)
}

function makeDatabase(cases: AbsenceCaseFixture[], failure: FakeDatabase['failure'] = null): FakeDatabase {
  const employeeIds = [...new Set(cases.map((absenceCase) => absenceCase.employee_id))]
  return {
    cases,
    employees: employeeIds.map((id) => ({ id, first_name: `Voornaam ${id}`, birth_name: null, avatar_url: null, tenant_id: 'tenant-a' })),
    calls: [],
    failure,
  }
}

function makeAuth(permissions: string[] = ['absence:read']): Parameters<typeof listActiveAbsences>[0] {
  return {
    tenantId: 'tenant-a',
    hrGroupId: 'group-a',
    permissions,
  } as Parameters<typeof listActiveAbsences>[0]
}

function makeSupabase(database: FakeDatabase): Parameters<typeof listActiveAbsences>[2] {
  return { from: (relation: string) => new FakeQuery(relation, database) } as unknown as Parameters<typeof listActiveAbsences>[2]
}

function absenceQueries(database: FakeDatabase): QueryCall[] {
  return database.calls.filter((call) => call.relation === 'absence_cases')
}

describe('listActiveAbsences', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([0, 5, 9])('counts %i active cases while transporting at most five', async (caseCount) => {
    const cases = Array.from({ length: caseCount }, (_, index) => makeCase(`case-${index}`, `employee-${index}`, index + 1))
    const database = makeDatabase(cases)

    const result = await listActiveAbsences(makeAuth(), null, makeSupabase(database))

    expect(result.total).toBe(caseCount)
    expect(result.items).toHaveLength(Math.min(caseCount, 5))
    expect(result.longTermCount).toBe(0)
    const [listQuery, countQuery] = absenceQueries(database)
    expect(listQuery?.limit).toBe(5)
    expect(listQuery?.rowsReturned).toBe(Math.min(caseCount, 5))
    expect(countQuery?.head).toBe(true)
    expect(countQuery?.rowsReturned).toBe(0)
    expect(countQuery?.responseBytes).toBe(0)
  })

  it('keeps exact counts beyond the former 10,000-case cap with a five-row response', async () => {
    const cases: AbsenceCaseFixture[] = Array.from({ length: 10_025 }, (_, index) => ({
      id: `case-${String(index).padStart(5, '0')}`,
      employee_id: 'employee-a',
      first_absence_on: '2026-07-01',
      status: 'ACTIVE',
      tenant_id: 'tenant-a',
      hr_group_id: 'group-a',
      archived_at: null,
    }))
    const database = makeDatabase(cases)

    const result = await listActiveAbsences(makeAuth(), null, makeSupabase(database))

    expect(result.total).toBe(10_025)
    expect(result.longTermCount).toBe(10_025)
    expect(result.items).toHaveLength(5)
    const listQuery = absenceQueries(database).find((query) => !query.head)
    expect(listQuery?.limit).toBe(5)
    expect(listQuery?.rowsReturned).toBe(5)
    const oldResponseBytes = Buffer.byteLength(JSON.stringify(cases.slice(0, 10_000).map((item) => ({
      id: item.id,
      employee_id: item.employee_id,
      first_absence_on: item.first_absence_on,
      status: item.status,
    }))))
    expect(listQuery?.responseBytes).toBeLessThan(oldResponseBytes)
  })

  it('counts day 14 and later using the existing local-midnight day calculation', async () => {
    const cases = [
      makeCase('case-day-13', 'employee-13', 13),
      makeCase('case-day-14', 'employee-14', 14),
      makeCase('case-day-15', 'employee-15', 15),
    ]
    const database = makeDatabase(cases)

    const result = await listActiveAbsences(makeAuth(), null, makeSupabase(database))

    expect(result.items.map((item) => [item.caseId, item.days])).toEqual([
      ['case-day-13', 13],
      ['case-day-14', 14],
      ['case-day-15', 15],
    ])
    expect(result.longTermCount).toBe(2)
    const countQuery = absenceQueries(database).find((query) => query.head)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expectedCutoff = new Date(today.getTime() - 13 * MILLISECONDS_PER_DAY).toISOString().slice(0, 10)
    expect(countQuery?.filters).toContainEqual({ kind: 'lte', column: 'first_absence_on', value: expectedCutoff })
  })

  it('preserves company and team scopes plus active and archive filters', async () => {
    const cases = [
      makeCase('team-a-long', 'employee-a', 15),
      makeCase('team-b-long', 'employee-b', 14, { status: 'RECOVERY_WINDOW' }),
      makeCase('company-c-short', 'employee-c', 13),
      makeCase('team-a-short', 'employee-a', 5),
      makeCase('closed', 'employee-a', 20, { status: 'CLOSED' }),
      makeCase('archived', 'employee-b', 20, { archived_at: '2026-01-01' }),
      makeCase('other-tenant', 'employee-a', 20, { tenant_id: 'tenant-b' }),
      makeCase('other-group', 'employee-b', 20, { hr_group_id: 'group-b' }),
    ]
    const companyDatabase = makeDatabase(cases)
    const company = await listActiveAbsences(makeAuth(), null, makeSupabase(companyDatabase))

    expect(company.total).toBe(4)
    expect(company.longTermCount).toBe(2)
    for (const query of absenceQueries(companyDatabase)) {
      expect(query.filters).not.toContainEqual(expect.objectContaining({ column: 'employee_id' }))
      expect(query.filters).toContainEqual({ kind: 'eq', column: 'tenant_id', value: 'tenant-a' })
      expect(query.filters).toContainEqual({ kind: 'eq', column: 'hr_group_id', value: 'group-a' })
      expect(query.filters).toContainEqual({ kind: 'in', column: 'status', values: ['ACTIVE', 'RECOVERY_WINDOW'] })
      expect(query.filters).toContainEqual({ kind: 'is', column: 'archived_at', value: null })
    }

    const teamDatabase = makeDatabase(cases)
    const team = await listActiveAbsences(makeAuth(), ['employee-a', 'employee-b'], makeSupabase(teamDatabase))

    expect(team.total).toBe(3)
    expect(team.longTermCount).toBe(2)
    for (const query of absenceQueries(teamDatabase)) {
      expect(query.filters).toContainEqual({ kind: 'in', column: 'employee_id', values: ['employee-a', 'employee-b'] })
    }
  })

  it('does not query when permission or an empty team scope is missing', async () => {
    const withoutPermission = makeDatabase([makeCase('case-1', 'employee-a', 15)])
    const denied = await listActiveAbsences(makeAuth([]), null, makeSupabase(withoutPermission))

    expect(denied).toEqual({ items: [], total: 0, longTermCount: 0 })
    expect(withoutPermission.calls).toHaveLength(0)

    const emptyTeam = makeDatabase([makeCase('case-1', 'employee-a', 15)])
    const empty = await listActiveAbsences(makeAuth(), [], makeSupabase(emptyTeam))

    expect(empty).toEqual({ items: [], total: 0, longTermCount: 0 })
    expect(emptyTeam.calls).toHaveLength(0)
  })

  it('returns the existing empty error state when an absence query fails', async () => {
    const database = makeDatabase([makeCase('case-1', 'employee-a', 15)], { relation: 'absence_cases' })

    const result = await listActiveAbsences(makeAuth(), null, makeSupabase(database))

    expect(result).toEqual({ items: [], total: 0, longTermCount: 0 })
    expect(database.calls).toHaveLength(2)
  })

  it('keeps exact counts and hides display items when supplemental data fails', async () => {
    const cases = [makeCase('case-1', 'employee-a', 15)]
    const database = makeDatabase(cases, { relation: 'absence_spells' })

    const result = await listActiveAbsences(makeAuth(), null, makeSupabase(database))

    expect(result).toEqual({ items: [], total: 1, longTermCount: 1 })
  })
})
