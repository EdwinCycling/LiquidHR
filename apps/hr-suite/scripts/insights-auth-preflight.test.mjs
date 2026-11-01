import { describe, expect, it } from 'vitest'
import { missingInsightsAuthKeys, REQUIRED_INSIGHTS_AUTH_KEYS } from './insights-auth-preflight.mjs'

describe('Insights authentication configuration preflight', () => {
  it('reports only missing required key names from an environment key-name set', () => {
    const availableKeyNames = new Set([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'TALENT_EMPLOYEE_PASSWORD',
    ])

    expect(missingInsightsAuthKeys(availableKeyNames)).toEqual([
      'TALENT_HR_ADMIN_PASSWORD',
      'TALENT_MANAGER_PASSWORD',
      'LIQUIDHR_TEST_ROLE_SWITCH_ENABLED',
    ])
  })

  it('keeps the preflight contract limited to known key names and does not accept values', () => {
    const availableKeyNames = new Set(['NEXT_PUBLIC_SUPABASE_URL'])
    const missing = missingInsightsAuthKeys(availableKeyNames)

    expect(missing).toEqual(REQUIRED_INSIGHTS_AUTH_KEYS.filter((key) => key !== 'NEXT_PUBLIC_SUPABASE_URL'))
    expect(missing.every((key) => /^[A-Z][A-Z0-9_]*$/.test(key))).toBe(true)
  })
})