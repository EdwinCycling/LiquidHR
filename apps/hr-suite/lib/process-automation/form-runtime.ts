import { z } from 'zod'

const formJsonValueSchema: z.ZodType<FormJsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(formJsonValueSchema),
  z.record(z.string(), formJsonValueSchema),
]))

export type FormJsonValue = string | number | boolean | null | FormJsonValue[] | { readonly [key: string]: FormJsonValue }

export const formValuesSchema = z.object({
  current: z.record(z.string(), formJsonValueSchema).optional().default({}),
  new: z.record(z.string(), formJsonValueSchema).optional().default({}),
}).strict()

export type FormValues = z.infer<typeof formValuesSchema>

const projectedFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  helpText: z.string().nullable(),
  type: z.string(),
  accessMode: z.enum(['READ', 'WRITE_OPTIONAL', 'WRITE_REQUIRED']),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() }).strict()),
  currentValue: formJsonValueSchema,
  newValue: formJsonValueSchema,
}).strict()

export const formProjectionSchema = z.object({
  responseId: z.string().uuid().nullable(),
  workItemId: z.string().uuid(),
  processInstanceId: z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  stepKey: z.string(),
  participantKey: z.string(),
  formKey: z.string(),
  formVersionId: z.string().uuid().nullable(),
  language: z.enum(['nl', 'en']),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'STALE']),
  revision: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string().nullable(),
  sections: z.array(z.object({
    key: z.string(),
    title: z.string(),
    fields: z.array(projectedFieldSchema),
  }).strict()),
  summary: z.array(z.object({
    fieldKey: z.string(),
    label: z.string(),
    currentValue: formJsonValueSchema,
    newValue: formJsonValueSchema,
  }).strict()),
  htmlSummary: z.string(),
  availableLanguages: z.array(z.string()),
}).strict()

export type FormProjection = z.infer<typeof formProjectionSchema>
export type FormFieldProjection = z.infer<typeof projectedFieldSchema>

export type FormRuntimeValidationCode =
  | 'FORM_FIELD_UNKNOWN'
  | 'FORM_FIELD_HIDDEN'
  | 'FORM_FIELD_READ_ONLY'
  | 'FORM_FIELD_REQUIRED'
  | 'FORM_FIELD_INVALID'

export class FormRuntimeValidationError extends Error {
  constructor(readonly code: FormRuntimeValidationCode, readonly fieldKey?: string) {
    super(code)
    this.name = 'FormRuntimeValidationError'
  }
}

function isEmptyValue(value: FormJsonValue | undefined): boolean {
  return value === undefined
    || value === null
    || (typeof value === 'string' && value.trim() === '')
    || (Array.isArray(value) && value.length === 0)
}

function optionValues(field: FormFieldProjection): ReadonlySet<string> {
  return new Set(field.options.map((option) => option.value))
}

export function isFormValueValid(field: FormFieldProjection, value: FormJsonValue | undefined): boolean {
  if (isEmptyValue(value)) return !field.required
  switch (field.type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
      return typeof value === 'string' && value.length <= 4000
    case 'INTEGER':
      return typeof value === 'number' && Number.isInteger(value)
    case 'DECIMAL':
    case 'MONEY':
      return typeof value === 'number' && Number.isFinite(value)
    case 'DATE':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    case 'TIME':
      return typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)
    case 'DATETIME':
      return typeof value === 'string' && value.length > 0
    case 'BOOLEAN':
      return typeof value === 'boolean'
    case 'SINGLE_SELECT':
      return typeof value === 'string' && optionValues(field).has(value)
    case 'MULTI_SELECT':
      return Array.isArray(value) && value.every((item) => typeof item === 'string' && optionValues(field).has(item))
    case 'EMPLOYEE_REFERENCE':
    case 'DEPARTMENT_REFERENCE':
    case 'JOB_REFERENCE':
    case 'EMPLOYMENT_REFERENCE':
    case 'DOCUMENT_REFERENCE': {
      const candidate = typeof value === 'string' ? value : typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value.id === 'string' ? value.id : null
      return candidate !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)
    }
    default:
      return false
  }
}

export function buildVisibleFormPayload(
  projection: FormProjection,
  newValues: Readonly<Record<string, FormJsonValue>>,
  changedFieldKeys?: ReadonlySet<string>,
): FormValues {
  const fields = projection.sections.flatMap((section) => section.fields)
  const byKey = new Map(fields.map((field) => [field.key, field]))
  const visibleValues: Record<string, FormJsonValue> = {}
  Object.entries(newValues).forEach(([fieldKey, value]) => {
    if (changedFieldKeys && !changedFieldKeys.has(fieldKey)) return
    const field = byKey.get(fieldKey)
    if (!field) throw new FormRuntimeValidationError('FORM_FIELD_UNKNOWN', fieldKey)
    if (field.accessMode === 'READ') throw new FormRuntimeValidationError('FORM_FIELD_READ_ONLY', fieldKey)
    if (!isFormValueValid(field, value)) throw new FormRuntimeValidationError(field.required ? 'FORM_FIELD_REQUIRED' : 'FORM_FIELD_INVALID', fieldKey)
    visibleValues[fieldKey] = value
  })
  fields.forEach((field) => {
    if (!field.required || field.accessMode === 'READ') return
    if (!(field.key in visibleValues) && isEmptyValue(field.newValue)) throw new FormRuntimeValidationError('FORM_FIELD_REQUIRED', field.key)
  })
  return { current: {}, new: visibleValues }
}

export function visibleFields(projection: FormProjection): readonly FormFieldProjection[] {
  return projection.sections.flatMap((section) => section.fields)
}

export interface FormValueLabels {
  readonly noValue: string
  readonly booleanTrue: string
  readonly booleanFalse: string
}

export function displayFormValue(value: FormJsonValue, labels: FormValueLabels): string {
  if (value === null) return labels.noValue
  if (typeof value === 'boolean') return value ? labels.booleanTrue : labels.booleanFalse
  if (Array.isArray(value)) return value.map((item) => displayFormValue(item, labels)).join(', ')
  if (typeof value === 'object') return typeof value.label === 'string' ? value.label : typeof value.id === 'string' ? value.id : JSON.stringify(value)
  return String(value)
}
