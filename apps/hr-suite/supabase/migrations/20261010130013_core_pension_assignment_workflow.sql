-- Adds an HR-admin scoped, audited workflow for effective-dated pension
-- mappings and individual employment assignments. Mapping rows never create
-- assignments; each employee still requires an explicit assignment.

ALTER TABLE public.labor_condition_pension_arrangements
  ADD COLUMN IF NOT EXISTS provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS version_number integer,
  ADD COLUMN IF NOT EXISTS supersedes_mapping_id uuid;

WITH ranked AS (
  SELECT mapping.id,
    row_number() OVER (
      PARTITION BY mapping.tenant_id, mapping.hr_group_id, mapping.administration_id,
        mapping.labor_condition_set_id, mapping.participant_group
      ORDER BY mapping.effective_from, mapping.created_at, mapping.id
    )::integer AS version_number,
    lag(mapping.id) OVER (
      PARTITION BY mapping.tenant_id, mapping.hr_group_id, mapping.administration_id,
        mapping.labor_condition_set_id, mapping.participant_group
      ORDER BY mapping.effective_from, mapping.created_at, mapping.id
    ) AS predecessor_id
  FROM public.labor_condition_pension_arrangements AS mapping
)
UPDATE public.labor_condition_pension_arrangements AS mapping
SET version_number = ranked.version_number,
    supersedes_mapping_id = ranked.predecessor_id,
    provenance_json = CASE
      WHEN mapping.provenance_json = '{}'::jsonb THEN jsonb_build_object(
        'schemaVersion', 'PENSION_MAPPING_PROVENANCE_V1',
        'status', 'USER_RECORDED',
        'sourceClassification', 'MIGRATED_EFFECTIVE_DATED_MAPPING',
        'source', 'Existing Core pension mapping preserved by forward migration.'
      )
      ELSE mapping.provenance_json
    END
FROM ranked
WHERE ranked.id = mapping.id;

ALTER TABLE public.labor_condition_pension_arrangements
  ALTER COLUMN version_number SET DEFAULT 1,
  ALTER COLUMN version_number SET NOT NULL,
  ADD CONSTRAINT labor_condition_pension_arrangements_version_positive CHECK (version_number > 0),
  ADD CONSTRAINT labor_condition_pension_arrangements_version_scope_unique
    UNIQUE (tenant_id, hr_group_id, administration_id, labor_condition_set_id, participant_group, version_number),
  ADD CONSTRAINT labor_condition_pension_arrangements_mapping_scope_unique
    UNIQUE (id, tenant_id, hr_group_id, administration_id, labor_condition_set_id, participant_group),
  ADD CONSTRAINT labor_condition_pension_arrangements_supersedes_scope_fkey
    FOREIGN KEY (supersedes_mapping_id, tenant_id, hr_group_id, administration_id, labor_condition_set_id, participant_group)
    REFERENCES public.labor_condition_pension_arrangements
      (id, tenant_id, hr_group_id, administration_id, labor_condition_set_id, participant_group)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX labor_condition_pension_arrangements_one_successor_idx
  ON public.labor_condition_pension_arrangements (supersedes_mapping_id)
  WHERE supersedes_mapping_id IS NOT NULL;
