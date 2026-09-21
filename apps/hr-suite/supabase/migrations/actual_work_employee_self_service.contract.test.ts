import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20260921100000_actual_work_employee_self_service.sql', import.meta.url), 'utf8').toLowerCase()

describe('Actual Work Employee self-service migration contract', () => {
  it('adds a separate canonical self-service write permission to the Employee role', () => {
    expect(migration).toContain("'self:actual-work:write'")
    expect(migration).toContain("where role.code = 'employee'")
    expect(migration).toContain("and role.tenant_id is null")
  })

  it('keeps the invoker RPC and limits self writes to the authenticated employee', () => {
    expect(migration).toContain('security invoker')
    expect(migration).toContain("current_employee_has_permission(requested_tenant_id, requested_hr_group_id, 'self:actual-work:write')")
    expect(migration).toContain('current_employee_id(requested_tenant_id, requested_hr_group_id) = requested_employee_id')
    expect(migration).toContain("old_entry.employee_id <> internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id)")
  })

  it('preserves server-side validation and blocks approved Leave overlap', () => {
    expect(migration).toContain("'actual_work_period_closed'")
    expect(migration).toContain("'actual_work_type_not_active'")
    expect(migration).toContain("leave_request.status = 'approved'")
    expect(migration).toContain("'actual_work_leave_overlap'")
    expect(migration).toContain("'actual_work_future_not_allowed'")
  })

  it('keeps RLS for own reads and writes without granting self-delete', () => {
    expect(migration).toContain('employment_work_hour_entries_group_insert')
    expect(migration).toContain('employment_work_hour_entries_group_update')
    expect(migration).toContain("'self:actual-work:write'")
    expect(migration).not.toContain('employment_work_hour_entries_group_delete')
  })
})
