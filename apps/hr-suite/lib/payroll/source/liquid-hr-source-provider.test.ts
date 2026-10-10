import { describe, expect, it, vi } from 'vitest'
import {
  LiquidHrPayrollSourceProvider,
  PayrollSourceProviderError,
  type PayrollSourceEmployment,
  type PayrollSourceIncomeRelationship,
  type PayrollSourceTimeline,
  type PayrollSourceProviderDependencies,
  type PayrollSourceSalary,
  type PayrollSourceSchedule,
} from './liquid-hr-source-provider'
import type { PayrollSourceProviderInput } from '@liquid-hr/payroll-engine'
import type { ActualWorkPayrollProjection } from '@/lib/actual-work/actual-work-service'

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

describe('LiquidHR Payroll source provider', () => {
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
      fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'incomeRelationship', status: 'SOURCE_GAP', reasonCode: 'NO_LINKED_INCOME_RELATIONSHIP',
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT',
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
    const approvedWork = actualWork({
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
    })
    const provider = new LiquidHrPayrollSourceProvider(dependencies({
      loadActualWork: vi.fn(async () => approvedWork),
    }))

    const snapshot = await provider.getPayrollSourceSnapshot(request)
    const payload = JSON.stringify(snapshot.canonicalSource)

    expect(snapshot.canonicalSource).toMatchObject({
      actualWork: {
        period: { status: 'CLOSED', startsOn: '2026-09-01', endsOn: '2026-10-01' },
        entries: [
          { family: 'WORK', hours: '8.0000', status: 'APPROVED' },
          { family: 'ADDITIONAL', hours: '2.0000', status: 'APPROVED' },
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
      field: 'actualWork', status: 'UNSUPPORTED', reasonCode: 'OVERTIME_RULE_NOT_CONFIGURED',
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

  it('validates the request before authorization', async () => {
    const deps = dependencies()
    const provider = new LiquidHrPayrollSourceProvider(deps)

    await expect(provider.getPayrollSourceSnapshot({ ...request, payrollPeriod: { year: 2026, month: 13 } }))
      .rejects.toBeInstanceOf(PayrollSourceProviderError)
    expect(deps.authorize).not.toHaveBeenCalled()
  })
})
