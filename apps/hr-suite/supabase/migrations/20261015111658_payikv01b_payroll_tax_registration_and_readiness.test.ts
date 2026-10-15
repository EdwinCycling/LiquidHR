import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

const priorMigration = readFileSync(new URL('./20261015100000_payikv01_income_relationship_readiness.sql', import.meta.url), 'utf8')
const migration = readFileSync(new URL('./20261015111658_payikv01b_payroll_tax_registration_and_readiness.sql', import.meta.url), 'utf8')

const tenantId = '10000000-0000-0000-0000-000000000001'
const hrGroupId = '20000000-0000-0000-0000-000000000001'
const administrationId = '30000000-0000-0000-0000-000000000001'
const actorId = '40000000-0000-0000-0000-000000000001'
const hrRoleId = '50000000-0000-0000-0000-000000000001'

const schema = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE SCHEMA internal_security;
CREATE FUNCTION internal_security.current_user_has_permission(uuid, uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('test.salary_write', true), '')::boolean, false)
$$;
CREATE FUNCTION internal_security.has_hr_group_access(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('test.hr_group_access', true), '')::boolean, false)
$$;
CREATE FUNCTION internal_security.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TABLE public.administrations (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, hr_group_id, id)
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
  hr_group_id uuid,
  administration_id uuid,
  scope_type text NOT NULL,
  management_role_id uuid NOT NULL,
  is_active boolean NOT NULL
);
CREATE TABLE public.employees (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  deleted_at timestamptz,
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE public.employee_secure_identifiers (
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  bsn_fingerprint text,
  PRIMARY KEY (tenant_id, employee_id)
);
CREATE TABLE public.employments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  record_status text NOT NULL,
  deleted_at timestamptz
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
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  payroll_tax_number text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT current_date,
  valid_until date,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, hr_group_id, administration_id, id),
  UNIQUE (tenant_id, administration_id, payroll_tax_number, valid_from),
  CHECK (payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE UNIQUE INDEX administration_payroll_tax_numbers_primary_active_key
  ON public.administration_payroll_tax_numbers (tenant_id, administration_id)
  WHERE is_primary AND valid_until IS NULL;
CREATE TABLE public.income_relationships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  payroll_tax_subnumber text NOT NULL,
  ikv_number integer NOT NULL,
  relationship_type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  reporting_status text NOT NULL,
  deleted_at timestamptz,
  payroll_tax_number text,
  payroll_tax_binding_hr_group_id uuid,
  payroll_tax_binding_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE UNIQUE INDEX income_relationships_full_lhnr_ikv_active_key
  ON public.income_relationships (tenant_id, administration_id, payroll_tax_number, ikv_number)
  WHERE deleted_at IS NULL AND payroll_tax_number IS NOT NULL;
CREATE UNIQUE INDEX income_relationships_ikv_employee_active_key
  ON public.income_relationships (tenant_id, employee_id, ikv_number)
  WHERE deleted_at IS NULL;
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
CREATE FUNCTION internal_security.audit_hr_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_new jsonb;
  v_old jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_old := '{}'::jsonb;
  ELSE
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
  END IF;
  INSERT INTO public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  VALUES (
    NEW.tenant_id, TG_ARGV[0], NEW.id, auth.uid(),
    TG_OP, jsonb_build_object('before', v_old, 'after', v_new)
  );
  RETURN NEW;
END;
$$;
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_access_select_own ON public.user_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active);
ALTER TABLE public.management_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY management_roles_select_test ON public.management_roles FOR SELECT TO authenticated
  USING (true);
ALTER TABLE public.administration_payroll_tax_numbers ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, internal_security TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.user_access, public.management_roles, public.administrations,
  public.employees, public.employee_secure_identifiers, public.employments,
  public.employment_contracts, public.employment_income_relationships, public.audit_logs TO authenticated;
GRANT UPDATE ON public.employment_income_relationships TO authenticated;
GRANT INSERT ON public.employees, public.employee_secure_identifiers, public.employments,
  public.employment_contracts, public.employment_income_relationships, public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.administration_payroll_tax_numbers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.income_relationships TO authenticated;
