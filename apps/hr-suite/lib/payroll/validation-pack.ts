import 'server-only'

import { stableSerialize } from '@liquid-hr/payroll-engine'
import {
  getCaoBench02CalculationCase,
  getCaoBench02RuleMetadata,
  isCaoBench02CalculationCase,
} from './cao-bench02-calculation-service'
import { ARRANGEMENT_PACKAGES, getSyntheticArrangementFixture, hashArrangementPackageVersion } from './arrangement-foundation'
import type { PayrollJson } from './database'
import type { SyntheticPayrollView } from './synthetic-calculation-service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_PATTERN = /^[0-9a-f]{64}$/i
type CaoBench02RuleMetadata = NonNullable<ReturnType<typeof getCaoBench02RuleMetadata>>
const RESTRICTED_ID_KEYS = new Set([
  'tenantid',
  'hrgroupid',
  'administrationid',
  'payrolladministrationid',
  'employeeid',
  'employmentid',
  'sourceemployeeid',
  'sourceemploymentid',
  'sourceincomerelationshipid',
  'createdbyuserid',
  'updatedbyuserid',
])

/**
 * Stable JSON download contract. Keep the v1 field meanings and exact decimal
 * strings stable; add new fields compatibly or introduce a new schema version.
 */
export interface CaoBench02ValidationPack {
  readonly schemaVersion: 'liquidhr.payroll-validation-pack.v1'
  readonly notice: 'TEST — CONCEPTBEREKENING — NIET VOOR LOONBETALING'
  readonly case: {
    readonly caseKey: string
    readonly period: { readonly year: number; readonly month: number }
    readonly arrangementName: string
    readonly arrangementVersion: string
  }
  readonly run: {
    readonly runId: string
    readonly status: 'SUCCEEDED'
    readonly runType: string
    readonly createdAt: string
    readonly startedAt: string | null
    readonly finishedAt: string | null
  }
  readonly limitations: {
    readonly calculationScope: 'GROSS_ONLY_CONCEPT'
    readonly payrollPayment: 'NOT_SUPPORTED'
    readonly wageTax: 'NOT_CALCULATED'
    readonly employeeDeductions: 'NOT_CALCULATED'
    readonly netPay: 'NOT_CALCULATED'
    readonly employerCosts: 'NOT_CALCULATED'
  }
  readonly source: {
    readonly sourceSnapshotId: string
    readonly sourceHash: string
    readonly sourcePayload: PayrollJson
    readonly sourceVersionVector: Readonly<Record<string, string>>
  }
  readonly input: {
    readonly inputSetId: string
    readonly inputHash: string
    readonly rulePackageCompositionId: string
    readonly engineVersion: string
    readonly values: Readonly<Record<string, string | boolean>>
  }
  readonly provenance: {
    readonly packageId: string
    readonly packageVersion: string
    readonly packageHash: string
    readonly rulePackageCompositionId: string
    readonly rules: CaoBench02RuleMetadata['rules']
    readonly sourceReferences: CaoBench02RuleMetadata['sourceMetadata']
    readonly scopeNotice?: string
  }
  readonly result: {
    readonly resultHash: string
    readonly components: readonly {
      readonly key: string
      readonly amount: string | null
      readonly payload: PayrollJson
    }[]
    readonly trace: PayrollJson
    readonly controls: readonly {
      readonly key: string
      readonly status: string
      readonly details: PayrollJson
    }[]
  }
}
export class ValidationPackError extends Error {
  constructor(readonly code: 'VALIDATION_PACK_UNAVAILABLE' | 'VALIDATION_PACK_DATA_INVALID') {
    super(code)
    this.name = 'ValidationPackError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertNoRestrictedIdentifiers(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoRestrictedIdentifiers)
    return
  }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    if (RESTRICTED_ID_KEYS.has(key.toLowerCase())) throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
    assertNoRestrictedIdentifiers(child)
  }
}

function expectedSourcePayload(caseKey: string): Record<string, unknown> {
  if (!isCaoBench02CalculationCase(caseKey)) throw new ValidationPackError('VALIDATION_PACK_UNAVAILABLE')
  const spec = getCaoBench02CalculationCase(caseKey)
  const fixture = spec ? getSyntheticArrangementFixture(spec.fixtureCode) : null
  const metadata = getCaoBench02RuleMetadata(caseKey)
  if (!spec || !fixture || !metadata) throw new ValidationPackError('VALIDATION_PACK_UNAVAILABLE')

  const effectiveDate = `${spec.period.year}-${String(spec.period.month).padStart(2, '0')}-01`
  return {
    schemaVersion: 'payroll-source-v1',
    employment: {
      source: 'SYNTHETIC_FIXTURE',
      fixtureCode: fixture.code,
      startsOn: fixture.effectiveFrom,
      endsOn: null,
      employmentType: 'REGULAR',
      contractType: 'PERMANENT',
      recordStatus: 'CONFIRMED',
    },
    scenario: {
      caseKey,
      effectiveDate,
      packageId: metadata.packageId,
      ...metadata.input,
    },
    incomeRelationship: { status: 'UNSUPPORTED', reasonCode: 'CAO_BENCH02_GROSS_ONLY' },
    fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_FISCAL_SCENARIO' },
  }
}

