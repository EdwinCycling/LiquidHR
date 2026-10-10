import { describe, expect, it } from 'vitest'
import { resolveHeRaDate, resolveHeRaDateTime } from './date-time'

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

  it('resolveert volgende vrijdag vanuit de lokale Amsterdamdatum', () => {
    expect(resolveHeRaDate(
      'volgende vrijdag',
      new Date('2026-10-09T13:00:00.000Z'),
      'Europe/Amsterdam',
      'nl',
    )).toMatchObject({ date: '2026-10-16' })
  })

  it('resolveert een weekdag met lokale tijd over een DST-grens', () => {
    expect(resolveHeRaDateTime(
      'Monday at 09:00',
      new Date('2026-10-09T13:00:00.000Z'),
      'Europe/Amsterdam',
      'en',
    ).iso).toBe('2026-10-12T07:00:00.000Z')
  })

  it('vraagt verduidelijking voor een dubbelzinnige herfsttijd', () => {
    expect(() => resolveHeRaDateTime(
      '2026-10-25 om 02:30',
      new Date('2026-10-09T13:00:00.000Z'),
      'Europe/Amsterdam',
      'nl',
    )).toThrowError('HERA_DATE_TIME_AMBIGUOUS')
  })

  it('weigert een niet-bestaand tijdstip bij de start van zomertijd', () => {
    expect(() => resolveHeRaDateTime(
      '2026-03-29 at 02:30',
      new Date('2026-03-01T12:00:00.000Z'),
      'Europe/Amsterdam',
      'en',
    )).toThrowError('HERA_DATE_INPUT_INVALID')
  })

  it('bepaalt de eerstvolgende weekdag over een lokale datumgrens', () => {
    expect(resolveHeRaDate(
      'Friday',
      new Date('2026-12-31T23:30:00.000Z'),
      'Europe/Amsterdam',
      'en',
    ).date).toBe('2027-01-08')
  })
})
