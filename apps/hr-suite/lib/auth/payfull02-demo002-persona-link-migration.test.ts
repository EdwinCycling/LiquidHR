import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261016064505_payfull02_demo002_employee_persona_link.sql', import.meta.url), 'utf8')

const actorId = '11111111-1111-4111-8111-111111111111'
const otherActorId = '11111111-1111-4111-8111-111111111112'
const authUserId = '22222222-2222-4222-8222-222222222222'
const employeeId = '1620bd56-4f74-db62-9f9e-a5ce1d286bc5'
const employmentId = '6236ee34-182d-1676-6635-ad8eed4c21f3'
const tenantId = '07249eb9-545c-883b-b26b-d52f83b4f4a1'
const hrGroupId = '6ba6f1df-e376-40f2-abff-ffdf000172e1'
const administrationId = '2057f6ec-cd3e-3c28-9126-c41235d4ffae'
const projectIssuer = 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'

async function createDatabase() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE SCHEMA internal_security;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      email_confirmed_at timestamptz,
      is_anonymous boolean
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    CREATE FUNCTION internal_security.current_user_has_permission(uuid, uuid, text)
    RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT current_setting('test.salary_write', true) = 'true'
    $$;
    CREATE TABLE public.tenants (id uuid PRIMARY KEY, slug text NOT NULL, is_active boolean NOT NULL);
    CREATE TABLE public.hr_groups (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL, is_active boolean NOT NULL);
    CREATE TABLE public.administrations (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL, hr_group_id uuid NOT NULL,
      code text NOT NULL, name text NOT NULL, is_active boolean NOT NULL
    );
    CREATE TABLE public.management_roles (
      id uuid PRIMARY KEY, tenant_id uuid, code text NOT NULL,
      is_active boolean NOT NULL, deleted_at timestamptz
    );
    CREATE TABLE public.employees (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL, hr_group_id uuid NOT NULL,
      auth_user_id uuid, deleted_at timestamptz, is_active boolean NOT NULL,
      is_archived boolean NOT NULL
    );
    CREATE TABLE public.employments (
      id uuid PRIMARY KEY, employee_id uuid NOT NULL, tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL, administration_id uuid NOT NULL,
      record_status text NOT NULL, starts_on date NOT NULL, ends_on date,
      deleted_at timestamptz
    );
    CREATE TABLE public.user_access (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      tenant_id uuid NOT NULL, hr_group_id uuid, management_role_id uuid NOT NULL,
      scope_type text NOT NULL, administration_id uuid, is_active boolean NOT NULL,
      CHECK ((scope_type = 'TENANT' AND hr_group_id IS NULL AND administration_id IS NULL)
        OR (scope_type = 'ADMINISTRATION' AND hr_group_id IS NOT NULL AND administration_id IS NOT NULL))
    );
    CREATE TABLE public.user_hr_group_access (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      tenant_id uuid NOT NULL, hr_group_id uuid NOT NULL,
      management_role_id uuid NOT NULL, is_active boolean NOT NULL,
      UNIQUE (user_id, tenant_id, hr_group_id, management_role_id)
    );
    CREATE FUNCTION internal_security.sync_test_group_access() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.scope_type = 'ADMINISTRATION' THEN
        INSERT INTO public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id, is_active)
        VALUES (NEW.user_id, NEW.tenant_id, NEW.hr_group_id, NEW.management_role_id, NEW.is_active);
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER user_access_test_sync AFTER INSERT ON public.user_access
    FOR EACH ROW EXECUTE FUNCTION internal_security.sync_test_group_access();
    CREATE TABLE public.audit_logs (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL,
      administration_id uuid, entity_name text NOT NULL, entity_id uuid NOT NULL,
      subject_employee_id uuid, employment_id uuid, actor_user_id uuid,
      action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL', 'EXPORT', 'START', 'STOP', 'READ')),
      changes jsonb NOT NULL, hr_group_id uuid,
      CHECK (action = 'READ' OR hr_group_id IS NULL)
    );
  `)
  await db.exec(migration)
  await db.query(
    `INSERT INTO auth.users (id, email, email_confirmed_at, is_anonymous) VALUES
      ($1, 'hradmin.fixture@liquidhr.test', now(), false),
      ($2, 'manager.fixture@liquidhr.test', now(), false),
      ($3, 'demo-002.payroll@liquidhr.test', now(), false)` ,
    [actorId, otherActorId, authUserId],
  )
  await db.query('INSERT INTO public.tenants (id, slug, is_active) VALUES ($1, $2, true)', [tenantId, 'liquid-hr-demo-holding'])
  await db.query('INSERT INTO public.hr_groups (id, tenant_id, name, is_active) VALUES ($1, $2, $3, true)', [hrGroupId, tenantId, 'Planeten'])
  await db.query('INSERT INTO public.administrations (id, tenant_id, hr_group_id, code, name, is_active) VALUES ($1, $2, $3, $4, $5, true)', [administrationId, tenantId, hrGroupId, 'HOLDING', 'Mars BV'])
  await db.query('INSERT INTO public.management_roles (id, tenant_id, code, is_active, deleted_at) VALUES ($1, NULL, $2, true, NULL)', ['33333333-3333-4333-8333-333333333331', 'EMPLOYEE'])
  await db.query('INSERT INTO public.management_roles (id, tenant_id, code, is_active, deleted_at) VALUES ($1, $2, $3, true, NULL)', ['33333333-3333-4333-8333-333333333332', tenantId, 'TENANT_ADMIN'])
  await db.query('INSERT INTO public.employees (id, tenant_id, hr_group_id, auth_user_id, is_active, is_archived) VALUES ($1, $2, $3, NULL, true, false)', [employeeId, tenantId, hrGroupId])
  await db.query('INSERT INTO public.employments (id, employee_id, tenant_id, hr_group_id, administration_id, record_status, starts_on) VALUES ($1, $2, $3, $4, $5, $6, current_date - 30)', [employmentId, employeeId, tenantId, hrGroupId, administrationId, 'CONFIRMED'])
  await db.query('INSERT INTO public.user_access (user_id, tenant_id, hr_group_id, management_role_id, scope_type, administration_id, is_active) VALUES ($1, $2, NULL, $3, $4, NULL, true)', [actorId, tenantId, '33333333-3333-4333-8333-333333333332', 'TENANT'])
  await db.exec('SET ROLE authenticated')
  return db
}

async function setActor(db: PGlite, userId: string, issuer = projectIssuer, canWrite = true) {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId])
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: userId, iss: issuer })])
  await db.query(`SELECT set_config('test.salary_write', $1, false)`, [String(canWrite)])
}

async function link(db: PGlite, targetUserId = authUserId, targetEmployeeId = employeeId, targetEmploymentId = employmentId) {
  return db.query<{ result: { status: string; changed: boolean } }>(
    'SELECT public.link_local_test_payroll_demo_002_v1($1, $2, $3) AS result',
    [targetEmployeeId, targetEmploymentId, targetUserId],
  )
}

describe('PAYFULL-02 Mars DEMO-002 employee persona link', () => {
  it('grants execute only to authenticated and requires verified Mars HR Admin authorization', async () => {
    const db = await createDatabase()
    try {
      const grants = await db.query<{ anon_execute: boolean; authenticated_execute: boolean; service_execute: boolean }>(`
        SELECT
          has_function_privilege('anon', 'public.link_local_test_payroll_demo_002_v1(uuid, uuid, uuid)', 'EXECUTE') AS anon_execute,
          has_function_privilege('authenticated', 'public.link_local_test_payroll_demo_002_v1(uuid, uuid, uuid)', 'EXECUTE') AS authenticated_execute,
          has_function_privilege('service_role', 'public.link_local_test_payroll_demo_002_v1(uuid, uuid, uuid)', 'EXECUTE') AS service_execute
      `)
      expect(grants.rows[0]).toEqual({ anon_execute: false, authenticated_execute: true, service_execute: false })

      await setActor(db, otherActorId)
      await expect(link(db)).rejects.toThrow('LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN')
      await setActor(db, actorId, 'https://other-project.supabase.co/auth/v1')
      await expect(link(db)).rejects.toThrow('LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN')
      await setActor(db, actorId, projectIssuer, false)
      await expect(link(db)).rejects.toThrow('LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN')
    } finally {
      await db.close()
    }
  })

  it('links only the exact active DEMO-002 employee and Mars employment, syncs access, and writes provenance once', async () => {
    const db = await createDatabase()
    try {
      await setActor(db, actorId)
      const first = await link(db)
      expect(first.rows[0]?.result).toEqual({ status: 'LINKED', changed: true })
      const repeated = await link(db)
      expect(repeated.rows[0]?.result).toEqual({ status: 'ALREADY_LINKED', changed: false })

      await db.exec('RESET ROLE')
      const readback = await db.query<{ auth_user_id: string; access_count: number; group_count: number; audit_count: number; provenance: string[] }>(`
        SELECT employee.auth_user_id,
          (SELECT count(*)::integer FROM public.user_access WHERE user_id = $1) AS access_count,
          (SELECT count(*)::integer FROM public.user_hr_group_access WHERE user_id = $1) AS group_count,
          (SELECT count(*)::integer FROM public.audit_logs WHERE subject_employee_id = $2) AS audit_count,
          (SELECT array_agg(changes->>'provenance' ORDER BY id) FROM public.audit_logs WHERE subject_employee_id = $2) AS provenance
        FROM public.employees employee WHERE employee.id = $2
      `, [authUserId, employeeId])
      expect(readback.rows[0]).toEqual({
        auth_user_id: authUserId,
        access_count: 1,
        group_count: 1,
        audit_count: 2,
        provenance: ['TEST_SETUP_PAYFULL_02', 'TEST_SETUP_PAYFULL_02'],
      })
    } finally {
      await db.close()
    }
  })

  it('rejects alternate employee, employment, and Auth identity values', async () => {
    const db = await createDatabase()
    try {
      await setActor(db, actorId)
      await expect(link(db, authUserId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN')
      await expect(link(db, authUserId, employeeId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('LOCAL_PAYFULL02_PERSONA_LINK_FORBIDDEN')
      await db.exec('RESET ROLE')
      await db.query(`UPDATE auth.users SET email = 'someone@example.com' WHERE id = $1`, [authUserId])
      await db.exec('SET ROLE authenticated')
      await setActor(db, actorId)
      await expect(link(db)).rejects.toThrow('LOCAL_PAYFULL02_PERSONA_AUTH_IDENTITY_INVALID')
    } finally {
      await db.close()
    }
  })

  it('rejects an Auth identity with an existing broader or conflicting access grant', async () => {
    const db = await createDatabase()
    try {
      await db.exec('RESET ROLE')
      await db.query(`INSERT INTO public.user_access (user_id, tenant_id, hr_group_id, management_role_id, scope_type, administration_id, is_active)
        VALUES ($1, $2, NULL, '33333333-3333-4333-8333-333333333331', 'TENANT', NULL, true)`, [authUserId, tenantId])
      await db.exec('SET ROLE authenticated')
      await setActor(db, actorId)
      await expect(link(db)).rejects.toThrow('LOCAL_PAYFULL02_PERSONA_ACCESS_CONFLICT')
    } finally {
      await db.close()
    }
  })
})
