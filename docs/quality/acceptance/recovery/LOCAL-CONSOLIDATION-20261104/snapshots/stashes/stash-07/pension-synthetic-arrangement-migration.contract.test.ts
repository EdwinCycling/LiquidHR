import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261017110000_core_synthetic_mars_pension_arrangement.sql', import.meta.url), 'utf8')

describe('Mars synthetic pension arrangement migration contract', () => {
  it('keeps the route authenticated, scoped and non-production only', () => {
    expect(migration).toMatch(/CREATE FUNCTION public\.create_mars_payfull02_synthetic_pension_arrangement\(p_input jsonb\)[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain("auth.jwt() -> 'app_metadata' ->> 'liquidhr_pension_test_fixtures_enabled'")
    expect(migration).toContain("NOT IN ('test', 'development', 'preview')")
    expect(migration).toContain("current_user_has_permission(v_employment.tenant_id, v_employment.administration_id, 'pension:manage'::text)")
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.create_mars_payfull02_synthetic_pension_arrangement\(jsonb\)\s+FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_mars_payfull02_synthetic_pension_arrangement\(jsonb\)\s+TO authenticated/i)
  })

  it('does not accept caller-supplied pension conditions and records immutable version-1 provenance', () => {
    expect(migration).toContain("p_input ->> 'scenario' IS DISTINCT FROM 'PAYFULL-02-DEMO-001-MARS'")
    expect(migration).toContain("'MARS-TEST-PAYFULL02-001'")
    expect(migration).toContain('25.0000, 60.0000, 40.0000')
    expect(migration).toContain('19172.00, 137800.00')
    expect(migration).toContain("'TEST_SETUP_PAYFULL_02'")
    expect(migration).toContain("'SYNTHETIC_TEST_CREATED'")
    expect(migration).toContain('PENSION_SYNTHETIC_ARRANGEMENT_CONFLICT')
  })
})
