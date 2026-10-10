import { describe, expect, it } from 'vitest'
import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import {
  Payrun01SourceProjectionError,
  projectPayrun01SourceSnapshot,
  type Payrun01SourceProjectionConfig,
} from './payrun01-source-projection'

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  group: '20000000-0000-4000-8000-000000000001',
  administration: '30000000-0000-4000-8000-000000000001',
  employee: '40000000-0000-4000-8000-000000000001',
  employment: '50000000-0000-4000-8000-000000000001',
  incomeRelationship: '60000000-0000-4000-8000-000000000001',
  snapshot: '70000000-0000-4000-8000-000000000001',
  assignment: '80000000-0000-4000-8000-000000000001',
  arrangement: '90000000-0000-4000-8000-000000000001',
  opening: 'a0000000-0000-4000-8000-000000000001',
  workEntry: 'b0000000-0000-4000-8000-000000000001',
  additionalEntry: 'c0000000-0000-4000-8000-000000000001',
}

const configHash = 'a'.repeat(64)
const openingHash = 'b'.repeat(64)

function sourceSnapshot(options: { readonly lisa?: boolean; readonly gaps?: PayrollSourceSnapshot['sourceGaps'] } = {}): PayrollSourceSnapshot {
  const lisa = options.lisa ?? false
  const canonicalSource = {
    schemaVersion: 'payroll-source-v1',
    employment: { startsOn: lisa ? '2026-01-01' : '2026-09-01', endsOn: null, recordStatus: 'CONFIRMED' },
    compensation: {
      entries: [{
        id: 'd0000000-0000-4000-8000-000000000001',
        salaryBasis: lisa ? 'MANUAL' : 'CAO',
        salaryRoute: lisa ? 'MANUAL' : 'CAO',
        paymentFrequency: 'MONTHLY',
        currencyCode: 'EUR',
        fulltimeAmount: lisa ? 5500 : 3425,
        parttimeAmount: lisa ? 5500 : 3044.44,
        salaryScaleId: lisa ? null : 'scale-6-id',
        salaryScaleStepId: lisa ? null : 'scale-6-step-20-id',
        salaryStepCode: lisa ? null : '20',
        caoScaleName: lisa ? null : '6',
        caoStepName: lisa ? null : '20',
        salaryBandId: null,
        validFrom: lisa ? '2026-01-01' : '2026-09-01',
        validUntil: null,
      }],
    },
    schedule: {
      entries: [{
        averageHoursPerWeek: lisa ? 40 : 32,
        fulltimeHoursPerWeek: lisa ? 40 : 36,
        partTimeFactor: lisa ? 1 : 0.8889,
        scheduleType: 'HOURS_PER_DAY',
        isOnCall: false,
        validFrom: lisa ? '2026-01-01' : '2026-09-01',
        validUntil: null,
      }],
    },
    incomeRelationship: { id: ids.incomeRelationship, status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING' },
    fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
    actualWork: {
      period: { startsOn: '2026-10-01', endsOn: '2026-11-01', status: 'CLOSED' },
      entries: lisa ? [] : [
        {
          id: ids.workEntry,
          family: 'WORK',
          workDate: '2026-10-05',
          subjectPeriodStart: '2026-10-05',
          subjectPeriodEnd: '2026-10-06',
          postingPeriodStart: '2026-10-01',
          hours: '8.0000',
          status: 'APPROVED',
          approvedAt: '2026-10-06T10:00:00.000Z',
          typeValidFrom: '2026-01-01',
          typeValidUntil: null,
        },
        {
          id: ids.additionalEntry,
          family: 'ADDITIONAL',
          workDate: '2026-10-06',
          subjectPeriodStart: '2026-10-06',
          subjectPeriodEnd: '2026-10-07',
          postingPeriodStart: '2026-10-01',
          hours: '2.0000',
          status: 'APPROVED',
          approvedAt: '2026-10-07T10:00:00.000Z',
          typeValidFrom: '2026-01-01',
          typeValidUntil: null,
        },
      ],
    },
  }
  const fields = {
    sourceTenantId: ids.tenant,
    sourceHrGroupId: ids.group,
    sourceAdministrationId: ids.administration,
    sourceEmployeeId: ids.employee,
    sourceEmploymentId: ids.employment,
    sourceIncomeRelationshipId: ids.incomeRelationship,
    periodReference: { year: 2026, month: 10 },
    canonicalSource,
    sourceVersionVector: { [`employment:${ids.employment}`]: '2026-10-01T10:00:00.000Z' },
    sourceGaps: options.gaps ?? [
      { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
      { field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING' },
    ],
  }
  return {
    id: ids.snapshot,
    ...fields,
    sourceHash: hashPayrollSourceSnapshot(fields),
    createdAt: '2026-10-05T09:00:00.000Z',
  }
}

function projectionConfig(options: {
  readonly lisa?: boolean
  readonly allowIkvFallback?: boolean
  readonly additionalCompensation?: 'CASH_AT_ORDINARY_RATE' | 'TIME_OFF' | 'UNRESOLVED'
  readonly additionalCashAmount?: string
} = {}): Payrun01SourceProjectionConfig {
  const lisa = options.lisa ?? false
  return {
    scenarioId: lisa ? 'DEMO_COMPANY_TEST' : 'KINDEROPVANG_TEST',
    assignmentId: ids.assignment,
    arrangementConfigId: ids.arrangement,
    arrangementConfigHash: configHash,
    compositionId: `NL-2026+PAYRUN01-${lisa ? 'DEMO_COMPANY_TEST' : 'KINDEROPVANG_TEST'}`,
    scope: {
      tenantId: ids.tenant,
      hrGroupId: ids.group,
      administrationId: ids.administration,
      employeeId: ids.employee,
      employmentId: ids.employment,
      periodReference: { year: 2026, month: 10 },
    },
    asOf: '2026-10-05T10:00:00.000Z',
    maximumSnapshotAgeMilliseconds: 60 * 60 * 1000,
    expectedEmploymentStartDate: lisa ? '2026-01-01' : '2026-09-01',
    expectedSalary: lisa
      ? {
        pricingMode: 'SOURCE_MONTHLY', monthlyGrossAmount: '5500.00', fulltimeMonthlyAmount: '5500.00',
        currencyCode: 'EUR', paymentFrequency: 'MONTHLY', salaryRoute: 'MANUAL', salaryBasis: 'MANUAL',
      }
      : {
        pricingMode: 'CAO_PRORATION', fulltimeMonthlyAmount: '3425.00', currencyCode: 'EUR',
        paymentFrequency: 'MONTHLY', salaryRoute: 'CAO', salaryBasis: 'CAO',
        salaryScaleId: 'scale-6-id', salaryScaleStepId: 'scale-6-step-20-id',
        salaryStepCode: '20', caoScaleName: '6', caoStepName: '20', salaryBandId: null,
      },
    expectedSchedule: lisa
      ? { contractHoursPerWeek: 40, fulltimeHoursPerWeek: 40, partTimeFactor: 1, scheduleType: 'HOURS_PER_DAY', isOnCall: false }
      : { contractHoursPerWeek: 32, fulltimeHoursPerWeek: 36, partTimeFactor: 32 / 36, scheduleType: 'HOURS_PER_DAY', isOnCall: false },
    taxProfile: {
      fiscalYear: '2026', table: 'WHITE', residence: 'NL', ageCategory: 'UNDER_AOW', herleiding: 'STD',
      timePeriod: 'MONTH', payrollTaxCredit: true, regularWage: true, fullPeriod: true, hasSpecialSituation: false,
    },
    calculationIncomeRelationshipId: ids.incomeRelationship,
    incomeRelationshipFallbackReasonCodes: options.allowIkvFallback === false ? [] : ['CONTROL02_CONTRACT_PENDING'],
    additionalHourCompensation: options.additionalCompensation === 'UNRESOLVED'
      ? { mode: 'UNRESOLVED' }
      : options.additionalCompensation === 'CASH_AT_ORDINARY_RATE'
        ? { mode: 'CASH_AT_ORDINARY_RATE', cashAmount: options.additionalCashAmount ?? '37.94' }
        : { mode: 'TIME_OFF', cashAmount: '0.00' },
    pension: lisa ? { mode: 'DISABLED' } : { mode: 'UNSUPPORTED', reasonCode: 'PAYRUN01_PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED' },
    employerRates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
    reserveRates: { holidayAllowance: '8.00', yearEnd: lisa ? '0.00' : '8.00' },
    openingCumulatives: {
      id: ids.opening,
      status: 'SYNTHETIC_TEST',
      throughPeriod: { year: 2026, month: 9 },
      sourceHash: openingHash,
      grossWage: lisa ? '49500.00' : '0.00',
      holidayReserve: lisa ? '0.00' : '0.00',
      yearEndReserve: '0.00',
    },
    socialWageCapClear: true,
  }
}

function amount(snapshot: PayrollSourceSnapshot): string | null {
  const canonical = snapshot.canonicalSource
  if (canonical === null || typeof canonical !== 'object' || Array.isArray(canonical)) return null
  const canonicalRecord = canonical as Readonly<Record<string, unknown>>
  const regularWage = canonicalRecord.regularWage
  if (regularWage === null || typeof regularWage !== 'object' || Array.isArray(regularWage)) return null
  const regularWageRecord = regularWage as Readonly<Record<string, unknown>>
  return typeof regularWageRecord.grossAmount === 'string' ? regularWageRecord.grossAmount : null
}

describe('PAYRUN01 Payroll-owned source projection', () => {
  it('preserves approved WORK and ADDITIONAL hours without pricing them or paying normal hours twice', () => {
    const original = sourceSnapshot()
    const result = projectPayrun01SourceSnapshot(original, projectionConfig())

    expect(amount(result.snapshot)).toBeNull()
    expect(result.provenance).toMatchObject({ additionalHours: '2.0000', additionalCompensationMode: 'TIME_OFF', normalHoursPaidSeparately: false })
    const canonical = result.snapshot.canonicalSource
    expect(canonical).toMatchObject({
      regularWage: {
        fulltimeMonthlyAmount: '3425',
        contractHoursPerWeek: '32',
        fulltimeHoursPerWeek: '36',
        salaryPricingMode: 'CAO_PRORATION',
        projectionStatus: 'READY_FOR_ENGINE',
      },
    })
    expect(JSON.stringify(canonical)).not.toContain('grossAmount')
    expect(result.snapshot.sourceIncomeRelationshipId).toBe(ids.incomeRelationship)
    expect(result.snapshot.sourceGaps.slice(0, original.sourceGaps.length)).toEqual(original.sourceGaps)
    expect(original.canonicalSource).toMatchObject({ fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' } })
    expect(result.controls).toMatchObject({
      sourceReady: true,
      ikvUnambiguous: true,
      salaryConsistent: true,
      hoursConsistent: true,
      normalHoursNotDuplicated: true,
      additionalHoursSupported: true,
      pensionRuleReady: false,
      cumulativeContinuity: true,
    })
    expect(result.blockers).toContain('PAYRUN01_PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED')
    expect(result.snapshot.canonicalSource).toMatchObject({
      payrollOwned: {
        additionalHoursCashAmount: '0.00',
        pension: { status: 'UNSUPPORTED', reasonCode: 'PAYRUN01_PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED' },
        amounts: {},
      },
    })
    expect(JSON.stringify(result.snapshot.canonicalSource)).not.toMatch(/employeePension|employerPension/)
    expect(result.calculationIncomeRelationshipId).toBe(ids.incomeRelationship)
    expect(result.snapshot.sourceHash).not.toBe(original.sourceHash)
    expect(result.snapshot.sourceHash).toBe(hashPayrollSourceSnapshot({
      sourceTenantId: result.snapshot.sourceTenantId,
      sourceHrGroupId: result.snapshot.sourceHrGroupId,
      sourceAdministrationId: result.snapshot.sourceAdministrationId,
      sourceEmployeeId: result.snapshot.sourceEmployeeId,
      sourceEmploymentId: result.snapshot.sourceEmploymentId,
      sourceIncomeRelationshipId: result.snapshot.sourceIncomeRelationshipId,
      periodReference: result.snapshot.periodReference,
      canonicalSource: result.snapshot.canonicalSource,
      sourceVersionVector: result.snapshot.sourceVersionVector,
      sourceGaps: result.snapshot.sourceGaps,
    }))
    expect(JSON.stringify(result.snapshot.canonicalSource)).toContain('PAYRUN01_PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED')
    expect(result.snapshot.canonicalSource).toMatchObject({
      payrollOwned: {
        openingCumulatives: {
          id: ids.opening,
          status: 'SYNTHETIC_TEST',
          throughPeriod: { year: 2026, month: 9 },
          sourceHash: openingHash,
        },
      },
    })
  })

  it('projects Lisa with no additional hours and an explicitly disabled pension', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot({ lisa: true }), projectionConfig({ lisa: true }))

    expect(amount(result.snapshot)).toBe('5500.00')
    expect(result.provenance).toMatchObject({ additionalHours: '0.0000', additionalCompensationMode: 'NOT_APPLICABLE', pensionStatus: 'DISABLED_BY_SCENARIO' })
    expect(result.controls).toMatchObject({ additionalHoursSupported: true, pensionRuleReady: true })
    expect(result.blockers).toEqual([])
  })

  it('keeps projected hashes stable across retry time while preserving the projection timestamp as provenance', () => {
    const original = sourceSnapshot({ lisa: true })
    const first = projectPayrun01SourceSnapshot(original, {
      ...projectionConfig({ lisa: true }),
      asOf: '2026-10-05T10:00:00.000Z',
      maximumSnapshotAgeMilliseconds: 2 * 60 * 60 * 1000,
    })
    const retried = projectPayrun01SourceSnapshot(original, {
      ...projectionConfig({ lisa: true }),
      asOf: '2026-10-05T10:30:00.000Z',
      maximumSnapshotAgeMilliseconds: 2 * 60 * 60 * 1000,
    })

    expect(retried.snapshot.sourceHash).toBe(first.snapshot.sourceHash)
    expect(retried.provenance.projectedAt).not.toBe(first.provenance.projectedAt)
    expect(JSON.stringify(retried.snapshot.canonicalSource)).not.toContain('projectedAt')
  })

  it('passes confirmed cash compensation to the engine without calculating its amount here', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot(), projectionConfig({ additionalCompensation: 'CASH_AT_ORDINARY_RATE', additionalCashAmount: '37.94' }))

    expect(amount(result.snapshot)).toBeNull()
    expect(result.controls.additionalHoursSupported).toBe(true)
    expect(result.snapshot.canonicalSource).toMatchObject({
      payrollOwned: {
        additionalHoursCashAmount: '37.94',
        actualWorkProjection: {
          additionalHours: '2.0000',
          additionalCompensationMode: 'CASH_AT_ORDINARY_RATE',
          normalHoursPaidSeparately: false,
        },
      },
    })
  })

  it('blocks positive additional hours when the scenario has no compensation agreement', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot(), projectionConfig({ additionalCompensation: 'UNRESOLVED' }))
    const canonical = result.snapshot.canonicalSource as Readonly<Record<string, unknown>>
    const payrollOwned = canonical.payrollOwned as Readonly<Record<string, unknown>>

    expect(result.controls.additionalHoursSupported).toBe(false)
    expect(result.blockers).toContain('PAYRUN01_ADDITIONAL_COMPENSATION_NOT_CONFIRMED')
    expect(payrollOwned).not.toHaveProperty('additionalHoursCashAmount')
  })

  it('accepts an explicit time-off arrangement choice without treating it as extra cash salary', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot(), projectionConfig({ additionalCompensation: 'TIME_OFF' }))

    expect(amount(result.snapshot)).toBeNull()
    expect(result.controls.additionalHoursSupported).toBe(true)
    expect(result.snapshot.canonicalSource).toMatchObject({
      payrollOwned: {
        actualWorkProjection: {
          additionalHours: '2.0000',
          additionalCompensationMode: 'TIME_OFF',
          normalHoursPaidSeparately: false,
        },
      },
    })
  })

  it('preserves source gaps and only resolves the explicitly configured fiscal and DRAFT IKV gaps', () => {
    const original = sourceSnapshot()
    const projected = projectPayrun01SourceSnapshot(original, projectionConfig({ allowIkvFallback: false }))

    expect(projected.snapshot.sourceGaps.slice(0, original.sourceGaps.length)).toEqual(original.sourceGaps)
    expect(projected.controls.sourceReady).toBe(false)
    expect(projected.controls.ikvUnambiguous).toBe(false)
    expect(projected.calculationIncomeRelationshipId).toBeNull()
    expect(projected.blockers).toContain('PAYRUN01_IKV_AMBIGUOUS_OR_UNRESOLVED')
    expect(projected.provenance).toMatchObject({ sourceIncomeRelationshipId: ids.incomeRelationship, calculationIncomeRelationshipId: null })
  })

  it('blocks an ambiguous source IKV even when an explicit fallback exists', () => {
    const original = sourceSnapshot({ gaps: [
      { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
      { field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'INCOME_RELATIONSHIP_AMBIGUOUS' },
    ] })
    const projected = projectPayrun01SourceSnapshot(original, projectionConfig())

    expect(projected.snapshot.sourceIncomeRelationshipId).toBe(ids.incomeRelationship)
    expect(projected.snapshot.sourceGaps.slice(0, original.sourceGaps.length)).toEqual(original.sourceGaps)
    expect(projected.calculationIncomeRelationshipId).toBeNull()
    expect(projected.controls.ikvUnambiguous).toBe(false)
    expect(projected.blockers).toContain('PAYRUN01_IKV_AMBIGUOUS_OR_UNRESOLVED')
  })

  it('rejects a scope mismatch and leaves a stale snapshot explicitly blocked', () => {
    const original = sourceSnapshot()
    const invalidScope = projectionConfig()

    expect(() => projectPayrun01SourceSnapshot(original, {
      ...invalidScope,
      scope: { ...invalidScope.scope, employeeId: 'eeeeeeee-0000-4000-8000-000000000001' },
    })).toThrowError(expect.objectContaining({ code: 'PAYRUN01_SCOPE_MISMATCH' }))
    expect(() => projectPayrun01SourceSnapshot(original, {
      ...invalidScope,
      scope: { ...invalidScope.scope, periodReference: { year: 2026, month: 9 } },
    })).toThrowError(Payrun01SourceProjectionError)

    const stale = projectPayrun01SourceSnapshot(original, {
      ...invalidScope,
      asOf: '2026-10-06T10:00:00.000Z',
      maximumSnapshotAgeMilliseconds: 1,
    })
    expect(stale.controls.sourceFresh).toBe(false)
    expect(stale.blockers).toContain('PAYRUN01_SOURCE_STALE')
  })

  it('blocks unsupported actual-work families and missing CAO/schedule matches', () => {
    const original = sourceSnapshot()
    const canonical = original.canonicalSource as Record<string, unknown>
    const work = canonical.actualWork as { period: unknown; entries: Array<Record<string, unknown>> }
    const unsupported = {
      ...work.entries[0],
      family: 'OVERTIME',
    }
    const changedCanonical = { ...canonical, actualWork: { ...work, entries: [unsupported] } } as PayrollSourceSnapshot['canonicalSource']
    const changed = { ...original, canonicalSource: changedCanonical }
    const unsupportedSnapshot = {
      ...changed,
      sourceHash: hashPayrollSourceSnapshot({
        sourceTenantId: changed.sourceTenantId,
        sourceHrGroupId: changed.sourceHrGroupId,
        sourceAdministrationId: changed.sourceAdministrationId,
        sourceEmployeeId: changed.sourceEmployeeId,
        sourceEmploymentId: changed.sourceEmploymentId,
        sourceIncomeRelationshipId: changed.sourceIncomeRelationshipId,
        periodReference: changed.periodReference,
        canonicalSource: changed.canonicalSource,
        sourceVersionVector: changed.sourceVersionVector,
        sourceGaps: changed.sourceGaps,
      }),
    }
    const projected = projectPayrun01SourceSnapshot(unsupportedSnapshot, projectionConfig())
    const badSalaryConfig = projectionConfig()
    const salaryMismatch = projectPayrun01SourceSnapshot(original, {
      ...badSalaryConfig,
      expectedSchedule: { ...badSalaryConfig.expectedSchedule, contractHoursPerWeek: 36, partTimeFactor: 1 },
    })

    expect(projected.controls.additionalHoursSupported).toBe(false)
    expect(projected.blockers).toContain('PAYRUN01_ACTUAL_WORK_CLASSIFICATION_UNSUPPORTED')
    expect(salaryMismatch.controls.salaryConsistent).toBe(false)
    expect(salaryMismatch.controls.hoursConsistent).toBe(false)
  })

  it('compares salary source amounts as exact decimal money without a tolerance', () => {
    const original = sourceSnapshot()
    const configured = projectionConfig()
    const salaryMismatch = projectPayrun01SourceSnapshot(original, {
      ...configured,
      expectedSalary: { ...configured.expectedSalary, fulltimeMonthlyAmount: '3425.001' },
    })

    expect(salaryMismatch.controls.salaryConsistent).toBe(false)
    expect(salaryMismatch.blockers).toContain('PAYRUN01_SALARY_OR_CAO_MISMATCH')
  })

  it('requires Lisa’s effective source schedule type to match the versioned TEST assignment', () => {
    const original = sourceSnapshot({ lisa: true })
    const configured = projectionConfig({ lisa: true })
    const matched = projectPayrun01SourceSnapshot(original, configured)
    const staleAssignment = projectPayrun01SourceSnapshot(original, {
      ...configured,
      expectedSchedule: { ...configured.expectedSchedule, scheduleType: 'FIXED' },
    })

    expect(matched.controls).toMatchObject({ salaryConsistent: true, hoursConsistent: true })
    expect(staleAssignment.controls).toMatchObject({ salaryConsistent: false, hoursConsistent: false })
    expect(staleAssignment.blockers).toContain('PAYRUN01_SCHEDULE_MISMATCH')
  })

  it('blocks a persona whose source employment starts on a different date', () => {
    const config = projectionConfig()
    const projected = projectPayrun01SourceSnapshot(sourceSnapshot(), {
      ...config,
      expectedEmploymentStartDate: '2026-10-01',
    })

    expect(projected.controls.employmentStartConsistent).toBe(false)
    expect(projected.controls.sourceReady).toBe(false)
    expect(projected.blockers).toContain('PAYRUN01_EMPLOYMENT_START_MISMATCH')
  })
})
