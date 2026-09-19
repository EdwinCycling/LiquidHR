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
    expect(sql).toContain('pending_confirmation boolean not null default false')
    expect(sql).toContain('report_focus_employee_absence')
    expect(sql).toContain('set pending_confirmation = true')
    expect(sql).toContain('set pending_confirmation = false')
    expect(sql).toContain('requested_expected_recovery_on')
    expect(sql).toContain('ABSENCE_SELF_SERVICE_FIELDS_FORBIDDEN')
    expect(sql).toContain('pending_confirmation')
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

  it('keeps pending cases out of colleague presence and exposes no Focus correction text field', () => {
    expect(sql).toContain('FOCUS_DIRECTORY_PRESENCE_SOURCE_NOT_FOUND')
    expect(sql).toContain("absence.pending_confirmation is not true")
    expect(sql).toContain('create or replace function public.report_absence')
  })

  it('keeps manager reporting and recovery on the canonical absence kernel', () => {
    expect(sql).toContain('return internal_security.report_absence(')
    expect(sql).toContain("'internal_security.recover_absence(uuid,date,text)'::regprocedure")
    expect(sql).toContain('case_record.pending_confirmation')
    expect(sql).toContain("'self:absence:write'")
    expect(sql).toContain('employee_self_report_enabled')
  })

  it('uses an explicit canonical vacation family for Manager Home projections', () => {
    expect(sql).toContain('create type public.leave_type_family as enum (\'VACATION\', \'OTHER\')')
    expect(sql).toContain('add column if not exists family public.leave_type_family')
    expect(sql).toContain('set_group_leave_type_family')
    expect(sql).toContain("family = 'VACATION'")
    expect(sql).not.toContain("name contains 'vakantie'")
  })

  it('allows the configured self directory permission to use the existing directory read model', () => {
    expect(sql).toContain("'self:organization-chart:read'")
    expect(sql).toContain("'employee-directory:read'")
    expect(sql).toContain("'get_employee_directory_visibility', 'get_employee_directory_detail'")
    expect(sql).toContain('execute function_definition')
  })
})
