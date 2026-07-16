import { describe, expect, it } from 'vitest'
import { organizationChartQuerySchema } from './schemas'

describe('organizationChartQuerySchema', () => {
  it('accepteert een deelbare filterquery', () => {
    const parsed = organizationChartQuerySchema.safeParse({
      date: '2026-07-16', q: '  Finance ', department: crypto.randomUUID(),
      role: 'TEAM_LEAD', field: crypto.randomUUID(), value: 'Noord',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.q).toBe('Finance')
  })

  it('weigert een ongeldige peildatum en onvolledige vrije-veldfilter', () => {
    expect(organizationChartQuerySchema.safeParse({ date: '16-07-2026' }).success).toBe(false)
    expect(organizationChartQuerySchema.safeParse({ date: '2026-07-16', field: crypto.randomUUID() }).success).toBe(false)
  })
})
