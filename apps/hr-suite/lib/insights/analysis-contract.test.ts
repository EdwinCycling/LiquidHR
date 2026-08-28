import { describe, expect, it } from 'vitest'
import {
  ANALYSIS_HUB_ROUTE,
  ANALYSIS_PERMISSION,
  LEGACY_DASHBOARD_SETTINGS_ROUTE,
  LEGACY_DASHBOARD_ROUTE,
} from './analysis-contract'

describe('Liquid Analyse route contract', () => {
  it('keeps Analyse on the existing dashboard:read access contract', () => {
    expect(ANALYSIS_HUB_ROUTE).toBe('/insights/analysis')
    expect(ANALYSIS_PERMISSION).toBe('dashboard:read')
  })

  it('points legacy analytical entry points to the Analyse hub', () => {
    expect(LEGACY_DASHBOARD_ROUTE).toBe(ANALYSIS_HUB_ROUTE)
    expect(LEGACY_DASHBOARD_SETTINGS_ROUTE).toBe(ANALYSIS_HUB_ROUTE)
  })
})
