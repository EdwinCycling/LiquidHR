export type PayrollValueType = 'MONEY' | 'DECIMAL' | 'PERCENTAGE' | 'BOOLEAN' | 'STRING'

export type PayrollRoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP'

export interface PayrollRoundingPolicy {
  readonly scale: number
  readonly mode: PayrollRoundingMode
}

export type PayrollRoundingDefinitionMode =
  | 'ARITHMETIC'
  | 'FLOOR'
  | 'CEILING'
  | 'TRUNCATE'
  | 'ROUND_DOWN_TO_MULTIPLE'
  | 'NO_ROUNDING'

/** An effective-dated statutory rounding instruction bound to a rule and source. */
export interface PayrollRoundingDefinition {
  readonly id: string
  readonly componentCode: string
  readonly stage: string
  readonly ruleVersion: string
  readonly packageId: string
  readonly packageVersion: string
  readonly mode: PayrollRoundingDefinitionMode
  readonly decimalPlaces?: number
  readonly targetMultiple?: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly provenance: {
    readonly sourceReference: string
    readonly sourceHash: string
  }
}

export type PayrollProcessingScope =
  | 'EMPLOYMENT'
  | 'PAYROLL_RUN'
  | 'INCOME_RELATIONSHIP'
  | 'ASSESSMENT_BASE_GROUP'
  | 'EMPLOYEE'
  | 'PAYROLL_PERIOD'
  | 'EMPLOYER'

/** Reserved scopes for future assessment-base grouping; current engine execution does not evaluate them. */
export type PayrollAssessmentBaseScope =
  | 'INCOME_RELATIONSHIP'
  | 'EMPLOYMENT'
  | 'EMPLOYEE_EMPLOYER'
  | 'EMPLOYEE_LEGAL_ENTITY'
  | 'EMPLOYEE_PENSION_SCHEME'
  | 'EMPLOYEE'

/** Stable group identity contract. It is descriptive only and does not create an executable group. */
export interface PayrollAssessmentBaseGroupIdentity {
  readonly assessmentBaseCode: string
  readonly assessmentBaseVersion: string
  readonly scope: PayrollAssessmentBaseScope
  readonly scopeInstanceId: string
}

/** A versioned allocation policy reference only; policy code is not evaluated by the engine. */
export interface PayrollAssessmentBaseAllocationPolicyReference {
  readonly policyCode: string
  readonly policyVersion: string
  readonly policyHash: string
}

/** Optional membership metadata keyed per assessment-base group, reserved for later iterations. */
export interface PayrollAssessmentBaseMembership {
  readonly group: PayrollAssessmentBaseGroupIdentity
  /** Opaque INCOME_RELATIONSHIP scope-instance ids; no membership expansion is performed today. */
  readonly incomeRelationshipScopeInstanceIds?: readonly string[]
  readonly allocationPolicyReference?: PayrollAssessmentBaseAllocationPolicyReference
}

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
  | { readonly kind: 'registeredRule'; readonly ruleKey: string; readonly ruleVersion: string; readonly implementationHash: string; readonly parameterSetHash: string }
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
  /** Reserved future contract. M0/M1 execution rejects any nonempty iterative cluster. */
  readonly iterativeClusters?: readonly PayrollIterativeClusterDefinition[]
  readonly roundingDefinitions?: readonly PayrollRoundingDefinition[]
  readonly metadata?: PayrollRulePackageMetadata
  readonly compositionId: string
  readonly components: readonly PayrollComponentDefinition[]
  readonly controls: readonly PayrollControlDefinition[]
  readonly resultMappings: readonly PayrollResultMapping[]
}

export interface PayrollIterativeClusterDefinition {
  readonly id: string
  readonly version: string
  readonly componentCodes: readonly string[]
  readonly policy: {
    readonly version: string
    readonly minimumIterations: number
    readonly maximumIterations: number
    readonly tolerance: string
    readonly comparisonPrecision: {
      readonly decimalPlaces: number
      readonly mode: 'ARITHMETIC' | 'FLOOR' | 'CEILING' | 'TRUNCATE'
    }
    readonly outputSelectors: readonly { readonly componentCode: string; readonly outputName: string }[]
  }
}

export interface PayrollScopedNodeIdentity {
  readonly componentCode: string
  readonly componentVersion: string
  readonly scopeKind: PayrollProcessingScope
  /** Opaque identity of an IKV, employment, assessment-base group or run. Never inferred from another scope. */
  readonly scopeInstanceId: string
}

export interface PayrollRulePackageMetadata {
  readonly packageId: string
  readonly version: string
  readonly packageHash: string
  readonly parameterSetHash: string
  readonly sourceMetadata: Readonly<Record<string, string>>
}

export interface PayrollRulePackageProvenance {
  readonly packageId: string
  readonly version: string
  readonly packageHash: string
  readonly parameterSetHash: string
}

export interface PayrollRegisteredRuleTraceStep {
  readonly code: string
  readonly values: Readonly<Record<string, PayrollSerializedValue>>
  readonly sourceReference: string
}

/** Trusted, statically imported application code. This contract is not a JavaScript sandbox. */
export interface PayrollRegisteredRule {
  readonly ruleKey: string
  readonly ruleVersion: string
  readonly implementationHash: string
  readonly parameterSetHash: string
  readonly packageId: string
  readonly packageVersion: string
  readonly allowedComponents: readonly { readonly id: string; readonly code: string; readonly version: string }[]
  readonly inputs: readonly PayrollComponentInputDefinition[]
  readonly outputs: readonly PayrollComponentOutputDefinition[]
  readonly execute: (context: {
    readonly inputs: Readonly<Record<string, PayrollSerializedValue>>
    readonly parameters: Readonly<Record<string, PayrollTypedParameter>>
    readonly roundingDefinitions?: readonly PayrollRoundingDefinition[]
  }) => {
    readonly outputs: Readonly<Record<string, PayrollSerializedValue>>
    readonly trace: readonly PayrollRegisteredRuleTraceStep[]
  }
}

export interface PayrollCalculationBuildOptions {
  readonly scopeInstanceIds?: Readonly<Partial<Record<PayrollProcessingScope, string>>>
  /** Defaults to the first calendar day of the snapshot period. */
  readonly effectiveDate?: string
}

export interface PayrollSerializedValue {
  readonly valueType: PayrollValueType
  readonly value: string | boolean
}

export interface PayrollCalculationInputs {
  readonly scopeInstanceIds?: Readonly<Partial<Record<PayrollProcessingScope, string>>>
  readonly packageMetadata?: PayrollRulePackageMetadata
  readonly roundingDefinitions?: readonly PayrollRoundingDefinition[]
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
  readonly nodeIdentity?: PayrollScopedNodeIdentity
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
  readonly nodeIdentity?: PayrollScopedNodeIdentity
  readonly rulePackageProvenance?: PayrollRulePackageProvenance
  readonly registeredRuleTrace?: readonly PayrollRegisteredRuleTraceStep[]
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
  readonly packageMetadata?: PayrollRulePackageMetadata
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
