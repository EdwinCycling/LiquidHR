import 'server-only'

import {
  appendPayrollComponentVersion,
  forkSystemComponent as forkEngineSystemComponent,
  sha256,
  stableSerialize,
  type PayrollComponentDefinition,
  type PayrollComponentInputDefinition,
  type PayrollComponentOutputDefinition,
  type PayrollDependencyDefinition,
  type PayrollProcessingScope,
  type PayrollRulePackage,
  type PayrollRoundingDefinition,
  type PayrollTracePolicy,
  type PayrollTypedParameter,
} from '@liquid-hr/payroll-engine'
import {
  createComponentCatalogEntry,
  getSystemRulePackageByCompositionId,
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
  getSystemRulePackageByCompositionId?(compositionId: string): PayrollRulePackage | null
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

export interface ComponentDraftEditorInput {
  readonly requestId: string
  readonly draftId?: string
  readonly packageCompositionId?: string
  readonly displayName: string
  readonly displayCode: string
  readonly description: string
  readonly category: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly processingScope: PayrollProcessingScope
  readonly inputs: readonly PayrollComponentInputDefinition[]
  readonly outputs: readonly PayrollComponentOutputDefinition[]
  readonly dependencies: readonly PayrollDependencyDefinition[]
  readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
  /** Null means retain a trusted, read-only source path from the selected base version. */
  readonly method: PayrollComponentDefinition['method'] | null
  readonly tracePolicy: PayrollTracePolicy
}

export interface PreparedComponentDraft {
  readonly definition: PayrollComponentDefinition
  readonly entry: ComponentCatalogEntry
  readonly requestId: string
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

function editorMetadata(entry: ComponentCatalogEntry) {
  return {
    displayName: entry.displayName ?? '',
    displayCode: entry.displayCode ?? entry.definition.code,
    description: entry.description ?? '',
    category: entry.category ?? entry.definition.method.kind,
  }
}

function toCatalogMetadataJson(entry: ComponentCatalogEntry, requestId?: string): PayrollJson {
  const userMetadata = editorMetadata(entry)
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
    ...userMetadata,
    editorMetadataHash: sha256(stableSerialize(userMetadata)),
    editorRequestId: requestId ?? null,
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
  readStoredCatalogMetadata(row)
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
  readonly displayCode?: string
  readonly description?: string
  readonly category?: string
  readonly editorRequestId?: string
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
  const displayCodeValue = metadata?.displayCode
  const descriptionValue = metadata?.description
  const categoryValue = metadata?.category
  const editorMetadataHashValue = metadata?.editorMetadataHash
  const editorRequestIdValue = metadata?.editorRequestId

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
  const normalizedEditorMetadata = {
    displayName: typeof displayNameValue === 'string' ? displayNameValue : '',
    displayCode: typeof displayCodeValue === 'string' ? displayCodeValue : row.component_code,
    description: typeof descriptionValue === 'string' ? descriptionValue : '',
    category: typeof categoryValue === 'string' ? categoryValue : 'expression',
  }
  if ((displayNameValue !== null && displayNameValue !== undefined && typeof displayNameValue !== 'string')
    || (displayCodeValue !== null && displayCodeValue !== undefined && typeof displayCodeValue !== 'string')
    || (descriptionValue !== null && descriptionValue !== undefined && typeof descriptionValue !== 'string')
    || (categoryValue !== null && categoryValue !== undefined && typeof categoryValue !== 'string')
    || (typeof editorMetadataHashValue === 'string' && editorMetadataHashValue !== sha256(stableSerialize(normalizedEditorMetadata)))
    || (editorMetadataHashValue !== undefined && editorMetadataHashValue !== null && typeof editorMetadataHashValue !== 'string')
    || (editorRequestIdValue !== undefined && editorRequestIdValue !== null && (typeof editorRequestIdValue !== 'string' || !UUID_PATTERN.test(editorRequestIdValue)))) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METADATA_INVALID')
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
    ...(typeof displayCodeValue === 'string' ? { displayCode: displayCodeValue } : {}),
    ...(typeof descriptionValue === 'string' ? { description: descriptionValue } : {}),
    ...(typeof categoryValue === 'string' ? { category: categoryValue } : {}),
    ...(typeof editorRequestIdValue === 'string' ? { editorRequestId: editorRequestIdValue } : {}),
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
    ...(metadata.displayCode ? { displayCode: metadata.displayCode } : {}),
    ...(metadata.description ? { description: metadata.description } : {}),
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
  const draftEntry = createComponentCatalogEntry({
    definition,
    packageIdentity: entry.package,
    ...(entry.sourceMetadata ? { sourceMetadata: entry.sourceMetadata } : {}),
    roundingDefinitions: entry.roundingDefinitions,
    parameters: definition.parameters ?? entry.parameters,
    ...(entry.parameterMetadata ? { parameterMetadata: entry.parameterMetadata } : {}),
    upstream: entry.upstream,
    downstream: [],
    validation: entry.validation,
    status: 'DRAFT',
    displayName: entry.displayName ?? entry.definition.code,
    displayCode: definition.code,
    description: entry.description ?? '',
    category: entry.category ?? entry.definition.method.kind,
  })
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
    catalog_metadata_json: toCatalogMetadataJson({ ...draftEntry, roundingDefinitions: entry.roundingDefinitions }),
    definition_json: definitionJson,
    definition_hash: sha256(stableSerialize(definition)),
    created_by_user_id: actorUserId,
  }
}

function assertTimestamp(timestamp: string): void {
  if (!Number.isFinite(Date.parse(timestamp)) || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_TIMESTAMP_INVALID')
  }
}

function assertEditorInput(input: ComponentDraftEditorInput): void {
  assertUuid(input.requestId)
  if (input.draftId) assertUuid(input.draftId)
  if (!input.displayName.trim() || input.displayName.length > 120
    || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(input.displayCode)
    || input.description.length > 800
    || !input.category.trim() || input.category.length > 80
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)
    || (input.effectiveTo !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveTo))
    || (input.effectiveTo !== null && input.effectiveTo < input.effectiveFrom)
    || input.outputs.length === 0) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_INPUT_INVALID')
  }
}