function assertValidView(caseKey: string, administrationId: string, view: SyntheticPayrollView): asserts view is SyntheticPayrollView & { resultHash: string; trace: PayrollJson } {
  const metadata = isCaoBench02CalculationCase(caseKey) ? getCaoBench02RuleMetadata(caseKey) : null
  const spec = isCaoBench02CalculationCase(caseKey) ? getCaoBench02CalculationCase(caseKey) : null
  if (!metadata || !spec
    || !UUID_PATTERN.test(administrationId)
    || view.status !== 'SUCCEEDED'
    || view.runType !== 'GOLDEN_CASE'
    || view.caseKey !== caseKey
    || view.payrollAdministrationId !== administrationId
    || !UUID_PATTERN.test(view.runId)
    || !UUID_PATTERN.test(view.sourceSnapshotId)
    || !UUID_PATTERN.test(view.inputSetId)
    || !HASH_PATTERN.test(view.sourceHash)
    || !HASH_PATTERN.test(view.inputHash)
    || !view.resultHash
    || !HASH_PATTERN.test(view.resultHash)
    || view.rulePackageCompositionId !== metadata.compositionId
    || view.engineVersion.trim().length === 0
    || view.payrollPeriod.year !== spec.period.year
    || view.payrollPeriod.month !== spec.period.month
    || view.trace === null) {
    throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
  }

  let sourcePayload: Record<string, unknown>
  try {
    const expected = expectedSourcePayload(caseKey)
    const sourceScenario = isRecord(view.sourcePayload) && isRecord(view.sourcePayload.scenario) ? view.sourcePayload.scenario : null
    const selection = sourceScenario?.arrangementSelection
    const fixture = getSyntheticArrangementFixture(spec.fixtureCode)
    const arrangement = ARRANGEMENT_PACKAGES.find((candidate) => candidate.id === metadata.packageId)
    const arrangementVersion = arrangement?.versions.find((candidate) => candidate.version === metadata.arrangementVersion)
    const expectedPackageVersionHash = arrangement && arrangementVersion
      ? hashArrangementPackageVersion(arrangement, arrangementVersion)
      : null
    const expectedSelectionKeys = [
      'asOfDate', 'arrangementVersion', 'compositionSnapshotHash', 'effectiveFrom', 'effectiveTo',
      'fixtureCode', 'packageId', 'packageVersionHash', 'salaryStrategy',
    ].sort()
    if (!sourceScenario || !isRecord(selection) || !fixture || !arrangementVersion || !expectedPackageVersionHash
      || stableSerialize(Object.keys(selection).sort()) !== stableSerialize(expectedSelectionKeys)
      || selection.packageId !== metadata.packageId
      || selection.arrangementVersion !== metadata.arrangementVersion
      || selection.packageVersionHash !== expectedPackageVersionHash
      || selection.effectiveFrom !== arrangementVersion.effectiveFrom
      || selection.effectiveTo !== arrangementVersion.effectiveTo
      || selection.asOfDate !== `${spec.period.year}-${String(spec.period.month).padStart(2, '0')}-01`
      || selection.fixtureCode !== fixture.code
      || selection.salaryStrategy !== fixture.salaryStrategy
      || typeof selection.compositionSnapshotHash !== 'string'
      || !HASH_PATTERN.test(selection.compositionSnapshotHash)) {
      throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
    }
    const expectedScenario = expected.scenario as Record<string, unknown>
    expected.scenario = { ...expectedScenario, arrangementSelection: selection }
    const expectedVersionVector = {
      [`fixture:${fixture.code}`]: `${fixture.code}:v1`,
      [`scenario:${caseKey}`]: `${caseKey}:v1`,
      [`package:${metadata.packageId}`]: `${metadata.arrangementVersion}:${expectedPackageVersionHash}`,
      [`arrangement-composition:${fixture.code}:${selection.asOfDate}`]: selection.compositionSnapshotHash,
      [`rule-package:${metadata.compositionId}`]: `${metadata.rulePackageVersion}:${metadata.packageHash}`,
    }
    if (stableSerialize(view.sourceVersionVector) !== stableSerialize(expectedVersionVector)) {
      throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
    }
    if (stableSerialize(view.sourcePayload) !== stableSerialize(expected)) {
      throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
    }
    sourcePayload = expected
  } catch {
    throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
  }
  assertNoRestrictedIdentifiers(sourcePayload)
  assertNoRestrictedIdentifiers(view.components)
  assertNoRestrictedIdentifiers(view.trace)
  assertNoRestrictedIdentifiers(view.controls)

  const trace = isRecord(view.trace) ? view.trace : null
  if (!trace
    || trace.status !== 'CALCULATED'
    || trace.caseKey !== caseKey
    || trace.sourceHash !== view.sourceHash
    || trace.inputHash !== view.inputHash
    || trace.resultHash !== view.resultHash
    || trace.rulePackageCompositionId !== view.rulePackageCompositionId
    || trace.engineVersion !== view.engineVersion) {
    throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
  }

  const expectedKeys = metadata.outputs.map((output) => output.key).sort()
  const actualKeys = view.components.map((component) => component.key).sort()
  if (stableSerialize(expectedKeys) !== stableSerialize(actualKeys)) {
    throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
  }
  for (const component of view.components) {
    const payload = isRecord(component.payload) ? component.payload : null
    if (!payload
      || payload.key !== component.key
      || payload.amount !== component.amount
      || typeof payload.componentCode !== 'string'
      || typeof payload.outputName !== 'string') {
      throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')
    }
  }
}

