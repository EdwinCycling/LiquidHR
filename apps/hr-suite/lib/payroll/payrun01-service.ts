import 'server-only'

import { createHash } from 'node:crypto'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollSourceProvider,
} from '@liquid-hr/payroll-engine'
import {
  createPayrun01RulePackage,
  PAYRUN01_RULE_REGISTRY,
  type Payrun01CompositionKind,
} from '@liquid-hr/payroll-rules-nl-2026'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createPayrollCalculationRepository, PayrollCalculationRepositoryError, type PayrollCalculationRepository } from './calculation-repository'
import type { PayrollJson } from './database'
import { isPayrollLabEnabled } from './feature-flag'
import type { SyntheticPayrollPeriod } from './synthetic-source'
import {
  createLiquidHrPayrollSourceProvider,
  type PayrollSourceProviderDependencies,
} from './source/liquid-hr-source-provider'
import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import type { PayrollScope } from './scope'
import {
  createPayrun01Repository,
  type Payrun01Repository,
} from './payrun01-repository'
import { deriveKinderopvangOpeningBalance, type Payrun01OpeningBalance, type Payrun01PriorRunEvidence } from './payrun01-cumulative'
import { renderPayrun01PayslipPdf, type Payrun01PayslipPdfInput } from './payrun01-payslip-pdf'
import {
  projectPayrun01SourceSnapshot,
  type Payrun01AdditionalHourCompensation,
  type Payrun01SourceProjectionConfig,
} from './payrun01-source-projection'
import {
  createSyntheticPayrollService,
  SyntheticPayrollServiceError,
  type PayrollCalculationContext,
  type PayrollTestScenario,
  type SyntheticPayrollView,
} from './synthetic-calculation-service'
import { requireComponentLibraryAccess } from './component-library-access'
import { PAYRUN01_KINDEROPVANG_TEST } from './payrun01-kinderopvang-identity'

export const PAYRUN01_PERIOD: SyntheticPayrollPeriod = Object.freeze({ year: 2026, month: 10 })
export const PAYRUN01_PERIOD_START = '2026-10-01'
export const PAYRUN01_PERIOD_END = '2026-10-31'
export const PAYRUN01_ACCEPTANCE_PERIODS = Object.freeze([
  Object.freeze({ year: 2026, month: 9 }),
  PAYRUN01_PERIOD,
] satisfies readonly SyntheticPayrollPeriod[])
export type Payrun01PeriodKey = '2026-09' | '2026-10'

export function payrun01CalculationConfigEffectiveRange(
  kind: Payrun01CompositionKind,
  period: SyntheticPayrollPeriod,
  sourceEffectiveFrom: string,
): { readonly effectiveFrom: string; readonly effectiveTo: string | null } {
  if (kind === 'KINDEROPVANG_TEST' && period.year === 2026 && period.month === 10) {
    return { effectiveFrom: PAYRUN01_PERIOD_START, effectiveTo: PAYRUN01_PERIOD_END }
  }
  return { effectiveFrom: sourceEffectiveFrom, effectiveTo: null }
}

export const PAYRUN01_SCENARIO_OPTIONS = Object.freeze([
  { value: 'KINDEROPVANG_TEST', label: 'Frits — Kinderopvang TEST-persona' },
  { value: 'DEMO_COMPANY_TEST', label: 'Lisa — LiquidHR demo-bedrijfsregeling (TEST-only)' },
  { value: 'LEGACY_COMPANY_TEST', label: 'Jaap — synthetic legacy company policy TEST-persona' },
] as const)

const PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID: Readonly<Record<string, Payrun01CompositionKind>> = Object.freeze({
  [PAYRUN01_KINDEROPVANG_TEST.employeeId]: 'KINDEROPVANG_TEST',
  '64ad3a23-f59a-4ed0-af41-26dda20ff067': 'DEMO_COMPANY_TEST',
  'dd9bde02-76bb-4f7c-8add-db544a148f3f': 'LEGACY_COMPANY_TEST',
})

const PAYRUN01_PROVENANCE_SOURCE = 'PAYRUN01 TEST PERSONA ASSIGNMENT'
const SOURCE_MAX_AGE_MS = 5 * 60 * 1000
const EMPLOYER_RATE_SOURCES = Object.freeze({
  awf: 'Belastingdienst 2026 Table 9: high AWf rate 7.74%; explicit TEST assumption for a fixed-term payroll case.',
  aof: 'Belastingdienst 2026 Table 9: low Aof rate 6.27%; explicit TEST assumption of a small employer.',
  wko: 'Belastingdienst 2026 Table 9: Wko surcharge 0.50% on the Aof wage base.',
  whk: 'Belastingdienst 2026 Table 10, small employers, sector 35: total Whk 1.81%.',
  zvw: 'Belastingdienst 2026 Table 12: employer Zvw levy 6.10%.',
})

export type Payrun01Candidate = {
  readonly employeeId: string
  readonly employeeNumber: string
  readonly firstName: string
  readonly confirmedEmploymentCount: number
  readonly scenarioKind: Payrun01CompositionKind
}

export interface Payrun01ServiceDependencies {
  readonly payrollRepository: PayrollCalculationRepository
  readonly payrunRepository: Payrun01Repository
  readonly sourceProvider: PayrollSourceProvider
  readonly enabled: () => boolean
  readonly now?: () => Date
}

type Payrun01RunInput = {
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
  readonly actorUserId: string
  readonly employeeId: string
  readonly kind: Payrun01CompositionKind
  readonly period?: SyntheticPayrollPeriod
}

export type Payrun01LifecycleInput = Payrun01RunInput & { readonly runId: string }

