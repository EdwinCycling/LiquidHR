import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20260908115903_payroll_p0_foundation.sql', 'utf8')

describe('Payroll P0 foundation migration contract', () => {
  it('preserves the existing module and HR-group scope contracts', () => {
    expect(sql).toContain("check (module_code in ('HERA', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS', 'JOURNEYS', 'RECRUITMENT', 'DOCUMENTS', 'PAYROLL'))")
    expect(sql).toContain('references public.hr_groups(tenant_id, id) on delete restrict')
    expect(sql).toContain('references public.administrations(tenant_id, hr_group_id, id) on delete restrict')
    expect(sql).toContain('internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id,')
    expect(sql).toContain('create unique index payroll_company_bindings_one_per_administration_idx')
    expect(sql).toContain('create unique index payroll_company_bindings_one_per_provider_company_idx')
  })

  it('keeps credentials private and sync payload writes server-only', () => {
    expect(sql).toContain('create schema if not exists payroll_private')
    expect(sql).toContain('revoke all on schema payroll_private from public, anon, authenticated')
    expect(sql).toContain('grant usage on schema payroll_private to service_role')
    expect(sql).toContain('create table payroll_private.payroll_connection_credentials')
    expect(sql).not.toContain('create table public.payroll_connection_credentials')
    expect(sql).toContain('grant select on public.payroll_sync_runs, public.payroll_sync_items, public.payroll_sync_issues to authenticated')
    expect(sql).not.toContain('create policy payroll_sync_runs_insert')
    expect(sql).not.toContain('create policy payroll_sync_items_insert')
    expect(sql).not.toContain('create policy payroll_sync_issues_insert')
    expect(sql).toContain('public.payroll_sync_runs, public.payroll_sync_items, public.payroll_sync_issues to service_role')
    expect(sql).toContain('grant select, insert on public.payroll_audit_events to service_role')
    expect(sql).toContain("not (reference_data ?| array['access_token', 'refresh_token', 'client_secret', 'authorization_code'])")
  })

  it('enables scoped RLS for every exposed Payroll table and keeps audit append-only', () => {
    for (const table of [
      'payroll_providers',
      'payroll_connections',
      'payroll_company_bindings',
      'payroll_sync_runs',
      'payroll_sync_items',
      'payroll_sync_issues',
      'payroll_audit_events',
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`public.${table}`)
    }
    expect(sql).toContain('before update or delete on public.payroll_audit_events')
    expect(sql).toContain("raise exception 'PAYROLL_AUDIT_APPEND_ONLY'")
    expect(sql).not.toContain('grant insert on public.payroll_audit_events to authenticated')
  })
})
