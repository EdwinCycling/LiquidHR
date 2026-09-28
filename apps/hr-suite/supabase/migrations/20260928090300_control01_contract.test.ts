import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const enumMigration = readFileSync(resolve(__dirname, '20260928090000_control01_first_admin_invitation_enum.sql'), 'utf8')
const bootstrapMigration = readFileSync(resolve(__dirname, '20260928090100_control01_customer_bootstrap.sql'), 'utf8')
const importMigration = readFileSync(resolve(__dirname, '20260928090200_control01_payroll_import_staging.sql'), 'utf8')

describe('CONTROL01 additive migration contract', () => {
  it('marks all remote convergence work explicitly', () => {
    expect(enumMigration).toContain('CONVERGENCE_REQUIRED')
    expect(bootstrapMigration).toContain('CONVERGENCE_REQUIRED')
    expect(importMigration).toContain('CONVERGENCE_REQUIRED')
  })

  it('defines a scoped, idempotent first-admin invitation contract without token logging', () => {
    expect(enumMigration).toContain("add value if not exists 'TENANT_FIRST_ADMIN'")
    expect(bootstrapMigration).toContain('bootstrap_request_key')
    expect(bootstrapMigration).toContain('bootstrap_platform_first_admin')
    expect(bootstrapMigration).toContain('revoke_platform_first_admin_invitation')
    expect(bootstrapMigration).toContain('FIRST_ADMIN_ALREADY_EXISTS')
    expect(bootstrapMigration).toContain('FIRST_ADMIN_HR_GROUP_ACCESS_NOT_CREATED')
    expect(bootstrapMigration).not.toContain('raise notice')
    expect(bootstrapMigration).toContain("'delivery', 'DEFERRED'")
  })

  it('keeps payroll staging protected and free of raw XML or plaintext BSN', () => {
    for (const table of ['administration_payroll_tax_numbers', 'payroll_import_batches', 'payroll_import_persons', 'payroll_import_income_relationships']) {
      expect(importMigration).toContain(`alter table public.${table} enable row level security`)
      expect(importMigration).toContain(`grant select, insert, update on table public.${table} to authenticated`)
    }
    expect(importMigration).toContain('bsn_fingerprint')
    expect(importMigration).not.toContain('raw_xml')
    expect(importMigration).not.toContain('bsn text')
    expect(importMigration).toContain("'LOONAANGIFTE_XML', 'INTERNAL_REPRESENTATIVE'")
    expect(importMigration).toContain('match_payroll_import_employee_bsn_fingerprint')
    expect(importMigration).toContain("'payroll-import:write'")
  })
})
