import { describe, expect, it } from 'vitest'
import { createLeaveRequestIdempotencyKey } from './idempotency'

describe('Leave request idempotency keys', () => {
  it('creates a stable database-safe key for the full request identity', async () => {
    const parts = ['employee', 'employment', '2026-09-21', '2026-09-23', 'PRIORITY', 'rule', 'FULL_DAY', '', '']
    const first = await createLeaveRequestIdempotencyKey(parts)
    const second = await createLeaveRequestIdempotencyKey([...parts])

    expect(first).toBe(second)
    expect(first).toMatch(/^leave:[0-9a-f]{64}$/)
    expect(first.length).toBeLessThanOrEqual(160)
  })

  it('changes when a booking identity changes', async () => {
    const first = await createLeaveRequestIdempotencyKey(['employee', 'employment', '2026-09-21', '2026-09-23', 'PRIORITY', 'rule', 'FULL_DAY', '', ''])
    const second = await createLeaveRequestIdempotencyKey(['employee', 'employment', '2026-09-22', '2026-09-23', 'PRIORITY', 'rule', 'FULL_DAY', '', ''])

    expect(first).not.toBe(second)
  })
})
