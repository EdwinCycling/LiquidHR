import 'server-only'

import {
  appendPayrollComponentVersion,
  forkSystemComponent as forkEngineSystemComponent,
  sha256,
  stableSerialize,
  type PayrollComponentDefinition,
  type PayrollRoundingDefinition,
  type PayrollTypedParameter,
} from '@liquid-hr/payroll-engine'
import {
  createComponentCatalogEntry,
  type ComponentCatalogEntry,
  type ComponentCatalogParameterMetadata,
  type ComponentCatalogPackageIdentity,
  type ComponentCatalogReference,
  type ComponentCatalogValidation,
} from './component-catalog'
import type { PayrollCustomerComponentVersionRow, PayrollDatabase, PayrollJson } from './database'
import type { PayrollScope } from './scope'
import type { ComponentDraftRepository } from './component-draft-repository'
import { assertPayrollScope } from './scope'

type ComponentDraftInsert = PayrollDatabase['public']['Tables']['customer_component_versions']['Insert']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CUSTOMER_CODE_PATTERN = /^CUSTOM_[A-F0-9]{32}$/
const SAFE_METHODS = new Set(['source', 'passThrough', 'expression', 'aggregate'])

export interface ComponentDraftCatalog {
  getSystemComponentByKey(key: string): ComponentCatalogEntry | null
}

export interface ComponentDraftServiceOptions {
  readonly repository: ComponentDraftRepository
  readonly catalog: ComponentDraftCatalog
  readonly now?: () => string
  readonly createId?: () => string
}

export class ComponentDraftServiceError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'ComponentDraftServiceError'
  }
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SCOPE_INVALID')
}

function isRecord(value: PayrollJson | undefined): value is { readonly [key: string]: PayrollJson | undefined } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asPayrollJson(value: unknown): PayrollJson {
  return JSON.parse(stableSerialize(value)) as PayrollJson
}

function toDefinitionJson(definition: PayrollComponentDefinition): PayrollJson {
  return asPayrollJson(definition)
}

function toCatalogMetadataJson(entry: ComponentCatalogEntry): PayrollJson {
  return asPayrollJson({
    key: entry.key,
    package: entry.package,
    sourceMetadata: entry.sourceMetadata ?? null,
    roundingDefinitions: entry.roundingDefinitions ?? [],
    parameters: entry.parameters ?? null,
    parameterMetadata: entry.parameterMetadata ?? null,
    dependencies: entry.dependencies ?? [],
    sourceCatalogGraph: {
      upstream: entry.upstream ?? [],
      downstream: entry.downstream ?? [],
    },
    validation: entry.validation,
    displayName: entry.displayName ?? null,
    category: entry.category ?? null,
    snapshotOnly: true,
  })
}

