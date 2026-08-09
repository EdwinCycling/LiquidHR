import type { ConditionNode, ConditionOperand, FieldType } from './definition-schemas'

export type ConditionRuntimeValue = string | number | boolean | null | undefined

export interface ConditionEvaluationContext {
  readonly fields: Readonly<Record<string, ConditionRuntimeValue>>
  readonly subject: Readonly<Record<string, ConditionRuntimeValue>>
}

export type ConditionIssueCode =
  | 'CONDITION_REFERENCE_UNKNOWN'
  | 'CONDITION_SUBJECT_REFERENCE_UNKNOWN'
  | 'CONDITION_TYPE_MISMATCH'
  | 'CONDITION_NOT_ORDERABLE'

export interface ConditionValidationIssue {
  readonly code: ConditionIssueCode
  readonly path: ReadonlyArray<string | number>
  readonly message: string
}

type PrimitiveType = 'string' | 'number' | 'boolean' | 'null'

interface ConditionTypeInfo {
  readonly primitive: PrimitiveType
  readonly orderable: boolean
}

export interface ConditionTypeContext {
  readonly fields: ReadonlyMap<string, FieldType>
}

const subjectTypes: Readonly<Record<string, ConditionTypeInfo>> = {
  employeeId: { primitive: 'string', orderable: false },
  employmentId: { primitive: 'string', orderable: false },
  departmentId: { primitive: 'string', orderable: false },
  effectiveDate: { primitive: 'string', orderable: true },
}

const fieldTypes: Readonly<Record<FieldType, ConditionTypeInfo>> = {
  SHORT_TEXT: { primitive: 'string', orderable: false },
  LONG_TEXT: { primitive: 'string', orderable: false },
  INTEGER: { primitive: 'number', orderable: true },
  DECIMAL: { primitive: 'number', orderable: true },
  MONEY: { primitive: 'number', orderable: true },
  DATE: { primitive: 'string', orderable: true },
  TIME: { primitive: 'string', orderable: true },
  DATETIME: { primitive: 'string', orderable: true },
  BOOLEAN: { primitive: 'boolean', orderable: false },
  SINGLE_SELECT: { primitive: 'string', orderable: false },
  MULTI_SELECT: { primitive: 'string', orderable: false },
  EMPLOYEE_REFERENCE: { primitive: 'string', orderable: false },
  DEPARTMENT_REFERENCE: { primitive: 'string', orderable: false },
  JOB_REFERENCE: { primitive: 'string', orderable: false },
  EMPLOYMENT_REFERENCE: { primitive: 'string', orderable: false },
  DOCUMENT_REFERENCE: { primitive: 'string', orderable: false },
}

function runtimeValue(operand: ConditionOperand, context: ConditionEvaluationContext): ConditionRuntimeValue {
  if (operand.kind === 'LITERAL') return operand.value
  if (operand.kind === 'FIELD') return context.fields[operand.fieldKey]
  return context.subject[operand.subjectKey]
}

function isEmpty(value: ConditionRuntimeValue): boolean {
  return value === null || value === undefined || value === ''
}

function compareValues(left: ConditionRuntimeValue, right: ConditionRuntimeValue, operator: 'greaterThan' | 'lessThan'): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return operator === 'greaterThan' ? left > right : left < right
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return operator === 'greaterThan' ? left > right : left < right
  }
  return false
}

export function evaluateCondition(condition: ConditionNode, context: ConditionEvaluationContext): boolean {
  switch (condition.operator) {
    case 'equals':
      return Object.is(runtimeValue(condition.left, context), runtimeValue(condition.right, context))
    case 'notEquals':
      return !Object.is(runtimeValue(condition.left, context), runtimeValue(condition.right, context))
    case 'in': {
      const value = runtimeValue(condition.left, context)
      return condition.values.some((candidate) => Object.is(candidate, value))
    }
    case 'notIn': {
      const value = runtimeValue(condition.left, context)
      return !condition.values.some((candidate) => Object.is(candidate, value))
    }
    case 'isEmpty':
      return isEmpty(runtimeValue(condition.operand, context))
    case 'isNotEmpty':
      return !isEmpty(runtimeValue(condition.operand, context))
    case 'greaterThan':
    case 'lessThan':
      return compareValues(runtimeValue(condition.left, context), runtimeValue(condition.right, context), condition.operator)
    case 'and':
      return condition.conditions.every((item) => evaluateCondition(item, context))
    case 'or':
      return condition.conditions.some((item) => evaluateCondition(item, context))
    case 'not':
      return !evaluateCondition(condition.condition, context)
  }
}

