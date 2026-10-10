import type { PayrollSourceSnapshot } from '../domain/payroll-contracts'
import { applyPayrollRoundingToRatio, FixedDecimal, PayrollEngineError } from './decimal'
import { sha256, stableSerialize } from './hash'
import type {
  PayrollCalculationBuildOptions,
  PayrollCalculationInputs,
  PayrollCalculationResult,
  PayrollCalculationResultRow,
  PayrollCalculationTraceStep,
  PayrollComponentDefinition,
  PayrollComponentMethod,
  PayrollComponentResult,
  PayrollControlDefinition,
  PayrollControlResult,
  PayrollDependencyDefinition,
  PayrollExpression,
  PayrollResultMapping,
  PayrollRulePackage,
  PayrollSerializedValue,
  PayrollTypedParameter,
  PayrollValueType,
  PayrollRegisteredRule,
  PayrollRegisteredRuleTraceStep,
  PayrollRulePackageMetadata,
  PayrollRulePackageProvenance,
  PayrollScopedNodeIdentity,
  PayrollProcessingScope,
  PayrollRoundingDefinition,
} from './types'

export const PAYROLL_ENGINE_VERSION = '0.2.0'

const MAX_COMPONENTS = 256
const MAX_DEPENDENCIES = 1_024
const MAX_CONTROLS = 256
const MAX_EXPRESSION_NODES = 512
const MAX_EXPRESSION_DEPTH = 32
const MAX_RULE_DATA_DEPTH = 64
const MAX_RULE_DATA_NODES = 16_384
const MAX_REGISTERED_RULE_TRACE_STEPS = 128
const MAX_REGISTERED_RULE_TRACE_VALUES = 64
const MAX_REGISTERED_RULE_TEXT_LENGTH = 2_048
const MAX_REGISTERED_RULE_TRACE_TEXT_LENGTH = 262_144
const MAX_SCOPE_INSTANCE_ID_LENGTH = 256
const MAX_ROUNDING_DEFINITIONS = 1_024

export type PayrollCustomerComponentPatch = Partial<Pick<PayrollComponentDefinition,
  'processingScope' | 'inputs' | 'outputs' | 'dependencies' | 'parameters' | 'method' | 'tracePolicy' | 'effectiveFrom' | 'effectiveTo'>>

export interface ForkSystemComponentOptions {
  readonly id: string
  readonly code: string
  readonly version: string
  readonly effectiveFrom: string
  readonly effectiveTo?: string | null
  readonly forkedAt: string
  readonly overrides?: PayrollCustomerComponentPatch
}

type RuntimePrimitive = FixedDecimal | boolean | string
interface RuntimeValue {
  readonly valueType: PayrollValueType
  readonly value: RuntimePrimitive
}

interface ExpressionContext {
  readonly component: PayrollComponentDefinition | null
  readonly componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>
  readonly localInputs: Readonly<Record<string, RuntimeValue>>
  readonly componentOutputs: ReadonlyMap<string, Readonly<Record<string, RuntimeValue>>>
  readonly allowInputs: boolean
  readonly allowParameters: boolean
  readonly roundingDefinitions: readonly PayrollRoundingDefinition[]
}

/** Selects effective rules from an immutable source snapshot and computes the persistence input hash. */
export function buildCalculationInputs(
  sourceSnapshot: PayrollSourceSnapshot,
  rulePackage: PayrollRulePackage,
  options: PayrollCalculationBuildOptions = {},
): PayrollCalculationInputs {
  validateSnapshotIdentityWithPayload(sourceSnapshot)
  validateRulePackageShape(rulePackage)
  const packageMetadata = rulePackage.metadata === undefined ? undefined : cloneAndFreezePlain(rulePackage.metadata)
  if (packageMetadata) validatePackageMetadata(packageMetadata)
  const scopeInstanceIds = normalizeScopeInstanceIds(options.scopeInstanceIds)

  const effectiveDate = options.effectiveDate ?? periodStartDate(sourceSnapshot.periodReference)
  if (!isIsoDate(effectiveDate)) throw new PayrollEngineError('EFFECTIVE_DATE_INVALID', 'Effective date must be a valid ISO calendar date.')
  if (options.calculationContextHash !== undefined && !/^[0-9a-f]{64}$/.test(options.calculationContextHash)) {
    throw new PayrollEngineError('CALCULATION_CONTEXT_HASH_INVALID', 'Payroll-owned calculation context must be pinned by a SHA-256 hash.')
  }

  const allComponents = rulePackage.components.map(cloneAndFreezePlain)
  const controls = rulePackage.controls.map(cloneAndFreezePlain)
  const resultMappings = rulePackage.resultMappings.map(cloneAndFreezePlain)
  const allRoundingDefinitions = (rulePackage.roundingDefinitions ?? []).map(cloneAndFreezePlain)
  validateOwnershipIdentities(allComponents)
  validateComponentVersions(allComponents)
  const activeComponents = allComponents
    .filter((component) => component.effectiveFrom <= effectiveDate && (component.effectiveTo === null || effectiveDate <= component.effectiveTo))
    .sort((left, right) => left.code.localeCompare(right.code) || left.id.localeCompare(right.id))
  if (activeComponents.length === 0) throw new PayrollEngineError('RULE_PACKAGE_EMPTY', 'No payroll component is effective on the requested date.')

  const roundingDefinitions = selectEffectiveRoundingDefinitions(
    allRoundingDefinitions,
    allComponents,
    activeComponents,
    packageMetadata,
    effectiveDate,
  )

  const componentsByCode = new Map<string, PayrollComponentDefinition>()
  for (const component of activeComponents) {
    if (componentsByCode.has(component.code)) {
      throw new PayrollEngineError('COMPONENT_VERSION_AMBIGUOUS', `More than one active version exists for component ${component.code}.`)
    }
    componentsByCode.set(component.code, component)
    validateComponentDefinition(component)
  }

  validateComponentGraph(activeComponents, componentsByCode)
  validateComponentRoundingReferences(activeComponents, roundingDefinitions)
  validateControls(controls, componentsByCode)
  validateResultMappings(resultMappings, componentsByCode)

  const activeSourceKeys = new Set(activeComponents.flatMap((component) => {
    if (component.method.kind !== 'source') return []
    const output = component.outputs[0]
    return output ? [outputKey(component.code, output.name)] : []
  }))
  const suppliedOverrideKeys = Object.keys(options.sourceValueOverrides ?? {})
  const unknownOverrideKey = suppliedOverrideKeys.find((key) => !activeSourceKeys.has(key))
  if (unknownOverrideKey) {
    throw new PayrollEngineError('SOURCE_OVERRIDE_UNKNOWN', `Payroll source override ${unknownOverrideKey} does not match an active source component.`)
  }

  const snapshot = deepFreeze(cloneAndFreezePlain(sourceSnapshot))
  const resolvedSourceValues: Record<string, PayrollSerializedValue> = {}
  const resolvedSourceOverrides: Record<string, PayrollSerializedValue> = {}
  for (const component of activeComponents) {
    if (component.method.kind !== 'source') continue
    const output = component.outputs[0]
    if (!output) throw new PayrollEngineError('SOURCE_OUTPUT_REQUIRED', `Source component ${component.code} must define one output.`)
    const key = outputKey(component.code, output.name)
    const sourceOverride = options.sourceValueOverrides?.[key]
    if (sourceOverride && sourceOverride.valueType !== output.valueType) {
      throw new PayrollEngineError('SOURCE_OVERRIDE_TYPE_MISMATCH', `Payroll source override ${key} does not match the declared value type.`)
    }
    const raw = sourceOverride ? sourceOverride.value : readPath(snapshot.canonicalSource, component.method.path)
    if (raw === undefined || raw === null) {
      throw new PayrollEngineError('REQUIRED_INPUT_MISSING', `Required source value for ${component.code}.${output.name} is missing.`)
    }
    const resolved = serializeValue(parseExternalValue(raw, output.valueType))
    resolvedSourceValues[key] = resolved
    if (sourceOverride) resolvedSourceOverrides[key] = resolved
  }

  const compositionValue = {
    ...(packageMetadata ? { packageMetadata } : {}),
    components: activeComponents.map(normalizeComponentForHash),
    controls: [...controls].sort((left, right) => left.code.localeCompare(right.code)),
    ...(allRoundingDefinitions.length > 0 ? { roundingDefinitions: sortRoundingDefinitions(allRoundingDefinitions) } : {}),
    resultMappings: [...resultMappings].sort((left, right) => left.key.localeCompare(right.key)),
  }
  const rulePackageCompositionHash = sha256(stableSerialize(compositionValue))
  const inputHash = sha256(stableSerialize({
    sourceHash: snapshot.sourceHash,
    periodReference: snapshot.periodReference,
    effectiveDate,
    engineVersion: PAYROLL_ENGINE_VERSION,
    rulePackageCompositionId: rulePackage.compositionId,
    rulePackageCompositionHash,
    ...(Object.keys(resolvedSourceOverrides).length > 0 ? { sourceValueOverrides: resolvedSourceOverrides } : {}),
    ...(options.calculationContextHash ? { calculationContextHash: options.calculationContextHash } : {}),
    ...(scopeInstanceIds ? { scopeInstanceIds } : {}),
  }))

  return deepFreeze({
    ...(packageMetadata ? { packageMetadata } : {}),
    ...(scopeInstanceIds ? { scopeInstanceIds } : {}),
    ...(roundingDefinitions.length > 0 ? { roundingDefinitions } : {}),
    sourceSnapshotId: snapshot.id,
    sourceHash: snapshot.sourceHash,
    periodReference: { ...snapshot.periodReference },
    effectiveDate,
    engineVersion: PAYROLL_ENGINE_VERSION,
    rulePackageCompositionId: rulePackage.compositionId,
    rulePackageCompositionHash,
    inputHash,
    ...(Object.keys(resolvedSourceOverrides).length > 0 ? { sourceValueOverrides: resolvedSourceOverrides } : {}),
    ...(options.calculationContextHash ? { calculationContextHash: options.calculationContextHash } : {}),
    components: activeComponents,
    controls: controls.sort((left, right) => left.code.localeCompare(right.code)),
    resultMappings,
    resolvedSourceValues,
  })
}

