import 'server-only'

import {
  buildCalculationInputs,
  calculatePayroll,
  PayrollEngineError,
  sha256,
  stableSerialize,
  type PayrollCalculationResult,
  type PayrollRulePackage,
  type PayrollSerializedValue,
  type PayrollSourceSnapshot,
  type PayrollValueType,
} from '@liquid-hr/payroll-engine'
import { NL_2026_RULE_REGISTRY } from '@liquid-hr/payroll-rules-nl-2026'
import type { ComponentCatalogValidationIssue } from './component-catalog'
import type { ComponentEditorPayload } from './component-editor-contract'
import type { PreparedComponentDraft } from './component-draft-service'
import { formatPayrollExpression } from './component-expression-dsl'
import { getSystemRulePackageByCompositionId } from './component-catalog'
import { NL_2026_RULE_PACKAGE } from '@liquid-hr/payroll-rules-nl-2026'

export interface ComponentEditorValidationResult {
  readonly valid: boolean
  readonly issues: readonly string[]
  readonly result?: {
    readonly status: PayrollCalculationResult['status']
    readonly method: string
    readonly formulas: readonly { readonly outputName: string; readonly formula: string }[]
    readonly parameters: readonly { readonly name: string; readonly valueType: PayrollValueType; readonly value: string | boolean }[]
    readonly outputs: readonly { readonly name: string; readonly valueType: PayrollValueType; readonly value: string | boolean }[]
    readonly trace: readonly {
      readonly sequence: number
      readonly componentCode: string
      readonly version: string
      readonly inputs: PayrollCalculationResult['trace'][number]['inputs']
      readonly outputs: PayrollCalculationResult['trace'][number]['outputs']
      readonly dependencyRefs: PayrollCalculationResult['trace'][number]['dependencyRefs']
      readonly registeredRuleTrace?: PayrollCalculationResult['trace'][number]['registeredRuleTrace']
    }[]
    readonly rounding: readonly {
      readonly componentCode: string
      readonly outputName: string
      readonly scale: number
      readonly mode: string
    }[]
    readonly controls: PayrollCalculationResult['controls']
  }
}

function issueCodes(issues: readonly ComponentCatalogValidationIssue[]): string[] {
  return issues.map((issue) => issue.code)
}

function defaultValue(valueType: PayrollValueType): PayrollSerializedValue {
  switch (valueType) {
    case 'BOOLEAN': return { valueType, value: false }
    case 'STRING': return { valueType, value: 'TEST' }
    case 'MONEY': return { valueType, value: '1.00' }
    case 'DECIMAL': return { valueType, value: '1' }
    case 'PERCENTAGE': return { valueType, value: '0.01' }
  }
}

function readInputValue(value: string | boolean | undefined, valueType: PayrollValueType): PayrollSerializedValue | null {
  if (value === undefined) return null
  if (valueType === 'BOOLEAN') {
    if (typeof value === 'boolean') return { valueType, value }
    if (value === 'true') return { valueType, value: true }
    if (value === 'false') return { valueType, value: false }
    throw new PayrollEngineError('EDITOR_INPUT_TYPE_INVALID', 'A preview input does not match its declared type.')
  }
  if (typeof value !== 'string') throw new PayrollEngineError('EDITOR_INPUT_TYPE_INVALID', 'A preview input does not match its declared type.')
  if (valueType === 'STRING') return { valueType, value }
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim())) {
    throw new PayrollEngineError('EDITOR_INPUT_DECIMAL_INVALID', 'A preview numeric input must use a decimal value.')
  }
  return { valueType, value: value.trim() }
}

function readCanonicalSourceValue(source: unknown, path: readonly (string | number)[]): unknown {
  let value: unknown = source
  for (const segment of path) {
    if (Array.isArray(value)) {
      if (typeof segment !== 'number') return undefined
      value = value[segment]
    } else if (typeof value === 'object' && value !== null && typeof segment === 'string') {
      value = (value as Readonly<Record<string, unknown>>)[segment]
    } else {
      return undefined
    }
  }
  return value
}

function previewSnapshot(prepared: PreparedComponentDraft): PayrollSourceSnapshot {
  const date = prepared.definition.effectiveFrom
  const [year = 2026, month = 1] = date.split('-').map(Number)
  const canonicalSource = {
    preview: true,
    regularWage: {
      fiscalYear: String(year),
      table: 'WHITE',
      residence: 'NL',
      ageCategory: 'UNDER_AOW',
      herleiding: 'STD',
      timePeriod: 'MONTH',
      payrollTaxCredit: false,
      regularWage: true,
      fullPeriod: true,
      hasSpecialSituation: false,
      incomeRelationshipCount: '1',
      grossAmount: '1000.00',
    },
  }
  return {
    id: 'component-editor-preview',
    sourceTenantId: 'synthetic-preview-tenant',
    sourceHrGroupId: 'synthetic-preview-group',
    sourceAdministrationId: 'synthetic-preview-administration',
    sourceEmployeeId: 'synthetic-preview-employee',
    sourceEmploymentId: 'synthetic-preview-employment',
    sourceIncomeRelationshipId: 'synthetic-preview-income-relationship',
    periodReference: { year: year!, month: month! },
    canonicalSource,
    sourceVersionVector: { source: 'synthetic-component-editor-preview-v1' },
    sourceGaps: [],
    sourceHash: sha256(stableSerialize({ purpose: 'component-editor-preview', canonicalSource })),
    createdAt: '2026-10-12T00:00:00.000Z',
  }
}

function candidatePackage(base: PayrollRulePackage, prepared: PreparedComponentDraft): PayrollRulePackage {
  return {
    ...base,
    components: [
      ...base.components.filter((component) => component.code !== prepared.definition.code),
      prepared.definition,
    ],
  }
}

