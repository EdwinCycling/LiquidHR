import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { loadTeamAvailability } from './team-availability-service'

type Row = Record<string, unknown>
type Filter =
  | { kind: 'eq' | 'is' | 'lte' | 'gte'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'or'; expression: string }

interface QueryCall {
  relation: string
  selection: string | null
  filters: Filter[]
  limit: number | null
  rowsReturned: number | null
  responseBytes: number | null
}

interface QueryResult {
  data: Row[] | null
  error: Error | null
}

interface FakeDatabase {
  tables: Record<string, Row[]>
  calls: QueryCall[]
  failureRelation: string | null
  rpcError: boolean
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>
  rpcResponseBytes: number
  activeRpcs: number
  maxActiveRpcs: number
  directorySchedule: Row[]
}

class FakeQuery implements PromiseLike<QueryResult> {
  private readonly call: QueryCall

  constructor(relation: string, private readonly database: FakeDatabase) {
    this.call = { relation, selection: null, filters: [], limit: null, rowsReturned: null, responseBytes: null }
    database.calls.push(this.call)
  }

  select(selection: string): this {
    this.call.selection = selection
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

  gte(column: string, value: string): this {
    this.call.filters.push({ kind: 'gte', column, value })
    return this
  }

  or(expression: string): this {
    this.call.filters.push({ kind: 'or', expression })
    return this
  }

  order(): this {
    return this
  }

  limit(value: number): this {
    this.call.limit = value
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
      return { data: null, error: new Error('Synthetic database failure') }
    }

    let rows = (this.database.tables[this.call.relation] ?? []).filter((row) => this.call.filters.every((filter) => this.matches(row, filter)))
    if (this.call.limit !== null) rows = rows.slice(0, this.call.limit)
    this.call.rowsReturned = rows.length
    this.call.responseBytes = Buffer.byteLength(JSON.stringify(rows))
    return { data: rows, error: null }
  }

  private matches(row: Row, filter: Filter): boolean {
    if (filter.kind === 'or') {
      return filter.expression.split(',').some((part) => {
        const [column, operator, value] = part.split('.')
        if (operator === 'is' && value === 'null') return row[column] === null
        if (operator === 'gte') return typeof row[column] === 'string' && row[column] >= value
        if (operator === 'lte') return typeof row[column] === 'string' && row[column] <= value
        return false
      })
    }

    const value = row[filter.column]
    if (filter.kind === 'in') return filter.values.includes(value)
    if (filter.kind === 'eq' || filter.kind === 'is') return value === filter.value
    if (filter.kind === 'lte') return typeof value === 'string' && value <= String(filter.value)
    return typeof value === 'string' && value >= String(filter.value)
  }
}

function makeEmployee(id: string, firstName = id): Row {
  return { id, first_name: firstName, birth_name: null, avatar_url: null, tenant_id: 'tenant-a', is_archived: false, deleted_at: null }
}

function makeDatabase(input: {
  employees?: Row[]
  employments?: Row[]
  patterns?: Row[]
  schedules?: Row[]
  leaveRequests?: Row[]
  absenceCases?: Row[]
  absenceSpells?: Row[]
  failureRelation?: string | null
  rpcError?: boolean
  directorySchedule?: Row[]
} = {}): FakeDatabase {
  return {
    tables: {
      employees: input.employees ?? [],
      employments: input.employments ?? [],
      employment_work_patterns: input.patterns ?? [],
      employment_schedules: input.schedules ?? [],
      leave_requests: input.leaveRequests ?? [],
      absence_cases: input.absenceCases ?? [],
      absence_spells: input.absenceSpells ?? [],
    },
    calls: [],
    failureRelation: input.failureRelation ?? null,
    rpcError: input.rpcError ?? false,
    rpcCalls: [],
    rpcResponseBytes: 0,
    activeRpcs: 0,
    maxActiveRpcs: 0,
    directorySchedule: input.directorySchedule ?? [],
  }
}

