import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const payrollSource = fileURLToPath(new URL('.', import.meta.url))
const migrationPath = join(
  payrollSource,
  'supabase',
  'migrations',
  '20261005100100_payrun01_individual_payroll.sql',
)
const migration = readFileSync(migrationPath, 'utf8').toLowerCase()
const guardRepairMigrationPath = join(
  payrollSource,
  'supabase',
  'migrations',
  '20261007064350_payrun01_fix_input_reference_guard.sql',
)
const guardRepairMigration = readFileSync(guardRepairMigrationPath, 'utf8').toLowerCase()
const versionSupersessionMigrationPath = join(
  payrollSource,
  'supabase',
  'migrations',
  '20261007091338_payrun01_test_version_supersession.sql',
)
const versionSupersessionMigration = readFileSync(versionSupersessionMigrationPath, 'utf8').toLowerCase()

const tables = [
  'payroll_individual_arrangement_assignment_versions',
  'payroll_individual_calculation_config_versions',
  'payroll_individual_arrangement_composition_snapshots',
  'payroll_opening_cumulative_snapshots',
  'individual_payroll_input_references',
  'individual_payroll_lifecycle_events',
  'payroll_individual_artifacts',
].sort()

function tableDefinition(table: string): string {
  return migration.match(new RegExp(`create table public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`))?.[1] ?? ''
}

function functionDefinition(name: string): string {
  return migration.match(new RegExp(`create function public\\.${name}\\(\\)[\\s\\S]*?\\$\\$;`))?.[0] ?? ''
}

