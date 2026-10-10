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
  laborSet: 'd1000000-0000-4000-8000-000000000001',
  structure: 'd2000000-0000-4000-8000-000000000001',
  scale: 'd3000000-0000-4000-8000-000000000001',
  step: 'd4000000-0000-4000-8000-000000000001',
  job: 'd5000000-0000-4000-8000-000000000001',
  department: 'd6000000-0000-4000-8000-000000000001',
}

const configHash = 'a'.repeat(64)
const openingHash = 'b'.repeat(64)

function sourceSnapshot(options: {
  readonly lisa?: boolean
  readonly gaps?: PayrollSourceSnapshot['sourceGaps']
  readonly additionalHours?: string
  readonly includeCoreFlatPension?: boolean
  readonly includeCoreProgressivePension?: boolean
  readonly includeCorePfzwPension?: boolean
  readonly mappingReferenceMismatch?: boolean
} = {}): PayrollSourceSnapshot {
  const lisa = options.lisa ?? false
  const includeCoreProgressivePension = options.includeCoreProgressivePension ?? false
  const includeCorePfzwPension = options.includeCorePfzwPension ?? false
  const canonicalSource = {
    schemaVersion: 'payroll-source-v3',
    employment: { startsOn: lisa ? '2026-01-01' : '2026-09-01', endsOn: null, recordStatus: 'CONFIRMED' },
    compensation: {
      entries: [{
        id: 'd0000000-0000-4000-8000-000000000001',
        salaryBasis: lisa ? 'MANUAL' : 'CUSTOM_SCALE',
        salaryRoute: lisa ? 'MANUAL' : 'SCALE_WITH_STEPS',
        paymentFrequency: 'MONTHLY',
        currencyCode: 'EUR',
        fulltimeAmount: lisa ? 5500 : includeCorePfzwPension ? '3425.00' : 3425,
        parttimeAmount: lisa ? 5500 : 3044.44,
        salaryStructureId: lisa ? null : ids.structure,
        salaryScaleId: lisa ? null : ids.scale,
        salaryScaleStepId: lisa ? null : ids.step,
        salaryStepCode: lisa ? null : '20',
        caoScaleName: null,
        caoStepName: null,
        salaryBandId: null,
        validFrom: lisa ? '2026-01-01' : '2026-09-01',
        validUntil: null,
      }],
    },
    schedule: {
      entries: [{
        averageHoursPerWeek: lisa ? 40 : 32,
        fulltimeHoursPerWeek: lisa ? 40 : 36,
        partTimeFactor: lisa ? 1 : 32 / 36,
        scheduleType: lisa ? 'HOURS_PER_DAY' : 'HOURS_AND_AVG_DAYS',
        isOnCall: false,
        validFrom: lisa ? '2026-01-01' : '2026-09-01',
        validUntil: null,
      }],
    },
    contract: {
      entries: lisa ? [] : [{
        id: 'e0000000-0000-4000-8000-000000000001', laborConditionSetId: ids.laborSet,
        fulltimeHoursPerWeek: 36, validFrom: '2026-09-01', validUntil: null,
      }],
    },
    laborConditions: {
      entries: lisa ? [] : [{
        id: 'e1000000-0000-4000-8000-000000000001', laborConditionSetId: ids.laborSet,
        conditionGroup: 'Cao Kinderopvang 2025-2026',
        set: {
          id: ids.laborSet, code: 'CAO_KINDEROPVANG_2025_2026', name: 'Cao Kinderopvang 2025-2026',
          standardHoursPerWeek: 36, isActive: true, validFrom: '2025-01-01',
        },
        validFrom: '2026-09-01', validUntil: null,
      }],
    },
    organization: {
      entries: lisa ? [] : [{
        id: 'e2000000-0000-4000-8000-000000000001', departmentId: ids.department, jobId: ids.job,
        jobCode: 'PAYRUN01_PEDAGOGISCH_PROFESSIONAL', jobTitle: 'Pedagogisch professional',
        jobRevisionValidFrom: '2026-09-01', jobRevisionValidUntil: null,
        validFrom: '2026-09-01', validUntil: null,
      }],
    },
    incomeRelationship: { id: ids.incomeRelationship, status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING' },
    fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
    ...(options.includeCoreFlatPension || includeCoreProgressivePension || includeCorePfzwPension ? {
      pension: {
        assignments: [{
          id: 'e3000000-0000-4000-8000-000000000001',
          pensionArrangementId: ids.arrangement,
          effectiveFrom: includeCoreProgressivePension ? '2023-01-01' : includeCorePfzwPension ? '2026-09-01' : '2026-01-01',
          effectiveTo: null,
          participationStartDate: includeCoreProgressivePension ? '2018-01-01' : includeCorePfzwPension ? '2026-09-01' : '2026-01-01',
          assignmentVersion: 1,
          supersedesAssignmentId: null,
          assignmentReason: 'EXPLICIT_TEST_ASSIGNMENT',
          provenance: includeCorePfzwPension ? {
            schemaVersion: 'EMPLOYMENT_PENSION_ASSIGNMENT_PROVENANCE_V1',
            status: 'SYNTHETIC_TEST_FIXTURE',
            sourceClassification: 'SYNTHETIC_TEST_FIXTURE — PAY-RULE-002 — FRITS_PFZW_2026',
            assignmentVersion: 1,
            laborConditionMappingId: 'f2000000-0000-4000-8000-000000000001',
            laborConditionMappingVersion: options.mappingReferenceMismatch ? 2 : 1,
            legalFiscalStatus: 'OPEN',
            legalFiscalGap: 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED',
          } : {},
          ageForTier: includeCoreProgressivePension ? 62 : null,
          arrangement: {
            id: ids.arrangement,
            code: includeCoreProgressivePension ? 'COMPANY_LEGACY_PROGRESSIVE_EERBIEDIGD' : includeCorePfzwPension ? 'PFZW_2026_KINDEROPVANG' : 'COMPANY_WTP_FLAT_2026',
            name: includeCoreProgressivePension ? 'Synthetic legacy progressive arrangement' : includeCorePfzwPension ? 'Synthetic PFZW 2026 Kinderopvang arrangement' : 'Synthetic flat arrangement fixture',
            arrangementType: includeCoreProgressivePension ? 'PROGRESSIVE_PREMIUM' : 'FLAT_PREMIUM',
            effectiveFrom: '2026-01-01',
            arrangementEstablishedFrom: includeCoreProgressivePension ? '2023-01-01' : '2026-01-01',
            effectiveTo: null,
            transitionDate: includeCoreProgressivePension ? '2026-01-01' : null,
            grandfatheringMode: includeCoreProgressivePension ? 'EERBIEDIGENDE_WERKING' : 'NONE',
            flatTotalRate: includeCoreProgressivePension ? null : includeCorePfzwPension ? '25.9000' : '15.0000',
            employerSharePercent: includeCorePfzwPension ? '13.0000' : '66.6667',
            employeeSharePercent: includeCorePfzwPension ? '12.9000' : '33.3333',
            annualFranchise: includeCoreProgressivePension ? '15308.00' : includeCorePfzwPension ? '17283.00' : '19172.00',
            annualPensionableSalaryCap: '137800.00',
            pensionableSalaryDefinition: {
              ...(includeCoreProgressivePension ? { ageDetermination: 'AGE_AT_END_OF_CALENDAR_YEAR' } : {}),
              basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE',
              annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
              floorAtZero: true,
              ...(includeCorePfzwPension ? {
                method: 'PFZW_2026_KINDEROPVANG',
                pfzw2026: {
                  monthlyPaymentsPerYear: 12,
                  holidayAllowancePercent: '8',
                  structuralYearEndAllowancePercent: '5.5',
                  structuralYearEndAllowanceReferenceDate: '2025-12-31',
                  structuralYearEndAllowanceSourceReference: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering',
                  structuralYearEndAllowanceSourceVersion: 'CAO Kinderopvang 2025-2026 article 5.7; PFZW article 5.2.4',
                  additionalHoursUpliftPercent: '11.2179487179',
                  additionalHoursUpliftEvidence: 'SYNTHETIC_TEST_ONLY_POLICY',
                  additionalHoursUpliftSourceReference: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantie; https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/verlofbudget; https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
                  additionalHoursUpliftSourceVersion: 'SYNTHETIC_TEST_ONLY_EXTRA_HOURS_UPLIFT',
                  monthlyAllocationPolicyStatus: 'SYNTHETIC_TEST_APPROVED',
                  monthlyAllocationPolicyVersion: 'PFZW-2026-MONTHLY-ALLOCATION-TEST-APPROVED-1',
                  monthlyAllocationPolicySourceReference: 'SYNTHETIC_TEST_POLICY:PAY-RULE-002; annual share divided by 12; separate HALF_UP cent rounding for employee and employer; synthetic TEST acceptance only.',
                },
              } : {}),
            },
            eligibilityRule: includeCoreProgressivePension ? {
              participantGroup: 'GRANDFATHERED', transitionMethod: 'EERBIEDIGENDE_WERKING',
              participationStartBefore: '2026-01-01', ageDetermination: 'AGE_AT_END_OF_CALENDAR_YEAR',
            } : {
              participantGroup: 'NEW_ENTRANT', employmentOrParticipationStartOnOrAfter: '2026-01-01',
            },
            contractClassification: includeCoreProgressivePension ? 'NON_SOLIDARITY' : 'UNKNOWN',
            contractClassificationProvenance: includeCoreProgressivePension
              ? { status: 'SYNTHETIC_TEST_ASSUMPTION_UNVERIFIED' } : { status: 'UNVERIFIED' },
            provenance: { sourceReference: 'TEST_ONLY_APPROVED_COMPANY_POLICY' },
            isActive: true,
            versionId: 'f1000000-0000-4000-8000-000000000001',
            versionNumber: includeCoreProgressivePension ? 2 : 1,
            version: 'f1000000-0000-4000-8000-000000000001',
            tiers: includeCoreProgressivePension ? [{ minAge: 60, maxAge: 64, totalRate: '20.0000' }] : [],
          },
          arrangementResolutionReason: null,
          arrangementResolutionChangeVersionIds: [],
        }],
        laborConditionArrangements: includeCorePfzwPension ? [{
          id: 'f2000000-0000-4000-8000-000000000001',
          laborConditionSetId: ids.laborSet,
          pensionArrangementId: ids.arrangement,
          participantGroup: 'NEW_ENTRANT',
          effectiveFrom: '2026-09-01',
          effectiveTo: null,
          mappingVersion: 1,
          supersedesMappingId: null,
          provenance: {
            schemaVersion: 'PENSION_MAPPING_PROVENANCE_V1',
            status: 'SYNTHETIC_TEST_FIXTURE',
            sourceClassification: 'SYNTHETIC_TEST_FIXTURE — PAY-RULE-002 — FRITS_PFZW_2026',
          },
          arrangementResolutionReason: null,
          arrangementResolutionChangeVersionIds: [],
        }] : [],
      },
    } : {}),
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
          hours: options.additionalHours ?? '2.0000',
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
  readonly expectedAdditionalHours?: number
  readonly expectedAdditionalEntryCount?: number
  readonly requireCorePension?: boolean
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
    ...(!lisa ? {
      expectedLaborConditionSetId: ids.laborSet,
      expectedLaborConditionSetCode: 'CAO_KINDEROPVANG_2025_2026',
      expectedLaborConditionSetName: 'Cao Kinderopvang 2025-2026',
      expectedJobCode: 'PAYRUN01_PEDAGOGISCH_PROFESSIONAL',
      expectedJobTitle: 'Pedagogisch professional',
    } : {}),
    expectedSalary: lisa
      ? {
        pricingMode: 'SOURCE_MONTHLY', monthlyGrossAmount: '5500.00', fulltimeMonthlyAmount: '5500.00',
        currencyCode: 'EUR', paymentFrequency: 'MONTHLY', salaryRoute: 'MANUAL', salaryBasis: 'MANUAL',
      }
      : {
        pricingMode: 'CAO_PRORATION', fulltimeMonthlyAmount: '3425.00', currencyCode: 'EUR',
        paymentFrequency: 'MONTHLY', salaryRoute: 'SCALE_WITH_STEPS', salaryBasis: 'CUSTOM_SCALE',
        salaryStructureId: ids.structure, salaryScaleId: ids.scale, salaryScaleStepId: ids.step,
        salaryStepCode: '20', caoScaleName: null, caoStepName: null, salaryBandId: null,
      },
    expectedSchedule: lisa
      ? { contractHoursPerWeek: 40, fulltimeHoursPerWeek: 40, partTimeFactor: 1, scheduleType: 'HOURS_PER_DAY', isOnCall: false }
      : { contractHoursPerWeek: 32, fulltimeHoursPerWeek: 36, partTimeFactor: 32 / 36, scheduleType: 'HOURS_AND_AVG_DAYS', isOnCall: false },
    taxProfile: {
      ...(!lisa ? {
        profileId: 'PAYRUN01_KINDEROPVANG_TEST_TAX_PROFILE', profileVersion: '1',
        provenance: 'PAYROLL_OWNED_BOUNDED_TEST_INPUT', effectiveFrom: '2026-09-01',
      } : {}),
      fiscalYear: '2026', table: 'WHITE', residence: 'NL', ageCategory: 'UNDER_AOW', herleiding: 'STD',
      timePeriod: 'MONTH', payrollTaxCredit: true, regularWage: true, fullPeriod: true, hasSpecialSituation: false,
    },
    calculationIncomeRelationshipId: ids.incomeRelationship,
    incomeRelationshipFallbackReasonCodes: options.allowIkvFallback === false ? [] : ['CONTROL02_CONTRACT_PENDING'],
    additionalHourCompensation: options.additionalCompensation === 'UNRESOLVED'
      ? { mode: 'UNRESOLVED' }
      : options.additionalCompensation === 'CASH_AT_ORDINARY_RATE'
        ? {
          mode: 'CASH_AT_ORDINARY_RATE',
          ...(options.expectedAdditionalHours === undefined ? {} : { expectedHours: options.expectedAdditionalHours }),
          ...(options.expectedAdditionalEntryCount === undefined ? {} : { expectedEntryCount: options.expectedAdditionalEntryCount }),
        }
        : { mode: 'TIME_OFF' },
    pension: lisa
      ? { mode: 'DISABLED' }
      : options.requireCorePension
        ? { mode: 'CORE_ARRANGEMENT' }
        : { mode: 'UNSUPPORTED', reasonCode: 'PAYRUN01_PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED' },
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
  it('blocks PFZW projection when no effective participant assignment exists', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot(), projectionConfig({ requireCorePension: true }))
    const canonical = result.snapshot.canonicalSource as Readonly<Record<string, unknown>>
    const payrollOwned = canonical.payrollOwned as Readonly<Record<string, unknown>>

    expect(result.controls.pensionRuleReady).toBe(false)
    expect(payrollOwned.pension).toMatchObject({ status: 'BLOCKED', reasonCode: 'PENSION_ASSIGNMENT_NOT_FOUND' })
    expect(JSON.stringify(payrollOwned)).not.toContain('employeePension')
    expect(JSON.stringify(payrollOwned)).not.toContain('employerPension')
  })

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
      payrollOwned: {
        taxProfile: {
          profileId: 'PAYRUN01_KINDEROPVANG_TEST_TAX_PROFILE',
          profileVersion: '1',
          provenance: 'PAYROLL_OWNED_BOUNDED_TEST_INPUT',
          effectiveFrom: '2026-09-01',
          status: 'PAYROLL_OWNED_SCENARIO',
        },
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

  it('includes the bounded PAYRUN01 tax profile in the projected source hash', () => {
    const original = sourceSnapshot()
    const baseConfig = projectionConfig()
    const initial = projectPayrun01SourceSnapshot(original, baseConfig)
    const changed = projectPayrun01SourceSnapshot(original, {
      ...baseConfig,
      taxProfile: { ...baseConfig.taxProfile, profileVersion: '2' },
    })

    expect(changed.snapshot.sourceHash).not.toBe(initial.snapshot.sourceHash)
  })

  it('projects Lisa with no additional hours and an explicitly disabled pension', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot({ lisa: true }), projectionConfig({ lisa: true }))

    expect(amount(result.snapshot)).toBe('5500.00')
    expect(result.provenance).toMatchObject({ additionalHours: '0.0000', additionalCompensationMode: 'NOT_APPLICABLE', pensionStatus: 'DISABLED_BY_SCENARIO' })
    expect(result.controls).toMatchObject({ additionalHoursSupported: true, pensionRuleReady: true })
    expect(result.blockers).toEqual([])
  })

  it('resolves an effective Core flat arrangement into pension amounts and fiscal assessment bases', () => {
    const source = sourceSnapshot({ lisa: true, includeCoreFlatPension: true })
    const projection = projectionConfig({ lisa: true })
    const result = projectPayrun01SourceSnapshot(source, {
      ...projection,
      pension: { mode: 'CORE_ARRANGEMENT' },
    })
    const canonical = result.snapshot.canonicalSource as Readonly<Record<string, unknown>>
    const payrollOwned = canonical.payrollOwned as Readonly<Record<string, unknown>>
    const amounts = payrollOwned.amounts as Readonly<Record<string, unknown>>
    const fiscalBases = payrollOwned.fiscalBases as Readonly<Record<string, unknown>>
    const pension = payrollOwned.pension as Readonly<Record<string, unknown>>
    const pensionResult = pension.result as Readonly<Record<string, unknown>>

    expect(result.controls.pensionRuleReady).toBe(true)
    expect(result.blockers).toEqual([])
    expect(amounts).toMatchObject({ employeePension: '195.12', employerPension: '390.23' })
    expect(fiscalBases).toMatchObject({
      wageTax: '5304.88', employeeInsurance: '5304.88', zvw: '5304.88',
      status: 'CALCULATED_FROM_PENSION_RULE',
    })
    expect(pension).toMatchObject({ status: 'CALCULATED', reasonCode: null })
    expect(pensionResult).toMatchObject({
      arrangementCode: 'COMPANY_WTP_FLAT_2026',
      rate: '15.0000',
      pensionableBase: '46828.00',
      totalPremiumMonthly: '585.35',
      employeePremiumMonthly: '195.12',
      employerPremiumMonthly: '390.23',
      allocationDifference: '0.00',
    })
    expect(payrollOwned.pensionCalculationInput).toMatchObject({
      arrangement: { arrangementCode: 'COMPANY_WTP_FLAT_2026' },
      fullTimeMonthlyPensionableSalary: '5500',
      partTimeFactor: '1',
    })
    expect(payrollOwned.pensionCalculationTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({ componentCode: 'PENSION_PENSIONABLE_BASE' }),
      expect.objectContaining({ componentCode: 'PENSION_EMPLOYEE_SHARE' }),
      expect.objectContaining({ componentCode: 'PENSION_EMPLOYER_SHARE' }),
    ]))
  })

  it('uses immutable arrangement inception when a later effective version is selected for grandfathering', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot({
      lisa: true,
      includeCoreProgressivePension: true,
    }), {
      ...projectionConfig({ lisa: true }),
      pension: { mode: 'CORE_ARRANGEMENT' },
    })
    const canonical = result.snapshot.canonicalSource as Readonly<Record<string, unknown>>
    const payrollOwned = canonical.payrollOwned as Readonly<Record<string, unknown>>
    const pension = payrollOwned.pension as Readonly<Record<string, unknown>>

    expect(result.controls.pensionRuleReady).toBe(true)
    expect(result.blockers).toEqual([])
    expect(pension).toMatchObject({ status: 'CALCULATED', reasonCode: null })
    expect(payrollOwned.pensionCalculationInput).toMatchObject({
      arrangement: {
        effectiveFrom: '2026-01-01',
        arrangementEstablishedFrom: '2023-01-01',
      },
      participationStartDate: '2018-01-01',
    })
    expect(payrollOwned.pensionCalculationTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentCode: 'PENSION_AGE_TIER_RATE',
        inputs: expect.objectContaining({
          arrangementEstablishedFrom: '2023-01-01',
          versionEffectiveFrom: '2026-01-01',
        }),
      }),
    ]))
  })

  it('projects the versioned PFZW TEST allocation and uplift policy into the pension calculation', () => {
    const source = sourceSnapshot({ includeCorePfzwPension: true, additionalHours: '8.0000' })
    const result = projectPayrun01SourceSnapshot(source, projectionConfig({
      requireCorePension: true,
      additionalCompensation: 'CASH_AT_ORDINARY_RATE',
      expectedAdditionalHours: 8,
      expectedAdditionalEntryCount: 1,
    }))
    const canonical = result.snapshot.canonicalSource as Readonly<Record<string, unknown>>
    const payrollOwned = canonical.payrollOwned as Readonly<Record<string, unknown>>
    const pension = payrollOwned.pension as Readonly<Record<string, unknown>>
    const pensionResult = pension.result as Readonly<Record<string, unknown>>
    const pensionInput = payrollOwned.pensionCalculationInput as Readonly<Record<string, unknown>>

    expect(pension).toMatchObject({ status: 'CALCULATED', reasonCode: null })
    expect(pensionResult).toMatchObject({
      arrangementCode: 'PFZW_2026_KINDEROPVANG',
      pensionableBase: '27780.24',
      employeePremiumMonthly: '298.64',
      employerPremiumMonthly: '300.95',
    })
    expect(pensionInput).toMatchObject({
      pfzw2026: {
        participationStartDate: '2026-09-01',
        participationStatus: 'SYNTHETIC_TEST_FIXTURE',
        participationEvidenceReference: expect.stringContaining(
          `Core assignment e3000000-0000-4000-8000-000000000001 v1 [SYNTHETIC_TEST_FIXTURE — PAY-RULE-002 — FRITS_PFZW_2026]; effective labor-condition arrangement mapping f2000000-0000-4000-8000-000000000001 v1 [SYNTHETIC_TEST_FIXTURE — PAY-RULE-002 — FRITS_PFZW_2026]`,
        ),
        additionalWorkedHours: '8.0000',
        additionalHoursUpliftPercent: '11.2179487179',
        additionalHoursUpliftEvidence: 'SYNTHETIC_TEST_ONLY_POLICY',
        additionalHoursUpliftSourceVersion: 'SYNTHETIC_TEST_ONLY_EXTRA_HOURS_UPLIFT',
        calculationPolicy: {
          status: 'SYNTHETIC_TEST_APPROVED',
          version: 'PFZW-2026-MONTHLY-ALLOCATION-TEST-APPROVED-1',
          sourceReference: expect.stringContaining('SYNTHETIC_TEST_POLICY:PAY-RULE-002;'),
        },
      },
    })
  })

  it('blocks PFZW when the assignment does not point to the effective mapping version', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot({
      includeCorePfzwPension: true,
      mappingReferenceMismatch: true,
    }), projectionConfig({ requireCorePension: true }))

    expect(result.controls.pensionRuleReady).toBe(false)
    expect(result.snapshot.canonicalSource).toMatchObject({
      payrollOwned: {
        pension: { status: 'BLOCKED', reasonCode: 'PENSION_PARTICIPATION_PROVENANCE_GAP' },
      },
    })
  })

  it('keeps the PFZW source gap as a warning boundary while excluding pension amounts from the functional calculation', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot(), {
      ...projectionConfig(),
      pension: { mode: 'EXCLUDED_SOURCE_GAP', reasonCode: 'PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED' },
    })

    expect(result.controls.pensionRuleReady).toBe(false)
    expect(result.blockers).not.toContain('PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED')
    expect(result.snapshot.canonicalSource).toMatchObject({
      payrollOwned: {
        pension: { status: 'EXCLUDED_SOURCE_GAP', reasonCode: 'PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED' },
        amounts: {},
      },
    })
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

  it('passes approved ordinary-rate hours to the engine so it calculates the cash amount', () => {
    const result = projectPayrun01SourceSnapshot(sourceSnapshot(), projectionConfig({ additionalCompensation: 'CASH_AT_ORDINARY_RATE' }))

    expect(amount(result.snapshot)).toBeNull()
    expect(result.controls.additionalHoursSupported).toBe(true)
    expect(result.snapshot.canonicalSource).toMatchObject({
      payrollOwned: {
        actualWorkProjection: {
          additionalHours: '2.0000',
          cashCompensatedHours: '2.0000',
          additionalCompensationMode: 'CASH_AT_ORDINARY_RATE',
          normalHoursPaidSeparately: false,
        },
      },
    })
  })

  it('requires exactly eight approved hours when the fixture pins one additional-hour event', () => {
    const exactSource = sourceSnapshot({ additionalHours: '8.0000' })
    const exact = projectPayrun01SourceSnapshot(exactSource, projectionConfig({
      additionalCompensation: 'CASH_AT_ORDINARY_RATE',
      expectedAdditionalHours: 8,
      expectedAdditionalEntryCount: 1,
    }))
    const mismatched = projectPayrun01SourceSnapshot(sourceSnapshot(), projectionConfig({
      additionalCompensation: 'CASH_AT_ORDINARY_RATE',
      expectedAdditionalHours: 8,
      expectedAdditionalEntryCount: 1,
    }))

    expect(exact.controls.additionalHoursSupported).toBe(true)
    expect(exact.snapshot.canonicalSource).toMatchObject({
      payrollOwned: { actualWorkProjection: { additionalHours: '8.0000', cashCompensatedHours: '8.0000' } },
    })
    expect(mismatched.controls.additionalHoursSupported).toBe(false)
    expect(mismatched.blockers).toContain('PAYRUN01_ADDITIONAL_HOURS_FIXTURE_MISMATCH')
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
          cashCompensatedHours: '0.0000',
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
