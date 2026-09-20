import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260920170000_grant_focus_act_as_demo_tenant_admin.sql'), 'utf8')

describe('DEV demo tenant Focus act-as alignment migration contract', () => {
  it('grants the existing capability only to the existing demo tenant TENANT_ADMIN override', () => {
    expect(sql).toContain("role.code = 'TENANT_ADMIN'")
    expect(sql).toContain("tenant.slug = 'liquid-hr-demo-holding'")
    expect(sql).toContain("permission.code = 'focus:act-as-employee'")
    expect(sql).toContain('on conflict do nothing')
    expect(sql).not.toContain("role.code in ('TENANT_ADMIN', 'HR_ADMIN')")
    expect(sql).not.toContain('role.tenant_id is null')
    expect(sql).not.toContain('auth.admin.')
  })
})
