-- Core-owned fiscal inputs used by the narrowly supported NL 2026 monthly payroll flow.
-- Each confirmation is immutable, effective-dated and tied to one verified employment/IKV link.
BEGIN;

CREATE TABLE public.employment_payroll_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  employment_id uuid NOT NULL,
  income_relationship_id uuid NOT NULL,
  employment_income_relationship_id uuid NOT NULL,
  residence_country_code text NOT NULL DEFAULT 'NL' CHECK (residence_country_code = 'NL'),
  wage_tax_table text NOT NULL DEFAULT 'WHITE' CHECK (wage_tax_table = 'WHITE'),
  herleiding_code text NOT NULL DEFAULT 'STD' CHECK (herleiding_code = 'STD'),
  time_period text NOT NULL DEFAULT 'MONTH' CHECK (time_period = 'MONTH'),
  regular_wage_only boolean NOT NULL DEFAULT true CHECK (regular_wage_only),
  full_period_only boolean NOT NULL DEFAULT true CHECK (full_period_only),
  has_special_situation boolean NOT NULL DEFAULT false CHECK (NOT has_special_situation),
  payroll_tax_credit_applies boolean NOT NULL,
  source_classification text NOT NULL DEFAULT 'EMPLOYEE_DECLARATION'
    CHECK (source_classification = 'EMPLOYEE_DECLARATION'),
  source_reference text NOT NULL CHECK (
    char_length(btrim(source_reference)) BETWEEN 1 AND 160
    AND source_reference !~ '[[:cntrl:]]'
  ),
  effective_from date NOT NULL,
  effective_to date,
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_profile_id uuid,
  idempotency_key uuid NOT NULL,
  confirmed_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  confirmed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT employment_payroll_tax_profiles_dates_valid
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT employment_payroll_tax_profiles_employment_scope_fkey
    FOREIGN KEY (tenant_id, administration_id, employee_id, employment_id)
    REFERENCES public.employments (tenant_id, administration_id, employee_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT employment_payroll_tax_profiles_income_scope_fkey
    FOREIGN KEY (tenant_id, administration_id, employee_id, income_relationship_id)
    REFERENCES public.income_relationships (tenant_id, administration_id, employee_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT employment_payroll_tax_profiles_income_link_fkey
    FOREIGN KEY (employment_income_relationship_id)
    REFERENCES public.employment_income_relationships (id)
    ON DELETE RESTRICT,
  CONSTRAINT employment_payroll_tax_profiles_version_scope_unique
    UNIQUE (tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id, version_number),
  CONSTRAINT employment_payroll_tax_profiles_profile_scope_unique
    UNIQUE (id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id),
  CONSTRAINT employment_payroll_tax_profiles_supersedes_scope_fkey
    FOREIGN KEY (supersedes_profile_id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id)
    REFERENCES public.employment_payroll_tax_profiles
      (id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX employment_payroll_tax_profiles_one_successor_idx
  ON public.employment_payroll_tax_profiles (supersedes_profile_id)
  WHERE supersedes_profile_id IS NOT NULL;
CREATE UNIQUE INDEX employment_payroll_tax_profiles_idempotency_idx
  ON public.employment_payroll_tax_profiles (tenant_id, hr_group_id, administration_id, idempotency_key);
CREATE INDEX employment_payroll_tax_profiles_effective_scope_idx
  ON public.employment_payroll_tax_profiles
    (tenant_id, hr_group_id, administration_id, employee_id, employment_id, income_relationship_id, effective_from DESC, version_number DESC);

CREATE TABLE public.employment_payroll_tax_profile_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  employment_id uuid NOT NULL,
  income_relationship_id uuid NOT NULL,
  tax_profile_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  action text NOT NULL CHECK (action = 'HR_ADMIN_CONFIRMED'),
  audit_payload jsonb NOT NULL CHECK (jsonb_typeof(audit_payload) = 'object'),
  recorded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT employment_payroll_tax_profile_audit_profile_scope_fkey
    FOREIGN KEY (tax_profile_id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id)
    REFERENCES public.employment_payroll_tax_profiles
      (id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id)
    ON DELETE RESTRICT
);

CREATE FUNCTION public.reject_employment_payroll_tax_profile_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Confirmed payroll tax profiles and their audit records are immutable.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER employment_payroll_tax_profiles_immutable
  BEFORE UPDATE OR DELETE ON public.employment_payroll_tax_profiles
  FOR EACH ROW EXECUTE FUNCTION public.reject_employment_payroll_tax_profile_mutation();
CREATE TRIGGER employment_payroll_tax_profile_audit_immutable
  BEFORE UPDATE OR DELETE ON public.employment_payroll_tax_profile_audit
  FOR EACH ROW EXECUTE FUNCTION public.reject_employment_payroll_tax_profile_mutation();

ALTER TABLE public.employment_payroll_tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_payroll_tax_profile_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY employment_payroll_tax_profiles_read ON public.employment_payroll_tax_profiles
  FOR SELECT TO authenticated
  USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'::text)
  );

CREATE POLICY employment_payroll_tax_profile_audit_read ON public.employment_payroll_tax_profile_audit
  FOR SELECT TO authenticated
  USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'::text)
  );

