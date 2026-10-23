'use client'

import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { ConditionNode, FieldDefinition, FieldType } from '@/lib/process-automation/definition-schemas'

export type RuleOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty'

export interface SimpleConditionRule {
  readonly fieldKey: string
  readonly operator: RuleOperator
  readonly value: string
  readonly values: readonly string[]
}

export interface ConditionRuleBuilderLabels {
  readonly field: string
  readonly operator: string
  readonly value: string
  readonly invalidValue: string
  readonly yes: string
  readonly no: string
  readonly addValue: string
  readonly removeValue: string
  readonly operatorLabels: Readonly<Record<RuleOperator, string>>
}

export const conditionBuilderFieldTypes: ReadonlySet<FieldType> = new Set([
  'SHORT_TEXT',
  'LONG_TEXT',
  'INTEGER',
  'DECIMAL',
  'MONEY',
  'DATE',
  'TIME',
  'DATETIME',
  'BOOLEAN',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'EMPLOYEE_REFERENCE',
  'DEPARTMENT_REFERENCE',
  'JOB_REFERENCE',
  'EMPLOYMENT_REFERENCE',
  'DOCUMENT_REFERENCE',
])

const orderableTypes = new Set<FieldType>(['INTEGER', 'DECIMAL', 'MONEY', 'DATE', 'TIME', 'DATETIME'])
const presenceOnlyTypes = new Set<FieldType>(['MULTI_SELECT', 'EMPLOYEE_REFERENCE', 'DEPARTMENT_REFERENCE', 'JOB_REFERENCE', 'EMPLOYMENT_REFERENCE', 'DOCUMENT_REFERENCE'])

function localizedTitle(value: { readonly nl?: string; readonly en?: string } | undefined, language: 'nl' | 'en'): string {
  return value?.[language]?.trim() || value?.nl?.trim() || value?.en?.trim() || ''
}

export function operatorsForFieldType(type: FieldType): RuleOperator[] {
  if (presenceOnlyTypes.has(type)) return ['isEmpty', 'isNotEmpty']
  return [
    ...(orderableTypes.has(type) ? ['greaterThan', 'lessThan'] as const : []),
    'equals',
    'notEquals',
    'in',
    'notIn',
    'isEmpty',
    'isNotEmpty',
  ]
}

function parseScalarValue(field: FieldDefinition, rawValue: string): string | number | boolean | null {
  if (rawValue.trim() === '') return null
  if (field.type === 'INTEGER' || field.type === 'DECIMAL' || field.type === 'MONEY') {
    const numericValue = Number(rawValue)
    if (!Number.isFinite(numericValue) || (field.type === 'INTEGER' && !Number.isInteger(numericValue))) return null
    return numericValue
  }
  if (field.type === 'BOOLEAN') {
    if (rawValue !== 'true' && rawValue !== 'false') return null
    return rawValue === 'true'
  }
  if (field.type === 'SINGLE_SELECT' && !field.options?.some((option) => option.value === rawValue)) return null
  return rawValue
}

function simpleValues(values: readonly (string | number | boolean | null)[]): string[] {
  return values.map((value) => value === null ? '' : String(value))
}

export function conditionToSimpleRule(condition: ConditionNode | undefined, fields: readonly FieldDefinition[]): SimpleConditionRule | null {
  if (!condition) return null
  if (condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty') {
    const operand = condition.operand
    if (operand.kind !== 'FIELD') return null
    const field = fields.find((candidate) => candidate.key === operand.fieldKey)
    if (!field || !conditionBuilderFieldTypes.has(field.type)) return null
    return { fieldKey: field.key, operator: condition.operator, value: '', values: [] }
  }
  if (condition.operator === 'in' || condition.operator === 'notIn') {
    const left = condition.left
    if (left.kind !== 'FIELD') return null
    const field = fields.find((candidate) => candidate.key === left.fieldKey)
    if (!field || !conditionBuilderFieldTypes.has(field.type) || !operatorsForFieldType(field.type).includes(condition.operator)) return null
    return { fieldKey: field.key, operator: condition.operator, value: '', values: simpleValues(condition.values) }
  }
  if (condition.operator !== 'equals' && condition.operator !== 'notEquals' && condition.operator !== 'greaterThan' && condition.operator !== 'lessThan') return null
  const left = condition.left
  const right = condition.right
  if (left.kind !== 'FIELD' || right.kind !== 'LITERAL') return null
  const field = fields.find((candidate) => candidate.key === left.fieldKey)
  if (!field || !conditionBuilderFieldTypes.has(field.type) || !operatorsForFieldType(field.type).includes(condition.operator)) return null
  const value = right.value
  if (value === null) return null
  if (typeof value === 'boolean' && field.type !== 'BOOLEAN') return null
  if (typeof value === 'number' && !['INTEGER', 'DECIMAL', 'MONEY'].includes(field.type)) return null
  return { fieldKey: field.key, operator: condition.operator, value: String(value), values: [] }
}

