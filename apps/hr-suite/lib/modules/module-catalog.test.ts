import { describe, expect, it } from 'vitest'
import { getModuleCatalog, normalizeModuleSelection } from './module-catalog'

describe('module catalog', () => {
  it('maakt uitsluitend bestaande extra modules schakelbaar', () => {
    const catalog = getModuleCatalog()
    expect(catalog.filter((module) => module.toggleable).map((module) => module.code)).toEqual([
      'HERA',
      'DOCUMENTS',
      'REMINDERS',
    ])
    expect(catalog.filter((module) => module.status === 'COMING_SOON').every((module) => !module.toggleable)).toBe(true)
  })

  it('negeert onbekende en toekomstige modules bij opslaan', () => {
    expect(normalizeModuleSelection(['HERA', 'LEAVE', 'UNKNOWN', 'HERA'])).toEqual(['HERA'])
  })
})
