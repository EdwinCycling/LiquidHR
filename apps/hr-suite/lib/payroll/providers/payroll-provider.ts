import type { PayrollConnectionStatus, PayrollProviderCapability, PayrollProviderCompany } from '@/lib/payroll/domain/types'

export type PayrollConnectionHealth = {
  status: Exclude<PayrollConnectionStatus, 'NOT_CONNECTED' | 'CONNECTING'>
  resultCode: string
  checkedAt: string
}

export type PayrollTokenSet = {
  accessToken: string
  refreshToken: string | null
  expiresAt: string
  scope: string | null
}

export type PayrollProviderCompanyMetadata = Pick<PayrollProviderCompany, 'externalCompanyId' | 'externalCompanyNumber' | 'externalCompanyDisplayName' | 'externalDebtorId'>

export type PayrollProvider = {
  code: string
  capabilities: readonly PayrollProviderCapability[]
  createAuthorizationRequest?: (input: { redirectUri: string; state: string }) => Promise<{ authorizationUrl: string }>
  exchangeAuthorizationCode?: (input: { code: string; redirectUri: string }) => Promise<PayrollTokenSet>
  refreshCredentials?: (input: { refreshToken: string }) => Promise<PayrollTokenSet>
  getConnectionHealth?: (input: { accessToken: string }) => Promise<PayrollConnectionHealth>
  listCompanies?: (input: { accessToken: string }) => Promise<PayrollProviderCompanyMetadata[]>
  revokeCredentials?: (input: { accessToken: string; refreshToken: string | null }) => Promise<void>
}

export class PayrollProviderError extends Error {
  constructor(public readonly code: string, public readonly status = 501) {
    super(code)
    this.name = 'PayrollProviderError'
  }
}
