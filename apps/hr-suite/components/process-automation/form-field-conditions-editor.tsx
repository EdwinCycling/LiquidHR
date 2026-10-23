'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { bindingAllowsWrite } from '@/lib/process-automation/form-binding-catalog'
import { collectConditionFieldReferences } from '@/lib/process-automation/condition-evaluator'
import {
  ConditionRuleBuilder,
  conditionBuilderFieldTypes,
  conditionToSimpleRule,
  formatConditionRule,
  operatorsForFieldType,
  simpleRuleToCondition,
  type ConditionRuleBuilderLabels,
  type SimpleConditionRule,
} from '@/components/process-automation/condition-rule-builder'
import type { FieldDefinition } from '@/lib/process-automation/definition-schemas'

type RuleKind = 'visibility' | 'required'
type RequiredMode = 'OPTIONAL' | 'ALWAYS' | 'CONDITION'

export interface FormFieldConditionsLabels {
  readonly title: string
  readonly visibility: string
  readonly alwaysVisible: string
  readonly visibleWhen: string
  readonly required: string
  readonly notRequired: string
  readonly alwaysRequired: string
  readonly requiredWhen: string
  readonly ruleExplanation: string
  readonly saveRule: string
  readonly cancel: string
  readonly edit: string
  readonly conditionUnavailable: string
  readonly noConditionFields: string
  readonly noWritableParticipants: string
}

function blankRule(fields: readonly FieldDefinition[]): SimpleConditionRule {
  const field = fields[0]
  return {
    fieldKey: field?.key ?? '',
    operator: field ? operatorsForFieldType(field.type)[0] ?? 'equals' : 'equals',
    value: '',
    values: [],
  }
}

function dependsOn(fieldKey: string, targetKey: string, fields: readonly FieldDefinition[], visited = new Set<string>()): boolean {
  if (fieldKey === targetKey) return true
  if (visited.has(fieldKey)) return false
  visited.add(fieldKey)
  const field = fields.find((candidate) => candidate.key === fieldKey)
  if (!field) return false
  const conditions = [field.visibilityCondition, field.requiredCondition].filter((condition) => condition !== undefined)
  return conditions.some((condition) => collectConditionFieldReferences(condition).some((reference) => reference === targetKey || dependsOn(reference, targetKey, fields, new Set(visited))))
}

function conditionSources(field: FieldDefinition, allFields: readonly FieldDefinition[]): FieldDefinition[] {
  const visibleParticipants = field.access.filter((rule) => rule.mode !== 'HIDDEN').map((rule) => rule.participantKey)
  if (visibleParticipants.length === 0) return []
  return allFields.filter((candidate) => candidate.key !== field.key
    && conditionBuilderFieldTypes.has(candidate.type)
    && !candidate.visibilityCondition
    && visibleParticipants.every((participantKey) => {
      const mode = candidate.access.find((rule) => rule.participantKey === participantKey)?.mode
      return mode !== undefined && mode !== 'HIDDEN'
    })
    && !dependsOn(candidate.key, field.key, allFields))
}

export function mutateRequiredAccess(field: FieldDefinition, mode: RequiredMode): FieldDefinition {
  const next = { ...field, access: field.access.map((rule) => {
    if (rule.mode !== 'WRITE_OPTIONAL' && rule.mode !== 'WRITE_REQUIRED') return rule
    return { ...rule, mode: mode === 'ALWAYS' ? 'WRITE_REQUIRED' as const : 'WRITE_OPTIONAL' as const }
  }) }
  if (mode !== 'CONDITION') delete next.requiredCondition
  return next
}

