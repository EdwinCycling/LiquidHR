-- PAYFAST MSS Payroll setup actor-bound projection.
-- Definitive local candidate only. Do not apply to Payroll without separate exact-artifact GO.
--
-- The HR server signs a <=30-second single-use capability only after revalidating
-- the real Manager, direct employee/employment relation, scope, and period. Payroll
-- verifies that capability before setting RLS GUCs. Caller-supplied scope parameters
-- are not accepted by the executor-facing function. No key or DB password is stored here.
-- Do not add payfast_private to Supabase Data API exposed schemas.

BEGIN;

CREATE ROLE payfast_setup_reader
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- PostgreSQL 17 auto-membership is ADMIN-only (INHERIT/SET false). Add a
-- distinct transaction-scoped SET grant for owner transfers; revoke it before COMMIT.
GRANT payfast_setup_reader TO current_user WITH SET TRUE, INHERIT FALSE;

CREATE ROLE payfast_setup_executor
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  CONNECTION LIMIT 3;

ALTER ROLE payfast_setup_executor SET search_path = pg_catalog, payfast_private;
ALTER ROLE payfast_setup_executor SET statement_timeout = '5s';
ALTER ROLE payfast_setup_executor SET idle_in_transaction_session_timeout = '10s';

GRANT CONNECT ON DATABASE postgres TO payfast_setup_executor;
GRANT USAGE ON SCHEMA public TO payfast_setup_reader;

CREATE SCHEMA payfast_private AUTHORIZATION postgres;
-- Keep the migration principal as schema owner while it configures objects.
-- The target owner needs CREATE here before the object ownership transfers.
GRANT CREATE ON SCHEMA payfast_private TO payfast_setup_reader;
REVOKE ALL ON SCHEMA payfast_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA payfast_private TO payfast_setup_executor;

DO $payfast_vault_preflight$
BEGIN
  IF current_user <> 'postgres'
    OR pg_catalog.to_regclass('vault.decrypted_secrets') IS NULL
    OR NOT pg_catalog.has_table_privilege(current_user, 'vault.decrypted_secrets', 'SELECT') THEN
    RAISE EXCEPTION 'PAYFAST_VAULT_READER_PREREQUISITE_FAILED';
  END IF;
END;
$payfast_vault_preflight$;

-- Return only the fixed PAYFAST HMAC key. This SECURITY DEFINER is owned by
-- postgres, lives in the unexposed schema, takes no caller-supplied secret name,
-- and is executable only by the non-login projection owner.
CREATE FUNCTION payfast_private.payfast_mss_capability_hmac_key_v1()
RETURNS bytea
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $payfast_vault_key$
DECLARE
  v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO STRICT v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'liquidhr-payfast-mss-capability-v1';
  EXCEPTION WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'PAYFAST_CAPABILITY_KEY_UNAVAILABLE' USING ERRCODE = '28000';
  END;

  IF v_secret !~ '^[0-9A-Fa-f]{64,128}$' OR pg_catalog.length(v_secret) % 2 <> 0 THEN
    RAISE EXCEPTION 'PAYFAST_CAPABILITY_KEY_INVALID' USING ERRCODE = '28000';
  END IF;

  RETURN pg_catalog.decode(v_secret, 'hex');
END;
$payfast_vault_key$;

ALTER FUNCTION payfast_private.payfast_mss_capability_hmac_key_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION payfast_private.payfast_mss_capability_hmac_key_v1()
  FROM PUBLIC, anon, authenticated, service_role, payfast_setup_executor, payfast_setup_reader;
GRANT EXECUTE ON FUNCTION payfast_private.payfast_mss_capability_hmac_key_v1()
  TO payfast_setup_reader;

-- The nonce ledger is security metadata required for single-use capabilities;
-- it is not a Payroll business write.

CREATE TABLE payfast_private.payfast_setup_capability_nonces (
  jti uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('payfast-mss-setup-read', 'payfast-mss-opening-v3-import')),
  actor_user_id uuid NOT NULL,
  actor_employee_id uuid,
  target_employee_id uuid NOT NULL,
  source_employment_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  period_starts_on date NOT NULL,
  period_ends_on date NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CHECK (period_starts_on <= period_ends_on),
  CHECK (expires_at > issued_at)
);

ALTER TABLE payfast_private.payfast_setup_capability_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE payfast_private.payfast_setup_capability_nonces FORCE ROW LEVEL SECURITY;
CREATE POLICY payfast_setup_capability_nonce_reader_insert ON payfast_private.payfast_setup_capability_nonces
  FOR INSERT TO payfast_setup_reader WITH CHECK (true);
REVOKE ALL ON TABLE payfast_private.payfast_setup_capability_nonces
  FROM PUBLIC, anon, authenticated, service_role, payfast_setup_executor, payfast_setup_reader;
GRANT INSERT ON TABLE payfast_private.payfast_setup_capability_nonces TO payfast_setup_reader;
ALTER TABLE payfast_private.payfast_setup_capability_nonces OWNER TO payfast_setup_reader;

DO $payfast_preflight$
BEGIN
  IF pg_catalog.to_regprocedure('extensions.hmac(bytea,bytea,text)') IS NULL
    OR pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_PGCRYPTO_REQUIRED';
  END IF;
END;
$payfast_preflight$;
GRANT USAGE ON SCHEMA extensions TO payfast_setup_reader;
GRANT EXECUTE ON FUNCTION extensions.hmac(bytea, bytea, text),
  extensions.digest(bytea, text) TO payfast_setup_reader;

-- The executor has no base-table privilege. The non-login function owner receives
-- only the columns it must inspect; JSONB is projected to fixed scalar keys below.
REVOKE ALL PRIVILEGES ON TABLE
  public.payroll_administrations,
  public.payroll_employer_configuration_versions,
  public.payroll_opening_cumulative_snapshots,
  public.payroll_periods
FROM payfast_setup_executor, payfast_setup_reader;

GRANT SELECT (
  id, source_tenant_id, source_hr_group_id, source_administration_id,
  status, capability_enabled
) ON public.payroll_administrations TO payfast_setup_reader;

GRANT SELECT (
  id, payroll_administration_id, source_tenant_id, source_hr_group_id,
  source_administration_id, configuration_version, effective_from, effective_to,
  configuration_json, configuration_hash, status
) ON public.payroll_employer_configuration_versions TO payfast_setup_reader;

GRANT SELECT (
  id, payroll_administration_id, source_tenant_id, source_hr_group_id,
  source_administration_id, source_employment_id, snapshot_version, as_of_date,
  opening_balance_json, snapshot_hash, provenance_status, provenance_source
) ON public.payroll_opening_cumulative_snapshots TO payfast_setup_reader;

GRANT SELECT (
  id, payroll_administration_id, source_tenant_id, source_hr_group_id,
  source_administration_id, period_year, period_month, starts_on, ends_on,
  status, calendar_id, period_number, periodicity, period_kind
) ON public.payroll_periods TO payfast_setup_reader;

ALTER TABLE public.payroll_administrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_employer_configuration_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_opening_cumulative_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY payfast_setup_reader_scope ON public.payroll_administrations
  FOR SELECT TO payfast_setup_reader
  USING (
    source_tenant_id = nullif(pg_catalog.current_setting('payfast.source_tenant_id', true), '')::uuid
    AND source_hr_group_id = nullif(pg_catalog.current_setting('payfast.source_hr_group_id', true), '')::uuid
    AND source_administration_id = nullif(pg_catalog.current_setting('payfast.source_administration_id', true), '')::uuid
    AND status = 'ACTIVE'
    AND capability_enabled
  );

CREATE POLICY payfast_setup_reader_effective_configuration ON public.payroll_employer_configuration_versions
  FOR SELECT TO payfast_setup_reader
  USING (
    payroll_administration_id = nullif(pg_catalog.current_setting('payfast.payroll_administration_id', true), '')::uuid
    AND source_tenant_id = nullif(pg_catalog.current_setting('payfast.source_tenant_id', true), '')::uuid
    AND source_hr_group_id = nullif(pg_catalog.current_setting('payfast.source_hr_group_id', true), '')::uuid
    AND source_administration_id = nullif(pg_catalog.current_setting('payfast.source_administration_id', true), '')::uuid
    AND status = 'ACTIVE'
    AND effective_from <= nullif(pg_catalog.current_setting('payfast.period_start', true), '')::date
    AND (effective_to IS NULL OR effective_to >= nullif(pg_catalog.current_setting('payfast.period_start', true), '')::date)
  );

