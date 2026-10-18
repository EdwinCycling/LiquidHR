import { describe, expect, it } from 'vitest'
import {
  CAO_SETUP_CATALOG,
  caoSetupPackageOptions,
  findCaoSetupCatalogEntry,
} from './cao-setup-catalog'

describe('CAO setup catalogue', () => {
  it('exposes only the existing supported collective-agreement packages', () => {
    expect(CAO_SETUP_CATALOG.map((entry) => entry.packageId)).toEqual([
      'KINDEROPVANG_2025_2026',
      'RETAIL_NON_FOOD_MODE_2026_2027',
    ])
    expect(CAO_SETUP_CATALOG.every((entry) => entry.sourceStatus === 'REFERENCE_ONLY')).toBe(true)
    expect(CAO_SETUP_CATALOG.every((entry) => entry.versions.every((version) => version.packageVersionHash.length === 64))).toBe(true)
  })

  it('resolves Core labor-condition labels to the existing catalogue', () => {
    expect(findCaoSetupCatalogEntry('CAO_KINDEROPVANG_2025_2026', 'Kinderopvang')).toMatchObject({ packageId: 'KINDEROPVANG_2025_2026', standardHoursPerWeek: 36 })
    expect(findCaoSetupCatalogEntry('RETAIL_NON_FOOD_MODE_2026_2027', 'Retail Non-Food')).toMatchObject({ packageId: 'RETAIL_NON_FOOD_MODE_2026_2027', standardHoursPerWeek: 38 })
    expect(findCaoSetupCatalogEntry('UNSUPPORTED', 'Onbekende regeling')).toBeNull()
  })

  it('offers effective-dated options for the normal regulation editor', () => {
    const options = caoSetupPackageOptions()
    expect(options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'KINDEROPVANG_2025_2026:2026.09', effectiveFrom: '2026-09-01', standardHoursPerWeek: 36 }),
      expect.objectContaining({ id: 'RETAIL_NON_FOOD_MODE_2026_2027:2026.07', effectiveFrom: '2026-07-01', standardHoursPerWeek: 38 }),
    ]))
  })
})
