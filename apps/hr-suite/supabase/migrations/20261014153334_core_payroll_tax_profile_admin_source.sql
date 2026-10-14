-- Permit HR-admin-recorded fiscal sources while keeping confirmed records immutable and scope-guarded.
-- V2 appends effective-dated versions; backdated corrections are recorded as new versions.
BEGIN;

ALTER TABLE public.employment_payroll_tax_profiles
  DROP CONSTRAINT employment_payroll_tax_profiles_source_classification_check;
ALTER TABLE public.employment_payroll_tax_profiles
  ADD CONSTRAINT employment_payroll_tax_profiles_source_classification_check
  CHECK (source_classification IN ('EMPLOYEE_DECLARATION', 'HR_ADMIN_CONFIRMED'));
CREATE FUNCTION public.confirm_employment_payroll_tax_profile_v2(p_input jsonb)
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
  v_source_classification text;
  v_idempotency_key uuid;
  v_employment public.employments%ROWTYPE;
  v_income public.income_relationships%ROWTYPE;
  v_income_link public.employment_income_relationships%ROWTYPE;
  v_previous public.employment_payroll_tax_profiles%ROWTYPE;
  v_existing public.employment_payroll_tax_profiles%ROWTYPE;
  v_profile public.employment_payroll_tax_profiles%ROWTYPE;
  v_version integer;
  v_duplicate_credit boolean;
  v_income_link_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR (p_input - 'employee_id' - 'employment_id' - 'income_relationship_id' - 'effective_from'
      - 'effective_to' - 'payroll_tax_credit_applies' - 'source_reference' - 'idempotency_key' - 'source_classification') <> '{}'::jsonb THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_employee_id := NULLIF(p_input ->> 'employee_id', '')::uuid;
  v_employment_id := NULLIF(p_input ->> 'employment_id', '')::uuid;
  v_income_relationship_id := NULLIF(p_input ->> 'income_relationship_id', '')::uuid;
  v_effective_from := NULLIF(p_input ->> 'effective_from', '')::date;
  v_effective_to := NULLIF(p_input ->> 'effective_to', '')::date;
  v_credit_applies := (p_input ->> 'payroll_tax_credit_applies')::boolean;
  v_source_reference := NULLIF(btrim(p_input ->> 'source_reference'), '');
  v_source_classification := NULLIF(p_input ->> 'source_classification', '');
  v_idempotency_key := NULLIF(p_input ->> 'idempotency_key', '')::uuid;

  IF v_employee_id IS NULL OR v_employment_id IS NULL OR v_income_relationship_id IS NULL
    OR v_effective_from IS NULL OR v_credit_applies IS NULL OR v_source_reference IS NULL
    OR char_length(v_source_reference) > 160 OR v_source_reference ~ '[[:cntrl:]]'
    OR v_source_reference ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    OR v_source_reference ~ '\m[0-9]{8,9}\M'
    OR v_source_reference ~* '\mNL[0-9]{2}[A-Z]{4}[0-9]{10}\M'
    OR v_source_classification IS NULL OR v_source_classification NOT IN ('EMPLOYEE_DECLARATION', 'HR_ADMIN_CONFIRMED')
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
        AND role.is_active
        AND role.deleted_at IS NULL
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

  SELECT count(*)::integer INTO v_income_link_count
  FROM public.employment_income_relationships AS link
  WHERE link.tenant_id = v_employment.tenant_id
    AND link.administration_id = v_employment.administration_id
    AND link.employee_id = v_employee_id
    AND link.employment_id = v_employment_id
    AND link.income_relationship_id = v_income_relationship_id
    AND link.valid_from <= v_effective_from
    AND (link.valid_until IS NULL OR link.valid_until > v_effective_from)
    AND (v_effective_to IS NOT NULL AND (link.valid_until IS NULL OR link.valid_until > v_effective_to)
      OR v_effective_to IS NULL AND link.valid_until IS NULL);
  IF v_income_link_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_IKV_LINK_INVALID' USING ERRCODE = '23503';
  END IF;
  SELECT link.* INTO v_income_link
  FROM public.employment_income_relationships AS link
  WHERE link.tenant_id = v_employment.tenant_id
    AND link.administration_id = v_employment.administration_id
    AND link.employee_id = v_employee_id
    AND link.employment_id = v_employment_id
    AND link.income_relationship_id = v_income_relationship_id
    AND link.valid_from <= v_effective_from
    AND (link.valid_until IS NULL OR link.valid_until > v_effective_from)
    AND (v_effective_to IS NOT NULL AND (link.valid_until IS NULL OR link.valid_until > v_effective_to)
      OR v_effective_to IS NULL AND link.valid_until IS NULL)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_IKV_LINK_INVALID' USING ERRCODE = '23503';
  END IF;
  v_income_link_id := v_income_link.id;

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
      OR v_existing.employment_income_relationship_id <> v_income_link_id
      OR v_existing.effective_from <> v_effective_from
      OR v_existing.effective_to IS DISTINCT FROM v_effective_to
      OR v_existing.payroll_tax_credit_applies <> v_credit_applies
      OR v_existing.source_reference <> v_source_reference
      OR v_existing.source_classification <> v_source_classification THEN
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
  ORDER BY profile.version_number DESC, profile.effective_from DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    v_version := v_previous.version_number + 1;
  ELSE
    v_version := 1;
  END IF;

  IF v_credit_applies THEN
    WITH latest_at_start AS (
      SELECT DISTINCT ON (profile.income_relationship_id, profile.effective_from) profile.*
      FROM public.employment_payroll_tax_profiles AS profile
      WHERE profile.tenant_id = v_employment.tenant_id
        AND profile.hr_group_id = v_employment.hr_group_id
        AND profile.administration_id = v_employment.administration_id
        AND profile.employee_id = v_employee_id
        AND profile.income_relationship_id <> v_income_relationship_id
      ORDER BY profile.income_relationship_id, profile.effective_from, profile.version_number DESC
    ), fiscal_slices AS (
      SELECT profile.income_relationship_id,
        profile.payroll_tax_credit_applies,
        profile.effective_from,
        CASE
          WHEN next_start IS NULL THEN profile.effective_to
          WHEN profile.effective_to IS NULL OR profile.effective_to >= next_start THEN next_start - 1
          ELSE profile.effective_to
        END AS effective_to
      FROM (
        SELECT latest.*, lead(latest.effective_from) OVER (
          PARTITION BY latest.income_relationship_id ORDER BY latest.effective_from
        ) AS next_start
        FROM latest_at_start AS latest
      ) AS profile
    )
    SELECT EXISTS (
      SELECT 1 FROM fiscal_slices AS slice
      WHERE slice.payroll_tax_credit_applies
        AND slice.effective_from <= coalesce(v_effective_to, 'infinity'::date)
        AND coalesce(slice.effective_to, 'infinity'::date) >= v_effective_from
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
    false, v_credit_applies, v_source_classification, v_source_reference,
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
      'sourceClassification', v_source_classification,
      'sourceReference', v_source_reference
    )
  );

  RETURN jsonb_build_object('profile_id', v_profile.id, 'version_number', v_profile.version_number, 'reused', false);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) TO authenticated;
COMMENT ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) IS
  'Creates immutable, scope-checked, effective-dated fiscal profile versions from verified HR administration sources.';

COMMIT;
