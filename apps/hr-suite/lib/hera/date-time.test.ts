import { describe, expect, it } from 'vitest'
import { resolveHeRaDateTime } from './date-time'

describe('resolveHeRaDateTime', () => {
  it('resolveert morgen vanuit de actuele datum in Europe/Amsterdam', () => {
    expect(resolveHeRaDateTime(
      'morgen om 09:00',
      new Date('2026-07-17T10:00:00.000Z'),
      'Europe/Amsterdam',
      'nl',
    )).toEqual({
      iso: '2026-07-18T07:00:00.000Z',
      display: '18 juli 2026 om 09:00 (Europe/Amsterdam)',
    })
  })

  it('houdt rekening met wintertijd', () => {
    expect(resolveHeRaDateTime(
      'tomorrow at 09:00',
      new Date('2026-12-17T10:00:00.000Z'),
      'Europe/Amsterdam',
      'en',
    ).iso).toBe('2026-12-18T08:00:00.000Z')
  })

  it('blokkeert een tijdstip in het verleden', () => {
    expect(() => resolveHeRaDateTime(
      'vandaag om 09:00',
      new Date('2026-07-17T10:00:00.000Z'),
      'Europe/Amsterdam',
      'nl',
    )).toThrowError('HERA_DATE_IN_PAST')
  })
})