/** Runs the validated, acyclic component graph without consulting external state. */
export function calculatePayroll(inputs: PayrollCalculationInputs, registry: readonly PayrollRegisteredRule[] = []): PayrollCalculationResult {
  if (inputs.engineVersion !== PAYROLL_ENGINE_VERSION) {
    throw new PayrollEngineError('ENGINE_VERSION_UNSUPPORTED', `Unsupported payroll engine version ${inputs.engineVersion}.`)
  }
  const packageMetadata = inputs.packageMetadata === undefined ? undefined : cloneAndFreezePlain(inputs.packageMetadata)
  if (packageMetadata) validatePackageMetadata(packageMetadata)
  const scopeInstanceIds = normalizeScopeInstanceIds(inputs.scopeInstanceIds)
  const declaredRoundingDefinitions = cloneAndFreezePlain(inputs.roundingDefinitions ?? [])
  const roundingDefinitions = validateActiveRoundingDefinitions(
    declaredRoundingDefinitions,
    inputs.components,
    packageMetadata,
    inputs.effectiveDate,
  )
  validateComponentRoundingReferences(inputs.components, roundingDefinitions)
  validateOwnershipIdentities(inputs.components)
  for (const component of inputs.components) validateComponentDefinition(component)
  const componentsByCode = new Map(inputs.components.map((component) => [component.code, component]))
  const order = topologicalOrder(inputs.components, componentsByCode)
  const outputsByCode = new Map<string, Readonly<Record<string, RuntimeValue>>>()
  const componentResults: PayrollComponentResult[] = []
  const trace: PayrollCalculationTraceStep[] = []

  for (const component of order) {
    const localInputs: Record<string, RuntimeValue> = {}
    for (const dependency of component.dependencies) {
      const upstreamOutputs = outputsByCode.get(dependency.componentCode)
      const upstreamValue = upstreamOutputs?.[dependency.outputName]
      if (!upstreamValue) {
        throw new PayrollEngineError('DEPENDENCY_VALUE_MISSING', `Dependency ${dependency.componentCode}.${dependency.outputName} did not produce a value.`)
      }
      localInputs[dependency.inputName] = upstreamValue
    }

    const componentOutputs: Record<string, RuntimeValue> = {}
    let registeredRuleTrace: readonly PayrollRegisteredRuleTraceStep[] | undefined
    const method = component.method
    if (method.kind === 'registeredRule') {
      const execution = executeRegisteredRule(
        component,
        packageMetadata,
        localInputs,
        registry,
        roundingDefinitions.filter((definition) => definition.componentCode === component.code),
      )
      for (const [name, value] of Object.entries(execution.outputs)) componentOutputs[name] = parseSerializedValue(value)
      registeredRuleTrace = execution.trace
    } else if (method.kind === 'source') {
      const output = component.outputs[0]
      if (!output) throw new PayrollEngineError('SOURCE_OUTPUT_REQUIRED', `Source component ${component.code} must define one output.`)
      const sourceValue = inputs.resolvedSourceValues[outputKey(component.code, output.name)]
      if (!sourceValue) throw new PayrollEngineError('REQUIRED_INPUT_MISSING', `Required source value for ${component.code}.${output.name} is missing.`)
      componentOutputs[output.name] = parseSerializedValue(sourceValue)
    } else if (method.kind === 'passThrough') {
      for (const output of component.outputs) {
        const inputName = method.outputs[output.name]
        const inputValue = inputName ? localInputs[inputName] : undefined
        if (!inputValue) throw new PayrollEngineError('COMPONENT_INPUT_MISSING', `Pass-through input ${inputName ?? ''} is missing from ${component.code}.`)
        componentOutputs[output.name] = inputValue
      }
    } else if (method.kind === 'aggregate') {
      const values = method.inputNames.map((name) => localInputs[name])
      const output = component.outputs[0]
      if (!output) throw new PayrollEngineError('AGGREGATE_OUTPUT_REQUIRED', `Aggregate component ${component.code} must define one output.`)
      const total = aggregate(method.operation, values)
      componentOutputs[output.name] = total
    } else {
      for (const output of component.outputs) {
        const expression = method.outputs[output.name]
        if (!expression) throw new PayrollEngineError('EXPRESSION_OUTPUT_MISSING', `Expression for ${component.code}.${output.name} is missing.`)
        const value = evaluateExpression(expression, {
          component,
          componentsByCode,
          localInputs,
          componentOutputs: outputsByCode,
          allowInputs: true,
          allowParameters: true,
          roundingDefinitions,
        })
        componentOutputs[output.name] = value
      }
    }

    const roundedOutputs: Record<string, RuntimeValue> = {}
    for (const outputDefinition of component.outputs) {
      const value = componentOutputs[outputDefinition.name]
      if (!value) throw new PayrollEngineError('COMPONENT_OUTPUT_MISSING', `Component ${component.code} did not produce ${outputDefinition.name}.`)
      if (value.valueType !== outputDefinition.valueType) {
        throw new PayrollEngineError('COMPONENT_OUTPUT_TYPE_MISMATCH', `Component ${component.code}.${outputDefinition.name} produced ${value.valueType}; expected ${outputDefinition.valueType}.`)
      }
      const rounded = outputDefinition.rounding
        ? roundRuntimeValue(value, outputDefinition.rounding.scale, outputDefinition.rounding.mode)
        : value
      roundedOutputs[outputDefinition.name] = rounded
    }
    const frozenOutputs = Object.freeze(roundedOutputs)
    outputsByCode.set(component.code, frozenOutputs)

    const serializedOutputs = component.outputs
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((definition) => ({ name: definition.name, ...serializeValue(frozenOutputs[definition.name]!) }))
    componentResults.push({
      ...(scopeInstanceIds?.[component.processingScope]
        ? { nodeIdentity: nodeIdentity(component, scopeInstanceIds[component.processingScope]!) }
        : {}),
      componentId: component.id,
      componentCode: component.code,
      version: component.version,
      processingScope: component.processingScope,
      outputs: serializedOutputs,
    })

    const inputTrace: Record<string, PayrollSerializedValue> = {}
    for (const key of Object.keys(localInputs).sort()) inputTrace[key] = serializeValue(localInputs[key]!)
    const outputTrace = Object.fromEntries(serializedOutputs.map((output) => [output.name, {
      valueType: output.valueType,
      value: output.value,
    }]))
    trace.push({
      ...(registeredRuleTrace && component.tracePolicy === 'FULL' ? { registeredRuleTrace } : {}),
      ...(packageMetadata ? { rulePackageProvenance: rulePackageProvenance(packageMetadata) } : {}),
      ...(scopeInstanceIds?.[component.processingScope]
        ? { nodeIdentity: nodeIdentity(component, scopeInstanceIds[component.processingScope]!) }
        : {}),
      sequence: trace.length + 1,
      componentId: component.id,
      componentCode: component.code,
      version: component.version,
      processingScope: component.processingScope,
      inputs: component.tracePolicy === 'FULL' ? inputTrace : {},
      outputs: component.tracePolicy === 'NONE' ? {} : outputTrace,
      dependencyRefs: component.dependencies
        .slice()
        .sort(dependencyOrder)
        .map(({ componentCode, outputName, inputName }) => ({ componentCode, outputName, inputName })),
    })
  }

  const controls = evaluateControls(inputs.controls, componentsByCode, outputsByCode, roundingDefinitions)
  const status = controls.some((control) => control.status === 'FAIL') ? 'BLOCKED' : 'CALCULATED'
  const resultRows = mapResultRows(inputs.resultMappings, outputsByCode)
  const resultHash = sha256(stableSerialize({
    status,
    sourceHash: inputs.sourceHash,
    periodReference: inputs.periodReference,
    effectiveDate: inputs.effectiveDate,
    engineVersion: inputs.engineVersion,
    rulePackageCompositionId: inputs.rulePackageCompositionId,
    rulePackageCompositionHash: inputs.rulePackageCompositionHash,
    ...(packageMetadata ? { packageMetadata } : {}),
    inputHash: inputs.inputHash,
    componentResults,
    resultRows,
    trace,
    controls,
  }))

  return deepFreeze({
    ...(packageMetadata ? { packageMetadata } : {}),
    status,
    sourceSnapshotId: inputs.sourceSnapshotId,
    sourceHash: inputs.sourceHash,
    periodReference: inputs.periodReference,
    effectiveDate: inputs.effectiveDate,
    engineVersion: inputs.engineVersion,
    rulePackageCompositionId: inputs.rulePackageCompositionId,
    rulePackageCompositionHash: inputs.rulePackageCompositionHash,
    inputHash: inputs.inputHash,
    resultHash,
    componentResults,
    resultRows,
    trace,
    controls,
  })
}

/** Returns a detached customer edit. System-owned definitions can only be forked. */
export function configureCustomerComponent(
  component: PayrollComponentDefinition,
  patch: PayrollCustomerComponentPatch,
): PayrollComponentDefinition {
  if (component.ownership.kind === 'SYSTEM') {
    throw new PayrollEngineError('SYSTEM_COMPONENT_IMMUTABLE', 'System components are immutable; create a customer fork first.')
  }
  assertOnlyKeys(patch, [
    'processingScope', 'inputs', 'outputs', 'dependencies', 'parameters', 'method', 'tracePolicy', 'effectiveFrom', 'effectiveTo',
  ], 'CUSTOMER_PATCH_KEY_FORBIDDEN')
  const clonedPatch = cloneAndFreezePlain(patch)
  const configured = {
    ...cloneAndFreezePlain(component),
    ...clonedPatch,
  }
  validateComponentIdentity(configured)
  validateComponentDefinition(configured)
  validateOwnershipIdentities([configured])
  return deepFreeze(configured)
}

/** Makes a deep detached copy; origin metadata is audit-only and never creates inheritance. */
export function forkSystemComponent(
  systemComponent: PayrollComponentDefinition,
  options: ForkSystemComponentOptions,
): PayrollComponentDefinition {
  if (systemComponent.ownership.kind !== 'SYSTEM') {
    throw new PayrollEngineError('FORK_SOURCE_NOT_SYSTEM', 'Only system-owned components can be forked with this helper.')
  }
  assertOnlyKeys(options, ['id', 'code', 'version', 'effectiveFrom', 'effectiveTo', 'forkedAt', 'overrides'], 'FORK_OPTION_KEY_FORBIDDEN')
  if (options.overrides !== undefined) {
    assertOnlyKeys(options.overrides, [
      'processingScope', 'inputs', 'outputs', 'dependencies', 'parameters', 'method', 'tracePolicy', 'effectiveFrom', 'effectiveTo',
    ], 'FORK_OVERRIDE_KEY_FORBIDDEN')
  }
  if (!options.id || !options.code || options.id === systemComponent.id || options.code === systemComponent.code) {
    throw new PayrollEngineError('FORK_IDENTITY_NOT_DETACHED', 'Customer forks need distinct component ids and codes.')
  }
  if (!isIsoDateTime(options.forkedAt)) throw new PayrollEngineError('FORK_TIMESTAMP_INVALID', 'forkedAt must be an ISO timestamp with a time zone.')
  const overrides = cloneAndFreezePlain(options.overrides ?? {})
  const forked = {
    ...cloneAndFreezePlain(systemComponent),
    ...overrides,
    id: options.id,
    code: options.code,
    version: options.version,
    effectiveFrom: options.effectiveFrom,
    effectiveTo: options.effectiveTo ?? null,
    ownership: {
      kind: 'CUSTOMER_FORK' as const,
      origin: { id: systemComponent.id, code: systemComponent.code, version: systemComponent.version },
      forkedAt: options.forkedAt,
    },
  }
  validateComponentIdentity(forked)
  validateComponentDefinition(forked)
  validateOwnershipIdentities([forked])
  return deepFreeze(forked)
}

