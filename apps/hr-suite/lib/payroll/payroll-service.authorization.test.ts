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
import { bindPayrollCompany, getPayrollWorkspaceData, unbindPayrollCompany } from './payroll-service'

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

    harness.isPayrollLabEnabled.mockReturnValueOnce(false)
    await expect(getPayrollWorkspaceData()).rejects.toMatchObject({ code: 'PAYROLL_FEATURE_UNAVAILABLE', status: 404 })
    expect(harness.requireTenantModule).not.toHaveBeenCalled()
    expect(harness.createClient).not.toHaveBeenCalled()

    harness.requirePermission.mockResolvedValueOnce(authContext)
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

  it('treats an out-of-scope binding identifier as not found and never mutates it', async () => {
    await expect(unbindPayrollCompany(bindingId)).rejects.toMatchObject({ code: 'PAYROLL_BINDING_NOT_FOUND', status: 404 })

    const read = harness.adminQueries.find((query) => query.table === 'payroll_company_bindings')
    expect(read?.filters).toContainEqual(['tenant_id', tenantId])
    expect(read?.filters).toContainEqual(['hr_group_id', hrGroupId])
    expect(read?.filters).toContainEqual(['id', bindingId])
    expect(harness.adminQueries.some((query) => query.table === 'payroll_audit_events' || query.operation === 'update')).toBe(false)
  })

  it('rejects binding an administration outside the active tenant and HR group', async () => {
    const providerCompany = {
      id: companyId,
      connection_id: connectionId,
      external_company_id: 'nmbrs-company-42',
      external_company_number: null,
      external_company_display_name: 'Example BV',
      external_debtor_id: null,
      status: 'ACTIVE',
      last_seen_at: '2026-10-11T00:00:00.000Z',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
    }
    const connection = { id: connectionId, provider_id: 'provider-1', status: 'CONNECTED', tenant_id: tenantId, hr_group_id: hrGroupId }
    const provider = { id: 'provider-1', code: 'NMBRS', name: 'Nmbrs', is_active: true, capabilities: [] }
    harness.createAdminClient.mockImplementation(() => makeAdminClient((table) => {
      if (table === 'payroll_provider_companies') return providerCompany
      if (table === 'payroll_connections') return connection
      if (table === 'payroll_providers') return provider
      if (table === 'administrations') return null
      return null
    }))

    await expect(bindPayrollCompany({ providerCompanyId: companyId, administrationId })).rejects.toMatchObject({ code: 'PAYROLL_ADMINISTRATION_NOT_FOUND', status: 404 })

    const administrationRead = harness.adminQueries.find((query) => query.table === 'administrations')
    expect(administrationRead?.filters).toContainEqual(['tenant_id', tenantId])
    expect(administrationRead?.filters).toContainEqual(['hr_group_id', hrGroupId])
    expect(administrationRead?.filters).toContainEqual(['id', administrationId])
    expect(administrationRead?.filters).toContainEqual(['is_active', true])
    expect(harness.adminQueries.some((query) => query.table === 'payroll_company_bindings' && ['insert', 'update'].includes(query.operation))).toBe(false)
  })

  it('returns an existing active binding on repeat requests without another write or audit event', async () => {
    const providerCompany = {
      id: companyId,
      connection_id: connectionId,
      external_company_id: 'nmbrs-company-42',
      external_company_number: '42',
      external_company_display_name: 'Example BV',
      external_debtor_id: null,
      status: 'ACTIVE',
      last_seen_at: '2026-10-11T00:00:00.000Z',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
    }
    const connection = { id: connectionId, provider_id: 'provider-1', status: 'CONNECTED', tenant_id: tenantId, hr_group_id: hrGroupId }
    const provider = { id: 'provider-1', code: 'NMBRS', name: 'Nmbrs', is_active: true, capabilities: [] }
    const existingBinding = {
      id: bindingId,
      connection_id: connectionId,
      administration_id: administrationId,
      external_company_id: providerCompany.external_company_id,
      external_company_display_name: providerCompany.external_company_display_name,
      status: 'ACTIVE',
      bound_at: '2026-10-10T00:00:00.000Z',
      unbound_at: null,
    }
    const resolve = (table: string, operation: string, payload: unknown, filters: Array<[string, unknown]>) => {
      if (table === 'payroll_provider_companies') return providerCompany
      if (table === 'payroll_connections') return connection
      if (table === 'payroll_providers') return provider
      if (table === 'administrations') return { id: administrationId }
      if (table === 'payroll_company_bindings' && operation === 'select') {
        const status = filters.find(([column]) => column === 'status')?.[1]
        if (status === 'ACTIVE') return existingBinding
      }
      return null
    }
    harness.createAdminClient.mockImplementation(() => makeAdminClient(resolve))

    const first = await bindPayrollCompany({ providerCompanyId: companyId, administrationId })
    const second = await bindPayrollCompany({ providerCompanyId: companyId, administrationId })

    expect(first).toEqual(second)
    expect(first).toMatchObject({ id: bindingId, status: 'ACTIVE' })
    expect(harness.adminQueries.some((query) => query.table === 'payroll_company_bindings' && ['insert', 'update'].includes(query.operation))).toBe(false)
    expect(harness.adminQueries.some((query) => query.table === 'payroll_audit_events')).toBe(false)
  })

  it('records a scoped audit event when a company binding is created', async () => {
    const providerCompany = {
      id: companyId,
      connection_id: connectionId,
      external_company_id: 'nmbrs-company-42',
      external_company_number: '42',
      external_company_display_name: 'Example BV',
      external_debtor_id: null,
      status: 'ACTIVE',
      last_seen_at: '2026-10-11T00:00:00.000Z',
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
    }
    const connection = { id: connectionId, provider_id: 'provider-1', status: 'CONNECTED', tenant_id: tenantId, hr_group_id: hrGroupId }
    const provider = { id: 'provider-1', code: 'NMBRS', name: 'Nmbrs', is_active: true, capabilities: [] }
    const createdBinding = {
      id: bindingId,
      connection_id: connectionId,
      administration_id: administrationId,
      external_company_id: providerCompany.external_company_id,
      external_company_display_name: providerCompany.external_company_display_name,
      status: 'ACTIVE',
      bound_at: '2026-10-11T00:00:00.000Z',
      unbound_at: null,
    }
    const resolve = (table: string, operation: string) => {
      if (table === 'payroll_provider_companies') return providerCompany
      if (table === 'payroll_connections') return connection
      if (table === 'payroll_providers') return provider
      if (table === 'administrations') return { id: administrationId }
      if (table === 'payroll_company_bindings' && operation === 'insert') return createdBinding
      return null
    }
    harness.createAdminClient.mockImplementation(() => makeAdminClient(resolve))

    await expect(bindPayrollCompany({ providerCompanyId: companyId, administrationId })).resolves.toMatchObject({ id: bindingId, status: 'ACTIVE' })

    const bindingWrite = harness.adminQueries.find((query) => query.table === 'payroll_company_bindings' && query.operation === 'insert')
    expect(bindingWrite?.payload).toMatchObject({ tenant_id: tenantId, hr_group_id: hrGroupId, connection_id: connectionId, administration_id: administrationId })
    const audit = harness.adminQueries.find((query) => query.table === 'payroll_audit_events')
    expect(audit?.payload).toMatchObject({
      tenant_id: tenantId,
      hr_group_id: hrGroupId,
      provider_id: 'provider-1',
      connection_id: connectionId,
      company_binding_id: bindingId,
      administration_id: administrationId,
      actor_user_id: userId,
      event_type: 'PAYROLL_COMPANY_BOUND',
      result_code: 'NMBRS_COMPANY_BOUND',
      reference_data: { externalCompanyId: providerCompany.external_company_id },
    })
  })
})
