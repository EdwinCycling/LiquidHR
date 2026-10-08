import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(__dirname, '20261004100000_control01_payroll_import_role_override_permissions.sql'), 'utf8')

describe('CONTROL01 tenant role-override permission correction', () => {
  it('is an idempotent, forward-only convergence migration for the intended role codes', () => {
    expect(migration).toContain('CONVERGENCE_REQUIRED')
    expect(migration).toContain('tenant_role.tenant_id is not null')
    expect(migration).toContain("tenant_role.code in ('TENANT_ADMIN', 'HR_ADMIN', 'PAYROLL_SPECIALIST')")
    expect(migration).toContain("permission.code in ('payroll-import:read', 'payroll-import:write')")
    expect(migration).toContain('global_role.tenant_id is null')
    expect(migration).toContain('global_role.code = tenant_role.code')
    expect(migration).toContain('on conflict do nothing')
    expect(migration).not.toContain('user_hr_group_access')
    expect(migration).not.toContain('auth.users')
    expect(migration).not.toContain('product-updates:global-write')
  })
})
