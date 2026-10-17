import { describe, expect, it, vi } from 'vitest'
import { PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES } from './payroll-acceptance-scenario'
import { ensurePayfull02TestSetup, readPayfull02TestSetup } from './payfull02-test-setup'
import type { Payrun01Repository } from './payrun01-repository'
import { LOCAL_PAYROLL_ACCEPTANCE_SCOPE } from './local-payroll-acceptance-runtime'

const candidate = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[0]!
const scope = {
  tenantId: LOCAL_PAYROLL_ACCEPTANCE_SCOPE.tenantId,
  hrGroupId: LOCAL_PAYROLL_ACCEPTANCE_SCOPE.hrGroupId,
  administrationId: LOCAL_PAYROLL_ACCEPTANCE_SCOPE.sourceAdministrationId,
}
const payrollAdministrationId = LOCAL_PAYROLL_ACCEPTANCE_SCOPE.payrollAdministrationId

function januaryThroughSeptemberSourceSnapshots(
  employeeId: string = candidate.employeeId,
  employmentId: string = candidate.employmentId,
  grossAmount = '3517.00',
) {
  const hashCharacters = ['a', 'b', 'c', 'd', 'e', 'f', '1', '2', '3']
  return Array.from({ length: 9 }, (_, index) => {
    const month = index + 1
    return {
      id: `f0000000-0000-4000-8000-${String(month).padStart(12, '0')}`,
      sourceTenantId: scope.tenantId,
      sourceHrGroupId: scope.hrGroupId,
      sourceAdministrationId: scope.administrationId,
      sourceEmployeeId: employeeId,
      sourceEmploymentId: employmentId,
      sourceIncomeRelationshipId: 'a1111111-1111-4111-8111-111111111111',
      periodReference: { year: 2026, month },
      canonicalSource: {
        employment: { startsOn: '2020-01-01', endsOn: null, recordStatus: 'CONFIRMED' },
        contract: { entries: [{ fulltimeHoursPerWeek: 40, validFrom: '2020-01-01', validUntil: null }] },
        compensation: { entries: [{ paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY', currencyCode: 'EUR', fulltimeAmount: Number(grossAmount), parttimeAmount: Number(grossAmount), validFrom: '2020-01-01', validUntil: null }] },
        schedule: { entries: [{ averageHoursPerWeek: 40, fulltimeHoursPerWeek: 40, partTimeFactor: 1, validFrom: '2020-01-01', validUntil: null }] },
        incomeRelationship: { id: 'a1111111-1111-4111-8111-111111111111', employmentIncomeRelationshipId: 'b2222222-2222-4222-8222-222222222222', reportingStatus: 'READY', status: 'LINKED' },
      },
      sourceVersionVector: {},
      sourceGaps: [],
      sourceHash: hashCharacters[index]!.repeat(64),
      createdAt: '2026-10-01T12:00:00.000Z',
    }
  })
}

function repositoryHarness() {
  let config: Record<string, unknown> | null = null
  let opening: Record<string, unknown> | null = null
  const repo = {
    getOrCreateCalculationConfigVersion: vi.fn(async (_scope: unknown, _admin: string, row: Record<string, unknown>) => {
      config ??= { ...row, id: 'dddddddd-dddd-4ddd-8ddd-1b29702d5d92', created_at: '2026-10-15T00:00:00.000Z' }
      return config
    }),
    getOrCreateOpeningCumulativeSnapshot: vi.fn(async (_scope: unknown, _admin: string, row: Record<string, unknown>) => {
      opening ??= { ...row, id: 'eeeeeeee-eeee-4eee-8eee-1b29702d5d92', created_at: '2026-10-15T00:00:00.000Z' }
      return opening
    }),
    getCalculationConfigVersion: vi.fn(async () => config),
    getOpeningCumulativeSnapshot: vi.fn(async () => opening),
  }
  return { repository: repo as unknown as Payrun01Repository, repo }
}

describe('PAYFULL-02 persisted synthetic test setup', () => {
  it('writes effective-dated, hash-bound config and opening rows through the scoped repository', async () => {
    const { repository, repo } = repositoryHarness()
    const setup = await ensurePayfull02TestSetup({
      repository,
      scope,
      payrollAdministrationId,
      actorUserId: '10000000-0000-4000-8000-000000000001',
      employeeId: candidate.employeeId,
      employmentId: candidate.employmentId,
      januaryThroughSeptemberSourceSnapshots: januaryThroughSeptemberSourceSnapshots(),
    })

    expect(repo.getOrCreateCalculationConfigVersion).toHaveBeenCalledWith(scope, payrollAdministrationId, expect.objectContaining({
      source_employment_id: candidate.employmentId,
      config_version: 1,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      provenance_status: 'TEST_ONLY',
      provenance_source: 'TEST_SETUP_PAYFULL_02',
    }))
    expect(repo.getOrCreateOpeningCumulativeSnapshot).toHaveBeenCalledWith(scope, payrollAdministrationId, expect.objectContaining({
      source_employment_id: candidate.employmentId,
      snapshot_version: 1,
      as_of_date: '2026-09-30',
      provenance_status: 'TEST_OPENING_BALANCE',
      provenance_source: 'TEST_SETUP_PAYFULL_02',
    }))
    expect(setup.configVersionId).toBe('dddddddd-dddd-4ddd-8ddd-1b29702d5d92')
    expect(setup.configHash).toMatch(/^[0-9a-f]{64}$/)
    expect(setup.openingSnapshotId).toBe('eeeeeeee-eeee-4eee-8eee-1b29702d5d92')
    expect(setup.openingHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(setup.configJson)).toContain('SYNTHETIC_TEST_PLAN_NOT_EXTERNAL_FUND_CONTRACT')
    expect(JSON.stringify(setup.openingBalanceJson)).toContain('NOT_FINALIZED_HISTORICAL_PAYROLL')
  })

  it('reads back only matching persisted versions and rejects an existing content conflict', async () => {
    const { repository } = repositoryHarness()
    await ensurePayfull02TestSetup({
      repository,
      scope,
      payrollAdministrationId,
      actorUserId: '10000000-0000-4000-8000-000000000001',
      employeeId: candidate.employeeId,
      employmentId: candidate.employmentId,
      januaryThroughSeptemberSourceSnapshots: januaryThroughSeptemberSourceSnapshots(),
    })
    await expect(readPayfull02TestSetup({
      repository,
      scope,
      payrollAdministrationId,
      employeeId: candidate.employeeId,
      employmentId: candidate.employmentId,
      januaryThroughSeptemberSourceSnapshots: januaryThroughSeptemberSourceSnapshots(),
    })).resolves.toMatchObject({
      configVersionId: 'dddddddd-dddd-4ddd-8ddd-1b29702d5d92',
      openingSnapshotId: 'eeeeeeee-eeee-4eee-8eee-1b29702d5d92',
    })

    await expect(ensurePayfull02TestSetup({
      repository: repositoryHarness().repository,
      scope: { ...scope, administrationId: '99999999-9999-4999-8999-999999999999' },
      payrollAdministrationId,
      actorUserId: '10000000-0000-4000-8000-000000000001',
      employeeId: candidate.employeeId,
      employmentId: candidate.employmentId,
      januaryThroughSeptemberSourceSnapshots: januaryThroughSeptemberSourceSnapshots(),
    })).rejects.toMatchObject({ code: 'PAYFULL02_TEST_SETUP_SCOPE_FORBIDDEN' })
  })

  it('persists DEMO-003 opening balances independently for its prior effective salary', async () => {
    const third = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.find((item) => item.key === 'DEMO-003')!
    const { repository, repo } = repositoryHarness()
    const setup = await ensurePayfull02TestSetup({
      repository,
      scope,
      payrollAdministrationId,
      actorUserId: '10000000-0000-4000-8000-000000000001',
      employeeId: third.employeeId,
      employmentId: third.employmentId,
      januaryThroughSeptemberSourceSnapshots: januaryThroughSeptemberSourceSnapshots(third.employeeId, third.employmentId, '3551.00'),
    })
    const configRow = vi.mocked(repo.getOrCreateCalculationConfigVersion).mock.calls[0]?.[2]
    const openingRow = vi.mocked(repo.getOrCreateOpeningCumulativeSnapshot).mock.calls[0]?.[2]

    expect(setup.openingBalanceJson).toMatchObject({
      monthlyGross: '3551.00',
      monthlyEmployeePension: '195.33',
      monthlyEmployerPension: '293.00',
      monthlyTaxableWage: '3355.67',
      monthlyWageTax: '1200.42',
    })
    expect(openingRow?.opening_balance_json).toMatchObject({ monthlyGross: '3551.00' })
    expect(configRow?.config_json).toEqual(setup.configJson)
    expect(setup.configVersionId).toBe('dddddddd-dddd-4ddd-8ddd-1b29702d5d92')
  })
})
