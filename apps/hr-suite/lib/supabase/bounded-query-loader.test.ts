import { describe, expect, it } from 'vitest'
import { loadQueriesInBatches } from './bounded-query-loader'

describe('loadQueriesInBatches', () => {
  it('limits concurrent reads and keeps results in input order', async () => {
    let active = 0
    let maxActive = 0
    const loaders = Array.from({ length: 5 }, (_, value) => async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
      active -= 1
      return value
    })

    const results = await loadQueriesInBatches(loaders, 2)

    expect(maxActive).toBe(2)
    expect(results).toEqual([0, 1, 2, 3, 4])
  })

  it('rejects a non-positive or non-integer batch size', async () => {
    await expect(loadQueriesInBatches([], 0)).rejects.toThrow(RangeError)
    await expect(loadQueriesInBatches([], 1.5)).rejects.toThrow(RangeError)
  })
})