function toRulePackageIdentity(rulePackage: PayrollRulePackage): ComponentCatalogPackageIdentity {
  return {
    compositionId: rulePackage.compositionId,
    ...(rulePackage.metadata ? {
      packageId: rulePackage.metadata.packageId,
      version: rulePackage.metadata.version,
      packageHash: rulePackage.metadata.packageHash,
      parameterSetHash: rulePackage.metadata.parameterSetHash,
    } : {}),
  }
}

function createDraftEntry(
  definition: PayrollComponentDefinition,
  rulePackage: PayrollRulePackage,
  input: ComponentDraftEditorInput,
  options: {
    readonly sourceMetadata?: Readonly<Record<string, string>>
    readonly parameterMetadata?: Readonly<Record<string, ComponentCatalogParameterMetadata>>
    readonly capturedRoundingDefinitions?: readonly PayrollRoundingDefinition[]
    readonly packageIdentity?: ComponentCatalogPackageIdentity
  } = {},
): ComponentCatalogEntry {
  const created = createComponentCatalogEntry({
    definition,
    packageIdentity: options.packageIdentity ?? toRulePackageIdentity(rulePackage),
    ...(options.sourceMetadata ? { sourceMetadata: options.sourceMetadata } : {}),
    roundingDefinitions: rulePackage.roundingDefinitions ?? [],
    parameters: definition.parameters ?? {},
    ...(options.parameterMetadata ? {
      parameterMetadata: Object.fromEntries(Object.entries(options.parameterMetadata)
        .filter(([name]) => definition.parameters?.[name] !== undefined)),
    } : {}),
    components: [...rulePackage.components.filter((component) => component.code !== definition.code), definition],
    status: 'DRAFT',
    displayName: input.displayName.trim(),
    displayCode: input.displayCode.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
  })
  return {
    ...created,
    roundingDefinitions: options.capturedRoundingDefinitions ?? created.roundingDefinitions,
  }
}

