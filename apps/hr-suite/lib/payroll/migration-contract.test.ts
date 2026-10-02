import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appSource = fileURLToPath(new URL('../../../../apps/hr-suite', import.meta.url))
const migrationPath = join(appSource, 'lib', 'payroll', 'supabase', 'migrations', '20260930100000_paylab00_isolation_foundation.sql')
const requiredTables = [
  'payroll_administrations',
  'payroll_periods',
  'source_snapshots',
  'calculation_input_sets',
  'calculation_runs',
  'component_results',
  'calculation_traces',
  'payroll_controls',
  'golden_case_runs',
].sort()

describe('PAYLAB00 Payroll Lab migration boundary', () => {
  it('is stored outside the LiquidHR Core Supabase migration stream', () => {
    expect(migrationPath.replaceAll('\\', '/')).toContain('/apps/hr-suite/lib/payroll/supabase/migrations/')
    expect(migrationPath.replaceAll('\\', '/')).not.toContain('/apps/hr-suite/supabase/migrations/')
  })

  it('creates only isolated Payroll Lab tables with RLS and same-database scope references', () => {
    const migration = readFileSync(migrationPath, 'utf8').toLowerCase()
    const createdTables = [...migration.matchAll(/create table (?:if not exists )?public\.([a-z_][a-z0-9_]*)\s*\(/g)].map((match) => match[1]).sort()
    const rlsTables = [...migration.matchAll(/alter table public\.([a-z_][a-z0-9_]*) enable row level security/g)].map((match) => match[1]).sort()
    const policies = [...migration.matchAll(/create policy ([a-z_][a-z0-9_]*) on public\.([a-z_][a-z0-9_]*) for all to ([a-z_][a-z0-9_]*) using \(true\) with check \(true\);/g)]
      .map((match) => `${match[1]}:${match[2]}:${match[3]}`)
      .sort()
    const allPolicies = [...migration.matchAll(/create policy ([a-z_][a-z0-9_]*) on public\.([a-z_][a-z0-9_]*)/g)]
      .map((match) => `${match[1]}:${match[2]}`)
      .sort()
    const expectedPolicies = requiredTables.map((table) => `${table}_service_role_only:${table}:service_role`).sort()
    const expectedAllPolicies = requiredTables.map((table) => `${table}_service_role_only:${table}`).sort()
    const revoke = migration.match(/revoke all on table ([\s\S]*?)\s+from ([^;]+);/)
    const revokedTables = [...(revoke?.[1] ?? '').matchAll(/public\.([a-z_][a-z0-9_]*)/g)].map((match) => match[1]).sort()
    const revokedRoles = (revoke?.[2] ?? '').split(',').map((role) => role.trim()).sort()

    expect(createdTables).toEqual(requiredTables)
    expect(rlsTables).toEqual(requiredTables)
    expect(allPolicies).toEqual(expectedAllPolicies)
    expect(policies).toEqual(expectedPolicies)
    expect(revokedTables).toEqual(requiredTables)
    expect(revokedRoles).toEqual(['anon', 'authenticated', 'public', 'service_role'])
    expect(migration).toContain('source_tenant_id')
    expect(migration).toContain('source_hr_group_id')
    expect(migration).toContain('source_administration_id')
    expect(migration).not.toMatch(/references\s+public\.(employees|employments|income_relationships|hr_groups|tenants|administrations)\b/)
  })

  it('keeps source snapshots immutable and separates calculation versions', () => {
    const migration = readFileSync(migrationPath, 'utf8').toLowerCase()
    const normalizedGrants = [...migration.matchAll(/grant\s+[^;]+;/g)]
      .map((match) => match[0].replace(/\s+/g, ' ').trim())
      .sort()
    const expectedGrants = [
      'grant usage on schema public to service_role;',
      'grant select, insert on table public.payroll_administrations to service_role;',
      'grant update (display_name, capability_enabled, status, updated_at, updated_by_user_id) on table public.payroll_administrations to service_role;',
      'grant select, insert on table public.payroll_periods to service_role;',
      'grant update (status, updated_at, updated_by_user_id) on table public.payroll_periods to service_role;',
      'grant select, insert on table public.calculation_input_sets, public.component_results, public.calculation_traces, public.payroll_controls, public.golden_case_runs to service_role;',
      'grant select, insert on table public.calculation_runs to service_role;',
      'grant update (status, started_at, finished_at, result_hash, updated_at, updated_by_user_id) on table public.calculation_runs to service_role;',
      'grant select, insert on table public.source_snapshots to service_role;',
    ].sort()
    const snapshotTable = migration.match(/create table public\.source_snapshots\s*\(([\s\S]*?)\n\);/)?.[1] ?? ''
    const inputSetTable = migration.match(/create table public\.calculation_input_sets\s*\(([\s\S]*?)\n\);/)?.[1] ?? ''

    expect(normalizedGrants).toEqual(expectedGrants)
    expect(normalizedGrants.every((grant) => !/\bto\s+(?:public|anon|authenticated)\b/.test(grant))).toBe(true)
    expect(snapshotTable).not.toMatch(/engine_version|rule_package_composition_id/)
    expect(inputSetTable).toContain('engine_version')
    expect(inputSetTable).toContain('rule_package_composition_id')
    expect(migration).toContain('grant select, insert on table public.source_snapshots to service_role')
    expect(migration).toContain('grant select, insert on table public.calculation_input_sets, public.component_results,')
    expect(migration).toContain('grant select, insert on table public.calculation_runs to service_role')
    expect(migration).toContain('grant update (status, started_at, finished_at, result_hash, updated_at, updated_by_user_id)')
    expect(migration).toContain('grant update (display_name, capability_enabled, status, updated_at, updated_by_user_id)')
    expect(migration).toContain('grant update (status, updated_at, updated_by_user_id)')
    expect(migration).not.toMatch(/grant\s+[^;]*\bupdate\s*,\s*delete\b[^;]*\bcalculation_input_sets\b/i)
    expect(migration).not.toMatch(/grant\s+[^;]*\bupdate\s*,\s*delete\b[^;]*\b(component_results|calculation_traces|payroll_controls|golden_case_runs)\b/i)
    expect(migration).not.toMatch(/auth\.role\(\)/i)
    expect(migration).not.toContain('create index payroll_periods_scope_idx')
    expect(migration).toContain('create trigger payroll_calculation_runs_transition_guard')
    expect(migration).toContain("old.status in ('succeeded', 'failed')")
    expect(migration).toContain("locked_run_status <> 'running'")
    expect(migration.replace(/\s+/g, ' ')).toContain("for update; if not found or locked_run_status <> 'running'")
    expect(migration).toContain('constraint calculation_runs_timestamp_order')
    expect(migration).toContain('create trigger golden_case_runs_running_run_guard')
  })
})
