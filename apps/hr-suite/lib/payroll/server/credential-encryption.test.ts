import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptPayrollCredential, encryptPayrollCredential, PayrollCredentialError } from './credential-encryption'

describe('Payroll credential envelope', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('round-trips an encrypted credential without exposing plaintext in the envelope', () => {
    vi.stubEnv('PAYROLL_CREDENTIAL_ENCRYPTION_KEY', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    const envelope = encryptPayrollCredential('token-fixture-value')
    expect(envelope).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(envelope).not.toContain('token-fixture-value')
    expect(decryptPayrollCredential(envelope)).toBe('token-fixture-value')
  })

  it('rejects tampered ciphertext and missing configuration', () => {
    vi.stubEnv('PAYROLL_CREDENTIAL_ENCRYPTION_KEY', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    const envelope = encryptPayrollCredential('token-fixture-value')
    expect(() => decryptPayrollCredential(`${envelope}x`)).toThrowError(new PayrollCredentialError('PAYROLL_CREDENTIAL_CIPHERTEXT_INVALID'))
    vi.stubEnv('PAYROLL_CREDENTIAL_ENCRYPTION_KEY', '')
    expect(() => encryptPayrollCredential('token-fixture-value')).toThrowError(new PayrollCredentialError('PAYROLL_CREDENTIAL_ENCRYPTION_KEY_MISSING'))
  })
})
