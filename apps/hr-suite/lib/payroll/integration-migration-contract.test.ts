import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationPath = (name: string) => fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url))
const p0 = readFileSync(migrationPath('20260908181859_payroll_p0_foundation.sql'), 'utf8').toLowerCase()
const p1Companies = readFileSync(migrationPath('20260908203016_payroll_p1_nmbrs_connection.sql'), 'utf8').toLowerCase()
const privateFacade = readFileSync(migrationPath('20260909133103_payroll_p1_private_rpc_facade.sql'), 'utf8').toLowerCase()
const privateClient = readFileSync(new URL('./server/private-client.ts', import.meta.url), 'utf8')
const settingsActions = readFileSync(new URL('../../components/payroll/payroll-settings-actions.tsx', import.meta.url), 'utf8')

const rpcNames = [
  'payroll_private_insert_oauth_state',
  'payroll_private_consume_oauth_state',
  'payroll_private_latest_credential',
  'payroll_private_insert_credential',
  'payroll_private_delete_credentials',
]

describe('Nmbrs P0/P1 database and private-client contract', () => {
  it('keeps the existing payroll module, tenant and HR-group scope contracts', () => {
    expect(p0).toContain("check (module_code in ('hera', 'reminders', 'talent', 'surveys', 'enps', 'team_compass', 'journeys', 'recruitment', 'documents', 'payroll'))")
    expect(p0).toContain('references public.hr_groups(tenant_id, id) on delete restrict')
    expect(p0).toContain('references public.administrations(tenant_id, hr_group_id, id) on delete restrict')
    expect(p0).toContain('internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id,')
    expect(p0).toContain('create unique index payroll_company_bindings_one_per_administration_idx')
    expect(p0).toContain('create unique index payroll_company_bindings_one_per_provider_company_idx')
    expect(p1Companies).toContain('references public.payroll_connections(tenant_id, hr_group_id, id) on delete cascade')
    expect(p1Companies).toContain('create table public.payroll_provider_companies')
  })

  it('keeps credential and OAuth state rows private with atomic one-time state consumption', () => {
    expect(p0).toContain('create schema if not exists payroll_private')
    expect(p0).toContain('revoke all on schema payroll_private from public, anon, authenticated')
    expect(p0).toContain('create table payroll_private.payroll_connection_credentials')
    expect(p1Companies).toContain('create table payroll_private.payroll_oauth_states')
    expect(p1Companies).toContain('alter table payroll_private.payroll_oauth_states enable row level security')
    expect(privateFacade).toContain('and consumed_at is null')
    expect(privateFacade).toContain('and expires_at > requested_consumed_at')
    expect(privateFacade).toContain('set consumed_at = requested_consumed_at')
    expect(privateFacade).toContain('returning jsonb_build_object')
  })

  it('enables RLS for the exposed integration tables and keeps audit append-only', () => {
    for (const table of [
      'payroll_providers',
      'payroll_connections',
      'payroll_company_bindings',
      'payroll_sync_runs',
      'payroll_sync_items',
      'payroll_sync_issues',
      'payroll_audit_events',
    ]) expect(p0).toContain(`alter table public.${table} enable row level security`)
    expect(p1Companies).toContain('alter table payroll_private.payroll_oauth_states enable row level security')
    expect(p0).toContain('before update or delete on public.payroll_audit_events')
    expect(p0).toContain("raise exception 'payroll_audit_append_only'")
    expect(p0).not.toContain('grant insert on public.payroll_audit_events to authenticated')
    expect(p1Companies).toContain('revoke all on payroll_private.payroll_oauth_states from public, anon, authenticated')
  })

  it('exposes the private façade only to service_role and keeps RPC calls server-only', () => {
    for (const rpcName of rpcNames) {
      expect(privateFacade).toContain(`create function public.${rpcName}`)
      expect(privateFacade).toContain(`revoke all on function public.${rpcName}`)
      expect(privateFacade).toContain(`grant execute on function public.${rpcName}`)
    }
    expect(privateFacade.match(/security definer/g)).toHaveLength(rpcNames.length)
    expect(privateFacade.match(/set search_path = pg_catalog/g)).toHaveLength(rpcNames.length)
    expect(privateFacade).toContain('from public, anon, authenticated')
    expect(privateFacade).toContain('to service_role')
    expect(privateClient).toContain("import 'server-only'")
    expect(privateClient).toContain('client.rpc(')
    expect(privateClient).not.toContain("schema('payroll_private')")
    expect(privateClient).not.toContain('from(')
    expect(settingsActions).not.toContain('payroll_private_')
    expect(settingsActions).not.toContain('.rpc(')
  })
})
