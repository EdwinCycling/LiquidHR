import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(__dirname, '20261018085806_20261018083400_core_db_25p02_manager_scope_optimization.sql'), 'utf8')

describe('CORE-DB-25P02 manager scope migration contract', () => {
  it('keeps the helper tenant-bound, permission-checked, and fixed-search-path', () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/i)
    expect(migration).toContain('pg_catalog.num_nonnulls(')
    expect(migration).toContain("'talent:manager-read'")
    expect(migration).toContain('organization.tenant_id = requested_tenant_id')
    expect(migration).toContain('organization.direct_manager_id = internal_security.current_employee_id()')
    expect(migration).toContain("organization.effective_to > current_date")
    expect(migration).toContain("profile_version.status = 'ACTIVE'")
    expect(migration).toContain('organization-chart:read')
    expect(migration).toContain('organization-placement:read')
    expect(migration).toContain("can_manage_employee(organization.employee_id, 'employee:read')")
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to authenticated')
  })

  it('routes all five manager-read policies through the narrow helper', () => {
    expect(migration.match(/current_user_can_read_talent_manager_scope\(/g)).toHaveLength(8)
    expect(migration).toContain('job_profiles_talent_read')
    expect(migration).toContain('job_profile_versions_talent_read')
    expect(migration).toContain('job_profile_capability_requirements_talent_read')
    expect(migration).toContain('talent_capabilities_talent_read')
    expect(migration).toContain('talent_levels_talent_read')
    expect(migration).toContain("'talent:read'")
    expect(migration).toContain("'talent:manage'")
    expect(migration).toContain("'self:talent-comparison:read'")
    expect(migration).toContain("'self:talent-record:read'")
    expect(migration).not.toMatch(/grant\s+[^;]*(?:role_permissions|permissions|employee_organizations)/i)
  })
})
