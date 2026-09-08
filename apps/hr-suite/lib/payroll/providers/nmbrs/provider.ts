import { PAYROLL_PROVIDER_CAPABILITIES } from '@/lib/payroll/domain/types'
import { PayrollProviderError, type PayrollProvider } from '@/lib/payroll/providers/payroll-provider'

// De adaptergrens bestaat in P0; netwerk-, OAuth- en employee-operaties volgen pas in P1/P2.
export const nmbrsPayrollProvider: PayrollProvider = {
  code: 'NMBRS',
  capabilities: PAYROLL_PROVIDER_CAPABILITIES,
  async createAuthorizationRequest() {
    throw new PayrollProviderError('NMBRS_OAUTH_NOT_AVAILABLE_IN_P0')
  },
  async exchangeAuthorizationCode() {
    throw new PayrollProviderError('NMBRS_OAUTH_NOT_AVAILABLE_IN_P0')
  },
  async refreshCredentials() {
    throw new PayrollProviderError('NMBRS_OAUTH_NOT_AVAILABLE_IN_P0')
  },
  async listCompanies() {
    throw new PayrollProviderError('NMBRS_COMPANY_DISCOVERY_NOT_AVAILABLE_IN_P0')
  },
  async listEmployees() {
    throw new PayrollProviderError('NMBRS_EMPLOYEE_READ_NOT_AVAILABLE_IN_P0')
  },
}