function assertDraftDefinitionRow(row: PayrollCustomerComponentVersionRow): PayrollComponentDefinition {
  const definitionJson = row.definition_json
  const definitionRecord = isRecord(definitionJson) ? definitionJson : null
  const ownershipRecord = definitionRecord && isRecord(definitionRecord.ownership) ? definitionRecord.ownership : null
  const methodRecord = definitionRecord && isRecord(definitionRecord.method) ? definitionRecord.method : null

  if (
    !definitionRecord
    || !ownershipRecord
    || !methodRecord
    || row.status !== 'DRAFT'
    || !['CUSTOMER_FORK', 'CUSTOMER_CUSTOM'].includes(row.ownership)
    || !CUSTOMER_CODE_PATTERN.test(row.component_code)
    || row.component_id !== row.component_code
    || definitionRecord.id !== row.component_id
    || definitionRecord.code !== row.component_code
    || definitionRecord.version !== row.component_version
    || definitionRecord.effectiveFrom !== row.effective_from
    || definitionRecord.effectiveTo !== row.effective_to
    || ownershipRecord.kind !== row.ownership
    || !SAFE_METHODS.has(typeof methodRecord.kind === 'string' ? methodRecord.kind : '')
    || sha256(stableSerialize(definitionJson)) !== row.definition_hash
    || !isRecord(row.catalog_metadata_json)
    || row.catalog_metadata_json.snapshotOnly !== true
    || !UUID_PATTERN.test(row.id)
    || !UUID_PATTERN.test(row.payroll_administration_id)
    || !UUID_PATTERN.test(row.source_tenant_id)
    || !UUID_PATTERN.test(row.source_hr_group_id)
    || !UUID_PATTERN.test(row.source_administration_id)
    || !UUID_PATTERN.test(row.created_by_user_id)
  ) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SNAPSHOT_INVALID')
  }

  const packageIdentity = isRecord(row.catalog_metadata_json.package) ? row.catalog_metadata_json.package : null
  if (!packageIdentity || typeof packageIdentity.compositionId !== 'string' || !packageIdentity.compositionId.trim()) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SNAPSHOT_INVALID')
  }

  const origin = ownershipRecord.origin
  if (row.ownership === 'CUSTOMER_FORK') {
    if (!isRecord(origin)
      || origin.id !== row.origin_component_id
      || origin.code !== row.origin_component_code
      || origin.version !== row.origin_component_version
      || typeof ownershipRecord.forkedAt !== 'string'
      || row.forked_at === null
      || !Number.isFinite(Date.parse(ownershipRecord.forkedAt))
      || !Number.isFinite(Date.parse(row.forked_at))
      || Date.parse(ownershipRecord.forkedAt) !== Date.parse(row.forked_at)
      || !row.origin_composition_id
      || packageIdentity.compositionId !== row.origin_composition_id
      || (typeof packageIdentity.packageId === 'string' ? packageIdentity.packageId : null) !== row.origin_package_id
      || (typeof packageIdentity.version === 'string' ? packageIdentity.version : null) !== row.origin_package_version
      || (typeof packageIdentity.packageHash === 'string' ? packageIdentity.packageHash : null) !== row.origin_package_hash
      || row.component_id === row.origin_component_id
      || row.component_code === row.origin_component_code) {
      throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SNAPSHOT_INVALID')
    }
  } else if (
    origin !== undefined
    || ownershipRecord.forkedAt !== undefined
    || row.origin_component_id !== null
    || row.origin_component_code !== null
    || row.origin_component_version !== null
    || row.origin_composition_id !== null
    || row.origin_package_id !== null
    || row.origin_package_version !== null
    || row.origin_package_hash !== null
    || row.forked_at !== null
  ) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SNAPSHOT_INVALID')
  }

  const candidate = definitionJson as unknown as PayrollComponentDefinition
  const validated = appendPayrollComponentVersion([], candidate)[0]
  if (!validated) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SNAPSHOT_INVALID')
  return validated
}

/** Returns a trusted, engine-validated customer definition from its detached stored snapshot. */
export function toDraftDefinition(row: PayrollCustomerComponentVersionRow): PayrollComponentDefinition {
  return assertDraftDefinitionRow(row)
}

