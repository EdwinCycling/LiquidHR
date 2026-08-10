import { requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { FormRuntimeError, getProcessFormProjection } from './form-runtime-service'
import type { FormFieldProjection } from './form-runtime'

export interface FormReferenceOption {
  readonly value: string
  readonly label: string
  readonly meta: string | null
}

type ReferenceFieldType = 'EMPLOYEE_REFERENCE' | 'DEPARTMENT_REFERENCE' | 'JOB_REFERENCE' | 'EMPLOYMENT_REFERENCE' | 'DOCUMENT_REFERENCE'

const referenceFieldTypes = new Set<ReferenceFieldType>([
  'EMPLOYEE_REFERENCE',
  'DEPARTMENT_REFERENCE',
  'JOB_REFERENCE',
  'EMPLOYMENT_REFERENCE',
  'DOCUMENT_REFERENCE',
])

function asReferenceField(field: FormFieldProjection): ReferenceFieldType | null {
  return referenceFieldTypes.has(field.type as ReferenceFieldType) ? field.type as ReferenceFieldType : null
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function filterOptions(options: readonly FormReferenceOption[], search: string): readonly FormReferenceOption[] {
  const query = normalized(search)
  if (!query) return options.slice(0, 25)
  return options
    .filter((option) => `${option.label} ${option.meta ?? ''} ${option.value}`.toLocaleLowerCase().includes(query))
    .slice(0, 25)
}

function findField(workItemId: string, fields: readonly FormFieldProjection[], fieldKey: string): FormFieldProjection {
  const field = fields.find((candidate) => candidate.key === fieldKey)
  if (!field) throw new FormRuntimeError('UNKNOWN_FORM_FIELD', 400, `UNKNOWN_FORM_FIELD: ${workItemId}:${fieldKey}`)
  if (field.accessMode === 'READ') throw new FormRuntimeError('FIELD_NOT_WRITABLE', 403, `FIELD_NOT_WRITABLE: ${fieldKey}`)
  if (!asReferenceField(field)) throw new FormRuntimeError('INVALID_FORM_VALUE', 400, `INVALID_FORM_VALUE: ${fieldKey}`)
  return field
}

export async function getFormReferenceOptions(
  workItemId: string,
  fieldKey: string,
  language: 'nl' | 'en',
  search = '',
): Promise<readonly FormReferenceOption[]> {
  const projection = await getProcessFormProjection(workItemId, language)
  const field = findField(workItemId, projection.sections.flatMap((section) => section.fields), fieldKey)
  const fieldType = asReferenceField(field)
  if (!fieldType) throw new FormRuntimeError('INVALID_FORM_VALUE', 400, `INVALID_FORM_VALUE: ${fieldKey}`)

  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  if (!context.hrGroupId) throw new FormRuntimeError('FORBIDDEN', 403)

  if (fieldType === 'DEPARTMENT_REFERENCE') {
    const result = await supabase.from('departments')
      .select('id, code, name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('is_active', true)
      .order('name')
      .limit(500)
    if (result.error) throw new FormRuntimeError('PROCESS_FORM_RUNTIME_OPERATION_FAILED', 500)
    return filterOptions((result.data ?? []).map((department) => ({ value: department.id, label: department.name, meta: department.code })), search)
  }

  if (fieldType === 'JOB_REFERENCE') {
    const result = await supabase.from('jobs')
      .select('id, code')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('is_active', true)
      .order('code')
      .limit(500)
    if (result.error) throw new FormRuntimeError('PROCESS_FORM_RUNTIME_OPERATION_FAILED', 500)
    return filterOptions((result.data ?? []).map((job) => ({ value: job.id, label: job.code, meta: null })), search)
  }

  if (fieldType === 'EMPLOYEE_REFERENCE') {
    const result = await supabase.from('employees')
      .select('id, employee_number, first_name, birth_name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('is_active', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('employee_number')
      .limit(500)
    if (result.error) throw new FormRuntimeError('PROCESS_FORM_RUNTIME_OPERATION_FAILED', 500)
    return filterOptions((result.data ?? []).map((employee) => ({
      value: employee.id,
      label: `${employee.first_name} ${employee.birth_name}`.trim(),
      meta: employee.employee_number,
    })), search)
  }

  if (fieldType === 'DOCUMENT_REFERENCE') {
    if (!context.administrationId) return []
    const result = await supabase.from('employee_documents')
      .select('id, title, original_filename, expires_on')
      .eq('tenant_id', context.tenantId)
      .eq('administration_id', context.administrationId)
      .is('deleted_at', null)
      .order('title')
      .limit(500)
    if (result.error) throw new FormRuntimeError('PROCESS_FORM_RUNTIME_OPERATION_FAILED', 500)
    return filterOptions((result.data ?? []).map((document) => ({
      value: document.id,
      label: document.title || document.original_filename,
      meta: document.title && document.original_filename !== document.title ? document.original_filename : document.expires_on,
    })), search)
  }

  const result = await supabase.from('employments')
    .select('id, employment_number, employee_id, starts_on, ends_on')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .is('deleted_at', null)
    .order('starts_on', { ascending: false })
    .limit(500)
  if (result.error) throw new FormRuntimeError('PROCESS_FORM_RUNTIME_OPERATION_FAILED', 500)
  return filterOptions((result.data ?? []).map((employment) => ({
    value: employment.id,
    label: employment.employment_number,
    meta: `${employment.starts_on}${employment.ends_on ? ` – ${employment.ends_on}` : ''}`,
  })), search)
}
