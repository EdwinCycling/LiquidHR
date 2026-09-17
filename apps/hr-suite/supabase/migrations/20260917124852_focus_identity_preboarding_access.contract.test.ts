import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260917124852_focus_identity_preboarding_access.sql'), 'utf8')

describe('Focus identity/preboarding migration contract', () => {
  it('derives preboarding from effective-dated confirmed employments', () => {
    expect(sql).toContain('current_employee_is_preboarding')
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
    expect(sql).toContain('not internal_security.current_employee_is_preboarding()')
  })

  it('preserves service-role-only invitation acceptance and writes the HR group boundary', () => {
    expect(sql).toContain('hr_group_id')
    expect(sql).toContain('select administration.hr_group_id')
    expect(sql).toContain('grant execute on function public.accept_user_invitation(text, uuid, text) to service_role;')
  })
})
