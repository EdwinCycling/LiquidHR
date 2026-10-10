import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261008162746_pension_arrangement_versioning.sql', import.meta.url), 'utf8')

describe('Core pension arrangement versioning migration contract', () => {
  it('keeps immutable snapshots and their tiers, provenance, and audit rows scoped and RLS protected', () => {
    for (const table of [
      'pension_arrangement_versions',
      'pension_arrangement_version_tiers',
      'pension_arrangement_version_audit',
    ]) {
      expect(migration).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'))
      expect(migration).toMatch(new RegExp(`CREATE POLICY ${table}_read`, 'i'))
      expect(migration).toMatch(new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`, 'i'))
      expect(migration).toMatch(new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO authenticated`, 'i'))
    }

    expect(migration).toContain("'contractClassification', 'UNKNOWN'")
    expect(migration).toContain("'{\"status\":\"UNVERIFIED\"}'::jsonb")
    expect(migration).toContain('supersession_reason text')
    expect(migration).toContain('pension_arrangement_version_audit')
    expect(migration).toContain("current_user_has_permission(tenant_id, administration_id, 'audit:read'::text)")
    expect(migration).toContain('PENSION_ARRANGEMENT_VERSION_IMMUTABLE')
    expect(migration).not.toMatch(/DROP POLICY|GRANT ALL PRIVILEGES ON TABLE public\.pension_arrangements TO/i)
  })

  it('requires an authenticated scoped successor, a leaf predecessor, and an auditable reason', () => {
    expect(migration).toMatch(/CREATE FUNCTION public\.create_pension_arrangement_successor\([\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain('v_actor uuid := auth.uid()')
    expect(migration).toContain('internal_security.has_hr_group_access(v_parent.tenant_id, v_parent.hr_group_id)')
    expect(migration).toContain("internal_security.current_user_has_permission(v_parent.tenant_id, v_parent.administration_id, 'contract:write'::text)")
    expect(migration).toContain('child.supersedes_version_id = v_parent.id')
    expect(migration).toContain('v_parent.version_number + 1')
    expect(migration).toContain('UNIQUE (id, tenant_id, hr_group_id, administration_id)')
    expect(migration).toContain('pension_arrangement_versions_parent_scope_fk')
    expect(migration).toContain('PENSION_GRANDFATHERING_CONTRACT_CLASSIFICATION_UNPROVEN')
    expect(migration).toContain('v_parent.tenant_id, v_parent.hr_group_id, v_parent.administration_id')
    expect(migration).toContain('v_reason, p_successor -> \'supersession_provenance\', v_actor')
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.create_pension_arrangement_successor\(uuid, jsonb\) FROM PUBLIC, anon, authenticated/i)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_pension_arrangement_successor\(uuid, jsonb\) TO authenticated/i)
  })

  it('resolves one deterministic effective version and records contract classification in eligibility', () => {
    expect(migration).toMatch(/CREATE FUNCTION public\.resolve_pension_arrangement_versions\([\s\S]*?SECURITY INVOKER\s+SET search_path = ''/i)
    expect(migration).toContain('ORDER BY version.pension_arrangement_id, version.version_number DESC')
    expect(migration).toContain("'contractClassification', v_contract_classification")
    expect(migration).toContain("v_contract_classification <> 'NON_SOLIDARITY'")
    expect(migration).toMatch(/CONSTRAINT pension_arrangement_versions_successor_key UNIQUE \(supersedes_version_id\)/i)
    expect(migration).toMatch(/CONSTRAINT pension_arrangement_versions_number_key UNIQUE \(pension_arrangement_id, version_number\)/i)
  })
})
