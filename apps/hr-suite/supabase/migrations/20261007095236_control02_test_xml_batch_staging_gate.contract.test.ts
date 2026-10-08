import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20261007095236_control02_test_xml_batch_staging_gate.sql'

describe('CONTROL02 XML TEST staging gate', () => {
  it('allows service-role XML staging while keeping source identity immutable', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toMatch(/create or replace function internal_security\.prevent_payroll_import_batch_provenance_change\(\)/i)
    expect(sql).toContain("coalesce(auth.role(), '') <> 'service_role'")
    expect(sql).toContain("message = 'XML_STAGING_SERVICE_ROLE_REQUIRED'")
    expect(sql).not.toContain("message = 'REAL_XML_STAGING_PENDING'")
    expect(sql).toContain("message = 'PAYROLL_IMPORT_PROVENANCE_IMMUTABLE'")
    for (const field of ['tenant_id', 'hr_group_id', 'administration_id', 'source_type', 'source_filename', 'source_hash', 'tax_year', 'period_start', 'period_end', 'payroll_tax_number', 'idempotency_key', 'created_by_user_id']) {
      expect(sql).toContain(`old.${field}`)
      expect(sql).toContain(`new.${field}`)
    }
  })
})