export function simpleRuleToCondition(field: FieldDefinition | undefined, rule: SimpleConditionRule): ConditionNode | null {
  if (!field || !conditionBuilderFieldTypes.has(field.type) || !operatorsForFieldType(field.type).includes(rule.operator)) return null
  const operand = { kind: 'FIELD' as const, fieldKey: field.key }
  if (rule.operator === 'isEmpty' || rule.operator === 'isNotEmpty') return { operator: rule.operator, operand }
  if (rule.operator === 'in' || rule.operator === 'notIn') {
    if (rule.values.length === 0) return null
    const values: Array<string | number | boolean | null> = []
    for (const rawValue of rule.values) {
      const parsed = parseScalarValue(field, rawValue)
      if (parsed === null) return null
      values.push(parsed)
    }
    return { operator: rule.operator, left: operand, values }
  }
  const value = parseScalarValue(field, rule.value)
  if (value === null) return null
  return { operator: rule.operator, left: operand, right: { kind: 'LITERAL', value } }
}

export function formatConditionRule(
  condition: ConditionNode,
  fields: readonly FieldDefinition[],
  language: 'nl' | 'en',
  labels: Pick<ConditionRuleBuilderLabels, 'yes' | 'no' | 'operatorLabels'>,
): string | null {
  const rule = conditionToSimpleRule(condition, fields)
  const field = rule && fields.find((candidate) => candidate.key === rule.fieldKey)
  if (!rule || !field) return null
  const values = rule.operator === 'in' || rule.operator === 'notIn' ? rule.values : rule.value === '' ? [] : [rule.value]
  const readableValues = values.map((value) => {
    if (field.type === 'MONEY' && Number.isFinite(Number(value))) return new Intl.NumberFormat(language === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(Number(value))
    if (field.type === 'BOOLEAN') return value === 'true' ? labels.yes : labels.no
    if (field.type === 'SINGLE_SELECT') return localizedTitle(field.options?.find((option) => option.value === value)?.label, language) || value
    return value
  })
  return [localizedTitle(field.label, language), labels.operatorLabels[rule.operator], readableValues.length ? readableValues.join(', ') : ''].filter(Boolean).join(' ')
}

export function ConditionRuleBuilder({
  fields,
  language,
  labels,
  idPrefix,
  rule,
  onChange,
  disabled = false,
}: {
  readonly fields: readonly FieldDefinition[]
  readonly language: 'nl' | 'en'
  readonly labels: ConditionRuleBuilderLabels
  readonly idPrefix: string
  readonly rule: SimpleConditionRule
  readonly onChange: (next: SimpleConditionRule) => void
  readonly disabled?: boolean
}) {
  const field = fields.find((candidate) => candidate.key === rule.fieldKey)
  const operators = field ? operatorsForFieldType(field.type) : []
  const parsed = simpleRuleToCondition(field, rule)
  const multiValue = rule.operator === 'in' || rule.operator === 'notIn'
  const choices = field?.type === 'BOOLEAN'
    ? [{ value: 'true', label: labels.yes }, { value: 'false', label: labels.no }]
    : field?.type === 'SINGLE_SELECT'
      ? (field.options ?? []).map((option) => ({ value: option.value, label: localizedTitle(option.label, language) }))
      : []
  const inputType = field?.type === 'DATE' ? 'date'
    : field?.type === 'TIME' ? 'time'
      : field?.type === 'DATETIME' ? 'datetime-local'
        : field && ['INTEGER', 'DECIMAL', 'MONEY'].includes(field.type) ? 'number' : 'text'
  const inputStep = field?.type === 'INTEGER' ? '1' : field && ['DECIMAL', 'MONEY'].includes(field.type) ? 'any' : undefined

  function updateValue(value: string): void {
    onChange({ ...rule, value, values: [] })
  }

  function updateValueAt(index: number, value: string): void {
    const nextValues = [...rule.values]
    nextValues[index] = value
    onChange({ ...rule, values: nextValues, value: '' })
  }

  return <div className="grid min-w-0 gap-3">
    <label className="min-w-0 text-sm font-semibold" htmlFor={`${idPrefix}-field`}>{labels.field}
      <DropdownSelect className="mt-1" disabled={disabled} id={`${idPrefix}-field`} onChange={(event) => {
        const nextField = fields.find((candidate) => candidate.key === event.target.value)
        const nextOperator = nextField ? operatorsForFieldType(nextField.type)[0] ?? 'equals' : 'equals'
        onChange({ fieldKey: event.target.value, operator: nextOperator, value: '', values: [] })
      }} searchable value={field?.key ?? ''}>
        <option value="">{labels.field}</option>
        {fields.map((candidate) => <option key={candidate.key} value={candidate.key}>{localizedTitle(candidate.label, language)}</option>)}
      </DropdownSelect>
    </label>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm font-semibold" htmlFor={`${idPrefix}-operator`}>{labels.operator}
        <DropdownSelect className="mt-1" disabled={disabled || !field} id={`${idPrefix}-operator`} onChange={(event) => {
          const nextOperator = event.target.value as RuleOperator
          onChange({ fieldKey: rule.fieldKey, operator: nextOperator, value: '', values: nextOperator === 'in' || nextOperator === 'notIn' ? [''] : [] })
        }} value={rule.operator}>
          {operators.map((operator) => <option key={operator} value={operator}>{labels.operatorLabels[operator]}</option>)}
        </DropdownSelect>
      </label>
      {rule.operator !== 'isEmpty' && rule.operator !== 'isNotEmpty' ? <div className="min-w-0">
        <span className="text-sm font-semibold">{labels.value}</span>
        {multiValue && choices.length > 0 ? <fieldset className="mt-1 grid gap-2 rounded-[var(--radius-control)] border border-border p-3">
          <legend className="sr-only">{labels.value}</legend>
          {choices.map((choice) => <label className="flex min-w-0 items-center gap-2 text-sm font-normal" key={choice.value}>
            <input checked={rule.values.includes(choice.value)} disabled={disabled} onChange={(event) => onChange({ ...rule, value: '', values: event.target.checked ? [...rule.values, choice.value] : rule.values.filter((value) => value !== choice.value) })} type="checkbox" />
            <span className="break-words">{choice.label}</span>
          </label>)}
        </fieldset> : multiValue ? <div className="mt-1 grid min-w-0 gap-2">
          {(rule.values.length ? rule.values : ['']).map((value, index) => <div className="flex min-w-0 items-center gap-2" key={index}>
            <input aria-label={`${labels.value} ${index + 1}`} aria-invalid={!parsed} className="form-field min-w-0 flex-1" disabled={disabled} inputMode={field && ['INTEGER', 'DECIMAL', 'MONEY'].includes(field.type) ? 'decimal' : undefined} onChange={(event) => updateValueAt(index, event.target.value)} step={inputStep} type={inputType} value={value} />
            <button aria-label={`${labels.removeValue} ${index + 1}`} className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] border border-border focus-visible:outline-2 focus-visible:outline-primary" disabled={disabled} onClick={() => onChange({ ...rule, value: '', values: rule.values.filter((_, valueIndex) => valueIndex !== index) })} type="button">−</button>
          </div>)}
          <button className="w-fit rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary" disabled={disabled} onClick={() => onChange({ ...rule, value: '', values: [...rule.values, ''] })} type="button">{labels.addValue}</button>
        </div> : field?.type === 'BOOLEAN' ? <DropdownSelect aria-label={labels.value} className="mt-1" disabled={disabled} id={`${idPrefix}-value`} onChange={(event) => updateValue(event.target.value)} value={rule.value}>
          <option value="">{labels.value}</option><option value="true">{labels.yes}</option><option value="false">{labels.no}</option>
        </DropdownSelect> : field?.type === 'SINGLE_SELECT' ? <DropdownSelect aria-label={labels.value} className="mt-1" disabled={disabled} id={`${idPrefix}-value`} onChange={(event) => updateValue(event.target.value)} value={rule.value}>
          <option value="">{labels.value}</option>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{localizedTitle(option.label, language)}</option>)}
        </DropdownSelect> : <input aria-label={labels.value} aria-invalid={!parsed} className="form-field mt-1 min-w-0" disabled={disabled} id={`${idPrefix}-value`} inputMode={field && ['INTEGER', 'DECIMAL', 'MONEY'].includes(field.type) ? 'decimal' : undefined} onChange={(event) => updateValue(event.target.value)} step={inputStep} type={inputType} value={rule.value} />}
      </div> : <div />}
    </div>
    {field && rule.operator !== 'isEmpty' && rule.operator !== 'isNotEmpty' && !parsed ? <p className="text-sm text-danger" role="alert">{labels.invalidValue}</p> : null}
  </div>
}
