import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20261007095817_control02_test_payroll_import_fk_indexes.sql'

const expectedIndexes = [
  ['payroll_import_batches_created_by_user_id_idx', 'payroll_import_batches', 'created_by_user_id'],
  ['payroll_import_decisions_batch_scope_idx', 'payroll_import_decisions', 'tenant_id, hr_group_id, administration_id, batch_id'],
  ['payroll_import_income_relationships_administration_scope_idx', 'payroll_import_income_relationships', 'tenant_id, hr_group_id, administration_id'],
  ['payroll_import_income_relationships_person_scope_idx', 'payroll_import_income_relationships', 'tenant_id, hr_group_id, batch_id, import_person_id'],
  ['payroll_import_persons_employee_scope_idx', 'payroll_import_persons', 'tenant_id, hr_group_id, matched_employee_id'],
] as const

describe('CONTROL02 import foreign-key indexes', () => {
  it('adds a leading index for each uncovered import foreign key', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).replace(/\r\n/g, '\n')

    for (const [indexName, tableName, columns] of expectedIndexes) {
      expect(sql).toMatch(new RegExp(`create index if not exists ${indexName}\\s+on public\\.${tableName}\\s*\\(${columns.replaceAll(', ', ',\\s*')}\\)`, 'i'))
    }
  })
})