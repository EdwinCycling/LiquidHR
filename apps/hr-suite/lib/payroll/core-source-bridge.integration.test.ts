import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActualWorkPayrollProjection } from '@/lib/actual-work/actual-work-service'
import { createEmployeePayrollCalculationService } from './employee-payroll-calculation-service'
import {
  createLiquidHrPayrollSourceProvider,
  type PayrollSourceTimeline,
  type PayrollSourceTaxProfileProjection,
} from './source/liquid-hr-source-provider'

// Alleen de bestaande Core-readservices en repositorygrenzen worden vervangen.
// De standaard providerassembly en de normale read-only Payroll-preflight blijven echt.
const reads = vi.hoisted(() => ({
  permission: vi.fn(), employments: vi.fn(), timeline: vi.fn(), income: vi.fn(), fiscal: vi.fn(),
  actualWork: vi.fn(), access: vi.fn(), administration: vi.fn(), configurations: vi.fn(),
  openings: vi.fn(), period: vi.fn(), lifecycle: vi.fn(),
}))
vi.mock('@/lib/auth/permissions', async (original) => ({
  ...await original<typeof import('@/lib/auth/permissions')>(), requirePermission: reads.permission,
}))
vi.mock('@/lib/employment/employment-service', () => ({ listEmployeeEmployments: reads.employments }))
vi.mock('@/lib/employment/employment-detail-service', () => ({
  getEmploymentPayrollSourceProjection: reads.timeline,
  getEmploymentIncomeRelationshipProjection: reads.income,
}))
vi.mock('@/lib/employment/employment-payroll-tax-profile-service', () => ({
  getEmploymentPayrollTaxSourceProjection: reads.fiscal,
}))
vi.mock('@/lib/actual-work/actual-work-service', () => ({ getActualWorkPayrollProjection: reads.actualWork }))
vi.mock('./feature-flag', () => ({ isPayrollLabEnabled: () => true }))
vi.mock('./component-library-access', () => ({ requireComponentLibraryAccess: reads.access }))
vi.mock('./payroll-setup-repository', () => ({
  createPayrollSetupRepository: () => ({
    getPayrollAdministration: reads.administration,
    listEmployerConfigurations: reads.configurations,
    listOpeningCumulativeSnapshots: reads.openings,
  }),
}))
vi.mock('./calculation-repository', () => ({
  createPayrollCalculationRepository: () => ({ getPayrollPeriod: reads.period }),
}))
vi.mock('./payrun01-repository', () => ({ createPayrun01Repository: reads.lifecycle }))

const scope = {
  tenantId: '11000000-0000-4000-8000-000000000001',
  hrGroupId: '22000000-0000-4000-8000-000000000002',
  administrationId: '33000000-0000-4000-8000-000000000003',
}
const employeeId = '66000000-0000-4000-8000-000000000006'
const employmentId = '77000000-0000-4000-8000-000000000007'
const payrollAdministrationId = '44000000-0000-4000-8000-000000000004'
const period = { year: 2026, month: 7 }
const version = '2026-07-01T09:00:00.000Z'
const input = { ...scope, employeeId, employmentId, payrollPeriod: period }

