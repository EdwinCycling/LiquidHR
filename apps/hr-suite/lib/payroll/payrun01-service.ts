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
import { renderPayrun01PayslipPdf, type Payrun01PayslipPdfInput } from './payrun01-payslip-pdf'
import {
  projectPayrun01SourceSnapshot,
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

export const PAYRUN01_PERIOD: SyntheticPayrollPeriod = Object.freeze({ year: 2026, month: 10 })
export const PAYRUN01_PERIOD_START = '2026-10-01'
export const PAYRUN01_PERIOD_END = '2026-10-31'

export const PAYRUN01_SCENARIO_OPTIONS = Object.freeze([
  { value: 'KINDEROPVANG_TEST', label: 'Jan — Kinderopvang TEST-persona' },
  { value: 'DEMO_COMPANY_TEST', label: 'Lisa — LiquidHR demo-bedrijfsregeling (TEST-only)' },
] as const)

const PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID: Readonly<Record<string, Payrun01CompositionKind>> = Object.freeze({
  '66ef22a5-5777-44dc-9bde-44a65d0a6d60': 'KINDEROPVANG_TEST',
  '64ad3a23-f59a-4ed0-af41-26dda20ff067': 'DEMO_COMPANY_TEST',
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
  readonly confirmedOctoberEmploymentCount: number
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
}

export type Payrun01LifecycleInput = Payrun01RunInput & { readonly runId: string }

type PersistedPayrun01Versions = {
  readonly assignmentVersionId: string
  readonly assignmentHash: string
  readonly configVersionId: string
  readonly configHash: string
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
    schemaVersion: 'PAYRUN01_SOURCE_SNAPSHOT_IDENTITY_V2',
    scenarioKind: input.scenarioKind,
    scenarioConfiguration: input.scenarioConfiguration,
    rulePackageIdentity: input.rulePackageIdentity,
    taxProfile: input.taxProfile,
  }))
  return deterministicUuid([
    'payrun01-source-snapshot:v2',
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

function scenarioKey(kind: Payrun01CompositionKind): 'KINDEROPVANG_TEST' | 'DEMO_COMPANY_TEST' {
  if (kind === 'KINDEROPVANG_TEST' || kind === 'DEMO_COMPANY_TEST') return kind
  throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
}

export function payrun01ScenarioForTestPersona(employeeId: string): Payrun01CompositionKind | null {
  return PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID[employeeId] ?? null
}

function personaConfiguration(kind: Payrun01CompositionKind) {
  if (kind === 'KINDEROPVANG_TEST') {
    return {
      version: 1,
      startDate: '2026-09-01',
      arrangementName: 'PAYRUN01 TEST PERSONA ASSIGNMENT — CAO Kinderopvang',
      pricingMode: 'CAO_PRORATION' as const,
      expectedSalary: {
        pricingMode: 'CAO_PRORATION' as const,
        fulltimeMonthlyAmount: '3425.00',
        currencyCode: 'EUR',
        paymentFrequency: 'MONTHLY',
        salaryRoute: 'CAO',
        salaryBasis: 'CAO',
        salaryStepCode: '20',
        caoScaleName: '6',
        caoStepName: '20',
      },
      expectedSchedule: {
        contractHoursPerWeek: 32,
        fulltimeHoursPerWeek: 36,
        partTimeFactor: 32 / 36,
        scheduleType: 'FIXED',
        isOnCall: false,
      },
      opening: {
        grossWage: '3044.44',
        holidayReserve: '243.56',
        yearEndReserve: '243.56',
        note: 'Synthetic TEST opening balance for the September 2026 gross and 8% reservations; not reconstructed payroll.',
      },
      payslipProfile: {
        status: 'SYNTHETIC_TEST_PROFILE',
        employerName: 'Kinderopvang TEST (PAYRUN01)',
        employeeName: 'Jan TEST',
        writtenContract: true,
        contractType: 'DEFINITE',
        isOnCall: false,
        contractHoursPerWeek: 32,
        fulltimeHoursPerWeek: 36,
        minimumHourlyWage: '14.99',
        minimumHourlyWageEffectiveFrom: '2026-07-01',
        minimumHourlyWageAgeCategory: 'AGE_21_PLUS',
        source: 'PAYRUN01 synthetic payslip presentation inputs; not Core contract evidence.',
      },
      pension: { mode: 'UNSUPPORTED' as const, reasonCode: 'PFZW_2026_MONTHLY_PRORATION_AND_ROUNDING_UNVERIFIED' },
      reserveRates: { holidayAllowance: '8.00', yearEnd: '8.00' },
      functionAssignment: {
        function: 'Pedagogisch professional',
        scale: '6',
        step: '20',
        fulltimeMonthlySalary: '3425.00',
        officialSource: 'CAO Kinderopvang 2025-2026, function matrix and salary table effective 2026-09-01.',
        personaChoices: ['salaryStepCode', 'contractHoursPerWeek', 'effectiveDate'],
      },
    }
  }

  if (kind === 'DEMO_COMPANY_TEST') {
    return {
      version: 3,
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
        contractType: 'INDEFINITE',
        isOnCall: false,
        contractHoursPerWeek: 40,
        fulltimeHoursPerWeek: 40,
        minimumHourlyWage: '14.99',
        minimumHourlyWageEffectiveFrom: '2026-07-01',
        minimumHourlyWageAgeCategory: 'AGE_21_PLUS',
        source: 'PAYRUN01 synthetic payslip presentation inputs; not Core contract evidence.',
      },
      pension: { mode: 'DISABLED' as const },
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

  throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
}

function makeTaxProfile(): Payrun01SourceProjectionConfig['taxProfile'] {
  return {
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
}

function openingBalance(kind: Payrun01CompositionKind, configuration: ReturnType<typeof personaConfiguration>) {
  const content = {
    schemaVersion: 'PAYRUN01_TEST_OPENING_CUMULATIVE_V1',
    scenario: kind,
    throughPeriod: { year: 2026, month: 9 },
    status: 'SYNTHETIC_TEST_OPENING_BALANCE',
    grossWage: configuration.opening.grossWage,
    holidayReserve: configuration.opening.holidayReserve,
    yearEndReserve: configuration.opening.yearEndReserve,
    provenance: configuration.opening.note,
  }
  return { content, hash: sha256(stableSerialize(content)) }
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
  readonly now: Date
}) : Payrun01SourceProjectionConfig {
  const configuration = personaConfiguration(input.kind)
  const packageDefinition = createPayrun01RulePackage(input.kind)
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
    taxProfile: makeTaxProfile(),
    calculationIncomeRelationshipId: deterministicUuid(`payrun01-income-scope:${input.scope.tenantId}:${input.scope.hrGroupId}:${input.scope.administrationId}:${input.source.sourceEmploymentId}`),
    fallbackReasonCodes: ['CONTROL02_CONTRACT_PENDING', 'NO_LINKED_INCOME_RELATIONSHIP'],
    additionalHourCompensation: { mode: 'TIME_OFF', cashAmount: '0.00' } as const,
    pension: configuration.pension,
    employerRates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
    employerRateProvenance: EMPLOYER_RATE_SOURCES,
    employerClassification: {
      status: 'TEST_ONLY',
      size: 'SMALL_EMPLOYER_ASSUMPTION',
      whkSector: '35_HEALTH_PSYCHOLOGICAL_AND_SOCIETAL_INTERESTS',
      awf: 'HIGH_RATE_TEST_ASSUMPTION',
    },
    reserveRates: configuration.reserveRates,
    openingCumulative: {
      status: 'SYNTHETIC_TEST',
      throughPeriod: { year: 2026, month: 9 },
      hash: input.openingHash,
    },
    socialWageCapClear: true,
    personaLabel: input.kind === 'KINDEROPVANG_TEST' ? 'Jan' : 'Lisa',
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
    expectedSalary: configuration.expectedSalary,
    expectedSchedule: configuration.expectedSchedule,
    taxProfile: makeTaxProfile(),
    calculationIncomeRelationshipId: payrollOwnedConfig.calculationIncomeRelationshipId,
    incomeRelationshipFallbackReasonCodes: payrollOwnedConfig.fallbackReasonCodes,
    additionalHourCompensation: payrollOwnedConfig.additionalHourCompensation,
    pension: configuration.pension,
    employerRates: payrollOwnedConfig.employerRates,
    reserveRates: configuration.reserveRates,
    openingCumulatives: {
      id: input.openingSnapshotId,
      status: 'SYNTHETIC_TEST',
      throughPeriod: { year: 2026, month: 9 },
      sourceHash: input.openingHash,
      grossWage: configuration.opening.grossWage,
      holidayReserve: configuration.opening.holidayReserve,
      yearEndReserve: configuration.opening.yearEndReserve,
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

function jsonString(value: PayrollJson | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function jsonNumber(value: PayrollJson | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function jsonBoolean(value: PayrollJson | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function buildPayrun01Scenario(input: Payrun01RunInput, dependencies: Payrun01ServiceDependencies): PayrollTestScenario {
  const kind = scenarioKey(input.kind)
  const configuration = personaConfiguration(kind)
  const rulePackage = createPayrun01RulePackage(kind)
  let currentSource: PayrollSourceSnapshot | null = null
  let persistedVersions: PersistedPayrun01Versions | null = null
  let latestPayrollPeriodId: string | null = null
  let nextLifecycleRevision: number | null = null
  const now = dependencies.now ?? (() => new Date())

  return {
    compositionId: rulePackage.compositionId,
    runType: 'INDIVIDUAL_PAYROLL',
    reusePersistedInputs: true,
    period: PAYRUN01_PERIOD,
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
          taxProfile: makeTaxProfile(),
        }),
      }
      currentSource = stableSnapshot
      return stableSnapshot
    },
    resolveCalculationContext: async ({ scope, payrollAdministrationId, actorUserId, sourceSnapshot }) => {
      const effectiveSource = currentSource
      if (!effectiveSource || effectiveSource.id !== sourceSnapshot.id) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
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
      const assignmentId = deterministicUuid(`payrun01-assignment:${scope.tenantId}:${scope.hrGroupId}:${scope.administrationId}:${sourceSnapshot.sourceEmploymentId}:${kind}`)
      const supersedesVersion = configuration.version > 1 ? configuration.version - 1 : null
      const assignmentContent = {
        schemaVersion: 'PAYRUN01_ASSIGNMENT_V1',
        scenario: kind,
        supersedesVersion,
        arrangementName: configuration.arrangementName,
        sourceEmploymentId: sourceSnapshot.sourceEmploymentId,
        effectiveFrom: configuration.startDate,
        effectiveTo: null,
        salaryMode: configuration.pricingMode,
        expectedSalary: configuration.expectedSalary,
        expectedSchedule: configuration.expectedSchedule,
        payslipProfile: configuration.payslipProfile,
        officialSource: configuration.functionAssignment.officialSource,
        personaChoices: configuration.functionAssignment.personaChoices,
        provenanceStatus: 'TEST_ONLY',
        provenanceSource: PAYRUN01_PROVENANCE_SOURCE,
      }
      const assignmentHash = sha256(stableSerialize(assignmentContent))
      const assignmentVersion = await dependencies.payrunRepository.getOrCreateAssignmentVersion(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        assignment_id: assignmentId,
        assignment_version: configuration.version,
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        effective_from: configuration.startDate,
        effective_to: null,
        assignment_json: jsonRecord(assignmentContent) as Exclude<PayrollJson, null>,
        assignment_hash: assignmentHash,
        provenance_status: 'TEST_ONLY',
        provenance_source: PAYRUN01_PROVENANCE_SOURCE,
        created_by_user_id: actorUserId,
      })

      const opening = openingBalance(kind, configuration)
      const configContent = {
        schemaVersion: 'PAYRUN01_CALCULATION_CONFIG_V1',
        scenario: kind,
        supersedesVersion,
        effectiveFrom: configuration.startDate,
        sourceEmploymentId: sourceSnapshot.sourceEmploymentId,
        expectedEmploymentStartDate: configuration.startDate,
        expectedSalary: configuration.expectedSalary,
        expectedSchedule: configuration.expectedSchedule,
        taxProfile: makeTaxProfile(),
        calculationIncomeRelationship: {
          mode: 'PAYROLL_OWNED_TEST_SCOPE_FALLBACK',
          fallbackReasonCodes: ['CONTROL02_CONTRACT_PENDING', 'NO_LINKED_INCOME_RELATIONSHIP'],
          canonicalEmploymentIsNotIncomeRelationship: true,
        },
        additionalHours: { mode: 'TIME_OFF', cashAmount: '0.00' },
        pension: configuration.pension,
        employerRates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
        employerRateProvenance: EMPLOYER_RATE_SOURCES,
        employerClassification: {
          status: 'TEST_ONLY',
          size: 'SMALL_EMPLOYER_ASSUMPTION',
          whkSector: '35_HEALTH_PSYCHOLOGICAL_AND_SOCIETAL_INTERESTS',
          awf: 'HIGH_RATE_TEST_ASSUMPTION',
        },
        reserves: configuration.reserveRates,
        openingBalance: opening.content,
        declarationStatus: 'OUT_OF_SCOPE_NOT_SUBMITTED',
        paymentStatus: 'OUT_OF_SCOPE_NOT_EXECUTED',
      }
      const configHash = sha256(stableSerialize(configContent))
      const configVersion = await dependencies.payrunRepository.getOrCreateCalculationConfigVersion(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        config_version: configuration.version,
        effective_from: configuration.startDate,
        effective_to: null,
        config_json: jsonRecord(configContent) as Exclude<PayrollJson, null>,
        config_hash: configHash,
        provenance_status: 'TEST_ONLY',
        provenance_source: PAYRUN01_PROVENANCE_SOURCE,
        created_by_user_id: actorUserId,
      })

      const compositionHash = sha256(stableSerialize(ruleComposition))
      const composition = await dependencies.payrunRepository.getOrCreateArrangementCompositionSnapshot(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        assignment_version_id: assignmentVersion.id,
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        as_of_date: PAYRUN01_PERIOD_START,
        snapshot_json: jsonRecord(ruleComposition) as Exclude<PayrollJson, null>,
        snapshot_hash: compositionHash,
        created_by_user_id: actorUserId,
      })

      const openingBalanceRow = await dependencies.payrunRepository.getOrCreateOpeningCumulativeSnapshot(scope, payrollAdministrationId, {
        ...payrollScopeRecord(scope, payrollAdministrationId),
        source_employment_id: sourceSnapshot.sourceEmploymentId,
        snapshot_version: configuration.version,
        as_of_date: '2026-09-30',
        opening_balance_json: jsonRecord(opening.content) as Exclude<PayrollJson, null>,
        snapshot_hash: opening.hash,
        provenance_status: 'TEST_OPENING_BALANCE',
        provenance_source: PAYRUN01_PROVENANCE_SOURCE,
        created_by_user_id: actorUserId,
      })

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
        now: now(),
      })
      const projection = projectPayrun01SourceSnapshot(sourceSnapshot, projectionConfig)
      const linkedValues: PersistedPayrun01Versions = {
        assignmentVersionId: assignmentVersion.id,
        assignmentHash: assignmentVersion.assignment_hash,
        configVersionId: configVersion.id,
        configHash: configVersion.config_hash,
        compositionSnapshotId: composition.id,
        compositionHash: composition.snapshot_hash,
        openingCumulativeSnapshotId: openingBalanceRow.id,
        openingCumulativeHash: openingBalanceRow.snapshot_hash,
        calculationIncomeRelationshipId: projection.calculationIncomeRelationshipId ?? projectionConfig.calculationIncomeRelationshipId,
        asOfDate: PAYRUN01_PERIOD_START,
        sourceSnapshotHash: sourceSnapshot.sourceHash,
      }
      persistedVersions = linkedValues
      const contextHash = sha256(stableSerialize({
        schemaVersion: 'PAYRUN01_CALCULATION_CONTEXT_V1',
        sourceHash: projection.snapshot.sourceHash,
        assignmentVersionId: linkedValues.assignmentVersionId,
        assignmentHash: linkedValues.assignmentHash,
        configVersionId: linkedValues.configVersionId,
        configHash: linkedValues.configHash,
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
          personaLabel: kind === 'KINDEROPVANG_TEST' ? 'Jan' : 'Lisa',
          versions: linkedValues,
          projection: projection.provenance,
          payrollRuleCompositionHash: compositionHash,
          downstream: {
            payment: { status: 'NOT_READY_OR_NOT_ASSESSED', scope: 'PAYMENT_EXECUTION_OUT_OF_SCOPE' },
            declaration: { status: 'BLOCKED_OUT_OF_SCOPE', scope: 'LOONAANGIFTE_SUBMISSION_OUT_OF_SCOPE' },
          },
        }),
      } satisfies PayrollCalculationContext
    },
    persistInputReference: async ({ scope, payrollAdministrationId, actorUserId, inputSet, payrollPeriod, sourceSnapshot, calculationContext }) => {
      const versions = persistedVersions
      if (!versions || inputSet.source_snapshot_id !== sourceSnapshot.id) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
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
      const events = await dependencies.payrunRepository.listLifecycleEvents(scope, payrollAdministrationId, payrollPeriod.id, sourceSnapshot.source_employment_id)
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
  const packageDefinition = createPayrun01RulePackage(input.kind)
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
  return await createPayrun01PayrollService(dependencies, input)
    .runSyntheticPayroll(input.scope, input.payrollAdministrationId, input.actorUserId)
}

export async function getLatestPayrun01Payroll(
  scope: PayrollScope,
  payrollAdministrationId: string,
  kind: Payrun01CompositionKind,
  runId?: string,
  dependencies = defaultDependencies(),
): Promise<SyntheticPayrollView | null> {
  if (!dependencies.enabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  const scenario = buildPayrun01Scenario({
    scope,
    payrollAdministrationId,
    actorUserId: '10000000-0000-4000-8000-000000000001',
    employeeId: '20000000-0000-4000-8000-000000000002',
    kind,
  }, dependencies)
  return await createSyntheticPayrollService({
    scenario,
    repository: dependencies.payrollRepository,
    isEnabled: dependencies.enabled,
    engine: {
      buildInputs: (snapshot, effectiveDate, context) => buildCalculationInputs(snapshot, createPayrun01RulePackage(kind), {
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
  }).getLatestSyntheticPayroll(scope, payrollAdministrationId, runId)
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
) {
  assertLifecycleActor(input)
  if (!dependencies.enabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  const rulePackage = createPayrun01RulePackage(scenarioKey(input.kind))
  const artifacts = await dependencies.payrollRepository.getLatestSyntheticArtifacts(
    input.scope,
    input.payrollAdministrationId,
    rulePackage.compositionId,
    input.runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  if (!artifacts || artifacts.run.id !== input.runId || artifacts.run.status !== 'SUCCEEDED' || !artifacts.run.result_hash) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
  if (artifacts.sourceSnapshot.source_employee_id !== input.employeeId) {
    throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', input.runId)
  }
  if (artifacts.controls.some((control) => control.status === 'FAIL')) {
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
  const { artifacts, events } = await loadLifecycleEvidence(input, dependencies, false)
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
    run: {
      id: artifacts.run.id,
      type: artifacts.run.run_type,
      status: artifacts.run.status,
      startedAt: artifacts.run.started_at,
      finishedAt: artifacts.run.finished_at,
      resultHash: artifacts.run.result_hash,
    },
    result: {
      components: artifacts.componentResults.map((row) => ({ key: row.component_key, payload: row.result_payload })),
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
    file_name: `payrun01-2026-10-${input.kind.toLowerCase()}-${input.runId}.json`,
    content_type: 'application/json; charset=utf-8',
    provenance_json: jsonRecord({
      schemaVersion: 'PAYRUN01_TECHNICAL_ARTIFACT_PROVENANCE_V1',
      inputHash: artifacts.inputSet.input_hash,
      resultHash: artifacts.run.result_hash,
      finalizedEventId: finalizedEvent?.id ?? null,
      generatedAt: payload.generatedAt,
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

  const configuration = personaConfiguration(input.kind)
  const assignmentId = deterministicUuid(`payrun01-assignment:${input.scope.tenantId}:${input.scope.hrGroupId}:${input.scope.administrationId}:${artifacts.sourceSnapshot.source_employment_id}:${input.kind}`)
  const assignmentVersion = await dependencies.payrunRepository.getAssignmentVersion(
    input.scope,
    input.payrollAdministrationId,
    assignmentId,
    configuration.version,
  )
  const configVersion = await dependencies.payrunRepository.getCalculationConfigVersion(
    input.scope,
    input.payrollAdministrationId,
    artifacts.sourceSnapshot.source_employment_id,
    configuration.version,
  )
  const reference = inputReference.input_provenance_json
  const versions = isJsonObject(reference) && isJsonObject(reference.versions) ? reference.versions : null
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
  const contractType = jsonString(rawProfile.contractType)
  const isOnCall = jsonBoolean(rawProfile.isOnCall)
  const contractHoursPerWeek = jsonNumber(rawProfile.contractHoursPerWeek)
  const fulltimeHoursPerWeek = jsonNumber(rawProfile.fulltimeHoursPerWeek)
  const minimumHourlyWage = jsonString(rawProfile.minimumHourlyWage)
  const minimumHourlyWageEffectiveFrom = jsonString(rawProfile.minimumHourlyWageEffectiveFrom)
  const ageCategory = jsonString(rawProfile.minimumHourlyWageAgeCategory)
  const profileSource = jsonString(rawProfile.source)
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
    file_name: `payrun01-2026-10-${input.kind.toLowerCase()}-${input.runId}.pdf`,
    content_type: 'application/pdf',
    provenance_json: jsonRecord({
      schemaVersion: 'PAYRUN01_TEST_PAYSLIP_PDF_PROVENANCE_V1',
      inputHash: artifacts.inputSet.input_hash,
      resultHash: artifacts.run.result_hash,
      pdfHash,
      finalizedEventId: finalizedEvent?.id ?? null,
      configHash: configVersion.config_hash,
      presentationProfileStatus: profile.status,
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

export async function listPayrun01Candidates(): Promise<readonly Payrun01Candidate[]> {
  if (!isPayrollLabEnabled()) return []
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
      .order('employee_number', { ascending: true }).limit(2),
    supabase.from('employments').select('id, employee_id, starts_on, ends_on')
      .eq('tenant_id', access.scope.tenantId).eq('hr_group_id', access.scope.hrGroupId)
      .eq('administration_id', access.scope.administrationId).eq('record_status', 'CONFIRMED')
      .in('employee_id', Object.keys(PAYRUN01_TEST_PERSONA_KIND_BY_EMPLOYEE_ID))
      .is('deleted_at', null).lte('starts_on', PAYRUN01_PERIOD_END).limit(20),
  ])
  if (employeesResult.error || employmentsResult.error || !employeesResult.data || !employmentsResult.data) {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED')
  }
  const countByEmployee = new Map<string, number>()
  for (const employment of employmentsResult.data) {
    if (employment.ends_on !== null && employment.ends_on < PAYRUN01_PERIOD_START) continue
    countByEmployee.set(employment.employee_id, (countByEmployee.get(employment.employee_id) ?? 0) + 1)
  }
  return employeesResult.data
    .filter((employee) => countByEmployee.has(employee.id))
    .map((employee) => ({
      employeeId: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      confirmedOctoberEmploymentCount: countByEmployee.get(employee.id) ?? 0,
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
