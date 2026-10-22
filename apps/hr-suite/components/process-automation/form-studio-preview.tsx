'use client'

import { useMemo, useState } from 'react'
import { evaluateCondition, type ConditionRuntimeValue } from '@/lib/process-automation/condition-evaluator'
import type { FieldDefinition, FormDefinition, FormSection } from '@/lib/process-automation/definition-schemas'
import type { FormJsonValue } from '@/lib/process-automation/form-runtime'

export interface FormPreviewLabels {
  readonly syntheticData: string
  readonly noValue: string
  readonly previewHidden: string
  readonly previewRequired: string
  readonly fieldTypeLabels: Readonly<Record<string, string>>
}

interface PreviewFieldState {
  readonly field: FieldDefinition
  readonly accessMode: 'HIDDEN' | 'READ' | 'WRITE_OPTIONAL' | 'WRITE_REQUIRED'
  readonly visible: boolean
  readonly required: boolean
}

function scalarValues(values: Readonly<Record<string, FormJsonValue>>): Record<string, ConditionRuntimeValue> {
  const fields: Record<string, ConditionRuntimeValue> = {}
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') fields[key] = value
    else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) fields[key] = value as string[]
  })
  return fields
}

export function evaluateFormPreview(
  form: FormDefinition,
  participantKey: string,
  values: Readonly<Record<string, FormJsonValue>>,
): readonly PreviewFieldState[] {
  const context = { fields: scalarValues(values), subject: {} }
  return form.sections.flatMap((section) => section.fields.map((field) => {
    const accessMode = field.access.find((rule) => rule.participantKey === participantKey)?.mode ?? 'HIDDEN'
    const visible = accessMode !== 'HIDDEN' && (!field.visibilityCondition || evaluateCondition(field.visibilityCondition, context))
    const required = visible && (accessMode === 'WRITE_REQUIRED'
      || (accessMode === 'WRITE_OPTIONAL' && Boolean(field.requiredCondition && evaluateCondition(field.requiredCondition, context))))
    return { field, accessMode, visible, required }
  }))
}

function inputValue(field: FieldDefinition, value: FormJsonValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (field.type === 'EMPLOYEE_REFERENCE' || field.type === 'DEPARTMENT_REFERENCE' || field.type === 'JOB_REFERENCE' || field.type === 'EMPLOYMENT_REFERENCE' || field.type === 'DOCUMENT_REFERENCE') return ''
  if (typeof value === 'object') return ''
  return String(value)
}

function PreviewFieldControl({
  field,
  value,
  language,
  labels,
  id,
  labelId,
  onChange,
}: {
  readonly field: FieldDefinition
  readonly value: FormJsonValue | undefined
  readonly language: 'nl' | 'en'
  readonly labels: FormPreviewLabels
  readonly id: string
  readonly labelId: string
  readonly onChange: (value: FormJsonValue) => void
}) {
  const inputClass = 'mt-1 w-full min-w-0 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 font-normal focus-visible:outline-2 focus-visible:outline-primary'
  const typeLabel = labels.fieldTypeLabels[field.type] ?? field.type
  if (field.type === 'LONG_TEXT') return <textarea aria-labelledby={labelId} className={`${inputClass} min-h-24`} id={id} onChange={(event) => onChange(event.target.value)} placeholder={typeLabel} value={inputValue(field, value)} />
  if (field.type === 'BOOLEAN') return <label className="mt-1 flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 font-normal">
    <input aria-labelledby={labelId} checked={value === true} id={id} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    <span>{typeLabel}</span>
  </label>
  if (field.type === 'SINGLE_SELECT') return <select aria-labelledby={labelId} className={inputClass} id={id} onChange={(event) => onChange(event.target.value || null)} value={inputValue(field, value)}>
    <option value="">{labels.noValue}</option>
    {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label[language] ?? option.label.nl ?? option.value}</option>)}
  </select>
  if (field.type === 'MULTI_SELECT') return <fieldset aria-labelledby={labelId} className="mt-1 grid gap-2 rounded-[var(--radius-control)] border border-border bg-surface p-3" id={id}>
    <legend className="sr-only">{typeLabel}</legend>
    {(field.options ?? []).map((option, index) => {
      const selected = Array.isArray(value) && value.includes(option.value)
      const optionId = `${id}-${index}`
      return <label className="flex min-w-0 items-center gap-3 font-normal" htmlFor={optionId} key={option.value}>
        <input checked={selected} id={optionId} onChange={(event) => {
          const selectedValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
          onChange(event.target.checked ? [...selectedValues, option.value] : selectedValues.filter((item) => item !== option.value))
        }} type="checkbox" />
        {option.label[language] ?? option.label.nl ?? option.value}
      </label>
    })}
  </fieldset>
  if (field.type === 'EMPLOYEE_REFERENCE' || field.type === 'DEPARTMENT_REFERENCE' || field.type === 'JOB_REFERENCE' || field.type === 'EMPLOYMENT_REFERENCE' || field.type === 'DOCUMENT_REFERENCE') return <div aria-labelledby={labelId} className="mt-1 rounded-[var(--radius-control)] border border-border bg-panel-soft px-3 py-2 text-sm font-normal text-muted-foreground" id={id} role="status">{typeLabel} · {labels.syntheticData}</div>
  const inputType = field.type === 'DATE' ? 'date' : field.type === 'TIME' ? 'time' : field.type === 'DATETIME' ? 'datetime-local' : field.type === 'INTEGER' || field.type === 'DECIMAL' || field.type === 'MONEY' ? 'number' : 'text'
  const step = field.type === 'INTEGER' ? '1' : field.type === 'DECIMAL' || field.type === 'MONEY' ? 'any' : undefined
  return <input aria-labelledby={labelId} className={inputClass} id={id} onChange={(event) => {
    if (event.target.value === '') {
      onChange(null)
      return
    }
    if (field.type === 'INTEGER') {
      const parsed = Number(event.target.value)
      onChange(Number.isInteger(parsed) ? parsed : null)
    } else if (field.type === 'DECIMAL' || field.type === 'MONEY') {
      const parsed = Number(event.target.value)
      onChange(Number.isFinite(parsed) ? parsed : null)
    } else onChange(event.target.value)
  }} placeholder={typeLabel} step={step} type={inputType} value={inputValue(field, value)} />
}

