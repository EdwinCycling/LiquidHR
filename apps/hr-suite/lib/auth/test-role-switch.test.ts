import { describe, expect, it, vi } from 'vitest'
import {
  getTestRoleSwitchTarget,
  isTestRoleSwitchAccount,
  isTestRoleSwitchEnabled,
} from '@/lib/auth/test-role-switch'

describe('test role switch', () => {
  it('beperkt de wisselaar tot de vier afgesproken accounts', () => {
    expect(isTestRoleSwitchAccount('EDWIN@EDITSOLUTIONS.NL')).toBe(true)
    expect(isTestRoleSwitchAccount('hradmin.fixture@liquidhr.test')).toBe(true)
    expect(isTestRoleSwitchAccount('other@example.com')).toBe(false)
  })

  it('vindt alleen een allowlisted target key', () => {
    expect(getTestRoleSwitchTarget('manager')?.email).toBe('manager.fixture@liquidhr.test')
    expect(getTestRoleSwitchTarget('arbitrary-email')).toBeNull()
  })

  it('is lokaal/test standaard beschikbaar maar productie expliciet uit', () => {
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'development' })).toBe(true)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', explicitFlag: 'true' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', explicitFlag: ' TRUE ' })).toBe(false)
  })

  it('kan in Vercel Preview met een expliciete flag blijven werken', () => {
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'preview', explicitFlag: 'true' })).toBe(true)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'preview', explicitFlag: 'false' })).toBe(false)
  })

  it('behandelt Vercel Production als productie, ook bij een stale flag', () => {
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'production', explicitFlag: 'true' })).toBe(false)
  })

  it('leest de productieflag uit de runtimeomgeving wanneer geen override wordt meegegeven', () => {
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NODE_ENV', 'production')
    expect(isTestRoleSwitchEnabled()).toBe(false)
    vi.unstubAllEnvs()
  })
})
