import { describe, expect, it } from 'vitest'
import { talentGoalCreateSchema, talentGoalUpdateSchema } from './goal-schemas'

describe('talent goal schemas', () => {
  it('accepts a bounded draft goal', () => {
    expect(talentGoalCreateSchema.parse({ title: 'Klantgesprekken verbeteren', periodStart: '2026-08-01' }).status).toBe('DRAFT')
  })

  it('rejects a reversed period', () => {
    expect(talentGoalCreateSchema.safeParse({ title: 'Doel', periodStart: '2026-09-01', periodEnd: '2026-08-01' }).success).toBe(false)
  })

  it('requires a version for updates', () => {
    expect(talentGoalUpdateSchema.safeParse({ title: 'Nieuw doel' }).success).toBe(false)
  })
})
