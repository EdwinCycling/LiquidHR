import 'server-only'

import {
  GC_NL_001_RULE_PACKAGE,
  type PayrollComponentDefinition,
  type PayrollDependencyDefinition,
  type PayrollExpression,
  type PayrollProcessingScope,
  type PayrollRoundingDefinition,
  type PayrollRulePackage,
  type PayrollRulePackageMetadata,
  type PayrollTypedParameter,
} from '@liquid-hr/payroll-engine'
import {
  NL_2026_PARAMETER_METADATA,
  NL_2026_RULE_PACKAGE,
} from '@liquid-hr/payroll-rules-nl-2026'

export type ComponentCatalogOwnership = 'SYSTEM' | 'CUSTOMER_FORK' | 'CUSTOMER_CUSTOM'

export interface ComponentCatalogPackageIdentity {
  readonly compositionId: string
  readonly packageId?: string
  readonly version?: string
  readonly packageHash?: string
  readonly parameterSetHash?: string
}

export interface ComponentCatalogReference {
  readonly key: string
  readonly componentCode: string
  readonly componentVersion: string
  readonly outputName?: string
  readonly inputName?: string
}

export interface ComponentCatalogParameterMetadata {
  readonly officialSymbol: string
  readonly valueType: PayrollTypedParameter['valueType']
  readonly value: string
  readonly unit: string
  readonly sourceReference: string
}

export type ComponentCatalogValidationIssueCode =
  | 'COMPONENT_SCOPE_UNSUPPORTED'
  | 'COMPONENT_VERSION_DUPLICATE'
  | 'COMPONENT_EFFECTIVE_DATE_INVALID'
  | 'COMPONENT_EFFECTIVE_RANGE_INVALID'
  | 'COMPONENT_EFFECTIVE_OVERLAP'
  | 'DEPENDENCY_INPUT_DUPLICATE'
  | 'DEPENDENCY_INPUT_UNBOUND'
  | 'DEPENDENCY_COMPONENT_UNKNOWN'
  | 'DEPENDENCY_VERSION_MISSING'
  | 'DEPENDENCY_VERSION_AMBIGUOUS'
  | 'DEPENDENCY_OUTPUT_UNKNOWN'
  | 'DEPENDENCY_INPUT_UNKNOWN'
  | 'DEPENDENCY_TYPE_MISMATCH'
  | 'DEPENDENCY_SCOPE_MISMATCH'
  | 'OUTPUT_REFERENCE_NOT_DECLARED'

export interface ComponentCatalogValidationIssue {
  readonly code: ComponentCatalogValidationIssueCode
  readonly componentCode: string
  readonly relatedComponentCode?: string
  readonly inputName?: string
  readonly outputName?: string
}

export interface ComponentCatalogValidation {
  readonly valid: boolean
  readonly issues: readonly ComponentCatalogValidationIssue[]
}

export interface ComponentCatalogEntry {
  /** Stable only within a catalog: package identity + composition + component code + component version. */
  readonly key: string
  readonly definition: PayrollComponentDefinition
  readonly ownership: ComponentCatalogOwnership
  /** Rule-package components currently have no status field, so this is omitted for SYSTEM entries. */
  readonly status?: string
  /** Supplied only when backed by an existing product label; the packages do not currently define names. */
  readonly displayName?: string
  /** Supplied only when backed by real metadata; consumers may derive a filter category from method.kind. */
  readonly category?: string
  readonly package: ComponentCatalogPackageIdentity
  readonly sourceMetadata?: Readonly<Record<string, string>>
  readonly roundingDefinitions: readonly PayrollRoundingDefinition[]
  readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
  readonly parameterMetadata?: Readonly<Record<string, ComponentCatalogParameterMetadata>>
  readonly dependencies: readonly PayrollDependencyDefinition[]
  readonly upstream: readonly ComponentCatalogReference[]
  readonly downstream: readonly ComponentCatalogReference[]
  readonly validation: ComponentCatalogValidation
  readonly forkable: boolean
  readonly forkBlockReason?: 'REGISTERED_RULE_NOT_COPYABLE' | 'SYSTEM_OWNERSHIP_REQUIRED'
}

