import { PAYROLL_PROVIDER_CAPABILITIES } from '@/lib/payroll/domain/types'
import { PayrollProviderError, type PayrollProvider } from '@/lib/payroll/providers/payroll-provider'
import { createNmbrsClient } from './client'

function client() {
  return createNmbrsClient()
}

export const nmbrsPayrollProvider: PayrollProvider = {
  code: 'NMBRS',
  capabilities: PAYROLL_PROVIDER_CAPABILITIES,
  async createAuthorizationRequest(input) {
    return { authorizationUrl: client().buildAuthorizationUrl(input) }
  },
  async exchangeAuthorizationCode(input) {
    return client().exchangeAuthorizationCode(input)
  },
  async refreshCredentials(input) {
    return client().refreshCredentials(input.refreshToken)
  },
  async getConnectionHealth(input) {
    return client().getConnectionHealth(input.accessToken)
  },
  async listCompanies(input) {
    return client().listCompanies(input.accessToken)
  },
  async revokeCredentials(input) {
    return client().revokeCredentials(input)
  },
}

export function getPayrollProvider(code: string): PayrollProvider {
  if (code === 'NMBRS') return nmbrsPayrollProvider
  throw new PayrollProviderError('PAYROLL_PROVIDER_NOT_SUPPORTED', 422)
}
