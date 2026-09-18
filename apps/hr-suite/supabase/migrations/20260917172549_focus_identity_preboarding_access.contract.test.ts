import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260917172549_focus_identity_preboarding_access.sql'), 'utf8').replaceAll('\r\n', '\n')
const canonicalEmployeeIdOverload = readFileSync(resolve(__dirname, '20260805200000_hr_group_people_organization_roles.sql'), 'utf8').replaceAll('\r\n', '\n')

describe('Focus identity/preboarding migration contract', () => {
  it('derives preboarding from effective-dated confirmed employments', () => {
    expect(sql).toContain('current_employee_is_preboarding')
    expect(sql).toContain('requested_tenant_id uuid')
    expect(sql).toContain('requested_hr_group_id uuid')
    expect(sql).toContain('employee.tenant_id = requested_tenant_id')
    expect(sql).toContain('employee.hr_group_id = requested_hr_group_id')
    expect(sql).toContain("future_employment.starts_on > current_date")
    expect(sql).toContain("current_employment.starts_on <= current_date")
    expect(sql).toContain("current_employment.record_status = 'CONFIRMED'")
  })

  it('hardcodes the product-governed preboarding allowlist and excludes general ESS', () => {
    for (const permission of [
      'self:employee:read',
      'self:employee:write',
      'self:address:write',
      'self:contract:read',
      'self:bank-account:read',
      'self:bank-account:write',
      'self:custom-field-values:write',
      'self:journey:read',
      'self:document:read',
      'self:document-signing:write',
    ]) expect(sql).toContain(`'${permission}'`)
    expect(sql).not.toContain("'self:leave:read'")
    expect(sql).not.toContain("'self:employee-bsn:read'")
    expect(sql).not.toContain('not internal_security.current_employee_is_preboarding()')
  })

  it('guards the cross-tenant and cross-HR-group regression at every reviewed caller', () => {
    expect(sql).toMatch(/current_employee_has_permission\(\s*requested_tenant_id uuid,\s*requested_hr_group_id uuid,/)
    expect(sql).toContain('create or replace function internal_security.current_employee_id()')
    expect(sql).toContain("employment.starts_on <= current_date")
    expect(sql).toContain("employment.starts_on > current_date")
    expect(sql).toMatch(/current_employee_is_preboarding\(\s*requested_tenant_id,\s*requested_hr_group_id\s*\)/)
    expect(sql).toContain('administration.hr_group_id')
    expect(sql).toContain('target_scope.tenant_id')
    expect(sql).toContain('target_scope.hr_group_id')
    expect(sql).toMatch(/current_employee_id\(\s*target_scope\.tenant_id,\s*target_scope\.hr_group_id\s*\)/)
    expect(sql).toContain('employee_subresource_can_read')
    expect(sql).toContain('custom_field_value_can_read')
    expect(sql).toContain('drop policy if exists employees_select_group')
    expect(sql).toContain('drop policy if exists employments_select_group')
    expect(sql).toContain('organization.tenant_id = target_scope.tenant_id')
    expect(sql).toContain('organization.hr_group_id = target_scope.hr_group_id')
    expect(sql).not.toContain("current_employee_has_permission('self:")
    expect(sql).not.toContain('and not internal_security.current_employee_is_preboarding()')
  })

  it('preserves service-role-only invitation acceptance and writes the HR group boundary', () => {
    expect(sql).toContain('hr_group_id')
    expect(sql).toContain('select administration.hr_group_id')
    expect(sql).toContain('grant execute on function public.accept_user_invitation(text, uuid, text) to service_role;')
  })

  it('proves the tenant and HR-group employee-id overload exists in migration history', () => {
    expect(canonicalEmployeeIdOverload).toMatch(/create or replace function internal_security\.current_employee_id\(\s*requested_tenant_id uuid,\s*requested_hr_group_id uuid\s*\)/)
    expect(canonicalEmployeeIdOverload).toContain('employee.tenant_id = requested_tenant_id')
    expect(canonicalEmployeeIdOverload).toContain('employee.hr_group_id = requested_hr_group_id')
    expect(canonicalEmployeeIdOverload).toContain('grant execute on function internal_security.current_employee_id(uuid, uuid) to authenticated;')
    expect(sql).toMatch(/current_employee_id\(\s*target_scope\.tenant_id,\s*target_scope\.hr_group_id\s*\)/)
  })
})
