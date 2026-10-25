import { describe, expect, it, vi } from 'vitest'
import type { PayrollSourceProvider, PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import type { PayrollCalculationRepository } from './calculation-repository'
import type { Payrun01Repository } from './payrun01-repository'
import type { PayrollPeriodRow } from './database'
import type { PayrollScope } from './scope'
import { PayrollSourceProviderError } from './source/liquid-hr-source-provider'
import { createPayrollCycleService } from './payroll-cycle-service'

const scope: PayrollScope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '20000000-0000-4000-8000-000000000002',
  administrationId: '30000000-0000-4000-8000-000000000003',
}
const adminId = '40000000-0000-4000-8000-000000000004'
const userId = '50000000-0000-4000-8000-000000000005'
const employeeId = '60000000-0000-4000-8000-000000000006'
const employmentId = '70000000-0000-4000-8000-000000000007'
const period = { year: 2026, month: 10 }

function payrollPeriod(status: PayrollPeriodRow['status']): PayrollPeriodRow {
  return {
    id: '80000000-0000-4000-8000-000000000008',
    payroll_administration_id: adminId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
    period_year: period.year,
    period_month: period.month,
    starts_on: '2026-10-01',
    ends_on: '2026-10-31',
    status,
    created_at: '2026-10-01T00:00:00.000Z',
    created_by_user_id: userId,
    updated_at: '2026-10-01T00:00:00.000Z',
    updated_by_user_id: userId,
  }
}