describe('PAYRUN01 individual payroll migration contract', () => {
  it('keeps all new persistence in the Payroll Lab migration stream', () => {
    const createdTables = [...migration.matchAll(/create table public\.([a-z_][a-z0-9_]*)\s*\(/g)]
      .map((match) => match[1])
      .sort()
    const alteredTables = [...new Set([...migration.matchAll(/alter table public\.([a-z_][a-z0-9_]*)/g)]
      .map((match) => match[1]))]
      .sort()

    expect(migrationPath.replaceAll('\\', '/')).toContain('/apps/hr-suite/lib/payroll/supabase/migrations/')
    expect(migrationPath.replaceAll('\\', '/')).not.toContain('/apps/hr-suite/supabase/migrations/')
    expect(createdTables).toEqual(tables)
    expect(alteredTables).toEqual(['calculation_runs', ...tables].sort())
    expect(migration).toContain("check (run_type in ('preview', 'recalculation', 'golden_case', 'individual_payroll'))")
    expect(migration).not.toMatch(/references\s+public\.(employees|employments|income_relationships|hr_groups|tenants|administrations)\b/)
  })

  it('uses same Payroll administration scope keys for every new relation', () => {
    for (const table of tables) {
      const definition = tableDefinition(table)
      expect(definition, `${table} definition`).not.toBe('')
      expect(definition).toContain('payroll_administration_id uuid not null')
      expect(definition).toContain('source_tenant_id uuid not null')
      expect(definition).toContain('source_hr_group_id uuid not null')
      expect(definition).toContain('source_administration_id uuid not null')
      expect(definition).toMatch(/foreign key \(payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id\)\s+references public\.payroll_administrations \(id, source_tenant_id, source_hr_group_id, source_administration_id\)/)
    }

    expect(tableDefinition('payroll_individual_arrangement_composition_snapshots')).toContain(
      'foreign key (assignment_version_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)',
    )
    expect(tableDefinition('individual_payroll_input_references')).toContain(
      'foreign key (calculation_input_set_id, source_tenant_id, source_hr_group_id, source_administration_id)',
    )
    expect(tableDefinition('individual_payroll_input_references')).toContain(
      'foreign key (config_version_id, payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id)',
    )
    expect(tableDefinition('individual_payroll_lifecycle_events')).toContain(
      'foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)',
    )
    expect(tableDefinition('payroll_individual_artifacts')).toContain(
      'foreign key (calculation_run_id, source_tenant_id, source_hr_group_id, source_administration_id)',
    )
  })

  it('enables RLS and grants only service-role read/insert access', () => {
    const rlsTables = [...migration.matchAll(/alter table public\.([a-z_][a-z0-9_]*) enable row level security/g)]
      .map((match) => match[1])
      .sort()
    const policies = [...migration.matchAll(/create policy ([a-z_][a-z0-9_]*) on public\.([a-z_][a-z0-9_]*) for all to ([a-z_][a-z0-9_]*) using \(true\) with check \(true\);/g)]
      .map((match) => `${match[2]}:${match[3]}`)
      .sort()
    const allPolicyTables = [...migration.matchAll(/create policy [a-z_][a-z0-9_]* on public\.([a-z_][a-z0-9_]*)/g)]
      .map((match) => match[1])
      .sort()
    const revoke = migration.match(/revoke all on table([\s\S]*?)\s+from ([^;]+);/)
    const revokedTables = [...(revoke?.[1] ?? '').matchAll(/public\.([a-z_][a-z0-9_]*)/g)]
      .map((match) => match[1])
      .sort()
    const revokedRoles = (revoke?.[2] ?? '').split(',').map((role) => role.trim()).sort()
    const grants = [...migration.matchAll(/grant\s+[^;]+;/g)]
      .map((match) => match[0].replace(/\s+/g, ' ').trim())
    const tableGrants = grants.filter((grant) => grant.startsWith('grant select, insert on table '))
    const grantedTables = [...(tableGrants[0] ?? '').matchAll(/public\.([a-z_][a-z0-9_]*)/g)]
      .map((match) => match[1])
      .filter((table) => tables.includes(table))
      .sort()

    expect(rlsTables).toEqual(tables)
    expect(policies).toEqual(tables.map((table) => `${table}:service_role`).sort())
    expect(allPolicyTables).toEqual(tables)
    expect(revokedTables).toEqual(tables)
    expect(revokedRoles).toEqual(['anon', 'authenticated', 'public', 'service_role'])
    expect(grants).toEqual([
      'grant execute on function public.lock_payrun01_run(uuid) to service_role;',
      'grant execute on function public.payrun01_mark_succeeded_with_concept(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, jsonb) to service_role;',
      'grant select, insert on table public.payroll_individual_arrangement_assignment_versions, public.payroll_individual_calculation_config_versions, public.payroll_individual_arrangement_composition_snapshots, public.payroll_opening_cumulative_snapshots, public.individual_payroll_input_references, public.individual_payroll_lifecycle_events, public.payroll_individual_artifacts to service_role;',
    ])
    expect(grantedTables).toEqual(tables)
    expect(migration).not.toMatch(/grant\s+[^;]*\b(update|delete|all)\b[^;]*\b(payroll_individual_arrangement_assignment_versions|payroll_individual_calculation_config_versions|payroll_individual_arrangement_composition_snapshots|payroll_opening_cumulative_snapshots|individual_payroll_input_references|individual_payroll_lifecycle_events|payroll_individual_artifacts)\b/i)
  })

  it('keeps versioned inputs, snapshots, lifecycle events, and artifacts immutable', () => {
    const immutableTables = [
      'payroll_individual_arrangement_assignment_versions',
      'payroll_individual_calculation_config_versions',
      'payroll_individual_arrangement_composition_snapshots',
      'payroll_opening_cumulative_snapshots',
      'individual_payroll_input_references',
      'individual_payroll_lifecycle_events',
      'payroll_individual_artifacts',
    ]

    for (const table of immutableTables) {
      expect(migration).toMatch(new RegExp(`before update or delete on public\\.${table}`))
    }
    expect(migration).toContain('raise exception using errcode = \'23514\', message = \'payrun01 versioned inputs and artifacts are immutable.\'')
    expect(migration).toContain("check (assignment_hash ~ '^[0-9a-f]{64}$')")
    expect(migration).toContain("check (config_hash ~ '^[0-9a-f]{64}$')")
    expect(migration).toContain("check (snapshot_hash ~ '^[0-9a-f]{64}$')")
    expect(migration).toContain("check (artifact_hash ~ '^[0-9a-f]{64}$')")
    expect(migration).toContain("set search_path = ''")
    for (const functionName of [
      'reject_payroll_individual_immutable_mutation',
      'guard_payroll_individual_effective_version',
      'guard_individual_payroll_lifecycle_event',
      'guard_individual_payroll_input_reference',
      'require_finalized_individual_payroll_artifact',
      'reject_finalized_individual_payroll_mutation',
    ]) {
      expect(migration).toMatch(new RegExp(`alter function public\\.${functionName}\\(\\)\\s+set search_path = ''`))
    }
  })

  it('serializes inserts and rejects overlapping effective dates for each employment', () => {
    const guard = functionDefinition('guard_payroll_individual_effective_version')

    expect(guard).toContain('pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(')
    expect(guard).toContain('new.payroll_administration_id::text')
    expect(guard).toContain('new.source_employment_id::text')
    for (const table of [
      'payroll_individual_arrangement_assignment_versions',
      'payroll_individual_calculation_config_versions',
    ]) {
      expect(guard).toContain(`from public.${table} as existing`)
    }
    expect(guard.match(/existing\.source_employment_id = new\.source_employment_id/g)).toHaveLength(2)
    expect(guard.match(/existing\.effective_from <= coalesce\(new\.effective_to, 'infinity'::date\)/g)).toHaveLength(2)
    expect(guard.match(/coalesce\(existing\.effective_to, 'infinity'::date\) >= new\.effective_from/g)).toHaveLength(2)
    expect(guard).toContain('effective-dated versions may not overlap for one employment.')
  })

  it('allows only explicit sequential TEST-only supersession before a successful overlapping run', () => {
    const guard = versionSupersessionMigration.match(
      /create or replace function public\.guard_payroll_individual_effective_version\(\)[\s\S]*?\$\$;/,
    )?.[0] ?? ''

    expect(versionSupersessionMigrationPath.replaceAll('\\', '/')).toContain('/apps/hr-suite/lib/payroll/supabase/migrations/')
    expect(guard).toContain("new.provenance_status = 'test_only'")
    expect(guard).toContain("new.assignment_json ->> 'supersedesversion' = latest_version::text")
    expect(guard).toContain("new.config_json ->> 'supersedesversion' = latest_version::text")
    expect(guard).toContain('new.assignment_version = latest_version + 1')
    expect(guard).toContain('new.config_version = latest_version + 1')
    expect(guard).toContain("calculation_run.status = 'succeeded'")
    expect(guard).toContain('payroll_period.starts_on <= coalesce(new.effective_to, \'infinity\'::date)')
    expect(guard).toContain('payroll_period.ends_on >= new.effective_from')
    expect(guard).toContain('pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(')
  })

  it('pins one employment, period, assignment, and config that cover the complete payroll period', () => {
    const guard = functionDefinition('guard_individual_payroll_input_reference')

    expect(guard).toContain('source_employment_id is distinct from new.source_employment_id')
    expect(guard).toContain('snapshot_assignment_version_id is distinct from new.assignment_version_id')
    expect(guard).toContain('source_period_reference is distinct from period_start')
    expect(guard).toContain('arrangement_snapshot_as_of is distinct from period_start')
    expect(guard).toContain('assignment_start > period_start')
    expect(guard).toContain('(assignment_end is not null and assignment_end < period_end)')
    expect(guard).toContain('config_start > period_start')
    expect(guard).toContain('(config_end is not null and config_end < period_end)')
    expect(guard).toContain('opening_as_of <> (period_start - 1)')
  })

  it('qualifies trigger columns that collide with PL/pgSQL variables in the forward migration', () => {
    expect(guardRepairMigration).toContain('create or replace function public.guard_individual_payroll_input_reference()')
    expect(guardRepairMigration).toContain('select assignment.source_employment_id, assignment.effective_from, assignment.effective_to')
    expect(guardRepairMigration).toContain('select config.source_employment_id, config.effective_from, config.effective_to')
    expect(guardRepairMigration).toContain('select opening.source_employment_id, opening.as_of_date')
    expect(guardRepairMigration).not.toMatch(/select\s+source_employment_id\s*,/)
    expect(guardRepairMigration).toContain("alter function public.guard_individual_payroll_input_reference()\n  set search_path = '';")
  })

  it('requires one successful run throughout concept, review, and finalization', () => {
    const guard = functionDefinition('guard_individual_payroll_lifecycle_event')

    expect(guard).toContain("run_type <> 'individual_payroll'")
    expect(guard).toContain("run_status <> 'succeeded'")
    expect(guard).toContain("run_status not in ('failed', 'succeeded')")
    expect(guard).toContain('select event.event_type, event.calculation_run_id')
    expect(guard).toContain("prior_event is distinct from 'concept'")
    expect(guard).toContain("prior_event is distinct from 'reviewed'")
    expect(guard.match(/prior_run_id is distinct from new\.calculation_run_id/g)).toHaveLength(2)
    expect(guard).toContain('and control.status = \'fail\'')
  })

  it('completes the PAYRUN01 run and creates its concept event in one service-role transaction', () => {
    const functionStart = migration.indexOf('create function public.payrun01_mark_succeeded_with_concept(')
    const functionEnd = migration.indexOf('$$;', functionStart)
    const completion = migration.slice(functionStart, functionEnd)

    expect(completion).toContain('security definer')
    expect(completion).toContain("set search_path = ''")
    expect(completion).toContain("set status = 'succeeded'")
    expect(completion).toContain('updated_at = now()')
    expect(completion).toContain("'concept', p_event_payload, p_actor_user_id")
    expect(completion.indexOf("set status = 'succeeded'")).toBeLessThan(completion.indexOf('insert into public.individual_payroll_lifecycle_events'))
    expect(migration).toContain('revoke all on function public.payrun01_mark_succeeded_with_concept(')
  })

  it('creates the artifact index after its table and requires finalized results before inserts', () => {
    const artifactsTableOffset = migration.indexOf('create table public.payroll_individual_artifacts')
    const artifactsIndexOffset = migration.indexOf('create index payroll_individual_artifacts_run_idx')
    const artifactGuard = functionDefinition('require_finalized_individual_payroll_artifact')

    expect(artifactsTableOffset).toBeGreaterThanOrEqual(0)
    expect(artifactsIndexOffset).toBeGreaterThan(artifactsTableOffset)
    expect(migration).toContain('unique (calculation_run_id, artifact_type)')
    expect(migration).toContain('artifact_bytes bytea not null')
    expect(artifactGuard).toContain("event.event_type = 'finalized'")
    expect(migration).toMatch(/before insert on public\.payroll_individual_artifacts[\s\S]+?require_finalized_individual_payroll_artifact\(\)/)
  })

  it('blocks changes to every result surface after an individual run is finalized', () => {
    const guard = functionDefinition('reject_finalized_individual_payroll_mutation')

    expect(guard).toContain("event.event_type = 'finalized'")
    expect(guard).toContain('finalized payrun01 results and their source inputs are immutable.')
    for (const table of [
      'calculation_runs',
      'calculation_input_sets',
      'source_snapshots',
      'component_results',
      'calculation_traces',
      'payroll_controls',
    ]) {
      expect(migration).toMatch(new RegExp(`before (?:insert or update or delete|update or delete) on public\\.${table}`))
      expect(migration).toMatch(new RegExp(`on public\\.${table}[\\s\\S]+?reject_finalized_individual_payroll_mutation\\(\\)`))
    }
  })
})