export interface CreateComponentCatalogEntryInput {
  readonly definition: PayrollComponentDefinition
  readonly compositionId?: string
  /** Exact package identity captured with a persisted definition, such as a detached customer fork. */
  readonly packageIdentity?: ComponentCatalogPackageIdentity
  readonly packageMetadata?: PayrollRulePackageMetadata
  readonly sourceMetadata?: Readonly<Record<string, string>>
  readonly roundingDefinitions?: readonly PayrollRoundingDefinition[]
  readonly parameters?: Readonly<Record<string, PayrollTypedParameter>>
  readonly parameterMetadata?: Readonly<Record<string, ComponentCatalogParameterMetadata>>
  /** Other definitions in the same package/composition, used to resolve graph edges and validate them. */
  readonly components?: readonly PayrollComponentDefinition[]
  /** Optional stored catalog graph/validation for snapshots that must not resolve against today's package. */
  readonly upstream?: readonly ComponentCatalogReference[]
  readonly downstream?: readonly ComponentCatalogReference[]
  readonly validation?: ComponentCatalogValidation
  /** Use for persistence identities such as `draft::<row.id>`; omit for package-backed SYSTEM entries. */
  readonly key?: string
  readonly status?: string
  readonly displayName?: string
  readonly category?: string
}

export interface FindSystemComponentCatalogEntryInput {
  readonly compositionId?: string
  readonly packageId?: string
  readonly code: string
  readonly version: string
}

export interface ComponentCatalogSearchFilters {
  readonly query?: string
  readonly category?: string
  readonly ownership?: ComponentCatalogOwnership
  readonly status?: string
}

const PROCESSING_SCOPES: readonly PayrollProcessingScope[] = [
  'EMPLOYMENT',
  'PAYROLL_RUN',
  'INCOME_RELATIONSHIP',
  'ASSESSMENT_BASE_GROUP',
  'EMPLOYEE',
  'PAYROLL_PERIOD',
  'EMPLOYER',
]

const SYSTEM_RULE_PACKAGES: readonly PayrollRulePackage[] = [
  GC_NL_001_RULE_PACKAGE,
  NL_2026_RULE_PACKAGE,
]

function deepPlainSnapshot<T>(value: T): T {
  if (value === null || typeof value === 'string' || typeof value === 'number'
    || typeof value === 'boolean' || typeof value === 'undefined') {
    return value
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepPlainSnapshot(item))) as T
  }

  if (typeof value !== 'object') {
    throw new TypeError('Catalog snapshots may contain only plain data values.')
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Catalog snapshots may contain only plain objects and arrays.')
  }

  const snapshot: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    snapshot[key] = deepPlainSnapshot(item)
  }
  return Object.freeze(snapshot) as T
}

function packageIdentity(
  compositionId: string,
  metadata?: PayrollRulePackageMetadata,
): ComponentCatalogPackageIdentity {
  return {
    compositionId,
    ...(metadata ? {
      packageId: metadata.packageId,
      version: metadata.version,
      packageHash: metadata.packageHash,
      parameterSetHash: metadata.parameterSetHash,
    } : {}),
  }
}

function catalogKey(packageInfo: ComponentCatalogPackageIdentity, definition: PayrollComponentDefinition): string {
  return [
    packageInfo.packageId ?? '',
    packageInfo.version ?? '',
    packageInfo.compositionId,
    definition.code,
    definition.version,
  ].map((part) => encodeURIComponent(part)).join('::')
}

