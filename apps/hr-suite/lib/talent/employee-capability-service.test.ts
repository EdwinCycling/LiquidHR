import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requirePermission, requireTenantModule } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/auth/permissions', () => ({ requirePermission }))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule }))
vi.mock('@/lib/api-v1/auth/bearer-rls', () => ({ assertDelegatedBearerRlsClient: vi.fn() }))

import { listTalentEmployeeCapabilityRecords } from './employee-capability-service'

function queryResult(data: unknown, error: { code: string; message: string } | null = null) {
  const result = { data, error }
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe('listTalentEmployeeCapabilityRecords database reads', () => {
  beforeEach(() => {
    createClient.mockReset()
    requirePermission.mockReset().mockResolvedValue({ tenantId: 'tenant-1' })
    requireTenantModule.mockReset().mockResolvedValue(undefined)
  })

  it('stops after a failed catalog read instead of starting later reads', async () => {
    const tables: string[] = []
    const client = {
      from(table: string) {
        tables.push(table)
        if (table === 'talent_employee_capability_records') {
          return queryResult([{
            id: 'record-1',
            employee_id: 'employee-1',
            capability_id: 'capability-1',
            talent_level_id: 'level-1',
            language_level: null,
            language_is_native: false,
            certificate_status: null,
            certificate_issuing_body: null,
            certificate_code: null,
            certificate_validity_months: null,
            certificate_is_permanent: false,
            certificate_renewal_required: false,
            evidence_status: null,
            qualification_responsible_user_id: null,
            source_type: 'ADMIN_ENTERED',
            status: 'ACTIVE',
            valid_from: '2026-01-01',
            valid_until: null,
            evidence_document_id: null,
            version: 1,
            updated_at: '2026-01-01T00:00:00.000Z',
          }])
        }
        if (table === 'talent_capabilities') {
          return queryResult(null, { code: '57014', message: 'private query text' })
        }
        throw new Error(`Unexpected follow-up table: ${table}`)
      },
    }
    createClient.mockResolvedValue(client)
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(listTalentEmployeeCapabilityRecords({}))
      .rejects.toMatchObject({ code: 'TALENT_EMPLOYEE_CAPABILITY_READ_FAILED' })

    expect(tables).toEqual(['talent_employee_capability_records', 'talent_capabilities'])
    expect(log).toHaveBeenCalledWith('[LiquidHR] Database read failed', {
      operation: 'talent.employeeCapabilities.capabilities',
      sqlstate: '57014',
    })
  })
})