CREATE POLICY payfast_setup_reader_requested_period ON public.payroll_periods
  FOR SELECT TO payfast_setup_reader
  USING (
    payroll_administration_id = nullif(pg_catalog.current_setting('payfast.payroll_administration_id', true), '')::uuid
    AND source_tenant_id = nullif(pg_catalog.current_setting('payfast.source_tenant_id', true), '')::uuid
    AND source_hr_group_id = nullif(pg_catalog.current_setting('payfast.source_hr_group_id', true), '')::uuid
    AND source_administration_id = nullif(pg_catalog.current_setting('payfast.source_administration_id', true), '')::uuid
    AND status = 'OPEN'
    AND (
      (
        pg_catalog.current_setting('payfast.period_mode', true) = 'MONTH_ONLY'
        AND period_year = nullif(pg_catalog.current_setting('payfast.period_year', true), '')::smallint
        AND period_month = nullif(pg_catalog.current_setting('payfast.period_month', true), '')::smallint
        AND period_kind = 'REGULAR'
        AND periodicity = 'MONTHLY'
        AND starts_on = nullif(pg_catalog.current_setting('payfast.period_start', true), '')::date
        AND ends_on = nullif(pg_catalog.current_setting('payfast.period_end', true), '')::date
      )
      OR
      (
        pg_catalog.current_setting('payfast.period_mode', true) = 'PERIOD_IDENTITY'
        AND id = nullif(pg_catalog.current_setting('payfast.period_identity_id', true), '')::uuid
        AND period_year = nullif(pg_catalog.current_setting('payfast.identity_period_year', true), '')::smallint
        AND period_number = nullif(pg_catalog.current_setting('payfast.identity_period_number', true), '')::smallint
        AND period_kind = nullif(pg_catalog.current_setting('payfast.identity_period_kind', true), '')
        AND periodicity = nullif(pg_catalog.current_setting('payfast.identity_periodicity', true), '')
        AND starts_on = nullif(pg_catalog.current_setting('payfast.identity_starts_on', true), '')::date
        AND ends_on = nullif(pg_catalog.current_setting('payfast.identity_ends_on', true), '')::date
      )
    )
  );

CREATE POLICY payfast_setup_reader_target_opening_balance ON public.payroll_opening_cumulative_snapshots
  FOR SELECT TO payfast_setup_reader
  USING (
    payroll_administration_id = nullif(pg_catalog.current_setting('payfast.payroll_administration_id', true), '')::uuid
    AND source_tenant_id = nullif(pg_catalog.current_setting('payfast.source_tenant_id', true), '')::uuid
    AND source_hr_group_id = nullif(pg_catalog.current_setting('payfast.source_hr_group_id', true), '')::uuid
    AND source_administration_id = nullif(pg_catalog.current_setting('payfast.source_administration_id', true), '')::uuid
    AND source_employment_id = nullif(pg_catalog.current_setting('payfast.source_employment_id', true), '')::uuid
    AND as_of_date <= nullif(pg_catalog.current_setting('payfast.period_start', true), '')::date
  );

-- The import path can add exactly the selected version-3 target under a signed
-- admin capability. It receives INSERT only; the immutable-history trigger and
-- absence of UPDATE/DELETE privileges preserve all prior versions.
CREATE POLICY payfast_setup_reader_opening_v3_insert ON public.payroll_opening_cumulative_snapshots
  FOR INSERT TO payfast_setup_reader
  WITH CHECK (
    payroll_administration_id = nullif(pg_catalog.current_setting('payfast.payroll_administration_id', true), '')::uuid
    AND source_tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid
    AND source_hr_group_id = '6ba6f1df-e376-40f2-abff-ffdf000172e1'::uuid
    AND source_administration_id = '8483abc9-f275-c80b-5a23-fedc54ce9f0a'::uuid
    AND source_employment_id = '29058c73-5cfa-409d-b9d4-80dd30f36962'::uuid
    AND snapshot_version = 3
    AND as_of_date = DATE '2026-10-31'
    AND snapshot_hash = '49a7a5c88184dd92e89781c706de613eb17405701a7d08d99632fc9e9a7fe1ea'
    AND provenance_status = 'TEST_OPENING_BALANCE'
  );
GRANT INSERT (
  payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
  source_employment_id, snapshot_version, as_of_date, opening_balance_json, snapshot_hash,
  provenance_status, provenance_source, created_by_user_id
) ON public.payroll_opening_cumulative_snapshots TO payfast_setup_reader;

