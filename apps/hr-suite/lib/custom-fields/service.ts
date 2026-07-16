import type { Database, Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  CustomFieldDefinitionInput,
  CustomFieldDefinitionUpdateInput,
  CustomFieldValuesInput,
} from './schemas'

type DefinitionRow = Database['public']['Tables']['custom_field_definitions']['Row']
type OptionRow = Database['public']['Tables']['custom_field_select_options']['Row']

export class CustomFieldServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'CustomFieldServiceError'
  }
}

export interface CustomFieldDefinition {
  id: string
  key: string
  labelNl: string
  labelEn: string
  descriptionNl: string | null
  descriptionEn: string | null
  fieldType: DefinitionRow['field_type']
  isRequired: boolean
  hrAccess: DefinitionRow['hr_access']
  managerAccess: DefinitionRow['manager_access']
  employeeSelfAccess: DefinitionRow['employee_self_access']
  sortOrder: number
  isActive: boolean
  updatedAt: string
  options: Array<{
    id: string
    value: string
    labelNl: string
    labelEn: string
    sortOrder: number
    isActive: boolean
  }>
}

export interface EmployeeCustomField extends CustomFieldDefinition {
  access: DefinitionRow['hr_access']
  value: Json | undefined
}

function requireAdministration(administrationId: string | null): string {
  if (!administrationId) throw new CustomFieldServiceError('ADMINISTRATION_REQUIRED', 400)
  return administrationId
}

function toDefinition(row: DefinitionRow, options: OptionRow[]): CustomFieldDefinition {
  return {
    id: row.id,
    key: row.key,
    labelNl: row.label_nl,
    labelEn: row.label_en,
    descriptionNl: row.description_nl,
    descriptionEn: row.description_en,
    fieldType: row.field_type,
    isRequired: row.is_required,
    hrAccess: row.hr_access,
    managerAccess: row.manager_access,
    employeeSelfAccess: row.employee_self_access,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    options: options.filter((option) => option.definition_id === row.id).map((option) => ({
      id: option.id,
      value: option.value,
      labelNl: option.label_nl,
      labelEn: option.label_en,
      sortOrder: option.sort_order,
      isActive: option.is_active,
    })),
  }
}

export async function listCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
  const context = await requirePermission('custom-field-values:read')
  const administrationId = requireAdministration(context.administrationId)
  const supabase = await createClient()
  const [{ data: definitions, error }, { data: options, error: optionsError }] = await Promise.all([
    supabase.from('custom_field_definitions').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .is('deleted_at', null).order('sort_order').order('key'),
    supabase.from('custom_field_select_options').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .order('sort_order').order('value'),
  ])
  if (error || optionsError) throw new CustomFieldServiceError('CUSTOM_FIELDS_READ_FAILED', 500)
  return (definitions ?? []).map((row) => toDefinition(row, options ?? []))
}

