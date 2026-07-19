import { describe, expect, it } from 'vitest'
import { organizationChartQuerySchema } from './schemas'

describe('organizationChartQuerySchema', () => {
  it('accepteert een deelbare filterquery met view', () => {
    const parsed = organizationChartQuerySchema.safeParse({
      view: 'manager',
      date: '2026-07-16', q: '  Finance ', department: crypto.randomUUID(),
      role: 'TEAM_LEAD', field: crypto.randomUUID(), value: 'Noord',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.view).toBe('manager')
      expect(parsed.data.q).toBe('Finance')
    }
  })

  it('gebruikt afdelingen als standaardweergave wanneer view ontbreekt', () => {
    const parsed = organizationChartQuerySchema.parse({ date: '2026-07-16' })

    expect(parsed.view).toBe('department')
  })

  it('weigert een ongeldige peildatum en onvolledige vrije-veldfilter', () => {
    expect(organizationChartQuerySchema.safeParse({ date: '16-07-2026' }).success).toBe(false)
    expect(organizationChartQuerySchema.safeParse({ date: '2026-07-16', field: crypto.randomUUID() }).success).toBe(false)
    expect(organizationChartQuerySchema.safeParse({ view: 'invalid', date: '2026-07-16' }).success).toBe(false)
  })
})
