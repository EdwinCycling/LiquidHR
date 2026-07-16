import { describe, expect, it } from 'vitest'
import { deriveEmploymentStatus, isRehire } from './employment-status'

const today = '2026-07-15'

describe('deriveEmploymentStatus', () => {
  it('onderscheidt nooit, toekomstig, actief en uit dienst', () => {
    expect(deriveEmploymentStatus([], today)).toBe('NEVER_EMPLOYED')
    expect(deriveEmploymentStatus([{ startsOn: '2026-08-01', endsOn: null }], today)).toBe(
      'FUTURE_EMPLOYEE',
    )
    expect(deriveEmploymentStatus([{ startsOn: '2026-01-01', endsOn: null }], today)).toBe(
      'ACTIVE_EMPLOYEE',
    )
    expect(deriveEmploymentStatus([{ startsOn: '2025-01-01', endsOn: '2025-12-31' }], today)).toBe(
      'FORMER_EMPLOYEE',
    )
  })

  it('houdt een medewerker actief zolang één parallel dienstverband actief is', () => {
    expect(
      deriveEmploymentStatus(
        [
          { startsOn: '2024-01-01', endsOn: '2025-12-31' },
          { startsOn: '2026-01-01', endsOn: null },
        ],
        today,
      ),
    ).toBe('ACTIVE_EMPLOYEE')
  })

  it('negeert geannuleerde dienstverbanden', () => {
    expect(
      deriveEmploymentStatus(
        [{ startsOn: '2026-01-01', endsOn: null, recordStatus: 'CANCELLED' }],
        today,
      ),
    ).toBe('NEVER_EMPLOYED')
  })
})

describe('isRehire', () => {
  it('herkent alleen een nieuw dienstverband na eerder einde', () => {
    expect(isRehire([{ startsOn: '2024-01-01', endsOn: '2025-12-31' }], '2026-08-01')).toBe(true)
    expect(isRehire([{ startsOn: '2026-01-01', endsOn: null }], '2026-08-01')).toBe(false)
  })
})
