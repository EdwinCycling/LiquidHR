import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FormFieldConditionsEditor, mutateRequiredAccess } from './form-field-conditions-editor'
import { ConditionRuleBuilder, operatorsForFieldType, simpleRuleToCondition, type ConditionRuleBuilderLabels } from './condition-rule-builder'
import type { FieldDefinition } from '@/lib/process-automation/definition-schemas'
import type { FormFieldConditionsLabels } from './form-field-conditions-editor'

const costs: FieldDefinition = {
  key: 'expected-costs',
  label: { nl: 'Verwachte kosten', en: 'Expected costs' },
  type: 'MONEY',
  binding: { kind: 'PROCESS_ONLY' },
  access: [
    { participantKey: 'employee', mode: 'WRITE_OPTIONAL' },
    { participantKey: 'manager', mode: 'READ' },
    { participantKey: 'hr', mode: 'READ' },
  ],
}

const explanation: FieldDefinition = {
  key: 'high-cost-explanation',
  label: { nl: 'Toelichting hoge kosten', en: 'High cost explanation' },
  type: 'LONG_TEXT',
  binding: { kind: 'PROCESS_ONLY' },
  access: [
    { participantKey: 'employee', mode: 'WRITE_REQUIRED' },
    { participantKey: 'manager', mode: 'READ' },
    { participantKey: 'hr', mode: 'HIDDEN' },
  ],
  visibilityCondition: {
    operator: 'greaterThan',
    left: { kind: 'FIELD', fieldKey: 'expected-costs' },
    right: { kind: 'LITERAL', value: 1000 },
  },
  requiredCondition: {
    operator: 'greaterThan',
    left: { kind: 'FIELD', fieldKey: 'expected-costs' },
    right: { kind: 'LITERAL', value: 1000 },
  },
}

const ruleLabels: ConditionRuleBuilderLabels = {
  field: 'Form field', operator: 'Comparison', value: 'Value', invalidValue: 'Enter a valid value.',
  yes: 'Yes', no: 'No', addValue: 'Add value', removeValue: 'Remove value',
  operatorLabels: {
    equals: 'equals', notEquals: 'does not equal', greaterThan: 'is greater than', lessThan: 'is less than',
    in: 'is one of', notIn: 'is none of', isEmpty: 'is empty', isNotEmpty: 'is filled in',
  },
}

const labels: FormFieldConditionsLabels = {
  title: 'Field conditions', visibility: 'Visibility', alwaysVisible: 'Always visible', visibleWhen: 'Visible when a condition is true',
  required: 'Required input', notRequired: 'Not required', alwaysRequired: 'Always required', requiredWhen: 'Required when a condition is true',
  ruleExplanation: 'Choose a field visible to all affected participants.', saveRule: 'Save rule', cancel: 'Cancel', edit: 'Edit',
  conditionUnavailable: 'This rule cannot be shown here.', noConditionFields: 'No suitable source fields.',
  noWritableParticipants: 'No participant can edit this field.',
}

describe('Formulierenstudio field conditions', () => {
  it('renders readable summaries without exposing technical field keys', () => {
    const markup = renderToStaticMarkup(createElement(FormFieldConditionsEditor, {
      disabled: false,
      field: { ...explanation, access: explanation.access.map((rule) => rule.mode === 'WRITE_REQUIRED' ? { ...rule, mode: 'WRITE_OPTIONAL' as const } : rule) },
      fields: [costs, explanation],
      labels,
      language: 'en',
      onChange: () => undefined,
      ruleLabels,
    }))

    expect(markup).toContain('Field conditions')
    expect(markup).toContain('Expected costs is greater than €1,000.00')
    expect(markup).not.toContain('expected-costs')
  })

  it('changes conditional requiredness to optional storage without changing participant rights', () => {
    const initial = { ...explanation, requiredCondition: undefined }
    const result = mutateRequiredAccess(initial, 'CONDITION')
    expect(result.access).toEqual([
      { participantKey: 'employee', mode: 'WRITE_OPTIONAL' },
      { participantKey: 'manager', mode: 'READ' },
      { participantKey: 'hr', mode: 'HIDDEN' },
    ])
    expect(result.requiredCondition).toBeUndefined()
    expect(result.visibilityCondition).toEqual(explanation.visibilityCondition)
  })

  it('offers operators compatible with the field type and rejects an invalid value', () => {
    expect(operatorsForFieldType('MONEY')).toContain('greaterThan')
    expect(operatorsForFieldType('LONG_TEXT')).not.toContain('greaterThan')
    expect(operatorsForFieldType('MULTI_SELECT')).toEqual(['isEmpty', 'isNotEmpty'])
    expect(simpleRuleToCondition(costs, { fieldKey: costs.key, operator: 'greaterThan', value: 'not money', values: [] })).toBeNull()
  })

  it('shows immediate field-type feedback for an invalid comparison value', () => {
    const markup = renderToStaticMarkup(createElement(ConditionRuleBuilder, {
      fields: [costs],
      idPrefix: 'cost-rule',
      labels: ruleLabels,
      language: 'en',
      onChange: () => undefined,
      rule: { fieldKey: costs.key, operator: 'greaterThan', value: 'not money', values: [] },
    }))
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Enter a valid value.')
  })
})
