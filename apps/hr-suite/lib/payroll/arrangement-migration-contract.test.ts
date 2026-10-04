import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const payrollSource = fileURLToPath(new URL('.', import.meta.url))
const migration = readFileSync(join(
  payrollSource,
  'supabase',
  'migrations',
  '20261003100000_paylab05_arrangement_foundation.sql',
), 'utf8').toLowerCase()
const integrityMigration = readFileSync(join(
  payrollSource,
  'supabase',
  'migrations',
  '20261003123000_paylab05_arrangement_integrity_hardening.sql',
), 'utf8').toLowerCase()
const availabilityMigration = readFileSync(join(
  payrollSource,
  'supabase',
  'migrations',
  '20261003130000_paylab05_arrangement_availability_validity.sql',
), 'utf8').toLowerCase()
const auditedAvailabilityStartMigration = readFileSync(join(
  payrollSource,
  'supabase',
  'migrations',
  '20261003140000_paylab06_audited_availability_start.sql',
), 'utf8').toLowerCase()
const benchmarkFixtureCodesMigration = readFileSync(join(
  payrollSource,
  'supabase',
  'migrations',
  '20261003180000_paylab06_benchmark_fixture_codes.sql',
), 'utf8').toLowerCase()

const tables = [
  'payroll_arrangement_availability',
  'payroll_arrangement_assignments',
  'payroll_arrangement_composition_snapshots',
]

