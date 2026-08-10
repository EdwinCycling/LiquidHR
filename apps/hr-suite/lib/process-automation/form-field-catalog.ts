import type { FieldDefinition, FieldType } from './definition-schemas'

export type FormFieldGroup = 'INPUT' | 'CHOICE' | 'REFERENCE'

export interface FormFieldCatalogEntry {
  readonly key: string
  readonly type: FieldType
  readonly group: FormFieldGroup
}

export const formFieldCatalog = [
  { key: 'short-text', type: 'SHORT_TEXT', group: 'INPUT' },
  { key: 'long-text', type: 'LONG_TEXT', group: 'INPUT' },
  { key: 'integer', type: 'INTEGER', group: 'INPUT' },
  { key: 'decimal', type: 'DECIMAL', group: 'INPUT' },
  { key: 'money', type: 'MONEY', group: 'INPUT' },
  { key: 'date', type: 'DATE', group: 'INPUT' },
  { key: 'time', type: 'TIME', group: 'INPUT' },
  { key: 'datetime', type: 'DATETIME', group: 'INPUT' },
  { key: 'boolean', type: 'BOOLEAN', group: 'INPUT' },
  { key: 'single-select', type: 'SINGLE_SELECT', group: 'CHOICE' },
  { key: 'multi-select', type: 'MULTI_SELECT', group: 'CHOICE' },
  { key: 'employee-reference', type: 'EMPLOYEE_REFERENCE', group: 'REFERENCE' },
  { key: 'department-reference', type: 'DEPARTMENT_REFERENCE', group: 'REFERENCE' },
  { key: 'job-reference', type: 'JOB_REFERENCE', group: 'REFERENCE' },
  { key: 'employment-reference', type: 'EMPLOYMENT_REFERENCE', group: 'REFERENCE' },
  { key: 'document-reference', type: 'DOCUMENT_REFERENCE', group: 'REFERENCE' },
] as const satisfies readonly FormFieldCatalogEntry[]

export const formFieldGroups: readonly FormFieldGroup[] = ['INPUT', 'CHOICE', 'REFERENCE']

export function defaultOptionsForFieldType(fieldType: FieldType): FieldDefinition['options'] {
  if (fieldType !== 'SINGLE_SELECT' && fieldType !== 'MULTI_SELECT') return undefined
  return [
    { value: 'option-1', label: { nl: 'Optie 1', en: 'Option 1' } },
    { value: 'option-2', label: { nl: 'Optie 2', en: 'Option 2' } },
  ]
}