function buildVersionDefinition(
  previous: PayrollComponentDefinition,
  input: ComponentDraftEditorInput,
  version: string,
): PayrollComponentDefinition {
  const method = input.method ?? previous.method
  if (method.kind === 'source' && stableSerialize(method) !== stableSerialize(previous.method)) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_SOURCE_METHOD_READ_ONLY')
  }
  if (method.kind === 'registeredRule') throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METHOD_UNSUPPORTED')
  const candidate: PayrollComponentDefinition = {
    id: previous.id,
    code: previous.code,
    version,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    ownership: previous.ownership,
    processingScope: input.processingScope,
    inputs: input.inputs,
    outputs: input.outputs,
    dependencies: input.dependencies,
    ...(Object.keys(input.parameters).length > 0 ? { parameters: input.parameters } : {}),
    method,
    tracePolicy: input.tracePolicy,
  }
  const validated = appendPayrollComponentVersion([], candidate)[0]
  if (!validated) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_DEFINITION_INVALID')
  return validated
}

function buildCustomDefinition(
  componentCode: string,
  input: ComponentDraftEditorInput,
): PayrollComponentDefinition {
  if (!input.method || input.method.kind === 'source' || input.method.kind === 'registeredRule') {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_METHOD_UNSUPPORTED')
  }
  const candidate: PayrollComponentDefinition = {
    id: componentCode,
    code: componentCode,
    version: '1',
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    ownership: { kind: 'CUSTOMER_CUSTOM' },
    processingScope: input.processingScope,
    inputs: input.inputs,
    outputs: input.outputs,
    dependencies: input.dependencies,
    ...(Object.keys(input.parameters).length > 0 ? { parameters: input.parameters } : {}),
    method: input.method,
    tracePolicy: input.tracePolicy,
  }
  const validated = appendPayrollComponentVersion([], candidate)[0]
  if (!validated) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_DEFINITION_INVALID')
  return validated
}

function buildVersionInsert(
  scope: PayrollScope,
  payrollAdministrationId: string,
  actorUserId: string,
  definition: PayrollComponentDefinition,
  entry: ComponentCatalogEntry,
  requestId: string,
): ComponentDraftInsert {
  const validatedScope = assertPayrollScope(scope)
  const ownership = definition.ownership
  if (ownership.kind !== 'CUSTOMER_FORK' && ownership.kind !== 'CUSTOMER_CUSTOM') {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_OWNERSHIP_INVALID')
  }
  const isFork = ownership.kind === 'CUSTOMER_FORK'
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
    ownership: ownership.kind,
    effective_from: definition.effectiveFrom,
    effective_to: definition.effectiveTo,
    origin_component_id: isFork ? ownership.origin.id : null,
    origin_component_code: isFork ? ownership.origin.code : null,
    origin_component_version: isFork ? ownership.origin.version : null,
    origin_composition_id: isFork ? entry.package.compositionId : null,
    origin_package_id: isFork ? entry.package.packageId ?? null : null,
    origin_package_version: isFork ? entry.package.version ?? null : null,
    origin_package_hash: isFork ? entry.package.packageHash ?? null : null,
    forked_at: isFork ? ownership.forkedAt : null,
    catalog_metadata_json: toCatalogMetadataJson(entry, requestId),
    definition_json: definitionJson,
    definition_hash: sha256(stableSerialize(definition)),
    created_by_user_id: actorUserId,
  }
}

function metadataRequestId(row: PayrollCustomerComponentVersionRow): string | undefined {
  return readStoredCatalogMetadata(row).editorRequestId
}

function metadataHash(row: PayrollCustomerComponentVersionRow): string {
  const metadata = isRecord(row.catalog_metadata_json) ? row.catalog_metadata_json : null
  const hash = metadata?.editorMetadataHash
  if (typeof hash === 'string') return hash
  const entry = toDraftCatalogEntry(row)
  return sha256(stableSerialize(editorMetadata(entry)))
}

function isSameDraftContent(
  row: PayrollCustomerComponentVersionRow,
  definition: PayrollComponentDefinition,
  entry: ComponentCatalogEntry,
): boolean {
  return row.definition_hash === sha256(stableSerialize(definition))
    && metadataHash(row) === sha256(stableSerialize(editorMetadata(entry)))
}

function assertUniqueDisplayCode(
  rows: readonly PayrollCustomerComponentVersionRow[],
  displayCode: string,
  componentCode?: string,
): void {
  const normalized = displayCode.trim().toLocaleLowerCase('en-US')
  const duplicate = rows.some((row) => row.component_code !== componentCode
    && toDraftCatalogEntry(row).displayCode?.trim().toLocaleLowerCase('en-US') === normalized)
  if (duplicate) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_CODE_DUPLICATE')
}

