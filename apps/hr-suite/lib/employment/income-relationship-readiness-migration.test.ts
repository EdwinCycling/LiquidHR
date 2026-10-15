import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261015123709_payikv01_income_relationship_readiness.sql', import.meta.url), 'utf8')

const tenantId = '10000000-0000-0000-0000-000000000001'
const hrGroupId = '20000000-0000-0000-0000-000000000001'
const administrationId = '30000000-0000-0000-0000-000000000001'
const employeeId = '40000000-0000-0000-0000-000000000001'
const employmentId = '50000000-0000-0000-0000-000000000001'
const incomeRelationshipId = '60000000-0000-0000-0000-000000000001'
const taxNumberId = '70000000-0000-0000-0000-000000000001'
const actorId = '80000000-0000-0000-0000-000000000001'
const roleId = '90000000-0000-0000-0000-000000000001'

const schema = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE SCHEMA internal_security;
CREATE FUNCTION internal_security.has_hr_group_access(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('test.hr_group_access', true), '')::boolean, false)
$$;
CREATE FUNCTION internal_security.current_user_has_permission(uuid, uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('test.salary_write', true), '')::boolean, false)
$$;
CREATE TABLE public.administrations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, hr_group_id, id)
);
CREATE TABLE public.employees (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  employee_number text,
  deleted_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, hr_group_id, id)
);
CREATE TABLE public.employments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  employment_number text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  record_status text NOT NULL,
  deleted_at timestamptz,
  PRIMARY KEY (id)
);
CREATE TABLE public.employment_contracts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  employment_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date
);
CREATE TABLE public.administration_payroll_tax_numbers (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  payroll_tax_number text NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, hr_group_id, administration_id, id)
);
CREATE TYPE public.income_relationship_type AS ENUM ('EMPLOYMENT');
CREATE TYPE public.payroll_reporting_status AS ENUM ('DRAFT', 'READY', 'REPORTED', 'CLOSED');
CREATE TABLE public.income_relationships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  payroll_tax_subnumber text NOT NULL,
  ikv_number integer NOT NULL,
  relationship_type public.income_relationship_type NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  reporting_status public.payroll_reporting_status NOT NULL,
  deleted_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, administration_id, employee_id, id)
);
CREATE TABLE public.employment_income_relationships (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  employment_id uuid NOT NULL,
  income_relationship_id uuid NOT NULL,
  valid_from date NOT NULL,
  valid_until date
);
CREATE TABLE public.employee_secure_identifiers (
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  bsn_fingerprint text
);
CREATE TABLE public.management_roles (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  code text NOT NULL,
  is_active boolean NOT NULL,
  deleted_at timestamptz
);
CREATE TABLE public.user_access (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  scope_type text NOT NULL,
  administration_id uuid,
  management_role_id uuid NOT NULL,
  is_active boolean NOT NULL
);
CREATE TABLE public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  entity_name text NOT NULL,
  entity_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION internal_security.audit_hr_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  VALUES (
    NEW.tenant_id,
    TG_ARGV[0],
    NEW.id,
    auth.uid(),
    'UPDATE',
    jsonb_build_object('before', jsonb_build_object('reporting_status', OLD.reporting_status),
                       'after', jsonb_build_object('reporting_status', NEW.reporting_status))
  );
  RETURN NEW;
