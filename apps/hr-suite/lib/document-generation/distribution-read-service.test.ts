import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireHrGroupId: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: mocks.requirePermission,
  requireHrGroupId: mocks.requireHrGroupId,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { listDistributionHistory, listDistributionItems, listDistributionOptions } from './distribution-read-service'

interface QueryResult {
  readonly data: unknown
  readonly error: unknown
}

interface QueryTrace {
  readonly table: string
  readonly selected: string[]
  readonly filters: Array<readonly [string, unknown]>
}

type ReadQuery = Promise<QueryResult> & {
  select(columns?: string): ReadQuery
  eq(column: string, value: unknown): ReadQuery
  is(column: string, value: unknown): ReadQuery
  in(column: string, values: readonly string[]): ReadQuery
  order(column: string, options?: { ascending?: boolean }): ReadQuery
  limit(count: number): ReadQuery
  maybeSingle(): Promise<QueryResult>
}

const auth = { tenantId: 'tenant-a', hrGroupId: 'group-a', userId: 'user-a' }
let results: Record<string, QueryResult>
let traces: QueryTrace[]

function queryFor(table: string): ReadQuery {
  const trace: QueryTrace = { table, selected: [], filters: [] }
  traces.push(trace)
  const result = results[table] ?? { data: [], error: null }
  const query: ReadQuery = Object.assign(Promise.resolve(result), {
    select(columns?: string) { if (columns) trace.selected.push(columns); return query },
    eq(column: string, value: unknown) { trace.filters.push([column, value]); return query },
    is(column: string, value: unknown) { trace.filters.push([column, value]); return query },
    in(column: string, values: readonly string[]) { trace.filters.push([column, values]); return query },
    order(column: string, _options?: { ascending?: boolean }) { trace.filters.push(['order', column]); return query },
    limit(count: number) { trace.filters.push(['limit', count]); return query },
    maybeSingle() { return Promise.resolve(result) },
  })
  return query
}

function scoped(trace: QueryTrace): boolean {
  return trace.filters.some(([column, value]) => column === 'tenant_id' && value === auth.tenantId)
    && trace.filters.some(([column, value]) => column === 'hr_group_id' && value === auth.hrGroupId)
}

describe('Document distribution read service', () => {
  beforeEach(() => {
    results = {}
    traces = []
    mocks.requirePermission.mockReset().mockResolvedValue(auth)
    mocks.requireHrGroupId.mockReset().mockReturnValue(auth.hrGroupId)
    mocks.createClient.mockReset().mockResolvedValue({ from: (table: string) => queryFor(table) })
  })

  it('requires distribution read permission and scopes batch items and employee names', async () => {
    results = {
      document_generation_batch_items: { data: [{ id: 'item-a', employee_id: 'employee-a', snapshot_id: null, status: 'FINAL', error_code: null, created_at: '2026-01-01', completed_at: null }], error: null },
      employees: { data: [{ id: 'employee-a', first_name: 'Alex', birth_name: 'Example', employee_number: 'E-1' }], error: null },
    }

    const items = await listDistributionItems('batch-a')

    expect(mocks.requirePermission).toHaveBeenCalledWith('document-distribution:read')
    expect(mocks.requireHrGroupId).toHaveBeenCalledWith(auth)
    expect(traces).toHaveLength(2)
    expect(traces.every(scoped)).toBe(true)
    expect(traces[0].filters).toContainEqual(['batch_id', 'batch-a'])
    expect(items).toEqual([expect.objectContaining({ employee_name: 'Alex Example', employee_number: 'E-1' })])
  })

  it('keeps generation option reads behind write permission and tenant scope', async () => {
    results = {
      document_studio_templates: { data: [{ id: 'template-a', name: 'Contract', current_active_version_id: 'version-a' }], error: null },
      document_studio_template_versions: { data: { id: 'version-a', version_number: 3, status: 'ACTIVE' }, error: null },
      employees: { data: [{ id: 'employee-a', first_name: 'Alex', birth_name: 'Example', employee_number: 'E-1' }], error: null },
    }

    const options = await listDistributionOptions()

    expect(mocks.requirePermission).toHaveBeenCalledWith('document-generation:write')
    expect(traces).toHaveLength(3)
    expect(traces.every(scoped)).toBe(true)
    expect(options.templates).toEqual([{ id: 'template-a', name: 'Contract', versionId: 'version-a', version: 3 }])
    expect(options.employees).toEqual([{ id: 'employee-a', name: 'Alex Example', employeeNumber: 'E-1' }])
  })

  it('keeps history reads scoped and read-authorized', async () => {
    results = { document_generation_batches: { data: [{ id: 'batch-a', status: 'COMPLETED' }], error: null } }

    const history = await listDistributionHistory()

    expect(mocks.requirePermission).toHaveBeenCalledWith('document-distribution:read')
    expect(traces).toHaveLength(1)
    expect(scoped(traces[0])).toBe(true)
    expect(history).toEqual([{ id: 'batch-a', status: 'COMPLETED' }])
  })

  it('does not create a database client when permission resolution rejects', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('denied'))

    await expect(listDistributionItems('batch-a')).rejects.toThrow('denied')

    expect(mocks.createClient).not.toHaveBeenCalled()
  })
})