export function buildCaoBench02ValidationPack(caseKey: string, administrationId: string, view: SyntheticPayrollView): CaoBench02ValidationPack {
  if (!isCaoBench02CalculationCase(caseKey)) throw new ValidationPackError('VALIDATION_PACK_UNAVAILABLE')
  assertValidView(caseKey, administrationId, view)
  const metadata = getCaoBench02RuleMetadata(caseKey)
  const arrangement = metadata ? ARRANGEMENT_PACKAGES.find((candidate) => candidate.id === metadata.packageId) : null
  if (!metadata || !arrangement) throw new ValidationPackError('VALIDATION_PACK_UNAVAILABLE')

  const sourcePayload = view.sourcePayload
  const trace = view.trace
  if (!trace) throw new ValidationPackError('VALIDATION_PACK_DATA_INVALID')

  return {
    schemaVersion: 'liquidhr.payroll-validation-pack.v1',
    notice: 'TEST — CONCEPTBEREKENING — NIET VOOR LOONBETALING',
    case: {
      caseKey,
      period: view.payrollPeriod,
      arrangementName: arrangement.displayName,
      arrangementVersion: metadata.arrangementVersion,
    },
    run: {
      runId: view.runId,
      status: 'SUCCEEDED',
      runType: view.runType,
      createdAt: view.createdAt,
      startedAt: view.startedAt,
      finishedAt: view.finishedAt,
    },
    limitations: {
      calculationScope: 'GROSS_ONLY_CONCEPT',
      payrollPayment: 'NOT_SUPPORTED',
      wageTax: 'NOT_CALCULATED',
      employeeDeductions: 'NOT_CALCULATED',
      netPay: 'NOT_CALCULATED',
      employerCosts: 'NOT_CALCULATED',
    },
    source: {
      sourceSnapshotId: view.sourceSnapshotId,
      sourceHash: view.sourceHash,
      sourcePayload,
      sourceVersionVector: view.sourceVersionVector,
    },
    input: {
      inputSetId: view.inputSetId,
      inputHash: view.inputHash,
      rulePackageCompositionId: view.rulePackageCompositionId,
      engineVersion: view.engineVersion,
      values: metadata.input,
    },
    provenance: {
      packageId: metadata.rulePackageId,
      packageVersion: metadata.rulePackageVersion,
      packageHash: metadata.packageHash,
      rulePackageCompositionId: metadata.compositionId,
      rules: metadata.rules,
      sourceReferences: metadata.sourceMetadata,
      ...(typeof metadata.sourceMetadata.grossScopeNotice === 'string'
        ? { scopeNotice: metadata.sourceMetadata.grossScopeNotice }
        : {}),
    },
    result: {
      resultHash: view.resultHash,
      components: view.components.map(({ key, amount, payload }) => ({ key, amount, payload })),
      trace,
      controls: view.controls.map(({ key, status, details }) => ({ key, status, details })),
    },
  }
}

export function isValidationPackRunId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function isValidationPackCaseKey(value: string): boolean {
  return isCaoBench02CalculationCase(value)
}

export function isValidationPackCompatibleRun(caseKey: string, runId: string, administrationId: string, view: SyntheticPayrollView | null): view is SyntheticPayrollView {
  if (!view || !isValidationPackRunId(runId)) return false
  return isCaoBench02CalculationCase(caseKey)
    && view.runId === runId
    && view.caseKey === caseKey
    && view.payrollAdministrationId === administrationId
    && view.status === 'SUCCEEDED'
}
