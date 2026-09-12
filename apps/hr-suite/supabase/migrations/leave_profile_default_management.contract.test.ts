import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260912120000_leave_profile_default_management.sql'

describe('Leave profile default management migration', () => {
  it('enforces normalized names, active defaults and archive safeguards', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain('lower(btrim(name))')
    expect(sql).toContain('before insert or update on public.leave_profiles')
    expect(sql).toContain('LEAVE_PROFILE_DEFAULT_MUST_BE_ACTIVE')
    expect(sql).toContain('LEAVE_PROFILE_DEFAULT_REPLACEMENT_REQUIRED')
    expect(sql).toContain('LEAVE_PROFILE_REFERENCED_BY_ACTIVE_SET')
  })

  it('keeps profile writes invoker-scoped and seals the resolver grants', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain('create or replace function public.save_group_leave_profile(')
    expect(sql).toContain('security invoker')
    expect(sql).toContain("'leave:write'")
    expect(sql).toContain('grant execute on function public.save_group_leave_profile')
    expect(sql).toContain('from public, anon')
  })

  it('preserves direct, set and default precedence while requiring active profiles', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    const resolver = sql.slice(sql.indexOf('create or replace function public.resolve_leave_profile_for_employment'))
    expect(resolver.indexOf('employment_leave_profiles')).toBeGreaterThan(-1)
    expect(resolver.indexOf('employee_set_members')).toBeGreaterThan(-1)
    expect(resolver.indexOf('is_group_default')).toBeGreaterThan(-1)
    expect(resolver.match(/profile\.is_active/g)?.length).toBeGreaterThanOrEqual(3)
    expect(resolver).toContain('order by employee_set.priority, employee_set.name, employee_set.id')
  })
})
