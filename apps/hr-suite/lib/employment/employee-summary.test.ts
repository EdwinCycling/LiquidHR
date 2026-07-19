import { describe, expect, it } from 'vitest'
import { selectCurrentEmploymentSummary } from './employee-summary'

describe('selectCurrentEmploymentSummary', () => {
  it('combineert de effective-dated dienstverbandgegevens van vandaag', () => {
    expect(selectCurrentEmploymentSummary({
      today: '2026-07-19',
      employments: [
        { id: 'future', startsOn: '2026-08-01', endsOn: null, recordStatus: 'PUBLISHED' },
        { id: 'current', startsOn: '2025-01-01', endsOn: null, recordStatus: 'PUBLISHED' },
      ],
      laborConditions: [{ employmentId: 'current', value: 'CAO Metalektro', validFrom: '2025-01-01', validUntil: null }],
      schedules: [{ employmentId: 'current', value: 36, validFrom: '2025-01-01', validUntil: null }],
      salaries: [{ employmentId: 'current', amount: 4200, currencyCode: 'EUR', paymentType: 'PERIODIC_FIXED', validFrom: '2025-01-01', validUntil: null }],
      organizations: [{ employmentId: 'current', departmentName: 'Product', jobTitle: 'HR Adviseur', validFrom: '2025-01-01', validUntil: null }],
    })).toEqual({
      asOf: '2026-07-19',
      employmentId: 'current',
      laborCondition: 'CAO Metalektro',
      hoursPerWeek: 36,
      salary: { amount: 4200, currencyCode: 'EUR', paymentType: 'PERIODIC_FIXED' },
      departmentName: 'Product',
      jobTitle: 'HR Adviseur',
    })
  })

  it('geeft lege waarden wanneer vandaag geen actief dienstverband heeft', () => {
    expect(selectCurrentEmploymentSummary({
      today: '2026-07-19',
      employments: [{ id: 'future', startsOn: '2026-08-01', endsOn: null, recordStatus: 'PUBLISHED' }],
      laborConditions: [], schedules: [], salaries: [], organizations: [],
    })).toEqual({
      asOf: '2026-07-19',
      employmentId: null,
      laborCondition: null,
      hoursPerWeek: null,
      salary: null,
      departmentName: null,
      jobTitle: null,
    })
  })
})
