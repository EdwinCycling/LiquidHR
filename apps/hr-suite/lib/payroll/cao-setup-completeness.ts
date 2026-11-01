import type { Json } from '@scope/db'
import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import type { EmploymentRegulationTimeline, EmploymentRegulationVersion } from '@/lib/employment/employment-regulation-model'
import type { SalaryStructureCatalog } from '@/lib/salary-structures/service'
import { findCaoSetupCatalogEntry, type CaoSetupCatalogEntry } from './cao-setup-catalog'
import type { CaoSetupPensionMapping, CaoSetupPensionRecord } from './cao-setup-service'

export type CaoSetupCompletenessFieldStatus = 'RECORDED' | 'MISSING' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE'
export type CaoSetupCompletenessFieldSource = 'CORE' | 'CATALOG' | 'NONE'

export type CaoSetupCompletenessField = {
  readonly key: string
  readonly status: CaoSetupCompletenessFieldStatus
  readonly source: CaoSetupCompletenessFieldSource
  readonly value: string | null
}

export type CaoSetupCompletenessRecord = {
  readonly id: string
  readonly name: string
  readonly kind: 'COLLECTIVE_AGREEMENT' | 'COMPANY_POLICY' | 'PENSION_ARRANGEMENT'
  readonly packageId: string | null
  readonly version: string | null
  readonly effectiveFrom: string | null
  readonly effectiveTo: string | null
  readonly fields: readonly CaoSetupCompletenessField[]
  readonly applicableFieldCount: number
  readonly recordedFieldCount: number
  readonly completenessPercent: number
  readonly payrollReady: boolean
  readonly blockers: readonly string[]
  readonly integrityHash: string
}

export type CaoSetupCompletenessInput = {
  readonly catalog: readonly CaoSetupCatalogEntry[]
  readonly laborConditionTimelines: readonly EmploymentRegulationTimeline[]
  readonly salaryStructureCatalog: SalaryStructureCatalog | null
  readonly pensions: readonly CaoSetupPensionRecord[]
  readonly pensionMappings: readonly CaoSetupPensionMapping[]
}

type JsonObject = { readonly [key: string]: Json | undefined }

function objectValue(value: Json): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
}

function text(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function textAt(value: Json, key: string): string | null {
  return text(objectValue(value)?.[key])
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')
}

function field(key: string, status: CaoSetupCompletenessFieldStatus, source: CaoSetupCompletenessFieldSource, value: string | null = null): CaoSetupCompletenessField {
  return { key, status, source, value }
}

function recorded(key: string, source: Exclude<CaoSetupCompletenessFieldSource, 'NONE'>, value: string): CaoSetupCompletenessField {
  return field(key, 'RECORDED', source, value)
}

function missing(key: string, value: string | null = null): CaoSetupCompletenessField {
  return field(key, 'MISSING', 'NONE', value)
}

function review(key: string, source: Exclude<CaoSetupCompletenessFieldSource, 'NONE'>, value: string | null = null): CaoSetupCompletenessField {
  return field(key, 'REVIEW_REQUIRED', source, value)
}

function completeRecord(input: Omit<CaoSetupCompletenessRecord, 'applicableFieldCount' | 'recordedFieldCount' | 'completenessPercent' | 'payrollReady' | 'blockers' | 'integrityHash'>): CaoSetupCompletenessRecord {
  const applicableFields = input.fields.filter((candidate) => candidate.status !== 'NOT_APPLICABLE')
  const recordedFields = applicableFields.filter((candidate) => candidate.status === 'RECORDED')
  const blockers = input.fields.filter((candidate) => candidate.status === 'MISSING' || candidate.status === 'REVIEW_REQUIRED').map((candidate) => candidate.key)
  return {
    ...input,
    applicableFieldCount: applicableFields.length,
    recordedFieldCount: recordedFields.length,
    completenessPercent: applicableFields.length === 0 ? 100 : Math.round((recordedFields.length / applicableFields.length) * 100),
    payrollReady: blockers.length === 0,
    blockers,
    integrityHash: stableHash({
      id: input.id,
      packageId: input.packageId,
      version: input.version,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      fields: input.fields,
    }),
  }
}

function stableHash(value: unknown): string {
  return sha256(stableSerialize(value))
}

function allConditionVersions(timelines: readonly EmploymentRegulationTimeline[]): EmploymentRegulationVersion[] {
  return timelines.flatMap((timeline) => timeline.versions)
}

function conditionForPackage(entry: CaoSetupCatalogEntry, versions: readonly EmploymentRegulationVersion[]): EmploymentRegulationVersion | null {
  return versions
    .filter((version) => findCaoSetupCatalogEntry(version.code, version.name)?.packageId === entry.packageId)
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0] ?? null
}