CREATE FUNCTION payfast_private.payfast_mss_setup_projection_v1(
  p_source_tenant_id uuid,
  p_source_hr_group_id uuid,
  p_source_administration_id uuid,
  p_source_employment_id uuid,
  p_period_year smallint,
  p_period_month smallint,
  p_month_starts_on date,
  p_month_ends_on date,
  p_identity_id uuid,
  p_identity_period_year smallint,
  p_identity_period_number smallint,
  p_identity_period_kind text,
  p_identity_periodicity text,
  p_identity_starts_on date,
  p_identity_ends_on date
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = on
AS $payfast_setup$
DECLARE
  v_period_mode text;
  v_period_start date;
  v_admin_count integer;
  v_payroll_administration record;
  v_period_count integer;
  v_period record;
  v_configuration record;
  v_configuration_found boolean := false;
  v_opening record;
  v_opening_found boolean := false;
  v_opening_values jsonb;
  v_opening_valid boolean := false;
  v_source_period_from date;
  v_source_period_to date;
  v_opening_issue jsonb;
BEGIN
  IF p_source_tenant_id IS NULL OR p_source_hr_group_id IS NULL
    OR p_source_administration_id IS NULL OR p_source_employment_id IS NULL
    OR p_period_year IS NULL OR p_period_month IS NULL
    OR p_period_year < 2000 OR p_period_year > 2200
    OR p_period_month < 1 OR p_period_month > 12 THEN
    RETURN jsonb_build_object('schemaVersion', 1, 'status', 'PAYROLL_SETUP_SCOPE_UNAVAILABLE');
  END IF;

  IF p_identity_id IS NULL THEN
    IF p_identity_period_year IS NOT NULL OR p_identity_period_number IS NOT NULL
      OR p_identity_period_kind IS NOT NULL OR p_identity_periodicity IS NOT NULL
      OR p_identity_starts_on IS NOT NULL OR p_identity_ends_on IS NOT NULL
      OR p_month_starts_on <> make_date(p_period_year::integer, p_period_month::integer, 1)
      OR p_month_ends_on <> ((make_date(p_period_year::integer, p_period_month::integer, 1) + interval '1 month - 1 day')::date) THEN
      RETURN jsonb_build_object('schemaVersion', 1, 'status', 'PAYROLL_PERIOD_UNAVAILABLE');
    END IF;
    v_period_mode := 'MONTH_ONLY';
    v_period_start := p_month_starts_on;
  ELSE
    IF p_identity_period_year IS NULL OR p_identity_period_number IS NULL
      OR p_identity_period_kind IS NULL OR p_identity_periodicity IS NULL
      OR p_identity_starts_on IS NULL OR p_identity_ends_on IS NULL
      OR p_identity_period_number < 1 OR p_identity_period_number > 14
      OR p_identity_starts_on > p_identity_ends_on THEN
      RETURN jsonb_build_object('schemaVersion', 1, 'status', 'PERIOD_IDENTITY_UNAVAILABLE');
    END IF;
    v_period_mode := 'PERIOD_IDENTITY';
    v_period_start := p_identity_starts_on;
  END IF;

  PERFORM pg_catalog.set_config('payfast.source_tenant_id', p_source_tenant_id::text, true);
  PERFORM pg_catalog.set_config('payfast.source_hr_group_id', p_source_hr_group_id::text, true);
  PERFORM pg_catalog.set_config('payfast.source_administration_id', p_source_administration_id::text, true);
  PERFORM pg_catalog.set_config('payfast.source_employment_id', p_source_employment_id::text, true);
  PERFORM pg_catalog.set_config('payfast.period_start', v_period_start::text, true);
  PERFORM pg_catalog.set_config('payfast.period_end', coalesce(p_identity_ends_on, p_month_ends_on)::text, true);
  PERFORM pg_catalog.set_config('payfast.period_year', p_period_year::text, true);
  PERFORM pg_catalog.set_config('payfast.period_month', p_period_month::text, true);
  PERFORM pg_catalog.set_config('payfast.period_mode', v_period_mode, true);
  PERFORM pg_catalog.set_config('payfast.period_identity_id', coalesce(p_identity_id::text, ''), true);
  PERFORM pg_catalog.set_config('payfast.identity_period_year', coalesce(p_identity_period_year::text, ''), true);
  PERFORM pg_catalog.set_config('payfast.identity_period_number', coalesce(p_identity_period_number::text, ''), true);
  PERFORM pg_catalog.set_config('payfast.identity_period_kind', coalesce(p_identity_period_kind, ''), true);
  PERFORM pg_catalog.set_config('payfast.identity_periodicity', coalesce(p_identity_periodicity, ''), true);
  PERFORM pg_catalog.set_config('payfast.identity_starts_on', coalesce(p_identity_starts_on::text, ''), true);
  PERFORM pg_catalog.set_config('payfast.identity_ends_on', coalesce(p_identity_ends_on::text, ''), true);

  SELECT count(*)::integer
  INTO v_admin_count
  FROM public.payroll_administrations a
  WHERE a.source_tenant_id = p_source_tenant_id
    AND a.source_hr_group_id = p_source_hr_group_id
    AND a.source_administration_id = p_source_administration_id
    AND a.status = 'ACTIVE'
    AND a.capability_enabled;

  IF v_admin_count <> 1 THEN
    RETURN jsonb_build_object('schemaVersion', 1, 'status', 'PAYROLL_SETUP_SCOPE_UNAVAILABLE');
  END IF;

  SELECT a.id, a.status, a.capability_enabled
  INTO v_payroll_administration
  FROM public.payroll_administrations a
  WHERE a.source_tenant_id = p_source_tenant_id
    AND a.source_hr_group_id = p_source_hr_group_id
    AND a.source_administration_id = p_source_administration_id
    AND a.status = 'ACTIVE'
    AND a.capability_enabled;

  PERFORM pg_catalog.set_config('payfast.payroll_administration_id', v_payroll_administration.id::text, true);

  IF v_period_mode = 'MONTH_ONLY' THEN
    SELECT count(*)::integer
    INTO v_period_count
    FROM public.payroll_periods p
    WHERE p.payroll_administration_id = v_payroll_administration.id
      AND p.source_tenant_id = p_source_tenant_id
      AND p.source_hr_group_id = p_source_hr_group_id
      AND p.source_administration_id = p_source_administration_id
      AND p.status = 'OPEN'
      AND p.period_year = p_period_year
      AND p.period_month = p_period_month
      AND p.period_kind = 'REGULAR'
      AND p.periodicity = 'MONTHLY'
      AND p.starts_on = p_month_starts_on
      AND p.ends_on = p_month_ends_on;
    IF v_period_count <> 1 THEN
      RETURN jsonb_build_object('schemaVersion', 1, 'status', 'PAYROLL_PERIOD_UNAVAILABLE');
    END IF;
    SELECT p.id, p.starts_on, p.ends_on, p.period_number, p.calendar_id,
      p.period_kind, p.periodicity
    INTO v_period
    FROM public.payroll_periods p
    WHERE p.payroll_administration_id = v_payroll_administration.id
      AND p.source_tenant_id = p_source_tenant_id
      AND p.source_hr_group_id = p_source_hr_group_id
      AND p.source_administration_id = p_source_administration_id
      AND p.status = 'OPEN'
      AND p.period_year = p_period_year
      AND p.period_month = p_period_month
      AND p.period_kind = 'REGULAR'
      AND p.periodicity = 'MONTHLY'
      AND p.starts_on = p_month_starts_on
      AND p.ends_on = p_month_ends_on;
  ELSE
    SELECT p.id, p.starts_on, p.ends_on, p.period_number, p.calendar_id,
      p.period_kind, p.periodicity
    INTO v_period
    FROM public.payroll_periods p
    WHERE p.id = p_identity_id
      AND p.payroll_administration_id = v_payroll_administration.id
      AND p.source_tenant_id = p_source_tenant_id
      AND p.source_hr_group_id = p_source_hr_group_id
      AND p.source_administration_id = p_source_administration_id
      AND p.status = 'OPEN'
      AND p.period_year = p_identity_period_year
      AND p.period_number = p_identity_period_number
      AND p.period_kind = p_identity_period_kind
      AND p.periodicity = p_identity_periodicity
      AND p.starts_on = p_identity_starts_on
      AND p.ends_on = p_identity_ends_on;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('schemaVersion', 1, 'status', 'PERIOD_IDENTITY_UNAVAILABLE');
    END IF;
  END IF;

  SELECT c.id, c.payroll_administration_id, c.configuration_version,
    c.effective_from, c.effective_to, c.configuration_json,
    c.configuration_hash, c.status
  INTO v_configuration
  FROM public.payroll_employer_configuration_versions c
  WHERE c.payroll_administration_id = v_payroll_administration.id
    AND c.source_tenant_id = p_source_tenant_id
    AND c.source_hr_group_id = p_source_hr_group_id
    AND c.source_administration_id = p_source_administration_id
    AND c.status = 'ACTIVE'
    AND c.effective_from <= v_period_start
    AND (c.effective_to IS NULL OR c.effective_to >= v_period_start)
  ORDER BY c.effective_from DESC, c.configuration_version DESC, c.id DESC
  LIMIT 1;
  v_configuration_found := FOUND;

  SELECT o.id, o.payroll_administration_id, o.source_employment_id,
    o.snapshot_version, o.as_of_date, o.opening_balance_json,
    o.snapshot_hash, o.provenance_status
  INTO v_opening
  FROM public.payroll_opening_cumulative_snapshots o
  WHERE o.payroll_administration_id = v_payroll_administration.id
    AND o.source_tenant_id = p_source_tenant_id
    AND o.source_hr_group_id = p_source_hr_group_id
    AND o.source_administration_id = p_source_administration_id
    AND o.source_employment_id = p_source_employment_id
    AND o.as_of_date <= v_period_start
  ORDER BY o.as_of_date DESC, o.snapshot_version DESC, o.id DESC
  LIMIT 1;
  v_opening_found := FOUND;

  IF v_opening_found THEN
    v_opening_values := coalesce(
      v_opening.opening_balance_json -> 'meaning',
      v_opening.opening_balance_json -> 'cumulativeBalances',
      v_opening.opening_balance_json
    );

    BEGIN
      IF jsonb_typeof(v_opening.opening_balance_json -> 'sourcePeriodFrom') IS DISTINCT FROM 'string'
        OR coalesce(v_opening.opening_balance_json ->> 'sourcePeriodFrom', '') !~ '^\d{4}-\d{2}-\d{2}$'
        OR jsonb_typeof(v_opening.opening_balance_json -> 'sourcePeriodTo') IS DISTINCT FROM 'string'
        OR coalesce(v_opening.opening_balance_json ->> 'sourcePeriodTo', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'PAYROLL_OPENING_CUMULATIVE_INVALID_DATE';
      END IF;
      v_source_period_from := (v_opening.opening_balance_json ->> 'sourcePeriodFrom')::date;
      v_source_period_to := (v_opening.opening_balance_json ->> 'sourcePeriodTo')::date;
      IF v_source_period_from::text IS DISTINCT FROM (v_opening.opening_balance_json ->> 'sourcePeriodFrom')
        OR v_source_period_to::text IS DISTINCT FROM (v_opening.opening_balance_json ->> 'sourcePeriodTo') THEN
        RAISE EXCEPTION 'PAYROLL_OPENING_CUMULATIVE_NONCANONICAL_DATE';
      END IF;
      v_opening_valid := jsonb_typeof(v_opening_values) = 'object'
        AND v_source_period_from IS NOT NULL
        AND v_source_period_to IS NOT NULL
        AND v_source_period_from <= v_source_period_to
        AND v_source_period_to < v_opening.as_of_date
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(ARRAY[
            'grossWageBeforePeriod',
            'taxableWageBeforePeriod',
            'wageTaxBeforePeriod',
            'employeeInsuranceWageBeforePeriod',
            'zvwWageBeforePeriod',
            'holidayReserveBeforePeriod',
            'yearEndReserveBeforePeriod'
          ]) AS required(key)
          WHERE jsonb_typeof(v_opening_values -> required.key) IS DISTINCT FROM 'string'
            OR coalesce(v_opening_values ->> required.key, '') !~ '^[0-9]{1,12}([.][0-9]{1,2})?$'
        );
    EXCEPTION WHEN others THEN
      v_opening_valid := false;
    END;

    IF NOT v_opening_valid THEN
      v_opening_issue := jsonb_build_object(
        'code', 'PAYROLL_OPENING_CUMULATIVE_INVALID',
        'snapshotId', v_opening.id,
        'snapshotVersion', v_opening.snapshot_version,
        'asOfDate', v_opening.as_of_date,
        'sourceHash', v_opening.snapshot_hash
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'status', CASE WHEN v_opening_found AND NOT v_opening_valid THEN 'OPENING_BALANCE_INVALID' ELSE 'READY' END,
    'target', jsonb_build_object(
      'tenantId', p_source_tenant_id,
      'hrGroupId', p_source_hr_group_id,
      'administrationId', p_source_administration_id,
      'employmentId', p_source_employment_id
    ),
    'payrollAdministration', jsonb_build_object(
      'id', v_payroll_administration.id,
      'status', v_payroll_administration.status,
      'capabilityEnabled', v_payroll_administration.capability_enabled
    ),
    'period', jsonb_build_object(
      'mode', v_period_mode,
      'startsOn', v_period.starts_on,
      'endsOn', v_period.ends_on,
      'payrollPeriodId', CASE WHEN v_period_mode = 'PERIOD_IDENTITY' THEN v_period.id ELSE NULL END,
      'periodKind', v_period.period_kind,
      'periodicity', v_period.periodicity,
      'periodNumberPresent', v_period.period_number IS NOT NULL,
      'calendarIdPresent', v_period.calendar_id IS NOT NULL,
      'periodIdentityVerified', v_period_mode = 'PERIOD_IDENTITY'
    ),
    'configuration', CASE WHEN v_configuration_found THEN jsonb_build_object(
      'id', v_configuration.id,
      'payrollAdministrationId', v_configuration.payroll_administration_id,
      'version', v_configuration.configuration_version,
      'effectiveFrom', v_configuration.effective_from,
      'effectiveTo', v_configuration.effective_to,
      'status', v_configuration.status,
      'sourceHash', v_configuration.configuration_hash,
      'employer', jsonb_build_object(
        'sectorCode', v_configuration.configuration_json #>> '{employer,sectorCode}',
        'awfClassification', v_configuration.configuration_json #>> '{employer,awfClassification}',
        'aofClassification', v_configuration.configuration_json #>> '{employer,aofClassification}',
        'wkoClassification', v_configuration.configuration_json #>> '{employer,wkoClassification}',
        'zvwClassification', v_configuration.configuration_json #>> '{employer,zvwClassification}'
      ),
      'employerRates', jsonb_build_object(
        'awf', v_configuration.configuration_json #>> '{employerRates,awf}',
        'aof', v_configuration.configuration_json #>> '{employerRates,aof}',
        'wko', v_configuration.configuration_json #>> '{employerRates,wko}',
        'whk', v_configuration.configuration_json #>> '{employerRates,whk}',
        'zvw', v_configuration.configuration_json #>> '{employerRates,zvw}'
      ),
      'reserves', jsonb_build_object(
        'holidayAllowanceRate', v_configuration.configuration_json #>> '{reserves,holidayAllowanceRate}',
        'yearEndApplies', v_configuration.configuration_json #> '{reserves,yearEndApplies}',
        'yearEndRate', v_configuration.configuration_json #>> '{reserves,yearEndRate}'
      ),
      'componentSet', jsonb_build_object(
        'compositionId', v_configuration.configuration_json #>> '{componentSet,compositionId}',
        'packageVersion', v_configuration.configuration_json #>> '{componentSet,packageVersion}',
        'packageHash', v_configuration.configuration_json #>> '{componentSet,packageHash}'
      ),
      'pension', jsonb_build_object(
        'partialMonthMethod', v_configuration.configuration_json #>> '{pension,partialMonthMethod}'
      )
    ) ELSE NULL END,
    'openingBalance', CASE WHEN v_opening_found AND v_opening_valid THEN jsonb_build_object(
      'id', v_opening.id,
      'sourceEmploymentId', v_opening.source_employment_id,
      'snapshotVersion', v_opening.snapshot_version,
      'asOfDate', v_opening.as_of_date,
      'sourcePeriodFrom', v_source_period_from,
      'sourcePeriodTo', v_source_period_to,
      'sourceHash', v_opening.snapshot_hash,
      'provenanceStatus', v_opening.provenance_status,
      'meaning', jsonb_build_object(
        'grossWageBeforePeriod', v_opening_values ->> 'grossWageBeforePeriod',
        'taxableWageBeforePeriod', v_opening_values ->> 'taxableWageBeforePeriod',
        'wageTaxBeforePeriod', v_opening_values ->> 'wageTaxBeforePeriod',
        'employeeInsuranceWageBeforePeriod', v_opening_values ->> 'employeeInsuranceWageBeforePeriod',
        'zvwWageBeforePeriod', v_opening_values ->> 'zvwWageBeforePeriod',
        'holidayReserveBeforePeriod', v_opening_values ->> 'holidayReserveBeforePeriod',
        'yearEndReserveBeforePeriod', v_opening_values ->> 'yearEndReserveBeforePeriod'
      )
    ) ELSE NULL END,
    'openingBalanceIssue', v_opening_issue
  );
END;
$payfast_setup$;

-- The only executor-facing entry point accepts one signed, target-bound,
-- single-use capability. The raw scope function above remains private to its owner.
CREATE FUNCTION payfast_private.payfast_mss_setup_projection_v2(p_capability text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = on
AS $payfast_capability$
DECLARE
  v_payload_part text;
  v_signature text;
  v_payload jsonb;
  v_expected_signature text;
  v_key bytea;
  v_now bigint;
  v_jti uuid;
  v_actor_user_id uuid;
  v_actor_employee_id uuid;
  v_target_employee_id uuid;
  v_source_employment_id uuid;
  v_source_tenant_id uuid;
  v_source_hr_group_id uuid;
  v_source_administration_id uuid;
  v_issued_at bigint;
  v_expires_at bigint;
  v_period_mode text;
  v_period_year smallint;
  v_period_month smallint;
  v_period_starts_on date;
  v_period_ends_on date;
  v_identity_id uuid;
  v_identity_period_year smallint;
  v_identity_period_number smallint;
  v_identity_period_kind text;
  v_identity_periodicity text;
  v_identity_starts_on date;
  v_identity_ends_on date;
  v_inserted integer;
BEGIN
  IF p_capability IS NULL OR pg_catalog.length(p_capability) > 8192
    OR p_capability !~ '^[A-Za-z0-9_-]+[.][0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  v_payload_part := pg_catalog.split_part(p_capability, '.', 1);
  v_signature := pg_catalog.split_part(p_capability, '.', 2);

  BEGIN
    v_payload := pg_catalog.convert_from(
      pg_catalog.decode(
        pg_catalog.translate(v_payload_part, '-_', '+/')
          || pg_catalog.repeat('=', (4 - pg_catalog.length(v_payload_part) % 4) % 4),
        'base64'
      ),
      'UTF8'
    )::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END;

  IF pg_catalog.jsonb_typeof(v_payload) IS DISTINCT FROM 'object'
    OR v_payload - ARRAY['v','iss','aud','kid','iat','exp','jti','actor','target','period']::text[] <> '{}'::jsonb
    OR v_payload ->> 'v' IS DISTINCT FROM '1'
    OR v_payload ->> 'iss' IS DISTINCT FROM 'liquidhr-payfast-hr'
    OR v_payload ->> 'aud' IS DISTINCT FROM 'payfast-mss-setup-read'
    OR v_payload ->> 'kid' IS DISTINCT FROM 'payfast-mss-capability-v1'
    OR (v_payload ->> 'iat') !~ '^[0-9]{1,12}$'
    OR (v_payload ->> 'exp') !~ '^[0-9]{1,12}$'
    OR pg_catalog.jsonb_typeof(v_payload -> 'actor') IS DISTINCT FROM 'object'
    OR (v_payload -> 'actor') - ARRAY['userId','employeeId']::text[] <> '{}'::jsonb
    OR pg_catalog.jsonb_typeof(v_payload -> 'target') IS DISTINCT FROM 'object'
    OR (v_payload -> 'target') - ARRAY['employeeId','employmentId','tenantId','hrGroupId','administrationId']::text[] <> '{}'::jsonb
    OR pg_catalog.jsonb_typeof(v_payload -> 'period') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  BEGIN
    v_jti := (v_payload ->> 'jti')::uuid;
    v_actor_user_id := (v_payload #>> '{actor,userId}')::uuid;
    v_actor_employee_id := (v_payload #>> '{actor,employeeId}')::uuid;
    v_target_employee_id := (v_payload #>> '{target,employeeId}')::uuid;
    v_source_employment_id := (v_payload #>> '{target,employmentId}')::uuid;
    v_source_tenant_id := (v_payload #>> '{target,tenantId}')::uuid;
    v_source_hr_group_id := (v_payload #>> '{target,hrGroupId}')::uuid;
    v_source_administration_id := (v_payload #>> '{target,administrationId}')::uuid;
    v_issued_at := (v_payload ->> 'iat')::bigint;
    v_expires_at := (v_payload ->> 'exp')::bigint;
    v_period_mode := v_payload #>> '{period,mode}';
    v_period_year := (v_payload #>> '{period,year}')::smallint;
    v_period_month := (v_payload #>> '{period,month}')::smallint;
    v_period_starts_on := (v_payload #>> '{period,startsOn}')::date;
    v_period_ends_on := (v_payload #>> '{period,endsOn}')::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END;

  IF v_period_mode = 'MONTH_ONLY' THEN
    IF (v_payload -> 'period') - ARRAY['mode','year','month','startsOn','endsOn']::text[] <> '{}'::jsonb
      OR v_period_year NOT BETWEEN 2000 AND 2200
      OR v_period_month NOT BETWEEN 1 AND 12
      OR v_period_starts_on <> pg_catalog.make_date(v_period_year::integer, v_period_month::integer, 1)
      OR v_period_ends_on <> (pg_catalog.make_date(v_period_year::integer, v_period_month::integer, 1)
        + INTERVAL '1 month - 1 day')::date THEN
      RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
    END IF;
  ELSIF v_period_mode = 'PERIOD_IDENTITY' THEN
    IF (v_payload -> 'period') - ARRAY['mode','year','month','startsOn','endsOn','identity']::text[] <> '{}'::jsonb
      OR pg_catalog.jsonb_typeof(v_payload #> '{period,identity}') IS DISTINCT FROM 'object'
      OR (v_payload #> '{period,identity}') - ARRAY['id','periodYear','periodNumber','periodKind','periodicity','startsOn','endsOn']::text[] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
    END IF;
    BEGIN
      v_identity_id := (v_payload #>> '{period,identity,id}')::uuid;
      v_identity_period_year := (v_payload #>> '{period,identity,periodYear}')::smallint;
      v_identity_period_number := (v_payload #>> '{period,identity,periodNumber}')::smallint;
      v_identity_period_kind := v_payload #>> '{period,identity,periodKind}';
      v_identity_periodicity := v_payload #>> '{period,identity,periodicity}';
      v_identity_starts_on := (v_payload #>> '{period,identity,startsOn}')::date;
      v_identity_ends_on := (v_payload #>> '{period,identity,endsOn}')::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
    END;
    IF v_identity_period_year <> v_period_year OR v_identity_period_number NOT BETWEEN 1 AND 14
      OR v_identity_period_kind IS NULL OR v_identity_periodicity IS NULL
      OR v_identity_starts_on <> v_period_starts_on OR v_identity_ends_on <> v_period_ends_on
      OR v_identity_starts_on > v_identity_ends_on THEN
      RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
    END IF;
  ELSE
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  v_key := payfast_private.payfast_mss_capability_hmac_key_v1();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;
  v_expected_signature := pg_catalog.encode(
    extensions.hmac(pg_catalog.convert_to(v_payload_part, 'UTF8'), v_key, 'sha256'),
    'hex'
  );
  -- Hash the MACs before equality comparison so a timing leak cannot reveal MAC prefixes.
  IF extensions.digest(pg_catalog.convert_to(v_signature, 'UTF8'), 'sha256')
    IS DISTINCT FROM extensions.digest(pg_catalog.convert_to(v_expected_signature, 'UTF8'), 'sha256') THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  v_now := pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint;
  IF v_issued_at < v_now - 30 OR v_issued_at > v_now + 5
    OR v_expires_at <= v_now OR v_expires_at <= v_issued_at OR v_expires_at > v_issued_at + 30 THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  -- The nonce ledger is append-only security metadata; no Payroll business row changes.
  BEGIN
    INSERT INTO payfast_private.payfast_setup_capability_nonces (
      jti, purpose, actor_user_id, actor_employee_id, target_employee_id, source_employment_id,
      source_tenant_id, source_hr_group_id, source_administration_id,
      period_starts_on, period_ends_on, issued_at, expires_at
    ) VALUES (
      v_jti, 'payfast-mss-setup-read', v_actor_user_id, v_actor_employee_id, v_target_employee_id, v_source_employment_id,
      v_source_tenant_id, v_source_hr_group_id, v_source_administration_id,
      v_period_starts_on, v_period_ends_on,
      pg_catalog.to_timestamp(v_issued_at), pg_catalog.to_timestamp(v_expires_at)
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> 1 THEN
    RAISE EXCEPTION 'PAYFAST_SETUP_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  RETURN payfast_private.payfast_mss_setup_projection_v1(
    v_source_tenant_id,
    v_source_hr_group_id,
    v_source_administration_id,
    v_source_employment_id,
    v_period_year,
    v_period_month,
    v_period_starts_on,
    v_period_ends_on,
    v_identity_id,
    v_identity_period_year,
    v_identity_period_number,
    v_identity_period_kind,
    v_identity_periodicity,
    v_identity_starts_on,
    v_identity_ends_on
  );
END;
$payfast_capability$;


-- One-off, actor-bound import. The only accepted payload is the reviewed V3 snapshot below.
CREATE FUNCTION payfast_private.payfast_mss_opening_v3_import_v1(p_capability text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = on
AS $payfast_v3_import$
DECLARE
  v_payload_part text;
  v_signature text;
  v_payload jsonb;
  v_expected_signature text;
  v_key bytea;
  v_now bigint;
  v_jti uuid;
  v_actor_user_id uuid;
  v_target_employee_id uuid;
  v_source_employment_id uuid;
  v_source_tenant_id uuid;
  v_source_hr_group_id uuid;
  v_source_administration_id uuid;
  v_issued_at bigint;
  v_expires_at bigint;
  v_source_period_from date;
  v_source_period_to date;
  v_as_of_date date;
  v_payroll_administration_id uuid;
  v_admin_count integer;
  v_legacy_count integer;
  v_latest_version integer;
  v_existing record;
  v_opening_balance_json CONSTANT jsonb := $payfast_opening_v3${"schemaVersion":"payroll-opening-cumulative-v1","sourcePeriodFrom":"2026-01-01","sourcePeriodTo":"2026-10-31","asOfDate":"2026-10-31","meaning":{"grossWageBeforePeriod":"18542.70","taxableWageBeforePeriod":"17876.96","wageTaxBeforePeriod":"6384.50","employeeInsuranceWageBeforePeriod":"17876.96","zvwWageBeforePeriod":"17876.96","holidayReserveBeforePeriod":"1483.42","yearEndReserveBeforePeriod":"0.00"},"sourceReference":"SYNTHETIC_FIXTURE:d0bec1993595:PAYFAST-2026-ENGINE-CHAIN:bf93ceb0ed6aaa9045c225c1f1bea8c0144593858f0363d24d2cbd65c341cc72","sourceHistoryHash":"bf93ceb0ed6aaa9045c225c1f1bea8c0144593858f0363d24d2cbd65c341cc72","sourceManifestHashes":["e442d59526fe8fad8c1bdf1ec7497b56b39f07f9f0a11e71af64af2048fd66ec","59fce39dd33ac5b3f4b31dc04ffb87ab974d355a6808fbb6bb9c22831a014ab8","2baea7c7543b4e28e70dd7d7f038e9ea10ea912cf6529e71ee95ab222af2a8a9","380de8a50c00014c5d2539de1abb34651e9cbb153225d7ff50e62df5b468121d","cad52a6b07b6feb05a2193db4d3c2ab172b85c9c3507e7fa667bd4fcd1f9134f","4a4c146192efc80d166a3125ae9eab0895d60c6c5cbb2c21afdcf6fcb2eefea6","283fa24acb6670d731b31e3f0006d5de3907af7b8360675f4676fe25de92aaf1","37c4e56a1b2c4fdcaf16d49cfd1a5c12af167e660505425cb57c7f34d744aae4","14ba2366ba314e940a4ae9f5e1d94724afde49f574038dbb018fadb2a370c48e","0293e36166aca04af6a20088838cbb921ec02fc4da8a41ce41db018f700c7637"],"sourceHashes":["74f633fb10367b27e9ac002f6c65908adaa7a22e3b8ebaa12b12c5c7319d0428","5d39ec38e7952a5814e4a9333b2f94e2792c0eab88dc57503633ec1d7e57a02a","3d07b278a08052af72057aa3e14af6697b250f0fa3b49d9f65c23e2fc3afe4fb","6a4b65fc24d79ffee528b97d9fe7ec6c3f732e642bf0453d618e0e210f7c48dc","ba5bf851d2225f2a97e8f7310988075fedd05c5a881d67f606836f22695c60a2","ff606c9690a1c4090b07401e0e18a018a90135b49c454beb297607326fb567fe","e6f7d43242872218ea8da21fb15d082483d79c77f93956ffe9c48ac0f9c0c26d","4e41deabf1e894bcd0085f2fc102433a20670550ed37f358090b2a15bb110795","72a94b0fa2b2e9881b7f301869b943d31691baa12c610cc157aba15b8f67614c","568d0e4882d0de918c95f6c3b6eab433022273a8f3d6b431bfa771943987524b"],"inputHashes":["2c60175b6b04e8016e0e9517a440f341ee8d63b1ed4edfa8705d96e09b837196","a085c2ad6a77c3ba16c7254f5e7127803497478bde16ca721e1be5d34b0ba96d","ff82e6a1dc5860538841fe653c1071f87ec7477beb96eee4b7cfd147ed91b815","ff3f73ccf0af7bf0f8c550acb3e14a01d2e5eabb392ac213107833e7b79d9caf","e34f8ee51f931c7e8954bb75a90138169248f0b3a3335c59edec539ede1ca94e","045d07b14fb00f1d5b35358f210e216a6add4c05bdd46cdd1f969f20be20eef5","8bc96e9d20e05c28cce68bdf500f902c5aaf16dd03ad5abca9209264cd2ed8d0","0a9b08fe1520a29b967e1f2b1692b228295d80fd2301d956a4c3986d8c518ddf","c2ec60d41647a914168f0434ed19f9df54585a3679806eec3d73049bb3460556","c8c44603efc9fa263da83220ad1f622476fd2b17a68b7bad2c85a1b760ac1648"],"resultHashes":["6f3ffe9025c36b1a0f359e1bbc20a9c60a2537a0e3bc959133f6dada856053a0","ba8f2e2fe852214bc618ae1be8852fa227344e86e44a49c4c47a90c5232cc06e","f20e0ef62a84f9e8f8a65e9fc4ae3e9d47ed87618877adff77f1b6d0675a5cd5","ee5040b5b30770c32caedee37045ecd09fb51d4fdb022c18d3a0636a9811e6ec","b49b810c1d4d5a741b3316a0ac5799c428f1c02df77c5f323312425239801660","987e6e9da9b4a4ad27675931fa3ba1cab4da0c553e62314c96387f2e95531549","cb0878072cb7514ceeedbd8b8538ae8333ed6898ae7badc1722b8148f5c36d7d","f8c167b5cd54c4cd5980a1be980c2f6075498c35a926689a213c8ede6c9b405a","0559253c48f4dfa296c18badede030b208182e7033e59c5cfa9de2ae84e65b03","f5e9ebec5b7a9bfe1fc6a2c339109a7b51280199fc02510302e1202590c360a7"],"engineVersion":"0.3.0","rulePackageCompositionId":"NL-PAYROLL-2026:2026.1+PAYRUN01-CUSTOMER_STANDARD-2026.2+PARTIAL-PERIODS-2026.1+PAYFULL02-CUSTOMER_STANDARD-NET-EMPLOYER-2026.3+PENSION-EMPLOYER-REMAINDER-2026.1"}$payfast_opening_v3$::jsonb;
  v_snapshot_hash CONSTANT text := '49a7a5c88184dd92e89781c706de613eb17405701a7d08d99632fc9e9a7fe1ea';
  v_legacy_snapshot_hash CONSTANT text := '5de1c881831e2497ffd65ffdb3252d239dfd6e40be1c7c52286c6c5b9b3c03ee';
  v_source_history_hash CONSTANT text := 'bf93ceb0ed6aaa9045c225c1f1bea8c0144593858f0363d24d2cbd65c341cc72';
  v_provenance_source CONSTANT text := 'SYNTHETIC_TEST:SYNTHETIC_FIXTURE:d0bec1993595:PAYFAST-2026-ENGINE-CHAIN:bf93ceb0ed6aaa9045c225c1f1bea8c0144593858f0363d24d2cbd65c341cc72';
  v_inserted integer;
BEGIN
  IF p_capability IS NULL OR pg_catalog.length(p_capability) > 8192
    OR p_capability !~ '^[A-Za-z0-9_-]+[.][0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  v_payload_part := pg_catalog.split_part(p_capability, '.', 1);
  v_signature := pg_catalog.split_part(p_capability, '.', 2);
  BEGIN
    v_payload := pg_catalog.convert_from(
      pg_catalog.decode(
        pg_catalog.translate(v_payload_part, '-_', '+/')
          || pg_catalog.repeat('=', (4 - pg_catalog.length(v_payload_part) % 4) % 4),
        'base64'
      ),
      'UTF8'
    )::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END;

  IF pg_catalog.jsonb_typeof(v_payload) IS DISTINCT FROM 'object'
    OR v_payload - ARRAY['v','iss','aud','kid','iat','exp','jti','actor','target','opening']::text[] <> '{}'::jsonb
    OR v_payload ->> 'v' IS DISTINCT FROM '1'
    OR v_payload ->> 'iss' IS DISTINCT FROM 'liquidhr-payfast-hr'
    OR v_payload ->> 'aud' IS DISTINCT FROM 'payfast-mss-opening-v3-import'
    OR v_payload ->> 'kid' IS DISTINCT FROM 'payfast-mss-capability-v1'
    OR (v_payload ->> 'iat') !~ '^[0-9]{1,12}$'
    OR (v_payload ->> 'exp') !~ '^[0-9]{1,12}$'
    OR pg_catalog.jsonb_typeof(v_payload -> 'actor') IS DISTINCT FROM 'object'
    OR (v_payload -> 'actor') - ARRAY['userId']::text[] <> '{}'::jsonb
    OR pg_catalog.jsonb_typeof(v_payload -> 'target') IS DISTINCT FROM 'object'
    OR (v_payload -> 'target') - ARRAY['employeeId','employmentId','tenantId','hrGroupId','administrationId']::text[] <> '{}'::jsonb
    OR pg_catalog.jsonb_typeof(v_payload -> 'opening') IS DISTINCT FROM 'object'
    OR (v_payload -> 'opening') - ARRAY['snapshotVersion','asOfDate','sourcePeriodFrom','sourcePeriodTo','snapshotHash','legacySnapshotHash','sourceHistoryHash']::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  BEGIN
    v_jti := (v_payload ->> 'jti')::uuid;
    v_actor_user_id := (v_payload #>> '{actor,userId}')::uuid;
    v_target_employee_id := (v_payload #>> '{target,employeeId}')::uuid;
    v_source_employment_id := (v_payload #>> '{target,employmentId}')::uuid;
    v_source_tenant_id := (v_payload #>> '{target,tenantId}')::uuid;
    v_source_hr_group_id := (v_payload #>> '{target,hrGroupId}')::uuid;
    v_source_administration_id := (v_payload #>> '{target,administrationId}')::uuid;
    v_issued_at := (v_payload ->> 'iat')::bigint;
    v_expires_at := (v_payload ->> 'exp')::bigint;
    v_source_period_from := (v_payload #>> '{opening,sourcePeriodFrom}')::date;
    v_source_period_to := (v_payload #>> '{opening,sourcePeriodTo}')::date;
    v_as_of_date := (v_payload #>> '{opening,asOfDate}')::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END;

  IF v_target_employee_id <> 'dd9bde02-76bb-4f7c-8add-db544a148f3f'::uuid
    OR v_source_employment_id <> '29058c73-5cfa-409d-b9d4-80dd30f36962'::uuid
    OR v_source_tenant_id <> '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid
    OR v_source_hr_group_id <> '6ba6f1df-e376-40f2-abff-ffdf000172e1'::uuid
    OR v_source_administration_id <> '8483abc9-f275-c80b-5a23-fedc54ce9f0a'::uuid
    OR (v_payload #>> '{opening,snapshotVersion}')::integer <> 3
    OR v_as_of_date <> DATE '2026-10-31'
    OR v_source_period_from <> DATE '2026-01-01'
    OR v_source_period_to <> DATE '2026-10-31'
    OR v_payload #>> '{opening,snapshotHash}' IS DISTINCT FROM v_snapshot_hash
    OR v_payload #>> '{opening,legacySnapshotHash}' IS DISTINCT FROM v_legacy_snapshot_hash
    OR v_payload #>> '{opening,sourceHistoryHash}' IS DISTINCT FROM v_source_history_hash THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_SCOPE_INVALID' USING ERRCODE = '28000';
  END IF;

  IF v_opening_balance_json ->> 'schemaVersion' IS DISTINCT FROM 'payroll-opening-cumulative-v1'
    OR v_opening_balance_json ->> 'sourcePeriodFrom' IS DISTINCT FROM DATE '2026-01-01'::text
    OR v_opening_balance_json ->> 'sourcePeriodTo' IS DISTINCT FROM DATE '2026-10-31'::text
    OR v_opening_balance_json ->> 'asOfDate' IS DISTINCT FROM DATE '2026-10-31'::text
    OR v_opening_balance_json ->> 'sourceHistoryHash' IS DISTINCT FROM v_source_history_hash
    OR v_opening_balance_json #>> '{meaning,grossWageBeforePeriod}' IS DISTINCT FROM '18542.70'
    OR v_opening_balance_json #>> '{meaning,taxableWageBeforePeriod}' IS DISTINCT FROM '17876.96'
    OR v_opening_balance_json #>> '{meaning,wageTaxBeforePeriod}' IS DISTINCT FROM '6384.50'
    OR v_opening_balance_json #>> '{meaning,employeeInsuranceWageBeforePeriod}' IS DISTINCT FROM '17876.96'
    OR v_opening_balance_json #>> '{meaning,zvwWageBeforePeriod}' IS DISTINCT FROM '17876.96'
    OR v_opening_balance_json #>> '{meaning,holidayReserveBeforePeriod}' IS DISTINCT FROM '1483.42'
    OR v_opening_balance_json #>> '{meaning,yearEndReserveBeforePeriod}' IS DISTINCT FROM '0.00'
    OR pg_catalog.jsonb_array_length(v_opening_balance_json -> 'sourceManifestHashes') <> 10
    OR pg_catalog.jsonb_array_length(v_opening_balance_json -> 'sourceHashes') <> 10
    OR pg_catalog.jsonb_array_length(v_opening_balance_json -> 'inputHashes') <> 10
    OR pg_catalog.jsonb_array_length(v_opening_balance_json -> 'resultHashes') <> 10 THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_PROVENANCE_INVALID';
  END IF;

  v_key := payfast_private.payfast_mss_capability_hmac_key_v1();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;
  v_expected_signature := pg_catalog.encode(
    extensions.hmac(pg_catalog.convert_to(v_payload_part, 'UTF8'), v_key, 'sha256'),
    'hex'
  );
  IF extensions.digest(pg_catalog.convert_to(v_signature, 'UTF8'), 'sha256')
    IS DISTINCT FROM extensions.digest(pg_catalog.convert_to(v_expected_signature, 'UTF8'), 'sha256') THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  v_now := pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint;
  IF v_issued_at < v_now - 30 OR v_issued_at > v_now + 5
    OR v_expires_at <= v_now OR v_expires_at <= v_issued_at OR v_expires_at > v_issued_at + 30 THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws(':', v_source_tenant_id::text, v_source_hr_group_id::text,
      v_source_administration_id::text, v_source_employment_id::text), 0
  ));

  BEGIN
    INSERT INTO payfast_private.payfast_setup_capability_nonces (
      jti, purpose, actor_user_id, actor_employee_id, target_employee_id, source_employment_id,
      source_tenant_id, source_hr_group_id, source_administration_id,
      period_starts_on, period_ends_on, issued_at, expires_at
    ) VALUES (
      v_jti, 'payfast-mss-opening-v3-import', v_actor_user_id, NULL, v_target_employee_id, v_source_employment_id,
      v_source_tenant_id, v_source_hr_group_id, v_source_administration_id,
      v_source_period_from, v_source_period_to,
      pg_catalog.to_timestamp(v_issued_at), pg_catalog.to_timestamp(v_expires_at)
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_CAPABILITY_INVALID' USING ERRCODE = '28000';
  END;

  PERFORM pg_catalog.set_config('payfast.source_tenant_id', v_source_tenant_id::text, true);
  PERFORM pg_catalog.set_config('payfast.source_hr_group_id', v_source_hr_group_id::text, true);
  PERFORM pg_catalog.set_config('payfast.source_administration_id', v_source_administration_id::text, true);
  PERFORM pg_catalog.set_config('payfast.source_employment_id', v_source_employment_id::text, true);
  -- V1/V2 close on 2026-09-30; the November target period starts 2026-11-01.
  PERFORM pg_catalog.set_config('payfast.period_start', DATE '2026-11-01'::text, true);

  SELECT count(*)::integer INTO v_admin_count
  FROM public.payroll_administrations a
  WHERE a.source_tenant_id = v_source_tenant_id
    AND a.source_hr_group_id = v_source_hr_group_id
    AND a.source_administration_id = v_source_administration_id
    AND a.status = 'ACTIVE' AND a.capability_enabled;
  IF v_admin_count <> 1 THEN RAISE EXCEPTION 'PAYFAST_OPENING_V3_ADMINISTRATION_UNAVAILABLE'; END IF;

  SELECT a.id INTO v_payroll_administration_id
  FROM public.payroll_administrations a
  WHERE a.source_tenant_id = v_source_tenant_id
    AND a.source_hr_group_id = v_source_hr_group_id
    AND a.source_administration_id = v_source_administration_id
    AND a.status = 'ACTIVE' AND a.capability_enabled;
  PERFORM pg_catalog.set_config('payfast.payroll_administration_id', v_payroll_administration_id::text, true);

  SELECT count(*)::integer INTO v_legacy_count
  FROM public.payroll_opening_cumulative_snapshots s
  WHERE s.payroll_administration_id = v_payroll_administration_id
    AND s.source_tenant_id = v_source_tenant_id
    AND s.source_hr_group_id = v_source_hr_group_id
    AND s.source_administration_id = v_source_administration_id
    AND s.source_employment_id = v_source_employment_id
    AND s.snapshot_version IN (1, 2)
    AND s.as_of_date = DATE '2026-09-30'
    AND s.snapshot_hash = v_legacy_snapshot_hash
    AND s.provenance_status = 'TEST_OPENING_BALANCE';
  IF v_legacy_count <> 2 THEN RAISE EXCEPTION 'PAYFAST_OPENING_V3_LEGACY_BASELINE_CHANGED'; END IF;


  SELECT s.as_of_date, s.snapshot_hash, s.opening_balance_json, s.provenance_status, s.provenance_source
  INTO v_existing FROM public.payroll_opening_cumulative_snapshots s
  WHERE s.payroll_administration_id = v_payroll_administration_id
    AND s.source_tenant_id = v_source_tenant_id
    AND s.source_hr_group_id = v_source_hr_group_id
    AND s.source_administration_id = v_source_administration_id
    AND s.source_employment_id = v_source_employment_id
    AND s.snapshot_version = 3;
  IF FOUND THEN
    IF v_existing.as_of_date IS DISTINCT FROM v_as_of_date
      OR v_existing.snapshot_hash IS DISTINCT FROM v_snapshot_hash
      OR v_existing.opening_balance_json IS DISTINCT FROM v_opening_balance_json
      OR v_existing.provenance_status IS DISTINCT FROM 'TEST_OPENING_BALANCE'
      OR v_existing.provenance_source IS DISTINCT FROM v_provenance_source THEN
      RAISE EXCEPTION 'PAYFAST_OPENING_V3_VERSION_CONFLICT';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'status', 'ALREADY_PRESENT_EXACT', 'snapshotVersion', 3,
      'asOfDate', v_as_of_date, 'snapshotHash', v_snapshot_hash, 'inserted', false
    );
  END IF;

  SELECT max(s.snapshot_version)::integer INTO v_latest_version
  FROM public.payroll_opening_cumulative_snapshots s
  WHERE s.payroll_administration_id = v_payroll_administration_id
    AND s.source_tenant_id = v_source_tenant_id
    AND s.source_hr_group_id = v_source_hr_group_id
    AND s.source_administration_id = v_source_administration_id
    AND s.source_employment_id = v_source_employment_id;
  IF v_latest_version IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'PAYFAST_OPENING_V3_VERSION_DRIFT'; END IF;

  INSERT INTO public.payroll_opening_cumulative_snapshots (
    payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
    source_employment_id, snapshot_version, as_of_date, opening_balance_json, snapshot_hash,
    provenance_status, provenance_source, created_by_user_id
  ) VALUES (
    v_payroll_administration_id, v_source_tenant_id, v_source_hr_group_id, v_source_administration_id,
    v_source_employment_id, 3, v_as_of_date, v_opening_balance_json, v_snapshot_hash,
    'TEST_OPENING_BALANCE', v_provenance_source, v_actor_user_id
  ) ON CONFLICT ON CONSTRAINT payroll_opening_cumulative_version_unique DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT s.as_of_date, s.snapshot_hash, s.opening_balance_json, s.provenance_status, s.provenance_source
  INTO v_existing FROM public.payroll_opening_cumulative_snapshots s
  WHERE s.payroll_administration_id = v_payroll_administration_id
    AND s.source_tenant_id = v_source_tenant_id
    AND s.source_hr_group_id = v_source_hr_group_id
    AND s.source_administration_id = v_source_administration_id
    AND s.source_employment_id = v_source_employment_id
    AND s.snapshot_version = 3;
  IF NOT FOUND OR v_existing.as_of_date IS DISTINCT FROM v_as_of_date
    OR v_existing.snapshot_hash IS DISTINCT FROM v_snapshot_hash
    OR v_existing.opening_balance_json IS DISTINCT FROM v_opening_balance_json
    OR v_existing.provenance_status IS DISTINCT FROM 'TEST_OPENING_BALANCE'
    OR v_existing.provenance_source IS DISTINCT FROM v_provenance_source THEN
    RAISE EXCEPTION 'PAYFAST_OPENING_V3_POSTWRITE_VERIFY_FAILED';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'status', CASE WHEN v_inserted = 1 THEN 'INSERTED_EXACT' ELSE 'ALREADY_PRESENT_EXACT' END,
    'snapshotVersion', 3, 'asOfDate', v_as_of_date,
    'snapshotHash', v_snapshot_hash, 'inserted', v_inserted = 1
  );
END;
$payfast_v3_import$;

REVOKE ALL ON FUNCTION payfast_private.payfast_mss_opening_v3_import_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION payfast_private.payfast_mss_opening_v3_import_v1(text)
  TO payfast_setup_executor;
COMMENT ON FUNCTION payfast_private.payfast_mss_opening_v3_import_v1(text)
  IS 'Eenmalige import van uitsluitend opening V3, na korte HR-server capability en versie/hashcontroles.';
ALTER FUNCTION payfast_private.payfast_mss_opening_v3_import_v1(text) OWNER TO payfast_setup_reader;


REVOKE ALL ON FUNCTION payfast_private.payfast_mss_setup_projection_v1(
  uuid, uuid, uuid, uuid, smallint, smallint, date, date,
  uuid, smallint, smallint, text, text, date, date
) FROM PUBLIC, anon, authenticated, service_role, payfast_setup_executor;

REVOKE ALL ON FUNCTION payfast_private.payfast_mss_setup_projection_v2(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION payfast_private.payfast_mss_setup_projection_v2(text)
  TO payfast_setup_executor;
COMMENT ON FUNCTION payfast_private.payfast_mss_setup_projection_v1(
  uuid, uuid, uuid, uuid, smallint, smallint, date, date,
  uuid, smallint, smallint, text, text, date, date
) IS 'Interne beperkte bronprojectie; alleen aanroepbaar binnen de eigenaar-definer capability wrapper.';
COMMENT ON FUNCTION payfast_private.payfast_mss_setup_projection_v2(text)
  IS 'Controleert een HR-server ondertekende, kortlevende en single-use Manager capability vóór de beperkte Payroll bronprojectie.';
ALTER FUNCTION payfast_private.payfast_mss_setup_projection_v2(text) OWNER TO payfast_setup_reader;
ALTER FUNCTION payfast_private.payfast_mss_setup_projection_v1(
  uuid, uuid, uuid, uuid, smallint, smallint, date, date,
  uuid, smallint, smallint, text, text, date, date
) OWNER TO payfast_setup_reader;

-- Remove the target role's temporary CREATE privilege on the schema.
REVOKE CREATE ON SCHEMA payfast_private FROM payfast_setup_reader;
-- ALTER SCHEMA OWNER needs the new owner to have database CREATE; scope and
-- revoke it inside this transaction, then remove only our temporary SET grant.
DO $payfast_private_schema_owner_create$
BEGIN
  EXECUTE pg_catalog.format(
    'GRANT CREATE ON DATABASE %I TO payfast_setup_reader',
    pg_catalog.current_database()
  );
END;
$payfast_private_schema_owner_create$;
ALTER SCHEMA payfast_private OWNER TO payfast_setup_reader;
DO $payfast_private_schema_owner_revoke$
BEGIN
  EXECUTE pg_catalog.format(
    'REVOKE CREATE ON DATABASE %I FROM payfast_setup_reader',
    pg_catalog.current_database()
  );
END;
$payfast_private_schema_owner_revoke$;
REVOKE payfast_setup_reader FROM current_user;

COMMIT;