export async function createCustomFieldDefinition(
  input: CustomFieldDefinitionInput,
): Promise<CustomFieldDefinition> {
  const context = await requirePermission('custom-fields:write')
  const administrationId = requireAdministration(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('custom_field_definitions').insert({
    tenant_id: context.tenantId,
    administration_id: administrationId,
    key: input.key,
    label_nl: input.labelNl,
    label_en: input.labelEn,
    description_nl: input.descriptionNl ?? null,
    description_en: input.descriptionEn ?? null,
    field_type: input.fieldType,
    is_required: input.isRequired,
    hr_access: input.hrAccess,
    manager_access: input.managerAccess,
    employee_self_access: input.employeeSelfAccess,
    sort_order: input.sortOrder,
  }).select('*').single()
  if (error?.code === '23505') throw new CustomFieldServiceError('CUSTOM_FIELD_KEY_CONFLICT', 409)
  if (error || !data) throw new CustomFieldServiceError('CUSTOM_FIELD_CREATE_FAILED', 500)

  let optionRows: OptionRow[] = []
  if (input.options.length > 0) {
    const { data: createdOptions, error: optionError } = await supabase
      .from('custom_field_select_options')
      .insert(input.options.map((option) => ({
        tenant_id: context.tenantId,
        administration_id: administrationId,
        definition_id: data.id,
        value: option.value,
        label_nl: option.labelNl,
        label_en: option.labelEn,
        sort_order: option.sortOrder,
      }))).select('*')
    if (optionError) {
      await supabase.from('custom_field_definitions').update({
        is_active: false, deleted_at: new Date().toISOString(),
      }).eq('id', data.id)
      throw new CustomFieldServiceError('CUSTOM_FIELD_OPTIONS_CREATE_FAILED', 500)
    }
    optionRows = createdOptions ?? []
  }
  return toDefinition(data, optionRows)
}

export async function updateCustomFieldDefinition(
  definitionId: string,
  input: CustomFieldDefinitionUpdateInput,
): Promise<CustomFieldDefinition> {
  const context = await requirePermission('custom-fields:write')
  const administrationId = requireAdministration(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('custom_field_definitions').update({
    label_nl: input.labelNl,
    label_en: input.labelEn,
    description_nl: input.descriptionNl,
    description_en: input.descriptionEn,
    is_required: input.isRequired,
    hr_access: input.hrAccess,
    manager_access: input.managerAccess,
    employee_self_access: input.employeeSelfAccess,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  }).eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
    .eq('id', definitionId).is('deleted_at', null).select('*').maybeSingle()
  if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_UPDATE_FAILED', 500)
  if (!data) throw new CustomFieldServiceError('CUSTOM_FIELD_NOT_FOUND', 404)
  const { data: options } = await supabase.from('custom_field_select_options')
    .select('*').eq('definition_id', definitionId).order('sort_order')
  return toDefinition(data, options ?? [])
}

export async function archiveCustomFieldDefinition(definitionId: string): Promise<void> {
  await updateCustomFieldDefinition(definitionId, { isActive: false })
  const context = await requirePermission('custom-fields:write')
  const administrationId = requireAdministration(context.administrationId)
  const supabase = await createClient()
  const { error } = await supabase.from('custom_field_definitions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('id', definitionId)
  if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_ARCHIVE_FAILED', 500)
}

export async function getEmployeeCustomFieldValues(employeeId: string): Promise<Json> {
  const context = await requirePermission('employee:read', employeeId)
  const administrationId = requireAdministration(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_custom_field_values')
    .select('field_key, value')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .eq('employee_id', employeeId)
  if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUES_READ_FAILED', 500)
  return Object.fromEntries((data ?? []).map((row) => [row.field_key, row.value]))
}

export async function getEmployeeCustomFields(employeeId: string): Promise<EmployeeCustomField[]> {
  const context = await requirePermission('employee:read', employeeId)
  const administrationId = requireAdministration(context.administrationId)
  const supabase = await createClient()
  const [{ data: definitions, error }, { data: options, error: optionsError }, { data: values, error: valuesError }] = await Promise.all([
    supabase.from('custom_field_definitions').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).is('deleted_at', null).order('sort_order').order('key').limit(250),
    supabase.from('custom_field_select_options').select('*')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('sort_order').limit(1000),
    supabase.from('employee_custom_field_values').select('field_key, value')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('employee_id', employeeId).limit(250),
  ])
  if (error || optionsError || valuesError) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUES_READ_FAILED', 500)
  const valueByKey = new Map((values ?? []).map((row) => [row.field_key, row.value]))
  const isSelf = context.employeeId === employeeId
  const isHr = context.permissions.includes('custom-fields:write')
  return (definitions ?? []).map((row) => {
    const definition = toDefinition(row, options ?? [])
    return {
      ...definition,
      access: isSelf ? row.employee_self_access : isHr ? row.hr_access : row.manager_access,
      value: valueByKey.get(row.key),
    }
  }).filter((field) => field.access !== 'HIDDEN')
}

export async function setEmployeeCustomFieldValues(
  employeeId: string,
  values: CustomFieldValuesInput,
): Promise<Json> {
  const context = await requirePermission('employee:read', employeeId)
  const administrationId = requireAdministration(context.administrationId)
  const supabase = await createClient()
  const keys = Object.keys(values)
  if (keys.length === 0) return getEmployeeCustomFieldValues(employeeId)

  const { data: definitions, error: definitionError } = await supabase
    .from('custom_field_definitions')
    .select('id, key, field_type, is_required')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .in('key', keys)
    .eq('is_active', true)
    .is('deleted_at', null)
  if (definitionError) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUES_WRITE_FAILED', 500)
  if ((definitions ?? []).length !== keys.length) {
    throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_INVALID', 400)
  }

  const definitionByKey = new Map((definitions ?? []).map((definition) => [definition.key, definition]))
  const deleteIds: string[] = []
  const regularRows: Database['public']['Tables']['employee_custom_field_values']['Insert'][] = []
  const automaticRows: Database['public']['Tables']['employee_custom_field_values']['Insert'][] = []

  for (const [key, value] of Object.entries(values)) {
    const definition = definitionByKey.get(key)
    if (!definition) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_INVALID', 400)
    if (value === null && definition.field_type !== 'AUTO_INCREMENT') {
      if (definition.is_required) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_INVALID', 400)
      deleteIds.push(definition.id)
      continue
    }
    const row = {
      tenant_id: context.tenantId,
      administration_id: administrationId,
      employee_id: employeeId,
      definition_id: definition.id,
      field_key: key,
      value: value as Json,
    }
    if (definition.field_type === 'AUTO_INCREMENT') automaticRows.push(row)
    else regularRows.push(row)
  }

  if (deleteIds.length > 0) {
    const { error } = await supabase.from('employee_custom_field_values').delete()
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('employee_id', employeeId).in('definition_id', deleteIds)
    if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUES_WRITE_FAILED', 500)
  }
  if (regularRows.length > 0) {
    const { error } = await supabase.from('employee_custom_field_values')
      .upsert(regularRows, { onConflict: 'tenant_id,administration_id,employee_id,definition_id' })
    if (error?.code === '42501') throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_FORBIDDEN', 403)
    if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_INVALID', 400)
  }
  if (automaticRows.length > 0) {
    const { error } = await supabase.from('employee_custom_field_values')
      .upsert(automaticRows, {
        onConflict: 'tenant_id,administration_id,employee_id,definition_id',
        ignoreDuplicates: true,
      })
    if (error?.code === '42501') throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_FORBIDDEN', 403)
    if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_INVALID', 400)
  }
  return getEmployeeCustomFieldValues(employeeId)
}