describe('CAO-BENCH02 Payroll migration contract', () => {
  it('adds only the scoped Payroll Lab arrangement persistence tables', () => {
    const createdTables = [...migration.matchAll(/create table public\.([a-z_][a-z0-9_]*)\s*\(/g)]
      .map((match) => match[1])
      .sort()
    expect(createdTables).toEqual([...tables].sort())
    expect(migration).toContain('foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)')
    expect(migration).not.toMatch(/references\s+public\.(employees|employments|income_relationships|hr_groups|tenants|administrations)\b/)
    expect(migration).not.toContain('control02')
    expect(migration).not.toContain('labor_condition_set_id')
    expect(migration).not.toContain('create table public.payroll_arrangement_package_versions')
  })

  it('enforces one available primary assignment per employment and package availability', () => {
    const assignments = migration.match(/create table public\.payroll_arrangement_assignments\s*\(([\s\S]*?)\n\);/)?.[1] ?? ''
    expect(assignments).toContain('unique (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)')
    expect(assignments).toContain('foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, package_id)')
    expect(assignments).toContain('check (is_primary)')
    expect(assignments).toContain("'discrete_scale_step'")
    expect(assignments).toContain("'open_salary_band'")
    expect(assignments).toContain("'freely_negotiated'")
    expect(assignments).toContain('check (effective_to is null or effective_to >= effective_from)')
  })

  it('keeps composition snapshots scoped, hash-checked and insert-only', () => {
    const snapshots = migration.match(/create table public\.payroll_arrangement_composition_snapshots\s*\(([\s\S]*?)\n\);/)?.[1] ?? ''
    expect(snapshots).toContain("check (jsonb_typeof(snapshot_json) = 'object')")
    expect(snapshots).toContain("check (snapshot_hash ~ '^[0-9a-f]{64}$')")
    expect(snapshots).toContain('foreign key (assignment_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)')
    expect(snapshots).toContain('unique (assignment_id, as_of_date, snapshot_hash)')
    expect(migration).toContain('alter table public.payroll_arrangement_composition_snapshots enable row level security')
    expect(migration).toContain('revoke all on table')
    expect(migration).toContain('from public, anon, authenticated, service_role')
    expect(migration).toContain('grant select, insert on table')
    expect(migration).not.toMatch(/grant\s+[^;]*\b(update|delete|all)\b[^;]*payroll_arrangement_composition_snapshots/i)
  })

  it('protects all new tables with scoped service-role-only policies', () => {
    for (const table of tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`on public.${table} for all to service_role using (true) with check (true)`)
    }
    expect(migration).not.toMatch(/auth\.role\(\)/i)
    expect(migration.match(/before update or delete on public\.payroll_arrangement_/g)).toHaveLength(3)
    expect(migration).toContain("raise exception using errcode = '23514'")
  })

  it('pins the mutation guard search path and indexes the scoped snapshot assignment foreign key', () => {
    expect(integrityMigration).toMatch(/alter function public\.reject_payroll_arrangement_mutation\(\)\s+set search_path\s*=\s*''/)
    expect(integrityMigration).toMatch(/create index payroll_arrangement_composition_snapshots_assignment_scope_idx[\s\S]+?\(\s*assignment_id,\s*payroll_administration_id,\s*source_tenant_id,\s*source_hr_group_id,\s*source_administration_id,\s*source_employment_id\s*\)/)
  })

  it('makes package availability effective-dated and audibly revocable without changing its identity', () => {
    expect(availabilityMigration).toContain("add column effective_from date not null default date '2026-09-01'")
    expect(availabilityMigration).toContain('alter column effective_from drop default')
    expect(availabilityMigration).not.toMatch(/update\s+public\.payroll_arrangement_availability/i)
    expect(availabilityMigration).toContain('add column effective_to date')
    expect(availabilityMigration).toContain('payroll_arrangement_availability_effective_dates_valid')
    expect(availabilityMigration).toMatch(/grant update \(effective_to, updated_at, updated_by_user_id\)[\s\S]+?to service_role/)
    expect(availabilityMigration).toMatch(/create trigger payroll_arrangement_availability_update_guard[\s\S]+?before update/)
    expect(availabilityMigration).toContain('new.effective_from is distinct from old.effective_from')
    expect(availabilityMigration).toContain('new.updated_by_user_id is null')
    expect(availabilityMigration).toContain("set search_path = ''")
    expect(availabilityMigration).not.toMatch(/grant\s+[^;]*\b(delete|all)\b[^;]*payroll_arrangement_availability/i)
  })

  it('audits scoped historical start extensions with an immutable service-role-only history', () => {
    expect(auditedAvailabilityStartMigration).toContain('create table public.payroll_arrangement_availability_history')
    expect(auditedAvailabilityStartMigration).toContain('foreign key (availability_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)')
    expect(auditedAvailabilityStartMigration).toContain('alter table public.payroll_arrangement_availability_history enable row level security')
    expect(auditedAvailabilityStartMigration).toContain('for all to service_role using (true) with check (true)')
    expect(auditedAvailabilityStartMigration).toContain('before update or delete on public.payroll_arrangement_availability_history')
    expect(auditedAvailabilityStartMigration).toContain('grant select on table public.payroll_arrangement_availability_history to service_role')
    expect(auditedAvailabilityStartMigration).toMatch(/create function public\.protect_payroll_arrangement_availability_update\([\s\S]+?security definer[\s\S]+?set search_path = ''/)
    expect(auditedAvailabilityStartMigration).toMatch(/grant update \(effective_from, effective_to, updated_at, updated_by_user_id\)[\s\S]+?to service_role/)
    expect(auditedAvailabilityStartMigration).toContain('new.effective_from > old.effective_from')
    expect(auditedAvailabilityStartMigration).toContain('insert into public.payroll_arrangement_availability_history')
    expect(auditedAvailabilityStartMigration).toContain('changed_by_user_id')
    expect(auditedAvailabilityStartMigration).toContain("set search_path = ''")
    expect(auditedAvailabilityStartMigration).not.toMatch(/grant\s+[^;]*\b(delete|all)\b[^;]*payroll_arrangement_availability_history/i)
    expect(auditedAvailabilityStartMigration).not.toMatch(/delete\s+from\s+public\.payroll_arrangement_availability\b/i)
  })

  it('extends the synthetic assignment allowlist without removing Phase 1 fixture identities', () => {
    expect(benchmarkFixtureCodesMigration).toContain('drop constraint payroll_arrangement_assignments_fixture_code_check')
    for (const code of [
      'cao-bench02-scale-step',
      'cao-bench02-open-band',
      'cao-bench02-freely-negotiated',
      'cao-bench02-kinderopvang',
      'cao-bench02-retail-mode',
      'cao-bench02-open-band-benchmark',
      'cao-bench02-ceo-benchmark',
    ]) expect(benchmarkFixtureCodesMigration).toContain(code)
    expect(benchmarkFixtureCodesMigration).not.toMatch(/delete\s+from|truncate\s+/i)
  })
})
