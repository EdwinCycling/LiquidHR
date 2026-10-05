import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20261003123900_control02_xml_import_provenance_guard.sql'

describe('CONTROL02 XML import provenance guard', () => {
  it('locks source identity, period, and HR scope on payroll import batches', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('before insert or update on public.payroll_import_batches')
    expect(sql).toContain('internal_security.prevent_payroll_import_batch_provenance_change()')
    expect(sql).toContain("message = 'PAYROLL_IMPORT_PROVENANCE_IMMUTABLE'")
    expect(sql).toContain("message = 'REAL_XML_STAGING_PENDING'")
    expect(sql).toContain("if new.source_type = 'LOONAANGIFTE_XML' then")
    for (const field of [
      'tenant_id',
      'hr_group_id',
      'administration_id',
      'source_type',
      'source_filename',
      'source_hash',
      'tax_year',
      'period_start',
      'period_end',
      'payroll_tax_number',
      'idempotency_key',
      'created_by_user_id',
    ]) {
      expect(sql).toMatch(new RegExp(`old\\.${field}`))
      expect(sql).toMatch(new RegExp(`new\\.${field}`))
    }
  })

  it('uses an invoker trigger function and revokes direct public execution', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).not.toMatch(/security\s+definer/i)
    expect(sql).toContain('revoke all on function internal_security.prevent_payroll_import_batch_provenance_change() from public')
    expect(sql).toContain('grant execute on function internal_security.prevent_payroll_import_batch_provenance_change() to service_role')
  })

  it('keeps authenticated staging access read-only and assigns writes to the server role', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    for (const table of ['payroll_import_batches', 'payroll_import_persons', 'payroll_import_income_relationships']) {
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
      expect(sql).toContain(`grant select on table public.${table} to authenticated`)
      expect(sql).toContain(`grant select, insert, update on table public.${table} to service_role`)
    }
    expect(sql).toContain('drop policy if exists payroll_import_persons_update_group')
    expect(sql).toContain('drop policy if exists payroll_import_income_relationships_insert_group')
  })

  it('binds every staged income row to the same tenant, group, and administration as its batch', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('before insert or update on public.payroll_import_income_relationships')
    expect(sql).toContain('internal_security.enforce_payroll_import_income_batch_scope()')
    expect(sql).toContain("message = 'PAYROLL_IMPORT_INCOME_ADMINISTRATION_SCOPE_MISMATCH'")
    expect(sql).toContain('grant execute on function internal_security.enforce_payroll_import_income_batch_scope() to service_role')
    for (const field of ['id', 'tenant_id', 'hr_group_id', 'administration_id']) {
      expect(sql).toContain(`batch.${field} = new.${field === 'id' ? 'batch_id' : field}`)
    }
  })
})
