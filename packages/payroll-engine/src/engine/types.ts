export type PayrollValueType = 'MONEY' | 'DECIMAL' | 'PERCENTAGE' | 'BOOLEAN' | 'STRING'

export type PayrollRoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP'

export interface PayrollRoundingPolicy {
  readonly scale: number
  readonly mode: PayrollRoundingMode
}

export type PayrollProcessingScope =
  | 'INCOME_RELATIONSHIP'
  | 'ASSESSMENT_BASE_GROUP'
  | 'EMPLOYEE'
  | 'PAYROLL_PERIOD'
  | 'EMPLOYER'

export type PayrollRuleOwnership =
  | { readonly kind: 'SYSTEM' }
  | {
    readonly kind: 'CUSTOMER_FORK'
    readonly origin: { readonly id: string; readonly code: string; readonly version: string }
    readonly forkedAt: string
  }
  | { readonly kind: 'CUSTOMER_CUSTOM' }

export interface PayrollComponentInputDefinition {
  readonly name: string
  readonly valueType: PayrollValueType
  readonly required: boolean
}

export interface PayrollComponentOutputDefinition {
  readonly name: string
  readonly valueType: PayrollValueType
  readonly rounding?: PayrollRoundingPolicy
}

export interface PayrollDependencyDefinition {
  readonly componentCode: string
  readonly outputName: string
  readonly inputName: string
}

export type PayrollExpression =
  | { readonly kind: 'literal'; readonly valueType: 'MONEY' | 'DECIMAL' | 'PERCENTAGE'; readonly value: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'input'; readonly name: string }
  | { readonly kind: 'output'; readonly componentCode: string; readonly outputName: string }
  | { readonly kind: 'parameter'; readonly name: string }
  | { readonly kind: 'unary'; readonly operator: 'NOT' | 'ABS'; readonly operand: PayrollExpression }
  | {
    readonly kind: 'binary'
    readonly operator: '+' | '-' | '*' | '/' | '=' | '!=' | '>' | '>=' | '<' | '<=' | 'AND' | 'OR'
    readonly left: PayrollExpression
    readonly right: PayrollExpression
  }
  | {
    readonly kind: 'if'
    readonly condition: PayrollExpression
    readonly then: PayrollExpression
    readonly else: PayrollExpression
  }
  | {
    readonly kind: 'call'
    readonly operator: 'MIN' | 'MAX' | 'ROUND' | 'ABS'
    readonly arguments: readonly PayrollExpression[]
  }

export interface PayrollTypedParameter {
  readonly valueType: PayrollValueType
  readonly value: string | boolean
}

export type PayrollComponentMethod =
  | { readonly kind: 'source'; readonly path: readonly (string | number)[] }
  | { readonly kind: 'passThrough'; readonly outputs: Readonly<Record<string, string>> }
  | { readonly kind: 'expression'; readonly outputs: Readonly<Record<string, PayrollExpression>> }
  | {
    readonly kind: 'aggregate'
    readonly operation: 'SUM' | 'MIN' | 'MAX'
    readonly inputNames: readonly string[]
  }

export type PayrollTracePolicy = 'FULL' | 'OUTPUTS' | 'NONE'

export interface PayrollComponentDefinition {
  readonly id: string
  readonly code: string
  readonly version: string
  readonly effectiveFrom: string
  /** Inclusive calendar date, or null for an open-ended version. */
  readonly effectiveTo: string | null
  readonly ownership: PayrollRuleOwnership
  readonly processingScope: PayrollProcessingScope
  readonly inputs: readonly PayrollComponentInputDefinition[]
  readonly outputs: readonly PayrollComponentOutputDefinition[]
  readonly dependencies: readonly PayrollDependencyDefinition[]
  readonly parameters?: Readonly<Record<string, PayrollTypedParameter>>
  readonly method: PayrollComponentMethod
  readonly tracePolicy: PayrollTracePolicy
}

export interface PayrollControlDefinition {
  readonly code: string
  readonly expression: PayrollExpression
  readonly severity: 'BLOCKING' | 'WARNING'
}

export interface PayrollResultMapping {
  readonly key: string
  readonly componentCode: string
  readonly outputName: string
}

export interface PayrollRulePackage {
  readonly compositionId: string
  readonly components: readonly PayrollComponentDefinition[]
  readonly controls: readonly PayrollControlDefinition[]
  readonly resultMappings: readonly PayrollResultMapping[]
}

export interface PayrollCalculationBuildOptions {
  /** Defaults to the first calendar day of the snapshot period. */
  readonly effectiveDate?: string
}

export interface PayrollSerializedValue {
  readonly valueType: PayrollValueType
  readonly value: string | boolean
}

export interface PayrollCalculationInputs {
  readonly sourceSnapshotId: string
  readonly sourceHash: string
  readonly periodReference: { readonly year: number; readonly month: number }
  readonly effectiveDate: string
  readonly engineVersion: string
  readonly rulePackageCompositionId: string
  readonly rulePackageCompositionHash: string
  readonly inputHash: string
  readonly components: readonly PayrollComponentDefinition[]
  readonly controls: readonly PayrollControlDefinition[]
  readonly resultMappings: readonly PayrollResultMapping[]
  /** Derived and validated by buildCalculationInputs; consumers do not provide source values. */
  readonly resolvedSourceValues: Readonly<Record<string, PayrollSerializedValue>>
}

export interface PayrollComponentResult {
  readonly componentId: string
  readonly componentCode: string
  readonly version: string
  readonly processingScope: PayrollProcessingScope
  readonly outputs: readonly PayrollSerializedOutput[]
}

export interface PayrollSerializedOutput extends PayrollSerializedValue {
  readonly name: string
}

export interface PayrollDependencyTrace {
  readonly componentCode: string
  readonly outputName: string
  readonly inputName: string
}

export interface PayrollCalculationTraceStep {
  readonly sequence: number
  readonly componentId: string
  readonly componentCode: string
  readonly version: string
  readonly processingScope: PayrollProcessingScope
  readonly inputs: Readonly<Record<string, PayrollSerializedValue>>
  readonly outputs: Readonly<Record<string, PayrollSerializedValue>>
  readonly dependencyRefs: readonly PayrollDependencyTrace[]
}

export interface PayrollControlResult {
  readonly code: string
  readonly status: 'PASS' | 'FAIL' | 'WARNING'
  readonly actual: string | boolean
  readonly expected: string | boolean
}

export interface PayrollCalculationResultRow {
  readonly key: string
  readonly componentCode: string
  readonly outputName: string
  readonly valueType: PayrollValueType
  readonly value: string | boolean
}

export interface PayrollCalculationResult {
  readonly status: 'CALCULATED' | 'BLOCKED'
  readonly sourceSnapshotId: string
  readonly sourceHash: string
  readonly periodReference: { readonly year: number; readonly month: number }
  readonly effectiveDate: string
  readonly engineVersion: string
  readonly rulePackageCompositionId: string
  readonly rulePackageCompositionHash: string
  readonly inputHash: string
  readonly resultHash: string
  readonly componentResults: readonly PayrollComponentResult[]
  readonly resultRows: readonly PayrollCalculationResultRow[]
  readonly trace: readonly PayrollCalculationTraceStep[]
  readonly controls: readonly PayrollControlResult[]
}
