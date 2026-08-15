import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814183000_salary_insights_manager_scope.sql'),
  'utf8',
)

describe('salary insights manager scope migration contract', () => {
  it('uses a dedicated scope guard for Salary Insights', () => {
    expect(migration).toContain('create or replace function internal_security.can_view_salary_insights_employee(')
    expect(migration).toContain("role.code in ('TENANT_ADMIN', 'HR_ADMIN')")
    expect(migration).toContain('target_department_tree')
    expect(migration).toContain("permission.code = 'salary:read'")
  })

  it('does not delegate the projection population to the broad general-purpose guard', () => {
    const projection = migration.slice(migration.indexOf('create or replace function public.get_salary_insights_projection('))
    expect(projection).not.toContain('can_manage_employee(')
    expect(projection).toContain('can_view_salary_insights_employee(')
  })

  it('hardens the helper and keeps the projection RPC authenticated-only', () => {
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('revoke all on function internal_security.can_view_salary_insights_employee(uuid, uuid, uuid) from public, anon, authenticated;')
    expect(migration).toContain('grant execute on function public.get_salary_insights_projection(uuid, uuid, date) to authenticated;')
  })
})
