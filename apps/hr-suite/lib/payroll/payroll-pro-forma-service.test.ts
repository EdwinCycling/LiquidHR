import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayrollSourceProviderInput, PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import { createRetailSourceSnapshot } from './payd2-retail-source-fixture'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import { createPayrollProFormaService, type PayrollProFormaDependencies } from './payroll-pro-forma-service'
import type { EmployeePayrollAccess } from './payroll-professional-service'

let access: EmployeePayrollAccess

describe('read-only Employee Payroll pro-forma service', () => {
  let snapshot: PayrollSourceSnapshot
  let readSource: ReturnType<typeof vi.fn<(input: PayrollSourceProviderInput) => Promise<PayrollSourceSnapshot>>>

  beforeEach(async () => {
    snapshot = await createRetailSourceSnapshot('R1', { syntheticFlatPensionForLifecycle: true })
    readSource = vi.fn(async () => snapshot)
    access = {
      employeeId: snapshot.sourceEmployeeId,
      actorUserId: '96000000-0000-4000-8000-000000000102',
      scope: {
        tenantId: snapshot.sourceTenantId,
        hrGroupId: snapshot.sourceHrGroupId,
        administrationId: snapshot.sourceAdministrationId,
      },
      payrollAdministrationId: '96000000-0000-4000-8000-000000000106',
    }
  })

  function service(overrides: Partial<PayrollProFormaDependencies> = {}) {
    const dependencies: PayrollProFormaDependencies = {
      authorizeSelf: async () => access,
      readSource,
      now: () => new Date('2026-07-31T12:00:00.000Z'),
      ...overrides,
    }
    return createPayrollProFormaService(dependencies)
  }

  it('matches the existing R1 cent oracle without creating a run and replays identical hashes', async () => {
    const before = structuredClone(snapshot)
    const first = await service().calculate({ type: 'SALARY_INCREASE', percentage: '5' })
    const second = await service().calculate({ type: 'SALARY_INCREASE', percentage: '5' })

    expect(first.gaps).toEqual([])
    expect(first).toMatchObject({
      status: 'CALCULATED', sourceStatus: 'READY', sourceHash: snapshot.sourceHash,
      baseline: {
        gross: '4767.20', employeePension: '198.65', employerPension: '595.96',
        taxableWage: '4568.55', wageTax: '1107.17', net: '3461.38', employerCosts: '6545.86',
      },
    })
    expect(first.scenario?.gross).not.toBe(first.baseline?.gross)
    expect(first.scenario?.net).not.toBe(first.baseline?.net)
    expect(first.hashes).toEqual(second.hashes)
    expect(first.sourceHash).toBe(second.sourceHash)
    expect(first.hashes.scenarioResult).toMatch(/^[0-9a-f]{64}$/)
    expect(first.traceSteps).toBeGreaterThan(0)
    expect(readSource).toHaveBeenCalledTimes(2)
    expect(readSource).toHaveBeenCalledWith(
      { ...access.scope, employeeId: access.employeeId, payrollPeriod: { year: 2026, month: 7 } },
      access,
    )
    expect(snapshot).toEqual(before)
  })

  it('uses one snapshot for both sides and fails closed for an unresolved bonus withholding profile', async () => {
    const readOnce = vi.fn(async () => snapshot)
    const result = await service({ readSource: readOnce }).calculate({ type: 'BONUS', amount: '500.00' })

    expect(readOnce).toHaveBeenCalledTimes(1)
    expect(result.sourceHash).toBe(snapshot.sourceHash)
    expect(result.baseline).not.toBeNull()
    expect(result.status).toBe('SOURCE_GAP')
    expect(result.scenario).toBeNull()
    expect(result.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'payrollConfiguration', reasonCode: 'SPECIAL_REWARD_TAX_OR_PENSION_PROFILE_UNRESOLVED' }),
    ]))
  })

  it('returns SOURCE_GAP without exposing calculated amounts when employer configuration is missing', async () => {
    const incomplete = {
      ...snapshot,
      sourceGaps: [{ field: 'payrollConfiguration', status: 'SOURCE_GAP' as const, reasonCode: 'EMPLOYER_RULES_MISSING' }],
    }
    const sourceGapSnapshot = {
      ...incomplete,
      sourceHash: hashPayrollSourceSnapshot({
        sourceTenantId: incomplete.sourceTenantId,
        sourceHrGroupId: incomplete.sourceHrGroupId,
        sourceAdministrationId: incomplete.sourceAdministrationId,
        sourceEmployeeId: incomplete.sourceEmployeeId,
        sourceEmploymentId: incomplete.sourceEmploymentId,
        sourceIncomeRelationshipId: incomplete.sourceIncomeRelationshipId,
        periodReference: incomplete.periodReference,
        payrollPeriodIdentity: incomplete.payrollPeriodIdentity,
        canonicalSource: incomplete.canonicalSource,
        sourceVersionVector: incomplete.sourceVersionVector,
        sourceGaps: incomplete.sourceGaps,
      }),
    }
    const result = await service({ readSource: async () => sourceGapSnapshot })
      .calculate({ type: 'SALARY_INCREASE', percentage: '5' })

    expect(result.status).toBe('SOURCE_GAP')
    expect(result.sourceStatus).toBe('SOURCE_GAP')
    expect(result.baseline).toBeNull()
    expect(result.scenario).toBeNull()
    expect(result.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'payrollConfiguration', reasonCode: 'EMPLOYER_RULES_MISSING' }),
    ]))
  })

  it('recalculates extra regular hours using the resolved hourly rate and existing engine', async () => {
    const result = await service().calculate({ type: 'EXTRA_PAID_HOURS', hours: '2' })

    expect(result.status).toBe('CALCULATED')
    expect(result.baseline?.gross).toBe('4767.20')
    expect(result.scenario?.gross).toBe('4825.10')
    expect(result.scenario?.employeePension).not.toBe(result.baseline?.employeePension)
    expect(result.sourceHash).toBe(snapshot.sourceHash)
  })

  it('re-derives fixed salary and pension factor for a supported contract-hours change', async () => {
    const canonicalSource = structuredClone(snapshot.canonicalSource) as Record<string, unknown>
    const regularWage = canonicalSource.regularWage as Record<string, unknown>
    regularWage.caoApplied = false
    delete regularWage.caoGrossAmount
    const modified = { ...snapshot, canonicalSource: canonicalSource as typeof snapshot.canonicalSource }
    const contractSnapshot = {
      ...modified,
      sourceHash: hashPayrollSourceSnapshot({
        sourceTenantId: modified.sourceTenantId,
        sourceHrGroupId: modified.sourceHrGroupId,
        sourceAdministrationId: modified.sourceAdministrationId,
        sourceEmployeeId: modified.sourceEmployeeId,
        sourceEmploymentId: modified.sourceEmploymentId,
        sourceIncomeRelationshipId: modified.sourceIncomeRelationshipId,
        periodReference: modified.periodReference,
        payrollPeriodIdentity: modified.payrollPeriodIdentity,
        canonicalSource: modified.canonicalSource,
        sourceVersionVector: modified.sourceVersionVector,
        sourceGaps: modified.sourceGaps,
      }),
    }
    const result = await service({ readSource: async () => contractSnapshot }).calculate({ type: 'CONTRACT_HOURS', hoursPerWeek: '30' })

    expect(result.status).toBe('CALCULATED')
    expect(result.sourceHash).toBe(contractSnapshot.sourceHash)
    expect(result.scenario?.gross).not.toBe(result.baseline?.gross)
    expect(result.scenario?.employeePension).not.toBe(result.baseline?.employeePension)
  })

  it('does not calculate or disclose a source when self-salary access is absent', async () => {
    const read = vi.fn(async () => snapshot)
    const denied = service({ authorizeSelf: async () => null, readSource: read })

    await expect(denied.calculate({ type: 'SALARY_INCREASE', percentage: '5' }))
      .rejects.toMatchObject({ code: 'PAYROLL_SELF_ACCESS_UNAVAILABLE', status: 403 })
    expect(read).not.toHaveBeenCalled()
  })
})
