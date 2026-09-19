import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260918203815_focus_completion_act_as_absence.sql'), 'utf8')

describe('Focus completion act-as and absence migration contract', () => {
  it('adds a scoped, HR-only act-as capability without changing the authenticated user', () => {
    expect(sql).toContain("'focus:act-as-employee'")
    expect(sql).toContain("role.code in ('TENANT_ADMIN', 'HR_ADMIN')")
    expect(sql).toContain('subject_employee_id')
    expect(sql).not.toContain('auth.admin.')
  })

  it('keeps absence confirmation separate from the canonical absence case and protects it with RLS', () => {
    expect(sql).toContain('create table if not exists public.absence_confirmations')
    expect(sql).toContain('absence_confirmations_case_scope_fkey')
    expect(sql).toContain('absence_confirmations_employee_scope_fkey')
    expect(sql).toContain("check (status in ('PENDING', 'CONFIRMED', 'CORRECTION_REQUESTED'))")
    expect(sql).toContain('alter table public.absence_confirmations enable row level security')
    expect(sql).toContain('grant select on public.absence_confirmations to authenticated')
    expect(sql).toContain('register_absence_confirmation')
    expect(sql).toContain('confirm_absence_confirmation')
    expect(sql).toContain('request_absence_correction')
    expect(sql).not.toContain('medical')
  })

  it('allows the configured self directory permission to use the existing directory read model', () => {
    expect(sql).toContain("'self:organization-chart:read'")
    expect(sql).toContain("'employee-directory:read'")
    expect(sql).toContain("'get_employee_directory_visibility', 'get_employee_directory_detail'")
    expect(sql).toContain('execute function_definition')
  })
})
