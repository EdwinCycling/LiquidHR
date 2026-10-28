import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createClient: vi.fn(),
  individual: vi.fn(),
}))
vi.mock('@/lib/auth/permissions', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/employment/employment-service', () => ({ listEmployeeEmployments: mocks.individual }))

import { listPayrollEmploymentDirectories } from './payroll-employment-directory'

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '20000000-0000-4000-8000-000000000002',
  administrationId: '30000000-0000-4000-8000-000000000003',
}
const employeeA = '40000000-0000-4000-8000-000000000004'
const employeeB = '40000000-0000-4000-8000-000000000005'
const employeeDenied = '40000000-0000-4000-8000-000000000006'

function fakeClient(rows: readonly Record<string, unknown>[], count = rows.length) {
  const filters: Array<[string, unknown]> = []
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query }),
    in: vi.fn((column: string, value: readonly string[]) => { filters.push([column, value]); return query }),
    is: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query }),
    order: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: rows, count, error: null }).then(resolve, reject),
  }
  return { from: vi.fn(() => query), filters }
}

describe('Payroll employment directory batch', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('authorizes every employee and batches only permitted IDs within the original tenant and HR-group scope', async () => {
    mocks.requirePermission.mockImplementation(async (_permission: string, id: string) => {
      if (id === employeeDenied) throw new Error('denied')
      return scope
    })
    const rowA = { tenant_id: scope.tenantId, hr_group_id: scope.hrGroupId, employee_id: employeeA, deleted_at: null, id: 'a' }
    const rowB = { tenant_id: scope.tenantId, hr_group_id: scope.hrGroupId, employee_id: employeeB, deleted_at: null, id: 'b' }
    const client = fakeClient([rowA, rowB])
    mocks.createClient.mockResolvedValue(client)

    const result = await listPayrollEmploymentDirectories([employeeA, employeeB, employeeDenied], scope)

    expect(result).toEqual([
      { status: 'fulfilled', value: [rowA] },
      { status: 'fulfilled', value: [rowB] },
      expect.objectContaining({ status: 'rejected' }),
    ])
    expect(mocks.requirePermission).toHaveBeenCalledTimes(3)
    expect(client.from).toHaveBeenCalledOnce()
    expect(client.filters).toEqual(expect.arrayContaining([
      ['tenant_id', scope.tenantId], ['hr_group_id', scope.hrGroupId], ['employee_id', [employeeA, employeeB]], ['deleted_at', null],
    ]))
    expect(mocks.individual).not.toHaveBeenCalled()
  })

  it('falls back to the existing individual reader if a batch is incomplete', async () => {
    mocks.requirePermission.mockResolvedValue(scope)
    const rowA = { tenant_id: scope.tenantId, hr_group_id: scope.hrGroupId, employee_id: employeeA, deleted_at: null, id: 'a' }
    const client = fakeClient([rowA], 2)
    mocks.createClient.mockResolvedValue(client)
    mocks.individual.mockImplementation(async (id: string) => [{ employee_id: id }])

    const result = await listPayrollEmploymentDirectories([employeeA, employeeB], scope)

    expect(result).toEqual([
      { status: 'fulfilled', value: [{ employee_id: employeeA }] },
      { status: 'fulfilled', value: [{ employee_id: employeeB }] },
    ])
    expect(mocks.individual).toHaveBeenCalledTimes(2)
  })

  it('does not query a mismatched authorization scope', async () => {
    mocks.requirePermission.mockResolvedValue({ ...scope, administrationId: '30000000-0000-4000-8000-000000000099' })
    const result = await listPayrollEmploymentDirectories([employeeA], scope)
    expect(result[0]?.status).toBe('rejected')
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
})
