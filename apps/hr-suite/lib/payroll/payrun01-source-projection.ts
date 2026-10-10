import 'server-only'

import { FixedDecimal, type PayrollJsonValue, type PayrollSourceGap, type PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import {
  calculatePension,
  PFZW_2026_KINDEROPVANG_METHOD,
  type PensionArrangementInput,
  type PensionCalculationInput,
  type PensionCalculationResult,
  type Pfzw2026StructuralSalaryComponent,
} from '@liquid-hr/payroll-rules-nl-2026'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'

export interface Payrun01Scope {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string
  readonly employeeId: string
  readonly employmentId: string
  readonly periodReference: PayrollSourceSnapshot['periodReference']
}

export interface Payrun01TaxProfile {
  readonly profileId?: string
  readonly profileVersion?: string
  readonly provenance?: string
  readonly effectiveFrom?: string
  readonly fiscalYear: string
  readonly table: 'WHITE' | 'GREEN'
  readonly residence: 'NL' | 'ABROAD'
  readonly ageCategory: 'UNDER_AOW' | 'AOW'
  readonly herleiding: 'STD' | 'SPECIAL'
  readonly timePeriod: 'MONTH'
  readonly payrollTaxCredit: boolean
  readonly regularWage: true
  readonly fullPeriod: boolean
  readonly hasSpecialSituation: boolean
}

export type Payrun01ExpectedSalary = {
  readonly currencyCode: string
  readonly paymentFrequency: string
  readonly salaryRoute?: string
  readonly salaryBasis?: string
  readonly salaryStructureId?: string | null
  readonly fulltimeMonthlyAmount: string
  readonly salaryScaleId?: string | null
  readonly salaryScaleStepId?: string | null
  readonly salaryStepCode?: string | null
  readonly caoScaleName?: string | null
  readonly caoStepName?: string | null
  readonly salaryBandId?: string | null
} & (
  | { readonly pricingMode: 'CAO_PRORATION'; readonly monthlyGrossAmount?: never }
  | { readonly pricingMode: 'SOURCE_MONTHLY'; readonly monthlyGrossAmount: string }
)

export interface Payrun01ExpectedSchedule {
  readonly contractHoursPerWeek: number
  readonly fulltimeHoursPerWeek: number
  readonly partTimeFactor: number
  readonly scheduleType?: string
  readonly isOnCall?: boolean
}

export interface Payrun01OpeningCumulatives {
  readonly id: string
  readonly status: 'SYNTHETIC_TEST'
  readonly throughPeriod: PayrollSourceSnapshot['periodReference']
  readonly sourceHash: string
  readonly grossWage: string
  readonly holidayReserve: string
  readonly yearEndReserve: string
}

export interface Payrun01EmployerRates {
  readonly awf: string
  readonly aof: string
  readonly wko: string
  readonly whk: string
  readonly zvw: string
}

export interface Payrun01ReserveRates {
  readonly holidayAllowance: string
  readonly yearEnd: string
}

export type Payrun01PensionConfig =
  | { readonly mode: 'DISABLED' }
  | {
    readonly mode: 'CORE_ARRANGEMENT'
    /** False keeps a mathematically calculated TEST pension from being finalized without fiscal evidence. */
    readonly fiscalTreatmentReady?: boolean
    readonly fiscalTreatmentReasonCode?: string
  }
  | { readonly mode: 'EXCLUDED_SOURCE_GAP'; readonly reasonCode: string }
  | { readonly mode: 'UNSUPPORTED'; readonly reasonCode: string }

export type Payrun01AdditionalHourCompensation =
  | { readonly mode: 'CASH_AT_ORDINARY_RATE'; readonly expectedHours?: number; readonly expectedEntryCount?: number }
  | { readonly mode: 'TIME_OFF' }
  | { readonly mode: 'UNRESOLVED' }

export interface Payrun01SourceProjectionConfig {
  /** Payroll-owned, versioned identifiers. None of these are inferred from a person's name. */
  readonly scenarioId: string
  readonly assignmentId: string
  readonly arrangementConfigId: string
  readonly arrangementConfigHash: string
  readonly compositionId: string
  readonly scope: Payrun01Scope
  readonly asOf: string
  readonly maximumSnapshotAgeMilliseconds: number
  readonly expectedEmploymentStartDate?: string
  readonly expectedLaborConditionSetId?: string
  readonly expectedLaborConditionSetCode?: string
  readonly expectedLaborConditionSetName?: string
  readonly expectedJobCode?: string
  readonly expectedJobTitle?: string
  readonly expectedSalary: Payrun01ExpectedSalary
  readonly expectedSchedule: Payrun01ExpectedSchedule
  readonly taxProfile: Payrun01TaxProfile
  /** This ID is a calculation scope key; the canonical Core source ID is preserved separately. */
  readonly calculationIncomeRelationshipId: string
  /** Only listed gap codes may use the Payroll-owned calculation scope fallback. */
  readonly incomeRelationshipFallbackReasonCodes: readonly string[]
  /** Cash, time off, or an unresolved agreement must be supplied by the scenario, never inferred from a work family. */
  readonly additionalHourCompensation?: Payrun01AdditionalHourCompensation
  readonly pension: Payrun01PensionConfig
  readonly employerRates: Payrun01EmployerRates
  readonly reserveRates: Payrun01ReserveRates
  readonly openingCumulatives: Payrun01OpeningCumulatives
  /** Must be established by the versioned scenario configuration, never guessed here. */
  readonly socialWageCapClear: boolean
}

export interface Payrun01ProjectionControls {
  readonly sourceReady: boolean
  readonly employmentStartConsistent: boolean
  readonly ikvUnambiguous: boolean
  readonly salaryConsistent: boolean
  readonly hoursConsistent: boolean
  readonly normalHoursNotDuplicated: boolean
  readonly additionalHoursSupported: boolean
  readonly sourceFresh: boolean
  readonly compositionSupported: boolean
  readonly pensionRuleReady: boolean
  readonly socialWageCapClear: boolean
  readonly cumulativeContinuity: boolean
  readonly reservationContinuity: boolean
  readonly hashesConsistent: boolean
}

export interface Payrun01SourceProjectionResult {
  readonly snapshot: PayrollSourceSnapshot
  readonly calculationIncomeRelationshipId: string | null
  readonly controls: Payrun01ProjectionControls
  readonly blockers: readonly string[]
  readonly provenance: Readonly<Record<string, PayrollJsonValue>>
}

export type Payrun01SourceProjectionErrorCode =
  | 'PAYRUN01_SCOPE_MISMATCH'
  | 'PAYRUN01_PERIOD_MISMATCH'
  | 'PAYRUN01_CONFIG_INVALID'

export class Payrun01SourceProjectionError extends Error {
  constructor(readonly code: Payrun01SourceProjectionErrorCode) {
    super(code)
    this.name = 'Payrun01SourceProjectionError'
  }
}

type JsonRecord = Readonly<Record<string, PayrollJsonValue | undefined>>

function record(value: PayrollJsonValue | undefined): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, PayrollJsonValue | undefined>>
    : null
}

function child(value: JsonRecord | null, key: string): PayrollJsonValue | undefined {
  return value?.[key]
}

function text(value: PayrollJsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function numeric(value: PayrollJsonValue | undefined): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function list(value: PayrollJsonValue | undefined): readonly PayrollJsonValue[] | null {
  return Array.isArray(value) ? value : null
}

function closeEnough(left: number | null, right: number, tolerance = 0.0001): boolean {
  return left !== null && Math.abs(left - right) <= tolerance
}

function validMoney(value: string): boolean {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) return false
  try {
    FixedDecimal.parse(value)
    return true
  } catch {
    return false
  }
}

function decimalInput(value: string | number | null): string | null {
  if (value === null) return null
  const serialized = typeof value === 'number' ? String(value) : value
  return validMoney(serialized) && FixedDecimal.parse(serialized).abs().compare(FixedDecimal.parse('1000000000')) <= 0
    ? serialized
    : null
}

function decimalInputFromJson(value: PayrollJsonValue | undefined): string | null {
  return typeof value === 'number' || typeof value === 'string' ? decimalInput(value) : null
}

function moneyMatches(value: PayrollJsonValue | undefined, expected: string): boolean {
  if ((typeof value !== 'number' && typeof value !== 'string') || !validMoney(String(value)) || !validMoney(expected)) return false
  return FixedDecimal.parse(String(value)).compare(FixedDecimal.parse(expected)) === 0
}

