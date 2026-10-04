import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'

export const ARRANGEMENT_SALARY_STRATEGIES = [
  'DISCRETE_SCALE_STEP',
  'OPEN_SALARY_BAND',
  'FREELY_NEGOTIATED',
] as const

export type ArrangementSalaryStrategy = typeof ARRANGEMENT_SALARY_STRATEGIES[number]
export type ArrangementPackageKind = 'COLLECTIVE_AGREEMENT' | 'COMPANY_POLICY'

export interface ArrangementSourceMetadata {
  readonly sourceTitle: string
  readonly sourceUrl: string
  readonly recordedOn: string
  readonly status: 'REFERENCE_ONLY' | 'SYNTHETIC_POLICY'
  readonly note: string
}

export interface ArrangementPackageVersion {
  readonly version: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly supportedSalaryStrategies: readonly ArrangementSalaryStrategy[]
  readonly sourceMetadata: ArrangementSourceMetadata
}

export interface ArrangementPackage {
  readonly id: string
  readonly displayName: string
  readonly kind: ArrangementPackageKind
  readonly versions: readonly ArrangementPackageVersion[]
}

const sourceOnlyNote = 'Reference metadata only. Salary tables, eligibility rules, and payroll calculations are not implemented in CAO-BENCH02 Phase 1.'
const phase2ReferenceNote = 'Reference metadata for the named agreement release only. CAO-BENCH02 Phase 2 evaluates limited synthetic scenarios; it does not implement the complete agreement, determine legal applicability, or calculate tax or net pay.'

const arrangementPackages: readonly ArrangementPackage[] = [
  {
    id: 'KINDEROPVANG_2025_2026',
    displayName: 'Cao Kinderopvang 2025–2026',
    kind: 'COLLECTIVE_AGREEMENT',
    versions: [
      {
        version: '2025.01',
        effectiveFrom: '2025-01-01',
        effectiveTo: '2025-06-30',
        supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'],
        sourceMetadata: {
          sourceTitle: 'Cao Kinderopvang 2025–2026',
          sourceUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026',
          recordedOn: '2026-10-03',
          status: 'REFERENCE_ONLY',
          note: sourceOnlyNote,
        },
      },
      {
        version: '2025.07',
        effectiveFrom: '2025-07-01',
        effectiveTo: '2025-12-31',
        supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'],
        sourceMetadata: {
          sourceTitle: 'Salarisbepaling Cao Kinderopvang 2025–2026',
          sourceUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen',
          recordedOn: '2026-10-03',
          status: 'REFERENCE_ONLY',
          note: sourceOnlyNote,
        },
      },
      {
        version: '2026.01',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'],
        sourceMetadata: {
          sourceTitle: 'Cao Kinderopvang 2025–2026',
          sourceUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026',
          recordedOn: '2026-10-03',
          status: 'REFERENCE_ONLY',
          note: sourceOnlyNote,
        },
      },
      {
        version: '2026.07',
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-08-31',
        supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'],
        sourceMetadata: {
          sourceTitle: 'Tussentijdse cao-besluiten Kinderopvang',
          sourceUrl: 'https://www.kinderopvang-werkt.nl/alles-over-de-cao-kinderopvang/tussentijdse-cao-besluiten',
          recordedOn: '2026-10-03',
          status: 'REFERENCE_ONLY',
          note: 'Interim agreement changes are published separately and may already be in force. This reference version does not ingest their terms or claim complete applicability.',
        },
      },
      {
        version: '2026.09',
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'],
        sourceMetadata: {
          sourceTitle: 'Salarisbepaling Cao Kinderopvang 2025–2026',
          sourceUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen',
          recordedOn: '2026-10-03',
          status: 'REFERENCE_ONLY',
          note: phase2ReferenceNote,
        },
      },
    ],
  },
  {
    id: 'RETAIL_NON_FOOD_MODE_2026_2027',
    displayName: 'Cao Retail Non-Food — Mode 2026–2027',
    kind: 'COLLECTIVE_AGREEMENT',
    versions: [
      {
        version: '2026.01',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'],
        sourceMetadata: {
          sourceTitle: 'Loontabellen cao Retail Non-Food per 1 januari 2026',
          sourceUrl: 'https://www.inretail.nl/kennisbank/personeel/loontabellen-cao-retail-non-food-per-1-januari-2026/',
          recordedOn: '2026-10-03',
          status: 'REFERENCE_ONLY',
          note: sourceOnlyNote,
        },
      },
      {
        version: '2026.07',
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-12-31',
        supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'],
        sourceMetadata: {
          sourceTitle: 'Cao Retail Non-Food — loontabellen per 1 juli 2026',
          sourceUrl: 'https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf',
          recordedOn: '2026-10-03',
          status: 'REFERENCE_ONLY',
          note: 'This table release is versioned through 2026-12-31. Known January and July 2027 wage adjustments require reviewed catalog versions before those dates; later dates fail closed.',
        },
      },
    ],
  },
  {
    id: 'LHR_DEMO_OPEN_BANDS_2026',
    displayName: 'LiquidHR Demo — Open Salarisbanden 2026',
    kind: 'COMPANY_POLICY',
    versions: [
      {
        version: '2026.01',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        supportedSalaryStrategies: ['OPEN_SALARY_BAND', 'FREELY_NEGOTIATED'],
        sourceMetadata: {
          sourceTitle: 'Synthetic LiquidHR demo policy; public band reference in CAO-BENCH02 section 11',
          sourceUrl: 'https://zoek.officielebekendmakingen.nl/stcrt-2026-11183.html',
          recordedOn: '2026-10-03',
          status: 'SYNTHETIC_POLICY',
          note: 'Synthetic company policy metadata only. The referenced public band amounts and all other agreement terms are not included or treated as applicable.',
        },
      },
      {
        version: '2026.07',
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-12-31',
        supportedSalaryStrategies: ['OPEN_SALARY_BAND', 'FREELY_NEGOTIATED'],
        sourceMetadata: {
          sourceTitle: 'Synthetic LiquidHR demo policy; public band reference in CAO-BENCH02 section 11',
          sourceUrl: 'https://zoek.officielebekendmakingen.nl/stcrt-2026-11183.html',
          recordedOn: '2026-10-03',
          status: 'SYNTHETIC_POLICY',
          note: 'Synthetic LiquidHR demo policy. Cases B1/B2 reference published 2026 band figures for a fictional benchmark only; no collective agreement applicability, other terms, or tax/net pay is inferred.',
        },
      },
    ],
  },
]

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value)) deepFreeze(nested)
  return value
}

