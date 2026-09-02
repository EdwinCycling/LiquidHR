import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

const migrationPath = 'supabase/migrations/20260902132228_document_studio_dm1_native_template_editor.sql'

describe('Document Studio DM-1 migration candidate', () => {
  it('keeps the exact category enum, lifecycle constraints and guarded operations', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain("create type public.document_studio_category as enum (")
    for (const code of ['EMPLOYMENT', 'COMPENSATION', 'ABSENCE_LEAVE', 'PERFORMANCE_DEVELOPMENT', 'ONBOARDING', 'OFFBOARDING', 'POLICY_COMPLIANCE', 'GENERAL']) expect(sql).toContain(`  '${code}'`)
    expect(sql).toContain("create unique index document_studio_versions_one_draft_idx")
    expect(sql).toContain("create unique index document_studio_versions_one_active_idx")
    expect(sql).toContain('DOCUMENT_TEMPLATE_DRAFT_CONFLICT')
    expect(sql).toContain('DOCUMENT_TEMPLATE_VERSION_IMMUTABLE')
    expect(sql).toContain('create_document_studio_draft_from_active')
    expect(sql).toContain('document_studio_assert_document_assets')
    expect(sql).toContain('DOCUMENT_ASSET_REFS_MISMATCH')
    expect(sql).toContain('document_studio_audit')
    expect(sql).toContain("insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)")
    expect(sql).toContain('document_studio_assets_select')
    expect(sql).toContain("revoke all on function public.validate_document_studio_template_draft(uuid, integer, text, jsonb) from public, anon;")
  })

  it('seeds Document Studio permissions only for the existing TENANT_ADMIN role code', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain("where role.code = 'TENANT_ADMIN'")
    expect(sql).not.toContain("role.code = 'MANAGER'")
    expect(sql).not.toContain("role.code = 'EMPLOYEE'")
    expect(sql).not.toContain('apply_migration')
  })
})
