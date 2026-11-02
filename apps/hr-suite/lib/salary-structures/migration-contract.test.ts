import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814071705_salary_structures_hr_group_architecture.sql'),
  'utf8',
)
const correctionMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261019070211_salary_structure_revision_correction_provenance.sql'),
  'utf8',
)

describe('salary structures migration contract', () => {
  it('creates the HR-group aggregate, revision, band and CAO relation model', () => {
    expect(migration).toContain('create table public.salary_structures')
    expect(migration).toContain('create table public.salary_structure_revisions')
    expect(migration).toContain('create table public.salary_bands')
    expect(migration).toContain('create table public.salary_band_values')
    expect(migration).toContain('create table public.labor_condition_salary_structures')
  })

  it('moves scales and concrete steps to immutable HR-group revision ownership', () => {
    expect(migration).toContain('alter table public.salary_scales')
    expect(migration).toContain('alter table public.salary_scale_steps')
    expect(migration).toContain('prevent_published_salary_revision_mutation')
    expect(migration).toContain('current_user_has_hr_group_permission')
  })

  it('preserves concrete step IDs used by employment salaries', () => {
    expect(migration).toContain('employment_salaries_scale_step_fkey')
    expect(migration).toContain('salary_scale_step_id')
    expect(migration).toContain('salary_structure_migration_conflicts')
  })

  it('exposes guarded aggregate draft, publish and CAO relation commands', () => {
    expect(migration).toContain('function public.create_salary_structure(')
    expect(migration).toContain('function public.save_salary_structure_draft(')
    expect(migration).toContain('function public.publish_salary_structure_revision(')
    expect(migration).toContain('function public.replace_labor_condition_salary_structures(')
    expect(migration).toContain("'salary-structure:write'")
    expect(migration).toContain("'salary:write'")
  })

  it('enables RLS and uses explicit authenticated grants for every exposed table', () => {
    for (const table of [
      'salary_structures',
      'salary_structure_revisions',
      'salary_scales',
      'salary_scale_steps',
      'salary_bands',
      'salary_band_values',
      'labor_condition_salary_structures',
      'salary_structure_migration_conflicts',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`on table public.${table} to authenticated`)
    }
  })

  it('keeps correction history and switches the active effective revision atomically', () => {
    expect(correctionMigration).toContain('add column source_metadata jsonb')
    expect(correctionMigration).toContain('correction_of_revision_id uuid')
    expect(correctionMigration).toContain("where status = 'PUBLISHED'")
    expect(correctionMigration).toContain("where status = 'DRAFT'")
    expect(correctionMigration).toContain('function public.save_salary_structure_import_draft(')
    expect(correctionMigration).toContain('function public.publish_salary_structure_revision(')
    expect(correctionMigration).toContain('security invoker')
    expect(correctionMigration).toContain('security definer')
    expect(correctionMigration).toContain('liquidhr_salary_revision_publisher nologin inherit nobypassrls')
    expect(correctionMigration).toContain('grant authenticated to liquidhr_salary_revision_publisher')
    expect(correctionMigration).toContain('grant liquidhr_salary_revision_publisher to postgres with set true')
    expect(correctionMigration).toContain('revoke liquidhr_salary_revision_publisher from postgres')
    expect(correctionMigration).toContain('set row_security = on')
    expect(correctionMigration).toMatch(/revoke all on function public\.save_salary_structure_import_draft\([^)]*\)\s+from public, anon, authenticated, service_role/i)
    expect(correctionMigration).toMatch(/revoke all on function public\.publish_salary_structure_revision\([^)]*\)\s+from public, anon, authenticated, service_role/i)
    expect(correctionMigration).toContain('alter function public.publish_salary_structure_revision(uuid, integer)')
    expect(correctionMigration).toContain('owner to liquidhr_salary_revision_publisher')
    expect(correctionMigration).toContain('current_user_has_hr_group_permission')
    expect(correctionMigration).toContain("'{sourceValidationStatus}', '\"REFERENCE_ONLY\"'::jsonb")
    expect(correctionMigration).toContain("new.status = 'ARCHIVED'")
    expect(correctionMigration).toContain("old.status = 'ARCHIVED'")
    expect(correctionMigration).toContain('salary_structure_revisions_correction_scope_key')
    expect(correctionMigration).toContain('foreign key (tenant_id, hr_group_id, salary_structure_id, correction_of_revision_id)')
    expect(correctionMigration).toContain('references public.salary_structure_revisions(tenant_id, hr_group_id, salary_structure_id, id)')
    expect(correctionMigration).toContain('on delete restrict')

    const publishedIndex = correctionMigration.match(/create unique index salary_structure_revisions_published_effective_key([\s\S]*?)where status = 'PUBLISHED'/)
    expect(publishedIndex?.[1]).toContain('salary_structure_id, effective_from')
    const draftIndex = correctionMigration.match(/create unique index salary_structure_revisions_draft_effective_key([\s\S]*?)where status = 'DRAFT'/)
    expect(draftIndex?.[1]).toContain('salary_structure_id, effective_from')

    const validation = correctionMigration.indexOf('perform internal_security.validate_salary_structure_revision(requested_revision_id)')
    const archive = correctionMigration.indexOf("set status = 'ARCHIVED'")
    const publish = correctionMigration.indexOf("set status = 'PUBLISHED'", archive)
    expect(validation).toBeGreaterThan(-1)
    expect(archive).toBeGreaterThan(validation)
    expect(publish).toBeGreaterThan(archive)

    const temporaryMembershipGrant = correctionMigration.indexOf('grant liquidhr_salary_revision_publisher to postgres with set true')
    const firstOwnershipTransfer = correctionMigration.indexOf('owner to liquidhr_salary_revision_publisher')
    const temporaryMembershipRevoke = correctionMigration.indexOf('revoke liquidhr_salary_revision_publisher from postgres')
    expect(temporaryMembershipGrant).toBeGreaterThan(-1)
    expect(firstOwnershipTransfer).toBeGreaterThan(temporaryMembershipGrant)
    expect(temporaryMembershipRevoke).toBeGreaterThan(firstOwnershipTransfer)
    expect(correctionMigration).toContain('nobypassrls')
  })

  it('allows a same-date correction draft without exposing two effective publications', () => {
    const publishedIndex = correctionMigration.match(/create unique index salary_structure_revisions_published_effective_key([\s\S]*?)where status = 'PUBLISHED'/)?.[0]
    const draftIndex = correctionMigration.match(/create unique index salary_structure_revisions_draft_effective_key([\s\S]*?)where status = 'DRAFT'/)?.[0]

    expect(publishedIndex).toContain('unique index')
    expect(publishedIndex).toContain("where status = 'PUBLISHED'")
    expect(draftIndex).toContain('unique index')
    expect(draftIndex).toContain("where status = 'DRAFT'")
    expect(correctionMigration).toContain('revision.effective_from = effective_date')
    expect(correctionMigration).toContain("raise exception 'SALARY_STRUCTURE_CORRECTION_STALE'")
  })

  it('keeps published content immutable and permits only archival lifecycle changes', () => {
    const guardStart = correctionMigration.indexOf('create or replace function internal_security.prevent_published_salary_revision_mutation()')
    const guardEnd = correctionMigration.indexOf('$$;', guardStart + 3)
    const guard = correctionMigration.slice(guardStart, guardEnd)

    expect(guard).toContain("new.status = 'ARCHIVED'")
    expect(guard).toContain("old.status = 'ARCHIVED'")
    expect(guard).toContain('internal_security.salary_revision_publish_context')
    expect(guard).toContain('context.actor_user_id = auth.uid()')
    expect(guard).toContain("'SALARY_STRUCTURE_REVISION_IMMUTABLE'")
    expect(guard).toContain("'status', 'updated_by_user_id', 'updated_at', 'lock_version'")
    expect(guard).toContain("old.status <> 'DRAFT'")
    expect(correctionMigration).not.toContain('liquidhr.salary_revision_archive_id')
    expect(correctionMigration).not.toContain('liquidhr.salary_revision_publish_id')
    expect(correctionMigration).not.toContain('pg_catalog.current_query()')
  })
})
