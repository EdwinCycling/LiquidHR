import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { readPayrollSourceQueryCached } from './payroll-source-read-cache'

describe('Payroll source request cache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shares only the same scoped catalog read and preserves its result and failure', async () => {
    const rows = [{ id: 'catalog-row' }]
    const read = vi.fn(async () => rows)
    const first = readPayrollSourceQueryCached(['jobs', 'tenant-a', 'group-a', 'admin-a', ['job-a', 'job-b']], read)
    const duplicate = readPayrollSourceQueryCached(['jobs', 'tenant-a', 'group-a', 'admin-a', ['job-a', 'job-b']], read)

    const [firstResult, duplicateResult] = await Promise.all([first, duplicate])
    expect(read).toHaveBeenCalledTimes(1)
    expect(firstResult).toBe(rows)
    expect(duplicateResult).toBe(rows)

    const differentScope = vi.fn(async () => [])
    const differentSelector = vi.fn(async () => [])
    await readPayrollSourceQueryCached(['jobs', 'tenant-a', 'group-a', 'admin-b', ['job-a', 'job-b']], differentScope)
    await readPayrollSourceQueryCached(['jobs', 'tenant-a', 'group-a', 'admin-a', ['job-c']], differentSelector)
    expect(differentScope).toHaveBeenCalledTimes(1)
    expect(differentSelector).toHaveBeenCalledTimes(1)

    const failure = new Error('SOURCE_READ_FAILED')
    const failedRead = vi.fn(async () => { throw failure })
    const firstFailure = readPayrollSourceQueryCached(['jobs', 'tenant-b', 'group-b', 'admin-b', ['job-x']], failedRead)
    const repeatedFailure = readPayrollSourceQueryCached(['jobs', 'tenant-b', 'group-b', 'admin-b', ['job-x']], failedRead)
    await expect(Promise.all([firstFailure, repeatedFailure])).rejects.toBe(failure)
    expect(failedRead).toHaveBeenCalledTimes(1)
  })
})