function makeSupabase(database: FakeDatabase): Parameters<typeof loadTeamAvailability>[2] {
  return {
    from: (relation: string) => new FakeQuery(relation, database),
    rpc: (name: string, args: Record<string, unknown>) => {
      database.rpcCalls.push({ name, args })
      database.activeRpcs += 1
      database.maxActiveRpcs = Math.max(database.maxActiveRpcs, database.activeRpcs)
      const result = database.rpcError
        ? { data: null, error: new Error('Synthetic RPC failure') }
        : {
          data: { employeeId: args.requested_employee_id, schedule: database.directorySchedule, presence: [] },
          error: null,
        }
      database.rpcResponseBytes += Buffer.byteLength(JSON.stringify(result.data))
      return Promise.resolve().then(() => {
        database.activeRpcs -= 1
        return result
      })
    },
  } as unknown as Parameters<typeof loadTeamAvailability>[2]
}

function makeAuth(permissions: string[] = ['employee:read', 'employee-directory:read']): AuthContext {
  return { tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: 'admin-a', employeeId: null, permissions } as AuthContext
}

function weekdaysDirectorySchedule(): Row[] {
  return Array.from({ length: 7 }, (_, index) => {
    const isoWeekday = index + 1
    const isWorkingDay = isoWeekday <= 5
    return {
      weekIndex: 1,
      isoWeekday,
      isWorkingDay,
      startsAt: isWorkingDay ? '09:00' : null,
      endsAt: isWorkingDay ? '17:00' : null,
      scheduledMinutes: isWorkingDay ? 480 : 0,
    }
  })
}

