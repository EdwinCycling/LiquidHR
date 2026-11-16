-- The write RPC intentionally uses SECURITY DEFINER only to keep direct table
-- writes unavailable to authenticated clients. It derives scope from the
-- predecessor and rechecks the actor, HR group and pension:manage permission.
CREATE OR REPLACE FUNCTION public.create_pension_arrangement_successor(
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
  v_arrangement_scope record;
  v_new_id uuid := gen_random_uuid();
  v_effective_from date;
  v_effective_to date;
  v_transition_date date;
  v_arrangement_type text;
  v_grandfathering_mode text;
  v_flat_total_rate numeric(7, 4);
  v_employer_share_pct numeric(7, 4);
  v_employee_share_pct numeric(7, 4);
  v_annual_franchise numeric(12, 2);
  v_annual_pensionable_salary_cap numeric(12, 2);
  v_contract_classification text;
  v_classification_provenance jsonb;
  v_eligibility_rule jsonb;
  v_tiers jsonb;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_successor IS NULL OR jsonb_typeof(p_successor) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT parent.* INTO v_parent
  FROM public.pension_arrangement_versions AS parent
  WHERE parent.id = p_predecessor_version_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_PREDECESSOR_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT internal_security.has_hr_group_access(v_parent.tenant_id, v_parent.hr_group_id)
    OR NOT internal_security.current_user_has_permission(v_parent.tenant_id, v_parent.administration_id, 'pension:manage'::text) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT arrangement.id, arrangement.tenant_id, arrangement.hr_group_id, arrangement.administration_id
    INTO v_arrangement_scope
  FROM public.pension_arrangements AS arrangement
  WHERE arrangement.id = v_parent.pension_arrangement_id
    AND arrangement.tenant_id = v_parent.tenant_id
    AND arrangement.hr_group_id = v_parent.hr_group_id
    AND arrangement.administration_id = v_parent.administration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SCOPE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pension_arrangement_versions AS child
    WHERE child.supersedes_version_id = v_parent.id
  ) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_PREDECESSOR_ALREADY_SUPERSEDED' USING ERRCODE = '23505';
  END IF;

  v_effective_from := (p_successor ->> 'effective_from')::date;
  v_effective_to := NULLIF(p_successor ->> 'effective_to', '')::date;
  v_arrangement_type := p_successor ->> 'arrangement_type';
  v_transition_date := NULLIF(p_successor ->> 'transition_date', '')::date;
  v_grandfathering_mode := p_successor ->> 'grandfathering_mode';
  v_flat_total_rate := NULLIF(p_successor ->> 'flat_total_rate', '')::numeric(7, 4);
  v_employer_share_pct := (p_successor ->> 'employer_share_pct')::numeric(7, 4);
  v_employee_share_pct := (p_successor ->> 'employee_share_pct')::numeric(7, 4);
  v_annual_franchise := (p_successor ->> 'annual_franchise')::numeric(12, 2);
  v_annual_pensionable_salary_cap := NULLIF(p_successor ->> 'annual_pensionable_salary_cap', '')::numeric(12, 2);
  v_contract_classification := coalesce(p_successor ->> 'contract_classification', 'UNKNOWN');
  v_classification_provenance := coalesce(p_successor -> 'contract_classification_provenance', '{"status":"UNVERIFIED"}'::jsonb);
  v_eligibility_rule := coalesce(p_successor -> 'eligibility_rule', '{}'::jsonb);
  v_tiers := p_successor -> 'tiers';
  v_reason := NULLIF(btrim(p_successor ->> 'supersession_reason'), '');

  IF v_effective_from IS NULL OR v_effective_from < v_parent.effective_from
    OR (v_effective_to IS NOT NULL AND v_effective_to < v_effective_from)
    OR v_arrangement_type IS DISTINCT FROM 'FLAT_PREMIUM' AND v_arrangement_type IS DISTINCT FROM 'PROGRESSIVE_PREMIUM'
    OR v_grandfathering_mode IS DISTINCT FROM 'NONE' AND v_grandfathering_mode IS DISTINCT FROM 'EERBIEDIGENDE_WERKING'
    OR v_contract_classification IS DISTINCT FROM 'SOLIDARITY' AND v_contract_classification IS DISTINCT FROM 'NON_SOLIDARITY' AND v_contract_classification IS DISTINCT FROM 'UNKNOWN'
    OR v_reason IS NULL
    OR jsonb_typeof(v_classification_provenance) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_eligibility_rule) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_successor -> 'pensionable_salary_definition') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_successor -> 'provenance_json') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_successor -> 'supersession_provenance') IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_tiers) IS DISTINCT FROM 'array'
    OR v_employer_share_pct IS NULL OR v_employer_share_pct < 0 OR v_employer_share_pct > 100
    OR v_employee_share_pct IS NULL OR v_employee_share_pct < 0 OR v_employee_share_pct > 100
    OR v_annual_franchise IS NULL OR v_annual_franchise < 0
    OR (v_annual_pensionable_salary_cap IS NOT NULL AND v_annual_pensionable_salary_cap < 0)
    OR abs((v_employer_share_pct + v_employee_share_pct) - 100.0000) >= 0.0001 THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_arrangement_type = 'FLAT_PREMIUM'
    AND (v_flat_total_rate IS NULL OR v_flat_total_rate < 0 OR jsonb_array_length(v_tiers) <> 0) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_FLAT_RATE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_arrangement_type = 'PROGRESSIVE_PREMIUM'
    AND (v_flat_total_rate IS NOT NULL OR jsonb_array_length(v_tiers) = 0) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_TIERS_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_arrangement_type = 'PROGRESSIVE_PREMIUM'
    AND v_grandfathering_mode = 'EERBIEDIGENDE_WERKING'
    AND v_contract_classification <> 'NON_SOLIDARITY' THEN
    RAISE EXCEPTION 'PENSION_GRANDFATHERING_CONTRACT_CLASSIFICATION_UNPROVEN' USING ERRCODE = '22023';
  END IF;
  IF v_arrangement_type = 'PROGRESSIVE_PREMIUM'
    AND (v_grandfathering_mode <> 'EERBIEDIGENDE_WERKING'
      OR v_transition_date IS NULL
      OR v_eligibility_rule ->> 'participantGroup' IS DISTINCT FROM 'GRANDFATHERED'
      OR v_eligibility_rule ->> 'transitionMethod' IS DISTINCT FROM 'EERBIEDIGENDE_WERKING'
      OR NULLIF(v_eligibility_rule ->> 'participationStartBefore', '')::date IS DISTINCT FROM v_transition_date) THEN
    RAISE EXCEPTION 'PENSION_GRANDFATHERING_ELIGIBILITY_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_contract_classification = 'NON_SOLIDARITY'
    AND NULLIF(btrim(v_classification_provenance ->> 'status'), '') IS NULL THEN
    RAISE EXCEPTION 'PENSION_CONTRACT_CLASSIFICATION_PROVENANCE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_contract_classification = 'NON_SOLIDARITY'
    AND v_classification_provenance ->> 'status' = 'VERIFIED_SOURCE'
    AND NULLIF(btrim(v_classification_provenance ->> 'sourceReference'), '') IS NULL THEN
    RAISE EXCEPTION 'PENSION_CONTRACT_CLASSIFICATION_SOURCE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_tiers) AS first_tier(min_age smallint, max_age smallint, total_rate numeric)
    JOIN jsonb_to_recordset(v_tiers) AS second_tier(min_age smallint, max_age smallint, total_rate numeric)
      ON (first_tier.min_age < second_tier.min_age
        OR (first_tier.min_age = second_tier.min_age AND first_tier.max_age < second_tier.max_age))
      AND second_tier.min_age <= first_tier.max_age
    WHERE first_tier.min_age IS NULL OR first_tier.max_age IS NULL OR first_tier.total_rate IS NULL
  ) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_TIER_OVERLAP' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_tiers) AS tier(min_age smallint, max_age smallint, total_rate numeric)
    WHERE tier.min_age IS NULL OR tier.max_age IS NULL OR tier.total_rate IS NULL
      OR tier.min_age < 0 OR tier.max_age < tier.min_age OR tier.total_rate < 0
  ) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_SUCCESSOR_TIER_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pension_arrangement_versions (
    id, tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    version_number, supersedes_version_id, code, name, arrangement_type,
    effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate,
    employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap,
    pensionable_salary_definition, eligibility_rule, contract_classification,
    contract_classification_provenance, provenance_json, is_active, supersession_reason,
    supersession_provenance, created_by_user_id
  ) VALUES (
    v_new_id, v_parent.tenant_id, v_parent.hr_group_id, v_parent.administration_id,
    v_parent.pension_arrangement_id, v_parent.version_number + 1, v_parent.id,
    v_parent.code, v_parent.name, v_arrangement_type, v_effective_from, v_effective_to,
    v_transition_date, v_grandfathering_mode, v_flat_total_rate,
    v_employer_share_pct, v_employee_share_pct, v_annual_franchise, v_annual_pensionable_salary_cap,
    p_successor -> 'pensionable_salary_definition',
    v_eligibility_rule || jsonb_build_object(
      'contractClassification', v_contract_classification,
      'contractClassificationProvenance', v_classification_provenance
    ),
    v_contract_classification, v_classification_provenance,
    p_successor -> 'provenance_json', coalesce((p_successor ->> 'is_active')::boolean, true),
    v_reason, p_successor -> 'supersession_provenance', v_actor
  );

  INSERT INTO public.pension_arrangement_version_tiers (
    tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    pension_arrangement_version_id, min_age, max_age, total_rate
  )
  SELECT v_parent.tenant_id, v_parent.hr_group_id, v_parent.administration_id,
    v_parent.pension_arrangement_id, v_new_id, tier.min_age, tier.max_age, tier.total_rate
  FROM jsonb_to_recordset(v_tiers) AS tier(min_age smallint, max_age smallint, total_rate numeric);

  INSERT INTO public.pension_arrangement_version_audit (
    tenant_id, hr_group_id, administration_id, pension_arrangement_id,
    pension_arrangement_version_id, supersedes_version_id, event_type,
    actor_user_id, reason, provenance_json
  ) VALUES (
    v_parent.tenant_id, v_parent.hr_group_id, v_parent.administration_id,
    v_parent.pension_arrangement_id, v_new_id, v_parent.id, 'SUCCESSOR_CREATED',
    v_actor, v_reason, p_successor -> 'supersession_provenance'
  );
  RETURN v_new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_pension_arrangement_successor(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pension_arrangement_successor(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_pension_arrangement_successor(uuid, jsonb) IS
  'Creates one explicit same-scope successor version and audit record after rechecking authenticated pension:manage permission.';
