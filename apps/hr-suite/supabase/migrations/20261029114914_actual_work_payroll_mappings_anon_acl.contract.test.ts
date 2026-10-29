import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261029114914_actual_work_payroll_mappings_anon_acl.sql', import.meta.url), 'utf8')

describe('Actual Work Payroll mapping anonymous ACL migration contract', () => {
  it('revokes only anon and PUBLIC privileges on the W04 mapping table', () => {
    const normalized = migration
      .replace(/^\s*--.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    expect(normalized).toBe(
      'revoke all privileges on table public.actual_work_payroll_mappings from anon, public;',
    )
    expect(migration).not.toMatch(/alter\s+default\s+privileges/i)
    expect(migration).not.toMatch(/create\s+policy|alter\s+policy|drop\s+policy/i)
  })

  it('removes anonymous access while preserving authenticated access and the existing SELECT policy', async () => {
    const db = new PGlite()

    try {
      await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create table public.actual_work_payroll_mappings (
          tenant_id uuid not null,
          hr_group_id uuid not null
        );
        alter table public.actual_work_payroll_mappings enable row level security;
        create policy actual_work_payroll_mappings_read
          on public.actual_work_payroll_mappings
          for select to authenticated
          using (tenant_id is not null and hr_group_id is not null);
        grant all privileges on table public.actual_work_payroll_mappings to anon;
        grant all privileges on table public.actual_work_payroll_mappings to authenticated;
        grant all privileges on table public.actual_work_payroll_mappings to service_role;
        grant select, truncate on table public.actual_work_payroll_mappings to public;
      `)

      const beforePolicy = await db.query(`
        select policyname, permissive, roles, cmd, qual, with_check
        from pg_policies
        where schemaname = 'public' and tablename = 'actual_work_payroll_mappings'
      `)

      await db.exec(migration)

      const privileges = await db.query<{
        anon_select: boolean
        anon_truncate: boolean
        anon_insert: boolean
        authenticated_select: boolean
        authenticated_truncate: boolean
        service_role_select: boolean
        service_role_truncate: boolean
      }>(`
        select
          has_table_privilege('anon', 'public.actual_work_payroll_mappings', 'select') as anon_select,
          has_table_privilege('anon', 'public.actual_work_payroll_mappings', 'truncate') as anon_truncate,
          has_table_privilege('anon', 'public.actual_work_payroll_mappings', 'insert') as anon_insert,
          has_table_privilege('authenticated', 'public.actual_work_payroll_mappings', 'select') as authenticated_select,
          has_table_privilege('authenticated', 'public.actual_work_payroll_mappings', 'truncate') as authenticated_truncate,
          has_table_privilege('service_role', 'public.actual_work_payroll_mappings', 'select') as service_role_select,
          has_table_privilege('service_role', 'public.actual_work_payroll_mappings', 'truncate') as service_role_truncate
      `)
      const afterPolicy = await db.query(`
        select policyname, permissive, roles, cmd, qual, with_check
        from pg_policies
        where schemaname = 'public' and tablename = 'actual_work_payroll_mappings'
      `)

      expect(privileges.rows).toEqual([{
        anon_select: false,
        anon_truncate: false,
        anon_insert: false,
        authenticated_select: true,
        authenticated_truncate: true,
        service_role_select: true,
        service_role_truncate: true,
      }])
      expect(afterPolicy.rows).toEqual(beforePolicy.rows)
    } finally {
      await db.close()
    }
  })
})
