import { describe, expect, it } from 'vitest'
import {
  canInitiateTestRoleSwitch,
  canReturnToLocalPersonaOwner,
  canUseLocalPersonaSwitcher,
  getAvailableTestRoleSwitchTarget,
  getTestRoleSwitchTarget,
  isLocalhostHost,
  isLocalPersonaRuntime,
  isTestRoleSwitchAccount,
  isTestRoleSwitchEnabled,
  resolveSupabaseProjectRef,
  TEST_ROLE_SWITCH_TARGETS,
} from '@/lib/auth/test-role-switch'

const CANONICAL_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co'
const localEnvironment = {
  nodeEnv: 'development',
  vercel: '',
  vercelEnv: '',
  vercelUrl: '',
  explicitFlag: 'true',
  supabaseUrl: CANONICAL_SUPABASE_URL,
}

describe('local persona switch authorization', () => {
  it('uses the fixed supported account keys and marks Jaap and Frits unavailable', () => {
    expect(TEST_ROLE_SWITCH_TARGETS.map((target) => target.key)).toEqual([
      'edwin', 'hr-admin', 'manager', 'employee', 'payroll-lisa', 'payroll-jaap', 'payroll-frits',
    ])
    expect(TEST_ROLE_SWITCH_TARGETS.filter((target) => !target.available).map((target) => target.key)).toEqual([
      'payroll-jaap', 'payroll-frits',
    ])
    expect(getTestRoleSwitchTarget('manager')?.email).toBe('manager.fixture@liquidhr.test')
    expect(getAvailableTestRoleSwitchTarget('payroll-jaap')).toBeNull()
    expect(getTestRoleSwitchTarget('unknown')).toBeNull()
  })

  it('recognizes only the fixed identities', () => {
    expect(isTestRoleSwitchAccount('EDWIN@EDITSOLUTIONS.NL')).toBe(true)
    expect(isTestRoleSwitchAccount('hradmin.fixture@liquidhr.test')).toBe(true)
    expect(isTestRoleSwitchAccount('other@example.com')).toBe(false)
  })

  it('keeps the former business-role guard distinct from the local owner capability', () => {
    expect(canInitiateTestRoleSwitch(['HR_ADMIN'])).toBe(true)
    expect(canInitiateTestRoleSwitch(['TENANT_ADMIN'])).toBe(true)
    expect(canInitiateTestRoleSwitch(['MANAGER'])).toBe(false)
    expect(canInitiateTestRoleSwitch(['EMPLOYEE'])).toBe(false)
    expect(canInitiateTestRoleSwitch([])).toBe(false)
    expect(canUseLocalPersonaSwitcher('127.0.0.1:3010', {
      email: 'edwin@editsolutions.nl',
      emailVerified: true,
    }, localEnvironment)).toBe(true)
  })

  it('requires a verified owner and the exact local Development environment', () => {
    const owner = { email: 'edwin@editsolutions.nl', emailVerified: true }
    expect(canUseLocalPersonaSwitcher('localhost:3010', owner, localEnvironment)).toBe(true)
    expect(canUseLocalPersonaSwitcher('localhost:3010', { ...owner, emailVerified: false }, localEnvironment)).toBe(false)
    expect(canUseLocalPersonaSwitcher('localhost:3010', { ...owner, email: 'other@example.com' }, localEnvironment)).toBe(false)
    expect(canUseLocalPersonaSwitcher('app.example.com', owner, localEnvironment)).toBe(false)
    expect(canUseLocalPersonaSwitcher('localhost:3010', owner, { ...localEnvironment, explicitFlag: 'false' })).toBe(false)
    expect(canUseLocalPersonaSwitcher('localhost:3010', owner, { ...localEnvironment, supabaseUrl: 'https://other-project.supabase.co' })).toBe(false)
    expect(canUseLocalPersonaSwitcher('localhost:3010', owner, { ...localEnvironment, vercelEnv: 'preview' })).toBe(false)
    expect(canUseLocalPersonaSwitcher('localhost:3010', owner, { ...localEnvironment, nodeEnv: 'production' })).toBe(false)
  })

  it('allows a verified fixed persona only to return to Edwin', () => {
    const manager = { email: 'manager.fixture@liquidhr.test', emailVerified: true }
    expect(canReturnToLocalPersonaOwner('127.0.0.1:3010', manager, localEnvironment)).toBe(true)
    expect(canReturnToLocalPersonaOwner('127.0.0.1:3010', { ...manager, emailVerified: false }, localEnvironment)).toBe(false)
    expect(canReturnToLocalPersonaOwner('127.0.0.1:3010', { ...manager, email: 'other@example.com' }, localEnvironment)).toBe(false)
    expect(canReturnToLocalPersonaOwner('preview.example.com', manager, localEnvironment)).toBe(false)
    expect(canReturnToLocalPersonaOwner('127.0.0.1:3010', { email: 'edwin@editsolutions.nl', emailVerified: true }, localEnvironment)).toBe(false)
  })

  it('accepts loopback hosts and rejects lookalike or forwarded host values', () => {
    expect(isLocalhostHost('localhost:3010')).toBe(true)
    expect(isLocalhostHost('127.0.0.1:3010')).toBe(true)
    expect(isLocalhostHost('[::1]:3000')).toBe(true)
    expect(isLocalhostHost('localhost.example.com')).toBe(false)
    expect(isLocalhostHost('localhost:3010, attacker.example')).toBe(false)
    expect(isLocalhostHost('attacker.example')).toBe(false)
  })

  it('requires the explicit flag, local Development, no Vercel runtime and the canonical Core TEST project', () => {
    expect(isTestRoleSwitchEnabled(localEnvironment)).toBe(true)
    expect(isLocalPersonaRuntime('127.0.0.1:3010', localEnvironment)).toBe(true)
    expect(isTestRoleSwitchEnabled({ ...localEnvironment, explicitFlag: 'false' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ ...localEnvironment, supabaseUrl: 'https://other-project.supabase.co' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ ...localEnvironment, nodeEnv: 'production' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ ...localEnvironment, vercelEnv: 'preview' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ ...localEnvironment, vercel: '1' })).toBe(false)
    expect(isTestRoleSwitchEnabled({ ...localEnvironment, vercelUrl: 'local-override.vercel.app' })).toBe(false)
  })

  it('resolves only a bare Supabase project URL', () => {
    expect(resolveSupabaseProjectRef(CANONICAL_SUPABASE_URL)).toBe('wnpfloqpjvaacobppbpk')
    expect(resolveSupabaseProjectRef('https://wnpfloqpjvaacobppbpk.supabase.co/rest/v1')).toBeNull()
    expect(resolveSupabaseProjectRef('not-a-url')).toBeNull()
  })
})