function readStoredCatalogMetadata(row: PayrollCustomerComponentVersionRow): {
  readonly packageIdentity: ComponentCatalogPackageIdentity
  readonly sourceMetadata?: Readonly<Record<string, string>>
  readonly roundingDefinitions: readonly PayrollRoundingDefinition[]
  readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
  readonly parameterMetadata?: Readonly<Record<string, ComponentCatalogParameterMetadata>>
  readonly upstream: readonly ComponentCatalogReference[]
  readonly validation: ComponentCatalogValidation
  readonly displayName?: string
  readonly category?: string
} {
  const metadata = isRecord(row.catalog_metadata_json) ? row.catalog_metadata_json : null
  const packageValue = metadata && isRecord(metadata.package) ? metadata.package : null
  const graph = metadata && isRecord(metadata.sourceCatalogGraph) ? metadata.sourceCatalogGraph : null
  const packageCompositionId = packageValue?.compositionId
  const sourceMetadataValue = metadata?.sourceMetadata
  const roundingDefinitionsValue = metadata?.roundingDefinitions
  const parametersValue = metadata?.parameters
  const parameterMetadataValue = metadata?.parameterMetadata
  const upstreamValue = graph?.upstream
  const validationValue = metadata?.validation
  const displayNameValue = metadata?.displayName
  const categoryValue = metadata?.category

  if (typeof packageCompositionId !== 'string' || !packageCompositionId.trim()
    || !Array.isArray(roundingDefinitionsValue)
    || !Array.isArray(upstreamValue)
    || !isRecord(validationValue)
    || typeof validationValue.valid !== 'boolean'
    || !Array.isArray(validationValue.issues)) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METADATA_INVALID')
  }

  const packageIdentity: ComponentCatalogPackageIdentity = {
    compositionId: packageCompositionId,
    ...(typeof packageValue?.packageId === 'string' ? { packageId: packageValue.packageId } : {}),
    ...(typeof packageValue?.version === 'string' ? { version: packageValue.version } : {}),
    ...(typeof packageValue?.packageHash === 'string' ? { packageHash: packageValue.packageHash } : {}),
    ...(typeof packageValue?.parameterSetHash === 'string' ? { parameterSetHash: packageValue.parameterSetHash } : {}),
  }

  let sourceMetadata: Readonly<Record<string, string>> | undefined
  if (isRecord(sourceMetadataValue)) {
    const sourceEntries = Object.entries(sourceMetadataValue)
    if (sourceEntries.some(([, value]) => typeof value !== 'string')) {
      throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METADATA_INVALID')
    }
    sourceMetadata = Object.fromEntries(sourceEntries) as Record<string, string>
  } else if (sourceMetadataValue !== null) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METADATA_INVALID')
  }

  if (parametersValue !== null && !isRecord(parametersValue)) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METADATA_INVALID')
  }
  if (parameterMetadataValue !== null && !isRecord(parameterMetadataValue)) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METADATA_INVALID')
  }
  const parameters = (parametersValue ?? {}) as unknown as Readonly<Record<string, PayrollTypedParameter>>
  let parameterMetadata: Readonly<Record<string, ComponentCatalogParameterMetadata>> | undefined
  if (isRecord(parameterMetadataValue)) {
    const entries = Object.entries(parameterMetadataValue)
    if (entries.some(([, item]) => !isRecord(item)
      || typeof item.officialSymbol !== 'string'
      || typeof item.valueType !== 'string'
      || typeof item.value !== 'string'
      || typeof item.unit !== 'string'
      || typeof item.sourceReference !== 'string')) {
      throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METADATA_INVALID')
    }
    parameterMetadata = Object.fromEntries(entries) as unknown as Record<string, ComponentCatalogParameterMetadata>
  }
  const roundingDefinitions = roundingDefinitionsValue as unknown as readonly PayrollRoundingDefinition[]
  const upstream = upstreamValue as unknown as readonly ComponentCatalogReference[]
  const validation = validationValue as unknown as ComponentCatalogValidation

  return {
    packageIdentity,
    ...(sourceMetadata ? { sourceMetadata } : {}),
    roundingDefinitions,
    parameters,
    ...(parameterMetadata ? { parameterMetadata } : {}),
    upstream,
    validation,
    ...(typeof displayNameValue === 'string' ? { displayName: displayNameValue } : {}),
    ...(typeof categoryValue === 'string' ? { category: categoryValue } : {}),
  }
}

/** Rebuilds a persisted fork from stored metadata without resolving against current SYSTEM packages. */
export function toDraftCatalogEntry(row: PayrollCustomerComponentVersionRow): ComponentCatalogEntry {
  const metadata = readStoredCatalogMetadata(row)
  const definition = toDraftDefinition(row)
  const entry = createComponentCatalogEntry({
    definition,
    packageIdentity: metadata.packageIdentity,
    ...(metadata.sourceMetadata ? { sourceMetadata: metadata.sourceMetadata } : {}),
    roundingDefinitions: metadata.roundingDefinitions,
    parameters: metadata.parameters,
    ...(metadata.parameterMetadata ? { parameterMetadata: metadata.parameterMetadata } : {}),
    upstream: metadata.upstream,
    downstream: [],
    validation: metadata.validation,
    key: `draft::${row.id}`,
    status: 'DRAFT',
    ...(metadata.displayName ? { displayName: metadata.displayName } : {}),
    ...(metadata.category ? { category: metadata.category } : {}),
  })

  // The catalog factory filters package-level rounding by component code. Preserve the
  // captured SYSTEM rounding rows as provenance; they must not be resolved from today's package.
  return { ...entry, roundingDefinitions: metadata.roundingDefinitions }
}