function timeline(): PayrollSourceTimeline {
  return {
    employment: {
      id: employmentId, employee_id: employeeId, tenant_id: scope.tenantId,
      hr_group_id: scope.hrGroupId, administration_id: scope.administrationId,
      starts_on: '2026-01-01', ends_on: null, original_hire_date: '2026-01-01',
      seniority_date: '2026-01-01', record_status: 'CONFIRMED', employment_type: 'EMPLOYEE',
      contract_type: 'INDEFINITE', deleted_at: null, updated_at: version,
    },
    salaries: [{
      id: 'ab000000-0000-4000-8000-00000000000b', salary_basis: 'MANUAL', salary_route: 'MANUAL',
      payment_type: 'PERIODIC_FIXED', payment_frequency: 'MONTHLY', currency_code: 'EUR',
      fulltime_amount: 3200, parttime_amount: 3200, hourly_rate: null,
      salary_structure_id: null, salary_scale_id: null, salary_scale_step_id: null,
      salary_step_code: null, cao_scale_name: null, cao_step_name: null, salary_band_id: null,
      valid_from: '2026-01-01', valid_until: null, updated_at: version,
    }],
    schedules: [{
      id: 'bc000000-0000-4000-8000-00000000000c', average_days_per_week: 5,
      average_hours_per_week: 40, fulltime_hours_per_week: 40, part_time_factor: 1,
      schedule_type: 'HOURS_PER_DAY', is_on_call: false,
      valid_from: '2026-01-01', valid_until: null, updated_at: version,
    }],
    contracts: [], laborConditions: [], organizations: [],
    pensionAssignments: [], laborConditionPensionArrangements: [],
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  reads.permission.mockResolvedValue(scope)
  reads.access.mockResolvedValue({ scope, administration: { id: payrollAdministrationId }, actorUserId: employeeId })
  const source = timeline()
  reads.employments.mockResolvedValue([source.employment])
  reads.timeline.mockResolvedValue(source)
  reads.income.mockResolvedValue([])
  reads.fiscal.mockResolvedValue({
    ageCategory: null, ageSourceUpdatedAt: null, activeIncomeRelationshipCount: 0,
    incomeRelationshipLinkGap: true, incomeRelationships: [], taxProfiles: [],
  } satisfies PayrollSourceTaxProfileProjection)
  reads.actualWork.mockResolvedValue({ period: null, entries: [], types: [] } satisfies ActualWorkPayrollProjection)
  reads.administration.mockResolvedValue({ id: payrollAdministrationId, status: 'ACTIVE', capabilityEnabled: true })
  reads.configurations.mockResolvedValue([])
  reads.openings.mockResolvedValue([])
  reads.period.mockResolvedValue({ status: 'OPEN' })
  reads.lifecycle.mockImplementation(() => { throw new Error('Read-only preflight must not open lifecycle storage') })
})
afterEach(() => vi.restoreAllMocks())