/** Appends a historical version without mutating any published definition or input array. */
export function appendPayrollComponentVersion(
  currentVersions: readonly PayrollComponentDefinition[],
  nextVersion: PayrollComponentDefinition,
): readonly PayrollComponentDefinition[] {
  const next = cloneAndFreezePlain(nextVersion)
  validateComponentIdentity(next)
  if (currentVersions.length === 0) {
    validateComponentVersions([next])
    validateOwnershipIdentities([next])
    return Object.freeze([next])
  }
  const previous = currentVersions.map(cloneAndFreezePlain)
  validateComponentVersions(previous)
  validateOwnershipIdentities(previous)
  const identity = previous[0]!
  if (previous.some((version) => version.id !== identity.id || version.code !== identity.code
    || stableSerialize(version.ownership) !== stableSerialize(identity.ownership))) {
    throw new PayrollEngineError('COMPONENT_VERSION_IDENTITY_MISMATCH', 'Appended versions must retain component identity and ownership.')
  }
  if (next.id !== identity.id || next.code !== identity.code
    || stableSerialize(next.ownership) !== stableSerialize(identity.ownership)) {
    throw new PayrollEngineError('COMPONENT_VERSION_IDENTITY_MISMATCH', 'Appended version must retain component id, code and ownership.')
  }
  if (previous.some((version) => version.version === next.version)) {
    throw new PayrollEngineError('COMPONENT_VERSION_DUPLICATE', `Component ${next.code} version ${next.version} is already published.`)
  }
  const latest = [...previous].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]!
  if (next.effectiveFrom <= latest.effectiveFrom) {
    throw new PayrollEngineError('COMPONENT_VERSION_NOT_APPEND_ONLY', 'Version append is append-only: a new version must start after the latest published effective date.')
  }
  if (latest.effectiveTo === null) {
    throw new PayrollEngineError('COMPONENT_VERSION_PREVIOUS_OPEN_ENDED', 'Cannot append while the latest published version remains open-ended.')
  }
  if (latest.effectiveTo >= next.effectiveFrom) {
    throw new PayrollEngineError('COMPONENT_EFFECTIVE_OVERLAP', 'Appended component versions cannot overlap an already-published version.')
  }
  const appended = [...previous, next].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
  validateComponentVersions(appended)
  validateOwnershipIdentities(appended)
  return deepFreeze(appended)
}

function validateSnapshotIdentity(snapshot: PayrollSourceSnapshot): void {
  if (!snapshot.id) throw new PayrollEngineError('SOURCE_SNAPSHOT_ID_REQUIRED', 'Source snapshot id is required.')
  if (!/^[0-9a-f]{64}$/.test(snapshot.sourceHash)) {
    throw new PayrollEngineError('SOURCE_HASH_INVALID', 'Source snapshot hash must be a lowercase SHA-256 value.')
  }
  if (!Number.isInteger(snapshot.periodReference.year) || snapshot.periodReference.year < 1900 || snapshot.periodReference.year > 2200
    || !Number.isInteger(snapshot.periodReference.month) || snapshot.periodReference.month < 1 || snapshot.periodReference.month > 12) {
    throw new PayrollEngineError('PAYROLL_PERIOD_INVALID', 'Source snapshot payroll period is invalid.')
  }
}

function validateRulePackageShape(rulePackage: PayrollRulePackage): void {
  if (!rulePackage.compositionId) throw new PayrollEngineError('RULE_COMPOSITION_ID_REQUIRED', 'Rule package composition id is required.')
  if (!Array.isArray(rulePackage.components) || rulePackage.components.length === 0 || rulePackage.components.length > MAX_COMPONENTS) {
    throw new PayrollEngineError('COMPONENT_COUNT_INVALID', `Rule package must contain between 1 and ${MAX_COMPONENTS} components.`)
  }
  if (!Array.isArray(rulePackage.controls) || rulePackage.controls.length > MAX_CONTROLS) {
    throw new PayrollEngineError('CONTROL_COUNT_INVALID', `Rule package must contain at most ${MAX_CONTROLS} controls.`)
  }
  if (!Array.isArray(rulePackage.resultMappings)) throw new PayrollEngineError('RESULT_MAPPINGS_INVALID', 'Rule package result mappings must be an array.')
  if (rulePackage.roundingDefinitions !== undefined && (!Array.isArray(rulePackage.roundingDefinitions)
    || rulePackage.roundingDefinitions.length > MAX_ROUNDING_DEFINITIONS)) {
    throw new PayrollEngineError('ROUNDING_DEFINITION_COUNT_INVALID', 'Rule package rounding definitions must be a bounded array.')
  }
  if (rulePackage.iterativeClusters !== undefined && !Array.isArray(rulePackage.iterativeClusters)) {
    throw new PayrollEngineError('ITERATIVE_CLUSTER_DEFINITION_INVALID', 'Iterative clusters must be an array when supplied.')
  }
  if (rulePackage.iterativeClusters && rulePackage.iterativeClusters.length > 0) {
    throw new PayrollEngineError('ITERATIVE_CLUSTER_UNSUPPORTED', 'Iterative clusters are reserved and are not supported by this engine version.')
  }
}

function validateComponentVersions(components: readonly PayrollComponentDefinition[]): void {
  const groups = new Map<string, PayrollComponentDefinition[]>()
  for (const component of components) {
    validateComponentIdentity(component)
    const key = `${component.id}\u0000${component.code}`
    const versions = groups.get(key) ?? []
    if (versions.some((existing) => existing.version === component.version)) {
      throw new PayrollEngineError('COMPONENT_VERSION_DUPLICATE', `Component ${component.code} version ${component.version} is duplicated.`)
    }
    versions.push(component)
    groups.set(key, versions)
  }
  for (const versions of groups.values()) {
    versions.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
    for (let index = 0; index < versions.length; index += 1) {
      const current = versions[index]!
      for (let laterIndex = index + 1; laterIndex < versions.length; laterIndex += 1) {
        const later = versions[laterIndex]!
        if (current.effectiveTo === null || current.effectiveTo >= later.effectiveFrom) {
          throw new PayrollEngineError('COMPONENT_EFFECTIVE_OVERLAP', `Effective versions overlap for component ${current.code}.`)
        }
      }
    }
  }
}

function validateComponentIdentity(component: PayrollComponentDefinition): void {
  if (!component.id || !component.code || !component.version) {
    throw new PayrollEngineError('COMPONENT_IDENTITY_REQUIRED', 'Every component needs a stable id, code and version.')
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(component.code)) {
    throw new PayrollEngineError('COMPONENT_CODE_INVALID', `Component code ${component.code} is invalid.`)
  }
  if (!isIsoDate(component.effectiveFrom) || (component.effectiveTo !== null && !isIsoDate(component.effectiveTo))) {
    throw new PayrollEngineError('COMPONENT_EFFECTIVE_DATE_INVALID', `Effective dates for ${component.code} must be valid ISO calendar dates.`)
  }
  if (component.effectiveTo !== null && component.effectiveTo < component.effectiveFrom) {
    throw new PayrollEngineError('COMPONENT_EFFECTIVE_RANGE_INVALID', `Effective end precedes start for ${component.code}.`)
  }
  if (!component.ownership || !['SYSTEM', 'CUSTOMER_FORK', 'CUSTOMER_CUSTOM'].includes(component.ownership.kind)) {
    throw new PayrollEngineError('COMPONENT_OWNERSHIP_INVALID', `Ownership for ${component.code} is invalid.`)
  }
  if (!['EMPLOYMENT', 'PAYROLL_RUN', 'INCOME_RELATIONSHIP', 'ASSESSMENT_BASE_GROUP', 'EMPLOYEE', 'PAYROLL_PERIOD', 'EMPLOYER'].includes(component.processingScope)) {
    throw new PayrollEngineError('COMPONENT_SCOPE_INVALID', `Processing scope for ${component.code} is invalid.`)
  }
  if (!Array.isArray(component.inputs) || !Array.isArray(component.outputs) || component.outputs.length === 0
    || !Array.isArray(component.dependencies) || !component.method) {
    throw new PayrollEngineError('COMPONENT_DEFINITION_INVALID', `Component ${component.code} is incomplete.`)
  }
  const inputNames = new Set<string>()
  for (const input of component.inputs) {
    if (!input.name || inputNames.has(input.name) || !isValueType(input.valueType) || typeof input.required !== 'boolean') {
      throw new PayrollEngineError('COMPONENT_INPUT_INVALID', `Input definition is invalid on ${component.code}.`)
    }
    inputNames.add(input.name)
  }
  const outputNames = new Set<string>()
  for (const output of component.outputs) {
    if (!output.name || outputNames.has(output.name) || !isValueType(output.valueType)) {
      throw new PayrollEngineError('COMPONENT_OUTPUT_INVALID', `Output definition is invalid on ${component.code}.`)
    }
    outputNames.add(output.name)
    if (output.rounding) {
      if (!Number.isInteger(output.rounding.scale) || output.rounding.scale < 0 || output.rounding.scale > 18
        || !['HALF_UP', 'HALF_EVEN', 'DOWN', 'UP'].includes(output.rounding.mode)
        || !isNumericType(output.valueType)) {
        throw new PayrollEngineError('ROUNDING_POLICY_INVALID', `Rounding policy is invalid on ${component.code}.${output.name}.`)
      }
    }
  }
  const tracePolicies: readonly string[] = ['FULL', 'OUTPUTS', 'NONE']
  if (!tracePolicies.includes(component.tracePolicy)) {
    throw new PayrollEngineError('TRACE_POLICY_INVALID', `Trace policy is invalid on ${component.code}.`)
  }
  if (component.parameters) {
    for (const [name, parameter] of Object.entries(component.parameters)) {
      if (!name || !parameter || !isValueType(parameter.valueType)) {
        throw new PayrollEngineError('COMPONENT_PARAMETER_INVALID', `Parameter definition is invalid on ${component.code}.`)
      }
      parseExternalValue(parameter.value, parameter.valueType)
    }
  }
}

function validateOwnershipIdentities(components: readonly PayrollComponentDefinition[]): void {
  const codeOwners = new Map<string, { id: string; kind: PayrollComponentDefinition['ownership']['kind'] }>()
  const idOwners = new Map<string, { code: string; kind: PayrollComponentDefinition['ownership']['kind'] }>()
  for (const component of components) {
    const ownership = component.ownership
    if (ownership.kind === 'CUSTOMER_FORK') {
      if (!ownership.origin?.id || !ownership.origin.code || !ownership.origin.version || !isIsoDateTime(ownership.forkedAt)) {
        throw new PayrollEngineError('FORK_ORIGIN_REQUIRED', `Customer fork ${component.code} needs origin identity, version and forkedAt.`)
      }
      if (component.id === ownership.origin.id || component.code === ownership.origin.code) {
        throw new PayrollEngineError('FORK_IDENTITY_NOT_DETACHED', `Fork ${component.code} must have a distinct id and code from its origin.`)
      }
    } else if ('origin' in ownership || 'forkedAt' in ownership) {
      throw new PayrollEngineError('CUSTOMER_CUSTOM_ORIGIN_FORBIDDEN', `${ownership.kind} components cannot carry fork origin metadata.`)
    }
    const priorCode = codeOwners.get(component.code)
    const priorId = idOwners.get(component.id)
    if ((priorCode && (priorCode.id !== component.id || priorCode.kind !== ownership.kind))
      || (priorId && (priorId.code !== component.code || priorId.kind !== ownership.kind))) {
      throw new PayrollEngineError('COMPONENT_IDENTITY_COLLISION', `Component identity ${component.code}/${component.id} is reused across owners or identities.`)
    }
    codeOwners.set(component.code, { id: component.id, kind: ownership.kind })
    idOwners.set(component.id, { code: component.code, kind: ownership.kind })
  }
}

