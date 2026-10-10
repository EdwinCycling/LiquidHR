import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSyntheticArrangementAssignmentAction,
  endArrangementPackageAvailabilityAction,
  extendArrangementPackageAvailabilityStartAction,
  makeArrangementPackagesAvailableAction,
  resolveArrangementCompositionAction,
} from './actions'

const { makeAvailable, endAvailable, extendStart, assign, resolve } = vi.hoisted(() => ({
  makeAvailable: vi.fn(),
  endAvailable: vi.fn(),
  extendStart: vi.fn(),
  assign: vi.fn(),
  resolve: vi.fn(),
}))

vi.mock('@/lib/payroll/arrangement-service', () => ({
  makeArrangementPackagesAvailable: makeAvailable,
  endArrangementPackageAvailability: endAvailable,
  extendArrangementPackageAvailabilityStart: extendStart,
  createSyntheticArrangementAssignment: assign,
  createArrangementCompositionSnapshot: resolve,
  ArrangementServiceError: class ArrangementServiceError extends Error {
    constructor(readonly code: string) { super(code) }
  },
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`) },
}))

describe('Payroll arrangement actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assign.mockResolvedValue({ fixture_code: 'CAO-BENCH02-SCALE-STEP' })
    resolve.mockResolvedValue({ id: 'a1e00000-0000-4000-8000-000000000099' })
  })

  it('activates test arrangements for an explicit validity period', async () => {
    const form = new FormData()
    form.set('effectiveFrom', '2026-09-01')
    form.set('effectiveTo', '')
    await expect(makeArrangementPackagesAvailableAction(form))
      .rejects.toThrow('redirect:/payroll-lab/arrangements?activated=1')
    expect(makeAvailable).toHaveBeenCalledWith({ effectiveFrom: '2026-09-01', effectiveTo: null })
  })

  it('ends only the selected package availability on the submitted date', async () => {
    const form = new FormData()
    form.set('packageId', 'KINDEROPVANG_2025_2026')
    form.set('effectiveTo', '2026-09-30')

    await expect(endArrangementPackageAvailabilityAction(form))
      .rejects.toThrow('redirect:/payroll-lab/arrangements?ended=1')
    expect(endAvailable).toHaveBeenCalledWith({ packageId: 'KINDEROPVANG_2025_2026', effectiveTo: '2026-09-30' })
  })

  it('extends only a selected package start with the submitted historical date', async () => {
    const form = new FormData()
    form.set('packageId', 'KINDEROPVANG_2025_2026')
    form.set('effectiveFrom', '2026-07-01')

    await expect(extendArrangementPackageAvailabilityStartAction(form))
      .rejects.toThrow('redirect:/payroll-lab/arrangements?availability=extended&package=KINDEROPVANG_2025_2026')
    expect(extendStart).toHaveBeenCalledWith({ packageId: 'KINDEROPVANG_2025_2026', effectiveFrom: '2026-07-01' })
  })

  it('rejects forged scope fields before invoking the assignment service', async () => {
    const form = new FormData()
    form.set('fixtureCode', 'CAO-BENCH02-SCALE-STEP')
    form.set('packageId', 'KINDEROPVANG_2025_2026')
    form.set('sourceTenantId', 'b1e00000-0000-4000-8000-000000000001')

    await expect(createSyntheticArrangementAssignmentAction(form))
      .rejects.toThrow('redirect:/payroll-lab/arrangements?error=save-failed')
    expect(assign).not.toHaveBeenCalled()
  })

  it('submits only the synthetic fixture and approved package selection', async () => {
    const form = new FormData()
    form.set('fixtureCode', 'CAO-BENCH02-SCALE-STEP')
    form.set('packageId', 'KINDEROPVANG_2025_2026')

    await expect(createSyntheticArrangementAssignmentAction(form))
      .rejects.toThrow('redirect:/payroll-lab/arrangements?saved=1&fixture=CAO-BENCH02-SCALE-STEP')
    expect(assign).toHaveBeenCalledWith({
      fixtureCode: 'CAO-BENCH02-SCALE-STEP',
      packageId: 'KINDEROPVANG_2025_2026',
      effectiveFrom: '2026-09-01',
      effectiveTo: null,
    })
  })

  it('resolves only a synthetic fixture and a calculation date', async () => {
    const form = new FormData()
    form.set('fixtureCode', 'CAO-BENCH02-OPEN-BAND')
    form.set('asOfDate', '2026-09-30')

    await expect(resolveArrangementCompositionAction(form))
      .rejects.toThrow('redirect:/payroll-lab/arrangements?snapshot=1&fixture=CAO-BENCH02-OPEN-BAND&snapshotId=a1e00000-0000-4000-8000-000000000099')
    expect(resolve).toHaveBeenCalledWith({ fixtureCode: 'CAO-BENCH02-OPEN-BAND', asOfDate: '2026-09-30' })
  })
})
