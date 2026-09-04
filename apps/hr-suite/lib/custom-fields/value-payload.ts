import type { Database, Json } from '@scope/db'

type EmployeeCustomFieldValueInsert = Database['public']['Tables']['employee_custom_field_values']['Insert']

export function buildEmployeeCustomFieldValueRow(input: {
  tenantId: string
  hrGroupId: string
  employeeId: string
  definitionId: string
  fieldKey: string
  value: Json
}): EmployeeCustomFieldValueInsert {
  return {
    tenant_id: input.tenantId,
    hr_group_id: input.hrGroupId,
    employee_id: input.employeeId,
    definition_id: input.definitionId,
    field_key: input.fieldKey,
    value: input.value,
  }
}