function buildInsert(
  scope: PayrollScope,
  payrollAdministrationId: string,
  actorUserId: string,
  entry: ComponentCatalogEntry,
  id: string,
  forkedAt: string,
): ComponentDraftInsert {
  const componentCode = `CUSTOM_${id.replaceAll('-', '').toUpperCase()}`
  const definition = forkEngineSystemComponent(entry.definition, {
    id: componentCode,
    code: componentCode,
    version: '1',
    effectiveFrom: entry.definition.effectiveFrom,
    effectiveTo: entry.definition.effectiveTo,
    forkedAt,
  })
  const ownership = definition.ownership
  if (ownership.kind !== 'CUSTOMER_FORK') throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SOURCE_INVALID')
  const validatedScope = assertPayrollScope(scope)
  const definitionJson = toDefinitionJson(definition)

  return {
    payroll_administration_id: payrollAdministrationId,
    source_tenant_id: validatedScope.tenantId,
    source_hr_group_id: validatedScope.hrGroupId,
    source_administration_id: validatedScope.administrationId,
    component_id: definition.id,
    component_code: definition.code,
    component_version: definition.version,
    status: 'DRAFT',
    ownership: 'CUSTOMER_FORK',
    effective_from: definition.effectiveFrom,
    effective_to: definition.effectiveTo,
    origin_component_id: ownership.origin.id,
    origin_component_code: ownership.origin.code,
    origin_component_version: ownership.origin.version,
    origin_composition_id: entry.package.compositionId,
    origin_package_id: entry.package.packageId ?? null,
    origin_package_version: entry.package.version ?? null,
    origin_package_hash: entry.package.packageHash ?? null,
    forked_at: ownership.forkedAt,
    catalog_metadata_json: toCatalogMetadataJson(entry),
    definition_json: definitionJson,
    definition_hash: sha256(stableSerialize(definition)),
    created_by_user_id: actorUserId,
  }
}

function isForkableSystemEntry(entry: ComponentCatalogEntry | null, key: string): entry is ComponentCatalogEntry {
  return Boolean(
    entry
    && entry.key === key
    && entry.ownership === 'SYSTEM'
    && entry.definition.ownership.kind === 'SYSTEM'
    && entry.forkable
    && entry.definition.method.kind !== 'registeredRule'
  )
}

/** Injected, scope-bound service for listing, reopening and forking immutable customer drafts. */
export function createComponentDraftService(options: ComponentDraftServiceOptions) {
  const now = options.now ?? (() => new Date().toISOString())
  const createId = options.createId ?? (() => crypto.randomUUID())

  return {
    async list(scope: PayrollScope, payrollAdministrationId: string): Promise<readonly PayrollCustomerComponentVersionRow[]> {
      assertPayrollScope(scope)
      assertUuid(payrollAdministrationId)
      return options.repository.list(scope, payrollAdministrationId)
    },

    async get(
      scope: PayrollScope,
      payrollAdministrationId: string,
      draftRowId: string,
    ): Promise<PayrollCustomerComponentVersionRow | null> {
      assertPayrollScope(scope)
      assertUuid(payrollAdministrationId)
      assertUuid(draftRowId)
      return options.repository.get(scope, payrollAdministrationId, draftRowId)
    },

    async forkSystemComponent(
      scope: PayrollScope,
      payrollAdministrationId: string,
      actorUserId: string,
      catalogKey: string,
    ): Promise<PayrollCustomerComponentVersionRow> {
      assertPayrollScope(scope)
      assertUuid(payrollAdministrationId)
      assertUuid(actorUserId)
      if (!catalogKey.trim()) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SOURCE_INVALID')
      const entry = options.catalog.getSystemComponentByKey(catalogKey)
      if (!isForkableSystemEntry(entry, catalogKey)) {
        throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SOURCE_NOT_FORKABLE')
      }

      const id = createId()
      assertUuid(id)
      const createdAt = now()
      if (!Number.isFinite(Date.parse(createdAt)) || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(createdAt)) {
        throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_TIMESTAMP_INVALID')
      }
      const row = buildInsert(scope, payrollAdministrationId, actorUserId, entry, id, createdAt)
      const inserted = await options.repository.insert(scope, payrollAdministrationId, row)
      const reread = await options.repository.get(scope, payrollAdministrationId, inserted.id)
      if (!reread) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_READBACK_FAILED')
      toDraftDefinition(reread)
      return reread
    },
  }
}
