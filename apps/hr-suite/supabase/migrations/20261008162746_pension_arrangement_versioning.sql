-- Effective-dated, immutable pension arrangement versions.
-- Existing employment assignments continue to point at pension_arrangements.id;
-- source projection resolves that stable identity to one explicit version.

-- Supports a composite scope foreign key without changing the base table's
-- existing RLS policies or privileges. The primary key already guarantees
-- that this key cannot reveal or merge a second arrangement row.
ALTER TABLE public.pension_arrangements
  ADD CONSTRAINT pension_arrangements_id_scope_key
  UNIQUE (id, tenant_id, hr_group_id, administration_id);

CREATE TABLE public.pension_arrangement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  pension_arrangement_id uuid NOT NULL REFERENCES public.pension_arrangements(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  supersedes_version_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  arrangement_type text NOT NULL CHECK (arrangement_type IN ('FLAT_PREMIUM', 'PROGRESSIVE_PREMIUM')),
  effective_from date NOT NULL,
  effective_to date,
  transition_date date,
  grandfathering_mode text NOT NULL CHECK (grandfathering_mode IN ('NONE', 'EERBIEDIGENDE_WERKING')),
  flat_total_rate numeric(7, 4),
  employer_share_pct numeric(7, 4) NOT NULL,
  employee_share_pct numeric(7, 4) NOT NULL,
  annual_franchise numeric(12, 2) NOT NULL,
  annual_pensionable_salary_cap numeric(12, 2),
  pensionable_salary_definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(pensionable_salary_definition) = 'object'),
  eligibility_rule jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(eligibility_rule) = 'object'),
  contract_classification text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (contract_classification IN ('SOLIDARITY', 'NON_SOLIDARITY', 'UNKNOWN')),
  contract_classification_provenance jsonb NOT NULL DEFAULT '{"status":"UNVERIFIED"}'::jsonb
    CHECK (jsonb_typeof(contract_classification_provenance) = 'object'),
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance_json) = 'object'),
  is_active boolean NOT NULL DEFAULT true,
  supersession_reason text,
  supersession_provenance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(supersession_provenance) = 'object'),
  created_by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pension_arrangement_versions_effective_dates_chk
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT pension_arrangement_versions_flat_rate_chk CHECK (
    (arrangement_type = 'FLAT_PREMIUM' AND flat_total_rate IS NOT NULL AND flat_total_rate >= 0)
    OR (arrangement_type = 'PROGRESSIVE_PREMIUM' AND flat_total_rate IS NULL)
  ),
  CONSTRAINT pension_arrangement_versions_split_chk
    CHECK (abs((employer_share_pct + employee_share_pct) - 100.0000) < 0.0001),
  CONSTRAINT pension_arrangement_versions_lineage_chk CHECK (
    (version_number = 1 AND supersedes_version_id IS NULL AND supersession_reason IS NULL)
    OR (version_number > 1 AND supersedes_version_id IS NOT NULL AND length(btrim(supersession_reason)) > 0)
  ),
  CONSTRAINT pension_arrangement_versions_arrangement_scope_fk
    FOREIGN KEY (pension_arrangement_id, tenant_id, hr_group_id, administration_id)
    REFERENCES public.pension_arrangements(id, tenant_id, hr_group_id, administration_id),
  CONSTRAINT pension_arrangement_versions_id_scope_key
    UNIQUE (id, tenant_id, hr_group_id, administration_id, pension_arrangement_id),
  CONSTRAINT pension_arrangement_versions_number_key UNIQUE (pension_arrangement_id, version_number),
  CONSTRAINT pension_arrangement_versions_successor_key UNIQUE (supersedes_version_id),
  CONSTRAINT pension_arrangement_versions_parent_scope_fk
    FOREIGN KEY (supersedes_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id)
    REFERENCES public.pension_arrangement_versions(id, tenant_id, hr_group_id, administration_id, pension_arrangement_id)
);