function validateComponentDefinition(component: PayrollComponentDefinition): void {
  const inputByName = new Map(component.inputs.map((input) => [input.name, input]))
  const dependencyByInput = new Map<string, PayrollDependencyDefinition>()
  if (component.dependencies.length > MAX_DEPENDENCIES) throw new PayrollEngineError('DEPENDENCY_COUNT_INVALID', 'Component dependency count exceeds the supported limit.')
  for (const dependency of component.dependencies) {
    if (!dependency.componentCode || !dependency.outputName || !dependency.inputName || dependencyByInput.has(dependency.inputName)) {
      throw new PayrollEngineError('DEPENDENCY_INVALID', `Dependency definition is invalid on ${component.code}.`)
    }
    const targetInput = inputByName.get(dependency.inputName)
    if (!targetInput) throw new PayrollEngineError('DEPENDENCY_INPUT_UNKNOWN', `Dependency targets unknown input ${component.code}.${dependency.inputName}.`)
    dependencyByInput.set(dependency.inputName, dependency)
  }
  for (const input of component.inputs) {
    if (input.required && !dependencyByInput.has(input.name)) {
      throw new PayrollEngineError('DEPENDENCY_REQUIRED', `Required input ${component.code}.${input.name} has no dependency.`)
    }
  }
  validateMethodShape(component, inputByName)
}

function validateMethodShape(
  component: PayrollComponentDefinition,
  inputByName: ReadonlyMap<string, PayrollComponentDefinition['inputs'][number]>,
): void {
  const outputByName = new Map(component.outputs.map((output) => [output.name, output]))
  const method = component.method
  if (method.kind === 'registeredRule') {
    if (component.ownership.kind !== 'SYSTEM') throw new PayrollEngineError('REGISTERED_RULE_SYSTEM_ONLY', 'Registered rules are restricted to system components.')
    if (!method.ruleKey || !method.ruleVersion || !isHash(method.implementationHash) || !isHash(method.parameterSetHash)) {
      throw new PayrollEngineError('REGISTERED_RULE_PIN_INVALID', 'Registered rules require versioned SHA-256 pins.')
    }
    return
  }
  if (method.kind === 'source') {
    if (component.inputs.length !== 0 || component.dependencies.length !== 0 || component.outputs.length !== 1
      || method.path.length === 0 || method.path.some((segment) => typeof segment !== 'string' && (!Number.isInteger(segment) || segment < 0))) {
      throw new PayrollEngineError('SOURCE_COMPONENT_INVALID', `Source component ${component.code} needs one output and a valid source path.`)
    }
    return
  }
  if (method.kind === 'passThrough') {
    const keys = Object.keys(method.outputs).sort()
    if (keys.length !== outputByName.size || keys.some((name) => !outputByName.has(name))) {
      throw new PayrollEngineError('PASSTHROUGH_OUTPUT_INVALID', `Pass-through outputs do not match ${component.code} definitions.`)
    }
    for (const [outputName, inputName] of Object.entries(method.outputs)) {
      const output = outputByName.get(outputName)!
      const input = inputByName.get(inputName)
      if (!input || input.valueType !== output.valueType) {
        throw new PayrollEngineError('PASSTHROUGH_TYPE_MISMATCH', `Pass-through types do not match for ${component.code}.${outputName}.`)
      }
    }
    return
  }
  if (method.kind === 'aggregate') {
    if (component.outputs.length !== 1 || method.inputNames.length === 0 || method.inputNames.length > MAX_COMPONENTS
      || !['SUM', 'MIN', 'MAX'].includes(method.operation)) {
      throw new PayrollEngineError('AGGREGATE_DEFINITION_INVALID', `Aggregate component ${component.code} is invalid.`)
    }
    const output = component.outputs[0]!
    if (!isNumericType(output.valueType)) throw new PayrollEngineError('AGGREGATE_TYPE_INVALID', `Aggregate output on ${component.code} must be numeric.`)
    const inputNames = new Set<string>()
    for (const name of method.inputNames) {
      const input = inputByName.get(name)
      if (!input || !isNumericType(input.valueType) || input.valueType !== output.valueType || inputNames.has(name)) {
        throw new PayrollEngineError('AGGREGATE_INPUT_INVALID', `Aggregate input ${component.code}.${name} is invalid.`)
      }
      inputNames.add(name)
    }
    if (component.dependencies.some((dependency) => !inputNames.has(dependency.inputName))) {
      throw new PayrollEngineError('AGGREGATE_DEPENDENCY_UNUSED', `Aggregate ${component.code} has an unused dependency.`)
    }
    return
  }
  const mappedOutputs = Object.keys(method.outputs).sort()
  if (mappedOutputs.length !== outputByName.size || mappedOutputs.some((name) => !outputByName.has(name))) {
    throw new PayrollEngineError('EXPRESSION_OUTPUT_INVALID', `Expression outputs do not match ${component.code} definitions.`)
  }
}

function validateComponentGraph(
  components: readonly PayrollComponentDefinition[],
  componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>,
): void {
  let dependencyCount = 0
  const edges: { from: string; to: string }[] = []
  for (const component of components) {
    dependencyCount += component.dependencies.length
    if (dependencyCount > MAX_DEPENDENCIES) throw new PayrollEngineError('DEPENDENCY_COUNT_INVALID', 'Payroll graph exceeds the supported dependency limit.')
    for (const dependency of component.dependencies) {
      const upstream = componentsByCode.get(dependency.componentCode)
      if (!upstream) throw new PayrollEngineError('DEPENDENCY_COMPONENT_UNKNOWN', `Dependency component ${dependency.componentCode} does not exist.`)
      const sourceOutput = upstream.outputs.find((output) => output.name === dependency.outputName)
      const targetInput = component.inputs.find((input) => input.name === dependency.inputName)
      if (!sourceOutput) throw new PayrollEngineError('DEPENDENCY_OUTPUT_UNKNOWN', `Dependency output ${dependency.componentCode}.${dependency.outputName} does not exist.`)
      if (!targetInput) throw new PayrollEngineError('DEPENDENCY_INPUT_UNKNOWN', `Dependency input ${component.code}.${dependency.inputName} does not exist.`)
      if (sourceOutput.valueType !== targetInput.valueType) {
        throw new PayrollEngineError('DEPENDENCY_TYPE_MISMATCH', `Dependency ${dependency.componentCode}.${dependency.outputName} cannot feed ${component.code}.${dependency.inputName}.`)
      }
      if (upstream.processingScope !== component.processingScope && component.method.kind !== 'aggregate') {
        throw new PayrollEngineError('DEPENDENCY_SCOPE_MISMATCH', `Cross-scope dependency into ${component.code} requires an aggregate component.`)
      }
      edges.push({ from: dependency.componentCode, to: component.code })
    }
    validateExpressionTypes(component, componentsByCode)
  }
  if (findCycle(components.map((component) => component.code), edges)) {
    throw new PayrollEngineError('DEPENDENCY_CYCLE', 'Payroll component dependencies contain a cycle.')
  }
}

function validateExpressionTypes(
  component: PayrollComponentDefinition,
  componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>,
): void {
  if (component.method.kind !== 'expression') return
  const dependencies = new Set(component.dependencies.map((dependency) => `${dependency.componentCode}\u0000${dependency.outputName}`))
  const inputs = new Map(component.inputs.map((input) => [input.name, input.valueType]))
  const parameters = component.parameters ?? {}
  for (const output of component.outputs) {
    const expression = component.method.outputs[output.name]
    if (!expression) throw new PayrollEngineError('EXPRESSION_OUTPUT_MISSING', `Expression for ${component.code}.${output.name} is missing.`)
    const resultType = inferExpressionType(expression, {
      component,
      componentsByCode,
      inputTypes: inputs,
      parameters,
      dependencies,
      depth: 0,
      budget: { count: 0 },
    })
    if (resultType !== output.valueType) {
      throw new PayrollEngineError('EXPRESSION_OUTPUT_TYPE_MISMATCH', `Expression for ${component.code}.${output.name} is ${resultType}; expected ${output.valueType}.`)
    }
  }
}