END;
$$;
`

describe('PAYIKV-01 readiness migration', () => {
  let db: PGlite

  beforeEach(async () => {
    db = new PGlite()
    await db.exec(schema)
    await db.exec(migration)
    await db.exec(`
      INSERT INTO public.administrations (id, tenant_id, hr_group_id)
      VALUES ('${administrationId}', '${tenantId}', '${hrGroupId}');
      INSERT INTO public.employees (id, tenant_id, hr_group_id, employee_number)
      VALUES ('${employeeId}', '${tenantId}', '${hrGroupId}', 'E-001');
      INSERT INTO public.employments (id, tenant_id, hr_group_id, administration_id, employee_id, employment_number, starts_on, ends_on, record_status)
      VALUES ('${employmentId}', '${tenantId}', '${hrGroupId}', '${administrationId}', '${employeeId}', '1', DATE '2026-01-01', DATE '2026-12-31', 'CONFIRMED');
      INSERT INTO public.administration_payroll_tax_numbers (id, tenant_id, hr_group_id, administration_id, payroll_tax_number, valid_from)
      VALUES ('${taxNumberId}', '${tenantId}', '${hrGroupId}', '${administrationId}', '123456789L01', DATE '2026-01-01');
      INSERT INTO public.income_relationships (id, tenant_id, administration_id, employee_id, payroll_tax_subnumber, ikv_number, relationship_type, starts_on, ends_on, reporting_status)
      VALUES ('${incomeRelationshipId}', '${tenantId}', '${administrationId}', '${employeeId}', 'L01', 1, 'EMPLOYMENT', DATE '2026-01-01', DATE '2026-12-31', 'DRAFT');
      INSERT INTO public.employment_income_relationships (id, tenant_id, administration_id, employee_id, employment_id, income_relationship_id, valid_from, valid_until)
      VALUES ('a0000000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', '${incomeRelationshipId}', DATE '2026-01-01', DATE '2027-01-01');
      INSERT INTO public.employment_contracts (id, tenant_id, administration_id, employee_id, employment_id, starts_on, ends_on)
      VALUES ('b0000000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', DATE '2026-01-01', DATE '2026-06-30'),
             ('b0000000-0000-0000-0000-000000000002', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', DATE '2026-07-01', DATE '2026-12-31');
      INSERT INTO public.management_roles (id, tenant_id, code, is_active)
      VALUES ('${roleId}', '${tenantId}', 'TENANT_ADMIN', true);
      INSERT INTO public.user_access (id, user_id, tenant_id, scope_type, administration_id, management_role_id, is_active)
      VALUES ('c0000000-0000-0000-0000-000000000001', '${actorId}', '${tenantId}', 'ADMINISTRATION', '${administrationId}', '${roleId}', true);
    `)
  })

  it('allows a scoped HR administrator to mark the existing IKV ready and records audit history', async () => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false),
                           set_config('test.hr_group_access', 'true', false),
                           set_config('test.salary_write', 'true', false)`, [actorId])
    await db.query(
      `UPDATE public.income_relationships
       SET reporting_status = 'READY', payroll_tax_number = '123456789L01',
           payroll_tax_binding_hr_group_id = $1, payroll_tax_binding_id = $2
       WHERE id = $3`,
      [hrGroupId, taxNumberId, incomeRelationshipId],
    )
    const status = await db.query<{ reporting_status: string }>(
      `SELECT reporting_status::text FROM public.income_relationships WHERE id = $1`, [incomeRelationshipId],
    )
    const audit = await db.query<{ entity_name: string; old_status: string; new_status: string }>(
      `SELECT entity_name, changes #>> '{before,reporting_status}' AS old_status,
              changes #>> '{after,reporting_status}' AS new_status FROM public.audit_logs`,
    )
    expect(status.rows[0]?.reporting_status).toBe('READY')
    expect(audit.rows).toEqual([{ entity_name: 'income_relationship', old_status: 'DRAFT', new_status: 'READY' }])
  })

  it('rejects an actor without the existing scoped administrator role', async () => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false),
                           set_config('test.hr_group_access', 'true', false),
                           set_config('test.salary_write', 'true', false)`, ['a0000000-0000-0000-0000-000000000099'])
    await expect(db.query(
      `UPDATE public.income_relationships
       SET reporting_status = 'READY', payroll_tax_number = '123456789L01',
           payroll_tax_binding_hr_group_id = $1, payroll_tax_binding_id = $2
       WHERE id = $3`,
      [hrGroupId, taxNumberId, incomeRelationshipId],
    )).rejects.toThrow('PAYROLL_IKV_READY_FORBIDDEN')
    const status = await db.query<{ reporting_status: string }>(
      `SELECT reporting_status::text FROM public.income_relationships WHERE id = $1`, [incomeRelationshipId],
    )
    expect(status.rows[0]?.reporting_status).toBe('DRAFT')
  })

  it('rejects a gap between consecutive contract periods', async () => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false),
                           set_config('test.hr_group_access', 'true', false),
                           set_config('test.salary_write', 'true', false)`, [actorId])
    await db.query(`UPDATE public.employment_contracts SET ends_on = DATE '2026-06-29'
                    WHERE id = 'b0000000-0000-0000-0000-000000000001'`)
    await expect(db.query(
      `UPDATE public.income_relationships
       SET reporting_status = 'READY', payroll_tax_number = '123456789L01',
           payroll_tax_binding_hr_group_id = $1, payroll_tax_binding_id = $2
       WHERE id = $3`,
      [hrGroupId, taxNumberId, incomeRelationshipId],
    )).rejects.toThrow('PAYROLL_IKV_EMPLOYMENT_SOURCE_INVALID')
  })
})
