import { describe, expect, it, vi } from 'vitest'
import type { PayrollAdministrationRow, PayrollDatabase } from './database'
import { createPayrollRepository, type PayrollSupabaseClient } from './repository'

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  hrGroupId: '22222222-2222-4222-8222-222222222222',
  administrationId: '33333333-3333-4333-8333-333333333333',
}

const row: PayrollAdministrationRow = {
  id: '55555555-5555-4555-8555-555555555555',
  source_tenant_id: scope.tenantId,
  source_hr_group_id: scope.hrGroupId,
  source_administration_id: scope.administrationId,
  display_name: 'Payroll Lab test administration',
  capability_enabled: true,
  status: 'ACTIVE',
  created_at: '2026-09-30T00:00:00.000Z',
  created_by_user_id: null,
  updated_at: '2026-09-30T00:00:00.000Z',
  updated_by_user_id: null,
}

function makeClient(initialRows: PayrollAdministrationRow[]) {
  const filters: Array<[string, string]> = []
  const tableRows = [...initialRows]
  let operation: 'select' | 'update' = 'select'
  let updateValues: PayrollDatabase['public']['Tables']['payroll_administrations']['Update'] = {}

  const query = {
    select: vi.fn(() => query),
    update: vi.fn((values: PayrollDatabase['public']['Tables']['payroll_administrations']['Update']) => {
      operation = 'update'
      updateValues = values
      return query
    }),
    eq: vi.fn((column: string, value: string) => {
      filters.push([column, value])
      return query
    }),
    maybeSingle: vi.fn(async () => {
      const matchingIndex = tableRows.findIndex((candidate) => filters.every(([column, value]) => candidate[column as keyof PayrollAdministrationRow] === value))
      if (matchingIndex < 0) return { data: null, error: null }
      if (operation === 'update') tableRows[matchingIndex] = { ...tableRows[matchingIndex], ...updateValues }
      return { data: tableRows[matchingIndex], error: null }
    }),
  }
  const client = { from: vi.fn(() => query) } as unknown as PayrollSupabaseClient
  return { client, query, filters, tableRows }
}

describe('scoped Payroll repository', () => {
  it('reads only a row matching tenant, HR group, and administration', async () => {
    const { client, filters } = makeClient([row])
    const repository = createPayrollRepository(client)

    await expect(repository.getPayrollAdministration(scope)).resolves.toEqual({
      id: row.id,
      displayName: row.display_name,
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    expect(filters).toEqual([
      ['source_tenant_id', scope.tenantId],
      ['source_hr_group_id', scope.hrGroupId],
      ['source_administration_id', scope.administrationId],
    ])
  })

  it.each([
    { ...scope, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { ...scope, hrGroupId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { ...scope, administrationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
  ])('does not read another scope even when the administration row exists', async (otherScope) => {
    const { client } = makeClient([row])
    const repository = createPayrollRepository(client)
    await expect(repository.getPayrollAdministration(otherScope)).resolves.toBeNull()
  })

  it('does not mutate a row from another scope', async () => {
    const { client, query, filters, tableRows } = makeClient([row])
    const repository = createPayrollRepository(client)
    const otherScope = { ...scope, administrationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }

    await expect(repository.setPayrollAdministrationCapability(otherScope, row.id, false, scope.tenantId)).resolves.toBeNull()
    expect(query.update).toHaveBeenCalledTimes(1)
    expect(filters).toContainEqual(['source_tenant_id', otherScope.tenantId])
    expect(filters).toContainEqual(['source_hr_group_id', otherScope.hrGroupId])
    expect(filters).toContainEqual(['source_administration_id', otherScope.administrationId])
    expect(tableRows[0].capability_enabled).toBe(true)
  })

  it('rejects a missing scope before touching the database', async () => {
    const { client } = makeClient([row])
    const repository = createPayrollRepository(client)
    await expect(repository.getPayrollAdministration({ ...scope, administrationId: '' })).rejects.toThrow()
    expect(client.from).not.toHaveBeenCalled()
  })
})
