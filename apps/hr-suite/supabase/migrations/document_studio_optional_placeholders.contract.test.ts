import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

const migrationPath = 'supabase/migrations/20260927080748_document_studio_optional_placeholders.sql'
const readMigration = async () => (await readFile(migrationPath, 'utf8')).replace(/\r\n/g, '\n')

describe('Document Studio optional-placeholder migration contract', () => {
  it('allows a boolean optional flag only on known, temporal and free placeholder attributes', async () => {
    const sql = await readMigration()

    expect(sql).toContain("requested_allowed = array['field']::text[]")
    expect(sql).toContain("requested_allowed = array['field', 'temporal']::text[]")
    expect(sql).toContain("requested_allowed = array['key']::text[]")
    expect(sql).toContain("jsonb_typeof(requested_value -> 'optional') <> 'boolean'")
    expect(sql).toContain("not (placeholder_attributes and actual_key = 'optional')")
    expect(sql).toContain("raise exception 'DOCUMENT_SCHEMA_INVALID'")
  })

  it('keeps the validator security boundary unchanged', async () => {
    const sql = await readMigration()

    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = pg_catalog')
    expect(sql).not.toMatch(/grant\s+execute/i)
    expect(sql).not.toMatch(/grant\s+\w+\s+on\s+schema/i)
  })
})