CREATE UNIQUE INDEX labor_condition_pension_arrangements_idempotency_idx
  ON public.labor_condition_pension_arrangements (tenant_id, hr_group_id, administration_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX labor_condition_pension_arrangements_effective_scope_idx
  ON public.labor_condition_pension_arrangements
    (tenant_id, hr_group_id, administration_id, labor_condition_set_id, participant_group, effective_from, effective_to);

ALTER TABLE public.employment_pension_arrangement_assignments
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS version_number integer,
  ADD COLUMN IF NOT EXISTS supersedes_assignment_id uuid;

WITH ranked AS (
  SELECT assignment.id,
    row_number() OVER (
      PARTITION BY assignment.tenant_id, assignment.hr_group_id, assignment.administration_id, assignment.employment_id
      ORDER BY assignment.effective_from, assignment.created_at, assignment.id
    )::integer AS version_number,
    lag(assignment.id) OVER (
      PARTITION BY assignment.tenant_id, assignment.hr_group_id, assignment.administration_id, assignment.employment_id
      ORDER BY assignment.effective_from, assignment.created_at, assignment.id
    ) AS predecessor_id
  FROM public.employment_pension_arrangement_assignments AS assignment
)
UPDATE public.employment_pension_arrangement_assignments AS assignment
SET version_number = ranked.version_number,
    supersedes_assignment_id = ranked.predecessor_id
FROM ranked
WHERE ranked.id = assignment.id;

ALTER TABLE public.employment_pension_arrangement_assignments
  ALTER COLUMN version_number SET DEFAULT 1,
  ALTER COLUMN version_number SET NOT NULL,
  ADD CONSTRAINT employment_pension_assignments_version_positive CHECK (version_number > 0),
  ADD CONSTRAINT employment_pension_assignments_version_scope_unique
    UNIQUE (tenant_id, hr_group_id, administration_id, employment_id, version_number),
  ADD CONSTRAINT employment_pension_assignments_assignment_scope_unique
    UNIQUE (id, tenant_id, hr_group_id, administration_id, employment_id),
  ADD CONSTRAINT employment_pension_assignments_supersedes_scope_fkey
    FOREIGN KEY (supersedes_assignment_id, tenant_id, hr_group_id, administration_id, employment_id)
    REFERENCES public.employment_pension_arrangement_assignments
      (id, tenant_id, hr_group_id, administration_id, employment_id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX employment_pension_assignments_one_successor_idx
  ON public.employment_pension_arrangement_assignments (supersedes_assignment_id)
  WHERE supersedes_assignment_id IS NOT NULL;
CREATE UNIQUE INDEX employment_pension_assignments_idempotency_idx
  ON public.employment_pension_arrangement_assignments (tenant_id, hr_group_id, administration_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX employment_pension_assignments_effective_scope_idx
  ON public.employment_pension_arrangement_assignments
    (tenant_id, hr_group_id, administration_id, employment_id, effective_from, effective_to);

INSERT INTO public.permissions (code, name, category, description)
VALUES (
  'pension:manage',
  'Pensioenafspraken beheren',
  'Contract & dienstverband',
  'Beheert pensioenregelingen, CAO-koppelingen en individuele deelname binnen de administratie.'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (management_role_id, permission_id)
SELECT role.id, permission.id
FROM public.management_roles AS role
JOIN public.permissions AS permission ON permission.code = 'pension:manage'
WHERE role.code IN ('HR_ADMIN', 'TENANT_ADMIN')
ON CONFLICT DO NOTHING;

-- Direct table writes cannot perform the overlap, idempotency and audit work
-- atomically. Reads remain available under the existing scoped RLS policies.
REVOKE INSERT, UPDATE, DELETE ON public.labor_condition_pension_arrangements FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.employment_pension_arrangement_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.labor_condition_pension_arrangements TO authenticated;
GRANT SELECT ON public.employment_pension_arrangement_assignments TO authenticated;

CREATE FUNCTION public.apply_employment_pension_arrangement(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_employment public.employments%ROWTYPE;
  v_arrangement public.pension_arrangements%ROWTYPE;
  v_contract record;
  v_condition_set public.labor_condition_sets%ROWTYPE;
  v_mapping public.labor_condition_pension_arrangements%ROWTYPE;
  v_previous_mapping public.labor_condition_pension_arrangements%ROWTYPE;
  v_assignment public.employment_pension_arrangement_assignments%ROWTYPE;
  v_previous_assignment public.employment_pension_arrangement_assignments%ROWTYPE;
  v_employee_id uuid;
  v_employment_id uuid;
  v_arrangement_id uuid;
  v_request_key uuid;
  v_participation_start date;
  v_effective_from date;
  v_effective_to date;
  v_participant_group text;
  v_assignment_reason text;
  v_provenance jsonb;
  v_mapping_provenance jsonb;
  v_create_mapping boolean;
  v_supersedes_mapping_id uuid;
  v_supersedes_assignment_id uuid;
  v_mapping_overlaps integer;
  v_assignment_overlaps integer;
  v_mapping_reused boolean := false;
  v_assignment_reused boolean := false;
  v_mapping_version integer;
  v_assignment_version integer;
  v_mapping_id uuid;
  v_assignment_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PENSION_ASSIGNMENT_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_input IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'PENSION_ASSIGNMENT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_employee_id := NULLIF(p_input ->> 'employee_id', '')::uuid;
  v_employment_id := NULLIF(p_input ->> 'employment_id', '')::uuid;
  v_arrangement_id := NULLIF(p_input ->> 'arrangement_id', '')::uuid;
  v_request_key := NULLIF(p_input ->> 'request_key', '')::uuid;
  v_participation_start := NULLIF(p_input ->> 'participation_start_date', '')::date;
  v_effective_from := NULLIF(p_input ->> 'effective_from', '')::date;
  v_effective_to := NULLIF(p_input ->> 'effective_to', '')::date;
  v_participant_group := p_input ->> 'participant_group';
  v_assignment_reason := NULLIF(btrim(p_input ->> 'assignment_reason'), '');
  v_provenance := p_input -> 'provenance_json';
  v_create_mapping := coalesce((p_input ->> 'confirm_mapping')::boolean, false);
  v_supersedes_mapping_id := NULLIF(p_input ->> 'supersedes_mapping_id', '')::uuid;
  v_supersedes_assignment_id := NULLIF(p_input ->> 'supersedes_assignment_id', '')::uuid;

  IF v_employee_id IS NULL OR v_employment_id IS NULL OR v_arrangement_id IS NULL OR v_request_key IS NULL
    OR v_participation_start IS NULL OR v_effective_from IS NULL
    OR (v_effective_to IS NOT NULL AND v_effective_to < v_effective_from)
    OR v_participation_start > v_effective_from
    OR v_participant_group IS NULL
    OR v_participant_group NOT IN ('NEW_ENTRANT', 'GRANDFATHERED')
    OR v_assignment_reason IS NULL
    OR v_provenance IS NULL OR jsonb_typeof(v_provenance) IS DISTINCT FROM 'object'
    OR v_provenance ->> 'schemaVersion' IS DISTINCT FROM 'EMPLOYMENT_PENSION_ASSIGNMENT_PROVENANCE_V1'
    OR v_provenance ->> 'status' IS NULL
    OR v_provenance ->> 'status' NOT IN ('USER_RECORDED', 'SYNTHETIC_TEST_FIXTURE')
    OR NULLIF(btrim(v_provenance ->> 'sourceClassification'), '') IS NULL THEN
    RAISE EXCEPTION 'PENSION_ASSIGNMENT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_provenance ->> 'status' = 'SYNTHETIC_TEST_FIXTURE'
    AND (
      left(v_provenance ->> 'sourceClassification', 25) <> 'SYNTHETIC_TEST_FIXTURE — '
      OR char_length(v_provenance ->> 'sourceClassification') NOT BETWEEN 28 AND 205
      OR v_provenance ->> 'sourceClassification' ~ '[[:cntrl:]]'
    ) THEN
    RAISE EXCEPTION 'PENSION_SYNTHETIC_PROVENANCE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_provenance ->> 'status' = 'SYNTHETIC_TEST_FIXTURE'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'liquidhr_pension_test_fixtures_enabled') IS DISTINCT FROM 'true'
      OR coalesce(auth.jwt() -> 'app_metadata' ->> 'liquidhr_pension_fixture_environment', '')
        NOT IN ('test', 'development', 'preview')
    ) THEN
    RAISE EXCEPTION 'PENSION_TEST_FIXTURE_DISABLED' USING ERRCODE = '42501';
  END IF;
  IF v_provenance ->> 'status' = 'USER_RECORDED'
    AND v_provenance ->> 'sourceClassification' <> 'CORE_PENSION_ASSIGNMENT_WORKFLOW' THEN
    RAISE EXCEPTION 'PENSION_ASSIGNMENT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT employment.* INTO v_employment
  FROM public.employments AS employment
  WHERE employment.id = v_employment_id
    AND employment.employee_id = v_employee_id
    AND employment.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PENSION_EMPLOYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT internal_security.has_hr_group_access(v_employment.tenant_id, v_employment.hr_group_id)
    OR NOT internal_security.current_user_has_permission(v_employment.tenant_id, v_employment.administration_id, 'pension:manage'::text) THEN
    RAISE EXCEPTION 'PENSION_ASSIGNMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_effective_from < v_employment.starts_on
    OR (v_employment.ends_on IS NOT NULL AND (
      v_effective_to IS NULL OR v_effective_to > v_employment.ends_on
    )) THEN
    RAISE EXCEPTION 'PENSION_EMPLOYMENT_PERIOD_MISMATCH' USING ERRCODE = '23514';
  END IF;

  SELECT assignment.* INTO v_assignment
  FROM public.employment_pension_arrangement_assignments AS assignment
  WHERE assignment.tenant_id = v_employment.tenant_id
    AND assignment.hr_group_id = v_employment.hr_group_id
    AND assignment.administration_id = v_employment.administration_id
    AND assignment.employment_id = v_employment.id
    AND assignment.idempotency_key = v_request_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_assignment.pension_arrangement_id <> v_arrangement_id
      OR v_assignment.participation_start_date <> v_participation_start
      OR v_assignment.effective_from <> v_effective_from
      OR v_assignment.effective_to IS DISTINCT FROM v_effective_to
      OR v_assignment.provenance_json ->> 'participantGroup' IS DISTINCT FROM v_participant_group
      OR v_assignment.provenance_json ->> 'sourceClassification' IS DISTINCT FROM v_provenance ->> 'sourceClassification' THEN
      RAISE EXCEPTION 'PENSION_ASSIGNMENT_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'assignment_id', v_assignment.id,
      'mapping_id', v_assignment.provenance_json ->> 'laborConditionMappingId',
      'assignment_version', v_assignment.version_number,
      'mapping_version', v_assignment.provenance_json ->> 'laborConditionMappingVersion',
      'assignment_reused', true,
      'mapping_reused', true
    );
  END IF;

  SELECT arrangement.* INTO v_arrangement
  FROM public.pension_arrangements AS arrangement
  WHERE arrangement.id = v_arrangement_id
    AND arrangement.tenant_id = v_employment.tenant_id
    AND arrangement.hr_group_id = v_employment.hr_group_id
    AND arrangement.administration_id = v_employment.administration_id
    AND arrangement.is_active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_NOT_AVAILABLE' USING ERRCODE = '23503';
  END IF;
  IF v_effective_from < v_arrangement.effective_from
    OR (v_effective_to IS NOT NULL AND v_arrangement.effective_to IS NOT NULL AND v_effective_to > v_arrangement.effective_to)
    OR (v_effective_to IS NULL AND v_arrangement.effective_to IS NOT NULL)
    OR (v_arrangement.effective_to IS NOT NULL AND v_effective_from > v_arrangement.effective_to) THEN
    RAISE EXCEPTION 'PENSION_ARRANGEMENT_PERIOD_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF v_arrangement.arrangement_type = 'PROGRESSIVE_PREMIUM'
    AND (v_participant_group <> 'GRANDFATHERED'
      OR v_arrangement.grandfathering_mode <> 'EERBIEDIGENDE_WERKING'
      OR v_arrangement.transition_date IS NULL
      OR v_participation_start >= v_arrangement.transition_date) THEN
    RAISE EXCEPTION 'PENSION_GRANDFATHERING_EVIDENCE_INCOMPLETE' USING ERRCODE = '23514';
  END IF;
  IF v_arrangement.eligibility_rule ? 'participantGroup'
    AND v_arrangement.eligibility_rule ->> 'participantGroup' IS DISTINCT FROM v_participant_group THEN
    RAISE EXCEPTION 'PENSION_PARTICIPANT_GROUP_MISMATCH' USING ERRCODE = '23514';
  END IF;

  SELECT contract.id, contract.labor_condition_set_id, contract.starts_on, contract.ends_on
  INTO v_contract
  FROM public.employment_contracts AS contract
  WHERE contract.tenant_id = v_employment.tenant_id
    AND contract.hr_group_id = v_employment.hr_group_id
    AND contract.administration_id = v_employment.administration_id
    AND contract.employee_id = v_employee_id
    AND contract.employment_id = v_employment_id
    AND contract.labor_condition_set_id IS NOT NULL
    AND contract.starts_on <= v_effective_from
    AND (contract.ends_on IS NULL OR contract.ends_on >= v_effective_from)
  ORDER BY contract.starts_on DESC, contract.id
  LIMIT 2
  FOR SHARE;
  IF NOT FOUND OR v_contract.labor_condition_set_id IS NULL THEN
    RAISE EXCEPTION 'PENSION_LABOR_CONDITION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM public.employment_contracts AS contract
      WHERE contract.tenant_id = v_employment.tenant_id
        AND contract.hr_group_id = v_employment.hr_group_id
        AND contract.administration_id = v_employment.administration_id
        AND contract.employee_id = v_employee_id
        AND contract.employment_id = v_employment_id
        AND contract.labor_condition_set_id IS NOT NULL
        AND contract.starts_on <= v_effective_from
        AND (contract.ends_on IS NULL OR contract.ends_on >= v_effective_from)) <> 1 THEN
    RAISE EXCEPTION 'PENSION_LABOR_CONDITION_AMBIGUOUS' USING ERRCODE = '23514';
  END IF;
  IF (v_effective_to IS NULL AND v_contract.ends_on IS NOT NULL)
    OR (v_effective_to IS NOT NULL AND v_contract.ends_on IS NOT NULL AND v_effective_to > v_contract.ends_on) THEN
    RAISE EXCEPTION 'PENSION_LABOR_CONDITION_PERIOD_MISMATCH' USING ERRCODE = '23514';
  END IF;

  SELECT condition_set.* INTO v_condition_set
  FROM public.labor_condition_sets AS condition_set
  WHERE condition_set.id = v_contract.labor_condition_set_id
    AND condition_set.tenant_id = v_employment.tenant_id
    AND condition_set.hr_group_id = v_employment.hr_group_id
    AND condition_set.administration_id = v_employment.administration_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PENSION_LABOR_CONDITION_SCOPE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF v_effective_from < v_condition_set.valid_from OR EXISTS (
    SELECT 1 FROM public.labor_condition_sets AS successor
    WHERE successor.tenant_id = v_condition_set.tenant_id
      AND successor.hr_group_id = v_condition_set.hr_group_id
      AND successor.administration_id = v_condition_set.administration_id
      AND successor.predecessor_id = v_condition_set.id
      AND successor.valid_from <= coalesce(v_effective_to, 'infinity'::date)
  ) THEN
    RAISE EXCEPTION 'PENSION_LABOR_CONDITION_PERIOD_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NOT v_create_mapping THEN
    RAISE EXCEPTION 'PENSION_MAPPING_CONFIRMATION_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- A repeated natural request may reuse an effective mapping. A conflicting
  -- overlap is only shortened when the caller explicitly names its predecessor.
  PERFORM 1
  FROM public.labor_condition_pension_arrangements AS mapping
  WHERE mapping.tenant_id = v_employment.tenant_id
    AND mapping.hr_group_id = v_employment.hr_group_id
    AND mapping.administration_id = v_employment.administration_id
    AND mapping.labor_condition_set_id = v_condition_set.id
    AND mapping.participant_group = v_participant_group
    AND mapping.effective_from <= coalesce(v_effective_to, 'infinity'::date)
    AND coalesce(mapping.effective_to, 'infinity'::date) >= v_effective_from
  ORDER BY mapping.effective_from DESC
  FOR UPDATE;
  GET DIAGNOSTICS v_mapping_overlaps = ROW_COUNT;
  IF v_mapping_overlaps > 1 THEN
    RAISE EXCEPTION 'PENSION_MAPPING_OVERLAP_AMBIGUOUS' USING ERRCODE = '23P01';
  END IF;
  IF v_mapping_overlaps > 0 THEN
    SELECT mapping.* INTO v_mapping
    FROM public.labor_condition_pension_arrangements AS mapping
    WHERE mapping.tenant_id = v_employment.tenant_id
      AND mapping.hr_group_id = v_employment.hr_group_id
      AND mapping.administration_id = v_employment.administration_id
      AND mapping.labor_condition_set_id = v_condition_set.id
      AND mapping.participant_group = v_participant_group
      AND mapping.effective_from <= coalesce(v_effective_to, 'infinity'::date)
      AND coalesce(mapping.effective_to, 'infinity'::date) >= v_effective_from
    ORDER BY mapping.effective_from DESC
    LIMIT 1
    FOR UPDATE;
    IF v_mapping.pension_arrangement_id = v_arrangement.id
      AND v_mapping.effective_from <= v_effective_from
      AND coalesce(v_mapping.effective_to, 'infinity'::date) >= coalesce(v_effective_to, 'infinity'::date) THEN
      v_mapping_reused := true;
    ELSIF v_supersedes_mapping_id = v_mapping.id AND v_mapping.effective_from < v_effective_from THEN
      v_previous_mapping := v_mapping;
      UPDATE public.labor_condition_pension_arrangements AS mapping
      SET effective_to = v_effective_from - 1
      WHERE mapping.id = v_mapping.id;
      INSERT INTO public.audit_logs (tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes)
      VALUES (v_employment.tenant_id, v_employment.administration_id, 'labor_condition_pension_arrangements', v_mapping.id,
        v_actor, 'UPDATE', jsonb_build_object('effective_to', jsonb_build_object('before', v_mapping.effective_to, 'after', v_effective_from - 1)));
    ELSE
      RAISE EXCEPTION 'PENSION_MAPPING_OVERLAP' USING ERRCODE = '23P01';
    END IF;
  ELSIF v_supersedes_mapping_id IS NOT NULL THEN
    SELECT mapping.* INTO v_previous_mapping
    FROM public.labor_condition_pension_arrangements AS mapping
    WHERE mapping.id = v_supersedes_mapping_id
      AND mapping.tenant_id = v_employment.tenant_id
      AND mapping.hr_group_id = v_employment.hr_group_id
      AND mapping.administration_id = v_employment.administration_id
      AND mapping.labor_condition_set_id = v_condition_set.id
      AND mapping.participant_group = v_participant_group
      AND mapping.effective_from < v_effective_from
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PENSION_MAPPING_PREDECESSOR_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT mapping.* INTO v_previous_mapping
    FROM public.labor_condition_pension_arrangements AS mapping
    WHERE mapping.tenant_id = v_employment.tenant_id
      AND mapping.hr_group_id = v_employment.hr_group_id
      AND mapping.administration_id = v_employment.administration_id
      AND mapping.labor_condition_set_id = v_condition_set.id
      AND mapping.participant_group = v_participant_group
      AND mapping.effective_from < v_effective_from
    ORDER BY mapping.effective_from DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT v_mapping_reused THEN
    IF EXISTS (
      SELECT 1 FROM public.labor_condition_pension_arrangements AS future_mapping
      WHERE future_mapping.tenant_id = v_employment.tenant_id
        AND future_mapping.hr_group_id = v_employment.hr_group_id
        AND future_mapping.administration_id = v_employment.administration_id
        AND future_mapping.labor_condition_set_id = v_condition_set.id
        AND future_mapping.participant_group = v_participant_group
        AND future_mapping.effective_from > v_effective_from
        AND (v_effective_to IS NULL OR v_effective_to >= future_mapping.effective_from)
    ) THEN
      RAISE EXCEPTION 'PENSION_MAPPING_OVERLAP' USING ERRCODE = '23P01';
    END IF;
    IF v_previous_mapping.id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.labor_condition_pension_arrangements AS child
      WHERE child.supersedes_mapping_id = v_previous_mapping.id
    ) THEN
      RAISE EXCEPTION 'PENSION_MAPPING_PREDECESSOR_ALREADY_SUPERSEDED' USING ERRCODE = '23505';
    END IF;
    SELECT coalesce(max(mapping.version_number), 0) + 1 INTO v_mapping_version
    FROM public.labor_condition_pension_arrangements AS mapping
    WHERE mapping.tenant_id = v_employment.tenant_id
      AND mapping.hr_group_id = v_employment.hr_group_id
      AND mapping.administration_id = v_employment.administration_id
      AND mapping.labor_condition_set_id = v_condition_set.id
      AND mapping.participant_group = v_participant_group;
    v_mapping_provenance := v_provenance || jsonb_build_object(
      'recordType', 'CAO_PENSION_ARRANGEMENT_MAPPING',
      'schemaVersion', 'PENSION_MAPPING_PROVENANCE_V1',
      'laborConditionSetId', v_condition_set.id,
      'mappingVersion', v_mapping_version,
      'supersedesMappingId', v_previous_mapping.id
    );
    INSERT INTO public.labor_condition_pension_arrangements (
      tenant_id, hr_group_id, administration_id, labor_condition_set_id, pension_arrangement_id,
      participant_group, effective_from, effective_to, provenance_json, idempotency_key,
      version_number, supersedes_mapping_id
    ) VALUES (
      v_employment.tenant_id, v_employment.hr_group_id, v_employment.administration_id,
      v_condition_set.id, v_arrangement.id, v_participant_group, v_effective_from, v_effective_to,
      v_mapping_provenance, v_request_key, v_mapping_version, v_previous_mapping.id
    ) RETURNING * INTO v_mapping;
    v_mapping_id := v_mapping.id;
    INSERT INTO public.audit_logs (tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes)
    VALUES (v_employment.tenant_id, v_employment.administration_id, 'labor_condition_pension_arrangements', v_mapping.id,
      v_actor, 'CREATE', jsonb_build_object('labor_condition_set_id', v_condition_set.id,
        'pension_arrangement_id', v_arrangement.id, 'participant_group', v_participant_group,
        'effective_from', v_effective_from, 'effective_to', v_effective_to,
        'version_number', v_mapping_version, 'sourceClassification', v_provenance ->> 'sourceClassification'));
  ELSE
    v_mapping_id := v_mapping.id;
    v_mapping_version := v_mapping.version_number;
    IF v_mapping.idempotency_key IS NOT NULL AND v_mapping.idempotency_key <> v_request_key THEN
      v_mapping_reused := true;
    END IF;
  END IF;

  PERFORM 1
  FROM public.employment_pension_arrangement_assignments AS assignment
  WHERE assignment.tenant_id = v_employment.tenant_id
    AND assignment.hr_group_id = v_employment.hr_group_id
    AND assignment.administration_id = v_employment.administration_id
    AND assignment.employment_id = v_employment.id
    AND assignment.effective_from <= coalesce(v_effective_to, 'infinity'::date)
    AND coalesce(assignment.effective_to, 'infinity'::date) >= v_effective_from
  ORDER BY assignment.effective_from DESC
  FOR UPDATE;
  GET DIAGNOSTICS v_assignment_overlaps = ROW_COUNT;
  IF v_assignment_overlaps > 1 THEN
    RAISE EXCEPTION 'PENSION_ASSIGNMENT_OVERLAP_AMBIGUOUS' USING ERRCODE = '23P01';
  END IF;
  IF v_assignment_overlaps > 0 THEN
    SELECT assignment.* INTO v_assignment
    FROM public.employment_pension_arrangement_assignments AS assignment
    WHERE assignment.tenant_id = v_employment.tenant_id
      AND assignment.hr_group_id = v_employment.hr_group_id
      AND assignment.administration_id = v_employment.administration_id
      AND assignment.employment_id = v_employment.id
      AND assignment.effective_from <= coalesce(v_effective_to, 'infinity'::date)
      AND coalesce(assignment.effective_to, 'infinity'::date) >= v_effective_from
    ORDER BY assignment.effective_from DESC
    LIMIT 1
    FOR UPDATE;
    IF v_assignment.pension_arrangement_id = v_arrangement.id
      AND v_assignment.participation_start_date = v_participation_start
      AND v_assignment.effective_from = v_effective_from
      AND v_assignment.effective_to IS NOT DISTINCT FROM v_effective_to
      AND v_assignment.provenance_json ->> 'sourceClassification' = v_provenance ->> 'sourceClassification' THEN
      v_assignment_reused := true;
    ELSIF v_supersedes_assignment_id = v_assignment.id AND v_assignment.effective_from < v_effective_from THEN
      v_previous_assignment := v_assignment;
      UPDATE public.employment_pension_arrangement_assignments AS assignment
      SET effective_to = v_effective_from - 1,
          updated_at = timezone('utc', now())
      WHERE assignment.id = v_assignment.id;
      INSERT INTO public.audit_logs (tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes)
      VALUES (v_employment.tenant_id, v_employment.administration_id, 'employment_pension_arrangement_assignments', v_assignment.id,
        v_actor, 'UPDATE', jsonb_build_object('effective_to', jsonb_build_object('before', v_assignment.effective_to, 'after', v_effective_from - 1)));
    ELSE
      RAISE EXCEPTION 'PENSION_ASSIGNMENT_OVERLAP' USING ERRCODE = '23P01';
    END IF;
  ELSIF v_supersedes_assignment_id IS NOT NULL THEN
    SELECT assignment.* INTO v_previous_assignment
    FROM public.employment_pension_arrangement_assignments AS assignment
    WHERE assignment.id = v_supersedes_assignment_id
      AND assignment.tenant_id = v_employment.tenant_id
      AND assignment.hr_group_id = v_employment.hr_group_id
      AND assignment.administration_id = v_employment.administration_id
      AND assignment.employment_id = v_employment.id
      AND assignment.effective_from < v_effective_from
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PENSION_ASSIGNMENT_PREDECESSOR_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT assignment.* INTO v_previous_assignment
    FROM public.employment_pension_arrangement_assignments AS assignment
    WHERE assignment.tenant_id = v_employment.tenant_id
      AND assignment.hr_group_id = v_employment.hr_group_id
      AND assignment.administration_id = v_employment.administration_id
      AND assignment.employment_id = v_employment.id
      AND assignment.effective_from < v_effective_from
    ORDER BY assignment.effective_from DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT v_assignment_reused THEN
    IF EXISTS (
      SELECT 1 FROM public.employment_pension_arrangement_assignments AS future_assignment
      WHERE future_assignment.tenant_id = v_employment.tenant_id
        AND future_assignment.hr_group_id = v_employment.hr_group_id
        AND future_assignment.administration_id = v_employment.administration_id
        AND future_assignment.employment_id = v_employment.id
        AND future_assignment.effective_from > v_effective_from
        AND (v_effective_to IS NULL OR v_effective_to >= future_assignment.effective_from)
    ) THEN
      RAISE EXCEPTION 'PENSION_ASSIGNMENT_OVERLAP' USING ERRCODE = '23P01';
    END IF;
    IF v_previous_assignment.id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.employment_pension_arrangement_assignments AS child
      WHERE child.supersedes_assignment_id = v_previous_assignment.id
    ) THEN
      RAISE EXCEPTION 'PENSION_ASSIGNMENT_PREDECESSOR_ALREADY_SUPERSEDED' USING ERRCODE = '23505';
    END IF;
    SELECT coalesce(max(assignment.version_number), 0) + 1 INTO v_assignment_version
    FROM public.employment_pension_arrangement_assignments AS assignment
    WHERE assignment.tenant_id = v_employment.tenant_id
      AND assignment.hr_group_id = v_employment.hr_group_id
      AND assignment.administration_id = v_employment.administration_id
      AND assignment.employment_id = v_employment.id;
    v_provenance := v_provenance || jsonb_build_object(
      'laborConditionMappingId', v_mapping_id,
      'laborConditionMappingVersion', v_mapping_version,
      'participantGroup', v_participant_group,
      'assignmentVersion', v_assignment_version,
      'supersedesAssignmentId', v_previous_assignment.id
    );
    INSERT INTO public.employment_pension_arrangement_assignments (
      tenant_id, hr_group_id, administration_id, employment_id, pension_arrangement_id,
      participation_start_date, effective_from, effective_to, assignment_reason,
      provenance_json, idempotency_key, version_number, supersedes_assignment_id, updated_at
    ) VALUES (
      v_employment.tenant_id, v_employment.hr_group_id, v_employment.administration_id,
      v_employment.id, v_arrangement.id, v_participation_start, v_effective_from, v_effective_to,
      v_assignment_reason, v_provenance, v_request_key, v_assignment_version,
      v_previous_assignment.id, timezone('utc', now())
    ) RETURNING * INTO v_assignment;
    v_assignment_id := v_assignment.id;
    INSERT INTO public.audit_logs (tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes)
    VALUES (v_employment.tenant_id, v_employment.administration_id, 'employment_pension_arrangement_assignments', v_assignment.id,
      v_actor, 'CREATE', jsonb_build_object('employment_id', v_employment.id,
        'pension_arrangement_id', v_arrangement.id, 'participation_start_date', v_participation_start,
        'effective_from', v_effective_from, 'effective_to', v_effective_to,
        'version_number', v_assignment_version, 'sourceClassification', v_provenance ->> 'sourceClassification'));
  ELSE
    v_assignment_id := v_assignment.id;
    v_assignment_version := v_assignment.version_number;
  END IF;

  RETURN jsonb_build_object(
    'assignment_id', v_assignment_id,
    'mapping_id', v_mapping_id,
    'assignment_version', v_assignment_version,
    'mapping_version', v_mapping_version,
    'assignment_reused', v_assignment_reused,
    'mapping_reused', v_mapping_reused
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_employment_pension_arrangement(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_employment_pension_arrangement(jsonb) TO authenticated;

COMMENT ON FUNCTION public.apply_employment_pension_arrangement(jsonb) IS
  'Atomically creates or reuses a scoped effective CAO mapping and a single explicit employment assignment. Synthetic provenance additionally requires trusted non-production app_metadata claims. Mapping rows never auto-enroll other employments; pension:manage, HR-group access, overlap checks, version lineage and audit writes are enforced in the transaction.';
