import {
  ARRANGEMENT_PACKAGES,
  hashArrangementPackageVersion,
  type ArrangementPackage,
  type ArrangementPackageVersion,
} from './arrangement-foundation'

export type CaoSetupSourceStatus = 'REFERENCE_ONLY'

export type CaoSetupPensionCatalog = {
  readonly code: 'PFZW_2026_KINDEROPVANG' | 'BPF_DETAILHANDEL_2026'
  readonly fundName: string
  readonly sourceStatus: CaoSetupSourceStatus
  readonly sourceReferences: readonly { readonly title: string; readonly url: string }[]
  readonly requiredFields: readonly string[]
}

export type CaoSetupCatalogVersion = {
  readonly version: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly supportedSalaryStrategies: ArrangementPackageVersion['supportedSalaryStrategies']
  readonly sourceStatus: CaoSetupSourceStatus
  readonly sourceTitle: string
  readonly sourceUrl: string
  readonly sourceNote: string
  readonly packageVersionHash: string
}

export type CaoSetupCatalogEntry = {
  readonly packageId: string
  readonly displayName: string
  readonly kind: ArrangementPackage['kind']
  readonly standardHoursPerWeek: number
  readonly calculationStatus: 'GROSS_ENGINE_SUPPORTED'
  readonly sourceStatus: CaoSetupSourceStatus
  readonly pension: CaoSetupPensionCatalog
  readonly versions: readonly CaoSetupCatalogVersion[]
}

export type CaoSetupPackageOption = {
  readonly id: string
  readonly displayName: string
  readonly version: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly standardHoursPerWeek: number
  readonly sourceStatus: CaoSetupSourceStatus
}

const pensionFields = Object.freeze([
  'fund/provider',
  'version and effective period',
  'pensionable salary definition and franchise',
  'employee and employer contribution split',
  'participation/eligibility rule',
  'part-time and part-month method',
  'source reference and validation status',
])

const pensionCatalog = Object.freeze({
  PFZW_2026_KINDEROPVANG: {
    code: 'PFZW_2026_KINDEROPVANG',
    fundName: 'PFZW — Kinderopvang',
    sourceStatus: 'REFERENCE_ONLY',
    sourceReferences: [
      {
        title: 'PFZW pensioenreglement 2026',
        url: 'https://www.pfzw.nl/content/dam/pfzw/web/statuten-en-reglementen/Statuten%20en%20reglementen%20juli%202026.pdf',
      },
      {
        title: 'PFZW UPA-handleiding 2026',
        url: 'https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
      },
      {
        title: 'PFZW premiepercentages en franchises 2026',
        url: 'https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html',
      },
      {
        title: 'Kinderopvang-werkt premieafspraken 2026',
        url: 'https://www.kinderopvang-werkt.nl/nieuws/pensioenpremies-2026',
      },
    ],
    requiredFields: pensionFields,
  },
  BPF_DETAILHANDEL_2026: {
    code: 'BPF_DETAILHANDEL_2026',
    fundName: 'BPF Detailhandel',
    sourceStatus: 'REFERENCE_ONLY',
    sourceReferences: [
      {
        title: 'BPF Detailhandel premieoverzicht 2026',
        url: 'https://pensioenfondsdetailhandel.nl/content/publications/Premieoverzicht-2026.pdf',
      },
      {
        title: 'BPF Detailhandel premie en opbouw',
        url: 'https://pensioenfondsdetailhandel.nl/werkgever-en-administratiekantoor/pensioenzaken/pensioenpremie-en-opbouw',
      },
      {
        title: 'BPF Detailhandel verplichtstelling',
        url: 'https://pensioenfondsdetailhandel.nl/werkgever-en-administratiekantoor/situaties-en-wijzigingen/verplichtstelling',
      },
    ],
    requiredFields: pensionFields,
  },
} as const satisfies Record<CaoSetupPensionCatalog['code'], CaoSetupPensionCatalog>)

const packagePensionMap: Readonly<Record<string, CaoSetupPensionCatalog['code']>> = {
  KINDEROPVANG_2025_2026: 'PFZW_2026_KINDEROPVANG',
  RETAIL_NON_FOOD_MODE_2026_2027: 'BPF_DETAILHANDEL_2026',
}

const standardHoursByPackage: Readonly<Record<string, number>> = {
  KINDEROPVANG_2025_2026: 36,
  RETAIL_NON_FOOD_MODE_2026_2027: 38,
}

function publicVersion(arrangementPackage: ArrangementPackage, version: ArrangementPackageVersion): CaoSetupCatalogVersion {
  if (version.sourceMetadata.status !== 'REFERENCE_ONLY') throw new Error('CAO_SETUP_SOURCE_NOT_COLLECTIVE_AGREEMENT')
  return {
    version: version.version,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    supportedSalaryStrategies: version.supportedSalaryStrategies,
    sourceStatus: version.sourceMetadata.status,
    sourceTitle: version.sourceMetadata.sourceTitle,
    sourceUrl: version.sourceMetadata.sourceUrl,
    sourceNote: version.sourceMetadata.note,
    packageVersionHash: hashArrangementPackageVersion(arrangementPackage, version),
  }
}

function collectiveAgreement(entry: ArrangementPackage): CaoSetupCatalogEntry | null {
  if (entry.kind !== 'COLLECTIVE_AGREEMENT') return null
  const pensionCode = packagePensionMap[entry.id]
  const standardHoursPerWeek = standardHoursByPackage[entry.id]
  if (!pensionCode || !standardHoursPerWeek) return null
  return {
    packageId: entry.id,
    displayName: entry.displayName,
    kind: entry.kind,
    standardHoursPerWeek,
    calculationStatus: 'GROSS_ENGINE_SUPPORTED',
    sourceStatus: 'REFERENCE_ONLY',
    pension: pensionCatalog[pensionCode],
    versions: entry.versions.map((version) => publicVersion(entry, version)),
  }
}

export const CAO_SETUP_CATALOG: readonly CaoSetupCatalogEntry[] = Object.freeze(
  ARRANGEMENT_PACKAGES.map(collectiveAgreement).filter((entry): entry is CaoSetupCatalogEntry => entry !== null),
)

function normalized(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')
}

export function getCaoSetupCatalogEntry(packageId: string): CaoSetupCatalogEntry | null {
  return CAO_SETUP_CATALOG.find((entry) => entry.packageId === packageId) ?? null
}

export function findCaoSetupCatalogEntry(code: string | null, name: string | null): CaoSetupCatalogEntry | null {
  const haystack = `${normalized(code)}_${normalized(name)}`
  return CAO_SETUP_CATALOG.find((entry) => {
    const tokens = entry.packageId.split('_').filter((token) => token.length > 2)
    return tokens.every((token) => haystack.includes(token))
  }) ?? null
}

export function caoSetupPackageOptions(): readonly CaoSetupPackageOption[] {
  return CAO_SETUP_CATALOG.flatMap((entry) => entry.versions.map((version) => ({
    id: `${entry.packageId}:${version.version}`,
    displayName: entry.displayName,
    version: version.version,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    standardHoursPerWeek: entry.standardHoursPerWeek,
    sourceStatus: version.sourceStatus,
  })))
}