export const ARRANGEMENT_PACKAGES: readonly ArrangementPackage[] = deepFreeze(arrangementPackages)

export interface SyntheticArrangementFixture {
  readonly code: string
  readonly sourceEmploymentId: string
  readonly displayName: string
  readonly salaryStrategy: ArrangementSalaryStrategy
  readonly allowedPackageIds: readonly string[]
  readonly effectiveFrom: string
}

export const SYNTHETIC_ARRANGEMENT_FIXTURES: readonly SyntheticArrangementFixture[] = deepFreeze([
  {
    code: 'CAO-BENCH02-SCALE-STEP',
    sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000001',
    displayName: 'Synthetisch dienstverband — schaal en trede',
    salaryStrategy: 'DISCRETE_SCALE_STEP',
    allowedPackageIds: ['KINDEROPVANG_2025_2026', 'RETAIL_NON_FOOD_MODE_2026_2027'],
    effectiveFrom: '2026-09-01',
  },
  {
    code: 'CAO-BENCH02-OPEN-BAND',
    sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000002',
    displayName: 'Synthetisch dienstverband — open salarisband',
    salaryStrategy: 'OPEN_SALARY_BAND',
    allowedPackageIds: ['LHR_DEMO_OPEN_BANDS_2026'],
    effectiveFrom: '2026-09-01',
  },
  {
    code: 'CAO-BENCH02-FREELY-NEGOTIATED',
    sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000003',
    displayName: 'Synthetisch dienstverband — individueel overeengekomen salaris',
    salaryStrategy: 'FREELY_NEGOTIATED',
    allowedPackageIds: ['LHR_DEMO_OPEN_BANDS_2026'],
    effectiveFrom: '2026-09-01',
  },
  {
    code: 'CAO-BENCH02-KINDEROPVANG',
    sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000004',
    displayName: 'Synthetisch dienstverband — benchmark Kinderopvang K1/K2',
    salaryStrategy: 'DISCRETE_SCALE_STEP',
    allowedPackageIds: ['KINDEROPVANG_2025_2026'],
    effectiveFrom: '2026-07-01',
  },
  {
    code: 'CAO-BENCH02-RETAIL-MODE',
    sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000005',
    displayName: 'Synthetisch dienstverband — benchmark Retail R1/R2',
    salaryStrategy: 'DISCRETE_SCALE_STEP',
    allowedPackageIds: ['RETAIL_NON_FOOD_MODE_2026_2027'],
    effectiveFrom: '2026-07-01',
  },
  {
    code: 'CAO-BENCH02-OPEN-BAND-BENCHMARK',
    sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000006',
    displayName: 'Synthetisch dienstverband — benchmark open salarisband B1/B2',
    salaryStrategy: 'OPEN_SALARY_BAND',
    allowedPackageIds: ['LHR_DEMO_OPEN_BANDS_2026'],
    effectiveFrom: '2026-07-01',
  },
  {
    code: 'CAO-BENCH02-CEO-BENCHMARK',
    sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000007',
    displayName: 'Synthetisch dienstverband — individueel overeengekomen CEO C1',
    salaryStrategy: 'FREELY_NEGOTIATED',
    allowedPackageIds: ['LHR_DEMO_OPEN_BANDS_2026'],
    effectiveFrom: '2026-07-01',
  },
])

