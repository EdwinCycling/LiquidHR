import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL(
  '../../supabase/migrations/20260717100000_harden_hera_memory_and_preferences.sql',
  import.meta.url,
)
const messageMetadataMigrationUrl = new URL(
  '../../supabase/migrations/20260717101000_add_hera_message_metadata.sql',
  import.meta.url,
)

describe('HeRa persistence migration', () => {
  it('uses a single-column set-null conversation reference for memory', async () => {
    const sql = await readFile(migrationUrl, 'utf8')

    expect(sql).toContain('ai_memory_items_source_conversation_fkey')
    expect(sql).toMatch(/foreign key \(source_conversation_id\)[\s\S]+on delete set null/i)
    expect(sql).not.toMatch(/foreign key \(tenant_id, source_conversation_id\)[\s\S]+on delete set null/i)
  })

  it('creates owner-scoped preferences with RLS enabled', async () => {
    const sql = await readFile(migrationUrl, 'utf8')

    expect(sql).toContain('create table public.ai_user_preferences')
    expect(sql).toContain('unique (tenant_id, owner_user_id)')
    expect(sql).toContain('alter table public.ai_user_preferences enable row level security')
    expect(sql).toContain('ai_user_preferences_owner_access')
    expect(sql).toContain('owner_user_id = (select auth.uid())')
    expect(sql).toContain('internal_security.has_tenant_access(tenant_id)')
  })

  it('adds versioned control data to action drafts', async () => {
    const sql = await readFile(migrationUrl, 'utf8')

    expect(sql).toContain('action_type')
    expect(sql).toContain('version integer')
    expect(sql).toContain('control_payload jsonb')
  })

  it('persists only structured response metadata beside a message', async () => {
    const sql = await readFile(messageMetadataMigrationUrl, 'utf8')

    expect(sql).toMatch(/alter table public\.ai_messages[\s\S]+add column metadata jsonb/i)
    expect(sql).toContain("default '{}'::jsonb")
  })
})
