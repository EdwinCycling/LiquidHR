import { describe, expect, it } from 'vitest'
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
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', explicitFlag: 'true' })).toBe(true)
  })
})