function hashInput(snapshot: PayrollSourceSnapshot) {
  return {
    sourceTenantId: snapshot.sourceTenantId,
    sourceHrGroupId: snapshot.sourceHrGroupId,
    sourceAdministrationId: snapshot.sourceAdministrationId,
    sourceEmployeeId: snapshot.sourceEmployeeId,
    sourceEmploymentId: snapshot.sourceEmploymentId,
    sourceIncomeRelationshipId: snapshot.sourceIncomeRelationshipId,
    periodReference: snapshot.periodReference,
    canonicalSource: snapshot.canonicalSource,
    sourceVersionVector: snapshot.sourceVersionVector,
    sourceGaps: snapshot.sourceGaps,
  }
}

function periodBounds(period: PayrollSourceSnapshot['periodReference']): { start: string; nextStart: string } {
  const start = `${period.year}-${String(period.month).padStart(2, '0')}-01`
  const next = period.month === 12
    ? `${period.year + 1}-01-01`
    : `${period.year}-${String(period.month + 1).padStart(2, '0')}-01`
  return { start, nextStart: next }
}

function previousPeriod(period: PayrollSourceSnapshot['periodReference']): PayrollSourceSnapshot['periodReference'] {
  return period.month === 1 ? { year: period.year - 1, month: 12 } : { year: period.year, month: period.month - 1 }
}

function addBlocker(gaps: PayrollSourceGap[], blockers: Set<string>, field: string, reasonCode: string): void {
  blockers.add(reasonCode)
  if (!gaps.some((gap) => gap.field === field && gap.reasonCode === reasonCode)) {
    gaps.push({ field, status: 'UNSUPPORTED', reasonCode })
  }
}

function validateConfig(config: Payrun01SourceProjectionConfig): void {
  const ids = [config.scenarioId, config.assignmentId, config.arrangementConfigId, config.compositionId,
    config.scope.tenantId, config.scope.hrGroupId, config.scope.administrationId, config.scope.employeeId,
    config.scope.employmentId, config.calculationIncomeRelationshipId, config.openingCumulatives.id]
  if (ids.some((value) => value.trim().length === 0)
    || !/^[0-9a-f]{64}$/i.test(config.arrangementConfigHash)
    || !/^[0-9a-f]{64}$/i.test(config.openingCumulatives.sourceHash)
    || !validMoney(config.expectedSalary.fulltimeMonthlyAmount)
    || (config.expectedSalary.pricingMode === 'SOURCE_MONTHLY'
      && !validMoney(config.expectedSalary.monthlyGrossAmount))
    || !validMoney(config.openingCumulatives.grossWage)
    || !validMoney(config.openingCumulatives.holidayReserve)
    || !validMoney(config.openingCumulatives.yearEndReserve)
    || !Number.isFinite(Date.parse(config.asOf))
    || (config.expectedEmploymentStartDate !== undefined
      && !/^\d{4}-\d{2}-\d{2}$/.test(config.expectedEmploymentStartDate))
    || !Number.isFinite(config.maximumSnapshotAgeMilliseconds)
    || config.maximumSnapshotAgeMilliseconds < 0
    || !Number.isFinite(config.expectedSchedule.contractHoursPerWeek)
    || config.expectedSchedule.contractHoursPerWeek <= 0
    || !Number.isFinite(config.expectedSchedule.fulltimeHoursPerWeek)
    || config.expectedSchedule.fulltimeHoursPerWeek <= 0
    || !Number.isFinite(config.expectedSchedule.partTimeFactor)
    || config.expectedSchedule.partTimeFactor <= 0
    || config.taxProfile.fiscalYear !== String(config.scope.periodReference.year)
    || (config.expectedLaborConditionSetId !== undefined
      && (!config.taxProfile.profileId || !config.taxProfile.profileVersion || !config.taxProfile.provenance
        || !isValidDateOnly(config.taxProfile.effectiveFrom)))
    || (config.pension.mode === 'DISABLED' && (config.employerRates.awf.length === 0 || config.reserveRates.holidayAllowance.length === 0))) {
    throw new Payrun01SourceProjectionError('PAYRUN01_CONFIG_INVALID')
  }
  if (Object.values(config.employerRates).some((value) => !validMoney(value))
    || Object.values(config.reserveRates).some((value) => !validMoney(value))) {
    throw new Payrun01SourceProjectionError('PAYRUN01_CONFIG_INVALID')
  }
  if ((config.pension.mode === 'UNSUPPORTED' || config.pension.mode === 'EXCLUDED_SOURCE_GAP')
    && config.pension.reasonCode.trim().length === 0) {
    throw new Payrun01SourceProjectionError('PAYRUN01_CONFIG_INVALID')
  }
  if (config.additionalHourCompensation?.mode === 'CASH_AT_ORDINARY_RATE'
    && ((config.additionalHourCompensation.expectedHours !== undefined
        && (!Number.isFinite(config.additionalHourCompensation.expectedHours) || config.additionalHourCompensation.expectedHours <= 0))
      || (config.additionalHourCompensation.expectedEntryCount !== undefined
        && (!Number.isInteger(config.additionalHourCompensation.expectedEntryCount) || config.additionalHourCompensation.expectedEntryCount <= 0)))) {
    throw new Payrun01SourceProjectionError('PAYRUN01_CONFIG_INVALID')
  }
}

function isValidDateOnly(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function configuredFieldMatches(row: JsonRecord, config: Payrun01ExpectedSalary, key: keyof Payrun01ExpectedSalary, sourceKey: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(config, key)) return true
  const expected = config[key]
  const actual = row[sourceKey]
  return expected === null ? actual === null : String(actual ?? '') === String(expected)
}

function checkEffectiveRows(
  entries: readonly PayrollJsonValue[] | null,
  start: string,
  nextStart: string,
): { readonly selected: JsonRecord | null; readonly okay: boolean } {
  if (!entries) return { selected: null, okay: false }
  const effective = entries.filter((value) => {
    const row = record(value)
    const validFrom = text(child(row, 'validFrom'))
    const validUntil = text(child(row, 'validUntil'))
    return validFrom !== null && validFrom < nextStart && (validUntil === null || validUntil > start)
  })
  if (effective.length !== 1) return { selected: null, okay: false }
  const selected = record(effective[0])
  if (!selected) return { selected: null, okay: false }
  const validFrom = text(child(selected, 'validFrom'))
  const validUntil = text(child(selected, 'validUntil'))
  return { selected, okay: validFrom !== null && validFrom <= start && (validUntil === null || validUntil >= nextStart) }
}

function canonicalGap(gaps: readonly PayrollSourceGap[], field: string, reasonCode: string): boolean {
  return gaps.some((gap) => gap.field === field && gap.reasonCode === reasonCode)
}

type PensionInputWithoutInputSet = Omit<PensionCalculationInput, 'inputSetId' | 'inputHash'>

function grandfatheringEligibilityFailure(input: PensionInputWithoutInputSet): string | null {
  const arrangement = input.arrangement
  if (arrangement.grandfatheringMode === 'EERBIEDIGENDE_WERKING') {
    const transitionDate = arrangement.transitionDate
    if (!transitionDate || !isValidDateOnly(transitionDate)) {
      return 'PENSION_GRANDFATHERING_TRANSITION_DATE_UNVERIFIED'
    }
    const arrangementEstablishedFrom = arrangement.arrangementEstablishedFrom
    if (!arrangementEstablishedFrom || !isValidDateOnly(arrangementEstablishedFrom)
      || arrangementEstablishedFrom > '2023-06-30') {
      return 'PENSION_GRANDFATHERING_ARRANGEMENT_START_DATE_UNSUPPORTED'
    }
    if (input.participationStartDate >= transitionDate) {
      return 'PENSION_GRANDFATHERING_PARTICIPATION_START_NOT_BEFORE_TRANSITION'
    }
  }
  if (arrangement.arrangementType === 'PROGRESSIVE_PREMIUM') {
    const participantGroupValue = arrangement.eligibilityRule.participantGroup
    const transitionMethodValue = arrangement.eligibilityRule.transitionMethod
    const participationStartBeforeValue = arrangement.eligibilityRule.participationStartBefore
    const participantGroup = typeof participantGroupValue === 'string' ? participantGroupValue : null
    const transitionMethod = typeof transitionMethodValue === 'string' ? transitionMethodValue : null
    const participationStartBefore = typeof participationStartBeforeValue === 'string' ? participationStartBeforeValue : null
    if (participantGroup !== 'GRANDFATHERED') return 'PENSION_GRANDFATHERING_PARTICIPANT_GROUP_UNPROVEN'
    if (transitionMethod !== 'EERBIEDIGENDE_WERKING') return 'PENSION_GRANDFATHERING_METHOD_UNVERIFIED'
    if (!participationStartBefore || !isValidDateOnly(participationStartBefore)) {
      return 'PENSION_GRANDFATHERING_PARTICIPATION_CUTOFF_UNVERIFIED'
    }
    if (arrangement.transitionDate !== participationStartBefore) {
      return 'PENSION_GRANDFATHERING_TRANSITION_CUTOFF_MISMATCH'
    }
    if (input.participationStartDate >= participationStartBefore) {
      return 'PENSION_GRANDFATHERING_PARTICIPATION_NOT_BEFORE_CUTOFF'
    }
  }
  return null
}

