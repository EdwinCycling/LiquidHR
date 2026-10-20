import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261020201028_pension_arrangement_successor_permission.sql', import.meta.url), 'utf8')

describe('pension arrangement successor permission migration contract', () => {
  it('uses the same scoped pension-management permission as the editor and assignment RPC', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.create_pension_arrangement_successor\([\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain('v_actor uuid := auth.uid()')
    expect(migration).toContain('internal_security.has_hr_group_access(v_parent.tenant_id, v_parent.hr_group_id)')
    expect(migration).toContain("internal_security.current_user_has_permission(v_parent.tenant_id, v_parent.administration_id, 'pension:manage'::text)")
    expect(migration).not.toContain("current_user_has_permission(v_parent.tenant_id, v_parent.administration_id, 'contract:write'::text)")
    expect(migration).toContain('child.supersedes_version_id = v_parent.id')
    expect(migration).toContain('v_parent.version_number + 1')
    expect(migration).toContain('pension_arrangement_version_audit')
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.create_pension_arrangement_successor\(uuid, jsonb\) FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_pension_arrangement_successor\(uuid, jsonb\) TO authenticated/i)
    expect(migration).toContain('authenticated pension:manage permission')
  })
})
