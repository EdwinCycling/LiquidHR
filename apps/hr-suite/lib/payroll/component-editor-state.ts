import type { ComponentCatalogEntry } from './component-catalog'
import { formatPayrollExpression } from './component-expression-dsl'
import type { ComponentEditorPayload, ComponentEditorMethodPayload } from './component-editor-contract'
import type { PayrollComponentMethod } from '@liquid-hr/payroll-engine'

export type ComponentEditorState = Omit<ComponentEditorPayload, 'requestId'>

function expressionMethod(method: PayrollComponentMethod): ComponentEditorMethodPayload {
  if (method.kind === 'source') return { kind: 'source' }
  if (method.kind === 'passThrough') return method
  if (method.kind === 'aggregate') return { ...method, inputNames: [...method.inputNames] }
  if (method.kind === 'expression') {
    return {
      kind: 'expression',
      formulas: Object.fromEntries(Object.entries(method.outputs).map(([name, expression]) => [name, formatPayrollExpression(expression)])),
    }
  }
  return { kind: 'source' }
}

export function componentEditorStateFromEntry(
  entry: ComponentCatalogEntry,
  rowId: string,
  fallbackName: string,
  fallbackCategory: string,
): ComponentEditorState {
  const definition = entry.definition
  return {
    draftId: rowId,
    displayName: entry.displayName?.trim() || fallbackName,
    displayCode: entry.displayCode?.trim() || definition.code,
    description: entry.description ?? '',
    category: entry.category?.trim() || fallbackCategory,
    effectiveFrom: definition.effectiveFrom,
    effectiveTo: definition.effectiveTo,
    processingScope: definition.processingScope,
    inputs: definition.inputs.map((input) => ({ ...input })),
    outputs: definition.outputs.map((output) => ({ ...output })),
    dependencies: definition.dependencies.map((dependency) => ({ ...dependency })),
    parameters: Object.entries(definition.parameters ?? entry.parameters).map(([name, parameter]) => ({ name, ...parameter })),
    tracePolicy: definition.tracePolicy,
    method: expressionMethod(definition.method),
    previewInputs: {},
  }
}

export function newComponentEditorState(
  packageCompositionId: string,
  today: string,
  name: string,
  category: string,
): ComponentEditorState {
  return {
    packageCompositionId,
    displayName: name,
    displayCode: 'CUSTOM_COMPONENT',
    description: '',
    category,
    effectiveFrom: today,
    effectiveTo: null,
    processingScope: 'PAYROLL_RUN',
    inputs: [],
    outputs: [{ name: 'amount', valueType: 'MONEY' }],
    dependencies: [],
    parameters: [],
    tracePolicy: 'FULL',
    method: { kind: 'expression', formulas: { amount: 'MONEY(100.00)' } },
    previewInputs: {},
  }
}
