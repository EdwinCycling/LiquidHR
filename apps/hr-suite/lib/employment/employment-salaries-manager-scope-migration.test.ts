import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261014164200_scope_manager_employment_salary_read.sql', import.meta.url), 'utf8')
const tenantScopedSalaryReadMigration = readFileSync(new URL('../../supabase/migrations/20261029064812_allow_tenant_scoped_employment_salary_visibility.sql', import.meta.url), 'utf8')

const tenantId = '10000000-0000-4000-8000-000000000001'
const hrGroupId = '10000000-0000-4000-8000-000000000002'
const firstAdministrationId = '10000000-0000-4000-8000-000000000003'
const secondAdministrationId = '10000000-0000-4000-8000-000000000004'
const firstDepartmentId = '10000000-0000-4000-8000-000000000005'
const secondDepartmentId = '10000000-0000-4000-8000-000000000006'
const otherHrGroupId = '10000000-0000-4000-8000-000000000007'
const otherGroupAdministrationId = '10000000-0000-4000-8000-000000000008'
const otherGroupDepartmentId = '10000000-0000-4000-8000-000000000009'
const managerUserId = '20000000-0000-4000-8000-000000000001'
const tenantAdminUserId = '20000000-0000-4000-8000-000000000002'
const employeeUserId = '20000000-0000-4000-8000-000000000003'
const managerEmployeeId = '30000000-0000-4000-8000-000000000001'
const directReportId = '30000000-0000-4000-8000-000000000002'
const departmentReportId = '30000000-0000-4000-8000-000000000003'
const unrelatedEmployeeId = '30000000-0000-4000-8000-000000000004'
const otherAdministrationEmployeeId = '30000000-0000-4000-8000-000000000005'
const selfEmployeeId = '30000000-0000-4000-8000-000000000006'
const otherGroupEmployeeId = '30000000-0000-4000-8000-000000000007'
const managerRoleId = '40000000-0000-4000-8000-000000000001'
const adminRoleId = '40000000-0000-4000-8000-000000000002'
const salaryReadPermissionId = '50000000-0000-4000-8000-000000000001'
const salaryWritePermissionId = '50000000-0000-4000-8000-000000000002'

