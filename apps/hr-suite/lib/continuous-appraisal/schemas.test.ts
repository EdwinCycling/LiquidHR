import { describe, expect, it } from 'vitest'
import {
  continuousAppraisalCreateSchema,
  continuousAppraisalDeleteSchema,
  continuousAppraisalListQuerySchema,
  continuousAppraisalStatusTransitionSchema,
  continuousAppraisalUpdateSchema,
} from './schemas'

const employeeId = '11111111-1111-4111-8111-111111111111'

describe('Continuous Appraisal mutation contracts', () => {
  it('keeps NOT_RELEVANT out of generic create and edit payloads', () => {
    const create = continuousAppraisalCreateSchema.safeParse({ employeeId, itemType: 'ACTION', title: 'Actie', body: 'Beschrijving', occurredOn: '2026-10-14', itemStatus: 'NOT_RELEVANT' })
    const update = continuousAppraisalUpdateSchema.safeParse({ version: 1, itemStatus: 'NOT_RELEVANT' })

    expect(create.success).toBe(false)
    expect(update.success).toBe(false)
  })

  it('allows only versioned DONE and NOT_RELEVANT transitions', () => {
    expect(continuousAppraisalStatusTransitionSchema.safeParse({ version: 1, itemStatus: 'DONE' }).success).toBe(true)
    expect(continuousAppraisalStatusTransitionSchema.safeParse({ version: 3, itemStatus: 'NOT_RELEVANT' }).success).toBe(true)
    expect(continuousAppraisalStatusTransitionSchema.safeParse({ version: 1, itemStatus: 'CANCELLED' }).success).toBe(false)
  })

  it('keeps NOT_RELEVANT selectable as a timeline status filter', () => {
    expect(continuousAppraisalListQuerySchema.safeParse({ itemStatus: 'NOT_RELEVANT' }).success).toBe(true)
  })

  it('requires an optimistic version for soft deletion', () => {
    expect(continuousAppraisalDeleteSchema.safeParse({ version: 2 }).success).toBe(true)
    expect(continuousAppraisalDeleteSchema.safeParse({}).success).toBe(false)
  })
})
