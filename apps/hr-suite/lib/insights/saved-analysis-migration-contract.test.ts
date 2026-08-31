import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../supabase/migrations/20260830143757_saved_analysis_definitions.sql', import.meta.url)
const migration = readFileSync(migrationPath, 'utf8').replaceAll('\r\n', '\n')

describe('saved analysis migration contract', () => {
  it('creates a personal, tenant and HR-group scoped definition store with CRUD RLS', () => {
    expect(migration).toContain('create table public.saved_analysis_definitions')
    expect(migration).toContain('tenant_id uuid not null')
    expect(migration).toContain('hr_group_id uuid not null')
    expect(migration).toContain('owner_user_id uuid not null')
    expect(migration).toContain('references public.tenants(id) on delete restrict')
    expect(migration).toContain('references auth.users(id) on delete restrict')
    expect(migration).toContain('foreign key (tenant_id, hr_group_id)')
    expect(migration).toContain('references public.hr_groups(tenant_id, id) on delete restrict')
    expect(migration).toContain('saved_analysis_definitions_owner_scope_idx')
    expect(migration).toContain('saved_analysis_definitions_updated_at')
    expect(migration).toContain('prevent_saved_analysis_identity_change')
    expect(migration).toContain('SAVED_ANALYSIS_IDENTITY_IMMUTABLE')
    expect(migration).toContain('internal_security.is_valid_saved_analysis_spec(analysis_spec)')
    expect(migration).toContain('check (definition_version = 1)')
    expect(migration).toContain('alter table public.saved_analysis_definitions enable row level security')
    expect(migration).toMatch(/create policy saved_analysis_definitions_select_own_scope[\s\S]+owner_user_id = \(select auth\.uid\(\)\)[\s\S]+has_hr_group_access[\s\S]+current_user_has_hr_group_permission[\s\S]+dashboard:read/i)
    expect(migration).toContain('create policy saved_analysis_definitions_insert_own_scope')
    expect(migration).toContain('create policy saved_analysis_definitions_update_own_scope')
    expect(migration).toContain('create policy saved_analysis_definitions_delete_own_scope')
    expect(migration).toContain('with check (')
    expect(migration).toContain('using (')
    expect(migration).toContain('revoke all on public.saved_analysis_definitions from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update, delete on public.saved_analysis_definitions to service_role')
    expect(migration).toContain('grant execute on function internal_security.is_valid_saved_analysis_spec(jsonb) to service_role')
    expect(migration).toContain('grant usage on schema internal_security to service_role')
    expect(migration).toContain('auth.jwt()')
  })

  it('does not persist result, snapshot, widget or employee data', () => {
    expect(migration).not.toMatch(/\b(result|snapshot|widget|employee_id|employee_ids|rows)\b/i)
    expect(migration).toContain('analysis_spec jsonb not null')
    expect(migration).toContain('definition_version integer not null')
    expect(migration).toContain("candidate -> 'version'")
  })

  it('mirrors the strict nine-key AnalysisSpec V1 top-level contract', () => {
    expect(migration).not.toContain('jsonb_object_keys(candidate)) <> 10')
    expect(migration).toContain('as required_key(key)')
    expect(migration).toContain('where not (candidate ? required_key.key)')
    expect(migration).toMatch(
      /'version'[\s\S]*'source'[\s\S]*'entity'[\s\S]*'measures'[\s\S]*'dimensions'[\s\S]*'filters'[\s\S]*'sort'[\s\S]*'limit'[\s\S]*'presentation'/,
    )
    expect(migration).toContain("where object_key not in (\n        'version', 'source', 'entity', 'measures', 'dimensions',")
  })
})