function resolveCorePensionInput(input: {
  readonly source: PayrollSourceSnapshot
  readonly canonical: JsonRecord
  readonly bounds: { readonly start: string; readonly nextStart: string }
  readonly fullTimeMonthlySalary: string | null
  readonly monthlyGross: string | null
  readonly partTimeFactor: string | null
  readonly contractHoursPerWeek: number | null
  readonly fullTimeHoursPerWeek: number | null
  readonly additionalWorkedHours: number
}): { readonly input: PensionInputWithoutInputSet; readonly result: PensionCalculationResult } | { readonly reasonCode: string } {
  const pension = record(child(input.canonical, 'pension'))
  const assignments = list(child(pension, 'assignments')) ?? []
  const activeAssignments = assignments.map(record).filter((row): row is JsonRecord => row !== null)
    .filter((row) => {
      const validFrom = text(child(row, 'effectiveFrom'))
      const validTo = text(child(row, 'effectiveTo'))
      return validFrom !== null && validFrom < input.bounds.nextStart
        && (validTo === null || validTo >= input.bounds.start)
    })
  if (activeAssignments.length !== 1) {
    return { reasonCode: activeAssignments.length === 0 ? 'PENSION_ASSIGNMENT_NOT_FOUND' : 'PENSION_ASSIGNMENT_AMBIGUOUS' }
  }
  const assignment = activeAssignments[0]!
  const arrangementResolutionReason = text(child(assignment, 'arrangementResolutionReason'))
  if (arrangementResolutionReason !== null) return { reasonCode: arrangementResolutionReason }
  const periodEnd = new Date(Date.parse(`${input.bounds.nextStart}T00:00:00.000Z`) - 86_400_000)
    .toISOString().slice(0, 10)
  const assignmentStart = text(child(assignment, 'effectiveFrom'))
  const assignmentEnd = text(child(assignment, 'effectiveTo'))
  if (!assignmentStart || assignmentStart > input.bounds.start
    || (assignmentEnd !== null && assignmentEnd < periodEnd)) {
    return { reasonCode: 'PENSION_ASSIGNMENT_PERIOD_GAP' }
  }
  const arrangementRecord = record(child(assignment, 'arrangement'))
  const arrangementId = text(child(assignment, 'pensionArrangementId'))
  if (!arrangementRecord || !arrangementId || child(arrangementRecord, 'id') !== arrangementId
    || child(arrangementRecord, 'isActive') !== true) {
    return { reasonCode: 'PENSION_ARRANGEMENT_NOT_ACTIVE' }
  }
  const arrangementFrom = text(child(arrangementRecord, 'effectiveFrom'))
  const arrangementTo = text(child(arrangementRecord, 'effectiveTo'))
  if (!arrangementFrom || arrangementFrom > input.bounds.start
    || (arrangementTo !== null && arrangementTo < periodEnd)) {
    return { reasonCode: 'PENSION_ARRANGEMENT_PERIOD_GAP' }
  }
  const arrangementType = child(arrangementRecord, 'arrangementType')
  if (arrangementType !== 'FLAT_PREMIUM' && arrangementType !== 'PROGRESSIVE_PREMIUM') {
    return { reasonCode: 'PENSION_ARRANGEMENT_TYPE_UNSUPPORTED' }
  }
  const eligibilityRule = record(child(arrangementRecord, 'eligibilityRule')) ?? {}
  const pensionableSalaryDefinition = record(child(arrangementRecord, 'pensionableSalaryDefinition')) ?? {}
  const isPfzw2026 = text(child(pensionableSalaryDefinition, 'method')) === PFZW_2026_KINDEROPVANG_METHOD
  const expectedParticipantGroup = text(child(eligibilityRule, 'participantGroup'))
  const laborConditionMappings = list(child(pension, 'laborConditionArrangements'))
    ?.map(record).filter((row): row is JsonRecord => row !== null)
    .filter((row) => child(row, 'effectiveFrom') !== undefined
      && text(child(row, 'effectiveFrom')) !== null && text(child(row, 'effectiveFrom'))! <= periodEnd
      && (text(child(row, 'effectiveTo')) === null || text(child(row, 'effectiveTo'))! >= input.bounds.start)) ?? []
  const laborConditions = record(child(input.canonical, 'laborConditions'))
  const laborCheck = checkEffectiveRows(list(child(laborConditions, 'entries')), input.bounds.start, input.bounds.nextStart)
  const selectedLaborSetId = text(child(laborCheck.selected, 'laborConditionSetId'))
  const matchingMappings = selectedLaborSetId === null ? [] : laborConditionMappings.filter((row) =>
    child(row, 'laborConditionSetId') === selectedLaborSetId
      && child(row, 'participantGroup') === expectedParticipantGroup,
  )
  if (matchingMappings.length > 1) return { reasonCode: 'PENSION_LABOR_MAPPING_AMBIGUOUS' }
  if (isPfzw2026 && matchingMappings.length !== 1) return { reasonCode: 'PENSION_LABOR_MAPPING_NOT_FOUND' }
  if (matchingMappings.length === 1
    && text(child(matchingMappings[0]!, 'pensionArrangementId')) !== arrangementId) {
    return { reasonCode: 'PENSION_LABOR_MAPPING_CONFLICT' }
  }
  const tierRows = list(child(arrangementRecord, 'tiers')) ?? []
  const tiers = tierRows.map(record).filter((tier): tier is JsonRecord => tier !== null).map((tier) => ({
    minAge: numeric(child(tier, 'minAge')) ?? Number.NaN,
    maxAge: numeric(child(tier, 'maxAge')) ?? Number.NaN,
    totalRate: text(child(tier, 'totalRate')) ?? '',
  }))
  const grandfatheringMode = text(child(arrangementRecord, 'grandfatheringMode'))
  if (grandfatheringMode !== 'NONE' && grandfatheringMode !== 'EERBIEDIGENDE_WERKING') {
    return { reasonCode: 'PENSION_GRANDFATHERING_MODE_UNSUPPORTED' }
  }
  const arrangement: PensionArrangementInput = {
    arrangementId,
    arrangementCode: text(child(arrangementRecord, 'code')) ?? '',
    arrangementVersion: `${numeric(child(arrangementRecord, 'versionNumber')) ?? 'legacy'}:${text(child(arrangementRecord, 'versionId')) ?? text(child(arrangementRecord, 'version')) ?? ''}`,
    arrangementType,
    effectiveFrom: arrangementFrom,
    arrangementEstablishedFrom: text(child(arrangementRecord, 'arrangementEstablishedFrom')),
    effectiveTo: arrangementTo,
    transitionDate: text(child(arrangementRecord, 'transitionDate')),
    grandfatheringMode,
    flatTotalRate: text(child(arrangementRecord, 'flatTotalRate')),
    employerSharePercent: text(child(arrangementRecord, 'employerSharePercent')) ?? '',
    employeeSharePercent: text(child(arrangementRecord, 'employeeSharePercent')) ?? '',
    annualFranchise: text(child(arrangementRecord, 'annualFranchise')) ?? '',
    annualPensionableSalaryCap: text(child(arrangementRecord, 'annualPensionableSalaryCap')),
    pensionableSalaryDefinition,
    eligibilityRule,
    contractClassification: text(child(arrangementRecord, 'contractClassification')) === 'SOLIDARITY'
      ? 'SOLIDARITY'
      : text(child(arrangementRecord, 'contractClassification')) === 'NON_SOLIDARITY'
        ? 'NON_SOLIDARITY'
        : 'UNKNOWN',
    contractClassificationProvenance: record(child(arrangementRecord, 'contractClassificationProvenance')) ?? { status: 'UNVERIFIED' },
    provenance: record(child(arrangementRecord, 'provenance')) ?? {},
    tiers,
  }
  const participationStartDate = text(child(assignment, 'participationStartDate')) ?? ''
  let inputSet: PensionInputWithoutInputSet = {
    arrangement,
    period: input.source.periodReference,
    fullTimeMonthlyPensionableSalary: input.fullTimeMonthlySalary ?? '',
    monthlyPayrollGross: input.monthlyGross ?? '',
    partTimeFactor: input.partTimeFactor ?? '',
    ageForTier: numeric(child(assignment, 'ageForTier')),
    participationStartDate,
    sourceSnapshotId: input.source.id,
    sourceSnapshotHash: input.source.sourceHash,
  }
  if (isPfzw2026) {
    const pfzwDefinition = record(child(pensionableSalaryDefinition, 'pfzw2026'))
    const assignmentId = text(child(assignment, 'id'))
    const effectiveMapping = matchingMappings[0] ?? null
    const laborMappingId = text(child(effectiveMapping, 'id'))
    const assignmentVersion = numeric(child(assignment, 'assignmentVersion'))
    const mappingVersion = numeric(child(effectiveMapping, 'mappingVersion'))
    const compensation = record(child(input.canonical, 'compensation'))
    const salaryEntries = list(child(compensation, 'entries'))
      ?.map(record).filter((row): row is JsonRecord => row !== null) ?? []
    const salaryBasisDate = participationStartDate < `${input.source.periodReference.year}-01-01`
      ? `${input.source.periodReference.year}-01-01`
      : participationStartDate
    const salaryBasisRows = salaryEntries.filter((row) => {
      const validFrom = text(child(row, 'validFrom'))
      const validUntil = text(child(row, 'validUntil'))
      return validFrom !== null && validFrom <= salaryBasisDate
        && (validUntil === null || validUntil > salaryBasisDate)
    })
    const assignmentProvenance = record(child(assignment, 'provenance'))
    const assignmentProvenanceStatus = text(child(assignmentProvenance, 'status'))
    const assignmentSourceClassification = text(child(assignmentProvenance, 'sourceClassification'))
    const assignmentMappingId = text(child(assignmentProvenance, 'laborConditionMappingId'))
    const assignmentMappingVersion = numeric(child(assignmentProvenance, 'laborConditionMappingVersion'))
    const mappingProvenance = record(child(effectiveMapping, 'provenance'))
    const mappingProvenanceStatus = text(child(mappingProvenance, 'status'))
    const mappingSourceClassification = text(child(mappingProvenance, 'sourceClassification'))
    const isSyntheticTestFixture = assignmentProvenanceStatus === 'SYNTHETIC_TEST_FIXTURE'
      && assignmentSourceClassification?.startsWith('SYNTHETIC_TEST_FIXTURE — ') === true
    const assignmentProvenanceValid = (assignmentProvenanceStatus === 'USER_RECORDED' || isSyntheticTestFixture)
      && assignmentSourceClassification !== null
      && assignmentMappingId === laborMappingId
      && assignmentMappingVersion !== null
      && assignmentMappingVersion === mappingVersion
      && assignmentVersion !== null
    const mappingProvenanceValid = (mappingProvenanceStatus === 'USER_RECORDED' || mappingProvenanceStatus === 'SYNTHETIC_TEST_FIXTURE')
      && mappingSourceClassification !== null
    if (!pfzwDefinition || !assignmentId || !laborMappingId || assignmentVersion === null || mappingVersion === null
      || !assignmentProvenanceValid || !mappingProvenanceValid || salaryBasisRows.length !== 1 || !input.fullTimeHoursPerWeek
      || !input.contractHoursPerWeek || !validMoney(text(child(salaryBasisRows[0] ?? {}, 'fulltimeAmount')) ?? '')) {
      return { reasonCode: !assignmentId || !laborMappingId || !assignmentProvenanceValid || !mappingProvenanceValid
        ? 'PENSION_PARTICIPATION_PROVENANCE_GAP'
        : 'PFZW_SALARY_BASIS_SOURCE_GAP' }
    }
    const basisSalaryRow = salaryBasisRows[0]!
    const basisMonthlySalary = text(child(basisSalaryRow, 'fulltimeAmount'))!
    const basisSalaryRowId = text(child(basisSalaryRow, 'id'))
    const basisSalaryValidFrom = text(child(basisSalaryRow, 'validFrom'))
    if (!basisSalaryRowId || !basisSalaryValidFrom) return { reasonCode: 'PFZW_SALARY_BASIS_PROVENANCE_GAP' }
    const periodsValue = numeric(child(pfzwDefinition, 'monthlyPaymentsPerYear'))
    const paymentFrequency = text(child(basisSalaryRow, 'paymentFrequency'))?.toUpperCase()
    const monthlyPaymentsPerYear = periodsValue === 13 || paymentFrequency === 'FOUR_WEEKLY' || paymentFrequency === '4_WEEKLY'
      ? 13 as const
      : periodsValue === 12 || paymentFrequency === 'MONTHLY'
        ? 12 as const
        : null
    if (monthlyPaymentsPerYear === null) return { reasonCode: 'PFZW_PAYMENT_FREQUENCY_UNSUPPORTED' }
    if (monthlyPaymentsPerYear === 13) return { reasonCode: 'PFZW_FOUR_WEEKLY_PERIOD_UNSUPPORTED' }
    const annualSalaryBase = FixedDecimal.parse(basisMonthlySalary)
      .multiply(FixedDecimal.fromInteger(BigInt(monthlyPaymentsPerYear)))
    const additionalComponentsRaw = list(child(pfzwDefinition, 'additionalStructuralSalaryComponents'))
    const additionalStructuralSalaryComponents: Pfzw2026StructuralSalaryComponent[] = []
    for (const item of additionalComponentsRaw ?? []) {
      const row = record(item)
      const code = text(child(row, 'code'))
      const annualAmount = text(child(row, 'annualAmount'))
      const sourceVersion = text(child(row, 'sourceVersion'))
      const sourceReference = text(child(row, 'sourceReference'))
      if (!code || !annualAmount || !sourceVersion || !sourceReference) {
        return { reasonCode: 'PFZW_STRUCTURAL_SALARY_COMPONENT_SOURCE_GAP' }
      }
      additionalStructuralSalaryComponents.push({ code, annualAmount, sourceVersion, sourceReference })
    }
    const fullTimePeriodHours = FixedDecimal.parse(String(input.fullTimeHoursPerWeek))
      .multiply(FixedDecimal.parse('52'))
      .divideToScale(FixedDecimal.parse('12'), 2, 'ARITHMETIC')
      .toString(2)
    const upliftEvidenceText = text(child(pfzwDefinition, 'additionalHoursUpliftEvidence'))
    const upliftEvidence = upliftEvidenceText === 'VERIFIED_CAO_OR_EMPLOYER_RULE'
      || upliftEvidenceText === 'SYNTHETIC_TEST_ONLY_POLICY'
      || upliftEvidenceText === 'PROVISIONAL_CAO_ENTITLEMENT_DERIVATION'
      || upliftEvidenceText === 'NOT_APPLICABLE'
      ? upliftEvidenceText
      : null
    const policyStatus = text(child(pfzwDefinition, 'monthlyAllocationPolicyStatus'))
    const calculationPolicyStatus = policyStatus === 'VERIFIED_EMPLOYER_POLICY'
      ? 'VERIFIED_EMPLOYER_POLICY'
      : policyStatus === 'SYNTHETIC_TEST_APPROVED'
        ? 'SYNTHETIC_TEST_APPROVED'
        : 'PROVISIONAL_PREVIEW'
    const pfzwInput: PensionCalculationInput['pfzw2026'] = {
      period: input.source.periodReference,
      participationStatus: isSyntheticTestFixture ? 'SYNTHETIC_TEST_FIXTURE' : 'CONFIRMED',
      participationStartDate,
      participationEvidenceReference: isSyntheticTestFixture
        ? `SYNTHETIC_TEST_FIXTURE:${assignmentSourceClassification}; Core assignment ${assignmentId} v${assignmentVersion} [${assignmentSourceClassification}]; effective labor-condition arrangement mapping ${laborMappingId} v${mappingVersion} [${mappingSourceClassification}]`
        : `Core participation assignment ${assignmentId} v${assignmentVersion} [${assignmentSourceClassification}]; effective labor-condition arrangement mapping ${laborMappingId} v${mappingVersion} [${mappingSourceClassification}]`,
      arrangementVersion: arrangement.arrangementVersion,
      salaryBasisDate,
      salaryBasisSourceId: basisSalaryRowId,
      salaryBasisSourceVersion: basisSalaryValidFrom,
      fullTimeMonthlySalary: basisMonthlySalary,
      monthlyPaymentsPerYear,
      holidayAllowancePercent: text(child(pfzwDefinition, 'holidayAllowancePercent')) ?? '',
      structuralYearEndAllowancePercent: text(child(pfzwDefinition, 'structuralYearEndAllowancePercent')),
      structuralYearEndAllowanceReferenceDate: text(child(pfzwDefinition, 'structuralYearEndAllowanceReferenceDate')),
      structuralYearEndAllowanceEligibleAnnualBase: annualSalaryBase.toString(),
      structuralYearEndAllowanceSourceReference: text(child(pfzwDefinition, 'structuralYearEndAllowanceSourceReference')),
      structuralYearEndAllowanceSourceVersion: text(child(pfzwDefinition, 'structuralYearEndAllowanceSourceVersion')),
      additionalStructuralSalaryComponents,
      contractHoursPerWeek: String(input.contractHoursPerWeek),
      fullTimeHoursPerWeek: String(input.fullTimeHoursPerWeek),
      additionalWorkedHours: String(input.additionalWorkedHours.toFixed(4)),
      additionalHoursUpliftPercent: text(child(pfzwDefinition, 'additionalHoursUpliftPercent')),
      additionalHoursUpliftEvidence: upliftEvidence,
      additionalHoursUpliftSourceReference: text(child(pfzwDefinition, 'additionalHoursUpliftSourceReference')),
      additionalHoursUpliftSourceVersion: text(child(pfzwDefinition, 'additionalHoursUpliftSourceVersion')),
      fullTimePeriodHours,
      monthlyPayrollGross: input.monthlyGross ?? '',
      calculationPolicy: {
        status: calculationPolicyStatus,
        version: text(child(pfzwDefinition, 'monthlyAllocationPolicyVersion')) ?? 'UNVERIFIED',
        sourceReference: text(child(pfzwDefinition, 'monthlyAllocationPolicySourceReference')),
        monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12',
        shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE',
      },
      sourceSnapshotId: input.source.id,
      sourceSnapshotHash: input.source.sourceHash,
    }
    inputSet = { ...inputSet, pfzw2026: pfzwInput }
  }
  const result = calculatePension(inputSet)
  return result.status === 'CALCULATED'
    ? { input: inputSet, result }
    : {
      reasonCode: result.reasonCode === 'PENSION_GRANDFATHERING_ELIGIBILITY_UNPROVEN'
        ? grandfatheringEligibilityFailure(inputSet) ?? 'PENSION_GRANDFATHERING_ENGINE_CHECK_MISMATCH'
        : result.reasonCode ?? 'PENSION_CALCULATION_BLOCKED',
    }
}

