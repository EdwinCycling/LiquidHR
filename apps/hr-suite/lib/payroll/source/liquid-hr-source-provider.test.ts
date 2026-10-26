import { describe, expect, it, vi } from 'vitest'
import {
  LiquidHrPayrollSourceProvider,
  PayrollSourceProviderError,
  getPayrollSourceSnapshotCorrelationId,
  type PayrollSourceSetup,
  type PayrollSourceEmployment,
  type PayrollSourceIncomeRelationship,
  type PayrollSourceTimeline,
  type PayrollSourceProviderDependencies,
  type PayrollSourceSalary,
  type PayrollSourceSchedule,
  type PayrollSourceTaxProfileProjection,
} from './liquid-hr-source-provider'
import { AuthorizationError } from '@/lib/auth/permissions'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollSourceProviderInput,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { createPayfull02RulePackage, PAYFULL02_RULE_REGISTRY } from '@liquid-hr/payroll-rules-nl-2026'
import type { ActualWorkPayrollProjection } from '@/lib/actual-work/actual-work-service'
import { assertActivePayrollEmployerConfiguration, hashPayrollEmployerConfiguration } from '../payroll-setup'

const tenantId = '10000000-0000-4000-8000-000000000001'
const hrGroupId = '20000000-0000-4000-8000-000000000002'
const administrationId = '30000000-0000-4000-8000-000000000003'
const otherAdministrationId = '30000000-0000-4000-8000-000000000004'
const employeeId = '40000000-0000-4000-8000-000000000004'
const employmentId = '50000000-0000-4000-8000-000000000005'
const salaryId = '60000000-0000-4000-8000-000000000006'
const scheduleId = '70000000-0000-4000-8000-000000000007'
const incomeLinkId = '81000000-0000-4000-8000-000000000008'
const incomeRelationshipId = '82000000-0000-4000-8000-000000000008'
const actualWorkPeriodId = '83000000-0000-4000-8000-000000000008'
const actualWorkTypeId = '84000000-0000-4000-8000-000000000008'
const actualWorkEntryId = '85000000-0000-4000-8000-000000000008'
const taxProfileId = '86000000-0000-4000-8000-000000000008'

const request: PayrollSourceProviderInput = {
  tenantId,
  hrGroupId,
  administrationId,
  employeeId,
  payrollPeriod: { year: 2026, month: 9 },
}

