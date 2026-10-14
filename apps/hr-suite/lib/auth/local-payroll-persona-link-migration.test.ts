import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261014155924_core_local_payroll_persona_link.sql', import.meta.url), 'utf8')

const actorId = '11111111-1111-4111-8111-111111111111'
const otherActorId = '11111111-1111-4111-8111-111111111112'
const authUserId = '22222222-2222-4222-8222-222222222222'
const employeeId = 'dd9bde02-76bb-4f7c-8add-db544a148f3f'
const employmentId = '29058c73-5cfa-409d-b9d4-80dd30f36962'
const tenantId = '07249eb9-545c-883b-b26d-d52f83b4f4a1'
const hrGroupId = '6ba6f1df-e376-40f2-abff-ffdf000172e1'
const administrationId = '8483abc9-f275-c80b-5a23-fedc54ce9f0a'
const projectIssuer = 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'

async function createDatabase() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
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
    CREATE TABLE public.employees (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      auth_user_id uuid,
      deleted_at timestamptz,
      is_active boolean NOT NULL
    );
    CREATE TABLE public.employments (
      id uuid PRIMARY KEY,
      employee_id uuid NOT NULL,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      administration_id uuid NOT NULL,
      record_status text NOT NULL,
      deleted_at timestamptz
    );
    CREATE TABLE public.administrations (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      hr_group_id uuid NOT NULL,
      code text NOT NULL,
      name text NOT NULL,
      is_active boolean NOT NULL
    );
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      hr_group_id uuid,
      administration_id uuid,
      entity_name text NOT NULL,
      entity_id uuid NOT NULL,
      subject_employee_id uuid,
      employment_id uuid,
      actor_user_id uuid,
      action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL')),
      changes jsonb NOT NULL
    );
  `)
  await db.exec(migration)
  await db.query(
    `INSERT INTO auth.users (id, email, email_confirmed_at, is_anonymous) VALUES
      ($1, 'hradmin.fixture@liquidhr.test', now(), false),
      ($2, 'manager.fixture@liquidhr.test', now(), false),
      ($3, 'jaap.test@liquidhr.test', now(), false)`,
    [actorId, otherActorId, authUserId],
  )
  await db.query(
    `INSERT INTO public.administrations (id, tenant_id, hr_group_id, code, name, is_active)
      VALUES ($1, $2, $3, 'OPERATIONS', 'Jupiter BV', true)`,
    [administrationId, tenantId, hrGroupId],
  )
  await db.query(
    `INSERT INTO public.employees (id, tenant_id, hr_group_id, auth_user_id, is_active)
      VALUES ($1, $2, $3, null, true)`,
    [employeeId, tenantId, hrGroupId],
  )
  await db.query(
    `INSERT INTO public.employments (id, employee_id, tenant_id, hr_group_id, administration_id, record_status)
      VALUES ($1, $2, $3, $4, $5, 'CONFIRMED')`,
    [employmentId, employeeId, tenantId, hrGroupId, administrationId],
  )
  await db.exec('SET ROLE authenticated')
  return db
}

async function setActor(db: PGlite, userId: string, issuer = projectIssuer) {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId])
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: userId, iss: issuer })])
}

describe('Local Payroll persona link migration', () => {
  it('limits execution to a verified local HR Admin identity and the canonical Core TEST issuer', async () => {
    const db = await createDatabase()
    try {
      const grants = await db.query<{ anon_execute: boolean; authenticated_execute: boolean; service_execute: boolean }>(`
        SELECT
          has_function_privilege('anon', 'public.link_local_test_payroll_persona_v1(text, uuid, uuid, uuid)', 'EXECUTE') AS anon_execute,
          has_function_privilege('authenticated', 'public.link_local_test_payroll_persona_v1(text, uuid, uuid, uuid)', 'EXECUTE') AS authenticated_execute,
          has_function_privilege('service_role', 'public.link_local_test_payroll_persona_v1(text, uuid, uuid, uuid)', 'EXECUTE') AS service_execute
      `)
      expect(grants.rows[0]).toEqual({ anon_execute: false, authenticated_execute: true, service_execute: false })

      await setActor(db, otherActorId)
      await expect(db.query(
        `SELECT public.link_local_test_payroll_persona_v1('payroll-jaap', $1, $2, $3)`,
        [employeeId, employmentId, authUserId],
      )).rejects.toThrow('LOCAL_PERSONA_LINK_FORBIDDEN')

      await setActor(db, actorId, 'https://unrelated.supabase.co/auth/v1')
      await expect(db.query(
        `SELECT public.link_local_test_payroll_persona_v1('payroll-jaap', $1, $2, $3)`,
        [employeeId, employmentId, authUserId],
      )).rejects.toThrow('LOCAL_PERSONA_LINK_FORBIDDEN')
    } finally {
      await db.close()
    }
  })

  it('links only the exact confirmed Jupiter employee and writes an immutable audit event once', async () => {
    const db = await createDatabase()
    try {
      await setActor(db, actorId)
      const linked = await db.query<{ result: { status: string; changed: boolean } }>(
        `SELECT public.link_local_test_payroll_persona_v1('payroll-jaap', $1, $2, $3) AS result`,
        [employeeId, employmentId, authUserId],
      )
      expect(linked.rows[0]?.result).toEqual({ status: 'LINKED', changed: true })

      const repeated = await db.query<{ result: { status: string; changed: boolean } }>(
        `SELECT public.link_local_test_payroll_persona_v1('payroll-jaap', $1, $2, $3) AS result`,
        [employeeId, employmentId, authUserId],
      )
      expect(repeated.rows[0]?.result).toEqual({ status: 'ALREADY_LINKED', changed: false })

      await db.exec('RESET ROLE')
      const readback = await db.query<{ auth_user_id: string; actor_user_id: string; changes: { event: string; personaKey: string }; audit_count: number }>(`
        SELECT employee.auth_user_id, audit.actor_user_id, audit.changes,
          (SELECT count(*)::integer FROM public.audit_logs) AS audit_count
        FROM public.employees AS employee
        JOIN public.audit_logs AS audit ON audit.entity_id = employee.id
        WHERE employee.id = $1
      `, [employeeId])
      expect(readback.rows[0]).toEqual({
        auth_user_id: authUserId,
        actor_user_id: actorId,
        changes: { event: 'LOCAL_PAYROLL_PERSONA_LINK_CREATED', personaKey: 'payroll-jaap', authUserId, changed: true },
        audit_count: 1,
      })
    } finally {
      await db.close()
    }
  })

  it('refuses any non-canonical persona, employee, or employment identifier', async () => {
    const db = await createDatabase()
    try {
      await setActor(db, actorId)
      await expect(db.query(
        `SELECT public.link_local_test_payroll_persona_v1('payroll-jaap', $1, $2, $3)`,
        ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', employmentId, authUserId],
      )).rejects.toThrow('LOCAL_PERSONA_LINK_FORBIDDEN')
      await expect(db.query(
        `SELECT public.link_local_test_payroll_persona_v1('payroll-lisa', $1, $2, $3)`,
        [employeeId, employmentId, authUserId],
      )).rejects.toThrow('LOCAL_PERSONA_LINK_FORBIDDEN')
    } finally {
      await db.close()
    }
  })

  it('keeps the write path separate from business roles and service-role access', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.link_local_test_payroll_persona_v1[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/i)
    expect(migration).toContain("actor.email_confirmed_at IS NOT NULL")
    expect(migration).toContain("v_issuer IS DISTINCT FROM 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'")
    expect(migration).toContain("'LOCAL_PAYROLL_PERSONA_LINK_CREATED'")
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.(user_access|user_management_roles|permissions)/i)
    expect(migration).not.toMatch(/GRANT\s+.*(?:HR_ADMIN|TENANT_ADMIN|salary:write)/i)
  })
})
