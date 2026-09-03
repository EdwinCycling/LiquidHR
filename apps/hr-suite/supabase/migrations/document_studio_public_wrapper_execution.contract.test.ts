import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

const originalMigrationPath = 'supabase/migrations/20260902132228_document_studio_dm1_native_template_editor.sql'
const followUpMigrationPath = 'supabase/migrations/20260903121602_document_studio_public_wrapper_execution.sql'

const wrappers = [
  {
    name: 'create_document_studio_template_draft',
    signature: 'uuid, uuid, text, public.document_studio_template_kind, public.document_studio_language, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text',
    internalName: 'create_document_studio_template_draft',
    internalSignature: 'uuid, uuid, text, public.document_studio_template_kind, public.document_studio_language, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text',
  },
  {
    name: 'save_document_studio_template_draft',
    signature: 'uuid, integer, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text',
    internalName: 'save_document_studio_template_draft',
    internalSignature: 'uuid, integer, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text',
  },
  {
    name: 'create_document_studio_draft_from_active',
    signature: 'uuid, uuid, text',
    internalName: 'create_document_studio_draft_from_active',
    internalSignature: 'uuid, uuid, text',
  },
  {
    name: 'validate_document_studio_template_draft',
    signature: 'uuid, integer, text, jsonb',
    internalName: 'mark_document_studio_draft_valid',
    internalSignature: 'uuid, integer, text, jsonb',
  },
  {
    name: 'activate_document_studio_template_draft',
    signature: 'uuid, integer, uuid, text',
    internalName: 'activate_document_studio_template_draft',
    internalSignature: 'uuid, integer, uuid, text',
  },
  {
    name: 'archive_document_studio_template',
    signature: 'uuid, uuid, text',
    internalName: 'archive_document_studio_template',
    internalSignature: 'uuid, uuid, text',
  },
  {
    name: 'discard_document_studio_template_draft',
    signature: 'uuid, uuid, text',
    internalName: 'discard_document_studio_template_draft',
    internalSignature: 'uuid, uuid, text',
  },
  {
    name: 'retire_document_studio_asset',
    signature: 'uuid',
    internalName: 'retire_document_studio_asset',
    internalSignature: 'uuid',
  },
  {
    name: 'replace_document_studio_template_tags',
    signature: 'uuid, jsonb',
    internalName: 'replace_document_studio_template_tags',
    internalSignature: 'uuid, jsonb',
  },
] as const

describe('Document Studio public wrapper execution follow-up', () => {
  it('promotes exactly the nine authenticated public wrappers to SECURITY DEFINER', async () => {
    const sql = await readFile(followUpMigrationPath, 'utf8')
    const normalizedSql = sql.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')

    for (const wrapper of wrappers) {
      expect(normalizedSql).toContain(`alter function public.${wrapper.name}(${wrapper.signature}) security definer;`)
    }

    expect(sql.match(/alter function public\./g)).toHaveLength(wrappers.length)
    expect(sql).not.toContain('grant execute')
    expect(sql).not.toContain('internal_security')
    expect(sql).not.toContain('document_studio_asset_server')
  })

  it('preserves authenticated wrapper grants, public and anon revokes, and sealed internal revokes', async () => {
    const sql = await readFile(originalMigrationPath, 'utf8')
    const normalizedSql = sql.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')

    for (const wrapper of wrappers) {
      expect(normalizedSql).toContain(`grant execute on function public.${wrapper.name}(${wrapper.signature}) to authenticated;`)
      expect(normalizedSql).toContain(`revoke all on function public.${wrapper.name}(${wrapper.signature}) from public, anon;`)
      expect(normalizedSql).toContain(`revoke all on function internal_security.${wrapper.internalName}(${wrapper.internalSignature}) from public, anon, authenticated;`)
    }
  })

  it('keeps the public wrappers locked to pg_catalog and leaves service-role asset wrappers unchanged', async () => {
    const sql = await readFile(originalMigrationPath, 'utf8')

    for (const wrapper of wrappers) {
      const start = sql.indexOf(`create or replace function public.${wrapper.name}`)
      const end = sql.indexOf('create or replace function ', start + 1)
      const block = sql.slice(start, end === -1 ? undefined : end)
      expect(block).toContain('security invoker')
      expect(block).toContain('set search_path = pg_catalog')
    }

    expect(sql).toContain('grant execute on function public.create_document_studio_asset_server')
    expect(sql).toContain('grant execute on function public.finalize_document_studio_asset_server(uuid) to service_role;')
    expect(sql).toContain('grant execute on function public.retire_document_studio_asset_server(uuid) to service_role;')
  })
})