REVOKE INSERT, UPDATE, DELETE ON public.employment_payroll_tax_profiles FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.employment_payroll_tax_profile_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.employment_payroll_tax_profiles TO authenticated;
GRANT SELECT ON public.employment_payroll_tax_profile_audit TO authenticated;
GRANT SELECT ON public.employment_payroll_tax_profiles, public.employment_payroll_tax_profile_audit TO service_role;
REVOKE ALL ON FUNCTION public.reject_employment_payroll_tax_profile_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.confirm_employment_payroll_tax_profile(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_employee_id uuid;
  v_employment_id uuid;
  v_income_relationship_id uuid;
  v_income_link_id uuid;
  v_effective_from date;
  v_effective_to date;
  v_credit_applies boolean;
  v_source_reference text;
  v_idempotency_key uuid;
  v_employment public.employments%ROWTYPE;
  v_income public.income_relationships%ROWTYPE;
  v_previous public.employment_payroll_tax_profiles%ROWTYPE;
  v_existing public.employment_payroll_tax_profiles%ROWTYPE;
  v_profile public.employment_payroll_tax_profiles%ROWTYPE;
  v_version integer;
  v_duplicate_credit boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR (p_input - 'employee_id' - 'employment_id' - 'income_relationship_id' - 'effective_from'
      - 'effective_to' - 'payroll_tax_credit_applies' - 'source_reference' - 'idempotency_key') <> '{}'::jsonb THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_employee_id := NULLIF(p_input ->> 'employee_id', '')::uuid;
  v_employment_id := NULLIF(p_input ->> 'employment_id', '')::uuid;
  v_income_relationship_id := NULLIF(p_input ->> 'income_relationship_id', '')::uuid;
  v_effective_from := NULLIF(p_input ->> 'effective_from', '')::date;
  v_effective_to := NULLIF(p_input ->> 'effective_to', '')::date;
  v_credit_applies := (p_input ->> 'payroll_tax_credit_applies')::boolean;
  v_source_reference := NULLIF(btrim(p_input ->> 'source_reference'), '');
  v_idempotency_key := NULLIF(p_input ->> 'idempotency_key', '')::uuid;

  IF v_employee_id IS NULL OR v_employment_id IS NULL OR v_income_relationship_id IS NULL
    OR v_effective_from IS NULL OR v_credit_applies IS NULL OR v_source_reference IS NULL
    OR char_length(v_source_reference) > 160 OR v_source_reference ~ '[[:cntrl:]]'
    OR v_idempotency_key IS NULL OR (v_effective_to IS NOT NULL AND v_effective_to < v_effective_from) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT employment.* INTO v_employment
  FROM public.employments AS employment
  WHERE employment.id = v_employment_id
    AND employment.employee_id = v_employee_id
    AND employment.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_EMPLOYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT internal_security.has_hr_group_access(v_employment.tenant_id, v_employment.hr_group_id)
    OR NOT internal_security.current_user_has_permission(v_employment.tenant_id, v_employment.administration_id, 'salary:write'::text)
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_access AS assignment
      JOIN public.management_roles AS role ON role.id = assignment.management_role_id
      WHERE assignment.user_id = v_actor
        AND assignment.tenant_id = v_employment.tenant_id
        AND assignment.is_active
        AND (
          (assignment.scope_type = 'TENANT' AND assignment.administration_id IS NULL)
          OR (assignment.scope_type = 'ADMINISTRATION' AND assignment.administration_id = v_employment.administration_id)
        )
        AND (role.tenant_id IS NULL OR role.tenant_id = v_employment.tenant_id)
        AND role.code IN ('HR_ADMIN', 'TENANT_ADMIN')
    ) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_employment.record_status <> 'CONFIRMED'
    OR v_effective_from < v_employment.starts_on
    OR (v_employment.ends_on IS NOT NULL AND (v_effective_to IS NULL OR v_effective_to > v_employment.ends_on)) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_EMPLOYMENT_PERIOD_INVALID' USING ERRCODE = '23514';
  END IF;

  -- Serialize confirmations across every employment/IKV for this employee in
  -- the administration. A per-employment row lock would let parallel changes
  -- enable wage-tax credit twice on separate income relationships.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payroll-tax-credit:' || v_employment.tenant_id::text || ':'
      || v_employment.administration_id::text || ':' || v_employee_id::text,
    0
  ));

  SELECT income.* INTO v_income
  FROM public.income_relationships AS income
  WHERE income.id = v_income_relationship_id
    AND income.tenant_id = v_employment.tenant_id
    AND income.administration_id = v_employment.administration_id
    AND income.employee_id = v_employee_id
    AND income.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_IKV_INVALID' USING ERRCODE = '23503';
  END IF;
  IF v_income.relationship_type <> 'EMPLOYMENT'
    OR v_income.reporting_status = 'DRAFT'
    OR v_effective_from < v_income.starts_on
    OR (v_income.ends_on IS NOT NULL AND (v_effective_to IS NULL OR v_effective_to > v_income.ends_on)) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_IKV_NOT_READY' USING ERRCODE = '23514';
  END IF;

  SELECT link.id INTO v_income_link_id
  FROM public.employment_income_relationships AS link
  WHERE link.tenant_id = v_employment.tenant_id
    AND link.administration_id = v_employment.administration_id
    AND link.employee_id = v_employee_id
    AND link.employment_id = v_employment_id
    AND link.income_relationship_id = v_income_relationship_id
    AND link.valid_from <= v_effective_from
    AND (link.valid_until IS NULL OR link.valid_until > v_effective_from)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_IKV_LINK_INVALID' USING ERRCODE = '23503';
  END IF;

  SELECT profile.* INTO v_existing
  FROM public.employment_payroll_tax_profiles AS profile
  WHERE profile.tenant_id = v_employment.tenant_id
    AND profile.hr_group_id = v_employment.hr_group_id
    AND profile.administration_id = v_employment.administration_id
    AND profile.idempotency_key = v_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.employee_id <> v_employee_id
      OR v_existing.employment_id <> v_employment_id
      OR v_existing.income_relationship_id <> v_income_relationship_id
      OR v_existing.effective_from <> v_effective_from
      OR v_existing.effective_to IS DISTINCT FROM v_effective_to
      OR v_existing.payroll_tax_credit_applies <> v_credit_applies
      OR v_existing.source_reference <> v_source_reference THEN
      RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('profile_id', v_existing.id, 'version_number', v_existing.version_number, 'reused', true);
  END IF;

  SELECT profile.* INTO v_previous
  FROM public.employment_payroll_tax_profiles AS profile
  WHERE profile.tenant_id = v_employment.tenant_id
    AND profile.hr_group_id = v_employment.hr_group_id
    AND profile.administration_id = v_employment.administration_id
    AND profile.employment_id = v_employment_id
    AND profile.income_relationship_id = v_income_relationship_id
  ORDER BY profile.effective_from DESC, profile.version_number DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    IF v_effective_from < v_previous.effective_from THEN
      RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_BACKDATED_CHANGE_UNSUPPORTED' USING ERRCODE = '23514';
    END IF;
    v_version := v_previous.version_number + 1;
  ELSE
    v_version := 1;
  END IF;

  IF v_credit_applies THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.employment_payroll_tax_profiles AS profile
      WHERE profile.tenant_id = v_employment.tenant_id
        AND profile.hr_group_id = v_employment.hr_group_id
        AND profile.administration_id = v_employment.administration_id
        AND profile.employee_id = v_employee_id
        AND profile.income_relationship_id <> v_income_relationship_id
        AND profile.payroll_tax_credit_applies
        AND profile.effective_from <= v_effective_from
        AND (profile.effective_to IS NULL OR profile.effective_to >= v_effective_from)
        AND NOT EXISTS (
          SELECT 1
          FROM public.employment_payroll_tax_profiles AS newer
          WHERE newer.tenant_id = profile.tenant_id
            AND newer.hr_group_id = profile.hr_group_id
            AND newer.administration_id = profile.administration_id
            AND newer.income_relationship_id = profile.income_relationship_id
            AND newer.effective_from <= v_effective_from
            AND (newer.effective_from > profile.effective_from
              OR (newer.effective_from = profile.effective_from AND newer.version_number > profile.version_number))
        )
    ) INTO v_duplicate_credit;
    IF v_duplicate_credit THEN
      RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_CREDIT_ALREADY_APPLIES' USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.employment_payroll_tax_profiles (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    income_relationship_id, employment_income_relationship_id, residence_country_code,
    wage_tax_table, herleiding_code, time_period, regular_wage_only, full_period_only,
    has_special_situation, payroll_tax_credit_applies, source_classification, source_reference,
    effective_from, effective_to, version_number, supersedes_profile_id, idempotency_key,
    confirmed_by_user_id
  ) VALUES (
    v_employment.tenant_id, v_employment.hr_group_id, v_employment.administration_id, v_employee_id, v_employment_id,
    v_income_relationship_id, v_income_link_id, 'NL', 'WHITE', 'STD', 'MONTH', true, true,
    false, v_credit_applies, 'EMPLOYEE_DECLARATION', v_source_reference,
    v_effective_from, v_effective_to, v_version, v_previous.id, v_idempotency_key, v_actor
  ) RETURNING * INTO v_profile;

  INSERT INTO public.employment_payroll_tax_profile_audit (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    income_relationship_id, tax_profile_id, actor_user_id, request_key, action, audit_payload
  ) VALUES (
    v_employment.tenant_id, v_employment.hr_group_id, v_employment.administration_id, v_employee_id, v_employment_id,
    v_income_relationship_id, v_profile.id, v_actor, v_idempotency_key, 'HR_ADMIN_CONFIRMED',
    jsonb_build_object(
      'versionNumber', v_version,
      'supersedesProfileId', v_previous.id,
      'effectiveFrom', v_effective_from,
      'effectiveTo', v_effective_to,
      'residenceCountryCode', 'NL',
      'wageTaxTable', 'WHITE',
      'herleiding', 'STD',
      'timePeriod', 'MONTH',
      'payrollTaxCreditApplies', v_credit_applies,
      'sourceClassification', 'EMPLOYEE_DECLARATION',
      'sourceReference', v_source_reference
    )
  );

  RETURN jsonb_build_object('profile_id', v_profile.id, 'version_number', v_profile.version_number, 'reused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_employment_payroll_tax_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_employment_payroll_tax_profile(jsonb) TO authenticated;

COMMENT ON TABLE public.employment_payroll_tax_profiles IS
  'Immutable HR-admin-confirmed fiscal inputs, scoped to one employment/IKV and limited to NL white-table standard monthly regular full-period wages.';
COMMENT ON TABLE public.employment_payroll_tax_profile_audit IS
  'Append-only confirmation audit for Core employment payroll tax profiles.';

COMMIT;