function catalogVersionFor(entry: CaoSetupCatalogEntry, condition: EmploymentRegulationVersion | null) {
  if (!condition) return entry.versions[entry.versions.length - 1] ?? null
  return entry.versions.find((version) => version.effectiveFrom === condition.validFrom)
    ?? entry.versions.filter((version) => version.effectiveFrom <= condition.validFrom).sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
    ?? entry.versions[0]
    ?? null
}

function pensionForCatalog(entry: CaoSetupCatalogEntry, pensions: readonly CaoSetupPensionRecord[]): CaoSetupPensionRecord | null {
  const fundTokens = entry.pension.code === 'PFZW_2026_KINDEROPVANG' ? ['PFZW'] : ['BPF', 'DETAILHANDEL']
  return pensions.find((pension) => fundTokens.every((token) => normalized(`${pension.code} ${pension.name} ${textAt(pension.pensionableSalaryDefinition, 'provider')}`).includes(token))) ?? null
}

function mappingsFor(mappingConditionId: string | null, pensionId: string | null, mappings: readonly CaoSetupPensionMapping[], effectiveFrom: string | null): CaoSetupPensionMapping[] {
  if (!mappingConditionId || !pensionId || !effectiveFrom) return []
  return mappings.filter((mapping) => mapping.laborConditionSetId === mappingConditionId
    && mapping.pensionArrangementId === pensionId
    && mapping.effectiveFrom <= effectiveFrom
    && (mapping.effectiveTo === null || mapping.effectiveTo >= effectiveFrom))
}

function publishedSalaryStructures(condition: EmploymentRegulationVersion | null, catalog: SalaryStructureCatalog | null): string[] {
  if (!condition || !catalog) return []
  const relations = catalog.laborConditionRelations.filter((relation) => relation.labor_condition_set_id === condition.id)
  const structureIds = new Set(relations.map((relation) => relation.salary_structure_id))
  return catalog.structures
    .filter((structure) => structureIds.has(structure.id))
    .filter((structure) => catalog.revisions.some((revision) => revision.salary_structure_id === structure.id
      && revision.status === 'PUBLISHED'
      && revision.effective_from <= condition.validFrom))
    .map((structure) => `${structure.name} · ${structure.code}`)
}