CREATE TABLE public.pension_arrangement_version_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  pension_arrangement_id uuid NOT NULL,
  pension_arrangement_version_id uuid NOT NULL,
  min_age smallint NOT NULL,
  max_age smallint NOT NULL,
  total_rate numeric(7, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pension_arrangement_version_tiers_age_chk CHECK (min_age >= 0 AND max_age >= min_age),
  CONSTRAINT pension_arrangement_version_tiers_rate_chk CHECK (total_rate >= 0),
  CONSTRAINT pension_arrangement_version_tiers_unique_band
    UNIQUE (pension_arrangement_version_id, min_age, max_age),
  CONSTRAINT pension_arrangement_version_tiers_scope_fk
    FOREIGN KEY (pension_arrangement_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id)
    REFERENCES public.pension_arrangement_versions(id, tenant_id, hr_group_id, administration_id, pension_arrangement_id)
);

CREATE TABLE public.pension_arrangement_version_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hr_group_id uuid NOT NULL,
  administration_id uuid NOT NULL,
  pension_arrangement_id uuid NOT NULL,
  pension_arrangement_version_id uuid NOT NULL,
  supersedes_version_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('BASELINE_MIGRATED', 'SUCCESSOR_CREATED')),
  actor_user_id uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pension_arrangement_version_audit_version_scope_fk
    FOREIGN KEY (pension_arrangement_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id)
    REFERENCES public.pension_arrangement_versions(id, tenant_id, hr_group_id, administration_id, pension_arrangement_id),
  CONSTRAINT pension_arrangement_version_audit_parent_scope_fk
    FOREIGN KEY (supersedes_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id)
    REFERENCES public.pension_arrangement_versions(id, tenant_id, hr_group_id, administration_id, pension_arrangement_id)
);

ALTER TABLE public.pension_arrangement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_arrangement_version_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_arrangement_version_audit ENABLE ROW LEVEL SECURITY;

-- New version rows are readable only in their exact HR-group and administration
-- scope. Direct writes are withheld; the single successor RPC below derives all
-- scope fields from an authorized predecessor and writes a matching audit row.
REVOKE ALL ON TABLE public.pension_arrangement_versions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.pension_arrangement_version_tiers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.pension_arrangement_version_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.pension_arrangement_versions TO authenticated;
GRANT SELECT ON TABLE public.pension_arrangement_version_tiers TO authenticated;
GRANT SELECT ON TABLE public.pension_arrangement_version_audit TO authenticated;

CREATE POLICY pension_arrangement_versions_read ON public.pension_arrangement_versions
  FOR SELECT TO authenticated USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read'::text)
  );
CREATE POLICY pension_arrangement_version_tiers_read ON public.pension_arrangement_version_tiers
  FOR SELECT TO authenticated USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'contract:read'::text)
  );
CREATE POLICY pension_arrangement_version_audit_read ON public.pension_arrangement_version_audit
  FOR SELECT TO authenticated USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND internal_security.current_user_has_permission(tenant_id, administration_id, 'audit:read'::text)
  );

CREATE FUNCTION public.prevent_pension_arrangement_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'PENSION_ARRANGEMENT_VERSION_IMMUTABLE' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_pension_arrangement_version_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pension_arrangement_versions_immutable
  BEFORE UPDATE OR DELETE ON public.pension_arrangement_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_pension_arrangement_version_mutation();
CREATE TRIGGER pension_arrangement_version_tiers_immutable
  BEFORE UPDATE OR DELETE ON public.pension_arrangement_version_tiers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_pension_arrangement_version_mutation();
CREATE TRIGGER pension_arrangement_version_audit_immutable
  BEFORE UPDATE OR DELETE ON public.pension_arrangement_version_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_pension_arrangement_version_mutation();

