import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261030065603_ins_release_02_manager_insights_unblock.sql', import.meta.url)
const tenantA = '00000000-0000-4000-8000-000000000001'
const tenantB = '00000000-0000-4000-8000-000000000002'
const groupA = '00000000-0000-4000-8000-000000000011'
const groupB = '00000000-0000-4000-8000-000000000012'
const groupC = '00000000-0000-4000-8000-000000000013'
const managerUser = '00000000-0000-4000-8000-000000000071'
const employeeUser = '00000000-0000-4000-8000-000000000072'
const globalManagerRole = '00000000-0000-4000-8000-000000000101'
const tenantManagerRole = '00000000-0000-4000-8000-000000000102'
const otherTenantManagerRole = '00000000-0000-4000-8000-000000000103'
const inactiveManagerRole = '00000000-0000-4000-8000-000000000104'
const deletedManagerRole = '00000000-0000-4000-8000-000000000105'
const employeeRole = '00000000-0000-4000-8000-000000000106'
const reportPermission = '00000000-0000-4000-8000-000000000201'
const caseManagerEmployee = '00000000-0000-4000-8000-000000000301'

let database: PGlite | null = null

async function createDatabase(applyMigration = true): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(String.raw`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema internal_security;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.permissions (id uuid primary key, code text not null unique);
    create table public.management_roles (
      id uuid primary key, tenant_id uuid, code text not null,
      is_active boolean not null default true, deleted_at timestamptz
    );
    create table public.role_permissions (
      management_role_id uuid not null, permission_id uuid not null,
      created_at timestamptz not null default now(),
      primary key (management_role_id, permission_id)
    );
    create table public.hr_groups (
      tenant_id uuid not null, id uuid not null, is_active boolean not null default true,
      primary key (tenant_id, id)
    );
    create table public.user_hr_group_access (
      user_id uuid not null, tenant_id uuid not null, hr_group_id uuid not null,
      management_role_id uuid not null, is_active boolean not null default true
    );
    create table public.absence_settings (
      id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null,
      frequent_absence_threshold smallint not null check (frequent_absence_threshold between 1 and 20),
      default_case_manager_employee_id uuid, unique (tenant_id, hr_group_id)
    );
    create function internal_security.current_user_has_hr_group_permission(
      requested_tenant_id uuid, requested_hr_group_id uuid, requested_permission_code text
    )
    returns boolean language sql stable security definer set search_path = '' as $$
      select (select auth.uid()) is not null and exists (
        select 1
        from public.user_hr_group_access as access
        join public.management_roles as management_role on management_role.id = access.management_role_id
        join public.role_permissions as role_permission on role_permission.management_role_id = management_role.id
        join public.permissions as permission on permission.id = role_permission.permission_id
        join public.hr_groups as group_row
          on group_row.tenant_id = access.tenant_id
         and group_row.id = access.hr_group_id
         and group_row.is_active
        where access.user_id = (select auth.uid())
          and access.tenant_id = requested_tenant_id
          and access.hr_group_id = requested_hr_group_id
          and access.is_active
          and permission.code = requested_permission_code
          and (management_role.tenant_id is null or management_role.tenant_id = requested_tenant_id)
      )
    $$;
    grant usage on schema internal_security to authenticated;
    grant execute on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) to authenticated;
    grant select on public.absence_settings to authenticated;
    alter table public.absence_settings enable row level security;
    create policy absence_settings_group_select on public.absence_settings
      for select to authenticated
      using (internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'absence-settings:read'));
    insert into public.permissions (id, code) values
      ('00000000-0000-4000-8000-000000000201', 'report-absence:read'),
      ('00000000-0000-4000-8000-000000000202', 'absence-settings:read');
    insert into public.management_roles (id, tenant_id, code, is_active, deleted_at) values
      ('00000000-0000-4000-8000-000000000101', null, 'DIRECT_MANAGER', true, null),
      ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'DIRECT_MANAGER', true, null),
      ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000002', 'DIRECT_MANAGER', true, null),
      ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'DIRECT_MANAGER', false, null),
      ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'DIRECT_MANAGER', true, now()),
      ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'EMPLOYEE', true, null);
    insert into public.role_permissions (management_role_id, permission_id)
    values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201');
    insert into public.hr_groups (tenant_id, id) values
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011'),
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012'),
      ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013');
  `)
  if (applyMigration) await db.exec(await readFile(migrationUrl, 'utf8'))
  return db
}

async function setActor(db: PGlite, actorId: string): Promise<void> {
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', actorId])
  await db.exec('set role authenticated')
}

afterEach(async () => {
  if (database) await database.close()
  database = null
})

