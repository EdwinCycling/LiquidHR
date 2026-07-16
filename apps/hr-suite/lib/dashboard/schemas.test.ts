import { describe, expect, it } from 'vitest'
import { dashboardCreateSchema, dashboardLayoutSchema } from './schemas'

describe('dashboard schemas', () => {
  it('weigert een leeg dashboard en een onbekende widget', () => {
    expect(dashboardCreateSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(dashboardLayoutSchema.safeParse({ widgets: [{ type: 'UNSAFE_HTML', position: 0 }] }).success).toBe(false)
  })
})
