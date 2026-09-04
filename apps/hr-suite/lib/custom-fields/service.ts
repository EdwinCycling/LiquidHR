import type { Database, Json } from '@scope/db'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  CustomFieldDefinitionInput,
  CustomFieldDefinitionUpdateInput,
  CustomFieldValuesInput,
} from './schemas'
import { buildEmployeeCustomFieldValueRow } from './value-payload'

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
  entityType: DefinitionRow['entity_type']
  key: string
  labelNl: string
  labelEn: string
  countryCode: string
  descriptionNl: string | null
  descriptionEn: string | null
  fieldType: DefinitionRow['field_type']
  isRequired: boolean
  showInOrganizationChartFilter: boolean
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

function toDefinition(row: DefinitionRow, options: OptionRow[]): CustomFieldDefinition {
  return {
    id: row.id,
    entityType: row.entity_type,
    key: row.key,
    labelNl: row.label_nl,
    labelEn: row.label_en,
    countryCode: row.country_code,
    descriptionNl: row.description_nl,
    descriptionEn: row.description_en,
    fieldType: row.field_type,
    isRequired: row.is_required,
    showInOrganizationChartFilter: row.show_in_organization_chart_filter,
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

export async function listCustomFieldDefinitions(entityType: DefinitionRow['entity_type'] = 'EMPLOYEE'): Promise<CustomFieldDefinition[]> {
  const context = await requirePermission('custom-field-values:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const [{ data: definitions, error }, { data: options, error: optionsError }] = await Promise.all([
    supabase.from('custom_field_definitions').select('*')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('entity_type', entityType)
      .is('deleted_at', null).order('label_nl').order('key'),
    supabase.from('custom_field_select_options').select('*')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
      .order('sort_order').order('value'),
  ])
  if (error || optionsError) throw new CustomFieldServiceError('CUSTOM_FIELDS_READ_FAILED', 500)
  return (definitions ?? []).map((row) => toDefinition(row, options ?? []))
}

export async function createCustomFieldDefinition(
  input: CustomFieldDefinitionInput,
): Promise<CustomFieldDefinition> {
  const context = await requirePermission('custom-fields:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase.from('custom_field_definitions').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    entity_type: input.entityType,
    key: input.key,
    label_nl: input.labelNl,
    label_en: input.labelEn,
    country_code: input.countryCode,
    description_nl: input.descriptionNl ?? null,
    description_en: input.descriptionEn ?? null,
    field_type: input.fieldType,
    is_required: input.isRequired,
    show_in_organization_chart_filter: input.showInOrganizationChartFilter,
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
        hr_group_id: hrGroupId,
        administration_id: null,
        definition_id: data.id,
        value: option.value,
        label_nl: option.labelNl,
        label_en: option.labelEn,
        sort_order: option.sortOrder,
      }))).select('*')
    if (optionError) {
      await supabase.from('custom_field_definitions').update({
        is_active: false,
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
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const updatePayload: Database['public']['Tables']['custom_field_definitions']['Update'] = {}
  if (input.labelNl !== undefined) updatePayload.label_nl = input.labelNl
  if (input.labelEn !== undefined) updatePayload.label_en = input.labelEn
  if (input.countryCode !== undefined) updatePayload.country_code = input.countryCode
  if (input.descriptionNl !== undefined) updatePayload.description_nl = input.descriptionNl
  if (input.descriptionEn !== undefined) updatePayload.description_en = input.descriptionEn
  if (input.isRequired !== undefined) updatePayload.is_required = input.isRequired
  if (input.showInOrganizationChartFilter !== undefined) updatePayload.show_in_organization_chart_filter = input.showInOrganizationChartFilter
  if (input.hrAccess !== undefined) updatePayload.hr_access = input.hrAccess
  if (input.managerAccess !== undefined) updatePayload.manager_access = input.managerAccess
  if (input.employeeSelfAccess !== undefined) updatePayload.employee_self_access = input.employeeSelfAccess
  if (input.sortOrder !== undefined) updatePayload.sort_order = input.sortOrder
  if (input.isActive !== undefined) updatePayload.is_active = input.isActive
  const { data, error } = await supabase.from('custom_field_definitions').update(updatePayload).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
    .eq('id', definitionId).is('deleted_at', null).select('*').maybeSingle()
  if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_UPDATE_FAILED', 500)
  if (!data) throw new CustomFieldServiceError('CUSTOM_FIELD_NOT_FOUND', 404)
  const { data: options } = await supabase.from('custom_field_select_options')
    .select('*').eq('definition_id', definitionId).order('sort_order')
  return toDefinition(data, options ?? [])
}

export async function deleteCustomFieldDefinition(definitionId: string): Promise<void> {
  const context = await requirePermission('custom-fields:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { count, error: valuesError } = await supabase.from('employee_custom_field_values')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('definition_id', definitionId)
  if (valuesError) throw new CustomFieldServiceError('CUSTOM_FIELD_USAGE_CHECK_FAILED', 500)
  if ((count ?? 0) > 0) throw new CustomFieldServiceError('CUSTOM_FIELD_IN_USE', 409)
  const { data, error } = await supabase.from('custom_field_definitions')
    .delete().eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', definitionId)
    .select('id').maybeSingle()
  if (error?.code === '23503') throw new CustomFieldServiceError('CUSTOM_FIELD_IN_USE', 409)
  if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_DELETE_FAILED', 500)
  if (!data) throw new CustomFieldServiceError('CUSTOM_FIELD_NOT_FOUND', 404)
}

export async function getEmployeeCustomFieldValues(employeeId: string): Promise<Json> {
  const context = await requirePermission('employee:read', employeeId)
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_custom_field_values')
    .select('field_key, value')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('employee_id', employeeId)
  if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUES_READ_FAILED', 500)
  return Object.fromEntries((data ?? []).map((row) => [row.field_key, row.value]))
}

export async function getEmployeeCustomFields(employeeId: string): Promise<EmployeeCustomField[]> {
  const context = await requirePermission('employee:read', employeeId)
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const [{ data: definitions, error }, { data: options, error: optionsError }, { data: values, error: valuesError }] = await Promise.all([
    supabase.from('custom_field_definitions').select('*')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
      .eq('is_active', true).is('deleted_at', null).order('sort_order').order('key').limit(250),
    supabase.from('custom_field_select_options').select('*')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
      .eq('is_active', true).order('sort_order').limit(1000),
    supabase.from('employee_custom_field_values').select('field_key, value')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
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
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const keys = Object.keys(values)
  if (keys.length === 0) return getEmployeeCustomFieldValues(employeeId)

  const { data: definitions, error: definitionError } = await supabase
    .from('custom_field_definitions')
    .select('id, key, field_type, is_required')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
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
    const row = buildEmployeeCustomFieldValueRow({ tenantId: context.tenantId, hrGroupId, employeeId, definitionId: definition.id, fieldKey: key, value: value as Json })
    if (definition.field_type === 'AUTO_INCREMENT') automaticRows.push(row)
    else regularRows.push(row)
  }

  if (deleteIds.length > 0) {
    const { error } = await supabase.from('employee_custom_field_values').delete()
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
      .eq('employee_id', employeeId).in('definition_id', deleteIds)
    if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUES_WRITE_FAILED', 500)
  }
  if (regularRows.length > 0) {
    const { error } = await supabase.from('employee_custom_field_values')
      .upsert(regularRows, { onConflict: 'tenant_id,hr_group_id,employee_id,definition_id' })
    if (error?.code === '42501') throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_FORBIDDEN', 403)
    if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_INVALID', 400)
  }
  if (automaticRows.length > 0) {
    const { error } = await supabase.from('employee_custom_field_values')
      .upsert(automaticRows, {
        onConflict: 'tenant_id,hr_group_id,employee_id,definition_id',
        ignoreDuplicates: true,
      })
    if (error?.code === '42501') throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_FORBIDDEN', 403)
    if (error) throw new CustomFieldServiceError('CUSTOM_FIELD_VALUE_INVALID', 400)
  }
  return getEmployeeCustomFieldValues(employeeId)
}