export function FormFieldConditionsEditor({
  field,
  fields,
  language,
  disabled,
  labels,
  ruleLabels,
  onChange,
}: {
  readonly field: FieldDefinition
  readonly fields: readonly FieldDefinition[]
  readonly language: 'nl' | 'en'
  readonly disabled: boolean
  readonly labels: FormFieldConditionsLabels
  readonly ruleLabels: ConditionRuleBuilderLabels
  readonly onChange: (next: FieldDefinition) => void
}) {
  const [editingRule, setEditingRule] = useState<RuleKind | null>(null)
  const [ruleDraft, setRuleDraft] = useState<SimpleConditionRule>(() => blankRule(conditionSources(field, fields)))
  const sourceFields = conditionSources(field, fields)
  const canSetRequired = bindingAllowsWrite(field.binding.kind)
    && field.access.some((rule) => rule.mode === 'WRITE_OPTIONAL' || rule.mode === 'WRITE_REQUIRED')
  const visibilityMode = editingRule === 'visibility' || field.visibilityCondition ? 'CONDITION' : 'ALWAYS'
  const requiredMode: RequiredMode = editingRule === 'required' || field.requiredCondition
    ? 'CONDITION'
    : field.access.some((rule) => rule.mode === 'WRITE_REQUIRED') ? 'ALWAYS' : 'OPTIONAL'
  const selectedField = sourceFields.find((candidate) => candidate.key === ruleDraft.fieldKey)
  const parsed = simpleRuleToCondition(selectedField, ruleDraft)

  function beginEdit(kind: RuleKind): void {
    const condition = kind === 'visibility' ? field.visibilityCondition : field.requiredCondition
    setRuleDraft(conditionToSimpleRule(condition, sourceFields) ?? blankRule(sourceFields))
    setEditingRule(kind)
  }

  function saveRule(): void {
    if (!parsed || !editingRule) return
    if (editingRule === 'visibility') onChange({ ...field, visibilityCondition: parsed })
    else onChange({ ...mutateRequiredAccess(field, 'CONDITION'), requiredCondition: parsed })
    setEditingRule(null)
  }

  function setVisibilityMode(mode: 'ALWAYS' | 'CONDITION'): void {
    if (mode === 'ALWAYS') {
      const next = { ...field }
      delete next.visibilityCondition
      onChange(next)
      if (editingRule === 'visibility') setEditingRule(null)
      return
    }
    if (!field.visibilityCondition) beginEdit('visibility')
  }

  function setRequiredMode(mode: RequiredMode): void {
    if (mode === 'CONDITION') {
      if (!field.requiredCondition) beginEdit('required')
      return
    }
    onChange(mutateRequiredAccess(field, mode))
    if (editingRule === 'required') setEditingRule(null)
  }

  function summary(kind: RuleKind): string | null {
    const condition = kind === 'visibility' ? field.visibilityCondition : field.requiredCondition
    return condition ? formatConditionRule(condition, sourceFields, language, ruleLabels) : null
  }

  return <section aria-label={labels.title} className="mt-4 grid min-w-0 gap-4 border-t border-border pt-4">
    <h5 className="text-sm font-semibold">{labels.title}</h5>
    <label className="grid min-w-0 gap-1.5 text-sm font-medium" htmlFor={`field-visibility-${field.key}`}>
      {labels.visibility}
      <select className="form-field min-w-0" disabled={disabled} id={`field-visibility-${field.key}`} onChange={(event) => setVisibilityMode(event.target.value as 'ALWAYS' | 'CONDITION')} value={visibilityMode}>
        <option value="ALWAYS">{labels.alwaysVisible}</option>
        <option value="CONDITION">{labels.visibleWhen}</option>
      </select>
    </label>
    {visibilityMode === 'CONDITION' && editingRule !== 'visibility' ? <div className="grid min-w-0 gap-2 rounded-[var(--radius-control)] bg-panel-soft p-3">
      <p className="text-sm">{summary('visibility') ?? labels.conditionUnavailable}</p>
      <Button disabled={disabled || sourceFields.length === 0} onClick={() => beginEdit('visibility')} size="sm" type="button" variant="secondary">{labels.edit}</Button>
    </div> : null}
    {editingRule === 'visibility' ? <div className="grid min-w-0 gap-3 rounded-[var(--radius-control)] border border-border p-3">
      {sourceFields.length > 0 ? <ConditionRuleBuilder disabled={disabled} fields={sourceFields} idPrefix={`field-visibility-rule-${field.key}`} labels={ruleLabels} language={language} onChange={setRuleDraft} rule={ruleDraft} />
        : <p className="text-sm text-danger" role="alert">{labels.noConditionFields}</p>}
      <p className="text-sm text-muted-foreground">{labels.ruleExplanation}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || !parsed} onClick={saveRule} size="sm" type="button" variant="primary">{labels.saveRule}</Button>
        <Button onClick={() => setEditingRule(null)} size="sm" type="button" variant="secondary">{labels.cancel}</Button>
      </div>
    </div> : null}
    <label className="grid min-w-0 gap-1.5 text-sm font-medium" htmlFor={`field-required-${field.key}`}>
      {labels.required}
      <select className="form-field min-w-0" disabled={disabled || !canSetRequired} id={`field-required-${field.key}`} onChange={(event) => setRequiredMode(event.target.value as RequiredMode)} value={requiredMode}>
        <option value="OPTIONAL">{labels.notRequired}</option>
        <option value="ALWAYS">{labels.alwaysRequired}</option>
        <option disabled={!canSetRequired} value="CONDITION">{labels.requiredWhen}</option>
      </select>
    </label>
    {!canSetRequired ? <p className="text-sm text-muted-foreground">{labels.noWritableParticipants}</p> : null}
    {requiredMode === 'CONDITION' && editingRule !== 'required' ? <div className="grid min-w-0 gap-2 rounded-[var(--radius-control)] bg-panel-soft p-3">
      <p className="text-sm">{summary('required') ?? labels.conditionUnavailable}</p>
      <Button disabled={disabled || !canSetRequired || sourceFields.length === 0} onClick={() => beginEdit('required')} size="sm" type="button" variant="secondary">{labels.edit}</Button>
    </div> : null}
    {editingRule === 'required' ? <div className="grid min-w-0 gap-3 rounded-[var(--radius-control)] border border-border p-3">
      {sourceFields.length > 0 ? <ConditionRuleBuilder disabled={disabled} fields={sourceFields} idPrefix={`field-required-rule-${field.key}`} labels={ruleLabels} language={language} onChange={setRuleDraft} rule={ruleDraft} />
        : <p className="text-sm text-danger" role="alert">{labels.noConditionFields}</p>}
      <p className="text-sm text-muted-foreground">{labels.ruleExplanation}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || !canSetRequired || !parsed} onClick={saveRule} size="sm" type="button" variant="primary">{labels.saveRule}</Button>
        <Button onClick={() => setEditingRule(null)} size="sm" type="button" variant="secondary">{labels.cancel}</Button>
      </div>
    </div> : null}
  </section>
}