function pensionFields(pension: CaoSetupPensionRecord | null, catalogSource: 'CORE' | 'CATALOG' = 'CORE'): CaoSetupCompletenessField[] {
  const provider = pension ? textAt(pension.pensionableSalaryDefinition, 'provider') : null
  const sourceReference = pension ? textAt(pension.pensionableSalaryDefinition, 'sourceReference') ?? textAt(pension.sourceJson, 'source') : null
  const salaryMethod = pension ? textAt(pension.pensionableSalaryDefinition, 'method') : null
  const partTimeMethod = pension ? textAt(pension.pensionableSalaryDefinition, 'partTimeMethod') : null
  const partMonthMethod = pension ? textAt(pension.pensionableSalaryDefinition, 'partMonthMethod') : null
  const eligibility = pension ? textAt(pension.eligibilityRule, 'description') : null
  const componentSummary = pension?.components.map((component) =>
    `${component.code} ${component.totalRate}% (${component.employeeRate}% werknemer / ${component.employerRate}% werkgever), franchise ${component.annualFranchise}, maximum ${component.annualPensionableSalaryCap ?? 'geen'}, bron ${component.sourceSha256}`,
  ).join('; ') ?? ''
  return [
    provider ? recorded('pension_provider', catalogSource, provider) : missing('pension_provider'),
    pension ? recorded('pension_version_period', 'CORE', `v${pension.versionNumber ?? '—'} · ${pension.effectiveFrom} — ${pension.effectiveTo ?? '—'}`) : missing('pension_version_period'),
    pension && pension.annualFranchise !== null && pension.annualPensionableSalaryCap !== null
      ? recorded('pension_base_franchise_cap', 'CORE', `franchise ${pension.annualFranchise} · maximum ${pension.annualPensionableSalaryCap}`)
      : missing('pension_base_franchise_cap'),
    pension && pension.flatTotalRate !== null && Number.isFinite(pension.employeeSharePct) && Number.isFinite(pension.employerSharePct)
      ? recorded('pension_contribution_split', 'CORE', `total ${pension.flatTotalRate}% · werknemer ${pension.employeeSharePct}% · werkgever ${pension.employerSharePct}%`)
      : missing('pension_contribution_split'),
    pension && pension.components.length > 0 && pension.components.every((component) => component.sourceValidationStatus === 'VERIFIED_SOURCE')
      ? recorded('pension_components', 'CORE', componentSummary)
      : pension && pension.components.length > 0
        ? review('pension_components', 'CORE', componentSummary)
        : missing('pension_components'),
    eligibility ? recorded('pension_eligibility', 'CORE', eligibility) : missing('pension_eligibility'),
    pension && salaryMethod && partTimeMethod && partMonthMethod
      ? recorded('pension_part_time_partial_month', 'CORE', `${salaryMethod} · ${partTimeMethod} · ${partMonthMethod}`)
      : missing('pension_part_time_partial_month'),
    sourceReference ? recorded('pension_source_reference', 'CORE', sourceReference) : missing('pension_source_reference'),
    pension && pension.sourceStatus === 'VALIDATED'
      ? recorded('pension_source_validation', 'CORE', 'Core-bron validated')
      : pension ? review('pension_source_validation', 'CORE', 'Core-bron opgeslagen; formele validatie ontbreekt') : missing('pension_source_validation'),
  ]
}

function collectiveAgreementRecord(entry: CaoSetupCatalogEntry, condition: EmploymentRegulationVersion | null, pension: CaoSetupPensionRecord | null, mappings: readonly CaoSetupPensionMapping[], salaryCatalog: SalaryStructureCatalog | null): CaoSetupCompletenessRecord {
  const catalogVersion = catalogVersionFor(entry, condition)
  const structures = publishedSalaryStructures(condition, salaryCatalog)
  const mapping = mappingsFor(condition?.id ?? null, pension?.id ?? null, mappings, condition?.validFrom ?? null)
  const pensionConfiguration = pensionFields(pension)
  if (entry.sourceStatus === 'REFERENCE_ONLY') pensionConfiguration.push(review('catalog_source_validation', 'CATALOG', catalogVersion?.sourceTitle ?? 'Catalogusbron is alleen referentie'))
  return completeRecord({
    id: `cao:${entry.packageId}`,
    name: entry.displayName,
    kind: 'COLLECTIVE_AGREEMENT',
    packageId: entry.packageId,
    version: catalogVersion?.version ?? null,
    effectiveFrom: condition?.validFrom ?? catalogVersion?.effectiveFrom ?? null,
    effectiveTo: catalogVersion?.effectiveTo ?? null,
    fields: [
      catalogVersion ? recorded('catalog_source', 'CATALOG', `${catalogVersion.sourceTitle} · ${catalogVersion.version}`) : missing('catalog_source'),
      condition ? recorded('core_regulation', 'CORE', `${condition.name} · ${condition.code} · ${condition.validFrom}`) : missing('core_regulation'),
      structures.length > 0 ? recorded('salary_structure', 'CORE', structures.join(', ')) : missing('salary_structure'),
      ...pensionConfiguration,
      mapping.length > 0 ? recorded('pension_mapping', 'CORE', `${mapping.length} effectieve koppeling(en)`) : missing('pension_mapping'),
    ],
  })
}