function isProcessingScope(value: string): value is PayrollProcessingScope {
  return PROCESSING_SCOPES.some((scope) => scope === value)
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function nextCalendarDate(value: string): string | null {
  if (!isIsoDate(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day! + 1))
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`
}

function intervalContains(definition: PayrollComponentDefinition, date: string): boolean {
  return definition.effectiveFrom <= date && (definition.effectiveTo === null || date <= definition.effectiveTo)
}

function intervalOverlaps(left: PayrollComponentDefinition, right: PayrollComponentDefinition): boolean {
  return (left.effectiveTo === null || right.effectiveFrom <= left.effectiveTo)
    && (right.effectiveTo === null || left.effectiveFrom <= right.effectiveTo)
}

function getPackageComponents(
  definition: PayrollComponentDefinition,
  components?: readonly PayrollComponentDefinition[],
): readonly PayrollComponentDefinition[] {
  const packageComponents = components ? [...components] : []
  if (!packageComponents.includes(definition)) packageComponents.push(definition)
  return packageComponents
}

function addIssue(
  issues: ComponentCatalogValidationIssue[],
  issue: ComponentCatalogValidationIssue,
): void {
  const key = [issue.code, issue.componentCode, issue.relatedComponentCode ?? '', issue.inputName ?? '', issue.outputName ?? ''].join('\u0000')
  if (!issues.some((existing) => [existing.code, existing.componentCode, existing.relatedComponentCode ?? '', existing.inputName ?? '', existing.outputName ?? ''].join('\u0000') === key)) {
    issues.push(issue)
  }
}

function collectOutputReferences(expression: PayrollExpression): readonly { componentCode: string; outputName: string }[] {
  if (!expression || typeof expression !== 'object') return []
  const node = expression as Record<string, unknown>
  if (node.kind === 'output' && typeof node.componentCode === 'string' && typeof node.outputName === 'string') {
    return [{ componentCode: node.componentCode, outputName: node.outputName }]
  }

  const children: unknown[] = []
  if ('operand' in node) children.push(node.operand)
  if ('left' in node) children.push(node.left)
  if ('right' in node) children.push(node.right)
  if ('condition' in node) children.push(node.condition)
  if ('then' in node) children.push(node.then)
  if ('else' in node) children.push(node.else)
  if (Array.isArray(node.arguments)) children.push(...node.arguments)
  return children.flatMap((child) => isPayrollExpression(child) ? collectOutputReferences(child) : [])
}

function isPayrollExpression(value: unknown): value is PayrollExpression {
  if (!value || typeof value !== 'object') return false
  const kind = (value as { readonly kind?: unknown }).kind
  return kind === 'literal' || kind === 'boolean' || kind === 'string' || kind === 'input'
    || kind === 'output' || kind === 'parameter' || kind === 'unary' || kind === 'binary'
    || kind === 'if' || kind === 'call'
}

function dependencyVersionBoundaries(
  dependent: PayrollComponentDefinition,
  providers: readonly PayrollComponentDefinition[],
): readonly string[] {
  const boundaries = new Set<string>([dependent.effectiveFrom])
  for (const provider of providers) {
    if (provider.effectiveFrom >= dependent.effectiveFrom
      && (dependent.effectiveTo === null || provider.effectiveFrom <= dependent.effectiveTo)) {
      boundaries.add(provider.effectiveFrom)
    }
    if (provider.effectiveTo !== null) {
      const nextDate = nextCalendarDate(provider.effectiveTo)
      if (nextDate && nextDate >= dependent.effectiveFrom
        && (dependent.effectiveTo === null || nextDate <= dependent.effectiveTo)) {
        boundaries.add(nextDate)
      }
    }
  }
  return [...boundaries].sort()
}

function validateDefinition(
  definition: PayrollComponentDefinition,
  components: readonly PayrollComponentDefinition[],
): ComponentCatalogValidation {
  const issues: ComponentCatalogValidationIssue[] = []
  const issueBase = { componentCode: definition.code }

  if (!isProcessingScope(String(definition.processingScope))) {
    addIssue(issues, { code: 'COMPONENT_SCOPE_UNSUPPORTED', ...issueBase })
  }
  const validFrom = isIsoDate(String(definition.effectiveFrom))
  const validTo = definition.effectiveTo === null || isIsoDate(String(definition.effectiveTo))
  if (!validFrom || !validTo) {
    addIssue(issues, { code: 'COMPONENT_EFFECTIVE_DATE_INVALID', ...issueBase })
  } else if (definition.effectiveTo !== null && definition.effectiveTo < definition.effectiveFrom) {
    addIssue(issues, { code: 'COMPONENT_EFFECTIVE_RANGE_INVALID', ...issueBase })
  }

  const sameIdentity = components.filter((candidate) => candidate.id === definition.id && candidate.code === definition.code)
  for (const candidate of sameIdentity) {
    if (candidate !== definition && candidate.version === definition.version) {
      addIssue(issues, { code: 'COMPONENT_VERSION_DUPLICATE', ...issueBase, relatedComponentCode: candidate.code })
    }
    if (candidate !== definition && intervalOverlaps(candidate, definition)) {
      addIssue(issues, { code: 'COMPONENT_EFFECTIVE_OVERLAP', ...issueBase, relatedComponentCode: candidate.code })
    }
  }

  const seenInputs = new Set<string>()
  for (const dependency of definition.dependencies) {
    if (seenInputs.has(dependency.inputName)) {
      addIssue(issues, {
        code: 'DEPENDENCY_INPUT_DUPLICATE',
        ...issueBase,
        relatedComponentCode: dependency.componentCode,
        inputName: dependency.inputName,
      })
    }
    seenInputs.add(dependency.inputName)

    const targetInput = definition.inputs.find((input) => input.name === dependency.inputName)
    if (!targetInput) {
      addIssue(issues, {
        code: 'DEPENDENCY_INPUT_UNKNOWN',
        ...issueBase,
        relatedComponentCode: dependency.componentCode,
        inputName: dependency.inputName,
      })
    }

    const providers = components.filter((candidate) => candidate.code === dependency.componentCode)
    if (providers.length === 0) {
      addIssue(issues, {
        code: 'DEPENDENCY_COMPONENT_UNKNOWN',
        ...issueBase,
        relatedComponentCode: dependency.componentCode,
        inputName: dependency.inputName,
        outputName: dependency.outputName,
      })
      continue
    }

    const boundaries = dependencyVersionBoundaries(definition, providers)
    const activeProviders = new Set<PayrollComponentDefinition>()
    let missingVersion = false
    let ambiguousVersion = false
    for (const boundary of boundaries) {
      if (!intervalContains(definition, boundary)) continue
      const activeAtBoundary = providers.filter((provider) => intervalContains(provider, boundary))
      if (activeAtBoundary.length === 0) missingVersion = true
      if (activeAtBoundary.length > 1) ambiguousVersion = true
      for (const provider of activeAtBoundary) activeProviders.add(provider)
    }
    if (missingVersion) {
      addIssue(issues, {
        code: 'DEPENDENCY_VERSION_MISSING',
        ...issueBase,
        relatedComponentCode: dependency.componentCode,
        inputName: dependency.inputName,
        outputName: dependency.outputName,
      })
    }
    if (ambiguousVersion) {
      addIssue(issues, {
        code: 'DEPENDENCY_VERSION_AMBIGUOUS',
        ...issueBase,
        relatedComponentCode: dependency.componentCode,
        inputName: dependency.inputName,
        outputName: dependency.outputName,
      })
    }

    for (const provider of activeProviders) {
      const sourceOutput = provider.outputs.find((output) => output.name === dependency.outputName)
      if (!sourceOutput) {
        addIssue(issues, {
          code: 'DEPENDENCY_OUTPUT_UNKNOWN',
          ...issueBase,
          relatedComponentCode: dependency.componentCode,
          inputName: dependency.inputName,
          outputName: dependency.outputName,
        })
      } else if (targetInput && sourceOutput.valueType !== targetInput.valueType) {
        addIssue(issues, {
          code: 'DEPENDENCY_TYPE_MISMATCH',
          ...issueBase,
          relatedComponentCode: dependency.componentCode,
          inputName: dependency.inputName,
          outputName: dependency.outputName,
        })
      }

      if (targetInput && provider.processingScope !== definition.processingScope && definition.method.kind !== 'aggregate') {
        addIssue(issues, {
          code: 'DEPENDENCY_SCOPE_MISMATCH',
          ...issueBase,
          relatedComponentCode: dependency.componentCode,
          inputName: dependency.inputName,
          outputName: dependency.outputName,
        })
      }
    }
  }

  for (const input of definition.inputs) {
    if (input.required && !seenInputs.has(input.name)) {
      addIssue(issues, { code: 'DEPENDENCY_INPUT_UNBOUND', ...issueBase, inputName: input.name })
    }
  }

  if (definition.method.kind === 'expression') {
    const declaredReferences = new Set(definition.dependencies.map((dependency) => `${dependency.componentCode}\u0000${dependency.outputName}`))
    for (const expression of Object.values(definition.method.outputs)) {
      for (const reference of collectOutputReferences(expression)) {
        if (!declaredReferences.has(`${reference.componentCode}\u0000${reference.outputName}`)) {
          addIssue(issues, {
            code: 'OUTPUT_REFERENCE_NOT_DECLARED',
            ...issueBase,
            relatedComponentCode: reference.componentCode,
            outputName: reference.outputName,
          })
        }
      }
    }
  }

  const frozenIssues = deepPlainSnapshot(issues)
  return deepPlainSnapshot({ valid: frozenIssues.length === 0, issues: frozenIssues })
}

function createReferences(
  definition: PayrollComponentDefinition,
  packageComponents: readonly PayrollComponentDefinition[],
  packageInfo: ComponentCatalogPackageIdentity,
): { readonly upstream: readonly ComponentCatalogReference[]; readonly downstream: readonly ComponentCatalogReference[] } {
  const upstream = definition.dependencies.flatMap((dependency) => packageComponents
    .filter((candidate) => candidate.code === dependency.componentCode && intervalOverlaps(candidate, definition))
    .map((candidate) => ({
      key: catalogKey(packageInfo, candidate),
      componentCode: candidate.code,
      componentVersion: candidate.version,
      outputName: dependency.outputName,
      inputName: dependency.inputName,
    })))

  const downstream = packageComponents.flatMap((candidate) => candidate.dependencies
    .filter((dependency) => dependency.componentCode === definition.code && intervalOverlaps(candidate, definition))
    .map((dependency) => ({
      key: catalogKey(packageInfo, candidate),
      componentCode: candidate.code,
      componentVersion: candidate.version,
      outputName: dependency.outputName,
      inputName: dependency.inputName,
    })))

  return { upstream, downstream }
}

export function createComponentCatalogEntry(input: CreateComponentCatalogEntryInput): ComponentCatalogEntry {
  if (!input.packageIdentity && !input.compositionId) {
    throw new TypeError('A catalog entry requires a composition id or persisted package identity.')
  }
  const definition = deepPlainSnapshot(input.definition)
  const packageInfo = deepPlainSnapshot(input.packageIdentity ?? packageIdentity(input.compositionId!, input.packageMetadata))
  const packageComponents = getPackageComponents(input.definition, input.components)
  const relationships = createReferences(input.definition, packageComponents, packageInfo)
  const validation = input.validation ?? validateDefinition(input.definition, packageComponents)
  const forkBlockReason = definition.method.kind === 'registeredRule'
    ? 'REGISTERED_RULE_NOT_COPYABLE'
    : definition.ownership.kind !== 'SYSTEM'
      ? 'SYSTEM_OWNERSHIP_REQUIRED'
      : undefined

  return deepPlainSnapshot({
    key: input.key ?? catalogKey(packageInfo, definition),
    definition,
    ownership: definition.ownership.kind,
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.category === undefined ? {} : { category: input.category }),
    package: packageInfo,
    ...(input.sourceMetadata === undefined ? {} : { sourceMetadata: input.sourceMetadata }),
    roundingDefinitions: (input.roundingDefinitions ?? []).filter((rounding) => rounding.componentCode === definition.code),
    parameters: input.parameters ?? definition.parameters ?? {},
    ...(input.parameterMetadata === undefined ? {} : { parameterMetadata: input.parameterMetadata }),
    dependencies: definition.dependencies,
    upstream: input.upstream ?? relationships.upstream,
    downstream: input.downstream ?? relationships.downstream,
    validation,
    forkable: forkBlockReason === undefined,
    ...(forkBlockReason === undefined ? {} : { forkBlockReason }),
  })
}

function createPackageCatalog(rulePackage: PayrollRulePackage): readonly ComponentCatalogEntry[] {
  const metadata = rulePackage.metadata
  return rulePackage.components
    .filter((definition) => definition.ownership.kind === 'SYSTEM')
    .map((definition) => {
      const parameterMetadata = rulePackage.compositionId === NL_2026_RULE_PACKAGE.compositionId
        ? Object.fromEntries(Object.entries(NL_2026_PARAMETER_METADATA)
          .filter(([name]) => definition.parameters?.[name] !== undefined))
        : undefined
      return createComponentCatalogEntry({
        definition,
        compositionId: rulePackage.compositionId,
        ...(metadata ? {
          packageMetadata: metadata,
          sourceMetadata: metadata.sourceMetadata,
        } : {}),
        roundingDefinitions: rulePackage.roundingDefinitions?.filter((rounding) => rounding.componentCode === definition.code) ?? [],
        ...(parameterMetadata && Object.keys(parameterMetadata).length > 0 ? { parameterMetadata } : {}),
        components: rulePackage.components,
      })
    })
}

export const SYSTEM_COMPONENT_CATALOG: readonly ComponentCatalogEntry[] = deepPlainSnapshot(
  SYSTEM_RULE_PACKAGES.flatMap((rulePackage) => createPackageCatalog(rulePackage)),
)

export function getSystemComponentCatalog(): readonly ComponentCatalogEntry[] {
  return SYSTEM_COMPONENT_CATALOG
}

export function findSystemComponentCatalogEntry(
  input: FindSystemComponentCatalogEntryInput,
): ComponentCatalogEntry | null {
  return SYSTEM_COMPONENT_CATALOG.find((entry) => entry.definition.code === input.code
    && entry.definition.version === input.version
    && (input.compositionId === undefined || entry.package.compositionId === input.compositionId)
    && (input.packageId === undefined || entry.package.packageId === input.packageId)) ?? null
}

export function findSystemComponentCatalogEntryByKey(key: string): ComponentCatalogEntry | null {
  return SYSTEM_COMPONENT_CATALOG.find((entry) => entry.key === key) ?? null
}

export function filterComponentCatalogEntries(
  entries: readonly ComponentCatalogEntry[],
  filters: ComponentCatalogSearchFilters = {},
): readonly ComponentCatalogEntry[] {
  const query = filters.query?.trim().toLowerCase()
  const category = filters.category?.trim().toLowerCase()
  return entries.filter((entry) => {
    if (filters.ownership && entry.ownership !== filters.ownership) return false
    if (filters.status && entry.status !== filters.status) return false

    const entryCategory = (entry.category ?? entry.definition.method.kind).toLowerCase()
    if (category && entryCategory !== category) return false

    if (!query) return true
    const searchable = [
      entry.displayName,
      entry.category,
      entry.definition.code,
      entry.definition.version,
      entry.definition.method.kind,
      entry.package.compositionId,
      entry.package.packageId,
      entry.package.version,
      ...entry.definition.inputs.map((input) => input.name),
      ...entry.definition.outputs.map((output) => output.name),
      ...entry.dependencies.map((dependency) => dependency.componentCode),
      ...Object.keys(entry.parameters),
      ...Object.values(entry.sourceMetadata ?? {}),
    ].filter((value): value is string => typeof value === 'string').join('\n').toLowerCase()
    return searchable.includes(query)
  })
}
