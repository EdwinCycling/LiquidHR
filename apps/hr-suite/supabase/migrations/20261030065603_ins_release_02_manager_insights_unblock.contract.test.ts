import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261030065603_ins_release_02_manager_insights_unblock.sql', import.meta.url)
const activationUrl = new URL('./20261030120901_ins_release_04_manager_insights_activation.sql', import.meta.url)
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
const hrAdminRole = '00000000-0000-4000-8000-000000000107'
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
      ('${inactiveManagerRole}', '${tenantA}', 'DIRECT_MANAGER', false, null),
      ('${deletedManagerRole}', '${tenantA}', 'DIRECT_MANAGER', true, now()),
      ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'EMPLOYEE', true, null),
      ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'HR_ADMIN', true, null);
    insert into public.role_permissions (management_role_id, permission_id) values
      ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000201'),
      ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000202');
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
  it('keeps Phase A idempotent and grants no Manager report permission', async () => {
    database = await createDatabase(false)
    const db = database
    const countManagerGrants = async (): Promise<number> => {
      const result = await db.query<{ count: number }>(
        'select count(*)::integer as count from public.role_permissions rp join public.management_roles mr on mr.id = rp.management_role_id join public.permissions p on p.id = rp.permission_id where mr.code = \'DIRECT_MANAGER\' and p.code = \'report-absence:read\''
      )
      return result.rows[0]!.count
    }

    expect(await countManagerGrants()).toBe(0)
    await db.exec(await readFile(migrationUrl, 'utf8'))
    expect(await countManagerGrants()).toBe(0)
    await db.exec(await readFile(migrationUrl, 'utf8'))
    expect(await countManagerGrants()).toBe(0)

    const { rows } = await db.query<{ management_role_id: string }>(
      'select management_role_id from public.role_permissions where permission_id = $1',
      [reportPermission],
    )
    expect(rows.map((row) => row.management_role_id)).toEqual([hrAdminRole])
  })
  it('returns only the active group threshold to an activated Manager and hides the full settings row', async () => {
    database = await createDatabase()
    const db = database
    await db.exec(await readFile(activationUrl, 'utf8'))
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
    await db.exec(await readFile(activationUrl, 'utf8'))
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

  it('denies Manager threshold access before Phase C, then allows the exact report grant', async () => {
    database = await createDatabase()
    const db = database
    await db.query(
      'insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id) values ($1, $2, $3, $4)',
      [managerUser, tenantA, groupA, tenantManagerRole],
    )
    await setActor(db, managerUser)
    await expect(db.query('select * from public.get_frequent_absence_threshold($1, $2)', [tenantA, groupA]))
      .rejects.toThrow('INSIGHTS_THRESHOLD_FORBIDDEN')
    await db.exec('reset role')

    await db.exec(await readFile(activationUrl, 'utf8'))
    await setActor(db, managerUser)
    const projection = await db.query(
      'select configured, frequent_absence_threshold from public.get_frequent_absence_threshold($1, $2)',
      [tenantA, groupA],
    )
    expect(projection.rows).toEqual([{ configured: false, frequent_absence_threshold: null }])
  })

  it('activates active global and tenant managers idempotently and logs only newly inserted grants', async () => {
    database = await createDatabase(false)
    const db = database
    await db.query(
      'insert into public.role_permissions (management_role_id, permission_id) values ($1, $2)',
      [tenantManagerRole, reportPermission],
    )
    await db.exec(await readFile(activationUrl, 'utf8'))
    await db.exec(await readFile(activationUrl, 'utf8'))

    const grants = await db.query<{ management_role_id: string }>(
      'select management_role_id from public.role_permissions where permission_id = $1 order by management_role_id',
      [reportPermission],
    )
    expect(grants.rows.map((row) => row.management_role_id)).toEqual([hrAdminRole, globalManagerRole, tenantManagerRole, otherTenantManagerRole].sort())
    const logged = await db.query<{ count: number }>(
      'select count(*)::integer as count from internal_security.ins_release_04_manager_permission_activation_log where migration_version = $1',
      ['20261030120901'],
    )
    expect(logged.rows[0]!.count).toBe(2)

    const tablePrivileges = await db.query<{ role_name: string; can_select: boolean }>(
      'select role_name, has_table_privilege(role_name, $1, $2) as can_select from (values ($3), ($4), ($5)) as roles(role_name)',
      ['internal_security.ins_release_04_manager_permission_activation_log', 'SELECT', 'authenticated', 'anon', 'service_role'],
    )
    expect(tablePrivileges.rows).toEqual([
      { role_name: 'authenticated', can_select: false },
      { role_name: 'anon', can_select: false },
      { role_name: 'service_role', can_select: false },
    ])
  })

  it('rolls back only grants Phase C inserted and preserves pre-existing role permissions', async () => {
    database = await createDatabase(false)
    const db = database
    await db.query(
      'insert into public.role_permissions (management_role_id, permission_id) values ($1, $2)',
      [tenantManagerRole, reportPermission],
    )
    await db.exec(await readFile(activationUrl, 'utf8'))
    await db.exec(
      'begin; delete from public.role_permissions rp using internal_security.ins_release_04_manager_permission_activation_log activation where activation.migration_version = \'20261030120901\' and rp.management_role_id = activation.management_role_id and rp.permission_id = activation.permission_id; commit;',
    )

    const grants = await db.query<{ management_role_id: string }>(
      'select management_role_id from public.role_permissions where permission_id = $1 order by management_role_id',
      [reportPermission],
    )
    expect(grants.rows.map((row) => row.management_role_id)).toEqual([hrAdminRole, tenantManagerRole].sort())
    const logged = await db.query<{ count: number }>(
      'select count(*)::integer as count from internal_security.ins_release_04_manager_permission_activation_log where migration_version = $1',
      ['20261030120901'],
    )
    expect(logged.rows[0]!.count).toBe(2)
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

  it('keeps both threshold functions owned by the migration role with an empty search_path and safe EXECUTE grants', async () => {
    database = await createDatabase()
    const db = database
    const { rows } = await db.query<{
      currentOwner: string
      helperOwner: string
      helperSecurityDefiner: boolean
      helperSettings: string
      helperAuthenticatedExecute: boolean
      helperAnonExecute: boolean
      helperServiceExecute: boolean
      wrapperOwner: string
      wrapperSecurityDefiner: boolean
      wrapperSettings: string
      wrapperAuthenticatedExecute: boolean
      wrapperAnonExecute: boolean
      wrapperServiceExecute: boolean
    }>(`
      select
        current_user as "currentOwner",
        pg_get_userbyid(helper.proowner) as "helperOwner",
        helper.prosecdef as "helperSecurityDefiner",
        array_to_string(helper.proconfig, ',') as "helperSettings",
        has_function_privilege('authenticated', helper.oid, 'EXECUTE') as "helperAuthenticatedExecute",
        has_function_privilege('anon', helper.oid, 'EXECUTE') as "helperAnonExecute",
        has_function_privilege('service_role', helper.oid, 'EXECUTE') as "helperServiceExecute",
        pg_get_userbyid(wrapper.proowner) as "wrapperOwner",
        wrapper.prosecdef as "wrapperSecurityDefiner",
        array_to_string(wrapper.proconfig, ',') as "wrapperSettings",
        has_function_privilege('authenticated', wrapper.oid, 'EXECUTE') as "wrapperAuthenticatedExecute",
        has_function_privilege('anon', wrapper.oid, 'EXECUTE') as "wrapperAnonExecute",
        has_function_privilege('service_role', wrapper.oid, 'EXECUTE') as "wrapperServiceExecute"
      from pg_proc helper
      cross join pg_proc wrapper
      where helper.oid = 'internal_security.read_frequent_absence_threshold(uuid, uuid)'::regprocedure
        and wrapper.oid = 'public.get_frequent_absence_threshold(uuid, uuid)'::regprocedure
    `)

    expect(rows).toEqual([{
      currentOwner: rows[0]?.currentOwner,
      helperOwner: rows[0]?.currentOwner,
      helperSecurityDefiner: true,
      helperSettings: 'search_path=""',
      helperAuthenticatedExecute: true,
      helperAnonExecute: false,
      helperServiceExecute: false,
      wrapperOwner: rows[0]?.currentOwner,
      wrapperSecurityDefiner: false,
      wrapperSettings: 'search_path=""',
      wrapperAuthenticatedExecute: true,
      wrapperAnonExecute: false,
      wrapperServiceExecute: false,
    }])
  })
})
