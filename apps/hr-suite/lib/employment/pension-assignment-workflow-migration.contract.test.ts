import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261010130013_core_pension_assignment_workflow.sql', import.meta.url), 'utf8')
const supersessionIndexes = readFileSync(new URL('../../supabase/migrations/20261010130140_core_pension_assignment_supersession_fk_indexes.sql', import.meta.url), 'utf8')
const baseSchema = readFileSync(new URL('../../supabase/migrations/20261008062756_add_core_pension_arrangements_wtp_and_grandfathering.sql', import.meta.url), 'utf8')
const scopedPolicies = readFileSync(new URL('../../supabase/migrations/20261008062834_refine_pension_arrangement_rls_policies.sql', import.meta.url), 'utf8')

describe('Core pension assignment workflow migration contract', () => {
  it('requires authenticated HR-group and administration permission for one explicit assignment', () => {
    expect(migration).toMatch(/CREATE FUNCTION public\.apply_employment_pension_arrangement\(p_input jsonb\)[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain('v_actor uuid := auth.uid()')
    expect(migration).toContain('internal_security.has_hr_group_access(v_employment.tenant_id, v_employment.hr_group_id)')
    expect(migration).toContain("internal_security.current_user_has_permission(v_employment.tenant_id, v_employment.administration_id, 'pension:manage'::text)")
    expect(migration).toContain("WHERE role.code IN ('HR_ADMIN', 'TENANT_ADMIN')")
    expect(migration).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.labor_condition_pension_arrangements FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.employment_pension_arrangement_assignments FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.apply_employment_pension_arrangement\(jsonb\) FROM PUBLIC, anon/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_employment_pension_arrangement\(jsonb\) TO authenticated/i)
  })

  it('versions and scopes mapping and employment assignment history with idempotency and overlap protection', () => {
    expect(migration).toContain('labor_condition_pension_arrangements_supersedes_scope_fkey')
    expect(migration).toContain('employment_pension_assignments_supersedes_scope_fkey')
    expect(migration).toContain('labor_condition_pension_arrangements_idempotency_idx')
    expect(migration).toContain('employment_pension_assignments_idempotency_idx')
    expect(migration).toContain('PENSION_MAPPING_OVERLAP')
    expect(migration).toContain('PENSION_ASSIGNMENT_OVERLAP')
    expect(migration).toContain('PENSION_ASSIGNMENT_IDEMPOTENCY_CONFLICT')
    expect(migration).toContain("v_assignment.provenance_json ->> 'participantGroup' IS DISTINCT FROM v_participant_group")
    expect(migration).toContain('PENSION_ASSIGNMENT_PREDECESSOR_ALREADY_SUPERSEDED')
    expect(migration).toContain('FOR UPDATE')
  })

  it('covers scoped supersession foreign keys with indexes', () => {
    expect(supersessionIndexes).toMatch(/CREATE INDEX IF NOT EXISTS labor_condition_pension_arrangements_supersedes_scope_idx[\s\S]*?\(supersedes_mapping_id, tenant_id, hr_group_id, administration_id, labor_condition_set_id, participant_group\)/i)
    expect(supersessionIndexes).toMatch(/CREATE INDEX IF NOT EXISTS employment_pension_assignments_supersedes_scope_idx[\s\S]*?\(supersedes_assignment_id, tenant_id, hr_group_id, administration_id, employment_id\)/i)
  })

  it('requires server-controlled non-production claims for synthetic provenance and writes audit rows atomically', () => {
    expect(migration).toContain("auth.jwt() -> 'app_metadata' ->> 'liquidhr_pension_test_fixtures_enabled'")
    expect(migration).toContain("auth.jwt() -> 'app_metadata' ->> 'liquidhr_pension_fixture_environment'")
    expect(migration).toContain("NOT IN ('test', 'development', 'preview')")
    expect(migration).toContain('PENSION_TEST_FIXTURE_DISABLED')
    expect(migration).toContain("'labor_condition_pension_arrangements', v_mapping.id")
    expect(migration).toContain("'employment_pension_arrangement_assignments', v_assignment.id")
    expect(migration).toContain('-- mappings and individual employment assignments. Mapping rows never create')
    expect(migration).toContain('-- assignments; each employee still requires an explicit assignment.')
  })

  it('retains tenant and HR-group RLS for reads while the RPC owns writes', () => {
    for (const table of ['labor_condition_pension_arrangements', 'employment_pension_arrangement_assignments']) {
      expect(baseSchema).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'))
      expect(scopedPolicies).toMatch(new RegExp(`CREATE POLICY ${table}_read ON public\\.${table}[\\s\\S]*?has_hr_group_access`, 'i'))
      expect(scopedPolicies).toMatch(new RegExp(`CREATE POLICY ${table}_read ON public\\.${table}[\\s\\S]*?current_user_has_permission`, 'i'))
    }
    expect(migration).not.toMatch(/DISABLE ROW LEVEL SECURITY|DROP POLICY/i)
    expect(migration).not.toContain("auth.jwt() -> 'user_metadata'")
  })
})