/**
 * Project a Core-owned source snapshot into a versioned Payroll calculation snapshot.
 * This helper is pure: it does not read or write either database and never changes Core IDs.
 */
export function projectPayrun01SourceSnapshot(
  source: PayrollSourceSnapshot,
  config: Payrun01SourceProjectionConfig,
): Payrun01SourceProjectionResult {
  validateConfig(config)
  if (source.sourceTenantId !== config.scope.tenantId
    || source.sourceHrGroupId !== config.scope.hrGroupId
    || source.sourceAdministrationId !== config.scope.administrationId
    || source.sourceEmployeeId !== config.scope.employeeId
    || source.sourceEmploymentId !== config.scope.employmentId) {
    throw new Payrun01SourceProjectionError('PAYRUN01_SCOPE_MISMATCH')
  }
  if (source.periodReference.year !== config.scope.periodReference.year
    || source.periodReference.month !== config.scope.periodReference.month) {
    throw new Payrun01SourceProjectionError('PAYRUN01_PERIOD_MISMATCH')
  }

  const blockers = new Set<string>()
  const gaps = [...source.sourceGaps]
  const originalHashMatches = hashPayrollSourceSnapshot(hashInput(source)) === source.sourceHash
  const ageMilliseconds = Date.parse(config.asOf) - Date.parse(source.createdAt)
  const sourceFresh = originalHashMatches && Number.isFinite(ageMilliseconds)
    && ageMilliseconds >= 0 && ageMilliseconds <= config.maximumSnapshotAgeMilliseconds
  if (!originalHashMatches) addBlocker(gaps, blockers, 'sourceSnapshot', 'PAYRUN01_SOURCE_HASH_MISMATCH')
  if (!Number.isFinite(ageMilliseconds) || ageMilliseconds < 0 || ageMilliseconds > config.maximumSnapshotAgeMilliseconds) {
    addBlocker(gaps, blockers, 'sourceSnapshot', 'PAYRUN01_SOURCE_STALE')
  }

  const bounds = periodBounds(source.periodReference)
  const canonical = record(source.canonicalSource)
  const employment = record(child(canonical, 'employment'))
  const compensation = record(child(canonical, 'compensation'))
  const schedule = record(child(canonical, 'schedule'))
  const actualWork = record(child(canonical, 'actualWork'))
  const incomeRelationship = record(child(canonical, 'incomeRelationship'))
  const laborConditions = record(child(canonical, 'laborConditions'))
  const organization = record(child(canonical, 'organization'))
  const contract = record(child(canonical, 'contract'))
  const employmentStartConsistent = config.expectedEmploymentStartDate === undefined
    || child(employment, 'startsOn') === config.expectedEmploymentStartDate
  if (!employmentStartConsistent) addBlocker(gaps, blockers, 'employment', 'PAYRUN01_EMPLOYMENT_START_MISMATCH')

  const laborConditionCheck = config.expectedLaborConditionSetId === undefined
    ? { selected: null as JsonRecord | null, okay: true }
    : checkEffectiveRows(list(child(laborConditions, 'entries')), bounds.start, bounds.nextStart)
  const selectedLaborCondition = laborConditionCheck.selected
  const selectedLaborSet = record(child(selectedLaborCondition, 'set'))
  const contractCheck = config.expectedLaborConditionSetId === undefined
    ? { selected: null as JsonRecord | null, okay: true }
    : checkEffectiveRows(list(child(contract, 'entries')), bounds.start, bounds.nextStart)
  const selectedContract = contractCheck.selected
  const laborConditionConsistent = config.expectedLaborConditionSetId === undefined || (
    laborConditionCheck.okay && selectedLaborCondition !== null
    && child(selectedLaborCondition, 'laborConditionSetId') === config.expectedLaborConditionSetId
    && child(selectedLaborSet, 'id') === config.expectedLaborConditionSetId
    && (config.expectedLaborConditionSetCode === undefined
      || child(selectedLaborSet, 'code') === config.expectedLaborConditionSetCode)
    && (config.expectedLaborConditionSetName === undefined
      || child(selectedLaborSet, 'name') === config.expectedLaborConditionSetName)
    && closeEnough(numeric(child(selectedLaborSet, 'standardHoursPerWeek')), config.expectedSchedule.fulltimeHoursPerWeek)
    && child(selectedLaborSet, 'isActive') === true
    && contractCheck.okay && selectedContract !== null
    && child(selectedContract, 'laborConditionSetId') === config.expectedLaborConditionSetId
    && closeEnough(numeric(child(selectedContract, 'fulltimeHoursPerWeek')), config.expectedSchedule.fulltimeHoursPerWeek)
  )
  if (!laborConditionConsistent) {
    addBlocker(gaps, blockers, 'laborConditions', 'PAYRUN01_LABOR_CONDITION_SET_MISMATCH')
  }

  const organizationCheck = config.expectedJobCode === undefined && config.expectedJobTitle === undefined
    ? { selected: null as JsonRecord | null, okay: true }
    : checkEffectiveRows(list(child(organization, 'entries')), bounds.start, bounds.nextStart)
  const selectedOrganization = organizationCheck.selected
  const functionAssignmentConsistent = (config.expectedJobCode === undefined && config.expectedJobTitle === undefined) || (
    organizationCheck.okay && selectedOrganization !== null
    && (config.expectedJobCode === undefined || child(selectedOrganization, 'jobCode') === config.expectedJobCode)
    && (config.expectedJobTitle === undefined || child(selectedOrganization, 'jobTitle') === config.expectedJobTitle)
  )
  if (!functionAssignmentConsistent) {
    addBlocker(gaps, blockers, 'functionAssignment', 'PAYRUN01_FUNCTION_ASSIGNMENT_MISMATCH')
  }

  const salaryCheck = checkEffectiveRows(list(child(compensation, 'entries')), bounds.start, bounds.nextStart)
  let salaryConsistent = salaryCheck.okay && salaryCheck.selected !== null
  let fulltimeMonthlyAmount: string | null = null
  let sourceMonthlyAmount: string | null = null
  let sourceContractHours: number | null = null
  let sourceFulltimeHours: number | null = null
  let sourcePartTimeFactor: string | null = null
  if (salaryCheck.selected) {
    const row = salaryCheck.selected
    const scheduleEntries = list(child(schedule, 'entries'))
    const scheduleCheck = checkEffectiveRows(scheduleEntries, bounds.start, bounds.nextStart)
    const selectedSchedule = scheduleCheck.selected
    sourceContractHours = numeric(child(selectedSchedule, 'averageHoursPerWeek'))
    sourceFulltimeHours = numeric(child(selectedSchedule, 'fulltimeHoursPerWeek'))
    sourcePartTimeFactor = decimalInputFromJson(child(selectedSchedule, 'partTimeFactor'))
    fulltimeMonthlyAmount = decimalInputFromJson(child(row, 'fulltimeAmount'))
    sourceMonthlyAmount = decimalInputFromJson(child(row, 'parttimeAmount'))
    const isCao = config.expectedSalary.salaryRoute?.toUpperCase() === 'SCALE_WITH_STEPS'
    salaryConsistent = salaryConsistent
      && String(child(row, 'currencyCode') ?? '') === config.expectedSalary.currencyCode
      && String(child(row, 'paymentFrequency') ?? '') === config.expectedSalary.paymentFrequency
      && configuredFieldMatches(row, config.expectedSalary, 'salaryRoute', 'salaryRoute')
      && configuredFieldMatches(row, config.expectedSalary, 'salaryBasis', 'salaryBasis')
      && configuredFieldMatches(row, config.expectedSalary, 'salaryStructureId', 'salaryStructureId')
      && configuredFieldMatches(row, config.expectedSalary, 'salaryScaleId', 'salaryScaleId')
      && configuredFieldMatches(row, config.expectedSalary, 'salaryScaleStepId', 'salaryScaleStepId')
      && configuredFieldMatches(row, config.expectedSalary, 'salaryStepCode', 'salaryStepCode')
      && configuredFieldMatches(row, config.expectedSalary, 'caoScaleName', 'caoScaleName')
      && configuredFieldMatches(row, config.expectedSalary, 'caoStepName', 'caoStepName')
      && configuredFieldMatches(row, config.expectedSalary, 'salaryBandId', 'salaryBandId')
      && fulltimeMonthlyAmount !== null
      && moneyMatches(fulltimeMonthlyAmount, config.expectedSalary.fulltimeMonthlyAmount)
      && (config.expectedSalary.pricingMode === 'CAO_PRORATION'
        || (sourceMonthlyAmount !== null && moneyMatches(sourceMonthlyAmount, config.expectedSalary.monthlyGrossAmount)))
      && scheduleCheck.okay
      && closeEnough(sourceContractHours, config.expectedSchedule.contractHoursPerWeek)
      && closeEnough(sourceFulltimeHours, config.expectedSchedule.fulltimeHoursPerWeek)
      && closeEnough(numeric(child(selectedSchedule, 'partTimeFactor')), config.expectedSchedule.partTimeFactor)
      && closeEnough(config.expectedSchedule.partTimeFactor,
        config.expectedSchedule.contractHoursPerWeek / config.expectedSchedule.fulltimeHoursPerWeek)
      && (config.expectedSchedule.scheduleType === undefined
        || String(child(selectedSchedule, 'scheduleType') ?? '') === config.expectedSchedule.scheduleType)
      && (config.expectedSchedule.isOnCall === undefined
        || child(selectedSchedule, 'isOnCall') === config.expectedSchedule.isOnCall)
      && (config.expectedSalary.pricingMode !== 'CAO_PRORATION' || isCao)
  }
  const scheduleRows = checkEffectiveRows(list(child(schedule, 'entries')), bounds.start, bounds.nextStart)
  const hoursConsistent = scheduleRows.okay && scheduleRows.selected !== null
    && closeEnough(numeric(child(scheduleRows.selected, 'averageHoursPerWeek')), config.expectedSchedule.contractHoursPerWeek)
    && closeEnough(numeric(child(scheduleRows.selected, 'fulltimeHoursPerWeek')), config.expectedSchedule.fulltimeHoursPerWeek)
    && closeEnough(numeric(child(scheduleRows.selected, 'partTimeFactor')), config.expectedSchedule.partTimeFactor)
    && closeEnough(config.expectedSchedule.partTimeFactor,
      config.expectedSchedule.contractHoursPerWeek / config.expectedSchedule.fulltimeHoursPerWeek)
    && (config.expectedSchedule.scheduleType === undefined
      || String(child(scheduleRows.selected, 'scheduleType') ?? '') === config.expectedSchedule.scheduleType)
    && (config.expectedSchedule.isOnCall === undefined
      || child(scheduleRows.selected, 'isOnCall') === config.expectedSchedule.isOnCall)

  if (!salaryConsistent) addBlocker(gaps, blockers, 'contractualSalary', 'PAYRUN01_SALARY_OR_CAO_MISMATCH')
  if (!hoursConsistent) addBlocker(gaps, blockers, 'contractualHours', 'PAYRUN01_SCHEDULE_MISMATCH')

  const taxGapAllowed = canonicalGap(source.sourceGaps, 'taxProfile', 'NO_ACCEPTED_SOURCE_CONTRACT')
    || canonicalGap(source.sourceGaps, 'fiscalProfile', 'NO_ACCEPTED_SOURCE_CONTRACT')
  const taxGapUnsupported = source.sourceGaps.some((gap) =>
    (gap.field === 'taxProfile' || gap.field === 'fiscalProfile')
    && gap.reasonCode !== 'NO_ACCEPTED_SOURCE_CONTRACT')
  const taxProfileResolved = taxGapAllowed && !taxGapUnsupported
  if (!taxProfileResolved) addBlocker(gaps, blockers, 'taxProfile', 'PAYRUN01_TAX_PROFILE_NOT_EXPLICITLY_RESOLVED')

  const incomeFallbackGap = source.sourceGaps.filter((gap) => gap.field === 'incomeRelationship')
  const incomeNeedsFallback = incomeFallbackGap.length > 0
  const incomeFallbackAllowed = incomeNeedsFallback
    && incomeFallbackGap.every((gap) => config.incomeRelationshipFallbackReasonCodes.includes(gap.reasonCode))
    && incomeFallbackGap.every((gap) => ['CONTROL02_CONTRACT_PENDING', 'NO_LINKED_INCOME_RELATIONSHIP'].includes(gap.reasonCode))
  const incomeAmbiguous = incomeFallbackGap.some((gap) => gap.reasonCode.includes('AMBIGUOUS'))
    || String(child(incomeRelationship, 'reasonCode') ?? '').includes('AMBIGUOUS')
  const sourceIncomeId = source.sourceIncomeRelationshipId
    ?? text(child(incomeRelationship, 'id'))
  const calculationIncomeRelationshipId = incomeAmbiguous
    ? null
    : incomeNeedsFallback
      ? (incomeFallbackAllowed ? config.calculationIncomeRelationshipId : null)
      : source.sourceIncomeRelationshipId
  const ikvUnambiguous = calculationIncomeRelationshipId !== null && !incomeAmbiguous
  if (!ikvUnambiguous) addBlocker(gaps, blockers, 'incomeRelationship', 'PAYRUN01_IKV_AMBIGUOUS_OR_UNRESOLVED')

  const entries = list(child(actualWork, 'entries')) ?? []
  const seenEntryIds = new Set<string>()
  const duplicateIds = entries.some((entry) => {
    const id = text(child(record(entry), 'id'))
    if (id === null || seenEntryIds.has(id)) return true
    seenEntryIds.add(id)
    return false
  })
  const periodInfo = record(child(actualWork, 'period'))
  const actualWorkPeriodMatches = entries.length === 0 || (
    text(child(periodInfo, 'startsOn')) === bounds.start && text(child(periodInfo, 'endsOn')) === bounds.nextStart
  )
  let normalHours = 0
  let additionalHours = 0
  let additionalEntryCount = 0
  let additionalClassified = !duplicateIds && actualWorkPeriodMatches
  for (const entryValue of entries) {
    const entry = record(entryValue)
    const family = text(child(entry, 'family'))
    const hours = numeric(child(entry, 'hours'))
    const status = text(child(entry, 'status'))
    const approvedAt = text(child(entry, 'approvedAt'))
    const workDate = text(child(entry, 'workDate'))
    const postingPeriodStart = text(child(entry, 'postingPeriodStart'))
    const subjectPeriodStart = text(child(entry, 'subjectPeriodStart'))
    const subjectPeriodEnd = text(child(entry, 'subjectPeriodEnd'))
    const typeValidFrom = text(child(entry, 'typeValidFrom'))
    const typeValidUntil = text(child(entry, 'typeValidUntil'))
    const commonEntryValid = hours !== null && hours > 0 && hours <= 1000
      && status === 'APPROVED' && approvedAt !== null
      && workDate !== null && workDate >= bounds.start && workDate < bounds.nextStart
      && postingPeriodStart === bounds.start
      && subjectPeriodStart !== null && subjectPeriodStart >= bounds.start && subjectPeriodStart < bounds.nextStart
      && subjectPeriodEnd !== null && subjectPeriodEnd > subjectPeriodStart && subjectPeriodEnd <= bounds.nextStart
      && typeValidFrom !== null && typeValidFrom <= workDate
      && (typeValidUntil === null || typeValidUntil > workDate)
    if (!commonEntryValid) additionalClassified = false
    if (family === 'WORK' && commonEntryValid) normalHours += hours
    else if (family === 'ADDITIONAL' && commonEntryValid) {
      additionalHours += hours
      additionalEntryCount += 1
    }
    else additionalClassified = false
  }
  const actualWorkGap = source.sourceGaps.some((gap) => gap.field === 'actualWork')
  if (actualWorkGap || !additionalClassified) {
    additionalClassified = false
    addBlocker(gaps, blockers, 'actualWork', 'PAYRUN01_ACTUAL_WORK_CLASSIFICATION_UNSUPPORTED')
  }

  if (additionalHours > 0) {
    if (config.additionalHourCompensation?.mode === 'UNRESOLVED' || !config.additionalHourCompensation) {
      additionalClassified = false
      addBlocker(gaps, blockers, 'actualWork', 'PAYRUN01_ADDITIONAL_COMPENSATION_NOT_CONFIRMED')
    }
  }
  if (config.additionalHourCompensation?.mode === 'CASH_AT_ORDINARY_RATE'
    && ((config.additionalHourCompensation.expectedHours !== undefined
      && !closeEnough(additionalHours, config.additionalHourCompensation.expectedHours))
      || (config.additionalHourCompensation.expectedEntryCount !== undefined
        && additionalEntryCount !== config.additionalHourCompensation.expectedEntryCount))) {
    additionalClassified = false
    addBlocker(gaps, blockers, 'actualWork', 'PAYRUN01_ADDITIONAL_HOURS_FIXTURE_MISMATCH')
  }
  const cashCompensatedHours = additionalHours > 0
    && config.additionalHourCompensation?.mode === 'CASH_AT_ORDINARY_RATE'
    && additionalClassified
    ? additionalHours
    : 0
  const normalHoursNotDuplicated = true // WORK contributes no second wage line; the rule package owns any configured compensation.
  const sourceMonthlyGrossAmount = salaryConsistent && config.expectedSalary.pricingMode === 'SOURCE_MONTHLY'
    ? config.expectedSalary.monthlyGrossAmount
    : null
  if (!salaryConsistent) addBlocker(gaps, blockers, 'contractualSalary', 'PAYRUN01_GROSS_PROJECTION_BLOCKED')

  let contractualMonthlyGrossForPension = sourceMonthlyGrossAmount
  if (salaryConsistent && config.expectedSalary.pricingMode === 'CAO_PRORATION'
    && fulltimeMonthlyAmount !== null && sourceContractHours !== null && sourceFulltimeHours !== null
    && sourceFulltimeHours > 0) {
    contractualMonthlyGrossForPension = FixedDecimal.parse(fulltimeMonthlyAmount)
      .multiply(FixedDecimal.parse(String(sourceContractHours)))
      .divideToScale(FixedDecimal.parse(String(sourceFulltimeHours)), 2, 'ARITHMETIC')
      .toString(2)
  }
  let additionalCashAmountForPension = '0.00'
  if (cashCompensatedHours > 0 && fulltimeMonthlyAmount !== null && sourceFulltimeHours !== null && sourceFulltimeHours > 0) {
    additionalCashAmountForPension = FixedDecimal.parse(fulltimeMonthlyAmount)
      .multiply(FixedDecimal.parse('12'))
      .multiply(FixedDecimal.parse(cashCompensatedHours.toFixed(4)))
      .divideToScale(FixedDecimal.parse(String(sourceFulltimeHours)).multiply(FixedDecimal.parse('52.2')), 2, 'ARITHMETIC')
      .toString(2)
  } else if (cashCompensatedHours > 0) {
    addBlocker(gaps, blockers, 'actualWork', 'PAYRUN01_ADDITIONAL_CASH_AMOUNT_NOT_RESOLVED')
  }
  const monthlyGrossForPension = contractualMonthlyGrossForPension === null
    ? null
    : FixedDecimal.parse(contractualMonthlyGrossForPension)
      .add(FixedDecimal.parse(additionalCashAmountForPension))
      .toString(2)

  const opening = config.openingCumulatives
  const previous = previousPeriod(source.periodReference)
  const openingPeriodConsistent = opening.throughPeriod.year === previous.year
    && opening.throughPeriod.month === previous.month
    && /^[0-9a-f]{64}$/i.test(opening.sourceHash)
    && validMoney(opening.grossWage)
    && validMoney(opening.holidayReserve)
    && validMoney(opening.yearEndReserve)
  const cumulativeContinuity = openingPeriodConsistent
  const reservationContinuity = openingPeriodConsistent
  if (!openingPeriodConsistent) addBlocker(gaps, blockers, 'openingCumulatives', 'PAYRUN01_OPENING_CUMULATIVE_MISMATCH')

  const resolvedPension = config.pension.mode === 'CORE_ARRANGEMENT'
    ? canonical ? resolveCorePensionInput({
      source,
      canonical,
      bounds,
      fullTimeMonthlySalary: fulltimeMonthlyAmount,
      monthlyGross: monthlyGrossForPension,
      partTimeFactor: sourcePartTimeFactor,
      contractHoursPerWeek: sourceContractHours,
      fullTimeHoursPerWeek: sourceFulltimeHours,
      additionalWorkedHours: additionalHours,
    }) : { reasonCode: 'PAYRUN01_CANONICAL_SOURCE_INVALID' }
    : null
  const corePensionResult = resolvedPension && 'result' in resolvedPension ? resolvedPension.result : null
  const pensionCalculationReady = config.pension.mode === 'CORE_ARRANGEMENT' && corePensionResult?.status === 'CALCULATED'
  const pensionFiscalTreatmentReady = config.pension.mode !== 'CORE_ARRANGEMENT'
    || config.pension.fiscalTreatmentReady !== false
  const pensionRuleReady = config.pension.mode === 'DISABLED'
    || (pensionCalculationReady && pensionFiscalTreatmentReady)
  if (config.pension.mode === 'CORE_ARRANGEMENT' && !pensionRuleReady) {
    addBlocker(gaps, blockers, 'pension', resolvedPension && 'reasonCode' in resolvedPension
      ? resolvedPension.reasonCode
      : !pensionFiscalTreatmentReady
        ? config.pension.fiscalTreatmentReasonCode ?? 'PENSION_FISCAL_TREATMENT_UNVERIFIED'
        : 'PAYRUN01_PENSION_CALCULATION_BLOCKED')
  }
  if (config.pension.mode === 'UNSUPPORTED') {
    addBlocker(gaps, blockers, 'pension', config.pension.reasonCode)
  }

  const pensionEmployeeAmount = corePensionResult?.employeePremiumMonthly ?? null
  const pensionEmployerAmount = corePensionResult?.employerPremiumMonthly ?? null
  const pensionFiscalBases = corePensionResult?.status === 'CALCULATED'
    ? corePensionResult.fiscalBases
    : {
      wageTax: monthlyGrossForPension,
      employeeInsurance: monthlyGrossForPension,
      zvw: monthlyGrossForPension,
    }
  const pensionResultSummary = corePensionResult === null ? null : (({ trace, ...summary }) => {
    void trace
    return summary
  })(corePensionResult)
  const pensionCalculationTrace = corePensionResult?.status === 'CALCULATED'
    ? JSON.parse(JSON.stringify(corePensionResult.trace)) as PayrollJsonValue
    : undefined
  const pensionCalculationInput = resolvedPension && 'input' in resolvedPension
    ? JSON.parse(JSON.stringify(resolvedPension.input)) as PayrollJsonValue
    : undefined

  const sourceReady = taxProfileResolved && employmentStartConsistent && laborConditionConsistent
    && functionAssignmentConsistent && source.sourceGaps.every((gap) => {
    if ((gap.field === 'taxProfile' || gap.field === 'fiscalProfile') && gap.reasonCode === 'NO_ACCEPTED_SOURCE_CONTRACT') {
      return taxProfileResolved
    }
    if (gap.field === 'incomeRelationship') return incomeFallbackAllowed && !incomeAmbiguous
    return false
  })
  if (!sourceReady) addBlocker(gaps, blockers, 'source', 'PAYRUN01_UNRESOLVED_SOURCE_GAP')

  const controls: Payrun01ProjectionControls = {
    sourceReady,
    employmentStartConsistent,
    ikvUnambiguous,
    salaryConsistent,
    hoursConsistent,
    normalHoursNotDuplicated,
    additionalHoursSupported: additionalClassified,
    sourceFresh,
    compositionSupported: config.compositionId.length > 0 && config.arrangementConfigHash.length === 64,
    pensionRuleReady,
    socialWageCapClear: config.socialWageCapClear,
    cumulativeContinuity,
    reservationContinuity,
    hashesConsistent: originalHashMatches,
  }
  if (!config.socialWageCapClear) addBlocker(gaps, blockers, 'socialWageCap', 'PAYRUN01_SOCIAL_WAGE_CAP_NOT_ESTABLISHED')

  const payrollOwned = {
    schemaVersion: 'payrun01-payroll-projection-v1',
    scenarioId: config.scenarioId,
    assignmentId: config.assignmentId,
    arrangementConfigId: config.arrangementConfigId,
    arrangementConfigHash: config.arrangementConfigHash,
    compositionId: config.compositionId,
    taxProfile: { ...config.taxProfile, status: 'PAYROLL_OWNED_SCENARIO' },
    calculationIncomeRelationship: {
      id: calculationIncomeRelationshipId,
      status: incomeNeedsFallback ? (incomeFallbackAllowed && !incomeAmbiguous ? 'EXPLICIT_PAYROLL_FALLBACK' : 'BLOCKED') : 'SOURCE_LINKED',
      sourceId: sourceIncomeId,
      sourceSnapshotId: source.id,
    },
    amounts: config.pension.mode === 'DISABLED'
      ? { employeePension: '0.00', employerPension: '0.00' }
      : corePensionResult?.status === 'CALCULATED'
        ? { employeePension: pensionEmployeeAmount, employerPension: pensionEmployerAmount }
        : {},
    fiscalBases: {
      wageTax: pensionFiscalBases.wageTax ?? monthlyGrossForPension ?? '0.00',
      employeeInsurance: pensionFiscalBases.employeeInsurance ?? monthlyGrossForPension ?? '0.00',
      zvw: pensionFiscalBases.zvw ?? monthlyGrossForPension ?? '0.00',
      status: corePensionResult?.status === 'CALCULATED'
        ? 'CALCULATED_FROM_PENSION_RULE'
        : config.pension.mode === 'EXCLUDED_SOURCE_GAP'
          ? 'PRE_PENSION_SOURCE_GAP'
          : config.pension.mode === 'DISABLED'
            ? 'NO_PENSION_CONFIGURED'
            : 'BLOCKED',
    },
    employerRates: { ...config.employerRates },
    reserveRates: { ...config.reserveRates },
    controls: { ...controls },
    cumulatives: {
      grossWageBeforePeriod: opening.grossWage,
      holidayReserveBeforePeriod: opening.holidayReserve,
      yearEndReserveBeforePeriod: opening.yearEndReserve,
    },
    pension: config.pension.mode === 'DISABLED'
      ? { status: 'DISABLED_BY_SCENARIO', reasonCode: null }
      : config.pension.mode === 'EXCLUDED_SOURCE_GAP'
        ? { status: 'EXCLUDED_SOURCE_GAP', reasonCode: config.pension.reasonCode }
        : config.pension.mode === 'CORE_ARRANGEMENT'
          ? corePensionResult?.status === 'CALCULATED'
            ? {
              status: 'CALCULATED',
              reasonCode: config.pension.fiscalTreatmentReady === false
                ? config.pension.fiscalTreatmentReasonCode ?? 'PENSION_FISCAL_TREATMENT_UNVERIFIED'
                : null,
              fiscalTreatmentStatus: config.pension.fiscalTreatmentReady === false ? 'UNVERIFIED' : 'READY',
              result: pensionResultSummary,
            }
            : { status: 'BLOCKED', reasonCode: resolvedPension && 'reasonCode' in resolvedPension ? resolvedPension.reasonCode : 'PAYRUN01_PENSION_CALCULATION_BLOCKED' }
          : { status: 'UNSUPPORTED', reasonCode: config.pension.reasonCode },
    ...(pensionCalculationInput !== undefined ? { pensionCalculationInput } : {}),
    ...(corePensionResult?.status === 'CALCULATED' ? { pensionCalculationSummary: pensionResultSummary } : {}),
    ...(pensionCalculationTrace !== undefined ? { pensionCalculationTrace } : {}),
    actualWorkProjection: {
      status: additionalClassified ? 'READY_FOR_ENGINE' : 'BLOCKED',
      normalHoursObserved: normalHours.toFixed(4),
      additionalHours: additionalHours.toFixed(4),
      cashCompensatedHours: cashCompensatedHours.toFixed(4),
      additionalEntryCount,
      additionalCompensationMode: additionalHours === 0 ? 'NOT_APPLICABLE' : config.additionalHourCompensation?.mode ?? 'UNRESOLVED',
      normalHoursPaidSeparately: false,
    },
    openingCumulatives: {
      id: opening.id,
      status: opening.status,
      throughPeriod: { year: opening.throughPeriod.year, month: opening.throughPeriod.month },
      sourceHash: opening.sourceHash,
    },
    provenance: {
      sourceSnapshotId: source.id,
      sourceSnapshotHash: source.sourceHash,
      resolvedSourceGaps: source.sourceGaps.filter((gap) =>
        ((gap.field === 'taxProfile' || gap.field === 'fiscalProfile') && gap.reasonCode === 'NO_ACCEPTED_SOURCE_CONTRACT' && taxProfileResolved)
        || (gap.field === 'incomeRelationship' && incomeFallbackAllowed && !incomeAmbiguous))
        .map((gap) => ({ field: gap.field, status: gap.status, reasonCode: gap.reasonCode })),
      blockers: [...blockers],
    },
  } satisfies PayrollJsonValue

  const sourceGaps = gaps
  const sourceVersionVector = {
    ...source.sourceVersionVector,
    [`payroll_arrangement_config:${config.arrangementConfigId}`]: config.arrangementConfigHash,
    [`payroll_assignment:${config.assignmentId}`]: config.scenarioId,
    [`payroll_opening_cumulatives:${opening.id}`]: opening.sourceHash,
  }
  const canonicalSource = {
    ...((canonical ?? {}) as Record<string, PayrollJsonValue>),
    fiscalProfile: { ...config.taxProfile, status: 'PAYROLL_OWNED_SCENARIO' },
    regularWage: {
      ...config.taxProfile,
      fulltimeMonthlyAmount,
      contractHoursPerWeek: decimalInput(sourceContractHours),
      fulltimeHoursPerWeek: decimalInput(sourceFulltimeHours),
      salaryPricingMode: config.expectedSalary.pricingMode,
      ...(sourceMonthlyGrossAmount === null ? {} : { grossAmount: sourceMonthlyGrossAmount }),
      incomeRelationshipCount: ikvUnambiguous ? '1' : '0',
      projectionStatus: salaryConsistent && laborConditionConsistent && functionAssignmentConsistent && additionalClassified
        ? 'READY_FOR_ENGINE' : 'BLOCKED',
    },
    payrollOwned,
  } satisfies PayrollJsonValue
  const projectedHashInput = {
    ...hashInput(source),
    canonicalSource,
    sourceVersionVector,
    sourceGaps,
  }
  const snapshot: PayrollSourceSnapshot = {
    ...source,
    canonicalSource,
    sourceVersionVector,
    sourceGaps,
    sourceHash: hashPayrollSourceSnapshot(projectedHashInput),
  }

  return {
    snapshot,
    calculationIncomeRelationshipId,
    controls,
    blockers: [...blockers],
    provenance: {
      sourceSnapshotId: source.id,
      sourceSnapshotHash: source.sourceHash,
      projectedSnapshotHash: snapshot.sourceHash,
      projectedAt: config.asOf,
      scenarioId: config.scenarioId,
      assignmentId: config.assignmentId,
      arrangementConfigId: config.arrangementConfigId,
      compositionId: config.compositionId,
      sourceIncomeRelationshipId: source.sourceIncomeRelationshipId,
      calculationIncomeRelationshipId,
      additionalHours: additionalHours.toFixed(4),
      additionalCompensationMode: additionalHours === 0 ? 'NOT_APPLICABLE' : config.additionalHourCompensation?.mode ?? 'UNRESOLVED',
      normalHoursPaidSeparately: false,
      openingCumulatives: {
        id: opening.id,
        status: opening.status,
        throughPeriod: { year: opening.throughPeriod.year, month: opening.throughPeriod.month },
        sourceHash: opening.sourceHash,
      },
      pensionStatus: payrollOwned.pension.status,
      blockers: [...blockers],
    },
  }
}
