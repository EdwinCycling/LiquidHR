import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyntheticPayrollView } from './synthetic-calculation-service'

const mocks = vi.hoisted(() => ({
  getFixture: vi.fn(),
  getCase: vi.fn(),
  getMetadata: vi.fn(),
  isCase: vi.fn(),
}))

vi.mock('./arrangement-foundation', () => ({
  ARRANGEMENT_PACKAGES: [{
    id: 'KINDEROPVANG_2025_2026',
    displayName: 'Cao Kinderopvang 2025-2026',
    versions: [{ version: '2026.07', effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31' }],
  }],
  getSyntheticArrangementFixture: mocks.getFixture,
  hashArrangementPackageVersion: () => '1'.repeat(64),
}))
vi.mock('./cao-bench02-calculation-service', () => ({
  getCaoBench02CalculationCase: mocks.getCase,
  getCaoBench02RuleMetadata: mocks.getMetadata,
  isCaoBench02CalculationCase: mocks.isCase,
}))

import {
  buildCaoBench02ValidationPack,
  isValidationPackCompatibleRun,
  isValidationPackRunId,
  ValidationPackError,
} from './validation-pack'

const CASE_KEY = 'CAO-BENCH02-K1'
const RUN_ID = '44444444-4444-4444-8444-444444444444'
const ADMIN_ID = '55555555-5555-4555-8555-555555555555'
const SOURCE_ID = '11111111-1111-4111-8111-111111111111'
const INPUT_ID = '22222222-2222-4222-8222-222222222222'
const SOURCE_HASH = 'a'.repeat(64)
const INPUT_HASH = 'b'.repeat(64)
const RESULT_HASH = 'c'.repeat(64)
const PACKAGE_VERSION_HASH = '1'.repeat(64)
const COMPOSITION_SNAPSHOT_HASH = '2'.repeat(64)
const COMPOSITION_ID = 'KINDEROPVANG_2025_2026:2026.01'

const metadata = {
  caseKey: CASE_KEY,
  fixtureCode: 'CAO-BENCH02-KINDEROPVANG',
  packageId: 'KINDEROPVANG_2025_2026',
  rulePackageId: 'CAO-KINDEROPVANG-2025-2026',
  displayNameKey: 'payrollLabBenchK1',
  arrangementNameKey: 'payrollLabBenchKinderopvang',
  period: { year: 2026, month: 8 },
  effectiveDate: '2026-08-01',
  arrangementVersion: '2026.07',
  rulePackageVersion: '2026.01',
  compositionId: COMPOSITION_ID,
  packageHash: 'd'.repeat(64),
  input: { scenarioCode: 'K1', salaryScale: '6', salaryNumber: '12', contractHoursPerWeek: '36', fullTimeHoursPerWeek: '36', sundayHoursInPeriod: '0' },
  outputs: [
    { key: 'base_salary', componentCode: 'KO_GROSS_PAY', outputName: 'baseSalary' },
    { key: 'gross_salary', componentCode: 'KO_GROSS_PAY', outputName: 'grossEarnings' },
  ],
  rules: [{ ruleKey: 'kinderopvang.2026.monthly-gross-k1-k2', ruleVersion: '2026.01', implementationHash: 'e'.repeat(64), parameterSetHash: 'f'.repeat(64), packageId: 'CAO-KINDEROPVANG-2025-2026', packageVersion: '2026.01' }],
  sourceMetadata: { salaryTableUrl: 'https://example.test/source', roundingPolicy: 'No payroll tax or net pay.' },
}

const sourcePayload = {
  schemaVersion: 'payroll-source-v1',
  employment: {
    source: 'SYNTHETIC_FIXTURE',
    fixtureCode: 'CAO-BENCH02-KINDEROPVANG',
    startsOn: '2026-07-01',
    endsOn: null,
    employmentType: 'REGULAR',
    contractType: 'PERMANENT',
    recordStatus: 'CONFIRMED',
  },
  scenario: {
    caseKey: CASE_KEY,
    effectiveDate: '2026-08-01',
    packageId: metadata.packageId,
    ...metadata.input,
    arrangementSelection: {
      packageId: metadata.packageId,
      arrangementVersion: metadata.arrangementVersion,
      packageVersionHash: PACKAGE_VERSION_HASH,
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-08-31',
      compositionSnapshotHash: COMPOSITION_SNAPSHOT_HASH,
      asOfDate: metadata.effectiveDate,
      fixtureCode: metadata.fixtureCode,
      salaryStrategy: 'DISCRETE_SCALE_STEP',
    },
  },
  incomeRelationship: { status: 'UNSUPPORTED', reasonCode: 'CAO_BENCH02_GROSS_ONLY' },
  fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_FISCAL_SCENARIO' },
}

function makeView(overrides: Partial<SyntheticPayrollView> = {}): SyntheticPayrollView {
  return {
    caseKey: CASE_KEY,
    outcome: 'CALCULATED',
    unsupportedReason: null,
    runId: RUN_ID,
    status: 'SUCCEEDED',
    runType: 'GOLDEN_CASE',
    payrollAdministrationId: ADMIN_ID,
    employeeId: '33333333-3333-4333-8333-333333333333',
    sourceSnapshotId: SOURCE_ID,
    inputSetId: INPUT_ID,
    sourcePayload,
    sourceVersionVector: {
      'fixture:CAO-BENCH02-KINDEROPVANG': 'CAO-BENCH02-KINDEROPVANG:v1',
      [`scenario:${CASE_KEY}`]: `${CASE_KEY}:v1`,
      [`package:${metadata.packageId}`]: `${metadata.arrangementVersion}:${PACKAGE_VERSION_HASH}`,
      [`arrangement-composition:${metadata.fixtureCode}:${metadata.effectiveDate}`]: COMPOSITION_SNAPSHOT_HASH,
      [`rule-package:${COMPOSITION_ID}`]: `${metadata.rulePackageVersion}:${metadata.packageHash}`,
    },
    payrollPeriod: { year: 2026, month: 8 },
    sourceHash: SOURCE_HASH,
    inputHash: INPUT_HASH,
    resultHash: RESULT_HASH,
    rulePackageCompositionId: COMPOSITION_ID,
    engineVersion: 'payroll-engine-test',
    components: [
      { key: 'base_salary', amount: '2777.00', payload: { key: 'base_salary', amount: '2777.00', componentCode: 'KO_GROSS_PAY', outputName: 'baseSalary' } },
      { key: 'gross_salary', amount: '2777.00', payload: { key: 'gross_salary', amount: '2777.00', componentCode: 'KO_GROSS_PAY', outputName: 'grossEarnings' } },
    ],
    trace: {
      status: 'CALCULATED',
      caseKey: CASE_KEY,
      sourceHash: SOURCE_HASH,
      inputHash: INPUT_HASH,
      resultHash: RESULT_HASH,
      rulePackageCompositionId: COMPOSITION_ID,
      engineVersion: 'payroll-engine-test',
      steps: [],
    },
    controls: [{ key: 'result_hash_present', status: 'PASS', details: { resultHash: RESULT_HASH } }],
    startedAt: '2026-10-03T09:00:00.000Z',
    finishedAt: '2026-10-03T09:00:01.000Z',
    createdAt: '2026-10-03T09:00:00.000Z',
    errorCode: null,
    ...overrides,
  }
}

describe('CAO-BENCH02 validation pack', () => {
  beforeEach(() => {
    mocks.getFixture.mockReset().mockReturnValue({ code: 'CAO-BENCH02-KINDEROPVANG', effectiveFrom: '2026-07-01', salaryStrategy: 'DISCRETE_SCALE_STEP' })
    mocks.getCase.mockReset().mockReturnValue({ caseKey: CASE_KEY, period: { year: 2026, month: 8 } })
    mocks.getMetadata.mockReset().mockReturnValue(metadata)
    mocks.isCase.mockReset().mockImplementation((value: string) => value === CASE_KEY)
  })

  it('emits the stable gross-only schema with exact decimal strings and synthetic source data', () => {
    const view = makeView()
    const pack = buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, view)
    const json = JSON.stringify(pack)

    expect(pack.schemaVersion).toBe('liquidhr.payroll-validation-pack.v1')
    expect(pack.notice).toBe('TEST — CONCEPTBEREKENING — NIET VOOR LOONBETALING')
    expect(pack.source.sourcePayload).toEqual(view.sourcePayload)
    expect(pack.case.arrangementVersion).toBe('2026.07')
    expect(pack.provenance.packageId).toBe('CAO-KINDEROPVANG-2025-2026')
    expect(pack.provenance.packageVersion).toBe('2026.01')
    expect(pack.input.values).toEqual(metadata.input)
    expect(pack.provenance.sourceReferences).toEqual(metadata.sourceMetadata)
    expect(pack.result.components[0]?.amount).toBe('2777.00')
    expect(json).toContain('"amount":"2777.00"')
    expect(pack.limitations).toMatchObject({
      calculationScope: 'GROSS_ONLY_CONCEPT',
      payrollPayment: 'NOT_SUPPORTED',
      wageTax: 'NOT_CALCULATED',
      employeeDeductions: 'NOT_CALCULATED',
      netPay: 'NOT_CALCULATED',
      employerCosts: 'NOT_CALCULATED',
    })
    expect(json).not.toContain('33333333-3333-4333-8333-333333333333')
    expect(json).not.toContain(ADMIN_ID)
  })

  it('carries an explicit supported-scope notice from rule metadata into the JSON pack', () => {
    const scopeNotice = 'Gross excludes the 8% vacation allowance (vakantietoeslag).'
    mocks.getMetadata.mockReturnValue({
      ...metadata,
      sourceMetadata: { ...metadata.sourceMetadata, grossScopeNotice: scopeNotice },
    })

    const pack = buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, makeView())

    expect(pack.provenance.scopeNotice).toBe(scopeNotice)
    expect(pack.provenance.sourceReferences.grossScopeNotice).toBe(scopeNotice)
  })

  it('rejects failed, tampered, or non-synthetic source records', () => {
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, makeView({ status: 'FAILED' }))).toThrow(ValidationPackError)

    const tamperedSource = structuredClone(sourcePayload) as typeof sourcePayload & { employeeId?: string }
    tamperedSource.employeeId = 'real-person-id'
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, makeView({ sourcePayload: tamperedSource }))).toThrow(ValidationPackError)

    expect(() => buildCaoBench02ValidationPack('CAO-BENCH02-H1', ADMIN_ID, makeView())).toThrow(ValidationPackError)
  })

  it('rejects a changed arrangement version pin or source version vector', () => {
    const tamperedSelection = structuredClone(sourcePayload)
    tamperedSelection.scenario.arrangementSelection.packageVersionHash = '9'.repeat(64)
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, makeView({ sourcePayload: tamperedSelection }))).toThrow(ValidationPackError)

    const tamperedVector = makeView({
      sourceVersionVector: {
        ...makeView().sourceVersionVector,
        [`package:${metadata.packageId}`]: `${metadata.arrangementVersion}:${'9'.repeat(64)}`,
      },
    })
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, tamperedVector)).toThrow(ValidationPackError)

    const tamperedRulePackageVector = makeView({
      sourceVersionVector: {
        ...makeView().sourceVersionVector,
        [`rule-package:${COMPOSITION_ID}`]: `${metadata.rulePackageVersion}:${'9'.repeat(64)}`,
      },
    })
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, tamperedRulePackageVector)).toThrow(ValidationPackError)
  })

  it('rejects result payloads with restricted identifiers and views from another payroll administration', () => {
    const componentWithForeignIdentity = {
      key: 'base_salary',
      amount: '2777.00',
      payload: { key: 'base_salary', amount: '2777.00', componentCode: 'KO_GROSS_PAY', outputName: 'baseSalary', employeeId: 'foreign-person' },
    }
    const resultWithForeignIdentity = makeView({ components: [componentWithForeignIdentity, makeView().components[1]!] })
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, resultWithForeignIdentity)).toThrow(ValidationPackError)

    const foreignAdministration = '77777777-7777-4777-8777-777777777777'
    const foreignView = makeView({ payrollAdministrationId: foreignAdministration })
    expect(isValidationPackCompatibleRun(CASE_KEY, RUN_ID, ADMIN_ID, foreignView)).toBe(false)
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, foreignView)).toThrow(ValidationPackError)
    expect(() => buildCaoBench02ValidationPack(CASE_KEY, ADMIN_ID, makeView({ caseKey: 'CAO-BENCH02-R1' }))).toThrow(ValidationPackError)
  })

  it('binds the download to the exact run, case, successful status, and administration', () => {
    const view = makeView()
    expect(isValidationPackCompatibleRun(CASE_KEY, RUN_ID, ADMIN_ID, view)).toBe(true)
    expect(isValidationPackCompatibleRun(CASE_KEY, '66666666-6666-4666-8666-666666666666', ADMIN_ID, view)).toBe(false)
    expect(isValidationPackCompatibleRun(CASE_KEY, RUN_ID, '77777777-7777-4777-8777-777777777777', view)).toBe(false)
    expect(isValidationPackCompatibleRun(CASE_KEY, RUN_ID, ADMIN_ID, makeView({ status: 'FAILED' }))).toBe(false)
  })

  it('accepts only exact UUID run identifiers', () => {
    expect(isValidationPackRunId(RUN_ID)).toBe(true)
    expect(isValidationPackRunId('44444444444444448444444444444444')).toBe(false)
    expect(isValidationPackRunId('44444444-4444-4444-8444-44444444444z')).toBe(false)
    expect(isValidationPackRunId('not-a-run')).toBe(false)
  })
})
