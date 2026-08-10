import type { FieldBinding, FieldType } from './definition-schemas'

export type FormBindingKind = FieldBinding['kind']

export const formBindingKindValues = [
  'PROCESS_ONLY',
  'DOMAIN_READ',
  'DOMAIN_PROPOSAL',
  'COMPUTED',
] as const satisfies readonly FormBindingKind[]

export interface FormBindingCatalogEntry {
  readonly id: string
  readonly kind: FormBindingKind
  readonly type: FieldType | null
  readonly key?: string
  readonly formulaKey?: string
  readonly value: FieldBinding
}

/**
 * The binding registry is deliberately developer-owned. The studio can only
 * choose entries from this list; it never accepts a table, column, SQL
 * expression, or arbitrary formula from an administrator.
 */
export const formBindingCatalog = [
  {
    id: 'process-only',
    kind: 'PROCESS_ONLY',
    type: null,
    value: { kind: 'PROCESS_ONLY' },
  },
  {
    id: 'employee-current-employee',
    kind: 'DOMAIN_READ',
    type: 'EMPLOYEE_REFERENCE',
    key: 'employee.current.employee',
    value: { kind: 'DOMAIN_READ', key: 'employee.current.employee' },
  },
  {
    id: 'employee-current-employment',
    kind: 'DOMAIN_READ',
    type: 'EMPLOYMENT_REFERENCE',
    key: 'employee.current.employment',
    value: { kind: 'DOMAIN_READ', key: 'employee.current.employment' },
  },
  {
    id: 'employee-current-department',
    kind: 'DOMAIN_READ',
    type: 'DEPARTMENT_REFERENCE',
    key: 'employee.current.department',
    value: { kind: 'DOMAIN_READ', key: 'employee.current.department' },
  },
  {
    id: 'employee-current-job',
    kind: 'DOMAIN_READ',
    type: 'JOB_REFERENCE',
    key: 'employee.current.job',
    value: { kind: 'DOMAIN_READ', key: 'employee.current.job' },
  },
  {
    id: 'employee-current-manager',
    kind: 'DOMAIN_READ',
    type: 'EMPLOYEE_REFERENCE',
    key: 'employee.current.manager',
    value: { kind: 'DOMAIN_READ', key: 'employee.current.manager' },
  },
  {
    id: 'employee-current-name',
    kind: 'DOMAIN_READ',
    type: 'SHORT_TEXT',
    key: 'employee.current.name',
    value: { kind: 'DOMAIN_READ', key: 'employee.current.name' },
  },
  {
    id: 'employee-document',
    kind: 'DOMAIN_READ',
    type: 'DOCUMENT_REFERENCE',
    key: 'employee.document',
    value: { kind: 'DOMAIN_READ', key: 'employee.document' },
  },
  {
    id: 'employment-current-starts-on',
    kind: 'DOMAIN_READ',
    type: 'DATE',
    key: 'employment.current.startsOn',
    value: { kind: 'DOMAIN_READ', key: 'employment.current.startsOn' },
  },
  {
    id: 'employment-current-ends-on',
    kind: 'DOMAIN_READ',
    type: 'DATE',
    key: 'employment.current.endsOn',
    value: { kind: 'DOMAIN_READ', key: 'employment.current.endsOn' },
  },
  {
    id: 'employment-current-type',
    kind: 'DOMAIN_READ',
    type: 'SHORT_TEXT',
    key: 'employment.current.type',
    value: { kind: 'DOMAIN_READ', key: 'employment.current.type' },
  },
  {
    id: 'employment-current-contract-type',
    kind: 'DOMAIN_READ',
    type: 'SHORT_TEXT',
    key: 'employment.current.contractType',
    value: { kind: 'DOMAIN_READ', key: 'employment.current.contractType' },
  },
  {
    id: 'employment-change-target-department',
    kind: 'DOMAIN_PROPOSAL',
    type: 'DEPARTMENT_REFERENCE',
    key: 'employment.organizationChange.targetDepartment',
    value: { kind: 'DOMAIN_PROPOSAL', key: 'employment.organizationChange.targetDepartment' },
  },
  {
    id: 'employment-change-target-job',
    kind: 'DOMAIN_PROPOSAL',
    type: 'JOB_REFERENCE',
    key: 'employment.organizationChange.targetJob',
    value: { kind: 'DOMAIN_PROPOSAL', key: 'employment.organizationChange.targetJob' },
  },
  {
    id: 'employment-change-effective-on',
    kind: 'DOMAIN_PROPOSAL',
    type: 'DATE',
    key: 'employment.organizationChange.effectiveOn',
    value: { kind: 'DOMAIN_PROPOSAL', key: 'employment.organizationChange.effectiveOn' },
  },
  {
    id: 'subject-has-employee',
    kind: 'COMPUTED',
    type: 'BOOLEAN',
    formulaKey: 'subject-has-employee',
    value: { kind: 'COMPUTED', formulaKey: 'subject-has-employee' },
  },
  {
    id: 'subject-has-employment',
    kind: 'COMPUTED',
    type: 'BOOLEAN',
    formulaKey: 'subject-has-employment',
    value: { kind: 'COMPUTED', formulaKey: 'subject-has-employment' },
  },
  {
    id: 'subject-has-department',
    kind: 'COMPUTED',
    type: 'BOOLEAN',
    formulaKey: 'subject-has-department',
    value: { kind: 'COMPUTED', formulaKey: 'subject-has-department' },
  },
  {
    id: 'subject-display-name',
    kind: 'COMPUTED',
    type: 'SHORT_TEXT',
    formulaKey: 'subject-display-name',
    value: { kind: 'COMPUTED', formulaKey: 'subject-display-name' },
  },
  {
    id: 'employment-tenure-years',
    kind: 'COMPUTED',
    type: 'DECIMAL',
    formulaKey: 'employment-tenure-years',
    value: { kind: 'COMPUTED', formulaKey: 'employment-tenure-years' },
  },
  {
    id: 'process-business-effective-date',
    kind: 'COMPUTED',
    type: 'DATE',
    formulaKey: 'process-business-effective-date',
    value: { kind: 'COMPUTED', formulaKey: 'process-business-effective-date' },
  },
  {
    id: 'employment-active-on-business-date',
    kind: 'COMPUTED',
    type: 'BOOLEAN',
    formulaKey: 'employment-active-on-business-date',
    value: { kind: 'COMPUTED', formulaKey: 'employment-active-on-business-date' },
  },
] as const satisfies readonly FormBindingCatalogEntry[]

export function bindingCatalogEntry(binding: FieldBinding): FormBindingCatalogEntry | undefined {
  return formBindingCatalog.find((entry) => {
    if (entry.kind !== binding.kind) return false
    if (binding.kind === 'PROCESS_ONLY') return true
    if (binding.kind === 'DOMAIN_READ' || binding.kind === 'DOMAIN_PROPOSAL') {
      return entry.kind === binding.kind && entry.key === binding.key
    }
    return entry.kind === 'COMPUTED' && entry.formulaKey === binding.formulaKey
  })
}

export function bindingCatalogForFieldType(fieldType: FieldType): readonly FormBindingCatalogEntry[] {
  return formBindingCatalog.filter((entry) => entry.type === null || entry.type === fieldType)
}

export function bindingAllowsWrite(kind: FormBindingKind): boolean {
  return kind === 'PROCESS_ONLY' || kind === 'DOMAIN_PROPOSAL'
}