describe('INS-RELEASE-02 manager Insights permission and threshold read model', () => {
  it('grants active global and tenant DIRECT_MANAGER roles idempotently, excluding inactive and unrelated roles', async () => {
    database = await createDatabase(false)
    const db = database

    const readGrantCount = async (): Promise<number> => {
      const { rows } = await db.query<{ count: number }>(`
        select count(*)::integer as count
        from public.role_permissions as role_permission
        join public.management_roles as management_role on management_role.id = role_permission.management_role_id
        join public.permissions as permission on permission.id = role_permission.permission_id
        where management_role.code = 'DIRECT_MANAGER' and permission.code = 'report-absence:read'
      `)
      return rows[0]!.count
    }

    expect(await readGrantCount()).toBe(1)
    await db.exec(await readFile(migrationUrl, 'utf8'))
    expect(await readGrantCount()).toBe(3)
    await db.exec(await readFile(migrationUrl, 'utf8'))
    expect(await readGrantCount()).toBe(3)

    const { rows } = await db.query<{ management_role_id: string }>(`
      select management_role_id from public.role_permissions where permission_id = $1
    `, [reportPermission])
    const grantedRoleIds = rows.map((row) => row.management_role_id)
    expect(grantedRoleIds).toContain(globalManagerRole)
    expect(grantedRoleIds).toContain(tenantManagerRole)
    expect(grantedRoleIds).toContain(otherTenantManagerRole)
    expect(grantedRoleIds).not.toContain(inactiveManagerRole)
    expect(grantedRoleIds).not.toContain(deletedManagerRole)
    expect(grantedRoleIds).not.toContain(employeeRole)
  })

  it('returns only the active group threshold while normal Manager RLS hides the full settings row', async () => {
    database = await createDatabase()
    const db = database
    await db.query(
      'insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id) values ($1, $2, $3, $4)',
      [managerUser, tenantA, groupA, tenantManagerRole],
    )
    await setActor(db, managerUser)

    const absent = await db.query<{ configured: boolean; frequent_absence_threshold: number | null }>(
      'select configured, frequent_absence_threshold from public.get_frequent_absence_threshold($1, $2)',
      [tenantA, groupA],
    )
    expect(absent.rows).toEqual([{ configured: false, frequent_absence_threshold: null }])

    await db.exec('reset role')
    await db.query(
      'insert into public.absence_settings (id, tenant_id, hr_group_id, frequent_absence_threshold, default_case_manager_employee_id) values ($1, $2, $3, $4, $5)',
      ['00000000-0000-4000-8000-000000000401', tenantA, groupA, 4, caseManagerEmployee],
    )
    await setActor(db, managerUser)
    const hiddenSettings = await db.query(
      'select frequent_absence_threshold, default_case_manager_employee_id from public.absence_settings where tenant_id = $1 and hr_group_id = $2',
      [tenantA, groupA],
    )
    expect(hiddenSettings.rows).toEqual([])

    const { rows } = await db.query<{ projection: Record<string, unknown> }>(
      'select to_jsonb(projection) as projection from public.get_frequent_absence_threshold($1, $2) as projection',
      [tenantA, groupA],
    )
    expect(rows).toEqual([{ projection: { configured: true, frequent_absence_threshold: 4 } }])
    expect(rows[0]!.projection).not.toHaveProperty('default_case_manager_employee_id')
  })

  it('denies Employee, foreign HR-group, foreign tenant, and unauthenticated threshold reads', async () => {
    database = await createDatabase()
    const db = database
    await db.query(
      'insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id) values ($1, $2, $3, $4)',
      [employeeUser, tenantA, groupA, employeeRole],
    )
    await db.query(
      'insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id) values ($1, $2, $3, $4)',
      [managerUser, tenantA, groupA, tenantManagerRole],
    )

    await setActor(db, employeeUser)
    await expect(db.query('select * from public.get_frequent_absence_threshold($1, $2)', [tenantA, groupA]))
      .rejects.toThrow('INSIGHTS_THRESHOLD_FORBIDDEN')
    await db.exec('reset role')

    await setActor(db, managerUser)
    await expect(db.query('select * from public.get_frequent_absence_threshold($1, $2)', [tenantA, groupB]))
      .rejects.toThrow('INSIGHTS_THRESHOLD_FORBIDDEN')
    await expect(db.query('select * from public.get_frequent_absence_threshold($1, $2)', [tenantB, groupC]))
      .rejects.toThrow('INSIGHTS_THRESHOLD_FORBIDDEN')
    await db.exec('reset role')

    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', ''])
    await db.exec('set role authenticated')
    await expect(db.query('select * from public.get_frequent_absence_threshold($1, $2)', [tenantA, groupA]))
      .rejects.toThrow('AUTHENTICATION_REQUIRED')
  })

  it('restricts execution to authenticated callers and keeps the public wrapper SECURITY INVOKER', async () => {
    database = await createDatabase()
    const db = database
    const { rows } = await db.query<{
      authenticatedPublicExecute: boolean
      anonPublicExecute: boolean
      authenticatedHelperExecute: boolean
      anonHelperExecute: boolean
      wrapperSecurityType: boolean
    }>(`
      select
        has_function_privilege('authenticated', 'public.get_frequent_absence_threshold(uuid, uuid)', 'EXECUTE') as "authenticatedPublicExecute",
        has_function_privilege('anon', 'public.get_frequent_absence_threshold(uuid, uuid)', 'EXECUTE') as "anonPublicExecute",
        has_function_privilege('authenticated', 'internal_security.read_frequent_absence_threshold(uuid, uuid)', 'EXECUTE') as "authenticatedHelperExecute",
        has_function_privilege('anon', 'internal_security.read_frequent_absence_threshold(uuid, uuid)', 'EXECUTE') as "anonHelperExecute",
        (select prosecdef from pg_proc where oid = 'public.get_frequent_absence_threshold(uuid, uuid)'::regprocedure) as "wrapperSecurityType"
    `)
    expect(rows).toEqual([{
      authenticatedPublicExecute: true,
      anonPublicExecute: false,
      authenticatedHelperExecute: true,
      anonHelperExecute: false,
      wrapperSecurityType: false,
    }])
  })
})
