import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const coreMigration = readFileSync(new URL('../../supabase/migrations/20261014091918_20261013150000_core_employment_payroll_tax_profiles.sql', import.meta.url), 'utf8')
const payrollMigration = readFileSync(new URL('./supabase/migrations/20261014091926_20261013120000_paycalc_real01_generic_input_reference.sql', import.meta.url), 'utf8')

// These are business-data-free subsets of the actual Core TEST and Payroll Lab TEST
// catalogs read on 2026-10-13. Composite keys and columns used by the two migrations
// match the remote catalog; platform auth helpers are present only as SQL signatures.
const coreCatalogSchema = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE SCHEMA internal_security;
CREATE FUNCTION internal_security.has_hr_group_access(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION internal_security.current_user_has_permission(uuid, uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.employees (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, hr_group_id, id)
);
CREATE TABLE public.employments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  record_status text NOT NULL,
  deleted_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (tenant_id, administration_id, employee_id, id)
);
CREATE TABLE public.income_relationships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  relationship_type text NOT NULL,
  reporting_status text NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
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
  valid_until date,
  updated_at timestamptz NOT NULL DEFAULT now()
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
`

const payrollCatalogSchema = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.payroll_administrations (
  id uuid PRIMARY KEY,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  UNIQUE (id, source_tenant_id, source_hr_group_id, source_administration_id)
);
CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  period_year smallint NOT NULL,
  period_month smallint NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  UNIQUE (id, source_tenant_id, source_hr_group_id, source_administration_id)
);
CREATE TABLE public.source_snapshots (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  source_employee_id uuid NOT NULL,
  source_employment_id uuid NOT NULL,
  source_income_relationship_id uuid NOT NULL,
  source_version_vector jsonb NOT NULL,
  source_hash text NOT NULL,
  UNIQUE (id, source_tenant_id, source_hr_group_id, source_administration_id)
);
CREATE TABLE public.calculation_input_sets (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  source_snapshot_id uuid NOT NULL,
  payroll_period_id uuid NOT NULL,
  input_hash text NOT NULL,
  UNIQUE (id, source_tenant_id, source_hr_group_id, source_administration_id)
);
CREATE TABLE public.calculation_runs (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  calculation_input_set_id uuid NOT NULL,
  run_type text NOT NULL,
  status text NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  result_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  UNIQUE (id, source_tenant_id, source_hr_group_id, source_administration_id)
);
CREATE TABLE public.individual_payroll_input_references (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  calculation_input_set_id uuid NOT NULL,
  source_employment_id uuid NOT NULL
);
CREATE TABLE public.individual_payroll_lifecycle_events (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  payroll_period_id uuid NOT NULL,
  source_employment_id uuid NOT NULL,
  calculation_run_id uuid NOT NULL,
  revision integer NOT NULL,
  event_sequence smallint NOT NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payroll_controls (
  id uuid PRIMARY KEY,
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  calculation_run_id uuid NOT NULL,
  status text NOT NULL
);
`