function employment(overrides: Partial<PayrollSourceEmployment> = {}): PayrollSourceEmployment {
  return {
    id: employmentId,
    tenant_id: tenantId,
    hr_group_id: hrGroupId,
    administration_id: administrationId,
    employee_id: employeeId,
    starts_on: '2026-09-01',
    ends_on: null,
    record_status: 'CONFIRMED' as PayrollSourceEmployment['record_status'],
    employment_type: 'REGULAR' as PayrollSourceEmployment['employment_type'],
    contract_type: 'PERMANENT' as PayrollSourceEmployment['contract_type'],
    original_hire_date: '2026-09-01',
    seniority_date: '2026-09-01',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function salary(overrides: Partial<PayrollSourceSalary> = {}): PayrollSourceSalary {
  return {
    id: salaryId,
    salary_basis: 'MANUAL' as PayrollSourceSalary['salary_basis'],
    salary_route: 'MANUAL' as PayrollSourceSalary['salary_route'],
    payment_type: 'PERIODIC_FIXED' as PayrollSourceSalary['payment_type'],
    payment_frequency: 'MONTHLY' as PayrollSourceSalary['payment_frequency'],
    currency_code: 'EUR',
    fulltime_amount: 3200,
    parttime_amount: 3200,
    hourly_rate: null,
    salary_structure_id: null,
    salary_scale_id: null,
    salary_scale_step_id: null,
    salary_step_code: null,
    cao_scale_name: null,
    cao_step_name: null,
    salary_band_id: null,
    valid_from: '2026-09-01',
    valid_until: null,
    updated_at: '2026-09-01T10:05:00.000Z',
    ...overrides,
  }
}

function schedule(overrides: Partial<PayrollSourceSchedule> = {}): PayrollSourceSchedule {
  return {
    id: scheduleId,
    average_days_per_week: 5,
    average_hours_per_week: 40,
    fulltime_hours_per_week: 40,
    part_time_factor: 1,
    schedule_type: 'HOURS_PER_DAY',
    is_on_call: false,
    valid_from: '2026-09-01',
    valid_until: null,
    updated_at: '2026-09-01T10:10:00.000Z',
    ...overrides,
  }
}

function incomeRelationship(overrides: Partial<PayrollSourceIncomeRelationship> = {}): PayrollSourceIncomeRelationship {
  return {
    id: incomeLinkId,
    incomeRelationshipId,
    validFrom: '2026-09-01',
    validUntil: null,
    linkUpdatedAt: '2026-09-01T10:15:00.000Z',
    reportingStatus: 'DRAFT',
    startsOn: '2026-09-01',
    endsOn: null,
    incomeRelationshipUpdatedAt: '2026-09-01T10:20:00.000Z',
    ...overrides,
  }
}

function taxProfile(overrides: Partial<PayrollSourceTaxProfileProjection['taxProfiles'][number]> = {}): PayrollSourceTaxProfileProjection['taxProfiles'][number] {
  return {
    id: taxProfileId,
    employee_id: employeeId,
    employment_id: employmentId,
    income_relationship_id: incomeRelationshipId,
    employment_income_relationship_id: incomeLinkId,
    residence_country_code: 'NL',
    wage_tax_table: 'WHITE',
    herleiding_code: 'STD',
    time_period: 'MONTH',
    regular_wage_only: true,
    full_period_only: true,
    has_special_situation: false,
    payroll_tax_credit_applies: true,
    source_classification: 'HR_ADMIN_CONFIRMED',
    source_reference: 'declaration-ref',
    effective_from: '2026-09-01',
    effective_to: null,
    version_number: 1,
    supersedes_profile_id: null,
    confirmed_by_user_id: '87000000-0000-4000-8000-000000000008',
    confirmed_at: '2026-08-28T09:00:00.000Z',
    created_at: '2026-08-28T09:00:00.000Z',
    ...overrides,
  }
}

function taxProjection(overrides: Partial<PayrollSourceTaxProfileProjection> = {}): PayrollSourceTaxProfileProjection {
  return {
    ageCategory: 'UNDER_AOW',
    ageSourceUpdatedAt: '2026-08-28T08:00:00.000Z',
    activeIncomeRelationshipCount: 1,
    incomeRelationshipLinkGap: false,
    incomeRelationships: [{
      id: incomeRelationshipId,
      updatedAt: '2026-09-01T10:20:00.000Z',
      reportingStatus: 'READY',
      ikvNumber: 1,
      startsOn: '2026-01-01',
      endsOn: null,
    }],
    taxProfiles: [taxProfile()],
    ...overrides,
  }
}

function actualWork(overrides: Partial<ActualWorkPayrollProjection> = {}): ActualWorkPayrollProjection {
  return {
    period: {
      id: actualWorkPeriodId,
      period_start: '2026-09-01',
      period_end: '2026-10-01',
      status: 'CLOSED',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    entries: [],
    types: [],
    ...overrides,
  }
}

function actualWorkEntry(overrides: Partial<ActualWorkPayrollProjection['entries'][number]> = {}): ActualWorkPayrollProjection['entries'][number] {
  return {
    id: actualWorkEntryId,
    employment_id: employmentId,
    work_hour_type_id: actualWorkTypeId,
    work_date: '2026-09-10',
    entry_granularity: 'DAY',
    subject_period_start: '2026-09-10',
    subject_period_end: '2026-09-11',
    posting_period_start: '2026-09-01',
    hours: 8,
    status: 'APPROVED',
    approved_at: '2026-09-11T10:00:00.000Z',
    updated_at: '2026-09-11T10:00:00.000Z',
    ...overrides,
  }
}

function actualWorkType(overrides: Partial<ActualWorkPayrollProjection['types'][number]> = {}): ActualWorkPayrollProjection['types'][number] {
  return {
    id: actualWorkTypeId,
    family: 'WORK',
    valid_from: '2026-01-01',
    valid_until: null,
    approval_required: true,
    updated_at: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}

function withPayrollReleases(
  projection: ActualWorkPayrollProjection,
  mapping: { target?: 'PAYMENT' | 'PREMIUM'; factor?: number } = {},
): ActualWorkPayrollProjection {
  const typeById = new Map(projection.types.map((type) => [type.id, type]))
  return {
    ...projection,
    currentRevisionNumbers: Object.fromEntries(projection.entries.map((entry) => [entry.id, 1])),
    payrollReleases: projection.entries.map((entry) => {
      const type = typeById.get(entry.work_hour_type_id)
      if (!type) throw new Error('SYNTHETIC_ACTUAL_WORK_TYPE_MISSING')
      return {
        id: `release-${entry.id}`,
        entry_id: entry.id,
        entry_revision_number: 1,
        payroll_period_start: entry.posting_period_start,
        release_class: 'INITIAL',
        content_fingerprint: 'a'.repeat(64),
        work_hour_type_updated_at: type.updated_at,
        released_at: '2026-09-15T10:00:00.000Z',
        mapping: {
          id: `mapping-${type.id}`,
          processing_target: mapping.target ?? 'PAYMENT',
          salary_component_id: 'system:payfull02:payfull02_variable_regular_wage',
          salary_component_code: 'PAYFULL02_VARIABLE_REGULAR_WAGE',
          salary_component_version: '2026.1-payfull02',
          salary_component_output: 'amount',
          calculation_rule: 'HOURLY_RATE_X_HOURS',
          factor: mapping.factor ?? 1,
          version_number: 1,
          valid_from: '2026-01-01',
          valid_until: null,
        },
      }
    }),
  }
}

function dependencies(overrides: Partial<PayrollSourceProviderDependencies> = {}): PayrollSourceProviderDependencies {
  return {
    authorize: vi.fn(async () => ({ tenantId, hrGroupId, administrationId })),
    listEmployments: vi.fn(async () => [employment()]),
    loadTimeline: vi.fn(async () => ({ employment: employment(), salaries: [salary()], schedules: [schedule()] })),
    loadActualWork: vi.fn(async () => actualWork()),
    isEnabled: vi.fn(() => true),
    now: () => new Date('2026-09-30T12:00:00.000Z'),
    createId: () => '80000000-0000-4000-8000-000000000008',
    ...overrides,
  }
}

function completePayrollSetup(): PayrollSourceSetup {
  const configuration = assertActivePayrollEmployerConfiguration({
    schemaVersion: 'payroll-employer-configuration-v1',
    effectiveFrom: '2026-01-01', effectiveTo: null, status: 'ACTIVE', sourceReference: 'Mars BV payroll decision 2026',
    employer: {
      sectorCode: '001', whkDecisionReference: 'WHK-2026', awfClassification: 'LOW',
      aofClassification: 'AOF-01', wkoClassification: 'WKO-01', zvwClassification: 'EMPLOYER_LEVY',
    },
    employerRates: { awf: '1.00', aof: '2.00', wko: '0.50', whk: '1.50', zvw: '6.10' },
    reserves: { holidayAllowanceRate: '8.00', yearEndApplies: false, yearEndRate: null },
    pension: { partialMonthMethod: 'CALENDAR_DAYS_PRO_RATA', methodSourceReference: 'MARS-PENSION-2026 v1' },
  })
  const configurationRow = {
    id: '91000000-0000-4000-8000-000000000009',
    payroll_administration_id: administrationId,
    source_tenant_id: tenantId,
    source_hr_group_id: hrGroupId,
    source_administration_id: administrationId,
    configuration_version: 1,
    effective_from: '2026-01-01',
    effective_to: null,
    configuration_json: configuration,
    configuration_hash: hashPayrollEmployerConfiguration(configuration),
    status: 'ACTIVE' as const,
    source_reference: configuration.sourceReference,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by_user_id: employeeId,
  }
  const openingBalanceJson = {
    schemaVersion: 'payroll-opening-cumulative-v1',
    sourcePeriodFrom: '2026-01-01',
    sourcePeriodTo: '2026-08-31',
    asOfDate: '2026-08-31',
    meaning: {
      grossWageBeforePeriod: '0.00',
      holidayReserveBeforePeriod: '0.00',
      yearEndReserveBeforePeriod: '0.00',
      taxableWageBeforePeriod: '0.00',
      wageTaxBeforePeriod: '0.00',
      employeeInsuranceWageBeforePeriod: '0.00',
      zvwWageBeforePeriod: '0.00',
    },
    sourceReference: 'Mars BV HR opening cumulative statement 2026',
  }
  const openingBalance = {
    id: '94000000-0000-4000-8000-000000000009',
    payroll_administration_id: administrationId,
    source_tenant_id: tenantId,
    source_hr_group_id: hrGroupId,
    source_administration_id: administrationId,
    source_employment_id: employmentId,
    snapshot_version: 1,
    as_of_date: '2026-08-31',
    opening_balance_json: openingBalanceJson,
    snapshot_hash: sha256(stableSerialize(openingBalanceJson)),
    provenance_status: 'CUSTOMER_OPENING_BALANCE' as const,
    provenance_source: 'Mars BV HR opening cumulative statement 2026',
    created_at: '2026-01-01T00:00:00.000Z',
    created_by_user_id: employeeId,
  }
  return { configurationRows: [configurationRow], configurationRow, configuration, openingBalance }
}

describe('LiquidHR Payroll source provider', () => {
  it('preserves source fingerprints when timeline and Actual Work data are batch-read', async () => {
    const timeline: PayrollSourceTimeline = {
      employment: employment(),
      salaries: [salary()],
      schedules: [schedule()],
    }
    const batchActualWork = actualWork({
      entries: [actualWorkEntry({ hours: 4 })],
      types: [actualWorkType({ family: 'WORK', code: 'SUNDAY_PREMIUM', name: 'Zondagwerk' })],
    })
    const loadTimeline = vi.fn(async () => timeline)
    const loadTimelineBatch = vi.fn(async () => [timeline])
    const loadActualWork = vi.fn(async () => batchActualWork)
    const loadActualWorkBatch = vi.fn(async () => [batchActualWork])
    const input = { ...request, employmentId }
    const batchProvider = new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline,
      loadTimelineBatch,
      loadActualWork,
      loadActualWorkBatch,
    }))
    const batchResults = await batchProvider.getPayrollSourceSnapshots([input])
    const single = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => timeline),
      loadActualWork: vi.fn(async () => batchActualWork),
    })).getPayrollSourceSnapshot(input)
    const batchSnapshot = batchResults[0]

    expect(loadTimelineBatch).toHaveBeenCalledWith([{
      employeeId,
      employmentId,
      payrollPeriod: request.payrollPeriod,
    }])
    expect(loadTimeline).not.toHaveBeenCalled()
    expect(loadActualWork).not.toHaveBeenCalled()
    expect(batchSnapshot?.status).toBe('fulfilled')
    if (batchSnapshot?.status !== 'fulfilled') throw new Error('BATCH_SOURCE_SNAPSHOT_UNAVAILABLE')
    expect(batchSnapshot.value.sourceHash).toBe(single.sourceHash)
    expect(batchSnapshot.value.canonicalSource).toEqual(single.canonicalSource)
    expect(batchSnapshot.value.sourceVersionVector).toEqual(single.sourceVersionVector)
    expect(batchSnapshot.value.sourceGaps).toEqual(single.sourceGaps)
  })

  it('validates employment scope before starting W03 batch reads', async () => {
    for (const invalidEmployment of [
      employment({ administration_id: otherAdministrationId }),
      employment({ starts_on: '2026-10-01' }),
    ]) {
      const loadTimelineBatch = vi.fn(async () => [{
        employment: employment(), salaries: [salary()], schedules: [schedule()],
      } satisfies PayrollSourceTimeline])
      const loadActualWorkBatch = vi.fn(async () => [actualWork()])
      const result = (await new LiquidHrPayrollSourceProvider(dependencies({
        listEmployments: vi.fn(async () => [invalidEmployment]),
        loadTimelineBatch,
        loadActualWorkBatch,
      })).getPayrollSourceSnapshots([{ ...request, employmentId }]))[0]

      expect(result).toMatchObject({
        status: 'rejected',
        reason: { code: 'PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', status: 404 },
      })
      expect(loadTimelineBatch).not.toHaveBeenCalled()
      expect(loadActualWorkBatch).not.toHaveBeenCalled()
    }
  })

  it('checks Retail business scope before starting the W03 Actual Work batch', async () => {
    const timeline: PayrollSourceTimeline = {
      employment: employment(),
      salaries: [salary()],
      schedules: [schedule()],
      retailBusinessScope: {
        tenantId,
        administrationId: otherAdministrationId,
        value: 'IN_STORE',
        sourceClassification: 'SYNTHETIC_FIXTURE',
        sourceReference: 'SYNTHETIC_FIXTURE:integration scope test',
        sourceVersion: 'retail-context-v1',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
    }
    const loadActualWorkBatch = vi.fn(async () => [actualWork()])
    const result = (await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimelineBatch: vi.fn(async () => [timeline]),
      loadActualWorkBatch,
    })).getPayrollSourceSnapshots([{ ...request, employmentId }]))[0]

    expect(result).toMatchObject({
      status: 'rejected',
      reason: { code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN', status: 403 },
    })
    expect(loadActualWorkBatch).not.toHaveBeenCalled()
  })

  it('blocks unreleased Retail overtime before it can enter the Payroll snapshot', async () => {
    const retailBusinessScope: NonNullable<PayrollSourceTimeline['retailBusinessScope']> = {
      tenantId,
      administrationId,
      value: 'IN_STORE',
      sourceClassification: 'SYNTHETIC_FIXTURE',
      sourceReference: 'SYNTHETIC_FIXTURE:integration interval test',
      sourceVersion: 'retail-context-v1',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    }
    const timeline: PayrollSourceTimeline = {
      employment: employment(),
      salaries: [salary()],
      schedules: [schedule()],
      laborConditions: [{
        id: '8d000000-0000-4000-8000-000000000018',
        condition_group: 'CAO',
        labor_condition_set_id: '8c000000-0000-4000-8000-000000000018',
        valid_from: '2026-01-01',
        valid_until: null,
        updated_at: '2026-01-01T00:00:00.000Z',
        set: {
          id: '8c000000-0000-4000-8000-000000000018',
          code: 'RETAIL_NON_FOOD_MODE_2026_2027',
          name: 'Retail Non-Food / Mode 2026-2027',
          standard_hours_per_week: 38,
          is_active: true,
          valid_from: '2026-01-01',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      }],
      retailBusinessScope,
    }
    const batchActualWork = actualWork({
      entries: [actualWorkEntry({ hours: 1 })],
      types: [actualWorkType({ family: 'OVERTIME', code: 'DAILY_OVERTIME', name: 'Overwerk' })],
    })
    const result = (await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimelineBatch: vi.fn(async () => [timeline]),
      loadActualWorkBatch: vi.fn(async () => [batchActualWork]),
    })).getPayrollSourceSnapshots([{ ...request, employmentId }]))[0]

    expect(result?.status).toBe('fulfilled')
    if (result?.status !== 'fulfilled') throw new Error('BATCH_SOURCE_SNAPSHOT_UNAVAILABLE')
    expect(result.value.sourceGaps).toContainEqual({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_PAYROLL_RELEASE_REQUIRED',
    })
  })

  it('falls back to established individual reads when a timeline batch is incomplete', async () => {
    const loadTimeline = vi.fn(async () => ({ employment: employment(), salaries: [salary()], schedules: [schedule()] }))
    const loadActualWork = vi.fn(async () => actualWork())
    const loadActualWorkBatch = vi.fn(async () => { throw new Error('BATCH_READ_UNAVAILABLE') })
    const results = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline,
      loadTimelineBatch: vi.fn(async () => { throw new Error('BATCH_READ_UNAVAILABLE') }),
      loadActualWork,
      loadActualWorkBatch,
    })).getPayrollSourceSnapshots([{ ...request, employmentId }])

    expect(results[0]?.status).toBe('fulfilled')
    expect(loadTimeline).toHaveBeenCalledOnce()
    expect(loadActualWork).toHaveBeenCalledOnce()
    expect(loadActualWorkBatch).not.toHaveBeenCalled()
  })

  it('excludes a denied employee from all batch source reads', async () => {
    const deniedEmployeeId = '41000000-0000-4000-8000-000000000041'
    const listEmployments = vi.fn(async () => [employment()])
    const authorize = vi.fn(async (targetEmployeeId: string) => {
      if (targetEmployeeId === deniedEmployeeId) throw new AuthorizationError('PAYROLL_SOURCE_SCOPE_FORBIDDEN')
      return { tenantId, hrGroupId, administrationId }
    })
    const loadTimelineBatch = vi.fn(async (inputs: readonly { readonly employeeId: string }[]) => {
      expect(inputs.map((input) => input.employeeId)).toEqual([employeeId])
      return [{ employment: employment(), salaries: [salary()], schedules: [schedule()] }]
    })
    const loadActualWorkBatch = vi.fn(async (inputs: readonly { readonly employeeId: string }[]) => {
      expect(inputs.map((input) => input.employeeId)).toEqual([employeeId])
      return [actualWork()]
    })
    const results = await new LiquidHrPayrollSourceProvider(dependencies({
      authorize,
      listEmployments,
      loadTimelineBatch,
      loadActualWorkBatch,
    })).getPayrollSourceSnapshots([
      { ...request, employmentId },
      { ...request, employeeId: deniedEmployeeId, employmentId: '51000000-0000-4000-8000-000000000051' },
    ])

    expect(results[0]?.status).toBe('fulfilled')
    expect(results[1]?.status).toBe('rejected')
    expect(listEmployments).toHaveBeenCalledExactlyOnceWith(employeeId)
    expect(loadTimelineBatch).toHaveBeenCalledOnce()
    expect(loadActualWorkBatch).toHaveBeenCalledOnce()
  })

  it('keeps the Payroll Lab kill switch ahead of all source reads in the batched path', async () => {
    const deps = dependencies({
      isEnabled: vi.fn(() => false),
      authorize: vi.fn(async () => ({ tenantId, hrGroupId, administrationId })),
      listEmployments: vi.fn(async () => [employment()]),
      loadTimelineBatch: vi.fn(async () => [{ employment: employment(), salaries: [salary()], schedules: [schedule()] }]),
      loadActualWorkBatch: vi.fn(async () => [actualWork()]),
    })

    const result = (await new LiquidHrPayrollSourceProvider(deps)
      .getPayrollSourceSnapshots([{ ...request, employmentId }]))[0]

    expect(result).toMatchObject({
      status: 'rejected',
      reason: { code: 'PAYROLL_SOURCE_DISABLED', status: 503 },
    })
    expect(deps.authorize).not.toHaveBeenCalled()
    expect(deps.listEmployments).not.toHaveBeenCalled()
    expect(deps.loadTimelineBatch).not.toHaveBeenCalled()
    expect(deps.loadActualWorkBatch).not.toHaveBeenCalled()
  })

  it('keeps the individual source fingerprint when Actual Work reads use the scoped batch path', async () => {
    const batchActualWork = actualWork({
      entries: [actualWorkEntry({ hours: 4 })],
      types: [actualWorkType({ family: 'WORK', code: 'SUNDAY_PREMIUM', name: 'Zondagwerk' })],
    })
    const loadActualWork = vi.fn(async () => { throw new Error('SINGLE_ACTUAL_WORK_READ_SHOULD_NOT_RUN') })
    const loadActualWorkBatch = vi.fn(async () => [batchActualWork])
    const authorize = vi.fn(async () => ({ tenantId, hrGroupId, administrationId }))
    const input = { ...request, employmentId }
    const batchProvider = new LiquidHrPayrollSourceProvider(dependencies({ loadActualWork, loadActualWorkBatch, authorize }))
    const batchResults = await batchProvider.getPayrollSourceSnapshots([input])
    const singleProvider = new LiquidHrPayrollSourceProvider(dependencies({ loadActualWork: async () => batchActualWork }))
    const single = await singleProvider.getPayrollSourceSnapshot(input)
    const batchSnapshot = batchResults[0]

    expect(loadActualWorkBatch).toHaveBeenCalledWith([{
      employeeId,
      employmentId,
      month: '2026-09',
    }], [{ employeeId, tenantId, hrGroupId, administrationId }])
    expect(loadActualWork).not.toHaveBeenCalled()
    expect(authorize).toHaveBeenCalledOnce()
    expect(batchSnapshot?.status).toBe('fulfilled')
    if (batchSnapshot?.status !== 'fulfilled') throw new Error('BATCH_SOURCE_SNAPSHOT_UNAVAILABLE')
    expect(batchSnapshot.value.sourceHash).toBe(single.sourceHash)
    expect(batchSnapshot.value.canonicalSource).toEqual(single.canonicalSource)
    expect(batchSnapshot.value.sourceVersionVector).toEqual(single.sourceVersionVector)
    expect(batchSnapshot.value.sourceGaps).toEqual(single.sourceGaps)
  })

  it('projects an effective 1 November CAO scale and only the November work-hours source', async () => {
    const salaryStructureId = '60000000-0000-4000-8000-000000000061'
    const salaryScaleId = '60000000-0000-4000-8000-000000000062'
    const salaryStepId = '60000000-0000-4000-8000-000000000063'
    const loadActualWork = vi.fn(async (_employeeId: string, _employmentId: string, month: string) => {
      expect(month).toBe('2026-11')
      return actualWork({ entries: [], types: [] })
    })
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({
          salary_basis: 'CAO_SCALE',
          fulltime_amount: 2819,
          parttime_amount: 1879.33,
          salary_structure_id: salaryStructureId,
          salary_scale_id: salaryScaleId,
          salary_scale_step_id: salaryStepId,
          salary_step_code: '12',
          cao_scale_name: 'Schaal 6',
          cao_step_name: 'Salarisnummer 12',
          valid_from: '2026-11-01',
        })],
        schedules: [schedule({
          average_hours_per_week: 24,
          fulltime_hours_per_week: 36,
          part_time_factor: 2 / 3,
          valid_from: '2026-11-01',
        })],
      })),
      loadActualWork,
    })).getPayrollSourceSnapshot({ ...request, payrollPeriod: { year: 2026, month: 11 } })

    const source = snapshot.canonicalSource as {
      readonly compensation: { readonly entries: readonly Record<string, unknown>[] }
      readonly actualWork: { readonly entries: readonly unknown[] }
    }
    expect(source.compensation.entries).toEqual([expect.objectContaining({
      salaryBasis: 'CAO_SCALE',
      fulltimeAmount: 2819,
      parttimeAmount: 1879.33,
      salaryStructureId,
      salaryScaleId,
      salaryScaleStepId: salaryStepId,
      salaryStepCode: '12',
      caoScaleName: 'Schaal 6',
      caoStepName: 'Salarisnummer 12',
      validFrom: '2026-11-01',
    })])
    expect(source.actualWork.entries).toEqual([])
    expect(snapshot.sourceGaps.some((gap) => ['NO_EFFECTIVE_SALARY_ROW', 'NO_EFFECTIVE_SCHEDULE_ROW'].includes(gap.reasonCode))).toBe(false)
    expect(loadActualWork).toHaveBeenCalledOnce()
  })

  it('starts the actual-work read only after the employment timeline finishes', async () => {
    let releaseTimeline = () => {}
    let markTimelineStarted = () => {}
    const timelineGate = new Promise<void>((resolve) => { releaseTimeline = resolve })
    const timelineStarted = new Promise<void>((resolve) => { markTimelineStarted = resolve })
    const events: string[] = []
    const loadTimeline = vi.fn(async () => {
      events.push('timeline-started')
      markTimelineStarted()
      await timelineGate
      events.push('timeline-completed')
      return { employment: employment(), salaries: [salary()], schedules: [schedule()] }
    })
    const loadActualWork = vi.fn(async () => {
      events.push('actual-work-started')
      return actualWork({ entries: [], types: [] })
    })
    const snapshotPromise = new LiquidHrPayrollSourceProvider(dependencies({ loadTimeline, loadActualWork }))
      .getPayrollSourceSnapshot(request)

    await timelineStarted
    expect(loadActualWork).not.toHaveBeenCalled()

    releaseTimeline()
    await snapshotPromise

    expect(events).toEqual(['timeline-started', 'timeline-completed', 'actual-work-started'])
  })

  it('pays an explicitly mapped regular work type without inferring its CAO class from labels', async () => {
    const setup = completePayrollSetup()
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({
          salary_basis: 'CAO_SCALE',
          payment_type: 'HOURLY_VARIABLE',
          hourly_rate: 18,
          fulltime_amount: 2819,
          parttime_amount: 1879.33,
          cao_scale_name: 'Schaal 6',
          cao_step_name: 'Salarisnummer 12',
          salary_step_code: '12',
        })],
        schedules: [schedule({ average_hours_per_week: 24, fulltime_hours_per_week: 36, part_time_factor: 2 / 3 })],
        contracts: [{
          id: '8b000000-0000-4000-8000-000000000008',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          fulltime_hours_per_week: 36,
          starts_on: '2026-09-01',
          ends_on: null,
          updated_at: '2026-09-01T10:01:00.000Z',
        }],
        laborConditions: [{
          id: '8d000000-0000-4000-8000-000000000008',
          condition_group: 'CAO',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          valid_from: '2026-01-01',
          valid_until: null,
          updated_at: '2026-01-01T10:02:00.000Z',
          set: {
            id: '8c000000-0000-4000-8000-000000000008',
            code: 'CAO_KINDEROPVANG_2025_2026',
            name: 'Cao Kinderopvang 2025-2026',
            standard_hours_per_week: 36,
            is_active: true,
            valid_from: '2025-01-01',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        }],
        incomeRelationships: [incomeRelationship({ reportingStatus: 'READY' })],
        taxProfileProjection: taxProjection(),
        pensionAssignments: [{
          id: '92000000-0000-4000-8000-000000000009', pension_arrangement_id: 'MARS-PENSION-2026',
          effective_from: '2026-01-01', effective_to: null, participation_start_date: '2026-09-01',
          assignment_reason: 'CORE', provenance_json: {}, updated_at: '2026-01-01T00:00:00.000Z', version_number: 1,
          supersedes_assignment_id: null, arrangement_resolution_reason: null, arrangement_resolution_change_version_ids: [], age_for_tier: null,
          arrangement: {
            id: 'MARS-PENSION-2026', code: 'MARS-PENSION-2026', name: 'Mars pension 2026', arrangement_type: 'FLAT_PREMIUM',
            effective_from: '2026-01-01', arrangement_established_from: '2026-01-01', effective_to: null, transition_date: null,
            grandfathering_mode: 'NONE', flat_total_rate: 25, employer_share_pct: 60, employee_share_pct: 40,
            annual_franchise: 19172, annual_pensionable_salary_cap: 137800,
            pensionable_salary_definition: { annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY', basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE', floorAtZero: true },
            eligibility_rule: { participantGroup: 'NEW_ENTRANT' },
            contract_classification: 'SOLIDARITY' as const, contract_classification_provenance: {}, provenance_json: {}, is_active: true,
            version_id: '93000000-0000-4000-8000-000000000009', version_number: 1, version_created_at: '2026-01-01T00:00:00.000Z',
            source_updated_at: '2026-01-01T00:00:00.000Z', tiers: [],
          },
        }],
      })),
      loadActualWork: vi.fn(async () => withPayrollReleases(actualWork({
        entries: [actualWorkEntry({ hours: 4 })],
        types: [actualWorkType({ family: 'WORK', code: 'SUNDAY_PREMIUM', name: 'Zondagwerk' })],
      }), { target: 'PAYMENT', factor: 0.45 })),
      loadPayrollSetup: vi.fn(async () => setup),
    })).getPayrollSourceSnapshot({ ...request, payrollPeriod: { year: 2026, month: 9 } })

    const source = snapshot.canonicalSource as Record<string, unknown>
    expect(snapshot.sourceGaps).toEqual([])
    const cao = source.caoCalculation as Record<string, unknown>
    const regularWage = source.regularWage as Record<string, unknown>
    const payrollOwned = source.payrollOwned as Record<string, unknown>
    const amounts = payrollOwned.amounts as Record<string, unknown>
    const controls = payrollOwned.controls as Record<string, unknown>

    expect(cao).toMatchObject({ status: 'CALCULATED', family: 'KINDEROPVANG', grossAmount: '1879.333333333333333333', premiumAmount: '0.000000000000000000' })
    expect(regularWage).toMatchObject({ grossAmount: '1879.333333333333333333', fulltimeMonthlyAmount: '2819', caoApplied: true })
    expect(amounts.variableRegularWage).toBe('32.40')
    expect(controls.additionalHoursSupported).toBe(true)

    const calculationInputs = buildCalculationInputs(snapshot as PayrollSourceSnapshot, createPayfull02RulePackage('CUSTOMER_STANDARD', {
      supportCaoExactGross: true,
    }), {
      effectiveDate: '2026-09-01',
      scopeInstanceIds: {
        EMPLOYEE: snapshot.sourceEmployeeId,
        EMPLOYMENT: snapshot.sourceEmploymentId,
        INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
      },
      calculationContextHash: 'a'.repeat(64),
    })
    const calculation = calculatePayroll(calculationInputs, PAYFULL02_RULE_REGISTRY)
    const resultAmount = (key: string) => calculation.resultRows.find((row) => row.key === key)?.value
    expect(calculation.status).toBe('CALCULATED')
    expect(resultAmount('gross_salary')).toBe('1879.33')
    expect(resultAmount('variable_regular_wage')).toBe('32.40')
    expect(resultAmount('net_salary')).toBeTypeOf('string')
    expect(resultAmount('total_employer_cost')).toBeTypeOf('string')
    expect(calculation.controls.every((control) => control.status === 'PASS')).toBe(true)
  })

  it.each([
    { family: 'WORK' as const, target: 'PREMIUM' as const },
    { family: 'OVERTIME' as const, target: 'PAYMENT' as const },
  ])('blocks $target mapping for $family until a dedicated Payroll component exists', async ({ family, target }) => {
    const setup = completePayrollSetup()
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadActualWork: vi.fn(async () => withPayrollReleases(actualWork({
        entries: [actualWorkEntry({ hours: 4 })],
        types: [actualWorkType({ family })],
      }), { target })),
      loadPayrollSetup: vi.fn(async () => setup),
    })).getPayrollSourceSnapshot(request)

    expect(snapshot.sourceGaps).toContainEqual({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP',
    })
  })

  it('uses the PFZW participation-date salary basis while calculating November CAO_SCALE pay', async () => {
    const setup = completePayrollSetup()
    const laborConditionSetId = '8c000000-0000-4000-8000-000000000028'
    const mappingId = '8e000000-0000-4000-8000-000000000028'
    const arrangementId = '8f000000-0000-4000-8000-000000000028'
    const arrangementVersionId = '90000000-0000-4000-8000-000000000028'
    const assignmentId = '91000000-0000-4000-8000-000000000028'
    const mapping = {
      id: mappingId,
      labor_condition_set_id: laborConditionSetId,
      pension_arrangement_id: arrangementId,
      participant_group: 'NEW_ENTRANT',
      effective_from: '2026-09-01',
      effective_to: '2026-12-31',
      provenance_json: { status: 'USER_RECORDED', sourceClassification: 'CORE_PENSION_ASSIGNMENT_WORKFLOW' },
      version_number: 1,
      supersedes_mapping_id: null,
      arrangement: null,
      arrangement_resolution_reason: null,
      arrangement_resolution_change_version_ids: [],
    }
    const assignment = {
      id: assignmentId,
      pension_arrangement_id: arrangementId,
      effective_from: '2026-09-01',
      effective_to: '2026-12-31',
      participation_start_date: '2026-09-01',
      assignment_reason: 'CORE_PENSION_ASSIGNMENT_WORKFLOW',
      provenance_json: {
        status: 'USER_RECORDED',
        sourceClassification: 'CORE_PENSION_ASSIGNMENT_WORKFLOW',
        laborConditionMappingId: mappingId,
        laborConditionMappingVersion: 1,
      },
      updated_at: '2026-01-01T00:00:00.000Z',
      version_number: 1,
      supersedes_assignment_id: null,
      arrangement_resolution_reason: null,
      arrangement_resolution_change_version_ids: [],
      age_for_tier: null,
      arrangement: {
        id: arrangementId,
        code: 'PFZW_2026_KINDEROPVANG',
        name: 'PFZW Kinderopvang 2026',
        arrangement_type: 'FLAT_PREMIUM',
        effective_from: '2026-11-01',
        arrangement_established_from: '2026-01-01',
        effective_to: '2026-12-31',
        transition_date: null,
        grandfathering_mode: 'NONE',
        flat_total_rate: null,
        employer_share_pct: 0,
        employee_share_pct: 0,
        annual_franchise: 17283,
        annual_pensionable_salary_cap: 137800,
        pensionable_salary_definition: {
          method: 'PFZW_2026_KINDEROPVANG',
          annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
          basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE',
          floorAtZero: true,
          components: [
            { code: 'PFZW_OP_NP_2026', componentType: 'BASE', totalRate: 25.9, employeeRate: 12.9, employerRate: 13.0 },
            { code: 'PFZW_WIA_EXCEDENT_2026', componentType: 'ADDITIONAL', totalRate: 3.4, employeeRate: 0, employerRate: 3.4 },
          ],
          pfzw2026: {
            monthlyPaymentsPerYear: 12,
            holidayAllowancePercent: '8',
            structuralYearEndAllowancePercent: '5.5',
            structuralYearEndAllowanceReferenceDate: '2025-12-31',
            structuralYearEndAllowanceEligibleAnnualBase: '33828',
            structuralYearEndAllowanceSourceReference: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering',
            structuralYearEndAllowanceSourceVersion: 'Cao Kinderopvang 2025-2026 art. 5.7; PFZW 2026 art. 5.2.4',
            monthlyAllocationPolicyStatus: 'VERIFIED_EMPLOYER_POLICY',
            monthlyAllocationPolicyVersion: 'MARS-PFZW-2026-MONTHLY-ALLOCATION-1',
            monthlyAllocationPolicySourceReference: 'Mars BV payroll policy 2026; PFZW UPA 2026',
          },
        },
        eligibility_rule: { participantGroup: 'NEW_ENTRANT', employmentOrParticipationStartOnOrAfter: '2026-01-01' },
        contract_classification: 'SOLIDARITY' as const,
        contract_classification_provenance: { status: 'USER_RECORDED', sourceReference: 'PFZW 2026 pension arrangement' },
        provenance_json: { sourceReference: 'PFZW 2026 pension arrangement' },
        is_active: true,
        version_id: arrangementVersionId,
        version_number: 2,
        version_created_at: '2026-10-21T00:00:00.000Z',
        source_updated_at: '2026-01-01T00:00:00.000Z',
        tiers: [],
      },
    }
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({
          id: '61000000-0000-4000-8000-000000000028',
          salary_basis: 'CUSTOM_SCALE',
          salary_route: 'SCALE_WITH_STEPS',
          fulltime_amount: 3425,
          parttime_amount: 3044.44,
          salary_step_code: '20',
          valid_from: '2026-09-01',
          valid_until: '2026-11-01',
        }), salary({
          salary_basis: 'CAO_SCALE',
          fulltime_amount: 2819,
          parttime_amount: 1879.33,
          cao_scale_name: 'Schaal 6',
          cao_step_name: 'Salarisnummer 12',
          salary_step_code: '12',
          valid_from: '2026-11-01',
        })],
        schedules: [schedule({
          average_hours_per_week: 24,
          fulltime_hours_per_week: 36,
          part_time_factor: 2 / 3,
          valid_from: '2026-11-01',
        })],
        contracts: [{
          id: '92000000-0000-4000-8000-000000000028',
          labor_condition_set_id: laborConditionSetId,
          fulltime_hours_per_week: 36,
          starts_on: '2026-09-01',
          ends_on: null,
          updated_at: '2026-09-01T10:01:00.000Z',
        }],
        laborConditions: [{
          id: '93000000-0000-4000-8000-000000000028',
          condition_group: 'CAO',
          labor_condition_set_id: laborConditionSetId,
          valid_from: '2026-09-01',
          valid_until: null,
          updated_at: '2026-01-01T10:02:00.000Z',
          set: {
            id: laborConditionSetId,
            code: 'CAO_KINDEROPVANG_2025_2026',
            name: 'Cao Kinderopvang 2025-2026',
            standard_hours_per_week: 36,
            is_active: true,
            valid_from: '2025-01-01',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        }],
        incomeRelationships: [incomeRelationship({ reportingStatus: 'READY' })],
        taxProfileProjection: taxProjection(),
        pensionAssignments: [assignment],
        laborConditionPensionArrangements: [mapping],
      })),
      loadActualWork: vi.fn(async () => actualWork({
        period: {
          id: actualWorkPeriodId,
          period_start: '2026-11-01',
          period_end: '2026-12-01',
          status: 'OPEN',
          updated_at: '2026-11-01T10:00:00.000Z',
        },
        entries: [],
        types: [],
      })),
      loadPayrollSetup: vi.fn(async () => setup),
    })).getPayrollSourceSnapshot({ ...request, payrollPeriod: { year: 2026, month: 11 } })

    const source = snapshot.canonicalSource as Record<string, unknown>
    const payrollOwned = source.payrollOwned as Record<string, unknown>
    const pension = payrollOwned.pension as Record<string, unknown>
    const amounts = payrollOwned.amounts as Record<string, unknown>
    expect(snapshot.sourceGaps).toEqual([])
    expect(pension).toMatchObject({ planCode: 'PFZW_2026_KINDEROPVANG', calculationStatus: 'CALCULATED' })
    expect(pension).toMatchObject({ totalPremiumRate: '25.9', employeeRate: '12.9', employerRate: '13' })
    expect(amounts.employeePension).toBeTypeOf('string')
    expect(amounts.employerPension).toBeTypeOf('string')
    expect(pension.calculationTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentCode: 'PFZW_REGELINGLOON_CONSTRUCTION',
        inputs: expect.objectContaining({ fullTimeMonthlySalary: '3425.00' }),
      }),
    ]))
    expect(snapshot.sourceVersionVector).toHaveProperty('employment_salary_basis:61000000-0000-4000-8000-000000000028')
    expect((source.compensation as { entries: readonly Record<string, unknown>[] }).entries).toEqual([
      expect.objectContaining({
        salaryBasis: 'CAO_SCALE',
        fulltimeAmount: 2819,
        parttimeAmount: 1879.33,
        validFrom: '2026-11-01',
      }),
    ])
    expect(source.actualWork).toMatchObject({ entries: [] })
  })

  it('projects a supported Retail Mode source and does not substitute Mars pension data when Retail pension evidence is absent', async () => {
    const setup = completePayrollSetup()
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({
          salary_basis: 'CAO_SCALE',
          fulltime_amount: 4767.2,
          parttime_amount: 4767.2,
          hourly_rate: 28.9,
          cao_scale_name: 'I',
          cao_step_name: '15',
          salary_step_code: '15',
        })],
        schedules: [schedule({ average_hours_per_week: 38, fulltime_hours_per_week: 38 })],
        contracts: [{
          id: '8b000000-0000-4000-8000-000000000018',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000018',
          fulltime_hours_per_week: 38,
          starts_on: '2026-07-01',
          ends_on: null,
          updated_at: '2026-07-01T10:01:00.000Z',
        }],
        laborConditions: [{
          id: '8d000000-0000-4000-8000-000000000018',
          condition_group: 'CAO',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000018',
          valid_from: '2026-07-01',
          valid_until: null,
          updated_at: '2026-07-01T10:02:00.000Z',
          set: {
            id: '8c000000-0000-4000-8000-000000000018',
            code: 'RETAIL_NON_FOOD_MODE_2026_2027',
            name: 'Retail Non-Food / Mode 2026-2027',
            standard_hours_per_week: 38,
            is_active: true,
            valid_from: '2026-01-01',
            updated_at: '2026-07-01T00:00:00.000Z',
          },
        }],
        incomeRelationships: [incomeRelationship({ reportingStatus: 'READY' })],
        taxProfileProjection: taxProjection(),
        pensionAssignments: [],
      })),
      loadPayrollSetup: vi.fn(async () => setup),
    })).getPayrollSourceSnapshot({ ...request, payrollPeriod: { year: 2026, month: 9 } })

    const source = snapshot.canonicalSource as Record<string, unknown>
    const cao = source.caoCalculation as Record<string, unknown>
    expect(cao).toMatchObject({ status: 'CALCULATED', family: 'RETAIL_MODE', grossAmount: '4767.20' })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'pension', status: 'SOURCE_GAP', reasonCode: 'NO_EFFECTIVE_PENSION_ASSIGNMENT',
    })
    expect(source.payrollOwned).toBeUndefined()
  })

  it('uses the regular employer configuration and explicit calendar-day pension method for a new joiner', async () => {
    const configuration = assertActivePayrollEmployerConfiguration({
      schemaVersion: 'payroll-employer-configuration-v1',
      effectiveFrom: '2026-01-01', effectiveTo: null, status: 'ACTIVE', sourceReference: 'Mars BV payroll decision 2026',
      employer: {
        sectorCode: '001', whkDecisionReference: 'WHK-2026', awfClassification: 'LOW',
        aofClassification: 'AOF-01', wkoClassification: 'WKO-01', zvwClassification: 'EMPLOYER_LEVY',
      },
      employerRates: { awf: '1.00', aof: '2.00', wko: '0.50', whk: '1.50', zvw: '6.10' },
      reserves: { holidayAllowanceRate: '8.00', yearEndApplies: false, yearEndRate: null },
      pension: { partialMonthMethod: 'CALENDAR_DAYS_PRO_RATA', methodSourceReference: 'MARS-PENSION-2026 v1' },
    })
    const configurationRow = {
      id: '91000000-0000-4000-8000-000000000009',
      payroll_administration_id: administrationId,
      source_tenant_id: tenantId,
      source_hr_group_id: hrGroupId,
      source_administration_id: administrationId,
      configuration_version: 1,
      effective_from: '2026-01-01',
      effective_to: null,
      configuration_json: configuration,
      configuration_hash: hashPayrollEmployerConfiguration(configuration),
      status: 'ACTIVE' as const,
      source_reference: configuration.sourceReference,
      created_at: '2026-01-01T00:00:00.000Z',
      created_by_user_id: employeeId,
    }
    const setup: PayrollSourceSetup = {
      configurationRows: [configurationRow],
      configurationRow,
      configuration,
      openingBalance: null,
    }
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      listEmployments: vi.fn(async () => [employment({ starts_on: '2026-10-16', original_hire_date: '2026-10-16', seniority_date: '2026-10-16' })]),
      loadTimeline: vi.fn(async () => ({
        employment: employment({ starts_on: '2026-10-16', original_hire_date: '2026-10-16', seniority_date: '2026-10-16' }),
        salaries: [salary({ fulltime_amount: 3517, parttime_amount: 3517 })],
        schedules: [schedule({ part_time_factor: 1 })],
        incomeRelationships: [incomeRelationship({ reportingStatus: 'READY', startsOn: '2026-01-01' })],
        taxProfileProjection: taxProjection({ taxProfiles: [taxProfile({ effective_from: '2026-01-01' })] }),
        pensionAssignments: [{
          id: '92000000-0000-4000-8000-000000000009', pension_arrangement_id: 'MARS-PENSION-2026',
          effective_from: '2026-01-01', effective_to: null, participation_start_date: '2026-10-16',
          assignment_reason: 'CORE', provenance_json: {}, updated_at: '2026-01-01T00:00:00.000Z', version_number: 1,
          supersedes_assignment_id: null, arrangement_resolution_reason: null, arrangement_resolution_change_version_ids: [], age_for_tier: null,
          arrangement: {
            id: 'MARS-PENSION-2026', code: 'MARS-PENSION-2026', name: 'Mars pension 2026', arrangement_type: 'FLAT_PREMIUM',
            effective_from: '2026-01-01', arrangement_established_from: '2026-01-01', effective_to: null, transition_date: null,
            grandfathering_mode: 'NONE', flat_total_rate: 25, employer_share_pct: 60, employee_share_pct: 40,
            annual_franchise: 19172, annual_pensionable_salary_cap: 137800,
            pensionable_salary_definition: { annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY', basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE', floorAtZero: true },
            eligibility_rule: { participantGroup: 'NEW_ENTRANT' },
            contract_classification: 'SOLIDARITY' as const, contract_classification_provenance: {}, provenance_json: {}, is_active: true,
            version_id: '93000000-0000-4000-8000-000000000009', version_number: 1, version_created_at: '2026-01-01T00:00:00.000Z',
            source_updated_at: '2026-01-01T00:00:00.000Z', tiers: [],
          },
        }],
      })),
      loadPayrollSetup: vi.fn(async () => setup),
    })).getPayrollSourceSnapshot({ ...request, payrollPeriod: { year: 2026, month: 10 } })

    const source = snapshot.canonicalSource as Record<string, unknown>
    const payrollOwned = source.payrollOwned as Record<string, unknown>
    expect(payrollOwned).toBeDefined()
    const pension = payrollOwned.pension as Record<string, unknown>
    expect(pension.partialMonthMethod).toBe('CALENDAR_DAYS_PRO_RATA')
    expect(pension.periodFactor).toBe('0.5161')
    expect(pension.partTimeFactor).toBe('0.5161')
    expect(pension.calculationTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleProvenance: expect.objectContaining({
          eligibilityRule: expect.objectContaining({
            participantGroup: 'NEW_ENTRANT',
            employmentOrParticipationStartOnOrAfter: '2026-01-01',
          }),
          eligibilityRuleMapping: {
            mode: 'CORE_ARRANGEMENT_EFFECTIVE_FROM',
            sourceField: 'arrangement.effective_from',
            derivedBoundary: '2026-01-01',
          },
        }),
      }),
    ]))
    expect(snapshot.sourceGaps).not.toContainEqual({ field: 'openingCumulative', status: 'SOURCE_GAP', reasonCode: 'PAYROLL_OPENING_CUMULATIVE_MISSING' })
  })

  it('maps scoped synthetic employment, salary, and hours without person-level identifiers', async () => {
    const provider = new LiquidHrPayrollSourceProvider(dependencies())

    const snapshot = await provider.getPayrollSourceSnapshot(request)

    expect(snapshot.sourceTenantId).toBe(tenantId)
    expect(snapshot.sourceHrGroupId).toBe(hrGroupId)
    expect(snapshot.sourceAdministrationId).toBe(administrationId)
    expect(snapshot.sourceEmployeeId).toBe(employeeId)
    expect(snapshot.sourceEmploymentId).toBe(employmentId)
    expect(snapshot.sourceIncomeRelationshipId).toBeNull()
    expect(snapshot.canonicalSource).toMatchObject({
      employment: { startsOn: '2026-09-01', endsOn: null, recordStatus: 'CONFIRMED' },
      compensation: { entries: [{ salaryBasis: 'MANUAL', fulltimeAmount: 3200, currencyCode: 'EUR' }] },
      schedule: { entries: [{ averageHoursPerWeek: 40, fulltimeHoursPerWeek: 40 }] },
      incomeRelationship: { status: 'SOURCE_GAP', reasonCode: 'NO_LINKED_INCOME_RELATIONSHIP' },
      fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'CORE_FISCAL_PROFILE_SOURCE_UNAVAILABLE' },
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'incomeRelationship', status: 'SOURCE_GAP', reasonCode: 'NO_LINKED_INCOME_RELATIONSHIP',
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'CORE_FISCAL_PROFILE_SOURCE_UNAVAILABLE',
    })
    const payload = JSON.stringify(snapshot.canonicalSource)
    expect(payload).not.toMatch(/firstName|birthName|bsn|iban|email|phone/i)
    expect(snapshot.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(snapshot.sourceVersionVector).toEqual({
      [`employment:${employmentId}`]: employment().updated_at,
      [`employment_salary:${salaryId}`]: salary().updated_at,
      [`employment_schedule:${scheduleId}`]: schedule().updated_at,
      [`actual_work_period:${actualWorkPeriodId}`]: actualWork().period?.updated_at,
    })
  })

  it('uses an effective HR Admin confirmed Core tax profile to build the regular wage engine input', async () => {
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({ parttime_amount: 4000, fulltime_amount: 4000 })],
        schedules: [schedule()],
        contracts: [{
          id: '8b000000-0000-4000-8000-000000000008',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          fulltime_hours_per_week: 40,
          starts_on: '2026-09-01',
          ends_on: null,
          updated_at: '2026-09-01T10:01:00.000Z',
        }],
        laborConditions: [{
          id: '8d000000-0000-4000-8000-000000000008',
          condition_group: 'COMPANY',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          valid_from: '2026-09-01',
          valid_until: null,
          updated_at: '2026-09-01T10:02:00.000Z',
          set: {
            id: '8c000000-0000-4000-8000-000000000008',
            code: 'COMPANY',
            name: 'Company labor conditions',
            standard_hours_per_week: 40,
            is_active: true,
            valid_from: '2026-01-01',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        }],
        incomeRelationships: [incomeRelationship({ reportingStatus: 'READY' })],
        taxProfileProjection: taxProjection(),
      })),
    })).getPayrollSourceSnapshot({ ...request, employmentId })

    expect(snapshot.sourceGaps).toEqual([])
    expect(snapshot.canonicalSource).toMatchObject({
      fiscalProfile: {
        status: 'CONFIRMED',
        id: taxProfileId,
        versionNumber: 1,
        residenceCountryCode: 'NL',
        wageTaxTable: 'WHITE',
        herleiding: 'STD',
        timePeriod: 'MONTH',
        payrollTaxCreditApplies: true,
        sourceClassification: 'HR_ADMIN_CONFIRMED',
      },
      regularWage: {
        fiscalYear: '2026',
        table: 'WHITE',
        residence: 'NL',
        ageCategory: 'UNDER_AOW',
        herleiding: 'STD',
        timePeriod: 'MONTH',
        payrollTaxCredit: true,
        regularWage: true,
        fullPeriod: true,
        hasSpecialSituation: false,
        incomeRelationshipCount: '1',
        grossAmount: '4000.00',
      },
      incomeRelationship: { employmentIncomeRelationshipId: incomeLinkId },
    })
    expect(snapshot.sourceVersionVector[`employment_payroll_tax_profile:${taxProfileId}`]).toBe('1:2026-08-28T09:00:00.000Z')
    const sourceContract = (snapshot.canonicalSource as {
      readonly sourceContract: { readonly references: readonly {
        readonly field: string; readonly sourceType: string; readonly sourceRowId: string
        readonly version: string; readonly status: string; readonly validFrom: string
        readonly validUntilExclusive: string | null
      }[] }
    }).sourceContract
    expect(sourceContract.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'incomeRelationshipLink', sourceType: 'employment_income_relationships',
        sourceRowId: incomeLinkId, version: '2026-09-01T10:15:00.000Z', status: 'BOUND',
        validFrom: '2026-09-01', validUntilExclusive: null,
      }),
      expect.objectContaining({
        field: 'incomeRelationship', sourceType: 'income_relationships',
        sourceRowId: incomeRelationshipId, version: '2026-09-01T10:20:00.000Z', status: 'BOUND',
        validFrom: '2026-09-01', validUntilExclusive: null,
      }),
      expect.objectContaining({
        field: 'taxProfile', sourceType: 'employment_payroll_tax_profiles',
        sourceRowId: taxProfileId, version: '1:2026-08-28T09:00:00.000Z', status: 'BOUND',
        validFrom: '2026-09-01', validUntilExclusive: null,
      }),
    ]))
    expect(JSON.stringify(snapshot.canonicalSource)).not.toContain('declaration-ref')
  })

  it('keeps missing fiscal and IKV versions as SOURCE_GAP references', async () => {
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary()],
        schedules: [schedule()],
        incomeRelationships: [incomeRelationship({ linkUpdatedAt: '' })],
        taxProfileProjection: taxProjection({ taxProfiles: [taxProfile({ created_at: '' })] }),
      })),
    })).getPayrollSourceSnapshot({ ...request, employmentId })

    expect(snapshot.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'incomeRelationshipLink', status: 'SOURCE_GAP', reasonCode: 'SOURCE_VERSION_REFERENCE_MISSING',
    }))
    expect(snapshot.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'SOURCE_VERSION_REFERENCE_MISSING',
    }))
    const references = (snapshot.canonicalSource as {
      readonly sourceContract: { readonly references: readonly { readonly field: string; readonly status: string }[] }
    }).sourceContract.references
    expect(references).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'incomeRelationshipLink', status: 'SOURCE_GAP' }),
      expect.objectContaining({ field: 'taxProfile', status: 'SOURCE_GAP' }),
    ]))
  })

  it('keeps inconsistent duplicate IKV version reads as SOURCE_GAP', async () => {
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary()],
        schedules: [schedule()],
        incomeRelationships: [incomeRelationship({ reportingStatus: 'READY' })],
        taxProfileProjection: taxProjection({ incomeRelationships: [{
          id: incomeRelationshipId,
          updatedAt: '2026-09-02T10:20:00.000Z',
          reportingStatus: 'READY',
          ikvNumber: 1,
          startsOn: '2026-01-01',
          endsOn: null,
        }] }),
      })),
    })).getPayrollSourceSnapshot({ ...request, employmentId })

    expect(snapshot.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'incomeRelationship', status: 'SOURCE_GAP', reasonCode: 'SOURCE_VERSION_REFERENCE_INCONSISTENT',
    }))
  })

  it('projects a mid-month employment into a 11/22 gross and week/day tax period', async () => {
    const partialEmployment = employment({ starts_on: '2026-10-16', original_hire_date: '2026-10-16', seniority_date: '2026-10-16' })
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      listEmployments: vi.fn(async () => [partialEmployment]),
      loadActualWork: vi.fn(async () => actualWork({ period: {
        id: actualWorkPeriodId,
        period_start: '2026-10-01',
        period_end: '2026-11-01',
        status: 'CLOSED',
        updated_at: '2026-11-01T10:00:00.000Z',
      } })),
      loadTimeline: vi.fn(async () => ({
        employment: partialEmployment,
        salaries: [salary({ fulltime_amount: 3517, parttime_amount: 3517, valid_from: '2026-10-01' })],
        schedules: [schedule({ valid_from: '2026-10-01' })],
        contracts: [{
          id: '8b000000-0000-4000-8000-000000000008',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          fulltime_hours_per_week: 40,
          starts_on: '2026-10-01',
          ends_on: null,
          updated_at: '2026-10-01T10:01:00.000Z',
        }],
        laborConditions: [{
          id: '8d000000-0000-4000-8000-000000000008',
          condition_group: 'COMPANY',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          valid_from: '2026-01-01',
          valid_until: null,
          updated_at: '2026-01-01T10:02:00.000Z',
          set: {
            id: '8c000000-0000-4000-8000-000000000008',
            code: 'COMPANY',
            name: 'Company labor conditions',
            standard_hours_per_week: 40,
            is_active: true,
            valid_from: '2026-01-01',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        }],
        incomeRelationships: [incomeRelationship({ validFrom: '2026-10-01', startsOn: '2026-10-01', reportingStatus: 'READY' })],
        taxProfileProjection: taxProjection({ taxProfiles: [taxProfile({
          effective_from: '2026-10-01',
          payroll_tax_credit_applies: false,
        })] }),
      })),
    })).getPayrollSourceSnapshot({
      ...request,
      employmentId,
      payrollPeriod: { year: 2026, month: 10 },
    })

    expect(snapshot.sourceGaps).not.toContainEqual(expect.objectContaining({ reasonCode: 'PARTIAL_EMPLOYMENT_PERIOD_UNSUPPORTED' }))
    expect(snapshot.sourceGaps).toEqual([])
    expect(snapshot.canonicalSource).toMatchObject({
      regularWage: {
        grossAmount: '1758.50',
        timePeriod: 'WEEK_DAY_2_1',
        fullPeriod: false,
        payrollTaxCredit: false,
        fulltimeMonthlyAmount: '3517.00',
        contractHoursPerWeek: '40.0000',
        fulltimeHoursPerWeek: '40.0000',
      },
      fiscalProfile: { status: 'CONFIRMED', timePeriod: 'MONTH' },
    })
  })

  it('continues to accept an actual employee declaration as a fiscal source', async () => {
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({ parttime_amount: 4000, fulltime_amount: 4000 })],
        schedules: [schedule()],
        contracts: [{
          id: '8b000000-0000-4000-8000-000000000008',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          fulltime_hours_per_week: 40,
          starts_on: '2026-09-01',
          ends_on: null,
          updated_at: '2026-09-01T10:01:00.000Z',
        }],
        laborConditions: [{
          id: '8d000000-0000-4000-8000-000000000008',
          condition_group: 'COMPANY',
          labor_condition_set_id: '8c000000-0000-4000-8000-000000000008',
          valid_from: '2026-09-01',
          valid_until: null,
          updated_at: '2026-09-01T10:02:00.000Z',
          set: {
            id: '8c000000-0000-4000-8000-000000000008',
            code: 'COMPANY',
            name: 'Company labor conditions',
            standard_hours_per_week: 40,
            is_active: true,
            valid_from: '2026-01-01',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        }],
        incomeRelationships: [incomeRelationship({ reportingStatus: 'READY' })],
        taxProfileProjection: taxProjection({ taxProfiles: [taxProfile({ source_classification: 'EMPLOYEE_DECLARATION' })] }),
      })),
    })).getPayrollSourceSnapshot({ ...request, employmentId })

    expect(snapshot.sourceGaps).toEqual([])
    expect(snapshot.canonicalSource).toMatchObject({
      fiscalProfile: { status: 'CONFIRMED', sourceClassification: 'EMPLOYEE_DECLARATION' },
    })
  })

  it('blocks an expired profile, conflicting credit claim, and unsupported age class', async () => {
    const load = (projection: PayrollSourceTaxProfileProjection) => vi.fn(async (): Promise<PayrollSourceTimeline> => ({
      employment: employment(),
      salaries: [salary()],
      schedules: [schedule()],
      incomeRelationships: [incomeRelationship({ reportingStatus: 'READY' })],
      taxProfileProjection: projection,
    }))
    const expired = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: load(taxProjection({ taxProfiles: [taxProfile({ effective_from: '2026-08-01', effective_to: '2026-08-31' })] })),
    })).getPayrollSourceSnapshot({ ...request, employmentId })
    const conflicting = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: load(taxProjection({ taxProfiles: [
        taxProfile(),
        taxProfile({ id: '88000000-0000-4000-8000-000000000008', employment_id: '89000000-0000-4000-8000-000000000008', income_relationship_id: '8a000000-0000-4000-8000-000000000008' }),
      ] })),
    })).getPayrollSourceSnapshot({ ...request, employmentId })
    const ageUnsupported = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: load(taxProjection({ ageCategory: 'AT_OR_ABOVE_AOW' })),
    })).getPayrollSourceSnapshot({ ...request, employmentId })

    expect(expired.sourceGaps).toContainEqual(expect.objectContaining({ reasonCode: 'FISCAL_PROFILE_NOT_EFFECTIVE_FOR_FULL_PERIOD' }))
    expect(conflicting.sourceGaps).toContainEqual(expect.objectContaining({ reasonCode: 'PAYROLL_TAX_CREDIT_ALREADY_APPLIES_TO_OTHER_IKV' }))
    expect(ageUnsupported.sourceGaps).toContainEqual(expect.objectContaining({ reasonCode: 'NL_2026_RULES_REQUIRE_UNDER_AOW_AGE' }))
  })

  it('includes the canonical labor-condition set and effective function in hashed source identity', async () => {
    const timeline = (setId: string, jobCode: string): PayrollSourceTimeline => ({
      employment: employment(),
      salaries: [salary()],
      schedules: [schedule()],
      contracts: [{
        id: '86000000-0000-4000-8000-000000000008', labor_condition_set_id: setId,
        fulltime_hours_per_week: 36, starts_on: '2026-09-01', ends_on: null,
        updated_at: '2026-09-01T10:01:00.000Z',
      }],
      laborConditions: [{
        id: '87000000-0000-4000-8000-000000000008', condition_group: 'legacy label',
        labor_condition_set_id: setId, valid_from: '2026-09-01', valid_until: null,
        updated_at: '2026-09-01T10:02:00.000Z',
        set: {
          id: setId, code: 'CAO_KINDEROPVANG_2025_2026', name: 'Cao Kinderopvang 2025-2026',
          standard_hours_per_week: 36, is_active: true, valid_from: '2025-01-01',
          updated_at: '2026-09-01T10:03:00.000Z',
        },
      }],
      organizations: [{
        id: '88000000-0000-4000-8000-000000000008', department_id: '89000000-0000-4000-8000-000000000008',
        job_id: '8a000000-0000-4000-8000-000000000008', job_code: jobCode,
        job_title: 'Pedagogisch professional', job_revision_valid_from: '2026-09-01',
        job_revision_valid_until: null, job_revision_updated_at: '2026-09-01T10:04:00.000Z',
        effective_from: '2026-09-01', effective_to: null, updated_at: '2026-09-01T10:05:00.000Z',
      }],
    })
    const setId = '8b000000-0000-4000-8000-000000000008'
    const first = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => timeline(setId, 'PAYRUN01-KO-PP-TEST')),
    })).getPayrollSourceSnapshot(request)
    const changedSet = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => timeline('8c000000-0000-4000-8000-000000000008', 'PAYRUN01-KO-PP-TEST')),
    })).getPayrollSourceSnapshot(request)
    const changedJob = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => timeline(setId, 'OTHER-JOB')),
    })).getPayrollSourceSnapshot(request)
    expect(first.canonicalSource).toMatchObject({
      contract: { entries: [{ laborConditionSetId: setId, fulltimeHoursPerWeek: 36 }] },
      laborConditions: { entries: [{ laborConditionSetId: setId, set: { code: 'CAO_KINDEROPVANG_2025_2026' } }] },
      organization: { entries: [{ jobCode: 'PAYRUN01-KO-PP-TEST', jobTitle: 'Pedagogisch professional' }] },
    })
    expect(first.sourceHash).not.toBe(changedSet.sourceHash)
    expect(first.sourceHash).not.toBe(changedJob.sourceHash)
    expect(first.sourceVersionVector).toMatchObject({
      [`employment_contract:86000000-0000-4000-8000-000000000008`]: '2026-09-01T10:01:00.000Z',
      [`labor_condition_set:${setId}`]: '2026-09-01T10:03:00.000Z',
      [`employee_organization:88000000-0000-4000-8000-000000000008`]: '2026-09-01T10:05:00.000Z',
    })
  })

  it('includes scoped Core pension assignment, arrangement, tier, and versions in source identity', async () => {
    type Assignment = NonNullable<PayrollSourceTimeline['pensionAssignments']>[number]
    type Mapping = NonNullable<PayrollSourceTimeline['laborConditionPensionArrangements']>[number]
    const mappingId = '8c000000-0000-4000-8000-000000000008'
    const laborSetId = '8b000000-0000-4000-8000-000000000008'
    const mapping: Mapping = {
      id: mappingId,
      labor_condition_set_id: laborSetId,
      pension_arrangement_id: '8e000000-0000-4000-8000-000000000008',
      participant_group: 'NEW_ENTRANT',
      effective_from: '2026-01-01',
      effective_to: null,
      provenance_json: { status: 'USER_RECORDED', sourceClassification: 'CORE_PENSION_ASSIGNMENT_WORKFLOW' },
      version_number: 2,
      supersedes_mapping_id: '8c000000-0000-4000-8000-000000000007',
      arrangement: null,
      arrangement_resolution_reason: null,
      arrangement_resolution_change_version_ids: [],
    }
    const assignmentFor = (rate: number, establishedFrom = '2026-01-01'): Assignment => ({
      id: '8d000000-0000-4000-8000-000000000008',
      pension_arrangement_id: '8e000000-0000-4000-8000-000000000008',
      effective_from: '2026-01-01',
      effective_to: null,
      participation_start_date: '2026-01-01',
      assignment_reason: 'TEST_SOURCE',
      provenance_json: {
        source: 'synthetic test arrangement',
        laborConditionMappingId: mappingId,
        laborConditionMappingVersion: 2,
      },
      updated_at: '2026-01-01T00:00:00.000Z',
      version_number: 1,
      supersedes_assignment_id: null,
      age_for_tier: null,
      arrangement_resolution_reason: null,
      arrangement_resolution_change_version_ids: [],
      arrangement: {
        id: '8e000000-0000-4000-8000-000000000008',
        code: 'COMPANY_WTP_FLAT_2026',
        name: 'Flat 2026',
        arrangement_type: 'FLAT_PREMIUM',
        effective_from: '2026-01-01',
        arrangement_established_from: establishedFrom,
        effective_to: null,
        transition_date: null,
        grandfathering_mode: 'NONE',
        flat_total_rate: rate,
        employer_share_pct: 66.6667,
        employee_share_pct: 33.3333,
        annual_franchise: 19172,
        annual_pensionable_salary_cap: 137800,
        pensionable_salary_definition: {
          annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
          basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE', floorAtZero: true,
        },
        eligibility_rule: { participantGroup: 'NEW_ENTRANT', employmentOrParticipationStartOnOrAfter: '2026-01-01' },
        contract_classification: 'UNKNOWN',
        contract_classification_provenance: { status: 'UNVERIFIED' },
        provenance_json: { authority: 'synthetic' },
        is_active: true,
        version_id: rate === 15
          ? '8f000000-0000-4000-8000-000000000008'
          : '8f000000-0000-4000-8000-000000000009',
        version_number: 1,
        version_created_at: '2026-01-01T00:00:00.000Z',
        source_updated_at: null,
        tiers: [],
      },
    })
    const snapshotFor = (rate: number, establishedFrom?: string) => new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(), salaries: [salary()], schedules: [schedule()],
        pensionAssignments: [assignmentFor(rate, establishedFrom)],
        contracts: [{
          id: '8a000000-0000-4000-8000-000000000008',
          labor_condition_set_id: laborSetId,
          fulltime_hours_per_week: 40,
          starts_on: '2026-01-01',
          ends_on: null,
          updated_at: '2026-01-01T00:00:00.000Z',
        }],
        laborConditions: [{
          id: '8a000000-0000-4000-8000-000000000009',
          condition_group: 'Company',
          labor_condition_set_id: laborSetId,
          valid_from: '2026-01-01',
          valid_until: null,
          updated_at: '2026-01-01T00:00:00.000Z',
          set: null,
        }],
        laborConditionPensionArrangements: [mapping],
      })),
    })).getPayrollSourceSnapshot(request)
    const first = await snapshotFor(15)
    const changed = await snapshotFor(16)
    const changedBaselineDate = await snapshotFor(15, '2025-12-31')

    expect(first.canonicalSource).toMatchObject({
      pension: { assignments: [{
        id: '8d000000-0000-4000-8000-000000000008',
        assignmentVersion: 1,
        supersedesAssignmentId: null,
        provenance: { laborConditionMappingId: mappingId, laborConditionMappingVersion: 2 },
        arrangement: {
          code: 'COMPANY_WTP_FLAT_2026', flatTotalRate: '15', annualFranchise: '19172',
          arrangementEstablishedFrom: '2026-01-01',
        },
      }], laborConditionArrangements: [{
        id: mappingId,
        laborConditionSetId: laborSetId,
        participantGroup: 'NEW_ENTRANT',
        mappingVersion: 2,
        supersedesMappingId: '8c000000-0000-4000-8000-000000000007',
        provenance: { status: 'USER_RECORDED', sourceClassification: 'CORE_PENSION_ASSIGNMENT_WORKFLOW' },
      }] },
    })
    expect(first.sourceVersionVector).toMatchObject({
      'employment_pension_assignment:8d000000-0000-4000-8000-000000000008': '1:2026-01-01T00:00:00.000Z',
      [`labor_condition_pension_arrangement:${mappingId}`]: '2:2026-01-01',
      'pension_arrangement_version:8f000000-0000-4000-8000-000000000008': '2026-01-01T00:00:00.000Z',
    })
    expect(first.sourceHash).not.toBe(changed.sourceHash)
    expect(first.sourceHash).not.toBe(changedBaselineDate.sourceHash)
  })

  it('preserves an explicitly linked DRAFT IKV as an opaque source ID without treating it as a finalized Core contract', async () => {
    const provider = new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary()],
        schedules: [schedule()],
        incomeRelationships: [incomeRelationship()],
      })),
    }))

    const snapshot = await provider.getPayrollSourceSnapshot(request)

    expect(snapshot.sourceIncomeRelationshipId).toBe(incomeRelationshipId)
    expect(snapshot.canonicalSource).toMatchObject({
      incomeRelationship: {
        id: incomeRelationshipId,
        reportingStatus: 'DRAFT',
        status: 'UNSUPPORTED',
        reasonCode: 'CONTROL02_CONTRACT_PENDING',
      },
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING',
    })
    expect(snapshot.sourceVersionVector).toMatchObject({
      [`employment_income_relationship:${incomeLinkId}`]: incomeRelationship().linkUpdatedAt,
      [`income_relationship:${incomeRelationshipId}`]: incomeRelationship().incomeRelationshipUpdatedAt,
    })
  })

  it('fails closed on overlapping linked IKVs instead of choosing one', async () => {
    const provider = new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary()],
        schedules: [schedule()],
        incomeRelationships: [
          incomeRelationship(),
          incomeRelationship({ id: '81000000-0000-4000-8000-000000000009', incomeRelationshipId: '82000000-0000-4000-8000-000000000009' }),
        ],
      })),
    }))

    const snapshot = await provider.getPayrollSourceSnapshot(request)

    expect(snapshot.sourceIncomeRelationshipId).toBeNull()
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'INCOME_RELATIONSHIP_AMBIGUOUS',
    })
  })

  it('pins approved WORK and ADDITIONAL entries and omits notes and approver identifiers', async () => {
    const approvedWork = withPayrollReleases(actualWork({
      entries: [
        actualWorkEntry(),
        actualWorkEntry({
          id: '85000000-0000-4000-8000-000000000009',
          work_hour_type_id: '84000000-0000-4000-8000-000000000009',
          work_date: '2026-09-12',
          subject_period_start: '2026-09-12',
          subject_period_end: '2026-09-13',
          hours: 2,
        }),
      ],
      types: [
        actualWorkType(),
        actualWorkType({ id: '84000000-0000-4000-8000-000000000009', family: 'ADDITIONAL' }),
      ],
    }))
    const provider = new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({ payment_type: 'HOURLY_VARIABLE', hourly_rate: 20.5 })],
        schedules: [schedule()],
      })),
      loadActualWork: vi.fn(async () => approvedWork),
    }))

    const snapshot = await provider.getPayrollSourceSnapshot(request)
    const payload = JSON.stringify(snapshot.canonicalSource)

    expect(snapshot.canonicalSource).toMatchObject({
      actualWork: {
        period: { status: 'CLOSED', startsOn: '2026-09-01', endsOn: '2026-10-01' },
        entries: [
          { family: 'WORK', hours: '8.0000', status: 'APPROVED', releasedForPayroll: true },
          { family: 'ADDITIONAL', hours: '2.0000', status: 'APPROVED', releasedForPayroll: true },
        ],
      },
    })
    expect(snapshot.sourceVersionVector).toMatchObject({
      [`actual_work_period:${actualWorkPeriodId}`]: approvedWork.period?.updated_at,
      [`actual_work_entry:${actualWorkEntryId}`]: approvedWork.entries[0]?.updated_at,
      [`work_hour_type:${actualWorkTypeId}`]: approvedWork.types[0]?.updated_at,
    })
    expect(snapshot.sourceGaps).not.toContainEqual(expect.objectContaining({ field: 'actualWork' }))
    expect(payload).not.toMatch(/note|approvedBy|approved_by|firstName|birthName|iban|bsn/i)
  })

  it('blocks pending payable hours and approved overtime until an explicit payroll rule is configured', async () => {
    const pendingProvider = new LiquidHrPayrollSourceProvider(dependencies({
      loadActualWork: vi.fn(async () => actualWork({
        entries: [actualWorkEntry({ status: 'PENDING', approved_at: null })],
        types: [actualWorkType({ family: 'ADDITIONAL' })],
      })),
    }))
    const overtimeProvider = new LiquidHrPayrollSourceProvider(dependencies({
      loadActualWork: vi.fn(async () => actualWork({
        entries: [actualWorkEntry()],
        types: [actualWorkType({ family: 'OVERTIME' })],
      })),
    }))

    const [pendingSnapshot, overtimeSnapshot] = await Promise.all([
      pendingProvider.getPayrollSourceSnapshot(request),
      overtimeProvider.getPayrollSourceSnapshot(request),
    ])

    expect(pendingSnapshot.sourceGaps).toContainEqual({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'PAYABLE_ACTUAL_WORK_NOT_APPROVED',
    })
    expect(overtimeSnapshot.sourceGaps).toContainEqual({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_PAYROLL_RELEASE_REQUIRED',
    })
  })

  it('keeps configured TVT hours out of payroll and reports the missing leave-ledger accrual connection', async () => {
    const provider = new LiquidHrPayrollSourceProvider(dependencies({
      loadActualWork: vi.fn(async () => actualWork({
        entries: [actualWorkEntry({ hours: 3 })],
        types: [actualWorkType({ family: 'OVERTIME' })],
        tvtWorkHourTypeIds: [actualWorkTypeId],
      })),
    }))

    const snapshot = await provider.getPayrollSourceSnapshot(request)
    const canonical = snapshot.canonicalSource as Record<string, unknown>
    const actualWorkRecord = canonical.actualWork as Record<string, unknown>
    const actualEntries = actualWorkRecord.entries as Array<Record<string, unknown>>

    expect(snapshot.sourceGaps).toContainEqual({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_TVT_ACCRUAL_NOT_CONNECTED',
    })
    expect(actualEntries).toHaveLength(1)
    expect(actualEntries[0]?.releasedForPayroll).toBe(false)
  })

  it('recognizes an idempotently accrued TVT ledger balance as accrued but unreleased', async () => {
    const provider = new LiquidHrPayrollSourceProvider(dependencies({
      loadActualWork: vi.fn(async () => actualWork({
        entries: [actualWorkEntry({ hours: 3 })],
        types: [actualWorkType({ family: 'OVERTIME' })],
        tvtWorkHourTypeIds: [actualWorkTypeId],
        tvtAccruedHoursByEntryId: { [actualWorkEntryId]: '3.0000' },
      })),
    }))

    const snapshot = await provider.getPayrollSourceSnapshot(request)
    const canonical = snapshot.canonicalSource as Record<string, unknown>
    const actualWorkRecord = canonical.actualWork as Record<string, unknown>
    const actualEntries = actualWorkRecord.entries as Array<Record<string, unknown>>

    expect(snapshot.sourceGaps).not.toContainEqual(expect.objectContaining({ reasonCode: 'ACTUAL_WORK_TVT_ACCRUAL_NOT_CONNECTED' }))
    expect(actualEntries[0]).toMatchObject({ tvtAccrued: true, tvtAccruedHours: '3.0000', releasedForPayroll: false })
  })

  it('does not treat a FOUR_WEEKLY release as a monthly release when both start on the same date', async () => {
    const released = withPayrollReleases(actualWork({
      entries: [actualWorkEntry({ hours: 3 })],
      types: [actualWorkType({ family: 'WORK' })],
    }))
    const provider = new LiquidHrPayrollSourceProvider(dependencies({
      loadActualWork: vi.fn(async () => ({
        ...released,
        payrollReleases: released.payrollReleases?.map((release) => ({
          ...release,
          payroll_period_id: '99999999-9999-4999-8999-999999999999',
          payroll_period_end: '2026-09-28',
          payroll_periodicity: 'FOUR_WEEKLY',
        })),
      })),
    }))

    const snapshot = await provider.getPayrollSourceSnapshot(request)

    expect(snapshot.sourceGaps).toContainEqual({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_FOUR_WEEKLY_PAYROLL_CONSUMER_UNAVAILABLE',
    })
  })

  it('derives its authorization scope from the authenticated context and rejects forged scope before reads', async () => {
    const deps = dependencies()
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot({ ...request, administrationId: otherAdministrationId }))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN', status: 403 })
    expect(deps.listEmployments).not.toHaveBeenCalled()
    expect(deps.loadTimeline).not.toHaveBeenCalled()
  })

  it('does not read employee source data when existing authorization denies salary access', async () => {
    const deps = dependencies({ authorize: vi.fn(async () => { throw new Error('DENIED') }) })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request)).rejects.toThrow('DENIED')
    expect(deps.listEmployments).not.toHaveBeenCalled()
  })

  it('reports safe source category, database code, and correlation ID without logging source error details', async () => {
    const reportDiagnostic = vi.fn()
    const sourceError = Object.assign(new Error('raw database detail with employee data'), {
      code: 'PGRST003',
    })
    const correlationId = '90000000-0000-4000-8000-000000000009'
    const deps = dependencies({
      loadTimeline: vi.fn(async () => { throw Object.assign(sourceError, { sourceCategory: 'employment-salaries' }) }),
      createCorrelationId: () => correlationId,
      reportDiagnostic,
    })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request)).rejects.toMatchObject({
      code: 'PAYROLL_SOURCE_DATA_UNAVAILABLE',
      sourceCategory: 'employment-salaries',
      correlationId,
    })
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith({
      event: 'PAYROLL_SOURCE_PROVIDER_FAILURE',
      sourceCategory: 'employment-salaries',
      errorCode: 'PGRST003',
      correlationId,
    })
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('raw database detail')
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(request.employeeId)
  })

  it('reports source gap field and reason codes with a correlation ID, without employee identifiers', async () => {
    const reportDiagnostic = vi.fn()
    const correlationId = '90000000-0000-4000-8000-000000000039'
    const snapshot = await new LiquidHrPayrollSourceProvider(dependencies({
      createCorrelationId: () => correlationId,
      reportDiagnostic,
      loadPayrollSetup: vi.fn(async () => ({
        configurationRows: [],
        configurationRow: null,
        configuration: null,
        openingBalance: null,
      })),
    })).getPayrollSourceSnapshot(request)

    expect(snapshot.sourceGaps).toContainEqual({
      field: 'payrollConfiguration',
      status: 'SOURCE_GAP',
      reasonCode: 'PAYROLL_EMPLOYER_CONFIGURATION_MISSING',
    })
    expect(getPayrollSourceSnapshotCorrelationId(snapshot)).toBe(correlationId)
    expect(reportDiagnostic).toHaveBeenCalledWith({
      event: 'PAYROLL_SOURCE_PROVIDER_GAP',
      sourceCategory: 'source-validation',
      errorCode: 'SOURCE_GAPS_PRESENT',
      correlationId,
      sourceGaps: expect.arrayContaining([{
        sourceCategory: 'payrollConfiguration',
        errorCode: 'PAYROLL_EMPLOYER_CONFIGURATION_MISSING',
        field: 'payrollConfiguration',
      }]),
    })
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(request.employeeId)
  })

  it('reports source authorization denials with safe category and correlation ID', async () => {
    const reportDiagnostic = vi.fn()
    const authorizationError = new AuthorizationError('raw authorization detail')
    const correlationId = '90000000-0000-4000-8000-000000000019'
    const deps = dependencies({
      authorize: vi.fn(async () => { throw authorizationError }),
      createCorrelationId: () => correlationId,
      reportDiagnostic,
    })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request)).rejects.toBe(authorizationError)
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith({
      event: 'PAYROLL_SOURCE_PROVIDER_FAILURE',
      sourceCategory: 'authorization',
      errorCode: 'AUTHORIZATION_DENIED',
      correlationId,
    })
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('raw authorization detail')
  })

  it('preserves an authorization denial inside a source projection diagnostic', async () => {
    const reportDiagnostic = vi.fn()
    const correlationId = '90000000-0000-4000-8000-000000000029'
    const deps = dependencies({
      loadTimeline: vi.fn(async () => { throw new AuthorizationError('private employee permission detail') }),
      createCorrelationId: () => correlationId,
      reportDiagnostic,
    })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request)).rejects.toMatchObject({
      code: 'PAYROLL_SOURCE_DATA_UNAVAILABLE',
      sourceCategory: 'authorization',
      correlationId,
    })
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith({
      event: 'PAYROLL_SOURCE_PROVIDER_FAILURE',
      sourceCategory: 'authorization',
      errorCode: 'AUTHORIZATION_DENIED',
      correlationId,
    })
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('private employee permission detail')
  })

  it('fails closed before authorization or source reads when the Payroll Lab kill switch is disabled', async () => {
    const deps = dependencies({ isEnabled: vi.fn(() => false) })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_DISABLED', status: 503 })
    expect(deps.authorize).not.toHaveBeenCalled()
    expect(deps.listEmployments).not.toHaveBeenCalled()
    expect(deps.loadTimeline).not.toHaveBeenCalled()
  })

  it('rejects an employee whose confirmed employment belongs to another administration', async () => {
    const deps = dependencies({
      listEmployments: vi.fn(async () => [employment({ administration_id: otherAdministrationId })]),
    })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', status: 404 })
    expect(deps.loadTimeline).not.toHaveBeenCalled()
  })

  it('fails closed when multiple confirmed employments overlap the requested administration and period', async () => {
    const deps = dependencies({
      listEmployments: vi.fn(async () => [employment(), employment({ id: '50000000-0000-4000-8000-000000000055' })]),
    })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_EMPLOYMENT_AMBIGUOUS', status: 409 })
  })

  it('selects one explicitly authorized employment when an employee has multiple employments', async () => {
    const secondEmploymentId = '50000000-0000-4000-8000-000000000055'
    const deps = dependencies({
      listEmployments: vi.fn(async () => [employment(), employment({ id: secondEmploymentId })]),
      loadTimeline: vi.fn(async () => ({ employment: employment({ id: secondEmploymentId }), salaries: [salary()], schedules: [schedule()] })),
    })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    const snapshot = await provider.getPayrollSourceSnapshot({ ...request, employmentId: secondEmploymentId })

    expect(snapshot.sourceEmploymentId).toBe(secondEmploymentId)
    expect(deps.loadTimeline).toHaveBeenCalledWith(employeeId, secondEmploymentId, request.payrollPeriod)
  })

  it('validates an explicit employment id against the scoped employment projection', async () => {
    const scopedDirectoryRead = vi.fn(async () => [employment()])
    const expected = await new LiquidHrPayrollSourceProvider(dependencies())
      .getPayrollSourceSnapshot({ ...request, employmentId })
    const actual = await new LiquidHrPayrollSourceProvider(dependencies({ listEmployments: scopedDirectoryRead }))
      .getPayrollSourceSnapshot({ ...request, employmentId })

    expect(scopedDirectoryRead).toHaveBeenCalledWith(employeeId)
    expect(actual.sourceEmploymentId).toBe(employmentId)
    expect(actual.sourceHash).toBe(expected.sourceHash)
  })

  it('does not let an employment id escape the authorized employee selection', async () => {
    const deps = dependencies({ listEmployments: vi.fn(async () => [employment()]) })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot({
      ...request,
      employmentId: '50000000-0000-4000-8000-000000000055',
    })).rejects.toMatchObject({ code: 'PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', status: 404 })
    expect(deps.listEmployments).toHaveBeenCalledWith(employeeId)
    expect(deps.loadTimeline).not.toHaveBeenCalled()
    expect(deps.loadActualWork).not.toHaveBeenCalled()
  })

  it('rejects a service read that changes the employment scope between selection and detail load', async () => {
    const deps = dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment({ administration_id: otherAdministrationId }),
        salaries: [salary()],
        schedules: [schedule()],
      })),
    })
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot(request))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN', status: 403 })
  })

  it('produces the same source hash for the same state and a different hash after a relevant source change', async () => {
    const first = await new LiquidHrPayrollSourceProvider(dependencies()).getPayrollSourceSnapshot(request)
    const sameState = await new LiquidHrPayrollSourceProvider(dependencies({
      createId: () => '80000000-0000-4000-8000-000000000009',
      now: () => new Date('2026-10-01T12:00:00.000Z'),
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary()],
        schedules: [schedule()],
      })),
    })).getPayrollSourceSnapshot(request)
    const changedSource = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({ fulltime_amount: 3300, updated_at: '2026-09-20T10:00:00.000Z' })],
        schedules: [schedule()],
      })),
    })).getPayrollSourceSnapshot(request)

    expect(first.id).not.toBe(sameState.id)
    expect(first.createdAt).not.toBe(sameState.createdAt)
    expect(first.sourceHash).toBe(sameState.sourceHash)
    expect(changedSource.sourceHash).not.toBe(first.sourceHash)
  })

  it('canonicalizes effective-dated rows before hashing', async () => {
    const earlySalary = salary({
      id: '60000000-0000-4000-8000-000000000016',
      valid_from: '2026-09-01',
      valid_until: '2026-09-15',
    })
    const lateSalary = salary({
      id: '60000000-0000-4000-8000-000000000017',
      fulltime_amount: 3400,
      valid_from: '2026-09-15',
      valid_until: null,
    })
    const rows = [earlySalary, lateSalary]
    const first = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({ employment: employment(), salaries: rows, schedules: [schedule()] })),
    })).getPayrollSourceSnapshot(request)
    const reversed = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({ employment: employment(), salaries: [...rows].reverse(), schedules: [schedule()] })),
    })).getPayrollSourceSnapshot(request)

    expect(first.sourceHash).toBe(reversed.sourceHash)
    expect(first.sourceGaps.some((gap) => gap.field === 'contractualSalary')).toBe(false)
  })

  it('treats salary and schedule valid_until as exclusive at an adjacent month boundary', async () => {
    const octoberRequest = { ...request, payrollPeriod: { year: 2026, month: 10 } }
    const salaryBeforeBoundary = salary({
      id: '60000000-0000-4000-8000-000000000036',
      valid_from: '2026-09-01',
      valid_until: '2026-10-01',
    })
    const salaryFromBoundary = salary({
      id: '60000000-0000-4000-8000-000000000037',
      fulltime_amount: 4250,
      valid_from: '2026-10-01',
      valid_until: '2026-11-01',
    })
    const scheduleBeforeBoundary = schedule({
      id: '70000000-0000-4000-8000-000000000036',
      valid_from: '2026-09-01',
      valid_until: '2026-10-01',
    })
    const scheduleFromBoundary = schedule({
      id: '70000000-0000-4000-8000-000000000037',
      average_hours_per_week: 32,
      valid_from: '2026-10-01',
      valid_until: '2026-11-01',
    })

    const october = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salaryBeforeBoundary, salaryFromBoundary],
        schedules: [scheduleBeforeBoundary, scheduleFromBoundary],
      })),
    })).getPayrollSourceSnapshot(octoberRequest)

    const canonicalSource = october.canonicalSource as {
      readonly compensation: { readonly entries: readonly { readonly id: string }[] }
      readonly schedule: { readonly entries: readonly { readonly id: string }[] }
    }
    expect(canonicalSource.compensation.entries.map((entry) => entry.id)).toEqual([salaryFromBoundary.id])
    expect(canonicalSource.schedule.entries.map((entry) => entry.id)).toEqual([scheduleFromBoundary.id])
    expect(october.sourceGaps.some((gap) => ['contractualSalary', 'contractualHours'].includes(gap.field))).toBe(false)
  })

  it('marks missing and overlapping source timelines explicitly', async () => {
    const missing = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({ employment: employment(), salaries: [], schedules: [] })),
    })).getPayrollSourceSnapshot(request)
    expect(missing.sourceGaps).toContainEqual({
      field: 'contractualSalary', status: 'SOURCE_GAP', reasonCode: 'NO_EFFECTIVE_SALARY_ROW',
    })
    expect(missing.sourceGaps).toContainEqual({
      field: 'contractualHours', status: 'SOURCE_GAP', reasonCode: 'NO_EFFECTIVE_SCHEDULE_ROW',
    })

    const overlapping = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [
          salary({ id: '60000000-0000-4000-8000-000000000016', valid_until: '2026-09-20' }),
          salary({ id: '60000000-0000-4000-8000-000000000017', valid_from: '2026-09-15' }),
        ],
        schedules: [schedule()],
      })),
    })).getPayrollSourceSnapshot(request)
    expect(overlapping.sourceGaps).toContainEqual({
      field: 'contractualSalary', status: 'UNSUPPORTED', reasonCode: 'SALARY_TIMELINE_OVERLAP',
    })

    const overlappingCompleteCoverage = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [
          salary({ id: '60000000-0000-4000-8000-000000000026' }),
          salary({ id: '60000000-0000-4000-8000-000000000027', valid_from: '2026-09-15' }),
        ],
        schedules: [schedule()],
      })),
    })).getPayrollSourceSnapshot(request)
    expect(overlappingCompleteCoverage.sourceGaps).toContainEqual({
      field: 'contractualSalary', status: 'UNSUPPORTED', reasonCode: 'SALARY_TIMELINE_OVERLAP',
    })
  })

  it('binds effective salary and schedule rows to non-empty, consistent source versions', async () => {
    const missingVersion = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({ updated_at: '' })],
        schedules: [schedule()],
      })),
    })).getPayrollSourceSnapshot(request)
    expect(missingVersion.sourceGaps).toContainEqual({
      field: 'contractualSalary', status: 'SOURCE_GAP', reasonCode: 'SOURCE_VERSION_REFERENCE_MISSING',
    })
    const missingContract = missingVersion.canonicalSource as {
      readonly sourceContract: { readonly schemaVersion: string; readonly scope: {
        readonly tenantId: string; readonly hrGroupId: string; readonly administrationId: string
        readonly employeeId: string; readonly employmentId: string
      }; readonly references: readonly {
        readonly sourceType: string; readonly sourceRowId: string; readonly status: string
      }[] }
    }
    expect(missingContract.sourceContract.schemaVersion).toBe('payroll-source-contract-v1')
    expect(missingContract.sourceContract.scope).toEqual({
      tenantId, hrGroupId, administrationId, employeeId, employmentId, incomeRelationshipId: null,
    })
    expect(missingContract.sourceContract.references).toContainEqual(expect.objectContaining({
      sourceType: 'employment_salaries', sourceRowId: salaryId, status: 'SOURCE_GAP',
    }))

    const impossibleEffectiveDate = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [salary({ valid_from: '2026-02-30' })],
        schedules: [schedule()],
      })),
    })).getPayrollSourceSnapshot(request)
    expect(impossibleEffectiveDate.sourceGaps).toContainEqual({
      field: 'contractualSalary', status: 'SOURCE_GAP', reasonCode: 'SOURCE_VERSION_EFFECTIVE_RANGE_INVALID',
    })
    expect((impossibleEffectiveDate.canonicalSource as {
      readonly sourceContract: { readonly references: readonly {
        readonly sourceType: string; readonly status: string
      }[] }
    }).sourceContract.references).toContainEqual(expect.objectContaining({
      sourceType: 'employment_salaries', status: 'SOURCE_GAP',
    }))

    const inconsistentVersion = await new LiquidHrPayrollSourceProvider(dependencies({
      loadTimeline: vi.fn(async () => ({
        employment: employment(),
        salaries: [
          salary({ valid_until: '2026-09-15', updated_at: '2026-09-01T10:05:00.000Z' }),
          salary({ valid_from: '2026-09-15', updated_at: '2026-09-16T10:05:00.000Z' }),
        ],
        schedules: [schedule()],
      })),
    })).getPayrollSourceSnapshot(request)
    expect(inconsistentVersion.sourceGaps).toContainEqual({
      field: 'contractualSalary', status: 'SOURCE_GAP', reasonCode: 'SOURCE_VERSION_REFERENCE_INCONSISTENT',
    })
  })

  it('validates the request before authorization', async () => {
    const deps = dependencies()
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot({ ...request, payrollPeriod: { year: 2026, month: 13 } }))
      .rejects.toBeInstanceOf(PayrollSourceProviderError)
    expect(deps.authorize).not.toHaveBeenCalled()
  })
})
