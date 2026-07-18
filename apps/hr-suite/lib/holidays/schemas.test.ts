import { describe, expect, it } from 'vitest'
import { holidayImportSchema, holidayManualSchema } from './schemas'

describe('holiday schemas', () => {
  it('normaliseert de landcode voor import', () => expect(holidayImportSchema.parse({ year: 2027, countryCode: 'nl' }).countryCode).toBe('NL'))
  it('weigert een lokale feestdag buiten het kalenderjaar', () => expect(holidayManualSchema.safeParse({ year: 2027, countryCode: 'NL', date: '2028-01-01', name: 'Lokaal' }).success).toBe(false))
})
