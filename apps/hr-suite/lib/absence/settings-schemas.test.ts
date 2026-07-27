import { describe, expect, it } from 'vitest'
import { absenceSettingsSchema } from './settings-schemas'

describe('absenceSettingsSchema', () => {
  it('normaliseert een geldige drempel en casemanager', () => {
    expect(absenceSettingsSchema.parse({ frequentAbsenceThreshold: '4', defaultCaseManagerEmployeeId: '11111111-1111-4111-8111-111111111111' })).toEqual({
      frequentAbsenceThreshold: 4,
      defaultCaseManagerEmployeeId: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('blokkeert drempels buiten het afgesproken bereik', () => {
    expect(() => absenceSettingsSchema.parse({ frequentAbsenceThreshold: 0 })).toThrow()
    expect(() => absenceSettingsSchema.parse({ frequentAbsenceThreshold: 21 })).toThrow()
  })
})