async function createDatabase(tenantScopedAdmin = false, tenantAdminGroupAccess = true) {
  const db = new PGlite()
  const tenantAdminAccess = tenantScopedAdmin
    ? `('${tenantAdminUserId}', '${tenantId}', null, '${adminRoleId}', 'TENANT', null, true)`
    : `('${tenantAdminUserId}', '${tenantId}', '${hrGroupId}', '${adminRoleId}', 'ADMINISTRATION', '${firstAdministrationId}', true)`
  const tenantAdminGroupGrant = tenantAdminGroupAccess
    ? `, ('${tenantAdminUserId}', '${tenantId}', '${hrGroupId}', true)`
    : ''
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE SCHEMA internal_security;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE TABLE public.employees (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      auth_user_id uuid,
      deleted_at timestamptz
    );
    CREATE TABLE public.administrations (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      is_active boolean NOT NULL
    );
    CREATE TABLE public.departments (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      parent_id uuid
    );
    CREATE TABLE public.employee_organizations (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      administration_id uuid NOT NULL,
      employee_id uuid NOT NULL,
      department_id uuid NOT NULL,
      direct_manager_id uuid,
      effective_from date NOT NULL,
      effective_to date
    );
    CREATE TABLE public.department_management (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      department_id uuid NOT NULL,
      management_role_id uuid NOT NULL,
      employee_id uuid NOT NULL,
      effective_from date NOT NULL,
      effective_to date
    );
    CREATE TABLE public.management_roles (
      id uuid PRIMARY KEY,
      code text NOT NULL,
      tenant_id uuid,
      is_active boolean NOT NULL,
      deleted_at timestamptz
    );
    CREATE TABLE public.permissions (id uuid PRIMARY KEY, code text NOT NULL);
    CREATE TABLE public.role_permissions (management_role_id uuid NOT NULL, permission_id uuid NOT NULL);
    CREATE TABLE public.user_access (
      user_id uuid NOT NULL,
      tenant_id uuid NOT NULL,
      hr_group_id uuid,
      management_role_id uuid NOT NULL,
      scope_type text NOT NULL,
      administration_id uuid,
      is_active boolean NOT NULL,
      CHECK ((scope_type = 'TENANT' AND hr_group_id IS NULL)
        OR (scope_type = 'ADMINISTRATION' AND hr_group_id IS NOT NULL))
    );
    CREATE TABLE public.user_hr_group_access (
      user_id uuid NOT NULL,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      is_active boolean NOT NULL
    );
    CREATE TABLE public.employment_salaries (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      administration_id uuid NOT NULL,
      employee_id uuid NOT NULL,
      employment_id uuid NOT NULL,
      amount integer NOT NULL
    );
    ALTER TABLE public.employment_salaries ENABLE ROW LEVEL SECURITY;
    CREATE POLICY employment_salaries_read ON public.employment_salaries
      FOR SELECT TO authenticated USING (true);
    GRANT SELECT ON public.employees, public.employment_salaries TO authenticated;
    CREATE FUNCTION internal_security.has_hr_group_access(requested_tenant_id uuid, requested_hr_group_id uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.user_hr_group_access access
          WHERE access.user_id = (SELECT auth.uid())
            AND access.tenant_id = requested_tenant_id
            AND access.hr_group_id = requested_hr_group_id
            AND access.is_active
        )
      $$;
    CREATE FUNCTION internal_security.has_administration_access(requested_tenant_id uuid, requested_administration_id uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.user_access access
          JOIN public.administrations administration
            ON administration.id = requested_administration_id
           AND administration.tenant_id = access.tenant_id
           AND administration.is_active
          WHERE access.user_id = (SELECT auth.uid())
            AND access.tenant_id = requested_tenant_id
            AND access.is_active
            AND (access.scope_type = 'TENANT'
              OR (access.scope_type = 'ADMINISTRATION' AND access.administration_id = requested_administration_id))
        )
      $$;
    CREATE FUNCTION internal_security.current_employee_has_permission(requested_permission_code text)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
        SELECT coalesce(nullif(current_setting('test.self_salary_read', true), '')::boolean, false)
      $$;
    CREATE FUNCTION internal_security.current_user_has_permission(requested_tenant_id uuid, requested_administration_id uuid, requested_permission_code text)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
        SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
          SELECT 1
          FROM public.user_access access
          JOIN public.management_roles role ON role.id = access.management_role_id
          JOIN public.role_permissions role_permission ON role_permission.management_role_id = role.id
          JOIN public.permissions permission ON permission.id = role_permission.permission_id
          WHERE access.user_id = (SELECT auth.uid())
            AND access.tenant_id = requested_tenant_id
            AND access.is_active
            AND (access.scope_type = 'TENANT'
              OR (access.scope_type = 'ADMINISTRATION' AND access.administration_id = requested_administration_id))
            AND role.is_active
            AND role.deleted_at IS NULL
            AND permission.code = requested_permission_code
        )
      $$;
  `)
  await db.exec(migration)
  await db.exec(tenantScopedSalaryReadMigration)
  await db.exec(`
    INSERT INTO public.administrations (id, tenant_id, hr_group_id, is_active) VALUES
      ('${firstAdministrationId}', '${tenantId}', '${hrGroupId}', true),
      ('${secondAdministrationId}', '${tenantId}', '${hrGroupId}', true),
      ('${otherGroupAdministrationId}', '${tenantId}', '${otherHrGroupId}', true);
    INSERT INTO public.departments (id, tenant_id, hr_group_id, parent_id) VALUES
      ('${firstDepartmentId}', '${tenantId}', '${hrGroupId}', null),
      ('${secondDepartmentId}', '${tenantId}', '${hrGroupId}', null),
      ('${otherGroupDepartmentId}', '${tenantId}', '${otherHrGroupId}', null);
    INSERT INTO public.management_roles (id, code, tenant_id, is_active, deleted_at) VALUES
      ('${managerRoleId}', 'DIRECT_MANAGER', null, true, null),
      ('${adminRoleId}', 'TENANT_ADMIN', null, true, null);
    INSERT INTO public.permissions (id, code) VALUES
      ('${salaryReadPermissionId}', 'salary:read'),
      ('${salaryWritePermissionId}', 'salary:write');
    INSERT INTO public.role_permissions (management_role_id, permission_id) VALUES
      ('${managerRoleId}', '${salaryReadPermissionId}'),
      ('${adminRoleId}', '${salaryReadPermissionId}'),
      ('${adminRoleId}', '${salaryWritePermissionId}');
    INSERT INTO public.employees (id, tenant_id, hr_group_id, auth_user_id, deleted_at) VALUES
      ('${managerEmployeeId}', '${tenantId}', '${hrGroupId}', '${managerUserId}', null),
      ('${directReportId}', '${tenantId}', '${hrGroupId}', null, null),
      ('${departmentReportId}', '${tenantId}', '${hrGroupId}', null, null),
      ('${unrelatedEmployeeId}', '${tenantId}', '${hrGroupId}', null, null),
      ('${otherAdministrationEmployeeId}', '${tenantId}', '${hrGroupId}', null, null),
      ('${selfEmployeeId}', '${tenantId}', '${hrGroupId}', '${employeeUserId}', null),
      ('${otherGroupEmployeeId}', '${tenantId}', '${otherHrGroupId}', null, null);
    INSERT INTO public.user_access (user_id, tenant_id, hr_group_id, management_role_id, scope_type, administration_id, is_active) VALUES
      ('${managerUserId}', '${tenantId}', null, '${managerRoleId}', 'TENANT', null, true),
      ${tenantAdminAccess};
    INSERT INTO public.user_hr_group_access (user_id, tenant_id, hr_group_id, is_active) VALUES
      ('${managerUserId}', '${tenantId}', '${hrGroupId}', true)${tenantAdminGroupGrant};
    INSERT INTO public.employee_organizations
      (id, tenant_id, hr_group_id, administration_id, employee_id, department_id, direct_manager_id, effective_from, effective_to) VALUES
      ('60000000-0000-4000-8000-000000000001', '${tenantId}', '${hrGroupId}', '${firstAdministrationId}', '${directReportId}', '${firstDepartmentId}', '${managerEmployeeId}', current_date - 1, null),
      ('60000000-0000-4000-8000-000000000002', '${tenantId}', '${hrGroupId}', '${firstAdministrationId}', '${departmentReportId}', '${firstDepartmentId}', null, current_date - 1, null),
      ('60000000-0000-4000-8000-000000000003', '${tenantId}', '${hrGroupId}', '${firstAdministrationId}', '${unrelatedEmployeeId}', '${secondDepartmentId}', null, current_date - 1, null),
      ('60000000-0000-4000-8000-000000000004', '${tenantId}', '${hrGroupId}', '${secondAdministrationId}', '${otherAdministrationEmployeeId}', '${secondDepartmentId}', null, current_date - 1, null),
      ('60000000-0000-4000-8000-000000000005', '${tenantId}', '${otherHrGroupId}', '${otherGroupAdministrationId}', '${otherGroupEmployeeId}', '${otherGroupDepartmentId}', null, current_date - 1, null);
    INSERT INTO public.department_management
      (id, tenant_id, hr_group_id, department_id, management_role_id, employee_id, effective_from, effective_to)
      VALUES ('70000000-0000-4000-8000-000000000001', '${tenantId}', '${hrGroupId}', '${firstDepartmentId}', '${managerRoleId}', '${managerEmployeeId}', current_date - 1, null);
    INSERT INTO public.employment_salaries (id, tenant_id, administration_id, employee_id, employment_id, amount) VALUES
      ('80000000-0000-4000-8000-000000000001', '${tenantId}', '${firstAdministrationId}', '${directReportId}', '90000000-0000-4000-8000-000000000001', 1000),
      ('80000000-0000-4000-8000-000000000002', '${tenantId}', '${firstAdministrationId}', '${departmentReportId}', '90000000-0000-4000-8000-000000000002', 1100),
      ('80000000-0000-4000-8000-000000000003', '${tenantId}', '${firstAdministrationId}', '${unrelatedEmployeeId}', '90000000-0000-4000-8000-000000000003', 1200),
      ('80000000-0000-4000-8000-000000000004', '${tenantId}', '${secondAdministrationId}', '${otherAdministrationEmployeeId}', '90000000-0000-4000-8000-000000000004', 1300),
      ('80000000-0000-4000-8000-000000000005', '${tenantId}', '${firstAdministrationId}', '${selfEmployeeId}', '90000000-0000-4000-8000-000000000005', 1400),
      ('80000000-0000-4000-8000-000000000006', '${tenantId}', '${otherGroupAdministrationId}', '${otherGroupEmployeeId}', '90000000-0000-4000-8000-000000000006', 1500);
    CREATE POLICY employment_salaries_insert ON public.employment_salaries
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write')));
    GRANT SELECT, INSERT ON public.employment_salaries TO authenticated;
  `)
  await db.exec('SET ROLE authenticated')
  return db
}

async function setActor(db: PGlite, userId: string, selfSalaryRead = false) {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId])
  await db.query(`SELECT set_config('test.self_salary_read', $1, false)`, [String(selfSalaryRead)])
}

describe('employment salary manager scope migration', () => {
  it('limits a manager to direct reports and assigned departments within accessible administrations', async () => {
    const db = await createDatabase()
    try {
      await setActor(db, managerUserId)
      const result = await db.query<{ employee_id: string }>(
        'SELECT employee_id FROM public.employment_salaries ORDER BY employee_id',
      )
      expect(result.rows.map((row) => row.employee_id).sort()).toEqual([directReportId, departmentReportId].sort())
      expect(await db.query<{ allowed: boolean }>(
        'SELECT internal_security.can_view_employment_salary($1, $2) AS allowed',
        [unrelatedEmployeeId, firstAdministrationId],
      )).toMatchObject({ rows: [{ allowed: false }] })
    } finally {
      await db.close()
    }
  })

  it('keeps administration-scoped HR Admin access, denies another administration, and preserves self salary access', async () => {
    const db = await createDatabase()
    try {
      await setActor(db, tenantAdminUserId)
      const adminRows = await db.query<{ employee_id: string }>(
        'SELECT employee_id FROM public.employment_salaries ORDER BY employee_id',
      )
      expect(adminRows.rows.map((row) => row.employee_id).sort()).toEqual([
        directReportId, departmentReportId, unrelatedEmployeeId,
      ].sort())

      await setActor(db, employeeUserId, true)
      const selfRows = await db.query<{ employee_id: string }>(
        'SELECT employee_id FROM public.employment_salaries ORDER BY employee_id',
      )
      expect(selfRows.rows.map((row) => row.employee_id)).toEqual([selfEmployeeId])
    } finally {
      await db.close()
    }
  })

  it('allows tenant-scoped HR Admin salary insertion and RETURNING only in an actively accessible HR group', async () => {
    const db = await createDatabase(true)
    try {
      await setActor(db, tenantAdminUserId)

      const inserted = await db.query<{ id: string }>(`
        INSERT INTO public.employment_salaries
          (id, tenant_id, administration_id, employee_id, employment_id, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, ['80000000-0000-4000-8000-000000000007', tenantId, firstAdministrationId, directReportId,
        '90000000-0000-4000-8000-000000000007', 1600])
      expect(inserted.rows).toEqual([{ id: '80000000-0000-4000-8000-000000000007' }])

      const visibleRows = await db.query<{ employee_id: string }>(
        'SELECT employee_id FROM public.employment_salaries ORDER BY employee_id',
      )
      expect(visibleRows.rows.map((row) => row.employee_id).sort()).toEqual([
        directReportId, directReportId, departmentReportId, unrelatedEmployeeId, otherAdministrationEmployeeId,
      ].sort())

    } finally {
      await db.close()
    }
  })

  it('fails closed when tenant-scoped HR Admin has no access to the employee HR group', async () => {
    const db = await createDatabase(true, false)
    try {
      await setActor(db, tenantAdminUserId)
      expect(await db.query<{ allowed: boolean }>(
        `SELECT internal_security.current_user_has_permission($1, $2, 'salary:write') AS allowed`,
        [tenantId, firstAdministrationId],
      )).toMatchObject({ rows: [{ allowed: true }] })

      const visibleRows = await db.query<{ employee_id: string }>(
        'SELECT employee_id FROM public.employment_salaries ORDER BY employee_id',
      )
      expect(visibleRows.rows).toEqual([])

      await expect(db.query(`
        INSERT INTO public.employment_salaries
          (id, tenant_id, administration_id, employee_id, employment_id, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, ['80000000-0000-4000-8000-000000000009', tenantId, firstAdministrationId, directReportId,
        '90000000-0000-4000-8000-000000000009', 1800])).rejects.toThrow(/row-level security/i)
    } finally {
      await db.close()
    }
  })

  it('denies salary INSERT to Manager and Employee identities', async () => {
    const db = await createDatabase()
    try {
      for (const actorId of [managerUserId, employeeUserId]) {
        await setActor(db, actorId)
        await expect(db.query(`
          INSERT INTO public.employment_salaries
            (id, tenant_id, administration_id, employee_id, employment_id, amount)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, ['80000000-0000-4000-8000-000000000008', tenantId, firstAdministrationId, directReportId,
          '90000000-0000-4000-8000-000000000008', 1700])).rejects.toThrow(/row-level security/i)
      }
    } finally {
      await db.close()
    }
  })

  it('limits the scope-check helper to authenticated callers', async () => {
    const db = await createDatabase()
    try {
      const grants = await db.query<{ anon_execute: boolean; authenticated_execute: boolean; service_execute: boolean }>(`
        SELECT
          has_function_privilege('anon', 'internal_security.can_view_employment_salary(uuid, uuid)', 'EXECUTE') AS anon_execute,
          has_function_privilege('authenticated', 'internal_security.can_view_employment_salary(uuid, uuid)', 'EXECUTE') AS authenticated_execute,
          has_function_privilege('service_role', 'internal_security.can_view_employment_salary(uuid, uuid)', 'EXECUTE') AS service_execute
      `)
      expect(grants.rows[0]).toEqual({ anon_execute: false, authenticated_execute: true, service_execute: false })
    } finally {
      await db.close()
    }
  })
})
