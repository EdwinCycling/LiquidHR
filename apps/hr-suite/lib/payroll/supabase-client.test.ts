import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPayrollSupabaseClient, PayrollDatabaseConfigurationError } from './supabase-client'

describe('Payroll Supabase client configuration', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('rejects the LiquidHR Core Supabase project even when configured with HTTPS', () => {
    vi.stubEnv('PAYROLL_SUPABASE_URL', 'https://wnpfloqpjvaacobppbpk.supabase.co')
    vi.stubEnv('PAYROLL_SUPABASE_SECRET_KEY', 'test-only-not-a-secret')

    expect(() => createPayrollSupabaseClient()).toThrow(PayrollDatabaseConfigurationError)
  })

  it('rejects non-HTTPS database URLs', () => {
    vi.stubEnv('PAYROLL_SUPABASE_URL', 'http://payroll-lab.supabase.co')
    vi.stubEnv('PAYROLL_SUPABASE_SECRET_KEY', 'test-only-not-a-secret')

    expect(() => createPayrollSupabaseClient()).toThrow(PayrollDatabaseConfigurationError)
  })

  it.each([
    'https://other-project.supabase.co',
    'https://jhgeriucbkfarxiudzfy.supabase.co/other',
    'https://jhgeriucbkfarxiudzfy.supabase.co?redirect=core',
    'https://fixture:fixture@jhgeriucbkfarxiudzfy.supabase.co',
  ])('rejects a target outside the verified Payroll Lab: %s', (url) => {
    vi.stubEnv('PAYROLL_SUPABASE_URL', url)
    vi.stubEnv('PAYROLL_SUPABASE_SECRET_KEY', 'test-only-not-a-secret')
    expect(() => createPayrollSupabaseClient()).toThrow(PayrollDatabaseConfigurationError)
  })

  it('accepts only the verified Payroll Lab target', () => {
    vi.stubEnv('PAYROLL_SUPABASE_URL', 'https://jhgeriucbkfarxiudzfy.supabase.co')
    vi.stubEnv('PAYROLL_SUPABASE_SECRET_KEY', 'test-only-not-a-secret')
    expect(() => createPayrollSupabaseClient()).not.toThrow()
  })
})
