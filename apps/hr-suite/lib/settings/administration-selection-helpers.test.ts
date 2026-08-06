import { describe, expect, it } from 'vitest'
import type { ActiveContext } from '@/lib/context/administration-context'
import {
  buildAdministrationSettingsSelectionHref,
  getPersistedAdministrationId,
  normalizeAdministrationSettingsReturnPath,
} from './administration-selection-helpers'

const context = {
  administrationsInActiveHrGroup: [
    { id: 'admin-a', code: 'A', name: 'Administratie A' },
    { id: 'admin-b', code: 'B', name: 'Administratie B' },
  ],
} as ActiveContext

describe('administration settings selection helpers', () => {
  it('houdt alleen een toegankelijke administratie als laatst gekozen keuze over', () => {
    expect(getPersistedAdministrationId(context, 'admin-b')).toBe('admin-b')
    expect(getPersistedAdministrationId(context, 'admin-other')).toBeNull()
    expect(getPersistedAdministrationId(context, undefined)).toBeNull()
  })

  it('staat alleen interne instellingenbestemmingen toe', () => {
    expect(normalizeAdministrationSettingsReturnPath('/settings/holidays')).toBe('/settings/holidays')
    expect(normalizeAdministrationSettingsReturnPath('/master-data?section=endReasons')).toBe('/master-data?section=endReasons')
    expect(normalizeAdministrationSettingsReturnPath('https://example.com')).toBe('/settings')
    expect(normalizeAdministrationSettingsReturnPath('//example.com')).toBe('/settings')
    expect(normalizeAdministrationSettingsReturnPath('/dashboard')).toBe('/settings')
  })

  it('bouwt een veilige terugkeerlink voor de keuze-flow', () => {
    expect(buildAdministrationSettingsSelectionHref('/settings/company-branding')).toBe(
      '/settings/administration?returnTo=%2Fsettings%2Fcompany-branding',
    )
    expect(buildAdministrationSettingsSelectionHref('https://example.com')).toBe(
      '/settings/administration?returnTo=%2Fsettings',
    )
  })
})
