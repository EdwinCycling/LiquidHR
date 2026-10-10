import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import type { requireComponentLibraryAccess } from './component-library-access'
import type {
  PayrollArrangementAssignmentRow,
  PayrollArrangementAvailabilityRow,
  PayrollArrangementCompositionSnapshotRow,
  PayrollDatabase,
  PayrollJson,
} from './database'
import type { ArrangementRepository } from './arrangement-repository'
import type { PayrollScope } from './scope'
import {
  createArrangementCompositionSnapshot,
  createSyntheticArrangementAssignment,
  endArrangementPackageAvailability,
  extendArrangementPackageAvailabilityStart,
  loadArrangementFoundationPage,
  makeArrangementPackagesAvailable,
  type ArrangementServiceDependencies,
} from './arrangement-service'
import { SYNTHETIC_ARRANGEMENT_FIXTURES } from './arrangement-foundation'

const scope = {
  tenantId: 'a1e00000-0000-4000-8000-000000000001',
  hrGroupId: 'a1e00000-0000-4000-8000-000000000002',
  administrationId: 'a1e00000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = 'a1e00000-0000-4000-8000-000000000004'
const actorUserId = 'a1e00000-0000-4000-8000-000000000005'
const now = '2026-10-03T12:00:00.000Z'
type AvailabilityInsert = PayrollDatabase['public']['Tables']['payroll_arrangement_availability']['Insert']
type AssignmentInsert = PayrollDatabase['public']['Tables']['payroll_arrangement_assignments']['Insert']
type SnapshotInsert = PayrollDatabase['public']['Tables']['payroll_arrangement_composition_snapshots']['Insert']

const context = {
  scope,
  administration: {
    id: payrollAdministrationId,
    displayName: 'Synthetic Payroll Lab',
    status: 'ACTIVE',
    capabilityEnabled: true,
  },
  actorUserId,
  canCopy: true,
}

class MemoryArrangementRepository implements ArrangementRepository {
  availability: PayrollArrangementAvailabilityRow[] = []
  assignments: PayrollArrangementAssignmentRow[] = []
  snapshots: PayrollArrangementCompositionSnapshotRow[] = []

  listAvailability = vi.fn(async (requestedScope: PayrollScope, requestedPayrollAdministrationId: string) => {
    expect(requestedScope).toEqual(scope)
    expect(requestedPayrollAdministrationId).toBe(payrollAdministrationId)
    return this.availability
  })
  listAssignments = vi.fn(async (requestedScope: PayrollScope, requestedPayrollAdministrationId: string) => {
    expect(requestedScope).toEqual(scope)
    expect(requestedPayrollAdministrationId).toBe(payrollAdministrationId)
    return this.assignments
  })
  listCompositionSnapshots = vi.fn(async (requestedScope: PayrollScope, requestedPayrollAdministrationId: string) => {
    expect(requestedScope).toEqual(scope)
    expect(requestedPayrollAdministrationId).toBe(payrollAdministrationId)
    return this.snapshots
  })
  findCompositionSnapshot = vi.fn(async (
    requestedScope: PayrollScope,
    requestedPayrollAdministrationId: string,
    assignmentId: string,
    asOfDate: string,
    snapshotHash: string,
  ) => {
    expect(requestedScope).toEqual(scope)
    expect(requestedPayrollAdministrationId).toBe(payrollAdministrationId)
    return this.snapshots.find((row) => row.assignment_id === assignmentId
      && row.as_of_date === asOfDate && row.snapshot_hash === snapshotHash) ?? null
  })

  insertAvailability = vi.fn(async (_scope: PayrollScope, _payrollAdministrationId: string, row: AvailabilityInsert) => {
    this.availability.push(row as PayrollArrangementAvailabilityRow)
    return row as PayrollArrangementAvailabilityRow
  })
  endAvailability = vi.fn(async (_scope: PayrollScope, _payrollAdministrationId: string, packageId: string, effectiveTo: string, updatedAt: string, updatedByUserId: string) => {
    const index = this.availability.findIndex((row) => row.package_id === packageId)
    if (index < 0) throw new Error('missing availability')
    const updated = { ...this.availability[index]!, effective_to: effectiveTo, updated_at: updatedAt, updated_by_user_id: updatedByUserId }
    this.availability[index] = updated
    return updated
  })
  extendAvailabilityStart = vi.fn(async (_scope: PayrollScope, _payrollAdministrationId: string, packageId: string, effectiveFrom: string, updatedAt: string, updatedByUserId: string) => {
    const index = this.availability.findIndex((row) => row.package_id === packageId)
    if (index < 0) throw new Error('missing availability')
    const updated = { ...this.availability[index]!, effective_from: effectiveFrom, updated_at: updatedAt, updated_by_user_id: updatedByUserId }
    this.availability[index] = updated
    return updated
  })
  insertAssignment = vi.fn(async (_scope: PayrollScope, _payrollAdministrationId: string, row: AssignmentInsert) => {
    const assignment = row as PayrollArrangementAssignmentRow
    if (this.assignments.some((item) => item.source_employment_id === assignment.source_employment_id)) {
      throw Object.assign(new Error('duplicate'), { code: '23505' })
    }
    this.assignments.push(assignment)
    return assignment
  })
  insertCompositionSnapshot = vi.fn(async (_scope: PayrollScope, _payrollAdministrationId: string, row: SnapshotInsert) => {
    const snapshot = row as PayrollArrangementCompositionSnapshotRow
    if (this.snapshots.some((item) => item.assignment_id === snapshot.assignment_id
      && item.as_of_date === snapshot.as_of_date && item.snapshot_hash === snapshot.snapshot_hash)) {
      throw Object.assign(new Error('duplicate'), { code: '23505' })
    }
    this.snapshots.push(snapshot)
    return snapshot
  })
}

const service = (
  repository: MemoryArrangementRepository,
  requireAccess: ArrangementServiceDependencies['requireAccess'] = async () => context as unknown as Awaited<ReturnType<typeof requireComponentLibraryAccess>>,
): ArrangementServiceDependencies => ({
  requireAccess,
  repository,
  createId: (() => {
    let sequence = 10
    return () => `a1e00000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`
  })(),
  now: () => now,
})

function availabilityRow(packageId: string): PayrollArrangementAvailabilityRow {
  return {
    id: 'a1e00000-0000-4000-8000-000000000010',
    payroll_administration_id: payrollAdministrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
    package_id: packageId,
    effective_from: '2026-09-01',
    effective_to: null,
    created_at: now,
    created_by_user_id: actorUserId,
    updated_at: null,
    updated_by_user_id: null,
  }
}

describe('Payroll Lab arrangement service', () => {
  let repository: MemoryArrangementRepository

  beforeEach(() => {
    repository = new MemoryArrangementRepository()
  })

  it('authorizes read context before accessing scoped Payroll data', async () => {
    const requireAccess = vi.fn(async () => { throw new Error('salary:read required') })
    const dependencies = service(repository, requireAccess as unknown as ArrangementServiceDependencies['requireAccess'])

    await expect(loadArrangementFoundationPage(dependencies)).rejects.toThrow('salary:read required')
    expect(requireAccess).toHaveBeenCalledWith(false)
    expect(repository.listAvailability).not.toHaveBeenCalled()
  })

  it('makes only the three reviewed packages available to the active administration', async () => {
    const dependencies = service(repository)
    await makeArrangementPackagesAvailable({ effectiveFrom: '2026-09-01', effectiveTo: null }, dependencies)

    expect(repository.availability.map((row) => row.package_id).sort()).toEqual([
      'KINDEROPVANG_2025_2026',
      'LHR_DEMO_OPEN_BANDS_2026',
      'RETAIL_NON_FOOD_MODE_2026_2027',
    ])
    expect(repository.availability.every((row) => row.payroll_administration_id === payrollAdministrationId
      && row.source_tenant_id === scope.tenantId && row.source_hr_group_id === scope.hrGroupId
      && row.source_administration_id === scope.administrationId && row.created_by_user_id === actorUserId
      && row.effective_from === '2026-09-01' && row.effective_to === null)).toBe(true)
  })

  it('rejects invalid availability periods before writing', async () => {
    await expect(makeArrangementPackagesAvailable({ effectiveFrom: '2026-10-01', effectiveTo: '2026-09-30' }, service(repository)))
      .rejects.toMatchObject({ code: 'ARRANGEMENT_INVALID_REQUEST' })
    expect(repository.insertAvailability).not.toHaveBeenCalled()
  })

  it('extends a package start only within its version history and records the acting user', async () => {
    repository.availability = [availabilityRow('KINDEROPVANG_2025_2026')]

    const updated = await extendArrangementPackageAvailabilityStart({
      packageId: 'KINDEROPVANG_2025_2026',
      effectiveFrom: '2026-07-01',
    }, service(repository))

    expect(updated.effective_from).toBe('2026-07-01')
    expect(updated.updated_at).toBe(now)
    expect(updated.updated_by_user_id).toBe(actorUserId)
    expect(repository.extendAvailabilityStart).toHaveBeenCalledWith(
      scope,
      payrollAdministrationId,
      'KINDEROPVANG_2025_2026',
      '2026-07-01',
      now,
      actorUserId,
    )
  })

  it('rejects a non-earlier, future, unsupported, or unknown availability start without writing', async () => {
    repository.availability = [availabilityRow('KINDEROPVANG_2025_2026')]
    const dependencies = service(repository)

    for (const effectiveFrom of ['2026-09-01', '2026-10-04', '2024-12-31', 'not-a-date']) {
      await expect(extendArrangementPackageAvailabilityStart({
        packageId: 'KINDEROPVANG_2025_2026',
        effectiveFrom,
      }, dependencies)).rejects.toMatchObject({ code: 'ARRANGEMENT_INVALID_REQUEST' })
    }
    await expect(extendArrangementPackageAvailabilityStart({
      packageId: 'UNKNOWN_PACKAGE',
      effectiveFrom: '2026-07-01',
    }, dependencies)).rejects.toMatchObject({ code: 'ARRANGEMENT_INVALID_REQUEST' })
    expect(repository.extendAvailabilityStart).not.toHaveBeenCalled()
  })

  it('persists one package and strategy for a synthetic employment and rejects a competing primary assignment', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[0]!
    repository.availability = [availabilityRow('KINDEROPVANG_2025_2026'), availabilityRow('RETAIL_NON_FOOD_MODE_2026_2027')]
    const dependencies = service(repository)
    const input = { fixtureCode: fixture.code, packageId: 'KINDEROPVANG_2025_2026', effectiveFrom: fixture.effectiveFrom, effectiveTo: null }
    const assignment = await createSyntheticArrangementAssignment(input, dependencies)

    expect(assignment.is_primary).toBe(true)
    expect(assignment.salary_strategy).toBe('DISCRETE_SCALE_STEP')
    expect(assignment.effective_from).toBe('2026-09-01')
    await expect(createSyntheticArrangementAssignment({ ...input, packageId: 'RETAIL_NON_FOOD_MODE_2026_2027' }, dependencies))
      .rejects.toMatchObject({ code: 'ARRANGEMENT_ASSIGNMENT_ALREADY_EXISTS' })
    expect(repository.assignments).toHaveLength(1)
  })

  it('refuses packages unavailable to the active administration and foreign scope rows', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
    await expect(createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, service(repository))).rejects.toMatchObject({ code: 'ARRANGEMENT_NOT_AVAILABLE' })

    repository.availability = [{
      ...availabilityRow('LHR_DEMO_OPEN_BANDS_2026'),
      source_tenant_id: 'b1e00000-0000-4000-8000-000000000001',
    }]
    await expect(loadArrangementFoundationPage(service(repository))).rejects.toMatchObject({ code: 'ARRANGEMENT_DATA_INVALID' })
  })

  it('requires availability to cover the assignment effective date', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[0]!
    repository.availability = [{ ...availabilityRow('KINDEROPVANG_2025_2026'), effective_from: '2026-10-01' }]
    await expect(createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'KINDEROPVANG_2025_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, service(repository))).rejects.toMatchObject({ code: 'ARRANGEMENT_NOT_AVAILABLE' })
  })

  it('does not allow an ended package to be selected for a new assignment', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[0]!
    repository.availability = [{ ...availabilityRow('KINDEROPVANG_2025_2026'), effective_to: '2026-09-10' }]
    await expect(createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'KINDEROPVANG_2025_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, service(repository))).rejects.toMatchObject({ code: 'ARRANGEMENT_NOT_AVAILABLE' })
    expect(repository.assignments).toHaveLength(0)
  })

  it('resolves and replays the same September 2026 composition snapshot by hash', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[2]!
    repository.availability = [availabilityRow('LHR_DEMO_OPEN_BANDS_2026')]
    const dependencies = service(repository)
    const assignment = await createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, dependencies)

    const first = await createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-09-30' }, dependencies)
    repository.listCompositionSnapshots.mockImplementation(async (requestedScope, requestedPayrollAdministrationId) => {
      expect(requestedScope).toEqual(scope)
      expect(requestedPayrollAdministrationId).toBe(payrollAdministrationId)
      return []
    })
    const replay = await createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-09-30' }, dependencies)

    expect(first.id).toBe(replay.id)
    expect(first.assignment_id).toBe(assignment.id)
    expect(first.snapshot_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.snapshot_json).toMatchObject({
      asOfDate: '2026-09-30',
      calculationStatus: 'FOUNDATION_ONLY',
      arrangement: { packageId: 'LHR_DEMO_OPEN_BANDS_2026', version: '2026.07' },
      employment: { source: 'SYNTHETIC_FIXTURE', fixtureCode: fixture.code },
    })
    expect(repository.snapshots).toHaveLength(1)
  })

  it('rejects a snapshot date before the assignment starts', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
    repository.availability = [availabilityRow('LHR_DEMO_OPEN_BANDS_2026')]
    const dependencies = service(repository)
    await createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, dependencies)

    await expect(createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-08-31' }, dependencies))
      .rejects.toMatchObject({ code: 'ARRANGEMENT_ASSIGNMENT_INACTIVE' })
  })

  it('reads a hash-pinned snapshot with historical package display metadata', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
    repository.availability = [availabilityRow('LHR_DEMO_OPEN_BANDS_2026')]
    const dependencies = service(repository)
    await createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, dependencies)
    const row = await createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-09-30' }, dependencies)
    const content = JSON.parse(stableSerialize(row.snapshot_json)) as Record<string, unknown>
    const arrangement = content.arrangement as Record<string, unknown>
    arrangement.displayName = 'Historical company arrangement name'
    const snapshotJson = content as unknown as PayrollJson
    repository.snapshots[0] = {
      ...row,
      snapshot_json: snapshotJson,
      snapshot_hash: sha256(stableSerialize(snapshotJson)),
    }

    const page = await loadArrangementFoundationPage(dependencies)
    expect(page.snapshots[0]?.content.arrangement.displayName).toBe('Historical company arrangement name')
  })

  it('rejects snapshots whose persisted content no longer matches their hash', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
    repository.availability = [availabilityRow('LHR_DEMO_OPEN_BANDS_2026')]
    const dependencies = service(repository)
    await createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, dependencies)
    const row = await createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-09-30' }, dependencies)
    const content = JSON.parse(stableSerialize(row.snapshot_json)) as Record<string, unknown>
    const arrangement = content.arrangement as Record<string, unknown>
    arrangement.displayName = 'Altered without a new snapshot hash'
    repository.snapshots[0] = { ...row, snapshot_json: content as unknown as PayrollJson }

    await expect(loadArrangementFoundationPage(dependencies)).rejects.toMatchObject({ code: 'ARRANGEMENT_DATA_INVALID' })
  })

  it('ends selection availability after assignment starts while preserving snapshots for the grandfathered assignment', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
    repository.availability = [availabilityRow('LHR_DEMO_OPEN_BANDS_2026')]
    const dependencies = service(repository)
    await createSyntheticArrangementAssignment({
      fixtureCode: fixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      effectiveFrom: fixture.effectiveFrom,
      effectiveTo: null,
    }, dependencies)
    await createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-09-30' }, dependencies)

    await expect(endArrangementPackageAvailability({ packageId: 'LHR_DEMO_OPEN_BANDS_2026', effectiveTo: '2026-08-31' }, dependencies))
      .rejects.toMatchObject({ code: 'ARRANGEMENT_INVALID_REQUEST' })
    const ended = await endArrangementPackageAvailability({ packageId: 'LHR_DEMO_OPEN_BANDS_2026', effectiveTo: '2026-09-10' }, dependencies)
    expect(ended.effective_to).toBe('2026-09-10')
    expect(ended.updated_by_user_id).toBe(actorUserId)
    const replay = await createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-09-30' }, dependencies)
    const later = await createArrangementCompositionSnapshot({ fixtureCode: fixture.code, asOfDate: '2026-10-01' }, dependencies)
    expect(replay.as_of_date).toBe('2026-09-30')
    expect(later.as_of_date).toBe('2026-10-01')
  })
})
