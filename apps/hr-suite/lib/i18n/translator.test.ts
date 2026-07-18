import { describe, expect, it } from 'vitest'
import settingsNl from '@/messages/nl/settings.json'
import settingsEn from '@/messages/en/settings.json'
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

describe('admin-instellingen vertalingen', () => {
  it('bevat de tegel voor interne redenen in beide talen', () => {
    expect(createTranslator(settingsNl)('admin.tiles.endReasons')).toBe('Interne redenen')
    expect(createTranslator(settingsEn)('admin.tiles.endReasons')).toBe('Internal reasons')
  })
})

describe('isLocale', () => {
  it('accepteert alleen ondersteunde talen', () => {
    expect(isLocale('nl')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
  })
})
