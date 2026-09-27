import { describe, expect, it, vi } from 'vitest'
import {
  getTestRoleSwitchTarget,
  getTestAuthHarnessCredentials,
  canReturnToTestHrAdmin,
  canInitiateTestRoleSwitch,
  isTestRoleSwitchAccount,
  isTestRoleSwitchEnabled,
  resolveSupabaseProjectRef,
} from '@/lib/auth/test-role-switch'

const CANONICAL_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co'

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

  it('beperkt het starten van de wissel tot een bevoegde beheerrol', () => {
    expect(canInitiateTestRoleSwitch(['HR_ADMIN'])).toBe(true)
    expect(canInitiateTestRoleSwitch(['TENANT_ADMIN'])).toBe(true)
    expect(canInitiateTestRoleSwitch(['DIRECT_MANAGER'])).toBe(false)
    expect(canInitiateTestRoleSwitch(['EMPLOYEE'])).toBe(false)
    expect(canInitiateTestRoleSwitch([])).toBe(false)
  })

  it('biedt alleen de twee lagere testpersonas een terugkeer naar Test HR Admin', () => {
    expect(canReturnToTestHrAdmin('manager.fixture@liquidhr.test')).toBe(true)
    expect(canReturnToTestHrAdmin('employee.fixture@liquidhr.test')).toBe(true)
    expect(canReturnToTestHrAdmin('hradmin.fixture@liquidhr.test')).toBe(false)
    expect(canReturnToTestHrAdmin('other@example.com')).toBe(false)
  })

  it('vereist de expliciete flag en de canonieke LiquidHR Supabase-projectref', () => {
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'development', explicitFlag: 'true', supabaseUrl: CANONICAL_SUPABASE_URL })).toBe(true)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'development', explicitFlag: 'false', supabaseUrl: CANONICAL_SUPABASE_URL })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'development', explicitFlag: 'true' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'development', explicitFlag: 'true', supabaseUrl: 'https://other-project.supabase.co' })).toBe(false)
  })

  it('resolveert alleen een kale Supabase-project-URL naar een ref', () => {
    expect(resolveSupabaseProjectRef(CANONICAL_SUPABASE_URL)).toBe('wnpfloqpjvaacobppbpk')
    expect(resolveSupabaseProjectRef('https://other-project.supabase.co')).toBe('other-project')
    expect(resolveSupabaseProjectRef('https://wnpfloqpjvaacobppbpk.supabase.co/rest/v1')).toBeNull()
    expect(resolveSupabaseProjectRef('not-a-url')).toBeNull()
  })

  it('houdt een productie-build zonder Vercel-context gesloten', () => {
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production' })).toBe(false)
  })

  it('houdt test-login en rolwissel uit iedere production-runtime', () => {
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'production', explicitFlag: 'true', supabaseUrl: CANONICAL_SUPABASE_URL })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'production', explicitFlag: 'false', supabaseUrl: CANONICAL_SUPABASE_URL })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'production', explicitFlag: 'true', supabaseUrl: 'https://real-production.supabase.co' })).toBe(false)
  })

  it('houdt test-login en rolwissel uit Vercel Preview en lokale Vercel-runtime', () => {
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'preview', explicitFlag: 'true', supabaseUrl: CANONICAL_SUPABASE_URL })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'preview', explicitFlag: ' TRUE ', supabaseUrl: CANONICAL_SUPABASE_URL })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'production', vercelEnv: 'preview', explicitFlag: 'true', supabaseUrl: 'https://real-production.supabase.co' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ nodeEnv: 'development', vercel: '1', explicitFlag: 'true', supabaseUrl: CANONICAL_SUPABASE_URL })).toBe(false)
  })

  it('is disabled by default in test runtime', () => {
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', '')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', CANONICAL_SUPABASE_URL)
    expect(isTestRoleSwitchEnabled()).toBe(false)
    vi.unstubAllEnvs()
  })

  it('blijft gesloten met een stale flag in de productieomgeving', () => {
    vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED', 'true')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', CANONICAL_SUPABASE_URL)
    expect(isTestRoleSwitchEnabled()).toBe(false)
    vi.unstubAllEnvs()
  })

  it('gebruikt alleen de vaste synthetische HR Admin met een servercredential', () => {
    expect(getTestAuthHarnessCredentials('hr-admin', 'synthetic-password')).toEqual({
      email: 'hradmin.fixture@liquidhr.test',
      password: 'synthetic-password',
    })
    expect(getTestAuthHarnessCredentials('hr-admin', '')).toBeNull()
    expect(getTestAuthHarnessCredentials('manager', 'synthetic-password')).toBeNull()
    expect(getTestAuthHarnessCredentials('employee', 'synthetic-password')).toBeNull()
    expect(getTestAuthHarnessCredentials('edwin', 'synthetic-password')).toBeNull()
    expect(getTestAuthHarnessCredentials('arbitrary-user', 'synthetic-password')).toBeNull()
  })
})
