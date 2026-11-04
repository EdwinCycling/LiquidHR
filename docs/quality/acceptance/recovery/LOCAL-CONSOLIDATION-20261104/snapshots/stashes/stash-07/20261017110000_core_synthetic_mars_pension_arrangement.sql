-- Creates the one explicitly approved Mars TEST pension source used by the
-- earlier PAYFULL-02 DEMO-001 calculation. The route is intentionally narrow:
-- it accepts no caller-supplied rates or franchises and cannot run in
-- production. Employment assignments remain a separate explicit operation.

ALTER TABLE public.pension_arrangement_version_audit
  DROP CONSTRAINT IF EXISTS pension_arrangement_version_audit_event_type_check;

ALTER TABLE public.pension_arrangement_version_audit
  ADD CONSTRAINT pension_arrangement_version_audit_event_type_check
  CHECK (event_type IN ('BASELINE_MIGRATED', 'SUCCESSOR_CREATED', 'SYNTHETIC_TEST_CREATED'));

CREATE FUNCTION public.create_mars_payfull02_synthetic_pension_arrangement(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_employee_id uuid;
  v_employment_id uuid;
  v_request_key uuid;
  v_employment public.employments%ROWTYPE;
  v_arrangement public.pension_arrangements%ROWTYPE;
  v_version public.pension_arrangement_versions%ROWTYPE;
  v_arrangement_id uuid := gen_random_uuid();
  v_version_id uuid := gen_random_uuid();
  v_provenance jsonb := jsonb_build_object(
    'schemaVersion', 'PENSION_ARRANGEMENT_PROVENANCE_V1',
    'status', 'SYNTHETIC_TEST_FIXTURE',
    'sourceClassification', 'TEST_SETUP_PAYFULL_02',
    'sourceReference', 'Payroll Lab DEMO-001 run 731e2a73-af7c-59d6-af88-5d0455c68374',
    'legalFiscalStatus', 'OPEN',
    'legalFiscalGap', 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED',
    'requestKeySource', 'HR_ADMIN_SYNTHETIC_TEST_ROUTE'
  );
  v_salary_definition jsonb := jsonb_build_object(
    'annualization', '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
    'basis', 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE',
    'floorAtZero', true,
    'capAppliedBeforePartTimeFactor', true,
    'partTimeFactor', 'EMPLOYMENT_FTE',
    'shareRounding', 'HALF_UP_CENTS_PER_SHARE'
  );
  v_eligibility_rule jsonb := jsonb_build_object(
    'participantGroup', 'NEW_ENTRANT',
    'effectivePeriod', '2026'
  );
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PENSION_SYNTHETIC_ARRANGEMENT_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR p_input ->> 'scenario' IS DISTINCT FROM 'PAYFULL-02-DEMO-001-MARS'
    OR NOT (coalesce(p_input ->> 'request_key', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR NOT (coalesce(p_input ->> 'employee_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR NOT (coalesce(p_input ->> 'employment_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'PENSION_SYNTHETIC_ARRANGEMENT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  IF (auth.jwt() -> 'app_metadata' ->> 'liquidhr_pension_test_fixtures_enabled') IS DISTINCT FROM 'true'
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'liquidhr_pension_fixture_environment', '')
      NOT IN ('test', 'development', 'preview') THEN
    RAISE EXCEPTION 'PENSION_TEST_FIXTURE_DISABLED' USING ERRCODE = '42501';
  END IF;

  v_employee_id := (p_input ->> 'employee_id')::uuid;
  v_employment_id := (p_input ->> 'employment_id')::uuid;
  v_request_key := (p_input ->> 'request_key')::uuid;

  SELECT employment.* INTO v_employment
  FROM public.employments AS employment
  WHERE employment.id = v_employment_id
    AND employment.employee_id = v_employee_id
    AND employment.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PENSION_SYNTHETIC_ARRANGEMENT_EMPLOYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_employment.administration_id <> '2057f6ec-cd3e-3c28-9126-c41235d4ffae'::uuid
    OR NOT internal_security.has_hr_group_access(v_employment.tenant_id, v_employment.hr_group_id)
    OR NOT internal_security.current_user_has_permission(v_employment.tenant_id, v_employment.administration_id, 'pension:manage'::text) THEN
    RAISE EXCEPTION 'PENSION_SYNTHETIC_ARRANGEMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT arrangement.* INTO v_arrangement
  FROM public.pension_arrangements AS arrangement
  WHERE arrangement.tenant_id = v_employment.tenant_id
    AND arrangement.hr_group_id = v_employment.hr_group_id
    AND arrangement.administration_id = v_employment.administration_id
    AND arrangement.code = 'MARS-TEST-PAYFULL02-001'
  FOR UPDATE;
  IF FOUND THEN
    IF NOT v_arrangement.is_active
      OR v_arrangement.arrangement_type <> 'FLAT_PREMIUM'
      OR v_arrangement.effective_from <> '2026-01-01'::date
      OR v_arrangement.effective_to <> '2026-12-31'::date
      OR v_arrangement.flat_total_rate <> 25.0000
      OR v_arrangement.employer_share_pct <> 60.0000
      OR v_arrangement.employee_share_pct <> 40.0000
      OR v_arrangement.annual_franchise <> 19172.00
      OR v_arrangement.annual_pensionable_salary_cap <> 137800.00
      OR v_arrangement.provenance_json ->> 'sourceClassification' <> 'TEST_SETUP_PAYFULL_02' THEN
      RAISE EXCEPTION 'PENSION_SYNTHETIC_ARRANGEMENT_CONFLICT' USING ERRCODE = '23505';
    END IF;

    SELECT version.* INTO v_version
    FROM public.pension_arrangement_versions AS version
    WHERE version.pension_arrangement_id = v_arrangement.id
      AND version.version_number = 1
      AND version.is_active
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PENSION_SYNTHETIC_ARRANGEMENT_VERSION_MISSING' USING ERRCODE = '23503';
    END IF;

    RETURN jsonb_build_object(
      'arrangement_id', v_arrangement.id,
      'version_id', v_version.id,
      'version_number', v_version.version_number,
      'request_key', v_request_key,
      'arrangement_reused', true,
      'source_classification', 'TEST_SETUP_PAYFULL_02'
    );
  END IF;

  INSERT INTO public.pension_arrangements (
    id, tenant_id, hr_group_id, administration_id, code, name, arrangement_type,
    effective_from, effective_to, grandfathering_mode, flat_total_rate,
    employer_share_pct, employee_share_pct, annual_franchise,
    annual_pensionable_salary_cap, pensionable_salary_definition,
    eligibility_rule, provenance_json, is_active
  ) VALUES (
    v_arrangement_id, v_employment.tenant_id, v_employment.hr_group_id,
    v_employment.administration_id, 'MARS-TEST-PAYFULL02-001',
    'Mars synthetic flat pension — PAYFULL-02 TEST', 'FLAT_PREMIUM',
    '2026-01-01', '2026-12-31', 'NONE', 25.0000, 60.0000, 40.0000,
    19172.00, 137800.00, v_salary_definition, v_eligibility_rule,
    v_provenance, true
  )
  RETURNING * INTO v_arrangement;

  INSERT INTO public.pension_arrangement_versions (
    id, tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    version_number, supersedes_version_id, code, name, arrangement_type,
    effective_from, effective_to, transition_date, grandfathering_mode,
    flat_total_rate, employer_share_pct, employee_share_pct, annual_franchise,
    annual_pensionable_salary_cap, pensionable_salary_definition,
    eligibility_rule, contract_classification, contract_classification_provenance,
    provenance_json, is_active, supersession_reason, supersession_provenance,
    created_by_user_id
  ) VALUES (
    v_version_id, v_arrangement.tenant_id, v_arrangement.hr_group_id,
    v_arrangement.administration_id, v_arrangement.id, 1, NULL,
    v_arrangement.code, v_arrangement.name, v_arrangement.arrangement_type,
    v_arrangement.effective_from, v_arrangement.effective_to,
    v_arrangement.transition_date, v_arrangement.grandfathering_mode,
    v_arrangement.flat_total_rate, v_arrangement.employer_share_pct,
    v_arrangement.employee_share_pct, v_arrangement.annual_franchise,
    v_arrangement.annual_pensionable_salary_cap, v_salary_definition,
    v_eligibility_rule, 'UNKNOWN', jsonb_build_object('status', 'UNVERIFIED'),
    v_provenance, true, NULL, '{}'::jsonb, v_actor
  )
  RETURNING * INTO v_version;

  INSERT INTO public.pension_arrangement_version_audit (
    tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    pension_arrangement_version_id, supersedes_version_id, event_type,
    actor_user_id, reason, provenance_json
  ) VALUES (
    v_arrangement.tenant_id, v_arrangement.hr_group_id,
    v_arrangement.administration_id, v_arrangement.id, v_version.id, NULL,
    'SYNTHETIC_TEST_CREATED', v_actor,
    'Created the explicit Mars PAYFULL-02 DEMO-001 synthetic TEST source.',
    jsonb_build_object('requestKey', v_request_key, 'source', v_provenance)
  );

  RETURN jsonb_build_object(
    'arrangement_id', v_arrangement.id,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'request_key', v_request_key,
    'arrangement_reused', false,
    'source_classification', 'TEST_SETUP_PAYFULL_02'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_mars_payfull02_synthetic_pension_arrangement(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mars_payfull02_synthetic_pension_arrangement(jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.create_mars_payfull02_synthetic_pension_arrangement(jsonb) IS
  'Creates or reuses only the fixed Mars PAYFULL-02 synthetic TEST pension arrangement after scoped HR-admin and non-production checks.';