export type ArrangementFoundationErrorCode =
  | 'ARRANGEMENT_DATE_INVALID'
  | 'ARRANGEMENT_PACKAGE_UNKNOWN'
  | 'ARRANGEMENT_VERSION_NOT_FOUND'
  | 'ARRANGEMENT_VERSION_AMBIGUOUS'
  | 'ARRANGEMENT_STRATEGY_UNSUPPORTED'
  | 'ARRANGEMENT_FIXTURE_UNKNOWN'
  | 'ARRANGEMENT_FIXTURE_PACKAGE_FORBIDDEN'
  | 'ARRANGEMENT_ASSIGNMENT_INACTIVE'

export class ArrangementFoundationError extends Error {
  constructor(readonly code: ArrangementFoundationErrorCode) {
    super(code)
    this.name = 'ArrangementFoundationError'
  }
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function getArrangementPackage(packageId: string): ArrangementPackage | null {
  return ARRANGEMENT_PACKAGES.find((item) => item.id === packageId) ?? null
}

export function getSyntheticArrangementFixture(code: string): SyntheticArrangementFixture | null {
  return SYNTHETIC_ARRANGEMENT_FIXTURES.find((item) => item.code === code) ?? null
}

export function hashArrangementPackageVersion(
  arrangementPackage: ArrangementPackage,
  version: ArrangementPackageVersion,
): string {
  return sha256(stableSerialize({
    packageId: arrangementPackage.id,
    packageKind: arrangementPackage.kind,
    version: version.version,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    supportedSalaryStrategies: version.supportedSalaryStrategies,
    sourceMetadata: version.sourceMetadata,
  }))
}

export function resolveArrangementVersion(
  arrangementPackage: ArrangementPackage,
  asOfDate: string,
): ArrangementPackageVersion {
  if (!isIsoDate(asOfDate)) throw new ArrangementFoundationError('ARRANGEMENT_DATE_INVALID')
  const matches = arrangementPackage.versions.filter((version) => (
    version.effectiveFrom <= asOfDate
    && (version.effectiveTo === null || asOfDate <= version.effectiveTo)
  ))
  if (matches.length === 0) throw new ArrangementFoundationError('ARRANGEMENT_VERSION_NOT_FOUND')
  if (matches.length > 1) throw new ArrangementFoundationError('ARRANGEMENT_VERSION_AMBIGUOUS')
  return matches[0]!
}

export function validateArrangementSelection(input: {
  readonly fixtureCode: string
  readonly packageId: string
  readonly salaryStrategy: ArrangementSalaryStrategy
}): { readonly fixture: SyntheticArrangementFixture; readonly arrangementPackage: ArrangementPackage } {
  const fixture = getSyntheticArrangementFixture(input.fixtureCode)
  if (!fixture) throw new ArrangementFoundationError('ARRANGEMENT_FIXTURE_UNKNOWN')
  if (fixture.salaryStrategy !== input.salaryStrategy) {
    throw new ArrangementFoundationError('ARRANGEMENT_STRATEGY_UNSUPPORTED')
  }
  if (!fixture.allowedPackageIds.includes(input.packageId)) {
    throw new ArrangementFoundationError('ARRANGEMENT_FIXTURE_PACKAGE_FORBIDDEN')
  }
  const arrangementPackage = getArrangementPackage(input.packageId)
  if (!arrangementPackage) throw new ArrangementFoundationError('ARRANGEMENT_PACKAGE_UNKNOWN')
  const hasStrategy = arrangementPackage.versions.some((version) => version.supportedSalaryStrategies.includes(input.salaryStrategy))
  if (!hasStrategy) throw new ArrangementFoundationError('ARRANGEMENT_STRATEGY_UNSUPPORTED')
  return { fixture, arrangementPackage }
}

export interface CalculationCompositionSnapshotInput {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string
  readonly payrollAdministrationId: string
  readonly assignmentId: string
  readonly fixtureCode: string
  readonly sourceEmploymentId: string
  readonly packageId: string
  readonly salaryStrategy: ArrangementSalaryStrategy
  readonly assignmentEffectiveFrom: string
  readonly assignmentEffectiveTo: string | null
  readonly asOfDate: string
}

export interface CalculationCompositionSnapshot {
  readonly schemaVersion: 'ARRANGEMENT_COMPOSITION_V1'
  readonly scope: {
    readonly tenantId: string
    readonly hrGroupId: string
    readonly administrationId: string
    readonly payrollAdministrationId: string
  }
  readonly employment: {
    readonly source: 'SYNTHETIC_FIXTURE'
    readonly sourceEmploymentId: string
    readonly fixtureCode: string
  }
  readonly primaryAssignment: {
    readonly id: string
    readonly packageId: string
    readonly salaryStrategy: ArrangementSalaryStrategy
    readonly effectiveFrom: string
    readonly effectiveTo: string | null
  }
  readonly arrangement: {
    readonly packageId: string
    readonly displayName: string
    readonly kind: ArrangementPackageKind
    readonly version: string
    readonly effectiveFrom: string
    readonly effectiveTo: string | null
    readonly packageVersionHash: string
    readonly supportedSalaryStrategies: readonly ArrangementSalaryStrategy[]
    readonly sourceMetadata: ArrangementSourceMetadata
  }
  readonly asOfDate: string
  readonly calculationStatus: 'FOUNDATION_ONLY'
}

export function buildCalculationCompositionSnapshot(input: CalculationCompositionSnapshotInput): {
  readonly content: CalculationCompositionSnapshot
  readonly contentHash: string
} {
  const selection = validateArrangementSelection({
    fixtureCode: input.fixtureCode,
    packageId: input.packageId,
    salaryStrategy: input.salaryStrategy,
  })
  if (selection.fixture.sourceEmploymentId !== input.sourceEmploymentId
    || !isIsoDate(input.asOfDate)
    || !isIsoDate(input.assignmentEffectiveFrom)
    || (input.assignmentEffectiveTo !== null && !isIsoDate(input.assignmentEffectiveTo))
    || input.asOfDate < input.assignmentEffectiveFrom
    || (input.assignmentEffectiveTo !== null && input.asOfDate > input.assignmentEffectiveTo)) {
    throw new ArrangementFoundationError('ARRANGEMENT_ASSIGNMENT_INACTIVE')
  }

  const version = resolveArrangementVersion(selection.arrangementPackage, input.asOfDate)
  if (!version.supportedSalaryStrategies.includes(input.salaryStrategy)) {
    throw new ArrangementFoundationError('ARRANGEMENT_STRATEGY_UNSUPPORTED')
  }

  const content: CalculationCompositionSnapshot = {
    schemaVersion: 'ARRANGEMENT_COMPOSITION_V1',
    scope: {
      tenantId: input.tenantId,
      hrGroupId: input.hrGroupId,
      administrationId: input.administrationId,
      payrollAdministrationId: input.payrollAdministrationId,
    },
    employment: {
      source: 'SYNTHETIC_FIXTURE',
      sourceEmploymentId: input.sourceEmploymentId,
      fixtureCode: input.fixtureCode,
    },
    primaryAssignment: {
      id: input.assignmentId,
      packageId: input.packageId,
      salaryStrategy: input.salaryStrategy,
      effectiveFrom: input.assignmentEffectiveFrom,
      effectiveTo: input.assignmentEffectiveTo,
    },
    arrangement: {
      packageId: selection.arrangementPackage.id,
      displayName: selection.arrangementPackage.displayName,
      kind: selection.arrangementPackage.kind,
      version: version.version,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      packageVersionHash: hashArrangementPackageVersion(selection.arrangementPackage, version),
      supportedSalaryStrategies: version.supportedSalaryStrategies,
      sourceMetadata: version.sourceMetadata,
    },
    asOfDate: input.asOfDate,
    calculationStatus: 'FOUNDATION_ONLY',
  }
  return { content, contentHash: sha256(stableSerialize(content)) }
}
