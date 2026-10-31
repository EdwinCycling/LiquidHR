import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261017075639_core_pension_arrangement_customer_workflow.sql', import.meta.url), 'utf8')

describe('normal pension arrangement customer workflow migration contract', () => {
  it('creates an audited, version-one arrangement through an administration-scoped authenticated RPC', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.create_pension_arrangement\(p_input jsonb\)[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain('v_actor uuid := auth.uid()')
    expect(migration).toContain("current_user_has_permission(v_tenant_id, v_administration_id, 'pension:manage'::text)")
    expect(migration).toContain('internal_security.has_hr_group_access(v_tenant_id, v_hr_group_id)')
    expect(migration).toContain('v_version_id, v_tenant_id, v_hr_group_id, v_administration_id, v_arrangement_id')
    expect(migration).toContain("'USER_CREATED'")
    expect(migration).toContain("'parameterOrigin', 'EMPLOYER_PROVIDED'")
    expect(migration).toContain('PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED')
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.create_pension_arrangement\(jsonb\) FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_pension_arrangement\(jsonb\) TO authenticated/i)
  })

  it('keeps successor writes behind pension:manage instead of exposing the historical contract-write RPC', () => {
    expect(migration).toMatch(/CREATE FUNCTION public\.create_pension_arrangement_successor_for_pension_manager\([\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain("current_user_has_permission(v_parent.tenant_id, v_parent.administration_id, 'pension:manage'::text)")
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.create_pension_arrangement_successor_for_pension_manager\(uuid, jsonb\) FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_pension_arrangement_successor_for_pension_manager\(uuid, jsonb\) TO authenticated/i)
  })

  it('does not introduce synthetic fixture claims into the normal route', () => {
    expect(migration).not.toContain('PENSION_TEST_FIXTURES_ENABLED')
    expect(migration).not.toContain('liquidhr_pension_test_fixtures_enabled')
  })
})