describe('loadTeamAvailability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('preserves inclusive employment and pattern dates, weekdays, approved leave, and active sickness', async () => {
    const database = makeDatabase({
      employees: [makeEmployee('employee-a', 'Ada'), makeEmployee('out-of-scope')],
      employments: [{
        id: 'employment-a', employee_id: 'employee-a', tenant_id: 'tenant-a', administration_id: 'admin-a',
        starts_on: '2026-10-13', ends_on: '2026-10-17', is_primary: true, record_status: 'CONFIRMED', deleted_at: null,
      }],
      patterns: [{
        id: 'pattern-a', employee_id: 'employee-a', employment_id: 'employment-a', cycle_weeks: 1,
        anchor_date: '2026-10-12', valid_from: '2026-10-14', valid_until: '2026-10-15',
        employment_work_pattern_days: [
          { week_index: 1, iso_weekday: 3, is_working_day: true, starts_at: '09:00', ends_at: '14:00', break_minutes: 0, scheduled_minutes: 300, note: null },
          { week_index: 1, iso_weekday: 4, is_working_day: true, starts_at: '09:00', ends_at: '14:00', break_minutes: 0, scheduled_minutes: 300, note: null },
        ],
      }],
      leaveRequests: [{ tenant_id: 'tenant-a', administration_id: 'admin-a', employee_id: 'employee-a', status: 'APPROVED', start_date: '2026-10-15', end_date: '2026-10-15' }],
      absenceCases: [{ id: 'case-a', tenant_id: 'tenant-a', hr_group_id: 'group-a', employee_id: 'employee-a', status: 'ACTIVE', archived_at: null, first_absence_on: '2026-10-16' }],
      absenceSpells: [{ tenant_id: 'tenant-a', hr_group_id: 'group-a', case_id: 'case-a', started_on: '2026-10-16', recovered_on: null }],
    })

    const result = await loadTeamAvailability(makeAuth(), ['employee-a'], makeSupabase(database))

    expect(result.dates).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
    expect(result.members).toHaveLength(1)
    expect(result.members[0].employeeName).toBe('Ada')
    expect(result.members[0].cells).toEqual([
      { status: 'OFF', scheduledMinutes: 0 },
      { status: 'OFF', scheduledMinutes: 0 },
      { status: 'AVAILABLE', scheduledMinutes: 300 },
      { status: 'LEAVE', scheduledMinutes: 300 },
      { status: 'ABSENT', scheduledMinutes: 0 },
      { status: 'ABSENT', scheduledMinutes: 0 },
      { status: 'ABSENT', scheduledMinutes: 0 },
    ])
    expect(database.rpcCalls).toHaveLength(0)
    expect(database.calls.find((call) => call.relation === 'employees')?.filters).toContainEqual({ kind: 'in', column: 'id', values: ['employee-a'] })
  })

  it('uses the scoped directory schedule fallback for rosterless team members', async () => {
    const database = makeDatabase({
      employees: [makeEmployee('employee-a'), makeEmployee('employee-outside')],
      directorySchedule: weekdaysDirectorySchedule(),
    })

    const result = await loadTeamAvailability(makeAuth(), ['employee-a'], makeSupabase(database))

    expect(result.members).toHaveLength(1)
    expect(result.members[0].cells).toEqual([
      { status: 'AVAILABLE', scheduledMinutes: 480 },
      { status: 'AVAILABLE', scheduledMinutes: 480 },
      { status: 'AVAILABLE', scheduledMinutes: 480 },
      { status: 'AVAILABLE', scheduledMinutes: 480 },
      { status: 'AVAILABLE', scheduledMinutes: 480 },
      { status: 'OFF', scheduledMinutes: 0 },
      { status: 'OFF', scheduledMinutes: 0 },
    ])
    expect(database.rpcCalls).toEqual([{
      name: 'get_employee_directory_detail',
      args: {
        requested_tenant_id: 'tenant-a',
        requested_administration_id: 'admin-a',
        requested_employee_id: 'employee-a',
        requested_week_start: '2026-10-12',
      },
    }])
    expect(database.rpcResponseBytes).toBeGreaterThan(0)
  })

  it('does not call the directory RPC when its permissions are missing', async () => {
    const database = makeDatabase({ employees: [makeEmployee('employee-a')] })

    const result = await loadTeamAvailability(makeAuth([]), ['employee-a'], makeSupabase(database))

    expect(result.members[0].cells.every((cell) => cell.status === 'OFF')).toBe(true)
    expect(database.rpcCalls).toHaveLength(0)
  })

  it('keeps RPC fallback failures as an empty roster instead of failing the page', async () => {
    const database = makeDatabase({ employees: [makeEmployee('employee-a')], rpcError: true })

    const result = await loadTeamAvailability(makeAuth(), ['employee-a'], makeSupabase(database))

    expect(result.members).toHaveLength(1)
    expect(result.members[0].cells.every((cell) => cell.status === 'OFF')).toBe(true)
    expect(database.rpcCalls).toHaveLength(1)
  })

  it('returns the seven dates and no members without querying an empty team', async () => {
    const database = makeDatabase()

    const result = await loadTeamAvailability(makeAuth(), [], makeSupabase(database))

    expect(result).toEqual({
      dates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
      members: [],
    })
    expect(database.calls).toHaveLength(0)
  })

  it('returns the current empty error state when a scoped table query fails', async () => {
    const database = makeDatabase({ employees: [makeEmployee('employee-a')], failureRelation: 'absence_cases' })

    const result = await loadTeamAvailability(makeAuth(), ['employee-a'], makeSupabase(database))

    expect(result).toEqual({
      dates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
      members: [],
    })
    expect(database.rpcCalls).toHaveLength(0)
  })

  it('bounds concurrent directory RPCs for a larger team', async () => {
    const employeeCount = 17
    const database = makeDatabase({
      employees: Array.from({ length: employeeCount }, (_, index) => makeEmployee(`employee-${index}`)),
    })

    const result = await loadTeamAvailability(makeAuth(), Array.from({ length: employeeCount }, (_, index) => `employee-${index}`), makeSupabase(database))

    expect(result.members).toHaveLength(employeeCount)
    expect(database.rpcCalls).toHaveLength(employeeCount)
    expect(database.maxActiveRpcs).toBeLessThanOrEqual(8)
  })
})
