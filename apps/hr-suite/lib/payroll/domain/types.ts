export const PAYROLL_PROVIDER_CODE = 'NMBRS' as const

export const PAYROLL_PROVIDER_CAPABILITIES = [
  'AUTH_OAUTH',
  'COMPANY_DISCOVERY',
  'CONNECTION_HEALTH',
] as const

export type PayrollProviderCapability = (typeof PAYROLL_PROVIDER_CAPABILITIES)[number]
export type PayrollConnectionStatus = 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ACTION_REQUIRED' | 'ERROR' | 'DISCONNECTED'
export type PayrollBindingStatus = 'ACTIVE' | 'INACTIVE'
export type PayrollSyncMode = 'PREVIEW' | 'APPLY'
export type PayrollSyncRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export type PayrollProvider = {
  id: string
  code: string
  name: string
  isActive: boolean
  capabilities: readonly PayrollProviderCapability[]
}

export type PayrollConnection = {
  id: string
  providerId: string
  status: PayrollConnectionStatus
  connectedAt: string | null
  connectedByUserId: string | null
  lastCheckedAt: string | null
  lastErrorCode: string | null
  disconnectedAt: string | null
}

export type PayrollCompanyBinding = {
  id: string
  connectionId: string
  administrationId: string
  externalCompanyId: string
  externalCompanyDisplayName: string
  status: PayrollBindingStatus
  boundAt: string | null
  unboundAt: string | null
}

export type PayrollProviderCompany = {
  id: string
  connectionId: string
  externalCompanyId: string
  externalCompanyNumber: string | null
  externalCompanyDisplayName: string
  externalDebtorId: string | null
  status: 'ACTIVE' | 'INACTIVE'
  firstSeenAt: string
  lastSeenAt: string
}

export type PayrollAdministration = {
  id: string
  code: string
  name: string
}

export type PayrollSyncRun = {
  id: string
  connectionId: string
  companyBindingId: string | null
  mode: PayrollSyncMode
  status: PayrollSyncRunStatus
  startedAt: string | null
  completedAt: string | null
  summary: Record<string, unknown>
  errorCode: string | null
}
