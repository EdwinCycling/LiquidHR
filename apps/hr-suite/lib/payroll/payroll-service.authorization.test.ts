import { beforeEach, describe, expect, it, vi } from 'vitest'

const { harness } = vi.hoisted(() => ({
  harness: {
    requirePermission: vi.fn(),
    requireTenantModule: vi.fn(),
    isPayrollLabEnabled: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    getPayrollProvider: vi.fn(),
    clientQueries: [] as Array<{ table: string; operation: string; payload: unknown; filters: Array<[string, unknown]> }>,
    adminQueries: [] as Array<{ table: string; operation: string; payload: unknown; filters: Array<[string, unknown]> }>,
  },
}))

vi.mock('@/lib/auth/permissions', () => ({
  requireHrGroupId: (auth: { hrGroupId: string }) => auth.hrGroupId,
  requirePermission: harness.requirePermission,
  permissionErrorResponse: () => null,
}))

vi.mock('@/lib/modules/module-service', () => {
  class ModuleError extends Error {
    constructor(public readonly code: string, public readonly status: number) { super(code) }
  }
  return { ModuleError, requireTenantModule: harness.requireTenantModule }
})
vi.mock('@/lib/payroll/feature-flag', () => ({ isPayrollLabEnabled: harness.isPayrollLabEnabled }))

vi.mock('@/lib/supabase/server', () => ({ createClient: harness.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: harness.createAdminClient }))
vi.mock('@/lib/payroll/providers/nmbrs/provider', () => ({ getPayrollProvider: harness.getPayrollProvider }))
vi.mock('@/lib/payroll/providers/nmbrs/client', () => ({
  createNmbrsClient: vi.fn(() => ({ redirectUri: 'https://example.test/callback' })),
  isNmbrsUnauthorized: vi.fn(() => false),
  NMBRS_P1_SCOPES: ['offline_access', 'company.info.read'],
}))
vi.mock('@/lib/payroll/providers/payroll-provider', () => ({
  PayrollProviderError: class PayrollProviderError extends Error {
    constructor(public readonly code: string, public readonly status: number) { super(code) }
  },
}))
vi.mock('@/lib/payroll/server/credential-encryption', () => ({
  assertPayrollCredentialEncryptionConfigured: vi.fn(),
  decryptPayrollCredential: vi.fn(),
  encryptPayrollCredential: vi.fn(),
  PayrollCredentialError: class PayrollCredentialError extends Error {
    constructor(public readonly code: string) { super(code) }
  },
}))
vi.mock('@/lib/payroll/server/private-client', () => ({
  createPayrollPrivateClient: vi.fn(),
  privateRow: (value: unknown) => value,
}))

import { ModuleError } from '@/lib/modules/module-service'
import {
  bindPayrollCompany,
  checkNmbrsConnection,
  completeNmbrsAuthorization,
  disconnectNmbrsConnection,
  discoverNmbrsCompanies,
  failNmbrsAuthorization,
  getPayrollWorkspaceData,
  startNmbrsAuthorization,
  unbindPayrollCompany,
} from './payroll-service'

const tenantId = '50000000-0000-4000-8000-000000000001'
const hrGroupId = '50000000-0000-4000-8000-000000000002'
const userId = '50000000-0000-4000-8000-000000000003'
const connectionId = '50000000-0000-4000-8000-000000000004'
const companyId = '50000000-0000-4000-8000-000000000005'
const administrationId = '50000000-0000-4000-8000-000000000006'
const bindingId = '50000000-0000-4000-8000-000000000007'

function queryBuilder(
  table: string,
  queries: Array<{ table: string; operation: string; payload: unknown; filters: Array<[string, unknown]> }>,
  resolve: (table: string, operation: string, payload: unknown, filters: Array<[string, unknown]>) => unknown,
) {
  let operation = 'select'
  let payload: unknown = null
  const filters: Array<[string, unknown]> = []
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (column: string, value: unknown) => { filters.push([column, value]); return builder },
    neq: (column: string, value: unknown) => { filters.push([`not:${column}`, value]); return builder },
    order: () => builder,
    limit: () => builder,
    update: (value: unknown) => { operation = 'update'; payload = value; return builder },
    insert: (value: unknown) => { operation = 'insert'; payload = value; return builder },
    upsert: (value: unknown) => { operation = 'upsert'; payload = value; return builder },
    maybeSingle: async () => {
      queries.push({ table, operation, payload, filters: [...filters] })
      return { data: resolve(table, operation, payload, filters), error: null }
    },
    single: async () => {
      queries.push({ table, operation, payload, filters: [...filters] })
      return { data: resolve(table, operation, payload, filters), error: null }
    },
    then: (resolvePromise: (value: unknown) => unknown, rejectPromise: (error: unknown) => unknown) => {
      queries.push({ table, operation, payload, filters: [...filters] })
      return Promise.resolve({ data: resolve(table, operation, payload, filters), error: null }).then(resolvePromise, rejectPromise)
    },
  }
  return builder
}

