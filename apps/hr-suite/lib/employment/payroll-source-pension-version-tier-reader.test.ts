import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('react', () => ({
  cache: <TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) => {
    const values = new Map<string, TResult>()
    return (...args: TArgs): TResult => {
      const key = JSON.stringify(args)
      const cached = values.get(key)
      if (cached !== undefined) return cached
      const result = fn(...args)
      values.set(key, result)
      return result
    }
  },
}))

import { readPayrollSourcePensionVersionTiers } from './payroll-source-pension-version-tier-reader'

function createTierQuery(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(() => Promise.resolve(result)),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  return query
}

describe('Payroll source pension-version tier reader', () => {
  beforeEach(() => createClient.mockReset())

  it('reuses only an identical scoped version-tier read within the request', async () => {
    const firstResult = { data: [{ id: 'tier-a', pension_arrangement_version_id: 'version-a' }], error: null }
    const firstQuery = createTierQuery(firstResult)
    const secondQuery = createTierQuery({ data: [], error: null })
    const from = vi.fn()
      .mockReturnValueOnce(firstQuery)
      .mockReturnValueOnce(secondQuery)
      .mockReturnValueOnce(createTierQuery({ data: [], error: null }))
    createClient.mockResolvedValue({ from })

    const first = readPayrollSourcePensionVersionTiers('tenant-a', 'group-a', 'admin-a', 'version-a,version-b')
    const duplicate = readPayrollSourcePensionVersionTiers('tenant-a', 'group-a', 'admin-a', 'version-a,version-b')
    const [firstRead, duplicateRead] = await Promise.all([first, duplicate])

    expect(duplicateRead).toBe(firstResult)
    expect(firstRead).toBe(firstResult)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenNthCalledWith(1, 'pension_arrangement_version_tiers')
    expect(firstQuery.select).toHaveBeenCalledWith('id, tenant_id, hr_group_id, administration_id, pension_arrangement_id, pension_arrangement_version_id, min_age, max_age, total_rate, created_at')
    expect(firstQuery.eq).toHaveBeenNthCalledWith(1, 'tenant_id', 'tenant-a')
    expect(firstQuery.eq).toHaveBeenNthCalledWith(2, 'hr_group_id', 'group-a')
    expect(firstQuery.eq).toHaveBeenNthCalledWith(3, 'administration_id', 'admin-a')
    expect(firstQuery.in).toHaveBeenCalledWith('pension_arrangement_version_id', ['version-a', 'version-b'])
    expect(firstQuery.order).toHaveBeenCalledWith('min_age')

    await readPayrollSourcePensionVersionTiers('tenant-a', 'group-a', 'admin-b', 'version-a,version-b')
    await readPayrollSourcePensionVersionTiers('tenant-a', 'group-a', 'admin-a', 'version-c')
    expect(createClient).toHaveBeenCalledTimes(3)
    expect(from).toHaveBeenCalledTimes(3)
  })
})
