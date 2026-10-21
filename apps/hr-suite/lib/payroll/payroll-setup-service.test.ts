import { describe, expect, it, vi } from 'vitest'
import type { PayrollDatabase, PayrollEmployerConfigurationVersionRow, PayrollOpeningCumulativeSnapshotRow } from './database'
import type { PayrollSetupRepository } from './payroll-setup-repository'
import {
  hashPayrollEmployerConfiguration,
  normalizePayrollEmployerConfiguration,
  type PayrollEmployerConfigurationDraft,
} from './payroll-setup'
import { savePayrollEmployerConfiguration } from './payroll-setup-service'

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'

const configurationDraft: PayrollEmployerConfigurationDraft = {
  schemaVersion: 'payroll-employer-configuration-v1',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  status: 'DRAFT',
  sourceReference: 'Synthetic acceptance profile, version 1',
  employer: {
    sectorCode: '35',
    whkDecisionReference: 'ACCEPTANCE-WHK-2026-A',
    awfClassification: 'HIGH-2026',
    aofClassification: 'SMALL-2026',
    wkoClassification: 'WKO-2026',
    zvwClassification: 'EMPLOYER-LEVY-2026',
  },
  employerRates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.52', zvw: '6.10' },
  reserves: { holidayAllowanceRate: '8', yearEndApplies: true, yearEndRate: '8' },
  pension: { partialMonthMethod: 'CALENDAR_DAYS_PRO_RATA', methodSourceReference: 'Synthetic acceptance employer policy' },
}

type ConfigurationInsert = PayrollDatabase['public']['Tables']['payroll_employer_configuration_versions']['Insert']

class InMemoryPayrollSetupRepository implements PayrollSetupRepository {
  readonly rows: PayrollEmployerConfigurationVersionRow[]
  readonly insertEmployerConfiguration = vi.fn(async (
    _scope: typeof scope,
    _administrationId: string,
    row: ConfigurationInsert,
  ) => {
    const saved: PayrollEmployerConfigurationVersionRow = {
      ...row,
      id: `20000000-0000-4000-8000-${String(this.rows.length + 1).padStart(12, '0')}`,
      created_at: '2026-10-20T20:00:00.000Z',
    }
    this.rows.push(saved)
    return saved
  })

  constructor() {
    const draft = normalizePayrollEmployerConfiguration(configurationDraft)
    this.rows = [{
      id: '20000000-0000-4000-8000-000000000001',
      payroll_administration_id: payrollAdministrationId,
      source_tenant_id: scope.tenantId,
      source_hr_group_id: scope.hrGroupId,
      source_administration_id: scope.administrationId,
      configuration_version: 1,
      effective_from: draft.effectiveFrom,
      effective_to: draft.effectiveTo,
      configuration_json: draft as unknown as PayrollDatabase['public']['Tables']['payroll_employer_configuration_versions']['Row']['configuration_json'],
      configuration_hash: hashPayrollEmployerConfiguration(draft),
      status: 'DRAFT',
      source_reference: draft.sourceReference,
      created_at: '2026-10-20T19:00:00.000Z',
      created_by_user_id: actorUserId,
    }]
  }

  async getPayrollAdministration() { return null }
  async listEmployerConfigurations() { return this.rows }
  async getEffectiveEmployerConfiguration() { return this.rows.find((row) => row.status === 'ACTIVE') ?? null }
  async listOpeningCumulativeSnapshots(): Promise<readonly PayrollOpeningCumulativeSnapshotRow[]> { return [] }
  async insertOpeningCumulativeSnapshot(): Promise<PayrollOpeningCumulativeSnapshotRow> { throw new Error('Not used by this test') }
}

describe('Payroll employer configuration activation', () => {
  it('activates a saved draft by appending an immutable active version', async () => {
    const repository = new InMemoryPayrollSetupRepository()
    const requireAccess = vi.fn(async () => ({
      scope,
      administration: { id: payrollAdministrationId, displayName: 'Jupiter acceptance', status: 'ACTIVE' as const, capabilityEnabled: true },
      actorUserId,
      canCopy: true,
    }))

    const active = await savePayrollEmployerConfiguration(
      { ...configurationDraft, status: 'ACTIVE' },
      { repository, requireAccess },
    )
    const repeated = await savePayrollEmployerConfiguration(
      { ...configurationDraft, status: 'ACTIVE' },
      { repository, requireAccess },
    )

    expect(active.status).toBe('ACTIVE')
    expect(active.configuration_version).toBe(2)
    expect(repository.rows[0]?.status).toBe('DRAFT')
    expect(repository.rows[1]?.configuration_json).toMatchObject({ status: 'ACTIVE' })
    expect(repository.rows).toHaveLength(2)
    expect(repeated).toEqual(active)
    expect(repository.insertEmployerConfiguration).toHaveBeenCalledTimes(1)
  })
})
