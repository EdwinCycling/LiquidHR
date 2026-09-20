import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260918090701_focus_access_management.sql'), 'utf8')
const employeeIdMigration = readFileSync(resolve(__dirname, '20260805181522_hr_group_people_organization_roles.sql'), 'utf8')

describe('Focus access management migration contract', () => {
  it('backfills existing groups to Full and defaults new groups to the approved modes', () => {
    expect(sql).toContain("employee_portal_mode text default 'FOCUS_ONLY'")
    expect(sql).toContain("manager_portal_mode text default 'FOCUS_AND_FULL'")
    expect(sql).toContain("set employee_portal_mode = 'FOCUS_AND_FULL'")
    expect(sql).toContain("manager_portal_mode = 'FOCUS_AND_FULL'")
    expect(sql).toContain("check (employee_portal_mode in ('FOCUS_ONLY', 'FOCUS_AND_FULL'))")
    expect(sql).toContain("check (manager_portal_mode in ('FOCUS_ONLY', 'FOCUS_AND_FULL'))")
  })

  it('keeps Employee ESS blocking separate from user access and invitation lifecycle', () => {
    expect(sql).toContain('create table if not exists public.employee_ess_access')
    expect(sql).toContain("check (status in ('ACTIVE', 'BLOCKED'))")
    expect(sql).toContain('alter table public.employee_ess_access enable row level security')
    expect(sql).toContain('grant select on public.employee_ess_access to authenticated')
    expect(sql).toContain('public.set_employee_ess_access')
    expect(sql).toContain('insert into public.audit_logs')
    expect(sql).toContain('subject_employee_id')
    expect(sql).not.toContain('delete from public.user_access')
    expect(sql).not.toContain('update public.user_access')
    expect(sql).not.toContain('auth.admin.')
  })

  it('enforces the employee block at the exact tenant and HR-group scope', () => {
    expect(sql).toContain('current_employee_ess_access_is_blocked(')
    expect(sql).toContain('employee.tenant_id = requested_tenant_id')
    expect(sql).toContain('employee.hr_group_id = requested_hr_group_id')
    expect(sql).toContain('current_user_has_hr_group_permission(')
    expect(sql).toContain('target.tenant_id')
    expect(sql).toContain('target.hr_group_id')
    expect(sql).toContain('current_employee_id(tenant_id, hr_group_id)')
  })

  it('proves the canonical tenant and HR-group employee-id overload exists', () => {
    expect(employeeIdMigration).toMatch(/create or replace function internal_security\.current_employee_id\(\s*requested_tenant_id uuid,\s*requested_hr_group_id uuid\s*\)/)
    expect(employeeIdMigration).toContain('employee.tenant_id = requested_tenant_id')
    expect(employeeIdMigration).toContain('employee.hr_group_id = requested_hr_group_id')
    expect(employeeIdMigration).toContain('grant execute on function internal_security.current_employee_id(uuid, uuid) to authenticated;')
  })
})
