import { describe, expect, it } from 'vitest'
import { createTranslator, isLocale } from './translator'

describe('createTranslator', () => {
  const t = createTranslator({
    welcome: 'Welkom, {name}',
    nested: { save: 'Opslaan' },
  })

  it('leest geneste sleutels', () => {
    expect(t('nested.save')).toBe('Opslaan')
  })

  it('vervangt benoemde parameters', () => {
    expect(t('welcome', { name: 'Edwin' })).toBe('Welkom, Edwin')
  })

  it('faalt expliciet bij een ontbrekende vertaling', () => {
    expect(() => t('nested.cancel')).toThrow('I18N_MESSAGE_MISSING:nested.cancel')
  })
})

describe('isLocale', () => {
  it('accepteert alleen ondersteunde talen', () => {
    expect(isLocale('nl')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
  })
})