function inferExpressionType(
  expression: PayrollExpression,
  context: {
    readonly component: PayrollComponentDefinition | null
    readonly componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>
    readonly inputTypes: ReadonlyMap<string, PayrollValueType>
    readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
    readonly dependencies: ReadonlySet<string>
    readonly depth: number
    readonly budget: { count: number }
  },
): PayrollValueType {
  context.budget.count += 1
  if (context.budget.count > MAX_EXPRESSION_NODES || context.depth > MAX_EXPRESSION_DEPTH) {
    throw new PayrollEngineError('EXPRESSION_BUDGET_EXCEEDED', 'Expression exceeds the supported node or depth budget.')
  }
  const recurse = (node: PayrollExpression) => inferExpressionType(node, { ...context, depth: context.depth + 1 })
  if (expression.kind === 'literal') {
    FixedDecimal.parse(expression.value)
    return expression.valueType
  }
  if (expression.kind === 'boolean') return 'BOOLEAN'
  if (expression.kind === 'string') return 'STRING'
  if (expression.kind === 'input') {
    if (!context.component || !context.inputTypes.has(expression.name)) {
      throw new PayrollEngineError('EXPRESSION_INPUT_UNKNOWN', `Expression input ${expression.name} is unknown.`)
    }
    return context.inputTypes.get(expression.name)!
  }
  if (expression.kind === 'output') {
    if (context.component && !context.dependencies.has(`${expression.componentCode}\u0000${expression.outputName}`)) {
      throw new PayrollEngineError('EXPRESSION_OUTPUT_NOT_DEPENDENCY', `Output reference ${expression.componentCode}.${expression.outputName} is not a declared dependency.`)
    }
    const source = context.componentsByCode.get(expression.componentCode)
    const output = source?.outputs.find((candidate) => candidate.name === expression.outputName)
    if (!output) throw new PayrollEngineError('EXPRESSION_OUTPUT_UNKNOWN', `Expression output ${expression.componentCode}.${expression.outputName} is unknown.`)
    return output.valueType
  }
  if (expression.kind === 'parameter') {
    const parameter = context.parameters[expression.name]
    if (!context.component || !parameter) throw new PayrollEngineError('EXPRESSION_PARAMETER_UNKNOWN', `Expression parameter ${expression.name} is unknown.`)
    return parameter.valueType
  }
  if (expression.kind === 'unary') {
    const operand = recurse(expression.operand)
    if (expression.operator === 'NOT' && operand === 'BOOLEAN') return 'BOOLEAN'
    if (expression.operator === 'ABS' && isNumericType(operand)) return operand
    throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', `Unary ${expression.operator} does not accept ${operand}.`)
  }
  if (expression.kind === 'binary') {
    const left = recurse(expression.left)
    const right = recurse(expression.right)
    if (expression.operator === 'AND' || expression.operator === 'OR') {
      if (left === 'BOOLEAN' && right === 'BOOLEAN') return 'BOOLEAN'
      throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', `${expression.operator} requires Boolean operands.`)
    }
    if (['=', '!='].includes(expression.operator)) {
      if (left === right) return 'BOOLEAN'
      throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', `${expression.operator} requires matching operand types.`)
    }
    if (['>', '>=', '<', '<='].includes(expression.operator)) {
      if (left === right && (isNumericType(left) || left === 'STRING')) return 'BOOLEAN'
      throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', `${expression.operator} requires matching ordered operand types.`)
    }
    if (expression.operator === '+' || expression.operator === '-') {
      if (left === right && isNumericType(left)) return left
      throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', `${expression.operator} requires matching numeric operands.`)
    }
    if (expression.operator === '*') return multiplicationType(left, right)
    if (expression.operator === '/') return divisionType(left, right)
  }
  if (expression.kind === 'ratio') {
    if (!expression.roundingDefinitionId || expression.roundingDefinitionId.length > 128) {
      throw new PayrollEngineError('EXPRESSION_RATIO_ROUNDING_INVALID', 'Rational expressions must reference a bounded rounding-definition id.')
    }
    return divisionType(recurse(expression.numerator), recurse(expression.denominator))
  }
  if (expression.kind === 'if') {
    if (recurse(expression.condition) !== 'BOOLEAN') throw new PayrollEngineError('EXPRESSION_IF_CONDITION_INVALID', 'IF condition must be Boolean.')
    const thenType = recurse(expression.then)
    const elseType = recurse(expression.else)
    if (thenType !== elseType) throw new PayrollEngineError('EXPRESSION_IF_BRANCH_MISMATCH', 'IF branches must have the same type.')
    return thenType
  }
  if (expression.kind === 'call') {
    if (expression.operator === 'ABS') {
      if (expression.arguments.length !== 1) throw new PayrollEngineError('EXPRESSION_ARGUMENT_COUNT_INVALID', 'ABS needs one argument.')
      const type = recurse(expression.arguments[0]!)
      if (!isNumericType(type)) throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', 'ABS needs a numeric argument.')
      return type
    }
    if (expression.operator === 'ROUND') {
      if (expression.arguments.length !== 2) throw new PayrollEngineError('EXPRESSION_ARGUMENT_COUNT_INVALID', 'ROUND needs a value and a scale.')
      const valueType = recurse(expression.arguments[0]!)
      const scaleType = recurse(expression.arguments[1]!)
      if (!isNumericType(valueType) || scaleType !== 'DECIMAL') throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', 'ROUND needs a numeric value and decimal scale.')
      return valueType
    }
    if (expression.arguments.length === 0) throw new PayrollEngineError('EXPRESSION_ARGUMENT_COUNT_INVALID', `${expression.operator} needs at least one argument.`)
    const types = expression.arguments.map(recurse)
    if (!types.every((type) => type === types[0] && isNumericType(type))) {
      throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', `${expression.operator} needs matching numeric arguments.`)
    }
    return types[0]!
  }
  throw new PayrollEngineError('EXPRESSION_NODE_INVALID', 'Expression node kind is unsupported.')
}

function validateControls(
  controls: readonly PayrollControlDefinition[],
  componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>,
): void {
  const seenCodes = new Set<string>()
  for (const control of controls) {
    if (!control.code || seenCodes.has(control.code) || !['BLOCKING', 'WARNING'].includes(control.severity)) {
      throw new PayrollEngineError('CONTROL_DEFINITION_INVALID', `Control ${control.code} is invalid or duplicated.`)
    }
    seenCodes.add(control.code)
    const resultType = inferExpressionType(control.expression, {
      component: null,
      componentsByCode,
      inputTypes: new Map(),
      parameters: {},
      dependencies: new Set(),
      depth: 0,
      budget: { count: 0 },
    })
    if (resultType !== 'BOOLEAN') throw new PayrollEngineError('CONTROL_EXPRESSION_TYPE_INVALID', `Control ${control.code} must return Boolean.`)
  }
}

function validateResultMappings(
  mappings: readonly PayrollResultMapping[],
  componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>,
): void {
  const seenKeys = new Set<string>()
  for (const mapping of mappings) {
    if (!mapping.key || seenKeys.has(mapping.key)) throw new PayrollEngineError('RESULT_MAPPING_DUPLICATE', `Result mapping key ${mapping.key} is empty or duplicated.`)
    seenKeys.add(mapping.key)
    const output = componentsByCode.get(mapping.componentCode)?.outputs.find((candidate) => candidate.name === mapping.outputName)
    if (!output) throw new PayrollEngineError('RESULT_MAPPING_OUTPUT_UNKNOWN', `Result mapping ${mapping.key} references an unknown component output.`)
  }
}

function topologicalOrder(
  components: readonly PayrollComponentDefinition[],
  componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>,
): PayrollComponentDefinition[] {
  const incoming = new Map(components.map((component) => [component.code, 0]))
  const consumers = new Map<string, string[]>()
  for (const component of components) {
    for (const dependency of component.dependencies) {
      incoming.set(component.code, (incoming.get(component.code) ?? 0) + 1)
      const list = consumers.get(dependency.componentCode) ?? []
      list.push(component.code)
      consumers.set(dependency.componentCode, list)
    }
  }
  const ready = components.filter((component) => incoming.get(component.code) === 0).map((component) => component.code).sort()
  const result: PayrollComponentDefinition[] = []
  while (ready.length > 0) {
    const code = ready.shift()!
    const component = componentsByCode.get(code)
    if (!component) throw new PayrollEngineError('COMPONENT_NOT_FOUND', `Component ${code} was not found.`)
    result.push(component)
    for (const consumer of (consumers.get(code) ?? []).sort()) {
      const nextIncoming = (incoming.get(consumer) ?? 0) - 1
      incoming.set(consumer, nextIncoming)
      if (nextIncoming === 0) {
        ready.push(consumer)
        ready.sort()
      }
    }
  }
  if (result.length !== components.length) throw new PayrollEngineError('DEPENDENCY_CYCLE', 'Payroll component dependencies contain a cycle.')
  return result
}

function findCycle(codes: readonly string[], edges: readonly { from: string; to: string }[]): boolean {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? []
    list.push(edge.to)
    outgoing.set(edge.from, list)
  }
  const state = new Map<string, 0 | 1 | 2>()
  const visit = (code: string): boolean => {
    const current = state.get(code) ?? 0
    if (current === 1) return true
    if (current === 2) return false
    state.set(code, 1)
    for (const next of outgoing.get(code) ?? []) if (visit(next)) return true
    state.set(code, 2)
    return false
  }
  return codes.some((code) => visit(code))
}

function evaluateExpression(expression: PayrollExpression, context: ExpressionContext, budget = { count: 0 }, depth = 0): RuntimeValue {
  budget.count += 1
  if (budget.count > MAX_EXPRESSION_NODES || depth > MAX_EXPRESSION_DEPTH) {
    throw new PayrollEngineError('EXPRESSION_BUDGET_EXCEEDED', 'Expression exceeds the supported node or depth budget.')
  }
  const recurse = (node: PayrollExpression) => evaluateExpression(node, context, budget, depth + 1)
  if (expression.kind === 'literal') return { valueType: expression.valueType, value: FixedDecimal.parse(expression.value) }
  if (expression.kind === 'boolean') return { valueType: 'BOOLEAN', value: expression.value }
  if (expression.kind === 'string') return { valueType: 'STRING', value: expression.value }
  if (expression.kind === 'input') {
    if (!context.allowInputs) throw new PayrollEngineError('EXPRESSION_INPUT_FORBIDDEN', 'Control expressions cannot reference component inputs.')
    const value = context.localInputs[expression.name]
    if (!value) throw new PayrollEngineError('EXPRESSION_INPUT_MISSING', `Expression input ${expression.name} is missing.`)
    return value
  }
  if (expression.kind === 'output') {
    const value = context.componentOutputs.get(expression.componentCode)?.[expression.outputName]
    if (!value) throw new PayrollEngineError('EXPRESSION_OUTPUT_VALUE_MISSING', `Expression output ${expression.componentCode}.${expression.outputName} is missing.`)
    return value
  }
  if (expression.kind === 'parameter') {
    if (!context.allowParameters || !context.component) throw new PayrollEngineError('EXPRESSION_PARAMETER_FORBIDDEN', 'This expression cannot reference component parameters.')
    const parameter = context.component.parameters?.[expression.name]
    if (!parameter) throw new PayrollEngineError('EXPRESSION_PARAMETER_MISSING', `Expression parameter ${expression.name} is missing.`)
    return parseExternalValue(parameter.value, parameter.valueType)
  }
  if (expression.kind === 'unary') {
    const operand = recurse(expression.operand)
    if (expression.operator === 'NOT') return { valueType: 'BOOLEAN', value: !asBoolean(operand) }
    return { valueType: operand.valueType, value: asDecimal(operand).abs() }
  }
  if (expression.kind === 'binary') {
    const left = recurse(expression.left)
    if (expression.operator === 'AND' && !asBoolean(left)) return { valueType: 'BOOLEAN', value: false }
    if (expression.operator === 'OR' && asBoolean(left)) return { valueType: 'BOOLEAN', value: true }
    const right = recurse(expression.right)
    return evaluateBinary(expression.operator, left, right)
  }
  if (expression.kind === 'ratio') {
    const numerator = recurse(expression.numerator)
    const denominator = recurse(expression.denominator)
    const definition = context.roundingDefinitions.find((candidate) => candidate.id === expression.roundingDefinitionId)
    if (!context.component || !definition || definition.componentCode !== context.component.code
      || definition.ruleVersion !== context.component.version) {
      throw new PayrollEngineError('EXPRESSION_RATIO_ROUNDING_UNAVAILABLE', 'The pinned ratio rounding definition is missing or does not match this component version.')
    }
    return {
      valueType: divisionType(numerator.valueType, denominator.valueType),
      value: applyPayrollRoundingToRatio(asDecimal(numerator), asDecimal(denominator), definition),
    }
  }
  if (expression.kind === 'if') {
    return asBoolean(recurse(expression.condition)) ? recurse(expression.then) : recurse(expression.else)
  }
  if (expression.kind === 'call') {
    const arguments_ = expression.arguments.map(recurse)
    if (expression.operator === 'ABS') return { valueType: arguments_[0]!.valueType, value: asDecimal(arguments_[0]!).abs() }
    if (expression.operator === 'ROUND') {
      const scale = asDecimal(arguments_[1]!).toBigIntExact()
      if (scale < BigInt(0) || scale > BigInt(36)) throw new PayrollEngineError('EXPRESSION_ROUND_SCALE_INVALID', 'ROUND scale must be between 0 and 36.')
      return { valueType: arguments_[0]!.valueType, value: asDecimal(arguments_[0]!).round(Number(scale), 'HALF_UP') }
    }
    const values = arguments_.map(asDecimal)
    let selected = values[0]!
    for (const candidate of values.slice(1)) {
      const comparison = candidate.compare(selected)
      if ((expression.operator === 'MIN' && comparison < 0) || (expression.operator === 'MAX' && comparison > 0)) selected = candidate
    }
    return { valueType: arguments_[0]!.valueType, value: selected }
  }
  throw new PayrollEngineError('EXPRESSION_NODE_INVALID', 'Expression node kind is unsupported.')
}

