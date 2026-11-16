import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('fiscal profile query projection', () => {
  it('uses an explicit projection for all source and dossier reads', () => {
    const source = readFileSync(new URL('./employment-payroll-tax-profile-service.ts', import.meta.url), 'utf8')
    expect(source.match(/from\('employment_payroll_tax_profiles'\)\.select\(TAX_PROFILE_READ_COLUMNS\)/g)).toHaveLength(3)
    expect(source).not.toMatch(/from\('employment_payroll_tax_profiles'\)\.select\('\*'\)/)
    const columns = /const TAX_PROFILE_READ_COLUMNS = '([^']+)'/.exec(source)?.[1]?.split(',') ?? []
    expect(columns).toContain('payroll_tax_credit_applies')
    expect(columns).toContain('source_reference')
    expect(columns).toContain('confirmed_at')
    expect(columns).not.toContain('idempotency_key')
  })
})