`

async function createScopedHrAdmin(db: PGlite, userId = actorId): Promise<void> {
  await db.exec(`
    INSERT INTO public.management_roles (id, tenant_id, code, is_active)
    VALUES ('${hrRoleId}', '${tenantId}', 'HR_ADMIN', true);
    INSERT INTO public.user_access (id, user_id, tenant_id, hr_group_id, administration_id, scope_type, management_role_id, is_active)
    VALUES ('60000000-0000-0000-0000-000000000001', '${userId}', '${tenantId}', '${hrGroupId}', '${administrationId}', 'ADMINISTRATION', '${hrRoleId}', true);
  `)
  await db.query(
    `SELECT set_config('request.jwt.claim.sub', $1, false),
            set_config('test.hr_group_access', 'true', false),
            set_config('test.salary_write', 'true', false)`,
    [userId],
  )
  await db.exec('SET ROLE authenticated')
}

async function createTaxRegistration(db: PGlite, validFrom = '2018-01-01'): Promise<string> {
  const result = await db.query<{ id: string }>(
    `SELECT public.register_administration_payroll_tax_number(
       $1, '364133788L92', $2::date, NULL::date, true
     )::text AS id`,
    [administrationId, validFrom],
  )
  const id = result.rows[0]?.id
  if (!id) throw new Error('Expected a payroll tax registration id')
  return id
}

describe('PAYIKV-01B migration behavior', () => {
  let db: PGlite

  beforeEach(async () => {
    db = new PGlite()
    await db.exec(schema)
    await db.exec(`
      INSERT INTO public.administrations (id, tenant_id, hr_group_id)
      VALUES ('${administrationId}', '${tenantId}', '${hrGroupId}');
      INSERT INTO public.employees (id, tenant_id, hr_group_id)
      VALUES ('70000000-0000-0000-0000-000000000001', '${tenantId}', '${hrGroupId}'),
             ('70000000-0000-0000-0000-000000000002', '${tenantId}', '${hrGroupId}');
      INSERT INTO public.income_relationships (
        id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, reporting_status
      ) VALUES
        ('80000000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '70000000-0000-0000-0000-000000000001', '0001', 1, 'EMPLOYMENT', DATE '2018-01-01', 'READY'),
        ('80000000-0000-0000-0000-000000000002', '${tenantId}', '${administrationId}', '70000000-0000-0000-0000-000000000002', '0002', 1, 'EMPLOYMENT', DATE '2018-01-01', 'CLOSED');
    `)
    await db.exec(priorMigration)
    await db.exec(migration)
  })

  it('leaves historical READY and CLOSED records unchanged while replacing the employee-global key', async () => {
    const rows = await db.query<{ id: string; payroll_tax_subnumber: string; reporting_status: string }>(
      `SELECT id::text, payroll_tax_subnumber, reporting_status FROM public.income_relationships ORDER BY id`,
    )
    expect(rows.rows.map((row) => [row.payroll_tax_subnumber, row.reporting_status])).toEqual([
      ['0001', 'READY'], ['0002', 'CLOSED'],
    ])
    const indexes = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'income_relationships' ORDER BY indexname`,
    )
    expect(indexes.rows.map((row) => row.indexname)).toContain('income_relationships_employer_employee_ikv_active_key')
    expect(indexes.rows.map((row) => row.indexname)).not.toContain('income_relationships_full_lhnr_ikv_active_key')
  })

  it('registers dated numbers idempotently and closes the former primary into audited history', async () => {
    await createScopedHrAdmin(db)
    const originalId = await createTaxRegistration(db)
    const repeatedId = await createTaxRegistration(db)
    expect(repeatedId).toBe(originalId)

    const nextResult = await db.query<{ id: string }>(
      `SELECT public.register_administration_payroll_tax_number(
         $1, '590294532L10', DATE '2026-01-01', NULL::date, true
       )::text AS id`, [administrationId],
    )
    const nextId = nextResult.rows[0]?.id
    expect(nextId).toBeTruthy()
    const rows = await db.query<{ payroll_tax_number: string; valid_from: string; valid_until: string | null; is_primary: boolean }>(
      `SELECT payroll_tax_number, valid_from::text, valid_until::text, is_primary
       FROM public.administration_payroll_tax_numbers ORDER BY valid_from`,
    )
    expect(rows.rows).toEqual([
      { payroll_tax_number: '364133788L92', valid_from: '2018-01-01', valid_until: '2025-12-31', is_primary: true },
      { payroll_tax_number: '590294532L10', valid_from: '2026-01-01', valid_until: null, is_primary: true },
    ])
    const audit = await db.query<{ entity_name: string; action: string }>(
      `SELECT entity_name, action FROM public.audit_logs ORDER BY id`,
    )
    expect(audit.rows).toEqual([
      { entity_name: 'administration_payroll_tax_number', action: 'INSERT' },
      { entity_name: 'administration_payroll_tax_number', action: 'UPDATE' },
      { entity_name: 'administration_payroll_tax_number', action: 'INSERT' },
    ])
    await db.query(
      `SELECT public.register_administration_payroll_tax_number(
         $1, '590294532L10', DATE '2026-01-01', NULL::date, true
       )`, [administrationId],
    )
    const auditAfterReplay = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM public.audit_logs')
    expect(auditAfterReplay.rows[0]?.count).toBe(3)
  })

  it('allows different employees to each have IKV 1 for the same employer', async () => {
    await createScopedHrAdmin(db)
    const taxId = await createTaxRegistration(db)
    await db.exec(`
      INSERT INTO public.income_relationships (
        id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, reporting_status,
        payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id
      ) VALUES
        ('81000000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '70000000-0000-0000-0000-000000000001', 'L92', 1, 'EMPLOYMENT', DATE '2018-01-01', 'DRAFT', '364133788L92', '${hrGroupId}', '${taxId}'),
        ('81000000-0000-0000-0000-000000000002', '${tenantId}', '${administrationId}', '70000000-0000-0000-0000-000000000002', 'L92', 1, 'EMPLOYMENT', DATE '2018-01-01', 'DRAFT', '364133788L92', '${hrGroupId}', '${taxId}');
    `)
    await expect(db.exec(`
      INSERT INTO public.income_relationships (
        id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, reporting_status,
        payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id
      ) VALUES (
        '81000000-0000-0000-0000-000000000003', '${tenantId}', '${administrationId}',
        '70000000-0000-0000-0000-000000000001', 'L92', 1, 'EMPLOYMENT', DATE '2018-01-01',
        'DRAFT', '364133788L92', '${hrGroupId}', '${taxId}'
      )
    `)).rejects.toThrow('income_relationships_employer_employee_ikv_active_key')
  })

  it('requires a verified secure BSN before a DRAFT IKV can become READY', async () => {
    await createScopedHrAdmin(db)
    await db.exec(`
      INSERT INTO public.income_relationships (
        id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, reporting_status
      ) VALUES (
        '82000000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}',
        '70000000-0000-0000-0000-000000000001', 'L92', 2, 'EMPLOYMENT', DATE '2018-01-01', 'DRAFT'
      )
    `)
    await expect(db.exec(`UPDATE public.income_relationships
      SET reporting_status = 'READY'
      WHERE id = '82000000-0000-0000-0000-000000000001'`)).rejects.toThrow('PAYROLL_IKV_BSN_REQUIRED')
  })

  it('validates the complete long-running IKV and rechecks essential binding edits on READY rows', async () => {
    await createScopedHrAdmin(db)
    const taxId = await createTaxRegistration(db)
    const employeeId = '83000000-0000-0000-0000-000000000001'
    const employmentId = '84000000-0000-0000-0000-000000000001'
    const relationshipId = '85000000-0000-0000-0000-000000000001'
    await db.exec(`
      INSERT INTO public.employees (id, tenant_id, hr_group_id)
      VALUES ('${employeeId}', '${tenantId}', '${hrGroupId}');
      INSERT INTO public.employee_secure_identifiers (tenant_id, employee_id, bsn_fingerprint)
      VALUES ('${tenantId}', '${employeeId}', repeat('a', 64));
      INSERT INTO public.employments (id, tenant_id, administration_id, employee_id, starts_on, record_status)
      VALUES ('${employmentId}', '${tenantId}', '${administrationId}', '${employeeId}', DATE '2018-01-01', 'CONFIRMED');
      INSERT INTO public.employment_contracts (id, tenant_id, administration_id, employee_id, employment_id, starts_on)
      VALUES ('86000000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', DATE '2018-01-01');
      INSERT INTO public.employment_income_relationships (id, tenant_id, administration_id, employee_id, employment_id, income_relationship_id, valid_from)
      VALUES ('87000000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', '${relationshipId}', DATE '2018-01-01');
      INSERT INTO public.income_relationships (
        id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, reporting_status,
        payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id
      ) VALUES (
        '${relationshipId}', '${tenantId}', '${administrationId}', '${employeeId}', 'L92', 1,
        'EMPLOYMENT', DATE '2018-01-01', 'DRAFT', '364133788L92', '${hrGroupId}', '${taxId}'
      );
      UPDATE public.income_relationships SET reporting_status = 'READY' WHERE id = '${relationshipId}';
    `)
    const result = await db.query<{ reporting_status: string; ikv_number: number; payroll_tax_subnumber: string }>(
      `SELECT reporting_status, ikv_number, payroll_tax_subnumber FROM public.income_relationships WHERE id = $1`, [relationshipId],
    )
    expect(result.rows[0]).toEqual({ reporting_status: 'READY', ikv_number: 1, payroll_tax_subnumber: 'L92' })

    await expect(db.query(
      `SELECT public.register_administration_payroll_tax_number(
         $1, '590294532L10', DATE '2026-01-01', NULL::date, true
       )`, [administrationId],
    )).rejects.toThrow('PAYROLL_TAX_NUMBER_BOUND_IKV_PERIOD_CONFLICT')

    await expect(db.exec(`UPDATE public.income_relationships SET payroll_tax_subnumber = 'L10' WHERE id = '${relationshipId}'`))
      .rejects.toThrow('PAYROLL_IKV_EMPLOYER_TAX_NUMBER_REQUIRED')
  })

  it('preserves a closed IKV binding when an employer number changes for a later period', async () => {
    await createScopedHrAdmin(db)
    const originalTaxId = await createTaxRegistration(db)
    const employeeId = '83100000-0000-0000-0000-000000000001'
    const employmentId = '84100000-0000-0000-0000-000000000001'
    const oldRelationshipId = '85100000-0000-0000-0000-000000000001'
    await db.exec(`
      INSERT INTO public.employees (id, tenant_id, hr_group_id)
      VALUES ('${employeeId}', '${tenantId}', '${hrGroupId}');
      INSERT INTO public.employee_secure_identifiers (tenant_id, employee_id, bsn_fingerprint)
      VALUES ('${tenantId}', '${employeeId}', repeat('b', 64));
      INSERT INTO public.employments (id, tenant_id, administration_id, employee_id, starts_on, record_status)
      VALUES ('${employmentId}', '${tenantId}', '${administrationId}', '${employeeId}', DATE '2018-01-01', 'CONFIRMED');
      INSERT INTO public.employment_contracts (id, tenant_id, administration_id, employee_id, employment_id, starts_on)
      VALUES ('86100000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', DATE '2018-01-01');
      INSERT INTO public.employment_income_relationships (id, tenant_id, administration_id, employee_id, employment_id, income_relationship_id, valid_from)
      VALUES ('87100000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', '${oldRelationshipId}', DATE '2018-01-01');
      INSERT INTO public.income_relationships (
        id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, reporting_status,
        payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id
      ) VALUES (
        '${oldRelationshipId}', '${tenantId}', '${administrationId}', '${employeeId}', 'L92', 1,
        'EMPLOYMENT', DATE '2018-01-01', 'DRAFT', '364133788L92', '${hrGroupId}', '${originalTaxId}'
      );
      UPDATE public.income_relationships SET reporting_status = 'READY' WHERE id = '${oldRelationshipId}';
      UPDATE public.income_relationships
        SET reporting_status = 'CLOSED', ends_on = DATE '2025-12-31'
      WHERE id = '${oldRelationshipId}';
      UPDATE public.employment_income_relationships
        SET valid_until = DATE '2026-01-01'
      WHERE income_relationship_id = '${oldRelationshipId}';
    `)

    const newTax = await db.query<{ id: string }>(
      `SELECT public.register_administration_payroll_tax_number(
         $1, '590294532L10', DATE '2026-01-01', NULL::date, true
       )::text AS id`, [administrationId],
    )
    const nextRelationshipId = '85200000-0000-0000-0000-000000000001'
    await db.exec(`
      INSERT INTO public.employment_income_relationships (id, tenant_id, administration_id, employee_id, employment_id, income_relationship_id, valid_from)
      VALUES ('87200000-0000-0000-0000-000000000001', '${tenantId}', '${administrationId}', '${employeeId}', '${employmentId}', '${nextRelationshipId}', DATE '2026-01-01');
      INSERT INTO public.income_relationships (
        id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, reporting_status,
        payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id
      ) VALUES (
        '${nextRelationshipId}', '${tenantId}', '${administrationId}', '${employeeId}', 'L10', 1,
        'EMPLOYMENT', DATE '2026-01-01', 'DRAFT', '590294532L10', '${hrGroupId}', '${newTax.rows[0]?.id}'
      );
      UPDATE public.income_relationships SET reporting_status = 'READY' WHERE id = '${nextRelationshipId}';
    `)

    const rows = await db.query<{ id: string; payroll_tax_number: string; ikv_number: number; reporting_status: string; starts_on: string; ends_on: string | null }>(
      `SELECT id::text, payroll_tax_number, ikv_number, reporting_status, starts_on::text, ends_on::text
       FROM public.income_relationships WHERE employee_id = $1 ORDER BY starts_on`, [employeeId],
    )
    expect(rows.rows).toEqual([
      { id: oldRelationshipId, payroll_tax_number: '364133788L92', ikv_number: 1, reporting_status: 'CLOSED', starts_on: '2018-01-01', ends_on: '2025-12-31' },
      { id: nextRelationshipId, payroll_tax_number: '590294532L10', ikv_number: 1, reporting_status: 'READY', starts_on: '2026-01-01', ends_on: null },
    ])
  })

  it('rejects a registration attempt from an in-scope user without an HR administrator role', async () => {
    const managerId = '88000000-0000-0000-0000-000000000001'
    await db.exec(`
      INSERT INTO public.management_roles (id, tenant_id, code, is_active)
      VALUES ('89000000-0000-0000-0000-000000000001', '${tenantId}', 'MANAGER', true);
      INSERT INTO public.user_access (id, user_id, tenant_id, hr_group_id, administration_id, scope_type, management_role_id, is_active)
      VALUES ('90000000-0000-0000-0000-000000000001', '${managerId}', '${tenantId}', '${hrGroupId}', '${administrationId}', 'ADMINISTRATION', '89000000-0000-0000-0000-000000000001', true);
    `)
    await db.query(
      `SELECT set_config('request.jwt.claim.sub', $1, false),
              set_config('test.hr_group_access', 'true', false),
              set_config('test.salary_write', 'true', false)`, [managerId],
    )
    await db.exec('SET ROLE authenticated')
    await expect(db.query(
      `SELECT public.register_administration_payroll_tax_number($1, '364133788L92', DATE '2018-01-01', NULL::date, true)`,
      [administrationId],
    )).rejects.toThrow('PAYROLL_TAX_NUMBER_FORBIDDEN')
  })

  it('denies managers direct read and write access to employer registrations', async () => {
    await createScopedHrAdmin(db)
    await createTaxRegistration(db)
    await db.exec('RESET ROLE')

    const managerId = '93000000-0000-0000-0000-000000000001'
    await db.exec(`
      INSERT INTO public.management_roles (id, tenant_id, code, is_active)
      VALUES ('94000000-0000-0000-0000-000000000001', '${tenantId}', 'MANAGER', true);
      INSERT INTO public.user_access (id, user_id, tenant_id, hr_group_id, administration_id, scope_type, management_role_id, is_active)
      VALUES ('95000000-0000-0000-0000-000000000001', '${managerId}', '${tenantId}', '${hrGroupId}', '${administrationId}', 'ADMINISTRATION', '94000000-0000-0000-0000-000000000001', true);
    `)
    await db.query(
      `SELECT set_config('request.jwt.claim.sub', $1, false),
              set_config('test.hr_group_access', 'true', false),
              set_config('test.salary_write', 'true', false),
              set_config('test.salary_read', 'true', false)`, [managerId],
    )
    await db.exec('SET ROLE authenticated')

    const visible = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM public.administration_payroll_tax_numbers`,
    )
    expect(visible.rows[0]?.count).toBe(0)
    await expect(db.query(`
      INSERT INTO public.administration_payroll_tax_numbers (
        tenant_id, hr_group_id, administration_id, payroll_tax_number,
        is_primary, valid_from, created_by_user_id
      ) VALUES (
        '${tenantId}', '${hrGroupId}', '${administrationId}', '590294532L10',
        false, DATE '2026-01-01', '${managerId}'
      )
    `)).rejects.toThrow()
  })

  it('denies an HR administrator access to registrations in another administration', async () => {
    await createScopedHrAdmin(db)
    await createTaxRegistration(db)
    await db.exec('RESET ROLE')

    const otherHrGroupId = '97000000-0000-0000-0000-000000000001'
    const otherAdministrationId = '98000000-0000-0000-0000-000000000001'
    const otherUserId = '99000000-0000-0000-0000-000000000001'
    const otherRoleId = '91000000-0000-0000-0000-000000000001'
    await db.exec(`
      INSERT INTO public.administrations (id, tenant_id, hr_group_id)
      VALUES ('${otherAdministrationId}', '${tenantId}', '${otherHrGroupId}');
      INSERT INTO public.management_roles (id, tenant_id, code, is_active)
      VALUES ('${otherRoleId}', '${tenantId}', 'HR_ADMIN', true);
      INSERT INTO public.user_access (id, user_id, tenant_id, hr_group_id, administration_id, scope_type, management_role_id, is_active)
      VALUES ('92000000-0000-0000-0000-000000000001', '${otherUserId}', '${tenantId}', '${otherHrGroupId}', '${otherAdministrationId}', 'ADMINISTRATION', '${otherRoleId}', true);
    `)
    await db.query(
      `SELECT set_config('request.jwt.claim.sub', $1, false),
              set_config('test.hr_group_access', 'true', false),
              set_config('test.salary_write', 'true', false),
              set_config('test.salary_read', 'true', false)`, [otherUserId],
    )
    await db.exec('SET ROLE authenticated')

    const visible = await db.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM public.administration_payroll_tax_numbers`,
    )
    expect(visible.rows[0]?.count).toBe(0)
  })

  it('rejects a HR administrator trying to register a number outside their administration scope', async () => {
    const otherAdministrationId = '91000000-0000-0000-0000-000000000001'
    await db.exec(`INSERT INTO public.administrations (id, tenant_id, hr_group_id)
      VALUES ('${otherAdministrationId}', '${tenantId}', '92000000-0000-0000-0000-000000000001')`)
    await createScopedHrAdmin(db)
    await expect(db.query(
      `SELECT public.register_administration_payroll_tax_number($1, '364133788L92', DATE '2018-01-01', NULL::date, true)`,
      [otherAdministrationId],
    )).rejects.toThrow('PAYROLL_TAX_NUMBER_FORBIDDEN')
  })
})