function visibleForPreview(field: FieldDefinition, participantKey: string, values: Readonly<Record<string, FormJsonValue>>): boolean {
  const access = field.access.find((rule) => rule.participantKey === participantKey)?.mode ?? 'HIDDEN'
  if (access === 'HIDDEN') return false
  if (!field.visibilityCondition) return true
  return evaluateCondition(field.visibilityCondition, { fields: scalarValues(values), subject: {} })
}

export function updateFormPreviewValues(
  form: FormDefinition,
  participantKey: string,
  currentValues: Readonly<Record<string, FormJsonValue>>,
  fieldKey: string,
  value: FormJsonValue,
): Record<string, FormJsonValue> {
  const next = { ...currentValues, [fieldKey]: value }
  const fields = form.sections.flatMap((section) => section.fields)
  for (let pass = 0; pass <= fields.length; pass += 1) {
    const hiddenKeys = fields
      .filter((field) => field.access.find((rule) => rule.participantKey === participantKey)?.mode !== 'HIDDEN')
      .filter((field) => field.visibilityCondition && !visibleForPreview(field, participantKey, next))
      .map((field) => field.key)
    if (hiddenKeys.length === 0) break
    hiddenKeys.forEach((key) => { delete next[key] })
  }
  return next
}

export function FormStudioPreview({
  form,
  participantKey,
  language,
  labels,
}: {
  readonly form: FormDefinition
  readonly participantKey: string
  readonly language: 'nl' | 'en'
  readonly labels: FormPreviewLabels
}) {
  const [values, setValues] = useState<Record<string, FormJsonValue>>({})
  const fieldStates = useMemo(() => evaluateFormPreview(form, participantKey, values), [form, participantKey, values])
  const stateByKey = new Map(fieldStates.map((state) => [state.field.key, state]))
  const hiddenConditional = fieldStates.filter((state) => state.accessMode !== 'HIDDEN' && state.field.visibilityCondition && !state.visible)

  function setFieldValue(fieldKey: string, value: FormJsonValue): void {
    setValues((current) => updateFormPreviewValues(form, participantKey, current, fieldKey, value))
  }

  return <div className="grid min-w-0 gap-5">
    <p className="rounded-[var(--radius-control)] bg-accent/50 px-3 py-2 text-xs font-semibold text-primary">{labels.syntheticData}</p>
    {form.sections.map((section: FormSection) => {
      const visible = section.fields.flatMap((field) => {
        const state = stateByKey.get(field.key)
        return state?.visible ? [{ field, required: state.required }] : []
      })
      if (visible.length === 0) return null
      return <fieldset className="grid min-w-0 gap-4" key={section.key}>
        <legend className="font-semibold">{section.title[language] ?? section.title.nl ?? section.key}</legend>
        <div className="grid min-w-0 gap-4">
          {visible.map(({ field, required }) => {
            const id = `studio-preview-${field.key}`
            const labelId = `${id}-label`
            return <div className="grid min-w-0 gap-1 text-sm font-semibold" key={field.key}>
              <p id={labelId}>{field.label[language] ?? field.label.nl ?? field.key}{required ? <><span aria-hidden="true" className="ml-1 text-danger">*</span><span className="sr-only"> {labels.previewRequired}</span></> : null}</p>
              {field.helpText ? <p className="text-xs font-normal text-muted-foreground">{field.helpText[language] ?? field.helpText.nl}</p> : null}
              <PreviewFieldControl field={field} id={id} labelId={labelId} labels={labels} language={language} onChange={(value) => setFieldValue(field.key, value)} value={values[field.key]} />
            </div>
          })}
        </div>
      </fieldset>
    })}
    {hiddenConditional.length > 0 ? <p className="text-sm text-muted-foreground" role="status">
      {hiddenConditional.map(({ field }) => labels.previewHidden.replace('{field}', field.label[language] ?? field.label.nl ?? field.key)).join(' ')}
    </p> : null}
  </div>
}