function evaluateBinary(
  operator: Extract<PayrollExpression, { kind: 'binary' }>['operator'],
  left: RuntimeValue,
  right: RuntimeValue,
): RuntimeValue {
  if (operator === 'AND') return { valueType: 'BOOLEAN', value: asBoolean(left) && asBoolean(right) }
  if (operator === 'OR') return { valueType: 'BOOLEAN', value: asBoolean(left) || asBoolean(right) }
  if (operator === '=' || operator === '!=') {
    const equal = left.valueType === right.valueType && compareRuntime(left, right) === 0
    return { valueType: 'BOOLEAN', value: operator === '=' ? equal : !equal }
  }
  if (operator === '>' || operator === '>=' || operator === '<' || operator === '<=') {
    const comparison = compareRuntime(left, right)
    const value = operator === '>' ? comparison > 0
      : operator === '>=' ? comparison >= 0
        : operator === '<' ? comparison < 0
          : comparison <= 0
    return { valueType: 'BOOLEAN', value }
  }
  const leftDecimal = asDecimal(left)
  const rightDecimal = asDecimal(right)
  if (operator === '+') return { valueType: left.valueType, value: leftDecimal.add(rightDecimal) }
  if (operator === '-') return { valueType: left.valueType, value: leftDecimal.subtract(rightDecimal) }
  if (operator === '*') {
    if (left.valueType === 'PERCENTAGE') {
      return { valueType: right.valueType, value: leftDecimal.multiply(rightDecimal).divideExact(FixedDecimal.fromInteger(BigInt(100))) }
    }
    if (right.valueType === 'PERCENTAGE') {
    return { valueType: left.valueType, value: leftDecimal.multiply(rightDecimal).divideExact(FixedDecimal.fromInteger(BigInt(100))) }
    }
    return { valueType: multiplicationType(left.valueType, right.valueType), value: leftDecimal.multiply(rightDecimal) }
  }
  return { valueType: divisionType(left.valueType, right.valueType), value: leftDecimal.divideExact(rightDecimal) }
}

function aggregate(operation: 'SUM' | 'MIN' | 'MAX', values: readonly (RuntimeValue | undefined)[]): RuntimeValue {
  const resolvedValues = values.filter((value): value is RuntimeValue => value !== undefined)
  if (values.length === 0 || resolvedValues.length !== values.length) {
    throw new PayrollEngineError('AGGREGATE_INPUT_MISSING', 'Aggregate inputs must resolve to values.')
  }
  const first = resolvedValues[0]!
  const decimals = resolvedValues.map(asDecimal)
  if (operation === 'SUM') return {
    valueType: first.valueType,
    value: decimals.reduce((total, value) => total.add(value), FixedDecimal.fromInteger(BigInt(0))),
  }
  return {
    valueType: first.valueType,
    value: decimals.slice(1).reduce((selected, candidate) => {
      const comparison = candidate.compare(selected)
      return operation === 'MIN' ? comparison < 0 ? candidate : selected : comparison > 0 ? candidate : selected
    }, decimals[0]!),
  }
}

function evaluateControls(
  controls: readonly PayrollControlDefinition[],
  componentsByCode: ReadonlyMap<string, PayrollComponentDefinition>,
  outputsByCode: ReadonlyMap<string, Readonly<Record<string, RuntimeValue>>>,
  roundingDefinitions: readonly PayrollRoundingDefinition[],
): PayrollControlResult[] {
  return controls.map((control) => {
    const actual = evaluateExpression(control.expression, {
      component: null,
      componentsByCode,
      localInputs: {},
      componentOutputs: outputsByCode,
      allowInputs: false,
      allowParameters: false,
      roundingDefinitions,
    })
    const passed = actual.valueType === 'BOOLEAN' && actual.value === true
    const status: PayrollControlResult['status'] = passed ? 'PASS' : control.severity === 'WARNING' ? 'WARNING' : 'FAIL'
    return {
      code: control.code,
      status,
      actual: typeof actual.value === 'boolean' ? actual.value : serializeValue(actual).value,
      expected: true,
    }
  }).sort((left, right) => left.code.localeCompare(right.code))
}

function mapResultRows(
  mappings: readonly PayrollResultMapping[],
  outputsByCode: ReadonlyMap<string, Readonly<Record<string, RuntimeValue>>>,
): PayrollCalculationResultRow[] {
  return mappings.map((mapping) => {
    const value = outputsByCode.get(mapping.componentCode)?.[mapping.outputName]
    if (!value) throw new PayrollEngineError('RESULT_MAPPING_VALUE_MISSING', `Result mapping ${mapping.key} has no calculated value.`)
    return {
      key: mapping.key,
      componentCode: mapping.componentCode,
      outputName: mapping.outputName,
      ...serializeValue(value),
    }
  })
}

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function validatePackageMetadata(metadata: PayrollRulePackageMetadata): void {
  if (!isPlainRecord(metadata) || typeof metadata.packageId !== 'string' || !metadata.packageId || metadata.packageId.length > 128
    || typeof metadata.version !== 'string' || !metadata.version || metadata.version.length > 128
    || !isHash(metadata.packageHash) || !isHash(metadata.parameterSetHash)
    || !isPlainRecord(metadata.sourceMetadata) || Object.entries(metadata.sourceMetadata).length > 128
    || Object.entries(metadata.sourceMetadata).some(([key, value]) => !key || key.length > 128 || typeof value !== 'string' || value.length > MAX_REGISTERED_RULE_TEXT_LENGTH)) {
    throw new PayrollEngineError('RULE_PACKAGE_METADATA_INVALID', 'Rule package metadata requires versioned hashes and source references.')
  }
}

function selectEffectiveRoundingDefinitions(
  definitions: readonly PayrollRoundingDefinition[],
  allComponents: readonly PayrollComponentDefinition[],
  activeComponents: readonly PayrollComponentDefinition[],
  metadata: PayrollRulePackageMetadata | undefined,
  effectiveDate: string,
): readonly PayrollRoundingDefinition[] {
  if (definitions.length > MAX_ROUNDING_DEFINITIONS) {
    throw new PayrollEngineError('ROUNDING_DEFINITION_COUNT_INVALID', 'Rule package has too many rounding definitions.')
  }
  if (definitions.length > 0 && !metadata) {
    throw new PayrollEngineError('ROUNDING_PACKAGE_PROVENANCE_REQUIRED', 'Versioned rounding definitions require rule package provenance.')
  }
  const ids = new Set<string>()
  for (const definition of definitions) {
    if (!metadata || !isPlainRecord(definition) || typeof definition.id !== 'string' || ids.has(definition.id)) {
      throw new PayrollEngineError('ROUNDING_DEFINITION_ID_INVALID', 'Rounding definitions require unique ids and package provenance.')
    }
    ids.add(definition.id)
    validateRoundingDefinition(definition, metadata)
  }
  const sorted = sortRoundingDefinitions(definitions)
  for (let index = 0; index < sorted.length; index += 1) {
    const definition = sorted[index]!
    const component = allComponents.find((candidate) => candidate.code === definition.componentCode
      && candidate.version === definition.ruleVersion)
    if (!component || definition.effectiveFrom < component.effectiveFrom
      || (component.effectiveTo !== null && (definition.effectiveTo === null || definition.effectiveTo > component.effectiveTo))) {
      throw new PayrollEngineError('ROUNDING_RULE_VERSION_MISMATCH', 'Rounding definitions must fit an effective registered component version.')
    }
    for (let otherIndex = index + 1; otherIndex < sorted.length; otherIndex += 1) {
      const other = sorted[otherIndex]!
      if (other.componentCode !== definition.componentCode || other.ruleVersion !== definition.ruleVersion || other.stage !== definition.stage) continue
      const overlaps = (definition.effectiveTo === null || definition.effectiveTo >= other.effectiveFrom)
        && (other.effectiveTo === null || other.effectiveTo >= definition.effectiveFrom)
      if (overlaps) throw new PayrollEngineError('ROUNDING_DEFINITION_OVERLAP', 'Rounding definitions for the same stage cannot overlap.')
    }
  }
  return deepFreeze(sorted.filter((definition) => definition.effectiveFrom <= effectiveDate
    && (definition.effectiveTo === null || effectiveDate <= definition.effectiveTo)
    && activeComponents.some((component) => component.code === definition.componentCode
      && component.version === definition.ruleVersion)))
}

function validateComponentRoundingReferences(
  components: readonly PayrollComponentDefinition[],
  roundingDefinitions: readonly PayrollRoundingDefinition[],
): void {
  const visit = (component: PayrollComponentDefinition, expression: PayrollExpression): void => {
    if (expression.kind === 'ratio') {
      const matches = roundingDefinitions.filter((definition) => definition.id === expression.roundingDefinitionId)
      if (matches.length !== 1 || matches[0]!.componentCode !== component.code || matches[0]!.ruleVersion !== component.version) {
        throw new PayrollEngineError('EXPRESSION_RATIO_ROUNDING_UNAVAILABLE', 'Each ratio expression must reference exactly one effective rounding definition pinned to its component version.')
      }
      visit(component, expression.numerator)
      visit(component, expression.denominator)
      return
    }
    if (expression.kind === 'unary') visit(component, expression.operand)
    else if (expression.kind === 'binary') {
      visit(component, expression.left)
      visit(component, expression.right)
    } else if (expression.kind === 'if') {
      visit(component, expression.condition)
      visit(component, expression.then)
      visit(component, expression.else)
    } else if (expression.kind === 'call') {
      for (const argument of expression.arguments) visit(component, argument)
    }
  }

  for (const component of components) {
    if (component.method.kind !== 'expression') continue
    for (const expression of Object.values(component.method.outputs)) visit(component, expression)
  }
}

function validateActiveRoundingDefinitions(
  definitions: readonly PayrollRoundingDefinition[],
  activeComponents: readonly PayrollComponentDefinition[],
  metadata: PayrollRulePackageMetadata | undefined,
  effectiveDate: string,
): readonly PayrollRoundingDefinition[] {
  const selected = selectEffectiveRoundingDefinitions(definitions, activeComponents, activeComponents, metadata, effectiveDate)
  if (selected.length !== definitions.length) {
    throw new PayrollEngineError('ROUNDING_DEFINITION_INACTIVE', 'Calculation input contains an inactive rounding definition.')
  }
  return selected
}

