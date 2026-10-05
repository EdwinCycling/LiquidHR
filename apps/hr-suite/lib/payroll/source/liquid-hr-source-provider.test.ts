import { describe, expect, it, vi } from 'vitest'
import {
  LiquidHrPayrollSourceProvider,
  PayrollSourceProviderError,
  type PayrollSourceEmployment,
  type PayrollSourceProviderDependencies,
  type PayrollSourceSalary,
  type PayrollSourceSchedule,
} from './liquid-hr-source-provider'
import type { PayrollSourceProviderInput } from '@liquid-hr/payroll-engine'

const tenantId = '10000000-0000-4000-8000-000000000001'
const hrGroupId = '20000000-0000-4000-8000-000000000002'
const administrationId = '30000000-0000-4000-8000-000000000003'
const otherAdministrationId = '30000000-0000-4000-8000-000000000004'
const employeeId = '40000000-0000-4000-8000-000000000004'
const employmentId = '50000000-0000-4000-8000-000000000005'
const salaryId = '60000000-0000-4000-8000-000000000006'
const scheduleId = '70000000-0000-4000-8000-000000000007'

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
    schedule_type: 'FIXED' as PayrollSourceSchedule['schedule_type'],
    is_on_call: false,
    valid_from: '2026-09-01',
    valid_until: null,
    updated_at: '2026-09-01T10:10:00.000Z',
    ...overrides,
  }
}

function dependencies(overrides: Partial<PayrollSourceProviderDependencies> = {}): PayrollSourceProviderDependencies {
  return {
    authorize: vi.fn(async () => ({ tenantId, hrGroupId, administrationId })),
    listEmployments: vi.fn(async () => [employment()]),
    loadTimeline: vi.fn(async () => ({ employment: employment(), salaries: [salary()], schedules: [schedule()] })),
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
      incomeRelationship: { status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING' },
      fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING',
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