function makeAdminClient(resolve: (table: string, operation: string, payload: unknown, filters: Array<[string, unknown]>) => unknown = () => null) {
  return {
    from(table: string) {
      return queryBuilder(table, harness.adminQueries, resolve)
    },
  }
}

const authContext = { tenantId, hrGroupId, userId, permissions: ['payroll:read', 'payroll:manage'] }

beforeEach(() => {
  harness.clientQueries.length = 0
  harness.adminQueries.length = 0
  harness.requirePermission.mockReset().mockResolvedValue(authContext)
  harness.requireTenantModule.mockReset().mockResolvedValue(undefined)
  harness.isPayrollLabEnabled.mockReset().mockReturnValue(true)
  harness.createClient.mockReset().mockImplementation(async () => ({
    from(table: string) {
      return queryBuilder(table, harness.clientQueries, () => [])
    },
  }))
  harness.createAdminClient.mockReset().mockImplementation(() => makeAdminClient())
  harness.getPayrollProvider.mockReset().mockReturnValue({ code: 'NMBRS' })
})

describe('Payroll integration authorization and scope', () => {
  it('requires payroll read permission and PAYROLL module activation before database reads', async () => {
    harness.requirePermission.mockRejectedValueOnce(new Error('permission required'))
    await expect(getPayrollWorkspaceData()).rejects.toThrow('permission required')
    expect(harness.requireTenantModule).not.toHaveBeenCalled()
    expect(harness.createClient).not.toHaveBeenCalled()

    harness.requireTenantModule.mockRejectedValueOnce(new ModuleError('MODULE_NOT_ACTIVE', 404))
    await expect(getPayrollWorkspaceData()).rejects.toMatchObject({ code: 'MODULE_NOT_ACTIVE', status: 404 })
    expect(harness.createClient).not.toHaveBeenCalled()
  })

  it('scopes every non-catalog workspace read to the authenticated tenant and HR group', async () => {
    await getPayrollWorkspaceData()

    const scopedTables = ['payroll_connections', 'payroll_provider_companies', 'payroll_company_bindings', 'administrations', 'payroll_sync_runs']
    for (const table of scopedTables) {
      const query = harness.clientQueries.find((item) => item.table === table)
      expect(query?.filters).toContainEqual(['tenant_id', tenantId])
      expect(query?.filters).toContainEqual(['hr_group_id', hrGroupId])
    }
    expect(harness.requirePermission).toHaveBeenCalledWith('payroll:read')
    expect(harness.requireTenantModule).toHaveBeenCalledWith('PAYROLL')
  })

  it('keeps Nmbrs authorization, discovery, mapping, and disconnect operations disabled before I/O', async () => {
    const disabled = { code: 'PAYROLL_EXTERNAL_INTEGRATION_DISABLED', status: 410 }
    await expect(startNmbrsAuthorization()).rejects.toMatchObject(disabled)
    await expect(completeNmbrsAuthorization({ state: 'state', code: 'code' })).rejects.toMatchObject(disabled)
    await expect(failNmbrsAuthorization({ state: 'state' })).rejects.toMatchObject(disabled)
    await expect(checkNmbrsConnection(connectionId)).rejects.toMatchObject(disabled)
    await expect(discoverNmbrsCompanies(connectionId)).rejects.toMatchObject(disabled)
    await expect(bindPayrollCompany({ providerCompanyId: companyId, administrationId })).rejects.toMatchObject(disabled)
    await expect(unbindPayrollCompany(bindingId)).rejects.toMatchObject(disabled)
    await expect(disconnectNmbrsConnection(connectionId)).rejects.toMatchObject(disabled)

    expect(harness.requirePermission).not.toHaveBeenCalled()
    expect(harness.createClient).not.toHaveBeenCalled()
    expect(harness.createAdminClient).not.toHaveBeenCalled()
    expect(harness.getPayrollProvider).not.toHaveBeenCalled()
  })
})