function companyPolicyRecord(condition: EmploymentRegulationVersion, mappings: readonly CaoSetupPensionMapping[], salaryCatalog: SalaryStructureCatalog | null): CaoSetupCompletenessRecord {
  const structures = publishedSalaryStructures(condition, salaryCatalog)
  const mapping = mappings.filter((candidate) => candidate.laborConditionSetId === condition.id && candidate.effectiveFrom <= condition.validFrom && (candidate.effectiveTo === null || candidate.effectiveTo >= condition.validFrom))
  return completeRecord({
    id: `company:${condition.id}`,
    name: condition.name,
    kind: 'COMPANY_POLICY',
    packageId: null,
    version: null,
    effectiveFrom: condition.validFrom,
    effectiveTo: null,
    fields: [
      recorded('core_regulation', 'CORE', `${condition.name} · ${condition.code} · ${condition.validFrom}`),
      structures.length > 0 ? recorded('salary_structure', 'CORE', structures.join(', ')) : missing('salary_structure'),
      mapping.length > 0 ? recorded('pension_mapping', 'CORE', `${mapping.length} effectieve koppeling(en)`) : review('pension_mapping', 'CORE', 'Geen pensioenkeuze voor deze bedrijfseigen regeling'),
      review('employer_source_validation', 'CORE', 'Werkgeversbron en toepasselijkheid moeten expliciet worden bevestigd'),
    ],
  })
}

function pensionArrangementRecord(pension: CaoSetupPensionRecord, mappings: readonly CaoSetupPensionMapping[]): CaoSetupCompletenessRecord {
  return completeRecord({
    id: `pension:${pension.id}`,
    name: `${pension.name} · ${pension.code}`,
    kind: 'PENSION_ARRANGEMENT',
    packageId: null,
    version: pension.versionNumber === null ? null : String(pension.versionNumber),
    effectiveFrom: pension.effectiveFrom,
    effectiveTo: pension.effectiveTo,
    fields: [
      ...pensionFields(pension),
      mappings.some((mapping) => mapping.pensionArrangementId === pension.id)
        ? recorded('pension_mapping', 'CORE', 'Minstens één effectieve koppeling')
        : review('pension_mapping', 'CORE', 'Nog niet aan een arbeidsvoorwaardenversie gekoppeld'),
    ],
  })
}

export function buildCaoSetupCompleteness(input: CaoSetupCompletenessInput): readonly CaoSetupCompletenessRecord[] {
  const versions = allConditionVersions(input.laborConditionTimelines)
  const records: CaoSetupCompletenessRecord[] = input.catalog.map((entry) => {
    const condition = conditionForPackage(entry, versions)
    return collectiveAgreementRecord(entry, condition, pensionForCatalog(entry, input.pensions), input.pensionMappings, input.salaryStructureCatalog)
  })
  const catalogConditionIds = new Set(records.flatMap((record) => {
    const condition = versions.find((version) => record.packageId !== null && findCaoSetupCatalogEntry(version.code, version.name)?.packageId === record.packageId)
    return condition ? [condition.id] : []
  }))
  for (const condition of versions) {
    if (!catalogConditionIds.has(condition.id) && !findCaoSetupCatalogEntry(condition.code, condition.name)) records.push(companyPolicyRecord(condition, input.pensionMappings, input.salaryStructureCatalog))
  }
  const matchedPensionIds = new Set(input.catalog.map((entry) => pensionForCatalog(entry, input.pensions)?.id).filter((id): id is string => Boolean(id)))
  for (const pension of input.pensions) if (!matchedPensionIds.has(pension.id)) records.push(pensionArrangementRecord(pension, input.pensionMappings))
  return records
}
