import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  parseUserPreferences,
  resolveUserPreferences,
  userPreferencesSchema,
} from './user-preferences'

describe('userPreferencesSchema', () => {
  it('accepteert iedere ondersteunde themawaarde', () => {
    const themes = ['liquid-navy', 'noordzee', 'bos', 'warm-zand', 'aubergine', 'nacht']
    for (const theme of themes) {
      expect(userPreferencesSchema.parse({ locale: 'nl', theme }).theme).toBe(theme)
    }
  })

  it('weigert onbekende talen, thema’s en extra velden', () => {
    expect(userPreferencesSchema.safeParse({ locale: 'de', theme: 'bos' }).success).toBe(false)
    expect(userPreferencesSchema.safeParse({ locale: 'nl', theme: 'rood' }).success).toBe(false)
    expect(
      userPreferencesSchema.safeParse({ locale: 'nl', theme: 'bos', tenantId: 'verboden' }).success,
    ).toBe(false)
  })
})

describe('resolveUserPreferences', () => {
  it('geeft geldige databasevoorkeuren voorrang boven cookies', () => {
    expect(resolveUserPreferences(
      { locale: 'en', theme: 'nacht' },
      { locale: 'nl', theme: 'bos' },
    )).toEqual({ locale: 'en', theme: 'nacht', clockMode: 'ANALOG', analogClockStyle: 'LIQUID' })
  })

  it('gebruikt voor een anonieme bezoeker geldige cookievoorkeuren', () => {
    expect(resolveUserPreferences(null, { locale: 'en', theme: 'noordzee' })).toEqual({
      locale: 'en', theme: 'noordzee', clockMode: 'ANALOG', analogClockStyle: 'LIQUID',
    })
  })

  it('valt per ongeldige cookiewaarde terug op de veilige standaard', () => {
    expect(resolveUserPreferences(null, { locale: 'en', theme: 'onbekend' })).toEqual({
      locale: 'en', theme: 'liquid-navy', clockMode: 'ANALOG', analogClockStyle: 'LIQUID',
    })
  })
})

describe('parseUserPreferences', () => {
  it('valt veilig terug op Nederlandse Liquid Navy-voorkeuren', () => {
    expect(parseUserPreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(parseUserPreferences({ locale: 'de', theme: 'onbekend' })).toEqual(DEFAULT_PREFERENCES)
  })

  it('gebruikt de standaard analoge Liquid-klok', () => {
    expect(DEFAULT_PREFERENCES.clockMode).toBe('ANALOG')
    expect(DEFAULT_PREFERENCES.analogClockStyle).toBe('LIQUID')
  })

  it('accepteert alle ondersteunde klokvoorkeuren', () => {
    expect(parseUserPreferences({
      locale: 'nl',
      theme: 'liquid-navy',
      clockMode: 'DIGITAL',
      analogClockStyle: 'CLASSIC',
    })).toEqual({
      locale: 'nl',
      theme: 'liquid-navy',
      clockMode: 'DIGITAL',
      analogClockStyle: 'CLASSIC',
    })
  })

  it('wijst onbekende klokwaarden af', () => {
    expect(parseUserPreferences({
      locale: 'nl',
      theme: 'liquid-navy',
      clockMode: 'WALL_CLOCK',
      analogClockStyle: 'NEON',
    })).toEqual(DEFAULT_PREFERENCES)
  })
})