describe('Core readers through the standard Payroll source assembly', () => {
  it('binds valid Core salary/hours to source versions and calls scoped existing readers', async () => {
    const provider = createLiquidHrPayrollSourceProvider()
    const first = await provider.getPayrollSourceSnapshot(input)
    const repeat = await provider.getPayrollSourceSnapshot(input)
    expect(first.sourceHash).toBe(repeat.sourceHash)
    expect(first.canonicalSource).toMatchObject({
      sourceContract: { schemaVersion: 'payroll-source-contract-v1', scope: { ...scope, employeeId, employmentId } },
      compensation: { entries: [{ fulltimeAmount: 3200, parttimeAmount: 3200 }] },
      schedule: { entries: [{ averageHoursPerWeek: 40, fulltimeHoursPerWeek: 40 }] },
    })
    expect(first.sourceVersionVector[`employment_salary:${timeline().salaries[0]!.id}`]).toBe(version)
    expect(reads.permission).toHaveBeenCalledWith('salary:read', employeeId)
    expect(reads.permission).toHaveBeenCalledWith('contract:read', employeeId)
    expect(reads.timeline).toHaveBeenCalledWith(employeeId, employmentId, period)
    expect(reads.income).toHaveBeenCalledWith(employeeId, employmentId)
    expect(reads.fiscal).toHaveBeenCalledWith(employeeId, employmentId, period)
    expect(reads.actualWork).toHaveBeenCalledWith({ employeeId, employmentId, month: '2026-07' })
    expect(reads.configurations).toHaveBeenCalledWith(scope, payrollAdministrationId)
    expect(reads.openings).toHaveBeenCalledWith(scope, payrollAdministrationId, employmentId)
  })

  it('uses that same default bridge in the normal read-only service and refuses incomplete sources', async () => {
    const result = await createEmployeePayrollCalculationService().inspectEmployeePayrollSource({ employeeId, employmentId, period })
    expect(result.eligibleForCalculation).toBe(false)
    expect(result.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'taxProfile', status: 'SOURCE_GAP' }),
      expect.objectContaining({ field: 'pension', status: 'SOURCE_GAP' }),
      expect.objectContaining({ field: 'payrollConfiguration', status: 'SOURCE_GAP' }),
    ]))
    expect(reads.access).toHaveBeenCalledWith(false)
    expect(reads.timeline).toHaveBeenCalledWith(employeeId, employmentId, period)
    expect(reads.lifecycle).not.toHaveBeenCalled()
  })

  it('rejects a foreign tenant before any employee source read', async () => {
    await expect(createLiquidHrPayrollSourceProvider().getPayrollSourceSnapshot({
      ...input, tenantId: '11000000-0000-4000-8000-000000000009',
    })).rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN', status: 403 })
    expect(reads.employments).not.toHaveBeenCalled()
    expect(reads.timeline).not.toHaveBeenCalled()
  })

  it('keeps Retail night work blocked when the standard Core projection has no business-scope contract', async () => {
    const source = timeline()
    const laborSetId = 'cc000000-0000-4000-8000-00000000000c'
    reads.timeline.mockResolvedValue({
      ...source,
      salaries: [{ ...source.salaries[0]!, salary_basis: 'CAO_SCALE', salary_route: 'SCALE_WITH_STEPS',
        fulltime_amount: 2542.50, parttime_amount: 1605.79, cao_scale_name: 'C', cao_step_name: '1' }],
      schedules: [{ ...source.schedules[0]!, average_hours_per_week: 24, fulltime_hours_per_week: 38, part_time_factor: 0.6316 }],
      contracts: [{ id: 'dd000000-0000-4000-8000-00000000000d', labor_condition_set_id: laborSetId,
        fulltime_hours_per_week: 38, starts_on: '2026-01-01', ends_on: null, updated_at: version }],
      laborConditions: [{ id: 'ee000000-0000-4000-8000-00000000000e', condition_group: 'CAO',
        labor_condition_set_id: laborSetId, valid_from: '2026-01-01', valid_until: null, updated_at: version,
        set: { id: laborSetId, code: 'RETAIL_NON_FOOD_MODE_2026_2027', name: 'Retail Non-Food Mode',
          standard_hours_per_week: 38, is_active: true, valid_from: '2026-01-01', updated_at: version } }],
    } satisfies PayrollSourceTimeline)
    const workTypeId = 'ff000000-0000-4000-8000-00000000000f'
    reads.actualWork.mockResolvedValue({
      period: { id: 'aa000000-0000-4000-8000-00000000000a', period_start: '2026-07-01',
        period_end: '2026-08-01', status: 'CLOSED', updated_at: version },
      types: [{ id: workTypeId, family: 'WORK', code: 'WEEKDAY_NIGHT', name: 'Nachtwerk',
        approval_required: true, valid_from: '2026-01-01', valid_until: null, updated_at: version }],
      entries: [{ id: 'ba000000-0000-4000-8000-00000000000a', employment_id: employmentId,
        work_hour_type_id: workTypeId, work_date: '2026-07-10', entry_granularity: 'DAY',
        subject_period_start: '2026-07-10', subject_period_end: '2026-07-11', posting_period_start: '2026-07-01',
        hours: 1, status: 'APPROVED', approved_at: '2026-07-11T09:00:00.000Z', updated_at: version }],
    } satisfies ActualWorkPayrollProjection)
    const result = await createEmployeePayrollCalculationService().inspectEmployeePayrollSource({ employeeId, employmentId, period })
    expect(result.eligibleForCalculation).toBe(false)
    expect(result.gaps).toContainEqual({
      field: 'cao', status: 'SOURCE_GAP', reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED',
    })
    expect(reads.lifecycle).not.toHaveBeenCalled()
  })

  it('fails closed when approved Retail premium hours have no interval-source contract', async () => {
    const source = timeline()
    const laborSetId = 'cc000000-0000-4000-8000-00000000000c'
    reads.timeline.mockResolvedValue({
      ...source,
      salaries: [{ ...source.salaries[0]!, salary_basis: 'CAO_SCALE', salary_route: 'SCALE_WITH_STEPS',
        fulltime_amount: 2542.50, parttime_amount: 1605.79, cao_scale_name: 'C', cao_step_name: '1' }],
      schedules: [{ ...source.schedules[0]!, average_hours_per_week: 24, fulltime_hours_per_week: 38, part_time_factor: 0.6316 }],
      contracts: [{ id: 'dd000000-0000-4000-8000-00000000000d', labor_condition_set_id: laborSetId,
        fulltime_hours_per_week: 38, starts_on: '2026-01-01', ends_on: null, updated_at: version }],
      laborConditions: [{ id: 'ee000000-0000-4000-8000-00000000000e', condition_group: 'CAO',
        labor_condition_set_id: laborSetId, valid_from: '2026-01-01', valid_until: null, updated_at: version,
        set: { id: laborSetId, code: 'RETAIL_NON_FOOD_MODE_2026_2027', name: 'Retail Non-Food Mode',
          standard_hours_per_week: 38, is_active: true, valid_from: '2026-01-01', updated_at: version } }],
      retailBusinessScope: {
        tenantId: scope.tenantId, administrationId: scope.administrationId,
        value: 'IN_STORE', sourceClassification: 'SYNTHETIC_FIXTURE',
        sourceReference: 'SYNTHETIC_FIXTURE:explicit provider-contract test', sourceVersion: 'retail-context-v1',
        effectiveFrom: '2026-01-01', effectiveTo: null,
      },
    } satisfies PayrollSourceTimeline)
    const nightTypeId = 'ff000000-0000-4000-8000-00000000000f'
    const overtimeTypeId = 'fa000000-0000-4000-8000-00000000000a'
    reads.actualWork.mockResolvedValue({
      period: { id: 'aa000000-0000-4000-8000-00000000000a', period_start: '2026-07-01',
        period_end: '2026-08-01', status: 'CLOSED', updated_at: version },
      types: [
        { id: nightTypeId, family: 'WORK', code: 'WEEKDAY_NIGHT', name: 'Nachtwerk',
          approval_required: true, valid_from: '2026-01-01', valid_until: null, updated_at: version },
        { id: overtimeTypeId, family: 'OVERTIME', code: 'DAILY_OVERTIME', name: 'Overwerk',
          approval_required: true, valid_from: '2026-01-01', valid_until: null, updated_at: version },
      ],
      entries: [
        { id: 'ba000000-0000-4000-8000-00000000000a', employment_id: employmentId,
          work_hour_type_id: nightTypeId, work_date: '2026-07-10', entry_granularity: 'DAY',
          subject_period_start: '2026-07-10', subject_period_end: '2026-07-11', posting_period_start: '2026-07-01',
          hours: 1, status: 'APPROVED', approved_at: '2026-07-11T09:00:00.000Z', updated_at: version },
        { id: 'ba000000-0000-4000-8000-00000000000b', employment_id: employmentId,
          work_hour_type_id: overtimeTypeId, work_date: '2026-07-10', entry_granularity: 'DAY',
          subject_period_start: '2026-07-10', subject_period_end: '2026-07-11', posting_period_start: '2026-07-01',
          hours: 1, status: 'APPROVED', approved_at: '2026-07-11T09:00:00.000Z', updated_at: version },
      ],
    } satisfies ActualWorkPayrollProjection)

    const result = await createEmployeePayrollCalculationService().inspectEmployeePayrollSource({ employeeId, employmentId, period })
    expect(result.eligibleForCalculation).toBe(false)
    expect(result.gaps).toContainEqual({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_INTERVAL_SOURCE_UNAVAILABLE',
    })
    expect(result.gaps).not.toContainEqual(expect.objectContaining({ reasonCode: 'OVERTIME_RULE_NOT_CONFIGURED' }))
    expect(reads.lifecycle).not.toHaveBeenCalled()
  })

  it('rejects a Retail context from another administration', async () => {
    const source = timeline()
    const foreignScopeSource: PayrollSourceTimeline = {
      ...source,
      retailBusinessScope: {
        tenantId: scope.tenantId,
        administrationId: '33000000-0000-4000-8000-000000000009',
        value: 'IN_STORE', sourceClassification: 'SYNTHETIC_FIXTURE',
        sourceReference: 'SYNTHETIC_FIXTURE:mis-scoped test', sourceVersion: 'retail-context-v1',
        effectiveFrom: '2026-01-01', effectiveTo: null,
      },
    }
    const provider = createLiquidHrPayrollSourceProvider({
      authorize: async () => scope,
      listEmployments: async () => [source.employment],
      loadTimeline: async () => foreignScopeSource,
      loadActualWork: async () => ({ period: null, entries: [], types: [] }),
      isEnabled: () => true,
    })
    await expect(provider.getPayrollSourceSnapshot(input))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN', status: 403 })
  })

  it('rejects another employee employment before loading its timeline', async () => {
    reads.employments.mockResolvedValue([{ ...timeline().employment, employee_id: '66000000-0000-4000-8000-000000000009' }])
    await expect(createLiquidHrPayrollSourceProvider().getPayrollSourceSnapshot(input))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', status: 404 })
    expect(reads.timeline).not.toHaveBeenCalled()
  })

  it('rechecks the returned Core timeline employee scope before Payroll setup reads', async () => {
    const source = timeline()
    reads.timeline.mockResolvedValue({ ...source, employment: { ...source.employment, employee_id: '66000000-0000-4000-8000-000000000009' } })
    await expect(createLiquidHrPayrollSourceProvider().getPayrollSourceSnapshot(input))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN', status: 403 })
    expect(reads.configurations).not.toHaveBeenCalled()
  })
})