function validateRoundingDefinition(definition: PayrollRoundingDefinition, metadata: PayrollRulePackageMetadata): void {
  const validModes: readonly string[] = ['ARITHMETIC', 'FLOOR', 'CEILING', 'TRUNCATE', 'ROUND_DOWN_TO_MULTIPLE', 'NO_ROUNDING']
  if (!isPlainRecord(definition) || typeof definition.id !== 'string' || !definition.id || definition.id.length > 128
    || typeof definition.componentCode !== 'string' || !definition.componentCode
    || typeof definition.stage !== 'string' || !definition.stage || definition.stage.length > 128
    || definition.packageId !== metadata.packageId || definition.packageVersion !== metadata.version
    || typeof definition.ruleVersion !== 'string' || !definition.ruleVersion
    || !validModes.includes(definition.mode)
    || !isIsoDate(definition.effectiveFrom)
    || (definition.effectiveTo !== null && !isIsoDate(definition.effectiveTo))
    || (definition.effectiveTo !== null && definition.effectiveTo < definition.effectiveFrom)
    || !isPlainRecord(definition.provenance)
    || typeof definition.provenance.sourceReference !== 'string' || !definition.provenance.sourceReference
    || definition.provenance.sourceReference.length > MAX_REGISTERED_RULE_TEXT_LENGTH
    || !isHash(definition.provenance.sourceHash)) {
    throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'Rounding definition identity, dates, mode or provenance are invalid.')
  }
  if (definition.mode === 'NO_ROUNDING') {
    if (definition.decimalPlaces !== undefined || definition.targetMultiple !== undefined) {
      throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'No-rounding definitions cannot specify precision.')
    }
    return
  }
  if (definition.mode === 'ROUND_DOWN_TO_MULTIPLE') {
    if (definition.decimalPlaces !== undefined || typeof definition.targetMultiple !== 'string') {
      throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'Round-down-to-multiple requires a target multiple only.')
    }
    if (FixedDecimal.parse(definition.targetMultiple).coefficient <= BigInt(0)) {
      throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'Rounding target multiple must be positive.')
    }
    return
  }
  if (definition.targetMultiple !== undefined || !Number.isInteger(definition.decimalPlaces)
    || definition.decimalPlaces! < 0 || definition.decimalPlaces! > 36) {
    throw new PayrollEngineError('ROUNDING_DEFINITION_INVALID', 'This rounding mode requires decimal places only.')
  }
}

function sortRoundingDefinitions(definitions: readonly PayrollRoundingDefinition[]): PayrollRoundingDefinition[] {
  return [...definitions].sort((left, right) => left.componentCode.localeCompare(right.componentCode)
    || left.ruleVersion.localeCompare(right.ruleVersion)
    || left.stage.localeCompare(right.stage)
    || left.effectiveFrom.localeCompare(right.effectiveFrom)
    || left.id.localeCompare(right.id))
}

function normalizeScopeInstanceIds(
  value: Readonly<Partial<Record<PayrollProcessingScope, string>>> | undefined,
): Readonly<Partial<Record<PayrollProcessingScope, string>>> | undefined {
  if (value === undefined) return undefined
  const copied = cloneAndFreezePlain(value)
  if (!isPlainRecord(copied)) throw new PayrollEngineError('SCOPE_INSTANCE_IDS_INVALID', 'Scope instance ids must be a plain record.')
  const validScopes: readonly PayrollProcessingScope[] = [
    'EMPLOYMENT', 'PAYROLL_RUN', 'INCOME_RELATIONSHIP', 'ASSESSMENT_BASE_GROUP', 'EMPLOYEE', 'PAYROLL_PERIOD', 'EMPLOYER',
  ]
  const entries = Object.entries(copied)
  for (const [scope, instanceId] of entries) {
    if (!validScopes.includes(scope as PayrollProcessingScope) || typeof instanceId !== 'string'
      || instanceId.trim().length === 0 || instanceId.length > MAX_SCOPE_INSTANCE_ID_LENGTH
      || /[\u0000-\u001f\u007f]/.test(instanceId)) {
      throw new PayrollEngineError('SCOPE_INSTANCE_IDS_INVALID', 'Scope instance ids must use known scopes and bounded opaque identities.')
    }
  }
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right))) as Readonly<Partial<Record<PayrollProcessingScope, string>>>
}

function nodeIdentity(component: PayrollComponentDefinition, scopeInstanceId: string): PayrollScopedNodeIdentity {
  return {
    componentCode: component.code,
    componentVersion: component.version,
    scopeKind: component.processingScope,
    scopeInstanceId,
  }
}

function rulePackageProvenance(metadata: PayrollRulePackageMetadata): PayrollRulePackageProvenance {
  return {
    packageId: metadata.packageId,
    version: metadata.version,
    packageHash: metadata.packageHash,
    parameterSetHash: metadata.parameterSetHash,
  }
}

function executeRegisteredRule(
  component: PayrollComponentDefinition,
  metadata: PayrollRulePackageMetadata | undefined,
  localInputs: Readonly<Record<string, RuntimeValue>>,
  registry: readonly PayrollRegisteredRule[],
  roundingDefinitions: readonly PayrollRoundingDefinition[],
): { readonly outputs: Readonly<Record<string, PayrollSerializedValue>>; readonly trace: readonly PayrollRegisteredRuleTraceStep[] } {
  const method = component.method
  if (method.kind !== 'registeredRule' || component.ownership.kind !== 'SYSTEM') {
    throw new PayrollEngineError('REGISTERED_RULE_SYSTEM_ONLY', 'Registered rules are restricted to system components.')
  }
  if (!metadata) throw new PayrollEngineError('REGISTERED_RULE_PACKAGE_REQUIRED', 'Registered rules require package provenance.')
  validatePackageMetadata(metadata)
  const sameRuleVersion = registry.filter((rule) => rule.ruleKey === method.ruleKey && rule.ruleVersion === method.ruleVersion)
  const candidates = sameRuleVersion.filter((rule) => rule.implementationHash === method.implementationHash
    && rule.parameterSetHash === method.parameterSetHash
    && rule.packageId === metadata.packageId && rule.packageVersion === metadata.version)
  if (candidates.length !== 1) {
    if (candidates.length > 1) throw new PayrollEngineError('REGISTERED_RULE_UNAVAILABLE', 'Exactly one pinned trusted rule must be registered.')
    if (sameRuleVersion.length > 0) throw new PayrollEngineError('REGISTERED_RULE_IDENTITY_MISMATCH', 'Trusted rule pins do not match the component and package.')
    throw new PayrollEngineError('REGISTERED_RULE_UNAVAILABLE', 'Exactly one pinned trusted rule must be registered.')
  }
  const rule = candidates[0]!
  if (metadata.parameterSetHash !== method.parameterSetHash
    || sha256(stableSerialize(component.parameters ?? {})) !== method.parameterSetHash
    || !Array.isArray(rule.allowedComponents)
    || !rule.allowedComponents.some((allowed) => allowed?.id === component.id && allowed?.code === component.code && allowed?.version === component.version)) {
    throw new PayrollEngineError('REGISTERED_RULE_IDENTITY_MISMATCH', 'Trusted rule, parameters and component identity do not match the pinned package.')
  }
  const normalizeSchema = (definitions: readonly { readonly name: string }[]) => [...definitions].sort((left, right) => left.name.localeCompare(right.name))
  if (stableSerialize(normalizeSchema(rule.inputs)) !== stableSerialize(normalizeSchema(component.inputs))
    || stableSerialize(normalizeSchema(rule.outputs)) !== stableSerialize(normalizeSchema(component.outputs))) {
    throw new PayrollEngineError('REGISTERED_RULE_SCHEMA_MISMATCH', 'Trusted rule schemas do not match the component contract.')
  }
  const declaredInputs: Record<string, PayrollSerializedValue> = {}
  for (const definition of component.inputs) {
    const value = localInputs[definition.name]
    if (!value) {
      if (definition.required) throw new PayrollEngineError('COMPONENT_INPUT_MISSING', 'A required registered rule input is missing.')
      continue
    }
    if (value.valueType !== definition.valueType) throw new PayrollEngineError('REGISTERED_RULE_INPUT_TYPE_MISMATCH', 'Registered rule input type does not match its declaration.')
    declaredInputs[definition.name] = serializeValue(value)
  }
  const execution = rule.execute(cloneAndFreezePlain({
    inputs: declaredInputs,
    parameters: component.parameters ?? {},
    ...(roundingDefinitions.length > 0 ? { roundingDefinitions } : {}),
  }))
  // Reject Promises, arbitrary class instances, cycles and over-budget data before reading output values.
  if (isThenable(execution)) {
    if (execution instanceof Promise) void execution.catch(() => undefined)
    throw new PayrollEngineError('REGISTERED_RULE_ASYNC_UNSUPPORTED', 'Registered rules must return synchronously.')
  }
  const result = cloneAndFreezePlain(execution)
  if (!isPlainRecord(result) || !isPlainRecord(result.outputs) || !Array.isArray(result.trace)
    || result.trace.length > MAX_REGISTERED_RULE_TRACE_STEPS || Object.keys(result).some((key) => key !== 'outputs' && key !== 'trace')) {
    throw new PayrollEngineError('REGISTERED_RULE_RESULT_INVALID', 'Registered rules must synchronously return bounded plain typed data.')
  }
  const outputNames = component.outputs.map((definition) => definition.name)
  if (Object.keys(result.outputs).length !== outputNames.length || Object.keys(result.outputs).some((name) => !outputNames.includes(name))) {
    throw new PayrollEngineError('REGISTERED_RULE_OUTPUT_INVALID', 'Registered rule outputs must exactly match the declared contract.')
  }
  for (const definition of component.outputs) {
    const value = result.outputs[definition.name]
    if (!value || !isPlainRecord(value) || value.valueType !== definition.valueType
      || Object.keys(value).some((key) => key !== 'valueType' && key !== 'value')
      || (typeof value.value === 'string' && value.value.length > MAX_REGISTERED_RULE_TEXT_LENGTH)) {
      throw new PayrollEngineError('REGISTERED_RULE_OUTPUT_TYPE_MISMATCH', 'Registered rule output type does not match its declaration.')
    }
    parseSerializedValue(value)
  }
  let traceTextLength = 0
  for (const step of result.trace) {
    if (!isPlainRecord(step) || typeof step.code !== 'string' || !step.code || step.code.length > 128
      || typeof step.sourceReference !== 'string' || !step.sourceReference || step.sourceReference.length > MAX_REGISTERED_RULE_TEXT_LENGTH
      || !isPlainRecord(step.values) || Object.keys(step.values).length > MAX_REGISTERED_RULE_TRACE_VALUES
      || Object.keys(step).some((key) => !['code', 'values', 'sourceReference'].includes(key))) {
      throw new PayrollEngineError('REGISTERED_RULE_TRACE_INVALID', 'Registered rule trace must contain bounded steps and source references.')
    }
    traceTextLength += step.code.length + step.sourceReference.length
    for (const value of Object.values(step.values)) {
      if (!isPlainRecord(value) || typeof value.valueType !== 'string' || !['MONEY', 'DECIMAL', 'PERCENTAGE', 'BOOLEAN', 'STRING'].includes(value.valueType)
        || Object.keys(value).some((key) => key !== 'valueType' && key !== 'value')
        || Object.keys(step.values).some((key) => !key || key.length > 128)
        || (typeof value.value === 'string' && value.value.length > MAX_REGISTERED_RULE_TEXT_LENGTH)) throw new PayrollEngineError('REGISTERED_RULE_TRACE_INVALID', 'Trace values must be bounded and typed.')
      parseExternalValue(value.value, value.valueType as PayrollValueType)
      traceTextLength += typeof value.value === 'string' ? value.value.length : 0
    }
    traceTextLength += Object.keys(step.values).reduce((sum, key) => sum + key.length, 0)
    if (traceTextLength > MAX_REGISTERED_RULE_TRACE_TEXT_LENGTH) {
      throw new PayrollEngineError('REGISTERED_RULE_TRACE_INVALID', 'Registered rule trace exceeds the supported text budget.')
    }
  }
  return result
}