function snapshot(): PayrollSourceSnapshot {
  return {
    id: '90000000-0000-4000-8000-000000000009',
    sourceTenantId: scope.tenantId,
    sourceHrGroupId: scope.hrGroupId,
    sourceAdministrationId: scope.administrationId,
    sourceEmployeeId: employeeId,
    sourceEmploymentId: employmentId,
    sourceIncomeRelationshipId: null,
    periodReference: period,
    canonicalSource: { fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' } },
    sourceVersionVector: { 'employment_salary:salary-1': '2026-10-01T00:00:00.000Z' },
    sourceGaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' }],
    sourceHash: 'a'.repeat(64),
    createdAt: '2026-10-01T00:00:00.000Z',
  }
}

function makeService(overrides: {
  readonly periodRow?: PayrollPeriodRow
  readonly initialPeriod?: PayrollPeriodRow | null
  readonly repository?: Partial<PayrollCalculationRepository>
  readonly provider?: PayrollSourceProvider
} = {}) {
  let currentPeriod = overrides.initialPeriod ?? null
  const openPayrollPeriod = vi.fn(async () => {
    currentPeriod = payrollPeriod('OPEN')
    return currentPeriod
  })
  const repository = {
    getPayrollPeriod: vi.fn(async () => currentPeriod),
    insertPayrollPeriod: vi.fn(async () => {
      currentPeriod = payrollPeriod('DRAFT')
      return currentPeriod
    }),
    openPayrollPeriod,
    listPayrollRunSummaries: vi.fn(async () => []),
    ...overrides.repository,
  } as unknown as PayrollCalculationRepository
  const lifecycleRepository = {
    getGenericInputReference: vi.fn(async () => null),
    listGenericInputReferences: vi.fn(async () => []),
    listLifecycleEvents: vi.fn(async () => []),
  } as unknown as Payrun01Repository
  const sourceProvider: PayrollSourceProvider = overrides.provider ?? {
    getPayrollSourceSnapshot: vi.fn(async () => snapshot()),
  }
  const service = createPayrollCycleService({
    requireAccess: vi.fn(async () => ({ scope, administration: { id: adminId }, actorUserId: userId })),
    createCalculationRepository: () => repository,
    createLifecycleRepository: () => lifecycleRepository,
    sourceProvider,
    enabled: () => true,
    now: () => new Date('2026-10-01T00:00:00.000Z'),
  })
  return { service, repository, lifecycleRepository, openPayrollPeriod }
}

describe('PayrollCycle server foundation', () => {
  it('opens one administration-period idempotently using the existing period contract', async () => {
    const { service, repository, openPayrollPeriod } = makeService()

    const first = await service.openPayrollCycle(period)
    const second = await service.openPayrollCycle(period)

    expect(first.status).toBe('OPEN')
    expect(second.id).toBe(first.id)
    expect(repository.insertPayrollPeriod).toHaveBeenCalledTimes(1)
    expect(openPayrollPeriod).toHaveBeenCalledTimes(1)
  })

  it('does not reopen a closed period', async () => {
    const { service, repository, openPayrollPeriod } = makeService({ initialPeriod: payrollPeriod('CLOSED') })

    await expect(service.openPayrollCycle(period)).rejects.toMatchObject({ code: 'PAYROLL_CYCLE_CLOSED' })
    expect(repository.insertPayrollPeriod).not.toHaveBeenCalled()
    expect(openPayrollPeriod).not.toHaveBeenCalled()
  })

  it('reconciles a specific authorized employment and exposes source gaps without creating a calculation run', async () => {
    const provider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: vi.fn(async () => snapshot()),
    }
    const { service, repository } = makeService({ initialPeriod: payrollPeriod('OPEN'), provider })

    const item = await service.reconcilePayrollCycleEmployee({ employeeId, employmentId, period })

    expect(provider.getPayrollSourceSnapshot).toHaveBeenCalledWith({
      ...scope,
      employeeId,
      employmentId,
      payrollPeriod: period,
    })
    expect(item).toMatchObject({
      employeeId,
      employmentId,
      runId: null,
      technicalStatus: null,
      businessStatus: null,
      sourceGaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' }],
    })
    expect(repository.listPayrollRunSummaries).toHaveBeenCalledWith(scope, adminId, {
      employeeId,
      runType: 'INDIVIDUAL_PAYROLL',
      period,
      limit: 200,
    })
  })

  it('includes authorized roster references without a run in the monthly worklist', async () => {
    const provider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: vi.fn(async () => snapshot()),
    }
    const { service, repository } = makeService({ initialPeriod: payrollPeriod('OPEN'), provider })

    const projection = await service.getPayrollCycleWorklist(period, [{ employeeId, employmentId }])

    expect(repository.listPayrollRunSummaries).toHaveBeenCalledWith(scope, adminId, {
      runType: 'INDIVIDUAL_PAYROLL', period, limit: 200,
    })
    expect(projection?.workItems).toEqual([expect.objectContaining({
      employeeId,
      employmentId,
      runId: null,
      technicalStatus: null,
      businessStatus: null,
      sourceGaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' }],
    })])
  })

  it('loads source reads in a bounded batch and preserves every roster item and safe provider diagnostics', async () => {
    const references = Array.from({ length: 20 }, (_, index) => ({
      employeeId: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      employmentId: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }))
    let active = 0
    let maxActive = 0
    const provider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: vi.fn(async (input) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise<void>((resolve) => setTimeout(resolve, 2))
        active -= 1
        if (input.employmentId === references[0]?.employmentId) {
          throw new PayrollSourceProviderError(
            'PAYROLL_SOURCE_DATA_UNAVAILABLE',
            503,
            'employment-payroll-projection',
            '90000000-0000-4000-8000-000000000019',
          )
        }
        return { ...snapshot(), sourceEmployeeId: input.employeeId, sourceEmploymentId: input.employmentId }
      }),
    }
    const { service } = makeService({ initialPeriod: payrollPeriod('OPEN'), provider })

    const projection = await service.getPayrollCycleWorklist(period, references)

    expect(maxActive).toBe(12)
    expect(projection?.workItems.map((item) => item.employmentId)).toEqual(references.map((reference) => reference.employmentId))
    expect(projection?.workItems.find((item) => item.employmentId === references[0]?.employmentId)).toMatchObject({
      sourceGaps: [{ field: 'sourceSnapshot', status: 'SOURCE_GAP', reasonCode: 'CORE_SOURCE_READ_FAILED' }],
      sourceDiagnostics: [{
        sourceCategory: 'employment-payroll-projection',
        errorCode: 'PAYROLL_SOURCE_DATA_UNAVAILABLE',
        correlationId: '90000000-0000-4000-8000-000000000019',
      }],
    })
  })

  it('uses a Payroll source batch capability when the provider supplies one', async () => {
    const getPayrollSourceSnapshot = vi.fn(async () => snapshot())
    const getPayrollSourceSnapshots = vi.fn(async () => [{ status: 'fulfilled' as const, value: snapshot() }])
    const provider = { getPayrollSourceSnapshot, getPayrollSourceSnapshots } as unknown as PayrollSourceProvider
    const { service } = makeService({ initialPeriod: payrollPeriod('OPEN'), provider })

    const projection = await service.getPayrollCycleWorklist(period, [{ employeeId, employmentId }])

    expect(getPayrollSourceSnapshots).toHaveBeenCalledWith([{
      ...scope,
      employeeId,
      employmentId,
      payrollPeriod: period,
    }])
    expect(getPayrollSourceSnapshot).not.toHaveBeenCalled()
    expect(projection?.workItems).toHaveLength(1)
    expect(projection?.workItems[0]).toMatchObject({
      employeeId,
      employmentId,
      sourceGaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' }],
    })
  })
})
