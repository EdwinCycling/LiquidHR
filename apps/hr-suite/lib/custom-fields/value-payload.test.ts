import { describe, expect, it } from 'vitest'
import { buildEmployeeCustomFieldValueRow } from './value-payload'

describe('employee custom-field upsert payload', () => {
  it('does not overwrite the legacy administration identity on update', () => {
    const row = buildEmployeeCustomFieldValueRow({
      tenantId: 'tenant',
      hrGroupId: 'hr-group',
      employeeId: 'employee',
      definitionId: 'definition',
      fieldKey: 'shirt_size',
      value: 'XS',
    })

    expect(row).toEqual({
      tenant_id: 'tenant',
      hr_group_id: 'hr-group',
      employee_id: 'employee',
      definition_id: 'definition',
      field_key: 'shirt_size',
      value: 'XS',
    })
    expect('administration_id' in row).toBe(false)
  })
})
