import { describe, expect, it } from 'vitest'
import { mergeHolidayImport, normalizeProviderHoliday } from './holiday-model'

describe('holiday model', () => {
  it('normaliseert een Nager.Date feestdag tot een stabiele snapshot', () => {
    expect(normalizeProviderHoliday({
      date: '2027-04-27',
      localName: 'Koningsdag',
      name: "King's Day",
      countryCode: 'NL',
      global: true,
      counties: null,
      launchYear: null,
      types: ['Public'],
    })).toMatchObject({ externalKey: 'NL:2027-04-27:king-s-day', displayName: 'Koningsdag' })
  })

  it('behoudt lokale en uitgesloten dagen bij herimport', () => {
    const merged = mergeHolidayImport({
      existing: [
        { externalKey: 'NL:2027-04-27:king-s-day', source: 'API', isActive: false },
        { externalKey: null, source: 'MANUAL', isActive: true },
      ],
      imported: [{ externalKey: 'NL:2027-04-27:king-s-day' }, { externalKey: 'NL:2027-12-25:christmas-day' }],
    })
    expect(merged).toEqual([
      { externalKey: 'NL:2027-04-27:king-s-day', isActive: false },
      { externalKey: 'NL:2027-12-25:christmas-day', isActive: true },
    ])
  })
})
