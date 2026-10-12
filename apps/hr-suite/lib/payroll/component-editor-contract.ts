import { z } from 'zod'
import type {
  PayrollComponentMethod,
  PayrollComponentOutputDefinition,
  PayrollDependencyDefinition,
  PayrollProcessingScope,
  PayrollTypedParameter,
  PayrollValueType,
} from '@liquid-hr/payroll-engine'
import { parsePayrollExpression } from './component-expression-dsl'

const uuidSchema = z.string().uuid()
const valueTypeSchema = z.enum(['MONEY', 'DECIMAL', 'PERCENTAGE', 'BOOLEAN', 'STRING'])
const inputSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
  valueType: valueTypeSchema,
  required: z.boolean(),
}).strict()
const outputSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
  valueType: valueTypeSchema,
  rounding: z.object({
    scale: z.number().int().min(0).max(12),
    mode: z.enum(['HALF_UP', 'HALF_EVEN', 'DOWN', 'UP']),
  }).strict().optional(),
}).strict()
const dependencySchema = z.object({
  componentCode: z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]{0,79}$/),
  outputName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
  inputName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
}).strict()
const parameterSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
  valueType: valueTypeSchema,
  value: z.union([z.string().max(120), z.boolean()]),
}).strict()
const methodSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('source') }).strict(),
  z.object({
    kind: z.literal('passThrough'),
    outputs: z.record(z.string(), z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/)),
  }).strict(),
  z.object({
    kind: z.literal('expression'),
    formulas: z.record(z.string(), z.string().min(1).max(1200)),
  }).strict(),
  z.object({
    kind: z.literal('aggregate'),
    operation: z.enum(['SUM', 'MIN', 'MAX']),
    inputNames: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/)).max(32),
  }).strict(),
])

export const componentEditorPayloadSchema = z.object({
  draftId: uuidSchema.optional(),
  requestId: uuidSchema,
  packageCompositionId: z.string().min(1).max(160).optional(),
  displayName: z.string().trim().min(1).max(120),
  displayCode: z.string().trim().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
  description: z.string().trim().max(800),
  category: z.string().trim().min(1).max(80),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  processingScope: z.enum([
    'EMPLOYMENT', 'PAYROLL_RUN', 'INCOME_RELATIONSHIP', 'ASSESSMENT_BASE_GROUP', 'EMPLOYEE', 'PAYROLL_PERIOD', 'EMPLOYER',
  ]),
  inputs: z.array(inputSchema).max(32),
  outputs: z.array(outputSchema).min(1).max(16),
  dependencies: z.array(dependencySchema).max(64),
  parameters: z.array(parameterSchema).max(32),
  tracePolicy: z.enum(['FULL', 'OUTPUTS', 'NONE']),
  method: methodSchema,
  previewInputs: z.record(
    z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
    z.union([z.string().max(80), z.boolean()]),
  ).refine((values) => Object.keys(values).length <= 64),
}).strict()

export type ComponentEditorPayload = z.infer<typeof componentEditorPayloadSchema>
export type ComponentEditorMethodPayload = ComponentEditorPayload['method']

export interface ParsedComponentEditorPayload extends Omit<ComponentEditorPayload, 'method' | 'parameters' | 'outputs' | 'dependencies'> {
  readonly method: PayrollComponentMethod | null
  readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
  readonly outputs: readonly PayrollComponentOutputDefinition[]
  readonly processingScope: PayrollProcessingScope
  readonly inputs: ComponentEditorPayload['inputs']
  readonly dependencies: readonly PayrollDependencyDefinition[]
}

export type ComponentEditorParseResult =
  | { readonly success: true; readonly data: ParsedComponentEditorPayload }
  | { readonly success: false; readonly issues: readonly { readonly field: string; readonly code: string }[] }

export function parseComponentEditorPayload(value: unknown): ComponentEditorParseResult {
  const parsed = componentEditorPayloadSchema.safeParse(value)
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), code: 'INVALID_FIELD' })),
    }
  }

  const payload = parsed.data
  const inputNames = new Set<string>()
  for (const input of payload.inputs) {
    if (inputNames.has(input.name)) return { success: false, issues: [{ field: 'inputs', code: 'INPUT_NAME_DUPLICATE' }] }
    inputNames.add(input.name)
  }
  const outputNames = new Set<string>()
  for (const output of payload.outputs) {
    if (outputNames.has(output.name)) return { success: false, issues: [{ field: 'outputs', code: 'OUTPUT_NAME_DUPLICATE' }] }
    outputNames.add(output.name)
  }
  const parameterNames = new Set<string>()
  const parameters: Record<string, PayrollTypedParameter> = {}
  for (const parameter of payload.parameters) {
    if (parameterNames.has(parameter.name)) return { success: false, issues: [{ field: 'parameters', code: 'PARAMETER_NAME_DUPLICATE' }] }
    parameterNames.add(parameter.name)
    parameters[parameter.name] = { valueType: parameter.valueType as PayrollValueType, value: parameter.value }
  }
  if (payload.dependencies.some((dependency) => !inputNames.has(dependency.inputName))) {
    return { success: false, issues: [{ field: 'dependencies', code: 'DEPENDENCY_INPUT_UNKNOWN' }] }
  }
  if (new Set(payload.dependencies.map((dependency) => dependency.inputName)).size !== payload.dependencies.length) {
    return { success: false, issues: [{ field: 'dependencies', code: 'DEPENDENCY_INPUT_DUPLICATE' }] }
  }
  if (payload.effectiveTo !== null && payload.effectiveTo < payload.effectiveFrom) {
    return { success: false, issues: [{ field: 'effectiveTo', code: 'COMPONENT_EFFECTIVE_RANGE_INVALID' }] }
  }

  const methodPayload = payload.method
  let method: PayrollComponentMethod | null = null
  if (methodPayload.kind === 'passThrough') {
    method = { kind: methodPayload.kind, outputs: methodPayload.outputs }
  } else if (methodPayload.kind === 'aggregate') {
    method = { kind: methodPayload.kind, operation: methodPayload.operation, inputNames: methodPayload.inputNames }
  } else if (methodPayload.kind === 'expression') {
    const formulas = Object.entries(methodPayload.formulas)
    if (formulas.length !== payload.outputs.length || formulas.some(([name]) => !outputNames.has(name))) {
      return { success: false, issues: [{ field: 'method.formulas', code: 'FORMULA_OUTPUT_MISMATCH' }] }
    }
    try {
      method = {
        kind: 'expression',
        outputs: Object.fromEntries(formulas.map(([name, formula]) => [name, parsePayrollExpression(formula)])),
      }
    } catch {
      return { success: false, issues: [{ field: 'method.formulas', code: 'FORMULA_INVALID' }] }
    }
  }

  const outputs: readonly PayrollComponentOutputDefinition[] = payload.outputs.map((output) => ({
    name: output.name,
    valueType: output.valueType,
    ...(output.rounding ? { rounding: output.rounding } : {}),
  }))

  return {
    success: true,
    data: {
      ...payload,
      method,
      outputs,
      parameters,
      inputs: payload.inputs,
      dependencies: payload.dependencies,
    },
  }
}
