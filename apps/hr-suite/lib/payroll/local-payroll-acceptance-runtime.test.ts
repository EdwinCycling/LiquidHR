import { describe, expect, it } from 'vitest'
import {
  isLocalPayrollAcceptanceRuntime,
  isLocalPayrollAcceptanceScope,
  LOCAL_PAYROLL_ACCEPTANCE_SCOPE,
  PAYROLL_LAB_TEST_PROJECT_REF,
} from './local-payroll-acceptance-runtime'

const localEnvironment = {
  nodeEnv: 'development',
  explicitFlag: 'true',
  supabaseUrl: 'https://wnpfloqpjvaacobppbpk.supabase.co',
  payrollLabEnabled: 'true',
  payrollLabUrl: `https://${PAYROLL_LAB_TEST_PROJECT_REF}.supabase.co`,
}

describe('local Payroll acceptance runtime guard', () => {
  it('opens only for localhost with Development, both canonical TEST projects, and explicit flags', () => {
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', localEnvironment)).toBe(true)
    expect(isLocalPayrollAcceptanceRuntime('127.0.0.1:3010', localEnvironment)).toBe(true)
  })

  it('keeps hosted, noncanonical, and disabled environments closed', () => {
    expect(isLocalPayrollAcceptanceRuntime('payroll.example.test', localEnvironment)).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, vercel: '1' })).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, vercelEnv: 'preview' })).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, supabaseUrl: 'https://other.supabase.co' })).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, payrollLabUrl: 'https://other.supabase.co' })).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, payrollLabUrl: `https://user@${PAYROLL_LAB_TEST_PROJECT_REF}.supabase.co` })).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, payrollLabUrl: `https://${PAYROLL_LAB_TEST_PROJECT_REF}.supabase.co.evil.test` })).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, payrollLabEnabled: 'false' })).toBe(false)
    expect(isLocalPayrollAcceptanceRuntime('localhost:3010', { ...localEnvironment, explicitFlag: 'false' })).toBe(false)
  })

  it('accepts only the explicitly selected Mars source and Payroll Lab administrations', () => {
    const { payrollAdministrationId } = LOCAL_PAYROLL_ACCEPTANCE_SCOPE
    const scope = {
      tenantId: LOCAL_PAYROLL_ACCEPTANCE_SCOPE.tenantId,
      hrGroupId: LOCAL_PAYROLL_ACCEPTANCE_SCOPE.hrGroupId,
      administrationId: LOCAL_PAYROLL_ACCEPTANCE_SCOPE.sourceAdministrationId,
    }
    expect(isLocalPayrollAcceptanceScope(scope, payrollAdministrationId)).toBe(true)
    expect(isLocalPayrollAcceptanceScope({ ...scope, administrationId: '88888888-8888-4888-8888-888888888888' }, payrollAdministrationId)).toBe(false)
    expect(isLocalPayrollAcceptanceScope(scope, '99999999-9999-4999-8999-999999999999')).toBe(false)
  })
})
