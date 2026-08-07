import { describe, expect, it } from 'vitest'
import { buildEmploymentRegulationTimelines } from './employment-regulation-model'

describe('buildEmploymentRegulationTimelines', () => {
  it('builds one ordered chain from roots and successors', () => {
    const timelines = buildEmploymentRegulationTimelines([
      { id: 'root', code: 'CAO', name: 'CAO 2026', standard_hours_per_week: 40, valid_from: '2026-01-01', predecessor_id: null, is_active: false },
      { id: 'successor', code: 'CAO-20270101', name: 'CAO 2027', standard_hours_per_week: 38, valid_from: '2027-01-01', predecessor_id: 'root', is_active: true },
      { id: 'last', code: 'CAO-20280101', name: 'CAO 2028', standard_hours_per_week: 38, valid_from: '2028-01-01', predecessor_id: 'successor', is_active: true },
    ])

    expect(timelines).toHaveLength(1)
    expect(timelines[0].versions.map((version) => version.id)).toEqual(['root', 'successor', 'last'])
  })

  it('keeps separate regulation roots separate', () => {
    const timelines = buildEmploymentRegulationTimelines([
      { id: 'cao', code: 'CAO', name: 'CAO', standard_hours_per_week: 40, valid_from: '2026-01-01', predecessor_id: null, is_active: true },
      { id: 'company', code: 'COMPANY', name: 'Bedrijfseigen regeling', standard_hours_per_week: 40, valid_from: '2026-01-01', predecessor_id: null, is_active: true },
    ])

    expect(timelines.map((timeline) => timeline.code)).toEqual(['CAO', 'COMPANY'])
  })
})