function parseExternalValue(value: unknown, valueType: PayrollValueType): RuntimeValue {
  if (isNumericType(valueType)) {
    if (typeof value !== 'string') {
      throw new PayrollEngineError('EXACT_DECIMAL_STRING_REQUIRED', 'Money and decimal values must be supplied as exact decimal strings, never JavaScript numbers.')
    }
    return { valueType, value: FixedDecimal.parse(value) }
  }
  if (valueType === 'BOOLEAN' && typeof value === 'boolean') return { valueType, value }
  if (valueType === 'STRING' && typeof value === 'string') return { valueType, value }
  throw new PayrollEngineError('VALUE_TYPE_MISMATCH', `Value does not match declared type ${valueType}.`)
}

function parseSerializedValue(value: PayrollSerializedValue): RuntimeValue {
  return parseExternalValue(value.value, value.valueType)
}

function serializeValue(value: RuntimeValue): PayrollSerializedValue {
  return {
    valueType: value.valueType,
    value: value.value instanceof FixedDecimal ? value.value.toString(value.value.scale) : value.value,
  }
}

function roundRuntimeValue(value: RuntimeValue, scale: number, mode: 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP'): RuntimeValue {
  if (!isNumericType(value.valueType)) throw new PayrollEngineError('ROUNDING_TYPE_INVALID', 'Only numeric values can be rounded.')
  return { valueType: value.valueType, value: asDecimal(value).round(scale, mode) }
}

function readPath(source: unknown, path: readonly (string | number)[]): unknown {
  let current = source
  for (const segment of path) {
    if (Array.isArray(current) && typeof segment === 'number') current = current[segment]
    else if (isPlainRecord(current) && typeof segment === 'string') current = current[segment]
    else return undefined
  }
  return current
}

function validateSnapshotCloneSafe(value: unknown): void {
  const active = new WeakSet<object>()
  let count = 0
  const visit = (current: unknown, depth: number): void => {
    count += 1
    if (count > MAX_RULE_DATA_NODES || depth > MAX_RULE_DATA_DEPTH) {
      throw new PayrollEngineError('SOURCE_SNAPSHOT_BUDGET_EXCEEDED', 'Source snapshot exceeds the supported depth or node budget.')
    }
    if (current === null || current === undefined || typeof current === 'string' || typeof current === 'boolean') return
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new PayrollEngineError('SOURCE_SNAPSHOT_INVALID', 'Source snapshot contains a non-finite number.')
      return
    }
    if (Array.isArray(current) || isPlainRecord(current)) {
      const object = current as object
      if (active.has(object)) throw new PayrollEngineError('SOURCE_SNAPSHOT_CYCLE', 'Cyclic source data is not supported.')
      active.add(object)
      try {
        const children = Array.isArray(current) ? current : Object.values(current)
        for (const child of children) visit(child, depth + 1)
      } finally {
        active.delete(object)
      }
      return
    }
    throw new PayrollEngineError('SOURCE_SNAPSHOT_INVALID', 'Source snapshot contains an unsupported value.')
  }
  visit(value, 0)
}

function cloneAndFreezePlain<T>(value: T): T {
  const cloned = clonePlain(value, { count: 0, active: new WeakSet<object>() }, 0)
  return deepFreeze(cloned)
}

function clonePlain<T>(
  value: T,
  budget: { count: number; active: WeakSet<object> },
  depth: number,
): T {
  budget.count += 1
  if (budget.count > MAX_RULE_DATA_NODES || depth > MAX_RULE_DATA_DEPTH) {
    throw new PayrollEngineError('RULE_DATA_BUDGET_EXCEEDED', 'Rule or source data exceeds the supported depth or node budget.')
  }
  if (Array.isArray(value) || isPlainRecord(value)) {
    const source = value as object
    if (budget.active.has(source)) throw new PayrollEngineError('RULE_DATA_CYCLE', 'Cyclic rule or source data is not supported.')
    budget.active.add(source)
    try {
      if (Array.isArray(value)) {
        return value.map((child) => clonePlain(child, budget, depth + 1)) as T
      }
      const cloned: Record<string, unknown> = {}
      for (const key of Object.keys(value).sort()) {
        const child = (value as Record<string, unknown>)[key]
        if (child !== undefined) cloned[key] = clonePlain(child, budget, depth + 1)
      }
      return cloned as T
    } finally {
      budget.active.delete(source)
    }
  }
  if (value !== null && typeof value === 'object') {
    throw new PayrollEngineError('RULE_DATA_INVALID', 'Only plain records and arrays are supported in rule data.')
  }
  return value
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const child of value) deepFreeze(child)
    return Object.freeze(value)
  }
  if (isPlainRecord(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    return Object.freeze(value)
  }
  return value
}

function validateSnapshotIdentityWithPayload(snapshot: PayrollSourceSnapshot): void {
  validateSnapshotIdentity(snapshot)
  validateSnapshotCloneSafe(snapshot)
}

function normalizeComponentForHash(component: PayrollComponentDefinition): PayrollComponentDefinition {
  const normalized = clonePlain(component, { count: 0, active: new WeakSet<object>() }, 0)
  return {
    ...normalized,
    inputs: [...normalized.inputs].sort((left, right) => left.name.localeCompare(right.name)),
    outputs: [...normalized.outputs].sort((left, right) => left.name.localeCompare(right.name)),
    dependencies: [...normalized.dependencies].sort(dependencyOrder),
    ...(normalized.method.kind === 'aggregate'
      ? { method: { ...normalized.method, inputNames: [...normalized.method.inputNames].sort() } }
      : {}),
  } as PayrollComponentDefinition
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return false
  let candidate: object | null = value as object
  while (candidate !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(candidate, 'then')
    if (descriptor) return !('value' in descriptor) || typeof descriptor.value === 'function'
    candidate = Object.getPrototypeOf(candidate) as object | null
  }
  return false
}

function assertOnlyKeys(value: object, allowedKeys: readonly string[], code: string): void {
  const allowed = new Set(allowedKeys)
  const unexpected = Object.keys(value).find((key) => !allowed.has(key))
  if (unexpected) throw new PayrollEngineError(code, `Unsupported property ${unexpected} is not allowed.`)
}

function isNumericType(valueType: PayrollValueType): boolean {
  return valueType === 'MONEY' || valueType === 'DECIMAL' || valueType === 'PERCENTAGE'
}

function isValueType(value: unknown): value is PayrollValueType {
  return value === 'MONEY' || value === 'DECIMAL' || value === 'PERCENTAGE' || value === 'BOOLEAN' || value === 'STRING'
}

function asDecimal(value: RuntimeValue): FixedDecimal {
  if (!(value.value instanceof FixedDecimal)) throw new PayrollEngineError('VALUE_TYPE_MISMATCH', `Expected numeric value; received ${value.valueType}.`)
  return value.value
}

function asBoolean(value: RuntimeValue): boolean {
  if (value.valueType !== 'BOOLEAN' || typeof value.value !== 'boolean') throw new PayrollEngineError('VALUE_TYPE_MISMATCH', 'Expected Boolean value.')
  return value.value
}

function compareRuntime(left: RuntimeValue, right: RuntimeValue): -1 | 0 | 1 {
  if (left.valueType !== right.valueType) throw new PayrollEngineError('EXPRESSION_VALUE_TYPE_MISMATCH', 'Compared values must have the same type.')
  if (left.value instanceof FixedDecimal && right.value instanceof FixedDecimal) return left.value.compare(right.value)
  if (typeof left.value === 'string' && typeof right.value === 'string') return left.value < right.value ? -1 : left.value > right.value ? 1 : 0
  if (typeof left.value === 'boolean' && typeof right.value === 'boolean') return left.value === right.value ? 0 : left.value ? 1 : -1
  throw new PayrollEngineError('EXPRESSION_VALUE_TYPE_MISMATCH', 'Compared values must be compatible.')
}

function multiplicationType(left: PayrollValueType, right: PayrollValueType): PayrollValueType {
  if (!isNumericType(left) || !isNumericType(right)) throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', 'Multiplication requires numeric operands.')
  if (left === 'PERCENTAGE' && (right === 'MONEY' || right === 'DECIMAL')) return right
  if (right === 'PERCENTAGE' && (left === 'MONEY' || left === 'DECIMAL')) return left
  if (left === 'MONEY' && right === 'DECIMAL' || left === 'DECIMAL' && right === 'MONEY') return 'MONEY'
  if (left === 'DECIMAL' && right === 'DECIMAL') return 'DECIMAL'
  throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', 'This multiplication would combine incompatible payroll units.')
}

function divisionType(left: PayrollValueType, right: PayrollValueType): PayrollValueType {
  if (!isNumericType(left) || !isNumericType(right) || right === 'PERCENTAGE') {
    throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', 'Division requires compatible numeric operands.')
  }
  if (left === right || left === 'MONEY' && right === 'MONEY') return 'DECIMAL'
  if (left === 'MONEY' && right === 'DECIMAL') return 'MONEY'
  if (left === 'PERCENTAGE' && right === 'DECIMAL') return 'PERCENTAGE'
  if (left === 'DECIMAL' && right === 'MONEY') return 'DECIMAL'
  throw new PayrollEngineError('EXPRESSION_OPERATOR_TYPE_INVALID', 'This division would combine incompatible payroll units.')
}

function outputKey(componentCode: string, outputName: string): string {
  return `${componentCode}.${outputName}`
}

function dependencyOrder(left: PayrollDependencyDefinition, right: PayrollDependencyDefinition): number {
  return left.componentCode.localeCompare(right.componentCode)
    || left.outputName.localeCompare(right.outputName)
    || left.inputName.localeCompare(right.inputName)
}

function periodStartDate(period: { readonly year: number; readonly month: number }): string {
  return `${String(period.year).padStart(4, '0')}-${String(period.month).padStart(2, '0')}-01`
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const daysInMonth = month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value))
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}