-- Snapshot every current arrangement and its tiers as immutable version 1.
-- The migration deliberately records contract classification as UNKNOWN; no
-- historical contract classification is inferred from existing arrangement data.
INSERT INTO public.pension_arrangement_versions (
  id, tenant_id, hr_group_id, administration_id, pension_arrangement_id,
  version_number, supersedes_version_id, code, name, arrangement_type,
  effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate,
  employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap,
  pensionable_salary_definition, eligibility_rule, contract_classification,
  contract_classification_provenance, provenance_json, is_active, supersession_reason,
  supersession_provenance, created_by_user_id, created_at
)
SELECT
  arrangement.id, arrangement.tenant_id, arrangement.hr_group_id, arrangement.administration_id,
  arrangement.id, 1, NULL, arrangement.code, arrangement.name, arrangement.arrangement_type,
  arrangement.effective_from, arrangement.effective_to, arrangement.transition_date,
  arrangement.grandfathering_mode, arrangement.flat_total_rate, arrangement.employer_share_pct,
  arrangement.employee_share_pct, arrangement.annual_franchise, arrangement.annual_pensionable_salary_cap,
  arrangement.pensionable_salary_definition,
  (CASE WHEN jsonb_typeof(arrangement.eligibility_rule) = 'object'
    THEN arrangement.eligibility_rule ELSE '{}'::jsonb END) || jsonb_build_object(
    'contractClassification', 'UNKNOWN',
    'contractClassificationProvenance', jsonb_build_object('status', 'UNVERIFIED')
  ),
  'UNKNOWN', '{"status":"UNVERIFIED"}'::jsonb, arrangement.provenance_json,
  arrangement.is_active, NULL, '{}'::jsonb, NULL, arrangement.created_at
FROM public.pension_arrangements AS arrangement;

INSERT INTO public.pension_arrangement_version_tiers (
  id, tenant_id, hr_group_id, administration_id, pension_arrangement_id,
  pension_arrangement_version_id, min_age, max_age, total_rate, created_at
)
SELECT tier.id, tier.tenant_id, tier.hr_group_id, tier.administration_id,
  tier.pension_arrangement_id, tier.pension_arrangement_id, tier.min_age,
  tier.max_age, tier.total_rate, tier.created_at
FROM public.pension_arrangement_tiers AS tier;

INSERT INTO public.pension_arrangement_version_audit (
  tenant_id, hr_group_id, administration_id, pension_arrangement_id,
  pension_arrangement_version_id, supersedes_version_id, event_type, actor_user_id,
  reason, provenance_json, created_at
)
SELECT version.tenant_id, version.hr_group_id, version.administration_id,
  version.pension_arrangement_id, version.id, NULL, 'BASELINE_MIGRATED', NULL,
  'Initial immutable snapshot created by pension arrangement versioning migration.',
  jsonb_build_object('source', 'pension_arrangements', 'versionNumber', 1), version.created_at
FROM public.pension_arrangement_versions AS version;

CREATE FUNCTION public.resolve_pension_arrangement_versions(
  p_pension_arrangement_ids uuid[],
  p_effective_date date
)
RETURNS SETOF public.pension_arrangement_versions
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT selected.*
  FROM (
    SELECT DISTINCT ON (version.pension_arrangement_id) version.*
    FROM public.pension_arrangement_versions AS version
    WHERE version.pension_arrangement_id = ANY (p_pension_arrangement_ids)
      AND version.effective_from <= p_effective_date
    ORDER BY version.pension_arrangement_id, version.version_number DESC
  ) AS selected
  WHERE selected.is_active
    AND (selected.effective_to IS NULL OR selected.effective_to >= p_effective_date)
$$;
REVOKE ALL ON FUNCTION public.resolve_pension_arrangement_versions(uuid[], date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pension_arrangement_versions(uuid[], date) TO authenticated;

-- The write RPC intentionally uses SECURITY DEFINER only to keep direct table
-- writes unavailable to authenticated clients. It derives scope from the
-- predecessor and rechecks the actor, HR group and contract:write permission.
CREATE FUNCTION public.create_pension_arrangement_successor(
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
    OR NOT internal_security.current_user_has_permission(v_parent.tenant_id, v_parent.administration_id, 'contract:write'::text) THEN
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

COMMENT ON TABLE public.pension_arrangement_versions IS
  'Immutable, scoped effective-dated snapshots of pension arrangements; assignments keep referencing the stable arrangement identity.';
COMMENT ON TABLE public.pension_arrangement_version_tiers IS
  'Immutable age-rate tiers belonging to one pension arrangement version.';
COMMENT ON TABLE public.pension_arrangement_version_audit IS
  'Append-only actor, scope, reason, and provenance record for pension arrangement version creation.';
COMMENT ON FUNCTION public.create_pension_arrangement_successor(uuid, jsonb) IS
  'Creates one explicit same-scope successor version and audit record after rechecking authenticated contract:write permission.';
