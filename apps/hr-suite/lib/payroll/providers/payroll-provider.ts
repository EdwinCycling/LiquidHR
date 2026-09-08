import type { PayrollConnectionStatus, PayrollProviderCapability } from '@/lib/payroll/domain/types'

export type PayrollProviderContext = {
  tenantId: string
  hrGroupId: string
  connectionId: string
}

export type PayrollConnectionHealth = {
  status: Exclude<PayrollConnectionStatus, 'NOT_CONNECTED' | 'CONNECTING'>
  resultCode: string
  checkedAt: string
}

export type PayrollProvider = {
  code: string
  capabilities: readonly PayrollProviderCapability[]
  getConnectionHealth?: (context: PayrollProviderContext) => Promise<PayrollConnectionHealth>
  createAuthorizationRequest?: (context: PayrollProviderContext) => Promise<never>
  exchangeAuthorizationCode?: (input: { code: string; state: string }) => Promise<never>
  refreshCredentials?: (context: PayrollProviderContext) => Promise<never>
  disconnect?: (context: PayrollProviderContext) => Promise<void>
  listCompanies?: (context: PayrollProviderContext) => Promise<never>
  listEmployees?: (context: PayrollProviderContext, companyId: string) => Promise<never>
}

export class PayrollProviderError extends Error {
  constructor(public readonly code: string, public readonly status = 501) {
    super(code)
    this.name = 'PayrollProviderError'
  }
}