function nextVersion(rows: readonly PayrollCustomerComponentVersionRow[]): string {
  const versions = rows.map((row) => row.component_version)
  if (versions.some((version) => !/^\d+$/.test(version))) {
    throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_VERSION_SEQUENCE_UNSUPPORTED')
  }
  return String(Math.max(...versions.map(Number), 0) + 1)
}

function findRowForVersion(
  rows: readonly PayrollCustomerComponentVersionRow[],
  code: string,
  version: string,
): PayrollCustomerComponentVersionRow | undefined {
  return rows.find((row) => row.component_code === code && row.component_version === version)
}

function assertTimestampWithZone(timestamp: string): void {
  assertTimestamp(timestamp)
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

  function getRulePackage(compositionId: string): PayrollRulePackage {
    const selected = options.catalog.getSystemRulePackageByCompositionId?.(compositionId)
      ?? getSystemRulePackageByCompositionId(compositionId)
    if (!selected) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_PACKAGE_UNAVAILABLE')
    return selected
  }

  async function prepareVersion(
    scope: PayrollScope,
    payrollAdministrationId: string,
    input: ComponentDraftEditorInput,
    versionOverride?: string,
  ): Promise<{
    readonly prepared: PreparedComponentDraft
    readonly base: PayrollCustomerComponentVersionRow
    readonly rows: readonly PayrollCustomerComponentVersionRow[]
  }> {
    assertEditorInput(input)
    if (!input.draftId) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_ID_REQUIRED')
    assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    const base = await options.repository.get(scope, payrollAdministrationId, input.draftId)
    if (!base) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_NOT_FOUND')
    const previous = toDraftDefinition(base)
    const allRows = await options.repository.list(scope, payrollAdministrationId)
    const rows = allRows.filter((row) => row.component_code === base.component_code)
    const definition = buildVersionDefinition(previous, input, versionOverride ?? nextVersion(rows))
    const metadata = readStoredCatalogMetadata(base)
    const packageForComponent = getRulePackage(metadata.packageIdentity.compositionId)
    const entry = createDraftEntry(definition, packageForComponent, input, {
      ...(metadata.sourceMetadata ? { sourceMetadata: metadata.sourceMetadata } : {}),
      ...(metadata.parameterMetadata ? { parameterMetadata: metadata.parameterMetadata } : {}),
      capturedRoundingDefinitions: metadata.roundingDefinitions,
      packageIdentity: metadata.packageIdentity,
    })
    return { prepared: { definition, entry, requestId: input.requestId }, base, rows }
  }

  async function prepareCustom(
    scope: PayrollScope,
    payrollAdministrationId: string,
    input: ComponentDraftEditorInput,
  ): Promise<{ readonly prepared: PreparedComponentDraft; readonly rows: readonly PayrollCustomerComponentVersionRow[] }> {
    assertEditorInput(input)
    if (input.draftId) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_ID_INVALID')
    assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    const compositionId = input.packageCompositionId
    if (!compositionId?.trim()) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_PACKAGE_REQUIRED')
    const packageForComponent = getRulePackage(compositionId)
    const identitySeed = stableSerialize({
      tenantId: scope.tenantId,
      hrGroupId: scope.hrGroupId,
      administrationId: scope.administrationId,
      payrollAdministrationId,
      displayCode: input.displayCode.trim().toLocaleLowerCase('en-US'),
    })
    const componentCode = `CUSTOM_${sha256(identitySeed).slice(0, 32).toUpperCase()}`
    const definition = buildCustomDefinition(componentCode, input)
    const entry = createDraftEntry(definition, packageForComponent, input)
    const rows = await options.repository.list(scope, payrollAdministrationId)
    assertUniqueDisplayCode(rows, input.displayCode, componentCode)
    return { prepared: { definition, entry, requestId: input.requestId }, rows }
  }

  async function insertAndReadBack(
    scope: PayrollScope,
    payrollAdministrationId: string,
    row: ComponentDraftInsert,
    expectedDefinition: PayrollComponentDefinition,
    expectedEntry: ComponentCatalogEntry,
  ): Promise<PayrollCustomerComponentVersionRow> {
    try {
      const inserted = await options.repository.insert(scope, payrollAdministrationId, row)
      const reread = await options.repository.get(scope, payrollAdministrationId, inserted.id)
      if (!reread) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_READBACK_FAILED')
      toDraftDefinition(reread)
      return reread
    } catch (error) {
      const rereadRows = await options.repository.list(scope, payrollAdministrationId)
      const duplicate = findRowForVersion(rereadRows, row.component_code, row.component_version)
      if (duplicate && isSameDraftContent(duplicate, expectedDefinition, expectedEntry)) return duplicate
      throw error
    }
  }

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
      assertTimestampWithZone(createdAt)
      const row = buildInsert(scope, payrollAdministrationId, actorUserId, entry, id, createdAt)
      const inserted = await options.repository.insert(scope, payrollAdministrationId, row)
      const reread = await options.repository.get(scope, payrollAdministrationId, inserted.id)
      if (!reread) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_READBACK_FAILED')
      toDraftDefinition(reread)
      return reread
    },

    async prepareVersion(
      scope: PayrollScope,
      payrollAdministrationId: string,
      input: ComponentDraftEditorInput,
    ): Promise<PreparedComponentDraft> {
      return (await prepareVersion(scope, payrollAdministrationId, input)).prepared
    },

    async prepareCustomerCustom(
      scope: PayrollScope,
      payrollAdministrationId: string,
      input: ComponentDraftEditorInput,
    ): Promise<PreparedComponentDraft> {
      return (await prepareCustom(scope, payrollAdministrationId, input)).prepared
    },

    async saveVersion(
      scope: PayrollScope,
      payrollAdministrationId: string,
      actorUserId: string,
      input: ComponentDraftEditorInput,
    ): Promise<PayrollCustomerComponentVersionRow> {
      assertUuid(actorUserId)
      const initial = await prepareVersion(scope, payrollAdministrationId, input)
      const sameRequest = initial.rows.find((row) => row.component_code === initial.base.component_code
        && metadataRequestId(row) === input.requestId)
      if (sameRequest) {
        const duplicate = await prepareVersion(scope, payrollAdministrationId, input, sameRequest.component_version)
        if (isSameDraftContent(sameRequest, duplicate.prepared.definition, duplicate.prepared.entry)) return sameRequest
        throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_IDEMPOTENCY_CONFLICT')
      }

      const latest = [...initial.rows].sort((left, right) => Number(right.component_version) - Number(left.component_version))[0]
      if (!latest || latest.id !== initial.base.id) throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_VERSION_STALE')
      assertUniqueDisplayCode(initial.rows, input.displayCode, initial.base.component_code)
      const sameVersionCandidate = await prepareVersion(scope, payrollAdministrationId, input, latest.component_version)
      if (isSameDraftContent(latest, sameVersionCandidate.prepared.definition, sameVersionCandidate.prepared.entry)) return latest

      const row = buildVersionInsert(scope, payrollAdministrationId, actorUserId,
        initial.prepared.definition, initial.prepared.entry, input.requestId)
      return insertAndReadBack(scope, payrollAdministrationId, row,
        initial.prepared.definition, initial.prepared.entry)
    },

    async createCustomerCustom(
      scope: PayrollScope,
      payrollAdministrationId: string,
      actorUserId: string,
      input: ComponentDraftEditorInput,
    ): Promise<PayrollCustomerComponentVersionRow> {
      assertUuid(actorUserId)
      const initial = await prepareCustom(scope, payrollAdministrationId, input)
      const sameRequest = initial.rows.find((row) => row.component_code === initial.prepared.definition.code
        && metadataRequestId(row) === input.requestId)
      if (sameRequest) {
        if (isSameDraftContent(sameRequest, initial.prepared.definition, initial.prepared.entry)) return sameRequest
        throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_IDEMPOTENCY_CONFLICT')
      }
      const existingVersion = findRowForVersion(initial.rows, initial.prepared.definition.code, '1')
      if (existingVersion) {
        if (isSameDraftContent(existingVersion, initial.prepared.definition, initial.prepared.entry)) return existingVersion
        throw new ComponentDraftServiceError('PAYROLL_COMPONENT_DRAFT_VERSION_CONFLICT')
      }

      const row = buildVersionInsert(scope, payrollAdministrationId, actorUserId,
        initial.prepared.definition, initial.prepared.entry, input.requestId)
      return insertAndReadBack(scope, payrollAdministrationId, row,
        initial.prepared.definition, initial.prepared.entry)
    },
  }
}