function literalType(value: string | number | boolean | null): ConditionTypeInfo {
  if (value === null) return { primitive: 'null', orderable: false }
  if (typeof value === 'number') return { primitive: 'number', orderable: true }
  if (typeof value === 'boolean') return { primitive: 'boolean', orderable: false }
  return { primitive: 'string', orderable: false }
}

function compatible(left: ConditionTypeInfo, right: ConditionTypeInfo): boolean {
  return left.primitive === 'null' || right.primitive === 'null' || left.primitive === right.primitive
}

function orderable(left: ConditionTypeInfo, right: ConditionTypeInfo): boolean {
  if (left.primitive !== right.primitive) return false
  if (left.primitive === 'number') return true
  return left.primitive === 'string' && (left.orderable || right.orderable)
}

function operandType(
  operand: ConditionOperand,
  context: ConditionTypeContext,
  path: ReadonlyArray<string | number>,
  issues: ConditionValidationIssue[],
): ConditionTypeInfo | null {
  if (operand.kind === 'LITERAL') return literalType(operand.value)
  if (operand.kind === 'FIELD') {
    const type = context.fields.get(operand.fieldKey)
    if (!type) {
      issues.push({ code: 'CONDITION_REFERENCE_UNKNOWN', path: [...path, 'fieldKey'], message: `Unknown field reference: ${operand.fieldKey}` })
      return null
    }
    return fieldTypes[type]
  }
  const type = subjectTypes[operand.subjectKey]
  if (!type) {
    issues.push({ code: 'CONDITION_SUBJECT_REFERENCE_UNKNOWN', path: [...path, 'subjectKey'], message: `Unknown subject reference: ${operand.subjectKey}` })
    return null
  }
  return type
}

function validateConditionNode(
  condition: ConditionNode,
  context: ConditionTypeContext,
  path: ReadonlyArray<string | number>,
  issues: ConditionValidationIssue[],
): void {
  switch (condition.operator) {
    case 'equals':
    case 'notEquals': {
      const left = operandType(condition.left, context, [...path, 'left'], issues)
      const right = operandType(condition.right, context, [...path, 'right'], issues)
      if (left && right && !compatible(left, right)) issues.push({ code: 'CONDITION_TYPE_MISMATCH', path, message: 'Condition operands have incompatible types' })
      return
    }
    case 'in':
    case 'notIn': {
      const left = operandType(condition.left, context, [...path, 'left'], issues)
      const values = condition.values.map((value, index) => ({ value: literalType(value), index }))
      if (left && values.some(({ value }) => !compatible(left, value))) issues.push({ code: 'CONDITION_TYPE_MISMATCH', path, message: 'Condition set contains an incompatible value' })
      if (values.some(({ value }, index) => index > 0 && !compatible(values[0].value, value))) issues.push({ code: 'CONDITION_TYPE_MISMATCH', path: [...path, 'values'], message: 'Condition set contains mixed types' })
      return
    }
    case 'isEmpty':
    case 'isNotEmpty':
      operandType(condition.operand, context, [...path, 'operand'], issues)
      return
    case 'greaterThan':
    case 'lessThan': {
      const left = operandType(condition.left, context, [...path, 'left'], issues)
      const right = operandType(condition.right, context, [...path, 'right'], issues)
      if (left && right && !orderable(left, right)) issues.push({ code: 'CONDITION_NOT_ORDERABLE', path, message: 'Condition operands cannot be ordered' })
      return
    }
    case 'and':
    case 'or':
      condition.conditions.forEach((item, index) => validateConditionNode(item, context, [...path, 'conditions', index], issues))
      return
    case 'not':
      validateConditionNode(condition.condition, context, [...path, 'condition'], issues)
      return
  }
}

export function validateCondition(
  condition: ConditionNode,
  context: ConditionTypeContext,
  path: ReadonlyArray<string | number> = [],
): readonly ConditionValidationIssue[] {
  const issues: ConditionValidationIssue[] = []
  validateConditionNode(condition, context, path, issues)
  return issues
}

export function collectConditionFieldReferences(condition: ConditionNode): readonly string[] {
  const references = new Set<string>()
  const collectOperand = (operand: ConditionOperand): void => {
    if (operand.kind === 'FIELD') references.add(operand.fieldKey)
  }
  const collect = (item: ConditionNode): void => {
    switch (item.operator) {
      case 'equals':
      case 'notEquals':
      case 'greaterThan':
      case 'lessThan':
        collectOperand(item.left)
        collectOperand(item.right)
        return
      case 'in':
      case 'notIn':
        collectOperand(item.left)
        return
      case 'isEmpty':
      case 'isNotEmpty':
        collectOperand(item.operand)
        return
      case 'and':
      case 'or':
        item.conditions.forEach(collect)
        return
      case 'not':
        collect(item.condition)
        return
    }
  }
  collect(condition)
  return [...references].sort()
}
