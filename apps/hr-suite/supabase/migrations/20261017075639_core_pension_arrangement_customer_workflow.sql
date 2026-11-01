-- Adds the normal, administration-scoped customer workflow for creating a
-- pension arrangement and its immutable version-one snapshot. No synthetic
-- fixture claim or runtime flag is consulted by this workflow.

ALTER TABLE public.pension_arrangement_version_audit
  DROP CONSTRAINT IF EXISTS pension_arrangement_version_audit_event_type_check;

ALTER TABLE public.pension_arrangement_version_audit
  ADD CONSTRAINT pension_arrangement_version_audit_event_type_check CHECK (
    event_type IN ('BASELINE_MIGRATED', 'SUCCESSOR_CREATED', 'SYNTHETIC_TEST_CREATED', 'USER_CREATED')
  );

CREATE OR REPLACE FUNCTION public.create_pension_arrangement(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_hr_group_id uuid;
  v_administration_id uuid;
  v_arrangement_id uuid := gen_random_uuid();
  v_version_id uuid := gen_random_uuid();
  v_code text;
  v_name text;
  v_arrangement_type text;
  v_effective_from date;
  v_effective_to date;
  v_transition_date date;
  v_grandfathering_mode text;
  v_flat_total_rate numeric(7, 4);
  v_employer_share_pct numeric(7, 4);
  v_employee_share_pct numeric(7, 4);
  v_annual_franchise numeric(12, 2);
  v_annual_pensionable_salary_cap numeric(12, 2);
  v_pensionable_salary_definition jsonb;
  v_eligibility_rule jsonb;
  v_contract_classification text;
  v_classification_provenance jsonb;
  v_tiers jsonb;
  v_provenance jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_tenant_id := NULLIF(p_input ->> 'tenant_id', '')::uuid;
  v_hr_group_id := NULLIF(p_input ->> 'hr_group_id', '')::uuid;
  v_administration_id := NULLIF(p_input ->> 'administration_id', '')::uuid;
  v_code := NULLIF(btrim(p_input ->> 'code'), '');
  v_name := NULLIF(btrim(p_input ->> 'name'), '');
  v_arrangement_type := p_input ->> 'arrangement_type';
  v_effective_from := NULLIF(p_input ->> 'effective_from', '')::date;
  v_effective_to := NULLIF(p_input ->> 'effective_to', '')::date;
  v_transition_date := NULLIF(p_input ->> 'transition_date', '')::date;
  v_grandfathering_mode := coalesce(NULLIF(p_input ->> 'grandfathering_mode', ''), 'NONE');
  v_flat_total_rate := NULLIF(p_input ->> 'flat_total_rate', '')::numeric(7, 4);
  v_employer_share_pct := NULLIF(p_input ->> 'employer_share_pct', '')::numeric(7, 4);
  v_employee_share_pct := NULLIF(p_input ->> 'employee_share_pct', '')::numeric(7, 4);
  v_annual_franchise := NULLIF(p_input ->> 'annual_franchise', '')::numeric(12, 2);
  v_annual_pensionable_salary_cap := NULLIF(p_input ->> 'annual_pensionable_salary_cap', '')::numeric(12, 2);
  v_pensionable_salary_definition := coalesce(p_input -> 'pensionable_salary_definition', '{}'::jsonb);
  v_eligibility_rule := coalesce(p_input -> 'eligibility_rule', '{}'::jsonb);
  v_contract_classification := coalesce(NULLIF(p_input ->> 'contract_classification', ''), 'UNKNOWN');
  v_classification_provenance := coalesce(p_input -> 'contract_classification_provenance', '{"status":"UNVERIFIED"}'::jsonb);
  v_tiers := coalesce(p_input -> 'tiers', '[]'::jsonb);

  IF v_tenant_id IS NULL OR v_hr_group_id IS NULL OR v_administration_id IS NULL
    OR v_code IS NULL OR char_length(v_code) > 80 OR v_name IS NULL OR char_length(v_name) > 180
    OR v_arrangement_type NOT IN ('FLAT_PREMIUM', 'PROGRESSIVE_PREMIUM')
    OR v_effective_from IS NULL OR (v_effective_to IS NOT NULL AND v_effective_to < v_effective_from)
    OR v_grandfathering_mode NOT IN ('NONE', 'EERBIEDIGENDE_WERKING')
    OR v_contract_classification NOT IN ('SOLIDARITY', 'NON_SOLIDARITY', 'UNKNOWN')
    OR jsonb_typeof(v_pensionable_salary_definition) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_eligibility_rule) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_classification_provenance) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_tiers) IS DISTINCT FROM 'array'
    OR v_employer_share_pct IS NULL OR v_employer_share_pct < 0 OR v_employer_share_pct > 100
    OR v_employee_share_pct IS NULL OR v_employee_share_pct < 0 OR v_employee_share_pct > 100
    OR abs((v_employer_share_pct + v_employee_share_pct) - 100.0000) >= 0.0001
    OR v_annual_franchise IS NULL OR v_annual_franchise < 0
    OR (v_annual_pensionable_salary_cap IS NOT NULL AND v_annual_pensionable_salary_cap < 0)
    OR (v_arrangement_type = 'FLAT_PREMIUM' AND (v_flat_total_rate IS NULL OR v_flat_total_rate < 0 OR jsonb_array_length(v_tiers) <> 0))
    OR (v_arrangement_type = 'PROGRESSIVE_PREMIUM' AND (v_flat_total_rate IS NOT NULL OR jsonb_array_length(v_tiers) = 0))
    OR (v_contract_classification = 'NON_SOLIDARITY' AND NULLIF(btrim(v_classification_provenance ->> 'status'), '') IS NULL) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_arrangement_type = 'PROGRESSIVE_PREMIUM'
    AND v_grandfathering_mode = 'EERBIEDIGENDE_WERKING'
    AND v_contract_classification <> 'NON_SOLIDARITY' THEN
    RAISE EXCEPTION 'PENSION_GRANDFATHERING_CONTRACT_CLASSIFICATION_UNPROVEN' USING ERRCODE = '22023';
  END IF;
  IF NOT internal_security.has_hr_group_access(v_tenant_id, v_hr_group_id)
    OR NOT internal_security.current_user_has_permission(v_tenant_id, v_administration_id, 'pension:manage'::text) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.administrations AS administration
    WHERE administration.id = v_administration_id
      AND administration.tenant_id = v_tenant_id
      AND administration.hr_group_id = v_hr_group_id
      AND administration.is_active
  ) THEN
    RAISE EXCEPTION 'PENSION_ADMINISTRATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_provenance := jsonb_build_object(
    'schemaVersion', 'PENSION_ARRANGEMENT_PROVENANCE_V1',
    'status', 'USER_RECORDED',
    'sourceClassification', 'CORE_PENSION_ARRANGEMENT_WORKFLOW',
    'parameterOrigin', 'EMPLOYER_PROVIDED',
    'source', 'Explicit HR-admin pension arrangement workflow in Core.',
    'legalFiscalStatus', 'OPEN',
    'legalFiscalGap', 'PENSION_LEGAL_FISCAL_TREATMENT_UNVERIFIED'
  );

  INSERT INTO public.pension_arrangements (
    id, tenant_id, hr_group_id, administration_id, code, name, arrangement_type,
    effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate,
    employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap,
    pensionable_salary_definition, eligibility_rule, provenance_json, is_active
  ) VALUES (
    v_arrangement_id, v_tenant_id, v_hr_group_id, v_administration_id, v_code, v_name,
    v_arrangement_type, v_effective_from, v_effective_to, v_transition_date,
    v_grandfathering_mode, v_flat_total_rate, v_employer_share_pct, v_employee_share_pct,
    v_annual_franchise, v_annual_pensionable_salary_cap, v_pensionable_salary_definition,
    v_eligibility_rule, v_provenance, true
  );

  INSERT INTO public.pension_arrangement_versions (
    id, tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    version_number, supersedes_version_id, code, name, arrangement_type,
    effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate,
    employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap,
    pensionable_salary_definition, eligibility_rule, contract_classification,
    contract_classification_provenance, provenance_json, is_active,
    supersession_reason, supersession_provenance, created_by_user_id
  ) VALUES (
    v_version_id, v_tenant_id, v_hr_group_id, v_administration_id, v_arrangement_id,
    1, NULL, v_code, v_name, v_arrangement_type, v_effective_from, v_effective_to,
    v_transition_date, v_grandfathering_mode, v_flat_total_rate, v_employer_share_pct,
    v_employee_share_pct, v_annual_franchise, v_annual_pensionable_salary_cap,
    v_pensionable_salary_definition,
    v_eligibility_rule || jsonb_build_object(
      'contractClassification', v_contract_classification,
      'contractClassificationProvenance', v_classification_provenance
    ),
    v_contract_classification, v_classification_provenance, v_provenance, true,
    NULL, '{}'::jsonb, v_actor
  );

  INSERT INTO public.pension_arrangement_version_tiers (
    tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    pension_arrangement_version_id, min_age, max_age, total_rate
  )
  SELECT v_tenant_id, v_hr_group_id, v_administration_id, v_arrangement_id,
    v_version_id, tier.min_age, tier.max_age, tier.total_rate
  FROM jsonb_to_recordset(v_tiers) AS tier(min_age smallint, max_age smallint, total_rate numeric);

  INSERT INTO public.pension_arrangement_version_audit (
    tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    pension_arrangement_version_id, supersedes_version_id, event_type,
    actor_user_id, reason, provenance_json
  ) VALUES (
    v_tenant_id, v_hr_group_id, v_administration_id, v_arrangement_id,
    v_version_id, NULL, 'USER_CREATED', v_actor,
    'Initial version created through the normal HR-admin pension arrangement workflow.',
    v_provenance
  );

  INSERT INTO public.audit_logs (tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes)
  VALUES (
    v_tenant_id, v_administration_id, 'pension_arrangements', v_arrangement_id, v_actor, 'CREATE',
    jsonb_build_object(
      'code', v_code, 'name', v_name, 'version_number', 1,
      'effective_from', v_effective_from, 'effective_to', v_effective_to,
      'sourceClassification', 'CORE_PENSION_ARRANGEMENT_WORKFLOW',
      'parameterOrigin', 'EMPLOYER_PROVIDED'
    )
  );

  RETURN jsonb_build_object(
    'arrangement_id', v_arrangement_id,
    'version_id', v_version_id,
    'version_number', 1,
    'source_classification', 'CORE_PENSION_ARRANGEMENT_WORKFLOW'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_pension_arrangement(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pension_arrangement(jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_pension_arrangement(jsonb) IS
  'Creates one administration-scoped employer-recorded pension arrangement, immutable version one, tiers and audit rows. It never consults synthetic fixture claims.';

-- The historical successor RPC predates the dedicated pension:manage
-- permission and checks contract:write internally. Keep it private and expose
-- a pension-scoped wrapper for the normal product workflow.
CREATE FUNCTION public.create_pension_arrangement_successor_for_pension_manager(
  p_predecessor_version_id uuid,
  p_successor jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_parent public.pension_arrangement_versions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT parent.* INTO v_parent
  FROM public.pension_arrangement_versions AS parent
  WHERE parent.id = p_predecessor_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_PREDECESSOR_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT internal_security.has_hr_group_access(v_parent.tenant_id, v_parent.hr_group_id)
    OR NOT internal_security.current_user_has_permission(v_parent.tenant_id, v_parent.administration_id, 'pension:manage'::text) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN public.create_pension_arrangement_successor(p_predecessor_version_id, p_successor);
END;
$$;

REVOKE ALL ON FUNCTION public.create_pension_arrangement_successor(uuid, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.create_pension_arrangement_successor_for_pension_manager(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pension_arrangement_successor_for_pension_manager(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_pension_arrangement_successor_for_pension_manager(uuid, jsonb) IS
  'Pension-scoped wrapper around the immutable successor workflow; requires pension:manage and exact HR-group access.';
