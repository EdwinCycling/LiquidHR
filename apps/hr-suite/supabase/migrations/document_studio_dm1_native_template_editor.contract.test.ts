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
    expect(sql).toContain('DOCUMENT_STUDIO_CONFIG_IDENTITY_IMMUTABLE')
    expect(sql).toContain('document_studio_replay_idempotency')
    expect(sql).toContain('document_studio_replay_discard_idempotency')
    expect(sql).toContain('create_document_studio_draft_from_active')
    expect(sql).toContain('document_studio_assert_document_assets')
    expect(sql).toContain('DOCUMENT_ASSET_REFS_MISMATCH')
    expect(sql).toContain('document_studio_audit')
    expect(sql).toContain("insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)")
    expect(sql).toContain('document_studio_assets_select')
    expect(sql).toContain('document_studio_compositions_one_cover_idx')
    expect(sql.indexOf('create table public.document_studio_template_compositions')).toBeLessThan(sql.indexOf('create unique index document_studio_compositions_one_cover_idx'))
    expect(sql).toContain('document_studio_assert_composition')
    expect(sql).toContain('document_studio_assert_canonical_document')
    expect(sql).toContain("DOCUMENT_TEMPLATE_ARCHIVED_TERMINAL")
    expect(sql).toContain("DOCUMENT_TEMPLATE_DRAFT_EXISTS")
    expect(sql).toContain("DOCUMENT_TYPE_NOT_ACTIVE")
    expect(sql).toContain("DOCUMENT_PROFILE_SOURCE_INVALID")
    expect(sql).toContain("revoke all on function public.validate_document_studio_template_draft(uuid, integer, text, jsonb) from public, anon;")
  })

  it('keeps lifecycle pointers RPC-owned and the asset finalization seam server-only', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain('create trigger document_studio_guard_template_trigger')
    expect(sql).toContain('create trigger document_studio_guard_document_type_trigger')
    expect(sql).toContain("grant update (name, description, updated_by_user_id) on public.document_studio_templates to authenticated;")
    expect(sql).not.toContain('grant update on public.document_studio_templates to authenticated;')
    expect(sql).toContain('DOCUMENT_TEMPLATE_LIFECYCLE_RPC_REQUIRED')
    expect(sql).toContain('grant usage on schema internal_security to service_role;')
    expect(sql).toContain("if auth.role() <> 'service_role'")
    expect(sql).toContain('grant execute on function public.create_document_studio_asset_server')
    expect(sql).toContain('to service_role;')
    expect(sql).not.toContain('grant execute on function public.create_document_studio_asset(')
    expect(sql).toContain("status = 'PENDING'")
    expect(sql).toContain("status = 'APPROVED'")
  })

  it('does not allow the validation RPC to trust caller diagnostics or hash', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    const validationBlock = sql.slice(sql.indexOf('create or replace function internal_security.mark_document_studio_draft_valid'))
    expect(validationBlock).toContain('document_studio_assert_canonical_document')
    expect(validationBlock).toContain("validation_state = 'VALID'")
    expect(validationBlock).toContain("validation_diagnostics = '[]'::jsonb")
    expect(validationBlock).not.toContain('content_hash = requested_hash')
    expect(validationBlock).not.toContain('validation_diagnostics = requested_diagnostics')
  })

  it('uses one recursive reference per JSON walker while traversing arrays and objects', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    const walkers = [...sql.matchAll(/with recursive nodes\(value\) as \(([\s\S]*?)\n  \)/g)].map((match) => match[1])

    expect(walkers).toHaveLength(2)
    for (const walker of walkers) {
      expect(walker.match(/\bfrom nodes\b/g)).toHaveLength(1)
      expect(walker).toContain('from nodes n')
      expect(walker).toContain('cross join lateral (')
      expect(walker).toContain('from jsonb_array_elements(')
      expect(walker).toContain('from jsonb_each(')
    }
  })

  it('seeds Document Studio permissions only for the existing TENANT_ADMIN role code', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain("where role.code = 'TENANT_ADMIN'")
    expect(sql).not.toContain("role.code = 'MANAGER'")
    expect(sql).not.toContain("role.code = 'EMPLOYEE'")
    expect(sql).not.toContain('apply_migration')
  })
})