function packageRegistry(compositionId: string) {
  return compositionId === NL_2026_RULE_PACKAGE.compositionId
    ? NL_2026_RULE_REGISTRY
    : []
}

function relevantTraceCodes(packageDefinition: PayrollRulePackage, candidate: PreparedComponentDraft): ReadonlySet<string> {
  const componentsByCode = new Map(packageDefinition.components.map((component) => [component.code, component]))
  const relevant = new Set<string>([candidate.definition.code])
  const pending = candidate.definition.dependencies.map((dependency) => dependency.componentCode)
  while (pending.length) {
    const code = pending.pop()!
    if (relevant.has(code)) continue
    relevant.add(code)
    const component = componentsByCode.get(code)
    for (const dependency of component?.dependencies ?? []) pending.push(dependency.componentCode)
  }
  return relevant
}

function runPreview(
  prepared: PreparedComponentDraft,
  packageDefinition: PayrollRulePackage,
  previewInputs: ComponentEditorPayload['previewInputs'],
): PayrollCalculationResult {
  const date = prepared.definition.effectiveFrom
  const effectiveComponents = packageDefinition.components.filter((component) => component.effectiveFrom <= date
    && (component.effectiveTo === null || date <= component.effectiveTo))
  const snapshot = previewSnapshot(prepared)
  const sourceValueOverrides: Record<string, PayrollSerializedValue> = {}
  for (const component of effectiveComponents) {
    if (component.method.kind !== 'source') continue
    const output = component.outputs[0]
    if (!output) continue
    const rawValue = readCanonicalSourceValue(snapshot.canonicalSource, component.method.path)
    const canonicalValue = typeof rawValue === 'string' || typeof rawValue === 'boolean'
      ? readInputValue(rawValue, output.valueType)
      : null
    sourceValueOverrides[`${component.code}.${output.name}`] = canonicalValue ?? defaultValue(output.valueType)
  }

  for (const dependency of prepared.definition.dependencies) {
    const provider = effectiveComponents.find((component) => component.code === dependency.componentCode)
    if (!provider || provider.method.kind !== 'source') continue
    const output = provider.outputs.find((item) => item.name === dependency.outputName)
    const input = prepared.definition.inputs.find((item) => item.name === dependency.inputName)
    if (!output || !input) continue
    const value = readInputValue(previewInputs[input.name], input.valueType)
    if (!value) continue
    const key = `${provider.code}.${output.name}`
    sourceValueOverrides[key] = value
  }

  if (prepared.definition.method.kind === 'source') {
    for (const output of prepared.definition.outputs) {
      const value = readInputValue(previewInputs[output.name], output.valueType)
      if (value) sourceValueOverrides[`${prepared.definition.code}.${output.name}`] = value
    }
  }

  const packageWithCandidate = candidatePackage(packageDefinition, prepared)
  const inputs = buildCalculationInputs(snapshot, packageWithCandidate, {
    effectiveDate: date,
    sourceValueOverrides,
  })
  const registry = packageRegistry(packageDefinition.compositionId)
  const result = calculatePayroll(inputs, registry)
  return {
    ...result,
    trace: result.trace.map((step) => ({
      ...step,
      dependencyRefs: step.componentCode === prepared.definition.code
        ? prepared.definition.dependencies
        : step.dependencyRefs,
    })),
  }
}

export function validatePreparedComponentDraft(
  prepared: PreparedComponentDraft,
  previewInputs: ComponentEditorPayload['previewInputs'] = {},
): ComponentEditorValidationResult {
  const issues = issueCodes(prepared.entry.validation.issues)
  const base = getSystemRulePackageByCompositionId(prepared.entry.package.compositionId)
  if (!base) return { valid: false, issues: [...issues, 'RULE_PACKAGE_UNAVAILABLE'] }

  try {
    const result = runPreview(prepared, base, previewInputs)
    const candidateResult = result.componentResults.find((item) => item.componentCode === prepared.definition.code)
    const visibleTraceCodes = relevantTraceCodes(candidatePackage(base, prepared), prepared)
    const candidateTrace = result.trace.filter((item) => visibleTraceCodes.has(item.componentCode))
    if (!candidateResult) return { valid: false, issues: [...issues, 'PREVIEW_RESULT_MISSING'] }
    return {
      valid: issues.length === 0,
      issues,
      result: {
        status: result.status,
        method: prepared.definition.method.kind,
        formulas: prepared.definition.method.kind === 'expression'
          ? Object.entries(prepared.definition.method.outputs).map(([outputName, expression]) => ({ outputName, formula: formatPayrollExpression(expression) }))
          : [],
        parameters: Object.entries(prepared.definition.parameters ?? {}).map(([name, parameter]) => ({ name, ...parameter })),
        outputs: candidateResult.outputs,
        trace: candidateTrace.map((item) => ({
          sequence: item.sequence,
          componentCode: item.componentCode,
          version: item.version,
          inputs: item.inputs,
          outputs: item.outputs,
          dependencyRefs: item.dependencyRefs,
          ...(item.registeredRuleTrace ? { registeredRuleTrace: item.registeredRuleTrace } : {}),
        })),
        rounding: prepared.definition.outputs.flatMap((output) => output.rounding
          ? [{ componentCode: prepared.definition.code, outputName: output.name, ...output.rounding }]
          : []),
        controls: result.controls,
      },
    }
  } catch (error) {
    const engineCode = error instanceof PayrollEngineError ? error.code : 'COMPONENT_CALCULATION_INVALID'
    return { valid: false, issues: [...new Set([...issues, engineCode])] }
  }
}
