import { describe, expect, it } from 'vitest'
import { journeyProjectionSchema, journeyProgressPercent, localizedValue } from './projection-domain'

const projection = {
  id: '11111111-1111-4111-8111-111111111111',
  templateName: { nl: 'Welkom', en: 'Welcome' },
  status: 'ACTIVE',
  anchorDate: '2026-08-12',
  targetEmployeeName: 'Ada Lovelace',
  relationship: 'SELF',
  progress: { completed: 1, total: 4 },
  nextAction: null,
  participants: [],
  phases: [],
} as const

describe('journey projection domain', () => {
  it('accepts the minimal actor-safe projection shape', () => {
    expect(journeyProjectionSchema.parse(projection).relationship).toBe('SELF')
  })

  it('uses the requested locale and falls back to Dutch', () => {
    expect(localizedValue({ nl: 'Welkom', en: 'Welcome' }, 'en')).toBe('Welcome')
    expect(localizedValue({ nl: 'Welkom', en: 'Welcome' }, 'de')).toBe('Welkom')
  })

  it('does not divide an empty journey by zero', () => {
    expect(journeyProgressPercent({ completed: 0, total: 0 })).toBe(0)
    expect(journeyProgressPercent({ completed: 2, total: 4 })).toBe(50)
  })
})
