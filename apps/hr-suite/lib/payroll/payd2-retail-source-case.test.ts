import { describe, expect, it } from 'vitest'
import {
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import type { ActualWorkPayrollProjection } from '@/lib/actual-work/actual-work-service'
import {
  LiquidHrPayrollSourceProvider,
  type PayrollSourceEmployment,
  type PayrollSourceIncomeRelationship,
  type PayrollSourceProviderDependencies,
  type PayrollSourceSalary,
  type PayrollSourceSchedule,
  type PayrollSourceSetup,
  type PayrollSourceTimeline,
} from './source/liquid-hr-source-provider'
import {
  type CaoPayrollCalculation,
  type CaoRetailBusinessScope,
} from './cao-payroll-integration'
import { renderPayrun01PayslipHtml, LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID } from './payrun01-payslip-pdf'
import {
  derivePayd2RetailR1IndependentOracle,
  derivePayd2RetailR2IndependentOracle,
} from './payd2-retail-independent-oracle'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import { getRetailModeRuleBundle } from '@liquid-hr/payroll-rules-cao-bench02'

type RetailCase = 'R1' | 'R2'
type SnapshotOptions = {
  readonly businessScope?: CaoRetailBusinessScope | null
  readonly eCommerceNight?: boolean
}

const scope = {
  tenantId: '16000000-0000-4000-8000-000000000061',
  hrGroupId: '26000000-0000-4000-8000-000000000062',
  administrationId: '36000000-0000-4000-8000-000000000063',
}

function sourceIds(caseCode: RetailCase) {
  const discriminator = caseCode === 'R1' ? '064' : '065'
  return {
    employee: `46000000-0000-4000-8000-000000000${discriminator}`,
    employment: `56000000-0000-4000-8000-000000000${discriminator}`,
    salary: `66000000-0000-4000-8000-000000000${discriminator}`,
    schedule: `76000000-0000-4000-8000-000000000${discriminator}`,
    contract: `b6000000-0000-4000-8000-000000000${discriminator}`,
    laborCondition: `d6000000-0000-4000-8000-000000000${discriminator}`,
    laborSet: `c6000000-0000-4000-8000-000000000${discriminator}`,
    incomeLink: `86000000-0000-4000-8000-000000000${discriminator}`,
    incomeRelationship: `96000000-0000-4000-8000-000000000${discriminator}`,
    actualWorkPeriod: `67000000-0000-4000-8000-000000000${discriminator}`,
    actualWorkTypeNight: `84000000-0000-4000-8000-000000000${discriminator}`,
    actualWorkTypeSunday: `84000000-0000-4000-8000-000000000${caseCode === 'R1' ? '066' : '067'}`,
    actualWorkTypeOvertime: `84000000-0000-4000-8000-000000000${caseCode === 'R1' ? '068' : '069'}`,
  } as const
}

function createSnapshotFixture(caseCode: RetailCase, options: SnapshotOptions = {}) {
  const ids = sourceIds(caseCode)
  const employeeId = ids.employee
  const employment: PayrollSourceEmployment = {
    id: ids.employment,
    tenant_id: scope.tenantId,
    hr_group_id: scope.hrGroupId,
    administration_id: scope.administrationId,
    employee_id: employeeId,
    starts_on: '2026-01-01',
    ends_on: null,
    record_status: 'CONFIRMED' as PayrollSourceEmployment['record_status'],
    employment_type: 'REGULAR' as PayrollSourceEmployment['employment_type'],
    contract_type: 'PERMANENT' as PayrollSourceEmployment['contract_type'],
    original_hire_date: '2026-01-01',
    seniority_date: '2026-01-01',
    updated_at: '2026-01-01T09:00:00.000Z',
    deleted_at: null,
  }
  const r1 = caseCode === 'R1'
  const salary: PayrollSourceSalary = {
    id: ids.salary,
    salary_basis: (r1 ? 'MANUAL' : 'CAO_SCALE') as PayrollSourceSalary['salary_basis'],
    salary_route: (r1 ? 'MANUAL' : 'SCALE_WITH_STEPS') as PayrollSourceSalary['salary_route'],
    payment_type: 'PERIODIC_FIXED' as PayrollSourceSalary['payment_type'],
    payment_frequency: 'MONTHLY' as PayrollSourceSalary['payment_frequency'],
    currency_code: 'EUR',
    fulltime_amount: r1 ? 4758.96 : 2542.50,
    parttime_amount: r1 ? 4758.96 : 1605.79,
    hourly_rate: r1 ? 28.90 : null,
    salary_structure_id: null,
    salary_scale_id: null,
    salary_scale_step_id: null,
    salary_step_code: r1 ? '15' : '1',
    cao_scale_name: r1 ? 'I' : 'C',
    cao_step_name: r1 ? '15' : '1',
    salary_band_id: null,
    valid_from: '2026-01-01',
    valid_until: null,
    updated_at: '2026-06-30T09:05:00.000Z',
  }
  const schedule: PayrollSourceSchedule = {
    id: ids.schedule,
    average_days_per_week: r1 ? 5 : 3,
    average_hours_per_week: r1 ? 38 : 24,
    fulltime_hours_per_week: 38,
    part_time_factor: r1 ? 1 : 0.6316,
    schedule_type: 'HOURS_PER_DAY' as PayrollSourceSchedule['schedule_type'],
    is_on_call: false,
    valid_from: '2026-01-01',
    valid_until: null,
    updated_at: '2026-01-01T09:10:00.000Z',
  }
  const incomeRelationship: PayrollSourceIncomeRelationship = {
    id: ids.incomeLink,
    incomeRelationshipId: ids.incomeRelationship,
    validFrom: '2026-01-01',
    validUntil: null,
    linkUpdatedAt: '2026-01-01T09:15:00.000Z',
    reportingStatus: 'READY',
    startsOn: '2026-01-01',
    endsOn: null,
    incomeRelationshipUpdatedAt: '2026-01-01T09:20:00.000Z',
  }
  const defaultBusinessScope = options.eCommerceNight ? {
    value: 'ECOMMERCE',
    sourceClassification: 'SYNTHETIC_FIXTURE',
    sourceReference: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-01; case stipulates an e-commerce activity scope',
    sourceVersion: 'PAYD2-RETAIL-01-ECOMMERCE-v1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  } as const satisfies CaoRetailBusinessScope : {
    value: 'IN_STORE',
    sourceClassification: 'SYNTHETIC_FIXTURE',
    sourceReference: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-01; case stipulates an in-store Mode employer, not an employer-confirmed fact',
    sourceVersion: 'PAYD2-RETAIL-01-IN-STORE-v1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  } as const satisfies CaoRetailBusinessScope
  const businessScope = options.businessScope === null ? undefined : options.businessScope ?? defaultBusinessScope
  const timeline: PayrollSourceTimeline = {
    employment,
    salaries: [salary],
    schedules: [schedule],
    contracts: [{
      id: ids.contract,
      labor_condition_set_id: ids.laborSet,
      fulltime_hours_per_week: 38,
      starts_on: '2026-01-01',
      ends_on: null,
      updated_at: '2026-01-01T09:02:00.000Z',
    }],
    laborConditions: [{
      id: ids.laborCondition,
      condition_group: 'CAO',
      labor_condition_set_id: ids.laborSet,
      valid_from: '2026-01-01',
      valid_until: null,
      updated_at: '2026-01-01T09:03:00.000Z',
      set: {
        id: ids.laborSet,
        code: 'CAO_RETAIL_NON_FOOD_2026_2027',
        name: 'Cao Retail Non-Food / Mode 2026–2027 (synthetic fixture)',
        standard_hours_per_week: 38,
        is_active: true,
        valid_from: '2026-01-01',
        updated_at: '2026-01-01T09:03:00.000Z',
      },
    }],
    incomeRelationships: [incomeRelationship],
    ...(businessScope ? { retailBusinessScope: businessScope } : {}),
  }

  const period = {
    id: ids.actualWorkPeriod,
    period_start: '2026-07-01',
    period_end: '2026-08-01',
    status: 'CLOSED' as const,
    updated_at: '2026-08-01T09:00:00.000Z',
  }
  const workTypes: ActualWorkPayrollProjection['types'] = r1 ? [] : [
    {
      id: ids.actualWorkTypeNight,
      family: 'WORK',
      code: 'WEEKDAY_NIGHT',
      name: 'Werk op maandag tot en met zaterdag van 22.00 tot 24.00 uur',
      valid_from: '2026-01-01',
      valid_until: null,
      approval_required: true,
      updated_at: '2026-01-01T09:30:00.000Z',
    },
    {
      id: ids.actualWorkTypeSunday,
      family: 'WORK',
      code: 'SUNDAY',
      name: 'Zondagwerk',
      valid_from: '2026-01-01',
      valid_until: null,
      approval_required: true,
      updated_at: '2026-01-01T09:31:00.000Z',
    },
    {
      id: ids.actualWorkTypeOvertime,
      family: 'OVERTIME',
      code: 'DAILY_OVERTIME',
      name: 'Dagelijks overwerk',
      valid_from: '2026-01-01',
      valid_until: null,
      approval_required: true,
      updated_at: '2026-01-01T09:32:00.000Z',
    },
  ]
  const makeWorkEntry = (input: {
    readonly id: string
    readonly typeId: string
    readonly date: string
    readonly hours: number
  }): ActualWorkPayrollProjection['entries'][number] => ({
    id: input.id,
    employment_id: ids.employment,
    work_hour_type_id: input.typeId,
    work_date: input.date,
    entry_granularity: 'DAY',
    subject_period_start: input.date,
    subject_period_end: new Date(Date.parse(`${input.date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10),
    posting_period_start: '2026-07-01',
    hours: input.hours,
    status: 'APPROVED',
    approved_at: `${input.date}T12:00:00.000Z`,
    updated_at: `${input.date}T12:00:00.000Z`,
  })
  const entries: ActualWorkPayrollProjection['entries'] = r1 ? [] : [
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000071', typeId: ids.actualWorkTypeSunday, date: '2026-07-12', hours: 1 }),
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000072', typeId: ids.actualWorkTypeNight, date: '2026-07-13', hours: 1 }),
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000073', typeId: ids.actualWorkTypeOvertime, date: '2026-07-12', hours: 1 }),
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000074', typeId: ids.actualWorkTypeOvertime, date: '2026-07-13', hours: 1 }),
  ]
  const actualWork: ActualWorkPayrollProjection = { period, entries, types: workTypes }
  const payrollSetup: PayrollSourceSetup = {
    configurationRows: [],
    configurationRow: null,
    configuration: null,
    openingBalance: null,
  }
  const dependencies: PayrollSourceProviderDependencies = {
    authorize: async () => scope,
    listEmployments: async () => [employment],
    loadTimeline: async () => timeline,
    loadActualWork: async () => actualWork,
    loadPayrollSetup: async () => payrollSetup,
    isEnabled: () => true,
    now: () => new Date('2026-10-23T08:00:00.000Z'),
    createId: () => `98000000-0000-4000-8000-000000000${caseCode === 'R1' ? '081' : '082'}`,
    createCorrelationId: () => `PAYD2-RETAIL-01-${caseCode}-CORRELATION`,
  }

  return { ids, employeeId, employment, salary, schedule, actualWork, dependencies }
}

async function createRetailSourceSnapshot(
  caseCode: RetailCase,
  options: SnapshotOptions = {},
): Promise<PayrollSourceSnapshot> {
  const fixture = createSnapshotFixture(caseCode, options)
  const source = await new LiquidHrPayrollSourceProvider(fixture.dependencies).getPayrollSourceSnapshot({
    ...scope,
    employeeId: fixture.employeeId,
    employmentId: fixture.employment.id,
    payrollPeriod: { year: 2026, month: 7 },
  })
  const sourceCanonical = source.canonicalSource as Record<string, unknown>
  const canonicalSource = {
    ...sourceCanonical,
    caseProvenance: {
      fixtureId: `PAYD2-RETAIL-01-${caseCode}`,
      dataClass: 'SYNTHETIC_FIXTURE',
      sourcePurpose: 'In-memory source-provider dependency; no Core or Payroll database access or write',
      employerScope: 'Fictional Retail Mode case; not employer-confirmed or a CAO applicability finding',
      ...(caseCode === 'R2' ? {
        premiumOverlap: {
          sourceClassification: 'SYNTHETIC_FIXTURE',
          weekdayNightHours: '1.0000',
          sundayHours: '1.0000',
          dailyOvertimeHours: '2.0000',
          explicitOvertimeOverlapHours: '2.0000',
          stipulation: 'One overtime hour overlaps the night hour and one overlaps the Sunday hour.',
        },
      } : {}),
    },
  }
  const hashInput = {
    sourceTenantId: source.sourceTenantId,
    sourceHrGroupId: source.sourceHrGroupId,
    sourceAdministrationId: source.sourceAdministrationId,
    sourceEmployeeId: source.sourceEmployeeId,
    sourceEmploymentId: source.sourceEmploymentId,
    sourceIncomeRelationshipId: source.sourceIncomeRelationshipId,
    periodReference: source.periodReference,
    canonicalSource,
    sourceVersionVector: source.sourceVersionVector,
    sourceGaps: source.sourceGaps,
  }
  return {
    ...source,
    canonicalSource: canonicalSource as typeof source.canonicalSource,
    sourceHash: hashPayrollSourceSnapshot(hashInput),
  }
}

function canonical(snapshot: PayrollSourceSnapshot): Record<string, unknown> {
  return snapshot.canonicalSource as Record<string, unknown>
}

function retailCalculation(snapshot: PayrollSourceSnapshot): CaoPayrollCalculation {
  return canonical(snapshot).caoCalculation as CaoPayrollCalculation
}

function sourceContract(snapshot: PayrollSourceSnapshot): {
  readonly schemaVersion: string
  readonly scope: Record<string, string | null>
  readonly periodStart: string
  readonly periodEndExclusive: string
  readonly references: readonly {
    readonly field: string
    readonly sourceType: string
    readonly sourceRowId: string
    readonly version: string
    readonly status: string
  }[]
  readonly versionVector: Record<string, string>
} {
  return canonical(snapshot).sourceContract as ReturnType<typeof sourceContract>
}

describe('PAYD2 Retail in-memory source cases', () => {
  it('binds R1 to the July wage/version source and preserves the complete indexation-cap trace', async () => {
    const snapshot = await createRetailSourceSnapshot('R1')
    const repeat = await createRetailSourceSnapshot('R1')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR1IndependentOracle()
    const engineTrace = cao.componentTrace?.find((step) => step.componentCode === 'RETAIL_MODE_GROSS')
    const indexTrace = engineTrace?.registeredRuleTrace?.find((step) => step.code === 'RETAIL_R1_JULY_ACTUAL_RATE_INDEXATION_CAP')
    const metadata = getRetailModeRuleBundle('2026-07-01').rulePackage.metadata?.sourceMetadata

    expect(snapshot.sourceHash).toBe(repeat.sourceHash)
    expect(cao.resultHash).toBe(retailCalculation(repeat).resultHash)
    expect(contract).toMatchObject({
      schemaVersion: 'payroll-source-contract-v1',
      scope: {
        tenantId: scope.tenantId,
        hrGroupId: scope.hrGroupId,
        administrationId: scope.administrationId,
        employeeId: snapshot.sourceEmployeeId,
        employmentId: snapshot.sourceEmploymentId,
        incomeRelationshipId: snapshot.sourceIncomeRelationshipId,
      },
      periodStart: '2026-07-01',
      periodEndExclusive: '2026-08-01',
    })
    expect(contract.references.every((reference) => reference.status === 'BOUND'
      && reference.sourceRowId.length > 0 && reference.version.length > 0)).toBe(true)
    expect(contract.references.map((reference) => reference.sourceType)).toEqual(expect.arrayContaining([
      'employments', 'employment_salaries', 'employment_schedules', 'employment_contracts',
      'employment_labor_conditions', 'labor_condition_sets', 'synthetic_fixture',
      'employment_income_relationships', 'income_relationships',
    ]))
    expect(contract.versionVector).toEqual(snapshot.sourceVersionVector)
    expect(snapshot.sourceVersionVector).toMatchObject({
      'cao:rule-package:CAO-RETAIL-NON-FOOD-2026:2026.7': `${cao.packageVersion}:${cao.packageHash}`,
      [`cao:input:${snapshot.sourceEmploymentId}`]: `${cao.inputHash}:${cao.sourceHash}`,
    })
    expect(metadata).toMatchObject({
      activeTableEffectiveFrom: '2026-07-01',
      activeTableEffectiveTo: '2026-12-31',
      activeTableSourceSha256: 'ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc',
      grossScopeNotice: expect.stringContaining('8% vacation allowance'),
    })
    expect(cao).toMatchObject({
      status: 'CALCULATED',
      family: 'RETAIL_MODE',
      packageVersion: '2026.7',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-12-31',
      hourlyBaseRate: oracle.appliedHourlyRate,
      baseAmount: oracle.baseMonthlyGross,
      premiumAmount: '0.00',
      grossAmount: oracle.gross,
    })
    expect(indexTrace?.values).toMatchObject({
      previousHourlyRate: { valueType: 'MONEY', value: oracle.previousHourlyRate },
      indexationRate: { valueType: 'PERCENTAGE', value: oracle.indexationRate },
      indexedHourlyRateBeforeRounding: { valueType: 'MONEY', value: oracle.indexedHourlyRateBeforeRounding },
      indexedHourlyRateBeforeCap: { valueType: 'MONEY', value: oracle.indexedHourlyRateBeforeCap },
      tableMaximumHourlyRate: { valueType: 'MONEY', value: oracle.maximumHourlyRate },
      hourlyRateAfterCap: { valueType: 'MONEY', value: oracle.appliedHourlyRate },
    })
    expect(cao.packageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.inputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.resultHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(source.caseProvenance).toMatchObject({ dataClass: 'SYNTHETIC_FIXTURE' })
    expect(source.retailBusinessScope).toMatchObject({ sourceClassification: 'SYNTHETIC_FIXTURE' })
    expect(snapshot.sourceGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'taxProfile', status: 'SOURCE_GAP' }),
      expect.objectContaining({ field: 'pension', status: 'SOURCE_GAP', reasonCode: 'NO_EFFECTIVE_PENSION_ASSIGNMENT' }),
      expect.objectContaining({ field: 'payrollConfiguration', status: 'SOURCE_GAP', reasonCode: 'PAYROLL_EMPLOYER_CONFIGURATION_MISSING' }),
      expect.objectContaining({ field: 'openingCumulative', status: 'SOURCE_GAP', reasonCode: 'PAYROLL_OPENING_CUMULATIVE_MISSING' }),
    ]))
    expect(source).not.toHaveProperty('payrollOwned')
  })

  it('binds R2 part-time pay, overlap-safe premiums, and actual-work source versions', async () => {
    const snapshot = await createRetailSourceSnapshot('R2')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR2IndependentOracle()
    const engineTrace = cao.componentTrace?.find((step) => step.componentCode === 'RETAIL_MODE_GROSS')
    const premiumTrace = engineTrace?.registeredRuleTrace?.find((step) => step.code === 'RETAIL_R2_BEST_OF_PREMIUMS_NO_DOUBLE_PAY')
    const actualWork = source.actualWork as { readonly entries: readonly Record<string, unknown>[] }

    expect(contract.references.every((reference) => reference.status === 'BOUND')).toBe(true)
    expect(contract.references.map((reference) => reference.sourceType)).toEqual(expect.arrayContaining([
      'actual_work_periods', 'work_hour_types', 'employment_work_hour_entries', 'synthetic_fixture',
    ]))
    expect(snapshot.sourceVersionVector).toMatchObject({
      [`actual_work_period:${sourceIds('R2').actualWorkPeriod}`]: '2026-08-01T09:00:00.000Z',
      [`retail_business_scope:${snapshot.sourceEmploymentId}`]: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-01-IN-STORE-v1',
    })
    expect(actualWork.entries).toHaveLength(4)
    expect(snapshot.sourceGaps).not.toContainEqual(expect.objectContaining({
      field: 'actualWork', reasonCode: 'OVERTIME_RULE_NOT_CONFIGURED',
    }))
    expect(cao).toMatchObject({
      status: 'CALCULATED',
      packageVersion: '2026.7',
      hourlyBaseRate: oracle.hourlyBaseRate,
      baseAmount: oracle.baseMonthlyGross,
      premiumAmount: oracle.selectedPremiumGross,
      grossAmount: oracle.gross,
      inputs: {
        scenarioCode: 'R2',
        functionGroup: 'C',
        experienceRow: '1',
        contractHoursPerWeek: '24',
        fullTimeHoursPerWeek: '38',
        weekdayNightHours: oracle.weekdayNightHours,
        sundayHours: oracle.sundayHours,
        dailyOvertimeHours: oracle.dailyOvertimeHours,
        isEcommerce: false,
      },
    })
    expect(premiumTrace?.values).toMatchObject({
      weekdayNightHours: { value: oracle.weekdayNightHours },
      sundayHours: { value: oracle.sundayHours },
      dailyOvertimeHours: { value: oracle.dailyOvertimeHours },
      dailyOvertimeOverlapHours: { value: oracle.overlappingOvertimeHours },
      dailyOvertimeOnlyHours: { value: oracle.overtimeOnlyHours },
      selectedPremiumGross: { value: oracle.selectedPremiumGross },
    })
    expect(source.caseProvenance).toMatchObject({
      premiumOverlap: {
        sourceClassification: 'SYNTHETIC_FIXTURE',
        explicitOvertimeOverlapHours: '2.0000',
      },
    })
    expect(source.fiscalProfile).toMatchObject({ status: 'SOURCE_GAP' })
    expect(source).not.toHaveProperty('payrollOwned')
  })

  it('blocks night-hour cases when retail business scope is missing or is e-commerce without time-band detail', async () => {
    const missingScope = await createRetailSourceSnapshot('R2', { businessScope: null })
    const eCommerce = await createRetailSourceSnapshot('R2', { eCommerceNight: true })
    const missingCalculation = retailCalculation(missingScope)
    const eCommerceCalculation = retailCalculation(eCommerce)

    expect(missingCalculation).toMatchObject({
      status: 'BLOCKED',
      blockingStatus: 'SOURCE_GAP',
      reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED',
    })
    expect(missingScope.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'cao', status: 'SOURCE_GAP', reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED',
    }))
    expect(sourceContract(missingScope).references.map((reference) => reference.field)).not.toContain('retailBusinessScope')
    expect(eCommerceCalculation).toMatchObject({
      status: 'BLOCKED',
      blockingStatus: 'UNSUPPORTED',
      reasonCode: 'CAO_RETAIL_ECOMMERCE_NIGHT_BAND_UNSUPPORTED',
    })
    expect(eCommerce.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'cao', status: 'UNSUPPORTED', reasonCode: 'CAO_RETAIL_ECOMMERCE_NIGHT_BAND_UNSUPPORTED',
    }))
    expect(eCommerceCalculation.grossAmount).toBeUndefined()
  })

  it('does not render a payslip from the gross-only source gaps', async () => {
    const snapshot = await createRetailSourceSnapshot('R2')
    const cao = retailCalculation(snapshot)

    expect(() => renderPayrun01PayslipHtml({
      data: {
        period: { year: 2026, month: 7, startsOn: '2026-07-01', endsOn: '2026-07-31' },
        lifecycle: 'CONCEPT',
        profile: {
          status: 'SYNTHETIC_TEST_PROFILE',
          employerName: 'Retail Mode TEST',
          employeeName: 'PAYD2 Retail Testmedewerker',
          writtenContract: true,
          contractType: 'INDEFINITE',
          isOnCall: false,
          contractHoursPerWeek: 24,
          fulltimeHoursPerWeek: 38,
        },
        components: [{ key: 'gross_salary', amount: cao.grossAmount ?? '0.00' }],
        sourceWarnings: ['SOURCE_GAP: fiscal, employer, pension and cumulative inputs are not bound.'],
      },
      presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
    })).toThrow('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
  })
})
