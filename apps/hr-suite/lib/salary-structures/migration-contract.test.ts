import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814065647_salary_structures_hr_group_architecture.sql'),
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
})
