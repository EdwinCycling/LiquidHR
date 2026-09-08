import { describe, expect, it } from 'vitest'
import { nmbrsPayrollProvider } from './provider'

describe('Nmbrs Payroll adapter skeleton', () => {
  it('exposes the provider-neutral capability boundary without making a network call', async () => {
    expect(nmbrsPayrollProvider.code).toBe('NMBRS')
    await expect(nmbrsPayrollProvider.createAuthorizationRequest?.({ tenantId: 'tenant', hrGroupId: 'group', connectionId: 'connection' })).rejects.toMatchObject({ code: 'NMBRS_OAUTH_NOT_AVAILABLE_IN_P0' })
    await expect(nmbrsPayrollProvider.listCompanies?.({ tenantId: 'tenant', hrGroupId: 'group', connectionId: 'connection' })).rejects.toMatchObject({ code: 'NMBRS_COMPANY_DISCOVERY_NOT_AVAILABLE_IN_P0' })
  })
})
