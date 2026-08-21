import { describe, expect, it } from 'vitest'
import settingsNl from '@/messages/nl/settings.json'
import settingsEn from '@/messages/en/settings.json'
import employeesNl from '@/messages/nl/employees.json'
import employeesEn from '@/messages/en/employees.json'
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
  it('bevat de stamtabellentegel in beide talen', () => {
    expect(createTranslator(settingsNl)('admin.tiles.masterData')).toBe('Stamtabellen')
    expect(createTranslator(settingsEn)('admin.tiles.masterData')).toBe('Master data')
  })
})

describe('employee detail tabnavigatie vertalingen', () => {
  it('bevat previous en next in beide talen', () => {
    const employeesTranslatorNl = createTranslator(employeesNl)
    const employeesTranslatorEn = createTranslator(employeesEn)

    expect(employeesTranslatorNl('previous')).toBe('Vorige')
    expect(employeesTranslatorNl('next')).toBe('Volgende')
    expect(employeesTranslatorEn('previous')).toBe('Previous')
    expect(employeesTranslatorEn('next')).toBe('Next')
  })
})

describe('isLocale', () => {
  it('accepteert alleen ondersteunde talen', () => {
    expect(isLocale('nl')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
  })
})