type PersistedPayrun01Versions = {
  readonly assignmentVersionId: string
  readonly assignmentVersionNumber: number
  readonly assignmentHash: string
  readonly configVersionId: string
  readonly configHash: string
  readonly configVersionNumber: number
  readonly supersedesConfigVersionNumber: number | null
  readonly supersedesConfigVersionId: string | null
  readonly correctionReasonCode: string | null
  readonly sourceSnapshotId: string
  readonly compositionSnapshotId: string
  readonly compositionHash: string
  readonly openingCumulativeSnapshotId: string
  readonly openingCumulativeHash: string
  readonly calculationIncomeRelationshipId: string
  readonly asOfDate: string
  readonly sourceSnapshotHash: string
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function deterministicUuid(name: string): string {
  // UUIDv5 in one private, source-independent namespace. The result is only a
  // Payroll assignment key; the Core employment UUID remains separately pinned.
  const namespace = Buffer.from('4c485250415952554e30310000000001', 'hex')
  const digest = createHash('sha1').update(Buffer.concat([namespace, Buffer.from(name, 'utf8')])).digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function derivePayrun01SourceSnapshotId(input: {
  readonly scope: PayrollScope
  readonly employeeId: string
  readonly sourceEmploymentId: string
  readonly period: SyntheticPayrollPeriod
  readonly sourceHash: string
  readonly scenarioKind: Payrun01CompositionKind
  readonly scenarioConfiguration: unknown
  readonly rulePackageIdentity: unknown
  readonly taxProfile: unknown
}): string {
  const projectionIdentityHash = sha256(stableSerialize({
    schemaVersion: 'PAYRUN01_SOURCE_SNAPSHOT_IDENTITY_V3',
    scenarioKind: input.scenarioKind,
    scenarioConfiguration: input.scenarioConfiguration,
    rulePackageIdentity: input.rulePackageIdentity,
    taxProfile: input.taxProfile,
  }))
  return deterministicUuid([
    'payrun01-source-snapshot:v3',
    input.scope.tenantId,
    input.scope.hrGroupId,
    input.scope.administrationId,
    input.employeeId,
    input.sourceEmploymentId,
    `${input.period.year}-${String(input.period.month).padStart(2, '0')}`,
    input.sourceHash,
    projectionIdentityHash,
  ].join(':'))
}

function scenarioKey(kind: Payrun01CompositionKind): 'KINDEROPVANG_TEST' | 'DEMO_COMPANY_TEST' | 'LEGACY_COMPANY_TEST' {
  if (kind === 'KINDEROPVANG_TEST' || kind === 'DEMO_COMPANY_TEST' || kind === 'LEGACY_COMPANY_TEST') return kind
  throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
}

export function payrun01ScenarioForTestPersona(employeeId: string): Payrun01CompositionKind | null {
  return PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID[employeeId] ?? null
}

export function isPayrun01AcceptancePeriod(kind: Payrun01CompositionKind, period: SyntheticPayrollPeriod): boolean {
  if (period.year !== 2026) return false
  if (kind === 'DEMO_COMPANY_TEST' || kind === 'LEGACY_COMPANY_TEST') return period.month === 10
  return period.month === 9 || period.month === 10
}

export function payrun01PeriodFromKey(value: string, kind: Payrun01CompositionKind): SyntheticPayrollPeriod | null {
  const match = /^(2026)-(09|10)$/.exec(value)
  if (!match) return null
  const period = { year: Number(match[1]), month: Number(match[2]) }
  return isPayrun01AcceptancePeriod(kind, period) ? period : null
}

export function payrun01PeriodKey(period: SyntheticPayrollPeriod): Payrun01PeriodKey {
  if (!isPayrun01AcceptancePeriod('KINDEROPVANG_TEST', period)) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  return `${period.year}-${String(period.month).padStart(2, '0')}` as Payrun01PeriodKey
}

function periodStartDate(period: SyntheticPayrollPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function periodEndDate(period: SyntheticPayrollPeriod): string {
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()
  return `${period.year}-${String(period.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function personaConfiguration(kind: Payrun01CompositionKind) {
  if (kind === 'KINDEROPVANG_TEST') {
    return {
      version: 4,
      startDate: '2026-09-01',
      expectedLaborConditionSetId: PAYRUN01_KINDEROPVANG_TEST.laborConditionSetId,
      expectedLaborConditionSetCode: PAYRUN01_KINDEROPVANG_TEST.laborConditionSetCode,
      expectedLaborConditionSetName: PAYRUN01_KINDEROPVANG_TEST.laborConditionSetName,
      expectedJobCode: PAYRUN01_KINDEROPVANG_TEST.jobCode,
      expectedJobTitle: PAYRUN01_KINDEROPVANG_TEST.jobTitle,
      arrangementName: 'PAYRUN01 TEST PERSONA ASSIGNMENT — CAO Kinderopvang',
      pricingMode: 'CAO_PRORATION' as const,
      expectedSalary: {
        pricingMode: 'CAO_PRORATION' as const,
        fulltimeMonthlyAmount: '3425.00',
        currencyCode: 'EUR',
        paymentFrequency: 'MONTHLY',
        salaryRoute: 'SCALE_WITH_STEPS',
        salaryBasis: 'CUSTOM_SCALE',
        salaryStructureId: PAYRUN01_KINDEROPVANG_TEST.salaryStructureId,
        salaryScaleId: PAYRUN01_KINDEROPVANG_TEST.salaryScaleId,
        salaryScaleStepId: PAYRUN01_KINDEROPVANG_TEST.salaryScaleStepId,
        salaryStepCode: PAYRUN01_KINDEROPVANG_TEST.salaryStepCode,
        caoScaleName: null,
        caoStepName: null,
      },
      expectedSchedule: {
        contractHoursPerWeek: 32,
        fulltimeHoursPerWeek: 36,
        partTimeFactor: 32 / 36,
        scheduleType: 'HOURS_AND_AVG_DAYS',
        isOnCall: false,
      },
      payslipProfile: {
        status: 'SYNTHETIC_TEST_PROFILE',
        employerName: 'Kinderopvang TEST (PAYRUN01)',
        employeeName: 'Frits Jansen',
        writtenContract: true,
        isOnCall: false,
        contractHoursPerWeek: 32,
        fulltimeHoursPerWeek: 36,
        minimumHourlyWage: '14.99',
        minimumHourlyWageEffectiveFrom: '2026-07-01',
        minimumHourlyWageAgeCategory: 'AGE_21_PLUS',
        source: 'Core employment timeline for contract type; synthetic PAYRUN01 presentation fields for remaining payslip metadata.',
      },
      pension: { mode: 'EXCLUDED_SOURCE_GAP' as const, reasonCode: 'PFZW_2026_MONTHLY_ALLOCATION_AND_NEW_JOINER_BASIS_UNVERIFIED' },
      reserveRates: { holidayAllowance: '8.00', yearEnd: '8.00' },
      functionAssignment: {
        function: 'Pedagogisch professional',
        scale: '6',
        step: '20',
        fulltimeMonthlySalary: '3425.00',
        officialSource: 'CAO Kinderopvang 2025-2026, function matrix and salary table effective 2026-09-01.',
        officialRuleData: {
          functionToScale: 'Pedagogisch professional → salary scale 6',
          fulltimeHoursPerWeek: 36,
          salaryEffectiveFrom: '2026-09-01',
          fulltimeMonthlySalary: '3425.00',
          holidayAllowanceRate: '8.00',
          yearEndAllowanceRate: '8.00',
        },
        syntheticPersonaChoices: {
          salaryStepCode: '20',
          contractHoursPerWeek: 32,
          scheduleType: 'HOURS_AND_AVG_DAYS',
          annualHoursSystem: 'OFF',
          taxYear: '2026',
          payrollTaxCredit: true,
          pensionTreatment: 'PFZW_SOURCE_GAP_EXCLUDED_FROM_FUNCTIONAL_TEST',
        },
        personaChoices: ['salaryStepCode', 'contractHoursPerWeek', 'effectiveDate', 'scheduleDistribution', 'taxProfile', 'pfzwDisclosure'],
      },
    }
  }

  if (kind === 'DEMO_COMPANY_TEST') {
    return {
      version: 5,
      startDate: '2026-01-01',
      arrangementName: 'TEST-ONLY LIQUIDHR DEMO COMPANY ARRANGEMENT',
      pricingMode: 'SOURCE_MONTHLY' as const,
      expectedSalary: {
        pricingMode: 'SOURCE_MONTHLY' as const,
        monthlyGrossAmount: '5500.00',
        fulltimeMonthlyAmount: '5500.00',
        currencyCode: 'EUR',
        paymentFrequency: 'MONTHLY',
        salaryRoute: 'MANUAL',
        salaryBasis: 'MANUAL',
        salaryScaleId: null,
        salaryScaleStepId: null,
        salaryStepCode: null,
        caoScaleName: null,
        caoStepName: null,
        salaryBandId: null,
      },
      expectedSchedule: {
        contractHoursPerWeek: 40,
        fulltimeHoursPerWeek: 40,
        partTimeFactor: 1,
        scheduleType: 'HOURS_PER_DAY',
        isOnCall: false,
      },
      opening: {
        grossWage: '49500.00',
        holidayReserve: '3960.00',
        yearEndReserve: '0.00',
        note: 'Synthetic TEST opening balance for January-September at €5,500/month and an 8% holiday reserve; not reconstructed payroll.',
      },
      payslipProfile: {
        status: 'SYNTHETIC_TEST_PROFILE',
        employerName: 'LiquidHR Demo Company TEST',
        employeeName: 'Lisa TEST',
        writtenContract: true,
        isOnCall: false,
        contractHoursPerWeek: 40,
        fulltimeHoursPerWeek: 40,
        minimumHourlyWage: '14.99',
        minimumHourlyWageEffectiveFrom: '2026-07-01',
        minimumHourlyWageAgeCategory: 'AGE_21_PLUS',
        source: 'Core employment timeline for contract type; synthetic PAYRUN01 presentation fields for remaining payslip metadata.',
      },
      pension: { mode: 'CORE_ARRANGEMENT' as const },
      reserveRates: { holidayAllowance: '8.00', yearEnd: '0.00' },
      functionAssignment: {
        function: 'No CAO scale; freely negotiated test arrangement.',
        scale: null,
        step: null,
        fulltimeMonthlySalary: '5500.00',
        officialSource: null,
        personaChoices: ['monthlyGrossAmount', 'contractHoursPerWeek', 'effectiveDate'],
      },
    }
  }

  if (kind === 'LEGACY_COMPANY_TEST') {
    return {
      version: 2,
      startDate: '2018-01-01',
      expectedLaborConditionSetCode: 'COMPANY',
      expectedLaborConditionSetName: 'Bedrijfseigen regeling',
      expectedJobCode: 'J3-UNSCOPED',
      expectedJobTitle: 'Algemeen project',
      arrangementName: 'SYNTHETIC COMPANY LEGACY PENSION POLICY — TEST',
      pricingMode: 'SOURCE_MONTHLY' as const,
      expectedSalary: {
        pricingMode: 'SOURCE_MONTHLY' as const,
        monthlyGrossAmount: '6750.00',
        fulltimeMonthlyAmount: '6750.00',
        currencyCode: 'EUR',
        paymentFrequency: 'MONTHLY',
        salaryRoute: 'MANUAL',
        salaryBasis: 'MANUAL',
        salaryStructureId: null,
        salaryScaleId: null,
        salaryScaleStepId: null,
        salaryStepCode: null,
        caoScaleName: null,
        caoStepName: null,
        salaryBandId: null,
      },
      expectedSchedule: {
        contractHoursPerWeek: 40,
        fulltimeHoursPerWeek: 40,
        partTimeFactor: 1,
        scheduleType: 'HOURS_AND_SPECIFIC_DAYS',
        isOnCall: false,
      },
      opening: {
        grossWage: '60750.00',
        holidayReserve: '4860.00',
        yearEndReserve: '0.00',
        note: 'Synthetic TEST opening balance for January-September 2026: assumed unchanged monthly gross of €6,750, 8% holiday reserve and 0% year-end reserve. This is not reconstructed payroll history.',
      },
      payslipProfile: {
        status: 'SYNTHETIC_TEST_PROFILE',
        employerName: 'Jupiter BV (TEST)',
        employeeName: 'Jaap van Dijk',
        writtenContract: true,
        isOnCall: false,
        contractHoursPerWeek: 40,
        fulltimeHoursPerWeek: 40,
        minimumHourlyWage: '14.99',
        minimumHourlyWageEffectiveFrom: '2026-07-01',
        minimumHourlyWageAgeCategory: 'AGE_21_PLUS',
        source: 'Core employment timeline plus explicitly versioned synthetic PAYRUN01 TEST presentation and fiscal assumptions.',
      },
      pension: {
        mode: 'CORE_ARRANGEMENT' as const,
        fiscalTreatmentReady: false,
        fiscalTreatmentReasonCode: 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED',
      },
      reserveRates: { holidayAllowance: '8.00', yearEnd: '0.00' },
      functionAssignment: {
        function: 'Algemeen project',
        scale: null,
        step: null,
        fulltimeMonthlySalary: '6750.00',
        officialSource: null,
        personaChoices: ['syntheticFunctionPlaceholder', 'monthlyGrossAmount', 'contractHoursPerWeek', 'taxProfile', 'openingCumulatives'],
      },
    }
  }

  throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
}

function rulePackageForScenario(kind: Payrun01CompositionKind) {
  const pension = personaConfiguration(kind).pension
  const pensionCalculation = pension.mode === 'CORE_ARRANGEMENT'
    ? 'INCLUDED'
    : 'EXCLUDED'
  const pensionCompliance = 'fiscalTreatmentReady' in pension && pension.fiscalTreatmentReady === false
    ? 'TEST_ONLY_UNVERIFIED'
    : 'VERIFIED'
  return createPayrun01RulePackage(kind, { pensionCalculation, pensionCompliance })
}

function makeTaxProfile(kind: Payrun01CompositionKind): Payrun01SourceProjectionConfig['taxProfile'] {
  const profile: Omit<Payrun01SourceProjectionConfig['taxProfile'], 'profileId' | 'profileVersion' | 'provenance' | 'effectiveFrom'> = {
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
  }
  if (kind === 'KINDEROPVANG_TEST') {
    return {
      ...profile,
      profileId: 'PAYRUN01_KINDEROPVANG_TEST_TAX_PROFILE',
      profileVersion: '1',
      provenance: 'PAYROLL_OWNED_BOUNDED_TEST_INPUT',
      effectiveFrom: PAYRUN01_KINDEROPVANG_TEST.effectiveOn,
    }
  }
  if (kind === 'LEGACY_COMPANY_TEST') {
    return {
      ...profile,
      payrollTaxCredit: false,
      profileId: 'PAYRUN01_LEGACY_COMPANY_TEST_TAX_PROFILE',
      profileVersion: '1',
      provenance: 'USER_SPECIFIED_BOUNDED_TEST_INPUT; WHITE_MONTHLY; TAX_CREDIT_DISABLED',
      effectiveFrom: '2026-01-01',
    }
  }
  return profile
}

function employerAssumptionsFor(kind: Payrun01CompositionKind) {
  if (kind === 'LEGACY_COMPANY_TEST') {
    return {
      rates: { awf: '2.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
      provenance: {
        awf: 'Belastingdienst 2026 low AWf rate 2.74%; TEST assumption based on the specified indefinite, written, non-call employment.',
        aof: 'Belastingdienst 2026 low Aof rate 6.27%; TEST assumption that the employer is small.',
        wko: 'Belastingdienst 2026 Wko surcharge 0.50%.',
        whk: 'Synthetic TEST assumption 1.81%; the employer decision and sector classification are not verified.',
        zvw: 'Belastingdienst 2026 employer Zvw levy 6.10%.',
      },
      classification: {
        status: 'TEST_ONLY',
        size: 'SMALL_EMPLOYER_ASSUMPTION',
        whkSector: 'UNVERIFIED_TEST_ASSUMPTION',
        awf: 'LOW_RATE_ASSUMPTION_FOR_INDEFINITE_WRITTEN_NON_CALL_CONTRACT',
      },
    }
  }
  return {
    rates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
    provenance: EMPLOYER_RATE_SOURCES,
    classification: {
      status: 'TEST_ONLY',
      size: 'SMALL_EMPLOYER_ASSUMPTION',
      whkSector: '35_HEALTH_PSYCHOLOGICAL_AND_SOCIETAL_INTERESTS',
      awf: 'HIGH_RATE_TEST_ASSUMPTION',
    },
  }
}

function additionalHourTreatmentFor(
  kind: Payrun01CompositionKind,
  period: SyntheticPayrollPeriod,
): Payrun01AdditionalHourCompensation {
  return kind === 'KINDEROPVANG_TEST' && period.year === 2026 && period.month === 10
    ? { mode: 'CASH_AT_ORDINARY_RATE', expectedHours: 8, expectedEntryCount: 1 }
    : { mode: 'TIME_OFF' }
}

function calculationConfigVersionFor(
  kind: Payrun01CompositionKind,
  period: SyntheticPayrollPeriod,
  configuration: ReturnType<typeof personaConfiguration>,
  assignmentSupersedesVersion: number | null,
): { readonly version: number; readonly supersedesVersion: number | null } {
  if (kind !== 'KINDEROPVANG_TEST') {
    return { version: configuration.version, supersedesVersion: configuration.version > 1 ? assignmentSupersedesVersion : null }
  }
  if (period.month === 10) {
    return { version: configuration.version * 10 + 2, supersedesVersion: configuration.version * 10 + 1 }
  }
  return { version: configuration.version * 10, supersedesVersion: configuration.version - 1 }
}

function effectiveRangesOverlap(
  first: { readonly effective_from: string; readonly effective_to: string | null },
  second: { readonly effective_from: string; readonly effective_to: string | null },
): boolean {
  const firstEnd = first.effective_to ?? '9999-12-31'
  const secondEnd = second.effective_to ?? '9999-12-31'
  return first.effective_from <= secondEnd && firstEnd >= second.effective_from
}

export function payrun01CalculationConfigVersionNumber(
  kind: Payrun01CompositionKind,
  period: SyntheticPayrollPeriod,
): number {
  const configuration = personaConfiguration(kind)
  return calculationConfigVersionFor(kind, period, configuration, configuration.version - 1).version
}

type ResolvedOpeningBalance = {
  readonly content: {
    readonly schemaVersion: string
    readonly scenario: string
    readonly throughPeriod: SyntheticPayrollPeriod
    readonly status: string
    readonly grossWage: string
    readonly holidayReserve: string
    readonly yearEndReserve: string
    readonly provenance: unknown
  }
  readonly hash: string
  readonly asOfDate: string
  readonly snapshotVersion: number
}

function openingBalance(
  kind: Payrun01CompositionKind,
  configuration: ReturnType<typeof personaConfiguration>,
  period: SyntheticPayrollPeriod,
  priorRun?: Payrun01PriorRunEvidence,
): ResolvedOpeningBalance {
  if (kind === 'KINDEROPVANG_TEST') return deriveKinderopvangOpeningBalance(period, priorRun)
  if (period.year !== 2026 || period.month !== 10 || !('opening' in configuration) || !configuration.opening) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  }
  const priorOpening = configuration.opening
  const content = {
    schemaVersion: 'PAYRUN01_TEST_OPENING_CUMULATIVE_V1',
    scenario: kind,
    throughPeriod: { year: 2026, month: 9 },
    status: 'SYNTHETIC_TEST_OPENING_BALANCE',
    grossWage: priorOpening.grossWage,
    holidayReserve: priorOpening.holidayReserve,
    yearEndReserve: priorOpening.yearEndReserve,
    provenance: priorOpening.note,
  }
  return {
    content,
    hash: sha256(stableSerialize(content)),
    asOfDate: '2026-09-30',
    snapshotVersion: configuration.version,
  }
}

function payrollScopeRecord(scope: PayrollScope, payrollAdministrationId: string) {
  return {
    payroll_administration_id: payrollAdministrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
  }
}

function projectionConfigFor(input: {
  readonly source: PayrollSourceSnapshot
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
  readonly kind: Payrun01CompositionKind
  readonly assignmentVersionId: string
  readonly assignmentHash: string
  readonly configVersionId: string
  readonly configHash: string
  readonly openingSnapshotId: string
  readonly openingHash: string
  readonly opening: ResolvedOpeningBalance
  readonly period: SyntheticPayrollPeriod
  readonly now: Date
}) : Payrun01SourceProjectionConfig {
  const configuration = personaConfiguration(input.kind)
  const packageDefinition = rulePackageForScenario(input.kind)
  const employerAssumptions = employerAssumptionsFor(input.kind)
  const payrollOwnedConfig = {
    scenarioId: input.kind,
    scope: {
      tenantId: input.scope.tenantId,
      hrGroupId: input.scope.hrGroupId,
      administrationId: input.scope.administrationId,
      payrollAdministrationId: input.payrollAdministrationId,
      employeeId: input.source.sourceEmployeeId,
      employmentId: input.source.sourceEmploymentId,
    },
    assignmentVersionId: input.assignmentVersionId,
    assignmentHash: input.assignmentHash,
    configVersionId: input.configVersionId,
    configHash: input.configHash,
    compositionId: packageDefinition.compositionId,
    openingCumulativeSnapshotId: input.openingSnapshotId,
    openingCumulativeHash: input.openingHash,
    taxProfile: makeTaxProfile(input.kind),
    calculationIncomeRelationshipId: deterministicUuid(`payrun01-income-scope:${input.scope.tenantId}:${input.scope.hrGroupId}:${input.scope.administrationId}:${input.source.sourceEmploymentId}`),
    fallbackReasonCodes: ['CONTROL02_CONTRACT_PENDING', 'NO_LINKED_INCOME_RELATIONSHIP'],
    additionalHourCompensation: additionalHourTreatmentFor(input.kind, input.period),
    pension: configuration.pension,
    employerRates: employerAssumptions.rates,
    employerRateProvenance: employerAssumptions.provenance,
    employerClassification: employerAssumptions.classification,
    reserveRates: configuration.reserveRates,
    openingCumulative: {
      status: 'SYNTHETIC_TEST',
      throughPeriod: input.opening.content.throughPeriod,
      hash: input.openingHash,
    },
    socialWageCapClear: true,
    personaLabel: input.kind === 'KINDEROPVANG_TEST' ? 'Jan' : input.kind === 'LEGACY_COMPANY_TEST' ? 'Jaap' : 'Lisa',
    personaAssignment: configuration.functionAssignment,
  }
  return {
    scenarioId: input.kind,
    assignmentId: deterministicUuid(`payrun01-assignment:${input.scope.tenantId}:${input.scope.hrGroupId}:${input.scope.administrationId}:${input.source.sourceEmploymentId}:${input.kind}`),
    arrangementConfigId: input.configVersionId,
    arrangementConfigHash: input.configHash,
    compositionId: packageDefinition.compositionId,
    scope: {
      tenantId: input.scope.tenantId,
      hrGroupId: input.scope.hrGroupId,
      administrationId: input.scope.administrationId,
      employeeId: input.source.sourceEmployeeId,
      employmentId: input.source.sourceEmploymentId,
      periodReference: input.source.periodReference,
    },
    asOf: input.now.toISOString(),
    maximumSnapshotAgeMilliseconds: SOURCE_MAX_AGE_MS,
    expectedEmploymentStartDate: configuration.startDate,
    ...(input.kind === 'KINDEROPVANG_TEST' ? {
      expectedLaborConditionSetId: configuration.expectedLaborConditionSetId,
      expectedLaborConditionSetCode: configuration.expectedLaborConditionSetCode,
      expectedLaborConditionSetName: configuration.expectedLaborConditionSetName,
      expectedJobCode: configuration.expectedJobCode,
      expectedJobTitle: configuration.expectedJobTitle,
    } : input.kind === 'LEGACY_COMPANY_TEST' ? {
      expectedJobCode: configuration.expectedJobCode,
      expectedJobTitle: configuration.expectedJobTitle,
    } : {}),
    expectedSalary: configuration.expectedSalary,
    expectedSchedule: configuration.expectedSchedule,
    taxProfile: makeTaxProfile(input.kind),
    calculationIncomeRelationshipId: payrollOwnedConfig.calculationIncomeRelationshipId,
    incomeRelationshipFallbackReasonCodes: payrollOwnedConfig.fallbackReasonCodes,
    additionalHourCompensation: payrollOwnedConfig.additionalHourCompensation,
    pension: configuration.pension,
    employerRates: employerAssumptions.rates,
    reserveRates: configuration.reserveRates,
    openingCumulatives: {
      id: input.openingSnapshotId,
      status: 'SYNTHETIC_TEST',
      throughPeriod: input.opening.content.throughPeriod,
      sourceHash: input.openingHash,
      grossWage: input.opening.content.grossWage,
      holidayReserve: input.opening.content.holidayReserve,
      yearEndReserve: input.opening.content.yearEndReserve,
    },
    socialWageCapClear: true,
  }
}

function jsonRecord(value: unknown): PayrollJson {
  return JSON.parse(stableSerialize(value)) as PayrollJson
}

function isJsonObject(value: PayrollJson | undefined): value is { readonly [key: string]: PayrollJson | undefined } {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasSameRuleCompositionExceptPackageHash(
  stored: PayrollJson | undefined,
  requested: PayrollJson | undefined,
): boolean {
  if (!isJsonObject(stored) || !isJsonObject(requested)
    || !isJsonObject(stored.packageMetadata) || !isJsonObject(requested.packageMetadata)) return false
  const storedPackageHash = jsonString(stored.packageMetadata.packageHash)
  const requestedPackageHash = jsonString(requested.packageMetadata.packageHash)
  if (!storedPackageHash || !requestedPackageHash
    || !/^[0-9a-f]{64}$/i.test(storedPackageHash)
    || !/^[0-9a-f]{64}$/i.test(requestedPackageHash)) return false
  const withoutPackageHash = (composition: { readonly [key: string]: PayrollJson | undefined }) => {
    const packageMetadata = isJsonObject(composition.packageMetadata) ? composition.packageMetadata : {}
    return {
      ...composition,
      packageMetadata: {
        ...packageMetadata,
        packageHash: 'PAYRUN01_PACKAGE_HASH_IGNORED',
      },
    }
  }
  return stableSerialize(withoutPackageHash(stored)) === stableSerialize(withoutPackageHash(requested))
}

function jsonString(value: PayrollJson | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function jsonNumber(value: PayrollJson | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function jsonBoolean(value: PayrollJson | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null
}

async function withPayrollRepositoryPhase<T>(phase: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof PayrollCalculationRepositoryError)) throw error
    throw new SyntheticPayrollServiceError(
      'PAYROLL_PERSISTENCE_FAILED',
      null,
      `PAYRUN01_CONTEXT_${phase}_${error.code}`,
    )
  }
}

function buildPayrun01Scenario(input: Payrun01RunInput, dependencies: Payrun01ServiceDependencies): PayrollTestScenario {
  const kind = scenarioKey(input.kind)
  const configuration = personaConfiguration(kind)
  const rulePackage = rulePackageForScenario(kind)
  const period = input.period ?? PAYRUN01_PERIOD
  let currentSource: PayrollSourceSnapshot | null = null
  let persistedVersions: PersistedPayrun01Versions | null = null
  let latestPayrollPeriodId: string | null = null
  let nextLifecycleRevision: number | null = null
  const now = dependencies.now ?? (() => new Date())

  return {
    compositionId: rulePackage.compositionId,
    runType: 'INDIVIDUAL_PAYROLL',
    reusePersistedInputs: true,
    period,
    expectedResults: rulePackage.resultMappings,
    createSnapshot: async (scope, period) => {
      if (!isUuid(input.employeeId)) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      const snapshot = await dependencies.sourceProvider.getPayrollSourceSnapshot({
        tenantId: scope.tenantId,
        hrGroupId: scope.hrGroupId,
        administrationId: scope.administrationId,
        employeeId: input.employeeId,
        payrollPeriod: period,
      })
      if (snapshot.sourceEmployeeId !== input.employeeId || snapshot.periodReference.year !== period.year || snapshot.periodReference.month !== period.month) {
        throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      }
      const stableSnapshot = {
        ...snapshot,
        id: derivePayrun01SourceSnapshotId({
          scope,
          employeeId: input.employeeId,
          sourceEmploymentId: snapshot.sourceEmploymentId,
          period,
          sourceHash: snapshot.sourceHash,
          scenarioKind: kind,
          scenarioConfiguration: configuration,
          rulePackageIdentity: rulePackage,
          taxProfile: makeTaxProfile(kind),
        }),
      }
      currentSource = stableSnapshot
      return stableSnapshot
    },
    resolveCalculationContext: async ({ scope, payrollAdministrationId, actorUserId, sourceSnapshot }) => {
      const effectiveSource = currentSource
      if (!effectiveSource || effectiveSource.id !== sourceSnapshot.id) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      const sourcePeriod = sourceSnapshot.periodReference
      let priorRunEvidence: Payrun01PriorRunEvidence | undefined
      if (kind === 'KINDEROPVANG_TEST' && sourcePeriod.year === 2026 && sourcePeriod.month === 10) {
        const priorPeriod = { year: 2026, month: 9 }
        const priorArtifacts = await dependencies.payrollRepository.getLatestSyntheticArtifacts(
          scope,
          payrollAdministrationId,
          rulePackage.compositionId,
          undefined,
          undefined,
          'INDIVIDUAL_PAYROLL',
          priorPeriod,
        )
        if (priorArtifacts) {
          const priorEvents = await dependencies.payrunRepository.listLifecycleEvents(
            scope,
            payrollAdministrationId,
            priorArtifacts.payrollPeriod.id,
            priorArtifacts.sourceSnapshot.source_employment_id,
          )
          priorRunEvidence = {
            runId: priorArtifacts.run.id,
            status: priorArtifacts.run.status,
            resultHash: priorArtifacts.run.result_hash,
            sourceHash: priorArtifacts.sourceSnapshot.source_hash,
            inputHash: priorArtifacts.inputSet.input_hash,
            period: { year: priorArtifacts.payrollPeriod.period_year, month: priorArtifacts.payrollPeriod.period_month },
            lifecycleEvent: priorEvents.at(-1)?.event_type ?? null,
            controls: priorArtifacts.controls.map(({ status }) => ({ status })),
            components: priorArtifacts.componentResults.map((component) => {
              const payload = isJsonObject(component.result_payload) ? component.result_payload : undefined
              return { component_key: component.component_key, amount: jsonString(payload?.amount) }
            }),
          }
        }
      }
      let opening: ResolvedOpeningBalance
      try {
        opening = openingBalance(kind, configuration, sourcePeriod, priorRunEvidence)
      } catch (error) {
        const reasonCode = error instanceof Error ? error.message : 'PAYRUN01_OPENING_BALANCE_INVALID'
        throw new SyntheticPayrollServiceError('PAYROLL_CALCULATION_BLOCKED', null, reasonCode)
      }
      const ruleComposition = {
        schemaVersion: 'PAYRUN01_RULE_COMPOSITION_V1',
        packageId: 'NL-PAYROLL-2026',
        packageVersion: '2026.1',
        compositionId: rulePackage.compositionId,
        kind,
        packageMetadata: rulePackage.metadata ?? null,
        components: rulePackage.components,
        controls: rulePackage.controls,
        roundingDefinitions: rulePackage.roundingDefinitions ?? [],
        resultMappings: rulePackage.resultMappings,
        statutorySourceRegistry: PAYRUN01_RULE_REGISTRY.map((rule) => ({ key: rule.ruleKey, version: rule.ruleVersion, implementationHash: rule.implementationHash })),
      }
      const additionalHourCompensation = additionalHourTreatmentFor(kind, sourcePeriod)
      const employerAssumptions = employerAssumptionsFor(kind)
      const { version: configVersionNumber, supersedesVersion: configSupersedesVersion } = calculationConfigVersionFor(
        kind,
        sourcePeriod,
        configuration,
        configuration.version - 1,
      )
      const configEffectiveRange = payrun01CalculationConfigEffectiveRange(kind, sourcePeriod, configuration.startDate)
      const [existingConfigVersion, predecessorConfigVersion] = await withPayrollRepositoryPhase('CONFIG_VERSION_READ', () => Promise.all([
        dependencies.payrunRepository.getCalculationConfigVersion(
          scope,
          payrollAdministrationId,
          sourceSnapshot.sourceEmploymentId,
          configVersionNumber,
        ),
        configSupersedesVersion === null
          ? Promise.resolve(null)
          : dependencies.payrunRepository.getCalculationConfigVersion(
            scope,
            payrollAdministrationId,
            sourceSnapshot.sourceEmploymentId,
            configSupersedesVersion,
          ),
      ]))
      const existingConfigJson = existingConfigVersion && isJsonObject(existingConfigVersion.config_json)
        ? existingConfigVersion.config_json
        : null
      const configIsCorrectionSuccessor = existingConfigJson
        ? existingConfigJson.versionIntent === 'CORRECTION_SUCCESSOR'
        : predecessorConfigVersion !== null && effectiveRangesOverlap(
          { effective_from: configEffectiveRange.effectiveFrom, effective_to: configEffectiveRange.effectiveTo },
          predecessorConfigVersion,
        )
      const correctionReasonCode = existingConfigJson
        ? jsonString(existingConfigJson.correctionReasonCode)
        : configIsCorrectionSuccessor ? 'CORRECTED_PAYROLL_INPUT' : null
      if (configIsCorrectionSuccessor && (!predecessorConfigVersion || !correctionReasonCode)) {
        throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      }
      const ruleCompositionJson = jsonRecord(ruleComposition) as Exclude<PayrollJson, null>
      const compositionHash = sha256(stableSerialize(ruleComposition))
      const compositionAsOfDate = `${sourcePeriod.year}-${String(sourcePeriod.month).padStart(2, '0')}-01`
      const assignmentId = deterministicUuid(`payrun01-assignment:${scope.tenantId}:${scope.hrGroupId}:${scope.administrationId}:${sourceSnapshot.sourceEmploymentId}:${kind}`)
      const [baseAssignmentVersion, priorAssignmentVersion] = await withPayrollRepositoryPhase('ASSIGNMENT_VERSION_READ', () => Promise.all([
        dependencies.payrunRepository.getAssignmentVersion(
          scope,
          payrollAdministrationId,
          assignmentId,
          configuration.version,
        ),
        configuration.version > 1
          ? dependencies.payrunRepository.getAssignmentVersion(
            scope,
            payrollAdministrationId,
            assignmentId,
            configuration.version - 1,
          )
          : Promise.resolve(null),
      ]))
      const comparisonAssignmentVersion = baseAssignmentVersion ?? priorAssignmentVersion
      const baseComposition = comparisonAssignmentVersion
        ? await withPayrollRepositoryPhase('COMPOSITION_READ', () => dependencies.payrunRepository.getArrangementCompositionSnapshot(
          scope,
          payrollAdministrationId,
          comparisonAssignmentVersion.id,
          compositionAsOfDate,
        ))
        : null
      const reuseBaseComposition = baseComposition !== null
        && hasSameRuleCompositionExceptPackageHash(baseComposition.snapshot_json, ruleCompositionJson)
      const requiresAssignmentSuccessor = configIsCorrectionSuccessor
        && baseComposition !== null
        && !reuseBaseComposition
      const assignmentVersionNumber = requiresAssignmentSuccessor && baseAssignmentVersion !== null
        ? configuration.version + 1
        : configuration.version
      const assignmentSupersedesVersion = assignmentVersionNumber > 1 ? assignmentVersionNumber - 1 : null
      const [existingAssignmentVersion, predecessorAssignmentVersion] = await withPayrollRepositoryPhase('ASSIGNMENT_SUCCESSOR_READ', () => Promise.all([
        assignmentVersionNumber === configuration.version
          ? Promise.resolve(baseAssignmentVersion)
          : dependencies.payrunRepository.getAssignmentVersion(scope, payrollAdministrationId, assignmentId, assignmentVersionNumber),
        assignmentSupersedesVersion === null
          ? Promise.resolve(null)
          : assignmentSupersedesVersion === configuration.version
            ? Promise.resolve(baseAssignmentVersion)
            : assignmentSupersedesVersion === configuration.version - 1
              ? Promise.resolve(priorAssignmentVersion)
            : dependencies.payrunRepository.getAssignmentVersion(scope, payrollAdministrationId, assignmentId, assignmentSupersedesVersion),
      ]))
      const existingAssignmentJson = existingAssignmentVersion && isJsonObject(existingAssignmentVersion.assignment_json)
        ? existingAssignmentVersion.assignment_json
        : null
      const assignmentIsCorrectionSuccessor = existingAssignmentJson
        ? existingAssignmentJson.versionIntent === 'CORRECTION_SUCCESSOR'
        : configIsCorrectionSuccessor && predecessorAssignmentVersion !== null && effectiveRangesOverlap(
          { effective_from: configuration.startDate, effective_to: null },
          predecessorAssignmentVersion,
        )
      const assignmentCorrectionReasonCode = existingAssignmentJson
        ? jsonString(existingAssignmentJson.correctionReasonCode)
        : assignmentIsCorrectionSuccessor ? correctionReasonCode : null
      if (assignmentIsCorrectionSuccessor && (!predecessorAssignmentVersion || !assignmentCorrectionReasonCode)) {
        throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      }
      const assignmentContent = {
        schemaVersion: 'PAYRUN01_ASSIGNMENT_V1',
        scenario: kind,
        supersedesVersion: assignmentSupersedesVersion,
        ...(assignmentIsCorrectionSuccessor && assignmentCorrectionReasonCode && predecessorAssignmentVersion
          ? {
            versionIntent: 'CORRECTION_SUCCESSOR',
            correctionReasonCode: assignmentCorrectionReasonCode,
            supersedesAssignmentVersionId: predecessorAssignmentVersion.id,
          }
          : {}),
        arrangementName: configuration.arrangementName,
        sourceEmploymentId: sourceSnapshot.sourceEmploymentId,
        effectiveFrom: configuration.startDate,
        effectiveTo: null,
        salaryMode: configuration.pricingMode,
        expectedSalary: configuration.expectedSalary,
        expectedSchedule: configuration.expectedSchedule,
        payslipProfile: configuration.payslipProfile,
        officialSource: configuration.functionAssignment.officialSource,
        ...(kind === 'KINDEROPVANG_TEST'
          ? {
            officialRuleData: 'officialRuleData' in configuration.functionAssignment ? configuration.functionAssignment.officialRuleData : null,
            syntheticPersonaChoices: 'syntheticPersonaChoices' in configuration.functionAssignment
              ? configuration.functionAssignment.syntheticPersonaChoices
              : configuration.functionAssignment.personaChoices,
          }
          : { personaChoices: configuration.functionAssignment.personaChoices }),
        provenanceStatus: 'TEST_ONLY',
        provenanceSource: PAYRUN01_PROVENANCE_SOURCE,
      }
      const assignmentHash = sha256(stableSerialize(assignmentContent))
      const assignmentVersion = await withPayrollRepositoryPhase('ASSIGNMENT_VERSION_WRITE', () => dependencies.payrunRepository.getOrCreateAssignmentVersion(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        assignment_id: assignmentId,
        assignment_version: assignmentVersionNumber,
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        effective_from: configuration.startDate,
        effective_to: null,
        assignment_json: jsonRecord(assignmentContent) as Exclude<PayrollJson, null>,
        assignment_hash: assignmentHash,
        provenance_status: 'TEST_ONLY',
        provenance_source: PAYRUN01_PROVENANCE_SOURCE,
        created_by_user_id: actorUserId,
      }))

      const configContent = {
        schemaVersion: kind === 'KINDEROPVANG_TEST' ? 'PAYRUN01_CALCULATION_CONFIG_V2' : 'PAYRUN01_CALCULATION_CONFIG_V1',
        scenario: kind,
        ...(kind === 'KINDEROPVANG_TEST'
          ? { configVersion: configVersionNumber, supersedesVersion: configSupersedesVersion, period: sourcePeriod }
          : { supersedesVersion: configSupersedesVersion }),
        ...(configIsCorrectionSuccessor && correctionReasonCode && predecessorConfigVersion
          ? {
            versionIntent: 'CORRECTION_SUCCESSOR',
            correctionReasonCode,
            supersedesConfigVersionId: predecessorConfigVersion?.id,
          }
          : {}),
        effectiveFrom: configEffectiveRange.effectiveFrom,
        ...(configEffectiveRange.effectiveTo ? { effectiveTo: configEffectiveRange.effectiveTo } : {}),
        sourceEmploymentId: sourceSnapshot.sourceEmploymentId,
        expectedEmploymentStartDate: configuration.startDate,
        expectedSalary: configuration.expectedSalary,
        expectedSchedule: configuration.expectedSchedule,
        ...(kind === 'KINDEROPVANG_TEST' ? { functionAssignment: configuration.functionAssignment } : {}),
        taxProfile: makeTaxProfile(kind),
        calculationIncomeRelationship: {
          mode: 'PAYROLL_OWNED_TEST_SCOPE_FALLBACK',
          fallbackReasonCodes: ['CONTROL02_CONTRACT_PENDING', 'NO_LINKED_INCOME_RELATIONSHIP'],
          canonicalEmploymentIsNotIncomeRelationship: true,
        },
        additionalHours: {
          ...additionalHourCompensation,
          formula: 'fullTimeMonthlySalary * 12 * cashCompensatedHours / (fulltimeHoursPerWeek * 52.2)',
          rounding: 'HALF_UP_TO_CENTS_ON_PERIOD_TOTAL',
        },
        pension: configuration.pension,
        employerRates: employerAssumptions.rates,
        employerRateProvenance: employerAssumptions.provenance,
        employerClassification: employerAssumptions.classification,
        reserves: configuration.reserveRates,
        openingBalance: opening.content,
        declarationStatus: 'OUT_OF_SCOPE_NOT_SUBMITTED',
        paymentStatus: 'OUT_OF_SCOPE_NOT_EXECUTED',
      }
      const configHash = sha256(stableSerialize(configContent))
      const configVersion = await withPayrollRepositoryPhase('CONFIG_VERSION_WRITE', () => dependencies.payrunRepository.getOrCreateCalculationConfigVersion(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        config_version: configVersionNumber,
        effective_from: configEffectiveRange.effectiveFrom,
        effective_to: configEffectiveRange.effectiveTo,
        config_json: jsonRecord(configContent) as Exclude<PayrollJson, null>,
        config_hash: configHash,
        provenance_status: 'TEST_ONLY',
        provenance_source: PAYRUN01_PROVENANCE_SOURCE,
        created_by_user_id: actorUserId,
      }))

      const composition = await withPayrollRepositoryPhase('COMPOSITION_WRITE', () => dependencies.payrunRepository.getOrCreateArrangementCompositionSnapshot(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        assignment_version_id: assignmentVersion.id,
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        as_of_date: compositionAsOfDate,
        snapshot_json: reuseBaseComposition ? baseComposition!.snapshot_json : ruleCompositionJson,
        snapshot_hash: reuseBaseComposition ? baseComposition!.snapshot_hash : compositionHash,
        created_by_user_id: actorUserId,
      }))

      const openingBalanceRow = await withPayrollRepositoryPhase('OPENING_BALANCE_WRITE', () => dependencies.payrunRepository.getOrCreateOpeningCumulativeSnapshot(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        snapshot_version: opening.snapshotVersion,
        as_of_date: opening.asOfDate,
        opening_balance_json: jsonRecord(opening.content) as Exclude<PayrollJson, null>,
        snapshot_hash: opening.hash,
        provenance_status: 'TEST_OPENING_BALANCE',
        provenance_source: PAYRUN01_PROVENANCE_SOURCE,
        created_by_user_id: actorUserId,
      }))

      const projectionConfig = projectionConfigFor({
        source: sourceSnapshot,
        scope,
        payrollAdministrationId,
        kind,
        assignmentVersionId: assignmentVersion.id,
        assignmentHash: assignmentVersion.assignment_hash,
        configVersionId: configVersion.id,
        configHash: configVersion.config_hash,
        openingSnapshotId: openingBalanceRow.id,
        openingHash: openingBalanceRow.snapshot_hash,
        opening,
        period: sourcePeriod,
        now: now(),
      })
      const projection = await projectPayrun01SourceSnapshot(sourceSnapshot, projectionConfig)
      const linkedValues: PersistedPayrun01Versions = {
        assignmentVersionId: assignmentVersion.id,
        assignmentVersionNumber: assignmentVersion.assignment_version,
        assignmentHash: assignmentVersion.assignment_hash,
        configVersionId: configVersion.id,
        configHash: configVersion.config_hash,
        configVersionNumber: configVersion.config_version,
        supersedesConfigVersionNumber: configIsCorrectionSuccessor ? configSupersedesVersion : null,
        supersedesConfigVersionId: configIsCorrectionSuccessor ? predecessorConfigVersion?.id ?? null : null,
        correctionReasonCode: configIsCorrectionSuccessor ? correctionReasonCode : null,
        sourceSnapshotId: sourceSnapshot.id,
        compositionSnapshotId: composition.id,
        compositionHash: composition.snapshot_hash,
        openingCumulativeSnapshotId: openingBalanceRow.id,
        openingCumulativeHash: openingBalanceRow.snapshot_hash,
        calculationIncomeRelationshipId: projection.calculationIncomeRelationshipId ?? projectionConfig.calculationIncomeRelationshipId,
        asOfDate: `${sourcePeriod.year}-${String(sourcePeriod.month).padStart(2, '0')}-01`,
        sourceSnapshotHash: sourceSnapshot.sourceHash,
      }
      persistedVersions = linkedValues
      const contextHash = sha256(stableSerialize({
        schemaVersion: 'PAYRUN01_CALCULATION_CONTEXT_V1',
        sourceHash: projection.snapshot.sourceHash,
        assignmentVersionId: linkedValues.assignmentVersionId,
        assignmentVersionNumber: linkedValues.assignmentVersionNumber,
        assignmentHash: linkedValues.assignmentHash,
        configVersionId: linkedValues.configVersionId,
        configHash: linkedValues.configHash,
        configVersionNumber: linkedValues.configVersionNumber,
        supersedesConfigVersionNumber: linkedValues.supersedesConfigVersionNumber,
        supersedesConfigVersionId: linkedValues.supersedesConfigVersionId,
        correctionReasonCode: linkedValues.correctionReasonCode,
        sourceSnapshotId: linkedValues.sourceSnapshotId,
        compositionSnapshotId: linkedValues.compositionSnapshotId,
        compositionHash: linkedValues.compositionHash,
        openingCumulativeSnapshotId: linkedValues.openingCumulativeSnapshotId,
        openingCumulativeHash: linkedValues.openingCumulativeHash,
        calculationIncomeRelationshipId: linkedValues.calculationIncomeRelationshipId,
      }))
      return {
        sourceSnapshot: projection.snapshot,
        calculationContextHash: contextHash,
        provenance: jsonRecord({
          schemaVersion: 'PAYRUN01_CALCULATION_PROVENANCE_V1',
          scenario: kind,
          personaLabel: kind === 'KINDEROPVANG_TEST' ? 'Jan' : kind === 'LEGACY_COMPANY_TEST' ? 'Jaap' : 'Lisa',
          versions: linkedValues,
          projection: projection.provenance,
          payrollRuleCompositionHash: composition.snapshot_hash,
          downstream: {
            payment: { status: 'NOT_READY_OR_NOT_ASSESSED', scope: 'PAYMENT_EXECUTION_OUT_OF_SCOPE' },
            declaration: { status: 'BLOCKED_OUT_OF_SCOPE', scope: 'LOONAANGIFTE_SUBMISSION_OUT_OF_SCOPE' },
          },
        }),
      } satisfies PayrollCalculationContext
    },
    finalizeCalculationProvenance: async ({ inputSet, sourceSnapshot }) => {
      if (inputSet.source_snapshot_id !== sourceSnapshot.id
        || !/^[0-9a-f]{64}$/i.test(inputSet.input_hash)
        || !/^[0-9a-f]{64}$/i.test(sourceSnapshot.source_hash)) {
        throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      }
      const canonical = sourceSnapshot.source_payload
      const payrollOwned = isJsonObject(canonical) && isJsonObject(canonical.payrollOwned)
        ? canonical.payrollOwned
        : null
      const pension = payrollOwned && isJsonObject(payrollOwned.pension) ? payrollOwned.pension : null
      if (jsonString(pension?.status) !== 'CALCULATED') return undefined
      const result = payrollOwned?.pensionCalculationSummary
      const trace = payrollOwned?.pensionCalculationTrace
      if (!result || !trace || !Array.isArray(trace) || !isJsonObject(result)) {
        throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      }
      const boundTrace = trace.map((step) => {
        if (!isJsonObject(step)) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
        return { ...step, inputSetId: inputSet.id, inputHash: inputSet.input_hash }
      })
      return jsonRecord({
        pensionCalculation: {
          schemaVersion: 'PAYRUN01_PENSION_TRACE_BINDING_V1',
          status: 'CALCULATED',
          arrangementCode: jsonString(result.arrangementCode),
          sourceSnapshotId: sourceSnapshot.id,
          sourceSnapshotHash: sourceSnapshot.source_hash,
          inputSetId: inputSet.id,
          inputHash: inputSet.input_hash,
          result,
          trace: boundTrace,
        },
      })
    },
    persistInputReference: async ({ scope, payrollAdministrationId, actorUserId, inputSet, payrollPeriod, sourceSnapshot, calculationContext }) => {
      const versions = persistedVersions
      if (!versions || inputSet.source_snapshot_id !== sourceSnapshot.id) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      const events = await dependencies.payrunRepository.listLifecycleEvents(
        scope,
        payrollAdministrationId,
        payrollPeriod.id,
        sourceSnapshot.source_employment_id,
      )
      let supersession: Record<string, unknown> | null = null
      if (versions.supersedesConfigVersionNumber !== null
        && versions.supersedesConfigVersionId !== null
        && versions.correctionReasonCode !== null) {
        for (const event of [...events].reverse().filter((entry) => entry.event_type === 'FINALIZED')) {
          const predecessor = await dependencies.payrollRepository.getLatestSyntheticArtifacts(
            scope,
            payrollAdministrationId,
            undefined,
            event.calculation_run_id,
            undefined,
            'INDIVIDUAL_PAYROLL',
            { year: payrollPeriod.period_year, month: payrollPeriod.period_month },
          )
          if (!predecessor || predecessor.run.id !== event.calculation_run_id
            || predecessor.run.status !== 'SUCCEEDED' || !predecessor.run.result_hash
            || predecessor.payrollPeriod.id !== payrollPeriod.id) continue
          const predecessorReference = await dependencies.payrunRepository.getInputReference(
            scope,
            payrollAdministrationId,
            predecessor.inputSet.id,
          )
          if (!predecessorReference
            || predecessorReference.source_employment_id !== sourceSnapshot.source_employment_id
            || predecessorReference.config_version_id !== versions.supersedesConfigVersionId) continue
          supersession = {
            kind: 'CORRECTION_SUCCESSOR',
            successorConfigVersionId: versions.configVersionId,
            successorConfigVersion: versions.configVersionNumber,
            supersedesConfigVersionId: versions.supersedesConfigVersionId,
            supersedesConfigVersion: versions.supersedesConfigVersionNumber,
            reasonCode: versions.correctionReasonCode,
            supersedesRunId: predecessor.run.id,
            supersedesInputSetId: predecessor.inputSet.id,
            supersedesInputHash: predecessor.inputSet.input_hash,
            supersedesResultHash: predecessor.run.result_hash,
            supersedesSourceSnapshotId: predecessor.sourceSnapshot.id,
            supersedesSourceHash: predecessor.sourceSnapshot.source_hash,
            successorInputSetId: inputSet.id,
            successorInputHash: inputSet.input_hash,
            successorSourceSnapshotId: versions.sourceSnapshotId,
            successorSourceHash: sourceSnapshot.source_hash,
          }
          break
        }
        if (!supersession) {
          supersession = {
            kind: 'INITIAL_FIXTURE_SUCCESSOR',
            successorConfigVersionId: versions.configVersionId,
            successorConfigVersion: versions.configVersionNumber,
            supersedesConfigVersionId: versions.supersedesConfigVersionId,
            supersedesConfigVersion: versions.supersedesConfigVersionNumber,
            reasonCode: versions.correctionReasonCode,
            successorInputSetId: inputSet.id,
            successorInputHash: inputSet.input_hash,
            successorSourceSnapshotId: versions.sourceSnapshotId,
            successorSourceHash: sourceSnapshot.source_hash,
          }
        }
      }
      const referenceJson = jsonRecord({
        schemaVersion: 'PAYRUN01_INPUT_REFERENCE_V1',
        scenario: kind,
        sourceHash: sourceSnapshot.source_hash,
        sourceVersionVector: sourceSnapshot.source_version_vector,
        sourceEmploymentId: sourceSnapshot.source_employment_id,
        period: { year: payrollPeriod.period_year, month: payrollPeriod.period_month, startsOn: payrollPeriod.starts_on, endsOn: payrollPeriod.ends_on },
        inputHash: inputSet.input_hash,
        calculationContextHash: calculationContext?.calculationContextHash ?? null,
        versions,
        ...(supersession ? { supersession } : {}),
        provenanceSource: PAYRUN01_PROVENANCE_SOURCE,
      })
      await dependencies.payrunRepository.insertInputReference(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        calculation_input_set_id: inputSet.id,
        source_employment_id: sourceSnapshot.source_employment_id,
        assignment_version_id: versions.assignmentVersionId,
        arrangement_snapshot_id: versions.compositionSnapshotId,
        config_version_id: versions.configVersionId,
        opening_cumulative_snapshot_id: versions.openingCumulativeSnapshotId,
        input_provenance_json: referenceJson as Exclude<PayrollJson, null>,
        created_by_user_id: actorUserId,
      })
      latestPayrollPeriodId = payrollPeriod.id
      nextLifecycleRevision = Math.max(0, ...events.map((event) => event.revision)) + 1
    },
    recordLifecycleEvent: async ({ scope, payrollAdministrationId, actorUserId, payrollPeriodId, sourceEmploymentId, calculationRunId, eventType, eventPayload }) => {
      const revision = nextLifecycleRevision
      if (!revision || latestPayrollPeriodId !== payrollPeriodId) throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', calculationRunId)
      await dependencies.payrunRepository.insertLifecycleEvent(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        payroll_period_id: payrollPeriodId,
        source_employment_id: sourceEmploymentId,
        calculation_run_id: calculationRunId,
        revision,
        event_sequence: 1,
        event_type: eventType,
        event_payload: eventPayload,
        created_by_user_id: actorUserId,
      })
      nextLifecycleRevision = revision + 1
    },
  }
}

function createPayrun01PayrollService(dependencies: Payrun01ServiceDependencies, input: Payrun01RunInput) {
  const scenario = buildPayrun01Scenario(input, dependencies)
  const packageDefinition = rulePackageForScenario(input.kind)
  return createSyntheticPayrollService({
    scenario,
    repository: dependencies.payrollRepository,
    isEnabled: dependencies.enabled,
    engine: {
      buildInputs: (snapshot, effectiveDate, context) => {
        const provenance = context?.provenance
        const versions = isJsonObject(provenance)
          ? provenance.versions
          : undefined
        const incomeRelationshipId = isJsonObject(versions)
          ? String(versions.calculationIncomeRelationshipId ?? '')
          : snapshot.sourceIncomeRelationshipId ?? ''
        try {
          return buildCalculationInputs(snapshot, packageDefinition, {
            effectiveDate,
            scopeInstanceIds: {
              EMPLOYEE: snapshot.sourceEmployeeId,
              EMPLOYMENT: snapshot.sourceEmploymentId,
              INCOME_RELATIONSHIP: incomeRelationshipId,
            },
            ...(context?.calculationContextHash ? { calculationContextHash: context.calculationContextHash } : {}),
            ...(context?.sourceValueOverrides ? { sourceValueOverrides: context.sourceValueOverrides } : {}),
          })
        } catch (error) {
          const missingPensionInput = error instanceof Error
            && error.message === 'Required source value for PAYRUN01_EMPLOYEE_PENSION.amount is missing.'
          const canonical = isJsonObject(snapshot.canonicalSource) ? snapshot.canonicalSource : null
          const payrollOwned = canonical && isJsonObject(canonical.payrollOwned) ? canonical.payrollOwned : null
          const pension = payrollOwned && isJsonObject(payrollOwned.pension) ? payrollOwned.pension : null
          const reasonCode = jsonString(pension?.reasonCode)
          if (missingPensionInput && reasonCode && /^PENSION_[A-Z0-9_]+$/.test(reasonCode)) {
            throw new SyntheticPayrollServiceError('PAYROLL_CALCULATION_FAILED', null, `PAYRUN01_${reasonCode}`)
          }
          throw error
        }
      },
      calculate: (inputs) => calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY),
    },
  })
}

function defaultDependencies(sourceDependencies?: PayrollSourceProviderDependencies): Payrun01ServiceDependencies {
  try {
    return {
      payrollRepository: createPayrollCalculationRepository(),
      payrunRepository: createPayrun01Repository(),
      sourceProvider: createLiquidHrPayrollSourceProvider(sourceDependencies),
      enabled: isPayrollLabEnabled,
    }
  } catch {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED')
  }
}

export async function runPayrun01Payroll(input: Payrun01RunInput, dependencies = defaultDependencies()): Promise<SyntheticPayrollView> {
  if (!dependencies.enabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  if (!isUuid(input.employeeId) || !isUuid(input.payrollAdministrationId) || !isUuid(input.actorUserId)) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  }
  if (!isPayrun01AcceptancePeriod(input.kind, input.period ?? PAYRUN01_PERIOD)) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  }
  return await createPayrun01PayrollService(dependencies, input)
    .runSyntheticPayroll(input.scope, input.payrollAdministrationId, input.actorUserId)
}

export async function getLatestPayrun01Payroll(
  scope: PayrollScope,
  payrollAdministrationId: string,
  kind: Payrun01CompositionKind,
  runId?: string,
  dependencies = defaultDependencies(),
  period: SyntheticPayrollPeriod = PAYRUN01_PERIOD,
): Promise<SyntheticPayrollView | null> {
  if (!dependencies.enabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  if (!isPayrun01AcceptancePeriod(kind, period)) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  const scenario = buildPayrun01Scenario({
    scope,
    payrollAdministrationId,
    actorUserId: '10000000-0000-4000-8000-000000000001',
    employeeId: '20000000-0000-4000-8000-000000000002',
    kind,
    period,
  }, dependencies)
  return await createSyntheticPayrollService({
    scenario,
    repository: dependencies.payrollRepository,
    isEnabled: dependencies.enabled,
    engine: {
      buildInputs: (snapshot, effectiveDate, context) => buildCalculationInputs(snapshot, rulePackageForScenario(kind), {
        effectiveDate,
        scopeInstanceIds: {
          EMPLOYEE: snapshot.sourceEmployeeId,
          EMPLOYMENT: snapshot.sourceEmploymentId,
          INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
        },
        ...(context?.calculationContextHash ? { calculationContextHash: context.calculationContextHash } : {}),
        ...(context?.sourceValueOverrides ? { sourceValueOverrides: context.sourceValueOverrides } : {}),
      }),
      calculate: (inputs) => calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY),
    },
  }).getLatestSyntheticPayroll(scope, payrollAdministrationId, runId, period)
}

function assertLifecycleActor(input: Payrun01LifecycleInput): void {
  if (!isUuid(input.payrollAdministrationId) || !isUuid(input.actorUserId) || !isUuid(input.employeeId) || !isUuid(input.runId)) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  }
  if (payrun01ScenarioForTestPersona(input.employeeId) !== input.kind) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
}

async function loadLifecycleEvidence(
  input: Payrun01LifecycleInput,
  dependencies: Payrun01ServiceDependencies,
  requireCurrentSource = true,
  allowBlockedRun = false,
) {
  assertLifecycleActor(input)
  if (!dependencies.enabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  const rulePackage = rulePackageForScenario(scenarioKey(input.kind))
  const artifacts = await dependencies.payrollRepository.getLatestSyntheticArtifacts(
    input.scope,
    input.payrollAdministrationId,
    rulePackage.compositionId,
    input.runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  const succeededRun = artifacts?.run.status === 'SUCCEEDED' && Boolean(artifacts.run.result_hash)
  const explicitlyBlockedRun = allowBlockedRun
    && artifacts?.run.status === 'FAILED'
    && artifacts.run.result_hash === null
  if (!artifacts || artifacts.run.id !== input.runId || (!succeededRun && !explicitlyBlockedRun)) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
  if (artifacts.sourceSnapshot.source_employee_id !== input.employeeId) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
  if (artifacts.controls.some((control) => control.status === 'FAIL') && !explicitlyBlockedRun) {
    throw new SyntheticPayrollServiceError('PAYROLL_CALCULATION_BLOCKED', input.runId)
  }

  const inputReference = await dependencies.payrunRepository.getInputReference(
    input.scope,
    input.payrollAdministrationId,
    artifacts.inputSet.id,
  )
  if (!inputReference || inputReference.source_employment_id !== artifacts.sourceSnapshot.source_employment_id) {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', input.runId)
  }
  const provenance = inputReference.input_provenance_json
  const versions = isJsonObject(provenance) && isJsonObject(provenance.versions) ? provenance.versions : undefined
  const sourceSnapshotHash = isJsonObject(provenance) ? provenance.sourceHash : undefined
  const upstreamSourceSnapshotHash = versions?.sourceSnapshotHash
  const inputHash = isJsonObject(provenance) ? provenance.inputHash : undefined
  if (typeof sourceSnapshotHash !== 'string' || !/^[0-9a-f]{64}$/.test(sourceSnapshotHash)
    || sourceSnapshotHash !== artifacts.sourceSnapshot.source_hash
    || typeof upstreamSourceSnapshotHash !== 'string' || !/^[0-9a-f]{64}$/.test(upstreamSourceSnapshotHash)
    || typeof inputHash !== 'string' || inputHash !== artifacts.inputSet.input_hash) {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', input.runId)
  }
  if (isJsonObject(provenance) && provenance.scenario !== input.kind) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }

  if (requireCurrentSource) {
    const currentSource = await dependencies.sourceProvider.getPayrollSourceSnapshot({
      tenantId: input.scope.tenantId,
      hrGroupId: input.scope.hrGroupId,
      administrationId: input.scope.administrationId,
      employeeId: artifacts.sourceSnapshot.source_employee_id,
      payrollPeriod: { year: artifacts.payrollPeriod.period_year, month: artifacts.payrollPeriod.period_month },
    })
    if (currentSource.sourceEmployeeId !== artifacts.sourceSnapshot.source_employee_id
      || currentSource.sourceEmploymentId !== artifacts.sourceSnapshot.source_employment_id
      || currentSource.sourceHash !== upstreamSourceSnapshotHash) {
      throw new SyntheticPayrollServiceError('PAYROLL_CALCULATION_BLOCKED', input.runId)
    }
  }

  const events = await dependencies.payrunRepository.listLifecycleEvents(
    input.scope,
    input.payrollAdministrationId,
    artifacts.payrollPeriod.id,
    artifacts.sourceSnapshot.source_employment_id,
  )
  return { artifacts, inputReference, events, sourceHash: upstreamSourceSnapshotHash }
}

export async function getPayrun01Lifecycle(
  input: Payrun01LifecycleInput,
  dependencies = defaultDependencies(),
) {
  const { artifacts, events } = await loadLifecycleEvidence(input, dependencies, false, true)
  return {
    runId: artifacts.run.id,
    status: artifacts.run.status,
    resultHash: artifacts.run.result_hash,
    latestEvent: events.at(-1) ?? null,
    events,
    controls: artifacts.controls,
    paymentStatus: 'DOWNSTREAM_PAYMENT_NOT_ASSESSED' as const,
    declarationStatus: 'DECLARATION_PROJECTION_OUT_OF_SCOPE' as const,
  }
}

function assertPayrun01Finalized(
  events: readonly import('./database').IndividualPayrollLifecycleEventRow[],
  runId: string,
): void {
  const runEvents = events.filter((event) => event.calculation_run_id === runId)
  const expected = [
    { event_type: 'CONCEPT', event_sequence: 1 },
    { event_type: 'REVIEWED', event_sequence: 2 },
    { event_type: 'FINALIZED', event_sequence: 3 },
  ] as const
  if (runEvents.length !== expected.length || !expected.every((event, index) =>
    runEvents[index]?.event_type === event.event_type && runEvents[index]?.event_sequence === event.event_sequence)) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', runId)
  }
}

export async function createPayrun01TechnicalJsonArtifact(
  input: Payrun01LifecycleInput,
  dependencies = defaultDependencies(),
) {
  const { artifacts, inputReference, events } = await loadLifecycleEvidence(input, dependencies, false)
  assertPayrun01Finalized(events, input.runId)

  const existing = await dependencies.payrunRepository.getArtifact(
    input.scope,
    input.payrollAdministrationId,
    input.runId,
    'TECHNICAL_JSON',
  )
  if (existing) return existing

  const provenance = inputReference.input_provenance_json
  if (!isJsonObject(provenance) || !isJsonObject(provenance.versions)) {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', input.runId)
  }
  const sourcePayload = isJsonObject(artifacts.sourceSnapshot.source_payload)
    ? artifacts.sourceSnapshot.source_payload
    : undefined
  const payrollOwned = isJsonObject(sourcePayload?.payrollOwned) ? sourcePayload.payrollOwned : undefined
  const pension = isJsonObject(payrollOwned?.pension) ? payrollOwned.pension : undefined
  const pensionStatus = jsonString(pension?.status)
  const pensionReasonCode = jsonString(pension?.reasonCode)
  const pensionExcluded = pensionStatus === 'EXCLUDED_SOURCE_GAP'
  const finalizedEvent = events.find((event) => event.calculation_run_id === input.runId && event.event_type === 'FINALIZED')
  const payload = {
    schemaVersion: 'PAYRUN01_TECHNICAL_RESULT_V1',
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    payrollPeriod: {
      year: artifacts.payrollPeriod.period_year,
      month: artifacts.payrollPeriod.period_month,
      startsOn: artifacts.payrollPeriod.starts_on,
      endsOn: artifacts.payrollPeriod.ends_on,
    },
    versions: {
      sourceSnapshotId: artifacts.sourceSnapshot.id,
      sourceSnapshotHash: artifacts.sourceSnapshot.source_hash,
      sourceVersionVector: artifacts.sourceSnapshot.source_version_vector,
      inputSetId: artifacts.inputSet.id,
      inputHash: artifacts.inputSet.input_hash,
      rulePackageCompositionId: artifacts.inputSet.rule_package_composition_id,
      engineVersion: artifacts.inputSet.engine_version,
      calculationContextHash: provenance.calculationContextHash ?? null,
      arrangement: provenance.versions,
    },
    supersession: isJsonObject(provenance.supersession) ? provenance.supersession : null,
    run: {
      id: artifacts.run.id,
      type: artifacts.run.run_type,
      status: artifacts.run.status,
      startedAt: artifacts.run.started_at,
      finishedAt: artifacts.run.finished_at,
      resultHash: artifacts.run.result_hash,
    },
    result: {
      pensionBoundary: {
        status: pensionStatus ?? 'UNSPECIFIED',
        amountIncluded: !pensionExcluded,
        reasonCode: pensionReasonCode,
      },
      components: artifacts.componentResults.map((row) => {
        const isExcludedPensionComponent = pensionExcluded
          && (row.component_key === 'employee_pension' || row.component_key === 'employer_pension')
        return {
          key: row.component_key,
          payload: isExcludedPensionComponent
            ? jsonRecord({
              ...(isJsonObject(row.result_payload) ? row.result_payload : {}),
              amount: null,
              status: 'EXCLUDED_SOURCE_GAP',
              reasonCode: pensionReasonCode,
            })
            : row.result_payload,
        }
      }),
      controls: artifacts.controls.map((row) => ({ key: row.control_key, status: row.status, details: row.detail_payload })),
      trace: artifacts.trace?.trace_payload ?? null,
    },
    finalizedAt: finalizedEvent?.created_at ?? null,
  }
  const bytes = Buffer.from(JSON.stringify(payload, null, 2), 'utf8')
  const payrollScope = payrollScopeRecord(input.scope, input.payrollAdministrationId)
  const metadata = {
    ...payrollScope,
    calculation_run_id: input.runId,
    artifact_type: 'TECHNICAL_JSON' as const,
    file_name: `payrun01-${artifacts.payrollPeriod.period_year}-${String(artifacts.payrollPeriod.period_month).padStart(2, '0')}-${input.kind.toLowerCase()}-${input.runId}.json`,
    content_type: 'application/json; charset=utf-8',
    provenance_json: jsonRecord({
      schemaVersion: 'PAYRUN01_TECHNICAL_ARTIFACT_PROVENANCE_V1',
      inputHash: artifacts.inputSet.input_hash,
      resultHash: artifacts.run.result_hash,
      finalizedEventId: finalizedEvent?.id ?? null,
      generatedAt: payload.generatedAt,
      supersession: isJsonObject(provenance.supersession) ? provenance.supersession : null,
    }) as Exclude<PayrollJson, null>,
    created_by_user_id: input.actorUserId,
  }
  try {
    return await dependencies.payrunRepository.insertArtifact(input.scope, input.payrollAdministrationId, metadata, bytes)
  } catch (error) {
    if (!(error instanceof PayrollCalculationRepositoryError) || error.code !== 'PAYRUN01_ARTIFACT_ALREADY_EXISTS') throw error
    const concurrent = await dependencies.payrunRepository.getArtifact(input.scope, input.payrollAdministrationId, input.runId, 'TECHNICAL_JSON')
    if (!concurrent) throw error
    return concurrent
  }
}

export async function createPayrun01PayslipPdfArtifact(
  input: Payrun01LifecycleInput,
  dependencies = defaultDependencies(),
) {
  const { artifacts, inputReference, events } = await loadLifecycleEvidence(input, dependencies, false)
  assertPayrun01Finalized(events, input.runId)
  if (artifacts.run.status !== 'SUCCEEDED' || artifacts.controls.some((control) => control.status === 'FAIL')) {
    throw new SyntheticPayrollServiceError('PAYROLL_CALCULATION_BLOCKED', input.runId)
  }

  const existing = await dependencies.payrunRepository.getArtifact(
    input.scope,
    input.payrollAdministrationId,
    input.runId,
    'PAYSLIP_PDF',
  )
  if (existing) return existing

  const reference = inputReference.input_provenance_json
  const versions = isJsonObject(reference) && isJsonObject(reference.versions) ? reference.versions : null
  const assignmentVersionNumber = jsonNumber(versions?.assignmentVersionNumber)
  const configVersionNumber = jsonNumber(versions?.configVersionNumber)
  if (assignmentVersionNumber === null || configVersionNumber === null) {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', input.runId)
  }
  const assignmentId = deterministicUuid(`payrun01-assignment:${input.scope.tenantId}:${input.scope.hrGroupId}:${input.scope.administrationId}:${artifacts.sourceSnapshot.source_employment_id}:${input.kind}`)
  const assignmentVersion = await dependencies.payrunRepository.getAssignmentVersion(
    input.scope,
    input.payrollAdministrationId,
    assignmentId,
    assignmentVersionNumber,
  )
  const configVersion = await dependencies.payrunRepository.getCalculationConfigVersion(
    input.scope,
    input.payrollAdministrationId,
    artifacts.sourceSnapshot.source_employment_id,
    configVersionNumber,
  )
  if (!assignmentVersion || assignmentVersion.id !== inputReference.assignment_version_id
    || !isJsonObject(assignmentVersion.assignment_json)
    || !versions || jsonString(versions.assignmentHash) !== assignmentVersion.assignment_hash
    || !configVersion || configVersion.id !== inputReference.config_version_id
    || !versions || jsonString(versions.configHash) !== configVersion.config_hash
    || !isJsonObject(configVersion.config_json)) {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', input.runId)
  }
  const rawProfile = assignmentVersion.assignment_json.payslipProfile
  if (!isJsonObject(rawProfile)) throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', input.runId)
  const status = jsonString(rawProfile.status)
  const employerName = jsonString(rawProfile.employerName)
  const employeeName = jsonString(rawProfile.employeeName)
  const writtenContract = jsonBoolean(rawProfile.writtenContract)
  const sourceEmployment = isJsonObject(artifacts.sourceSnapshot.source_payload)
    && isJsonObject(artifacts.sourceSnapshot.source_payload.employment)
    ? artifacts.sourceSnapshot.source_payload.employment
    : null
  const sourceContractType = jsonString(sourceEmployment?.contractType)
  const contractType = sourceContractType === 'INDEFINITE' || sourceContractType === 'PERMANENT'
    ? 'INDEFINITE'
    : sourceContractType === 'DEFINITE' || sourceContractType === 'FIXED_TERM' || sourceContractType === 'TEMPORARY'
      ? 'DEFINITE'
      : null
  const isOnCall = jsonBoolean(rawProfile.isOnCall)
  const contractHoursPerWeek = jsonNumber(rawProfile.contractHoursPerWeek)
  const fulltimeHoursPerWeek = jsonNumber(rawProfile.fulltimeHoursPerWeek)
  const minimumHourlyWage = jsonString(rawProfile.minimumHourlyWage)
  const minimumHourlyWageEffectiveFrom = jsonString(rawProfile.minimumHourlyWageEffectiveFrom)
  const ageCategory = jsonString(rawProfile.minimumHourlyWageAgeCategory)
  const profileSource = jsonString(rawProfile.source)
  const pensionConfig = isJsonObject(configVersion.config_json.pension) ? configVersion.config_json.pension : undefined
  const pensionMode = jsonString(pensionConfig?.mode)
  const pensionTreatment = pensionMode === 'EXCLUDED_SOURCE_GAP'
    ? 'EXCLUDED_SOURCE_GAP'
    : pensionMode === 'DISABLED' ? 'DISABLED' : undefined
  if (status !== 'SYNTHETIC_TEST_PROFILE' || !employerName || !employeeName || writtenContract === null
    || (contractType !== 'DEFINITE' && contractType !== 'INDEFINITE') || isOnCall === null
    || contractHoursPerWeek === null || fulltimeHoursPerWeek === null
    || !minimumHourlyWage || !minimumHourlyWageEffectiveFrom
    || ageCategory !== 'AGE_21_PLUS' || !profileSource) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
  const profile: Payrun01PayslipPdfInput['profile'] = {
    status,
    employerName,
    employeeName,
    writtenContract,
    contractType,
    isOnCall,
    contractHoursPerWeek,
    fulltimeHoursPerWeek,
    minimumHourlyWage,
    minimumHourlyWageEffectiveFrom,
    minimumHourlyWageAgeCategory: ageCategory,
    ...(pensionTreatment ? { pensionTreatment } : {}),
    source: profileSource,
  }
  const components = artifacts.componentResults.flatMap((row) => {
    if (!isJsonObject(row.result_payload)) return []
    const amount = jsonString(row.result_payload.amount)
    return amount === null ? [] : [{ key: row.component_key, amount }]
  })
  let bytes: Uint8Array
  try {
    bytes = await renderPayrun01PayslipPdf({
      period: {
        year: artifacts.payrollPeriod.period_year,
        month: artifacts.payrollPeriod.period_month,
        startsOn: artifacts.payrollPeriod.starts_on,
        endsOn: artifacts.payrollPeriod.ends_on,
      },
      run: { id: artifacts.run.id, resultHash: artifacts.run.result_hash ?? '' },
      versions: {
        sourceHash: artifacts.sourceSnapshot.source_hash,
        inputHash: artifacts.inputSet.input_hash,
        configurationHash: configVersion.config_hash,
        compositionId: artifacts.inputSet.rule_package_composition_id,
        engineVersion: artifacts.inputSet.engine_version,
      },
      profile,
      components,
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('PAYRUN01_PAYSLIP_')) {
      throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
    }
    throw error
  }

  const pdfHash = createHash('sha256').update(bytes).digest('hex')
  const finalizedEvent = events.find((event) => event.calculation_run_id === input.runId && event.event_type === 'FINALIZED')
  const metadata = {
    ...payrollScopeRecord(input.scope, input.payrollAdministrationId),
    calculation_run_id: input.runId,
    artifact_type: 'PAYSLIP_PDF' as const,
    file_name: `payrun01-${artifacts.payrollPeriod.period_year}-${String(artifacts.payrollPeriod.period_month).padStart(2, '0')}-${input.kind.toLowerCase()}-${input.runId}.pdf`,
    content_type: 'application/pdf',
    provenance_json: jsonRecord({
      schemaVersion: 'PAYRUN01_TEST_PAYSLIP_PDF_PROVENANCE_V1',
      inputHash: artifacts.inputSet.input_hash,
      resultHash: artifacts.run.result_hash,
      pdfHash,
      finalizedEventId: finalizedEvent?.id ?? null,
      configHash: configVersion.config_hash,
      presentationProfileStatus: profile.status,
      supersession: isJsonObject(reference) && isJsonObject(reference.supersession) ? reference.supersession : null,
    }) as Exclude<PayrollJson, null>,
    created_by_user_id: input.actorUserId,
  }
  try {
    return await dependencies.payrunRepository.insertArtifact(input.scope, input.payrollAdministrationId, metadata, bytes)
  } catch (error) {
    if (!(error instanceof PayrollCalculationRepositoryError) || error.code !== 'PAYRUN01_ARTIFACT_ALREADY_EXISTS') throw error
    const concurrent = await dependencies.payrunRepository.getArtifact(input.scope, input.payrollAdministrationId, input.runId, 'PAYSLIP_PDF')
    if (!concurrent) throw error
    return concurrent
  }
}

export async function getPayrun01PayslipPdfArtifact(
  input: Payrun01LifecycleInput,
  dependencies = defaultDependencies(),
) {
  const { events } = await loadLifecycleEvidence(input, dependencies, false)
  assertPayrun01Finalized(events, input.runId)
  return await dependencies.payrunRepository.getArtifact(
    input.scope,
    input.payrollAdministrationId,
    input.runId,
    'PAYSLIP_PDF',
  )
}

export async function getPayrun01TechnicalJsonArtifact(
  input: Payrun01LifecycleInput,
  dependencies = defaultDependencies(),
) {
  const { events } = await loadLifecycleEvidence(input, dependencies, false)
  assertPayrun01Finalized(events, input.runId)
  return await dependencies.payrunRepository.getArtifact(input.scope, input.payrollAdministrationId, input.runId, 'TECHNICAL_JSON')
}

export async function getPayrun01TechnicalJsonArtifactForRun(
  input: {
    readonly scope: PayrollScope
    readonly payrollAdministrationId: string
    readonly actorUserId: string
    readonly runId: string
  },
  dependencies = defaultDependencies(),
) {
  if (!isUuid(input.runId) || !isUuid(input.payrollAdministrationId) || !isUuid(input.actorUserId)) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  }
  if (!dependencies.enabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  const artifacts = await dependencies.payrollRepository.getLatestSyntheticArtifacts(
    input.scope,
    input.payrollAdministrationId,
    undefined,
    input.runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  if (!artifacts || artifacts.run.id !== input.runId) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  const employeeId = artifacts.sourceSnapshot.source_employee_id
  const kind = payrun01ScenarioForTestPersona(employeeId)
  if (!kind) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  return await getPayrun01TechnicalJsonArtifact({ ...input, employeeId, kind }, dependencies)
}

export async function getPayrun01PayslipPdfArtifactForRun(
  input: {
    readonly scope: PayrollScope
    readonly payrollAdministrationId: string
    readonly actorUserId: string
    readonly runId: string
  },
  dependencies = defaultDependencies(),
) {
  if (!isUuid(input.runId) || !isUuid(input.payrollAdministrationId) || !isUuid(input.actorUserId)) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  }
  if (!dependencies.enabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  const artifacts = await dependencies.payrollRepository.getLatestSyntheticArtifacts(
    input.scope,
    input.payrollAdministrationId,
    undefined,
    input.runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  if (!artifacts || artifacts.run.id !== input.runId) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  const employeeId = artifacts.sourceSnapshot.source_employee_id
  const kind = payrun01ScenarioForTestPersona(employeeId)
  if (!kind) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  return await getPayrun01PayslipPdfArtifact({ ...input, employeeId, kind, runId: input.runId }, dependencies)
}

export async function reviewPayrun01Payroll(
  input: Payrun01LifecycleInput,
  dependencies = defaultDependencies(),
): Promise<void> {
  const { artifacts, events, sourceHash } = await loadLifecycleEvidence(input, dependencies)
  const latest = events.at(-1)
  if (!latest || latest.event_type !== 'CONCEPT' || latest.calculation_run_id !== input.runId) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
  await dependencies.payrunRepository.insertLifecycleEvent(input.scope, input.payrollAdministrationId, {
    ...payrollScopeRecord(input.scope, input.payrollAdministrationId),
    payroll_period_id: artifacts.payrollPeriod.id,
    source_employment_id: artifacts.sourceSnapshot.source_employment_id,
    calculation_run_id: input.runId,
    revision: latest.revision,
    event_sequence: 2,
    event_type: 'REVIEWED',
    event_payload: jsonRecord({ sourceSnapshotHash: sourceHash, inputHash: artifacts.inputSet.input_hash, resultHash: artifacts.run.result_hash, reviewedAt: (dependencies.now ?? (() => new Date()))().toISOString() }) as Exclude<PayrollJson, null>,
    created_by_user_id: input.actorUserId,
  })
}

export async function finalizePayrun01Payroll(
  input: Payrun01LifecycleInput,
  dependencies = defaultDependencies(),
): Promise<void> {
  const { artifacts, events, sourceHash } = await loadLifecycleEvidence(input, dependencies)
  const latest = events.at(-1)
  if (!latest || latest.event_type !== 'REVIEWED' || latest.calculation_run_id !== input.runId) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
  const pensionReadiness = artifacts.controls.find((control) => control.control_key === 'PAYRUN01-CTRL-009-PENSION-RULE-READY')
  const sourcePayload = isJsonObject(artifacts.sourceSnapshot.source_payload) ? artifacts.sourceSnapshot.source_payload : undefined
  const payrollOwned = isJsonObject(sourcePayload?.payrollOwned) ? sourcePayload.payrollOwned : undefined
  const pension = isJsonObject(payrollOwned?.pension) ? payrollOwned.pension : undefined
  const pensionFiscalStatus = jsonString(pension?.fiscalTreatmentStatus)
  const pensionReasonCode = jsonString(pension?.reasonCode)
  if (pensionReadiness?.status !== 'PASS' || pensionFiscalStatus === 'UNVERIFIED') {
    throw new SyntheticPayrollServiceError(
      'PAYROLL_CALCULATION_BLOCKED',
      input.runId,
      pensionReasonCode ?? 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED',
    )
  }
  await dependencies.payrunRepository.insertLifecycleEvent(input.scope, input.payrollAdministrationId, {
    ...payrollScopeRecord(input.scope, input.payrollAdministrationId),
    payroll_period_id: artifacts.payrollPeriod.id,
    source_employment_id: artifacts.sourceSnapshot.source_employment_id,
    calculation_run_id: input.runId,
    revision: latest.revision,
    event_sequence: 3,
    event_type: 'FINALIZED',
    event_payload: jsonRecord({ sourceSnapshotHash: sourceHash, inputHash: artifacts.inputSet.input_hash, resultHash: artifacts.run.result_hash, finalizedAt: (dependencies.now ?? (() => new Date()))().toISOString() }) as Exclude<PayrollJson, null>,
    created_by_user_id: input.actorUserId,
  })
}

export async function listPayrun01Candidates(period: SyntheticPayrollPeriod = PAYRUN01_PERIOD): Promise<readonly Payrun01Candidate[]> {
  if (!isPayrollLabEnabled()) return []
  if (!isPayrun01AcceptancePeriod('KINDEROPVANG_TEST', period)) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  const access = await requireComponentLibraryAccess(false)
  const employeeAccess = await requirePermission('employee:read')
  if (employeeAccess.tenantId !== access.scope.tenantId
    || employeeAccess.hrGroupId !== access.scope.hrGroupId
    || employeeAccess.administrationId !== access.scope.administrationId) return []
  const supabase = await createClient()
  const [employeesResult, employmentsResult] = await Promise.all([
    supabase.from('employees').select('id, employee_number, first_name')
      .eq('tenant_id', access.scope.tenantId).eq('hr_group_id', access.scope.hrGroupId)
      .in('id', Object.keys(PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID))
      .eq('is_archived', false).is('deleted_at', null)
      .order('employee_number', { ascending: true }).limit(3),
    supabase.from('employments').select('id, employee_id, starts_on, ends_on')
      .eq('tenant_id', access.scope.tenantId).eq('hr_group_id', access.scope.hrGroupId)
      .eq('administration_id', access.scope.administrationId).eq('record_status', 'CONFIRMED')
      .in('employee_id', Object.keys(PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID))
      .is('deleted_at', null).lte('starts_on', periodEndDate(period)).limit(20),
  ])
  if (employeesResult.error || employmentsResult.error || !employeesResult.data || !employmentsResult.data) {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED')
  }
  const countByEmployee = new Map<string, number>()
  for (const employment of employmentsResult.data) {
    if (employment.ends_on !== null && employment.ends_on < periodStartDate(period)) continue
    countByEmployee.set(employment.employee_id, (countByEmployee.get(employment.employee_id) ?? 0) + 1)
  }
  return employeesResult.data
    .filter((employee) => countByEmployee.has(employee.id))
    .map((employee) => ({
      employeeId: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      confirmedEmploymentCount: countByEmployee.get(employee.id) ?? 0,
      scenarioKind: PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID[employee.id]!,
    }))
}

export async function runPayrun01PayrollActionInput(employeeId: string, kind: Payrun01CompositionKind): Promise<SyntheticPayrollView> {
  if (payrun01ScenarioForTestPersona(employeeId) !== kind) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  const access = await requireComponentLibraryAccess(true)
  return await runPayrun01Payroll({
    scope: access.scope,
    payrollAdministrationId: access.administration.id,
    actorUserId: access.actorUserId,
    employeeId,
    kind,
  })
}