describe('Payroll migrations against the separate database schemas', () => {
  it('applies the Core fiscal migration to the Core source schema and keeps its security contract', async () => {
    const db = new PGlite()
    try {
      await db.exec(coreCatalogSchema)
      await db.exec(coreMigration)

      const securedTables = await db.query<{ relname: string; relrowsecurity: boolean }>(
        `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace
          AND relname IN ('employment_payroll_tax_profiles', 'employment_payroll_tax_profile_audit') ORDER BY relname`,
      )
      expect(securedTables.rows).toHaveLength(2)
      expect(securedTables.rows.every((row) => row.relrowsecurity)).toBe(true)

      const coreGuards = await db.query<{ policy_count: number; immutable_trigger_count: number; foreign_key_count: number }>(
        `SELECT
          (SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'public'
            AND tablename IN ('employment_payroll_tax_profiles', 'employment_payroll_tax_profile_audit')) AS policy_count,
          (SELECT count(*)::integer FROM pg_trigger WHERE tgrelid IN (
            'public.employment_payroll_tax_profiles'::regclass, 'public.employment_payroll_tax_profile_audit'::regclass
          ) AND NOT tgisinternal) AS immutable_trigger_count,
          (SELECT count(*)::integer FROM pg_constraint WHERE conrelid = 'public.employment_payroll_tax_profiles'::regclass
            AND conname IN ('employment_payroll_tax_profiles_employment_scope_fkey',
              'employment_payroll_tax_profiles_income_scope_fkey', 'employment_payroll_tax_profiles_income_link_fkey')) AS foreign_key_count`,
      )
      expect(coreGuards.rows[0]).toEqual({ policy_count: 2, immutable_trigger_count: 2, foreign_key_count: 3 })

      const functionPolicy = await db.query<{ prosecdef: boolean; config: string | null }>(
        `SELECT prosecdef, array_to_string(proconfig, ',') AS config FROM pg_proc
          WHERE oid = 'public.confirm_employment_payroll_tax_profile(jsonb)'::regprocedure`,
      )
      expect(functionPolicy.rows[0]).toMatchObject({ prosecdef: true, config: 'search_path=""' })

      const grants = await db.query<{ authenticated_execute: boolean; anon_execute: boolean }>(
        `SELECT has_function_privilege('authenticated', 'public.confirm_employment_payroll_tax_profile(jsonb)', 'EXECUTE') AS authenticated_execute,
          has_function_privilege('anon', 'public.confirm_employment_payroll_tax_profile(jsonb)', 'EXECUTE') AS anon_execute`,
      )
      expect(grants.rows[0]).toEqual({ authenticated_execute: true, anon_execute: false })

      const insertGrants = await db.query<{ authenticated_insert: boolean; service_role_insert: boolean }>(
        `SELECT has_table_privilege('authenticated', 'public.employment_payroll_tax_profiles', 'INSERT') AS authenticated_insert,
          has_table_privilege('service_role', 'public.employment_payroll_tax_profiles', 'INSERT') AS service_role_insert`,
      )
      expect(insertGrants.rows[0]).toEqual({ authenticated_insert: false, service_role_insert: false })

      expect(coreMigration).toContain('PAYROLL_TAX_PROFILE_IDEMPOTENCY_CONFLICT')
      expect(coreMigration).toContain("'HR_ADMIN_CONFIRMED'")
      expect(coreMigration).toContain("'EMPLOYEE_DECLARATION'")
      expect(coreMigration).toContain('PAYROLL_TAX_PROFILE_CREDIT_ALREADY_APPLIES')
    } finally {
      await db.close()
    }
  })

  it('applies Payroll Lab migration without any Core tables and retains local scoped lifecycle guards', async () => {
    const db = new PGlite()
    try {
      await db.exec(payrollCatalogSchema)
      const absentCoreTables = await db.query<{ missing_core_count: number }>(
        `SELECT count(*)::integer AS missing_core_count FROM unnest(ARRAY[
          'employments', 'income_relationships', 'employment_income_relationships', 'employment_payroll_tax_profiles'
        ]) AS table_name WHERE to_regclass('public.' || table_name) IS NULL`,
      )
      expect(absentCoreTables.rows[0]?.missing_core_count).toBe(4)

      await db.exec(payrollMigration)

      const referenceForeignKeys = await db.query<{ foreign_key_count: number; targets: string[] }>(
        `SELECT count(*)::integer AS foreign_key_count,
          array_agg(confrelid::regclass::text ORDER BY conname) AS targets
          FROM pg_constraint WHERE conrelid = 'public.generic_payroll_input_references'::regclass AND contype = 'f'`,
      )
      expect(referenceForeignKeys.rows[0]).toEqual({
        foreign_key_count: 2,
        targets: ['calculation_input_sets', 'payroll_administrations'],
      })

      const referencePolicy = await db.query<{ relrowsecurity: boolean; policy_count: number; trigger_count: number }>(
        `SELECT c.relrowsecurity,
          (SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'generic_payroll_input_references') AS policy_count,
          (SELECT count(*)::integer FROM pg_trigger WHERE tgrelid = c.oid AND NOT tgisinternal) AS trigger_count
          FROM pg_class c WHERE c.oid = 'public.generic_payroll_input_references'::regclass`,
      )
      expect(referencePolicy.rows[0]).toEqual({ relrowsecurity: true, policy_count: 1, trigger_count: 1 })

      const lifecycleDefinition = await db.query<{ definition: string }>(
        `SELECT pg_get_functiondef('public.guard_individual_payroll_lifecycle_event()'::regprocedure) AS definition`,
      )
      expect(lifecycleDefinition.rows[0]?.definition).toContain("NEW.event_type = 'FINALIZED'")
      expect(lifecycleDefinition.rows[0]?.definition).toContain("NEW.event_type = 'REVIEWED'")
    } finally {
      await db.close()
    }
  })
})
