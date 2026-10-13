BEGIN;

-- A minimal immutable bridge for Core-backed calculations. The existing
-- PAYRUN01 input-reference contract remains unchanged and continues to guard
-- its versioned test/correction inputs.
CREATE TABLE public.generic_payroll_input_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_administration_id uuid NOT NULL,
  source_tenant_id uuid NOT NULL,
  source_hr_group_id uuid NOT NULL,
  source_administration_id uuid NOT NULL,
  calculation_input_set_id uuid NOT NULL,
  source_employee_id uuid NOT NULL,
  source_employment_id uuid NOT NULL,
  source_income_relationship_id uuid NOT NULL,
  employment_income_relationship_id uuid NOT NULL,
  tax_profile_id uuid NOT NULL,
  tax_profile_version integer NOT NULL CHECK (tax_profile_version > 0),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  input_reference_json jsonb NOT NULL CHECK (jsonb_typeof(input_reference_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL,
  CONSTRAINT generic_payroll_input_reference_scope_fk
    FOREIGN KEY (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    REFERENCES public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  CONSTRAINT generic_payroll_input_reference_input_set_fk
    FOREIGN KEY (calculation_input_set_id, source_tenant_id, source_hr_group_id, source_administration_id)
    REFERENCES public.calculation_input_sets (id, source_tenant_id, source_hr_group_id, source_administration_id),
  CONSTRAINT generic_payroll_input_reference_employment_fk
    FOREIGN KEY (source_tenant_id, source_administration_id, source_employee_id, source_employment_id)
    REFERENCES public.employments (tenant_id, administration_id, employee_id, id),
  CONSTRAINT generic_payroll_input_reference_income_fk
    FOREIGN KEY (source_tenant_id, source_administration_id, source_employee_id, source_income_relationship_id)
    REFERENCES public.income_relationships (tenant_id, administration_id, employee_id, id),
  CONSTRAINT generic_payroll_input_reference_tax_profile_fk
    FOREIGN KEY (tax_profile_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id, source_income_relationship_id)
    REFERENCES public.employment_payroll_tax_profiles
      (id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id),
  CONSTRAINT generic_payroll_input_reference_once UNIQUE (calculation_input_set_id)
);

CREATE INDEX generic_payroll_input_reference_employment_idx
  ON public.generic_payroll_input_references
    (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id, source_employment_id);

ALTER TABLE public.generic_payroll_input_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY generic_payroll_input_references_service_role_only
  ON public.generic_payroll_input_references FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.generic_payroll_input_references FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.generic_payroll_input_references TO service_role;

CREATE FUNCTION public.guard_generic_payroll_input_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  input_set public.calculation_input_sets%ROWTYPE;
  source_snapshot public.source_snapshots%ROWTYPE;
  payroll_period public.payroll_periods%ROWTYPE;
  tax_profile public.employment_payroll_tax_profiles%ROWTYPE;
  income_link public.employment_income_relationships%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Generic payroll input references are immutable.';
  END IF;

  SELECT * INTO input_set
  FROM public.calculation_input_sets AS candidate
  WHERE candidate.id = NEW.calculation_input_set_id
    AND candidate.payroll_administration_id = NEW.payroll_administration_id
    AND candidate.source_tenant_id = NEW.source_tenant_id
    AND candidate.source_hr_group_id = NEW.source_hr_group_id
    AND candidate.source_administration_id = NEW.source_administration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYROLL_INPUT_REFERENCE_INPUT_SET_INVALID';
  END IF;

  SELECT * INTO source_snapshot
  FROM public.source_snapshots AS candidate
  WHERE candidate.id = input_set.source_snapshot_id
    AND candidate.payroll_administration_id = NEW.payroll_administration_id
    AND candidate.source_tenant_id = NEW.source_tenant_id
    AND candidate.source_hr_group_id = NEW.source_hr_group_id
    AND candidate.source_administration_id = NEW.source_administration_id;
  SELECT * INTO payroll_period
  FROM public.payroll_periods AS candidate
  WHERE candidate.id = input_set.payroll_period_id
    AND candidate.payroll_administration_id = NEW.payroll_administration_id
    AND candidate.source_tenant_id = NEW.source_tenant_id
    AND candidate.source_hr_group_id = NEW.source_hr_group_id
    AND candidate.source_administration_id = NEW.source_administration_id;
  SELECT * INTO tax_profile
  FROM public.employment_payroll_tax_profiles AS candidate
  WHERE candidate.id = NEW.tax_profile_id
    AND candidate.tenant_id = NEW.source_tenant_id
    AND candidate.hr_group_id = NEW.source_hr_group_id
    AND candidate.administration_id = NEW.source_administration_id
    AND candidate.employee_id = NEW.source_employee_id
    AND candidate.employment_id = NEW.source_employment_id
    AND candidate.income_relationship_id = NEW.source_income_relationship_id;

  SELECT * INTO income_link
  FROM public.employment_income_relationships AS candidate
  WHERE candidate.id = NEW.employment_income_relationship_id
    AND candidate.tenant_id = NEW.source_tenant_id
    AND candidate.administration_id = NEW.source_administration_id
    AND candidate.employee_id = NEW.source_employee_id
    AND candidate.employment_id = NEW.source_employment_id
    AND candidate.income_relationship_id = NEW.source_income_relationship_id;

  IF source_snapshot.id IS NULL OR payroll_period.id IS NULL OR tax_profile.id IS NULL OR income_link.id IS NULL
    OR source_snapshot.source_employee_id IS DISTINCT FROM NEW.source_employee_id
    OR source_snapshot.source_employment_id IS DISTINCT FROM NEW.source_employment_id
    OR source_snapshot.source_income_relationship_id IS DISTINCT FROM NEW.source_income_relationship_id
    OR source_snapshot.source_hash IS DISTINCT FROM NEW.source_hash
    OR input_set.input_hash IS DISTINCT FROM NEW.input_hash
    OR tax_profile.version_number IS DISTINCT FROM NEW.tax_profile_version
    OR tax_profile.employment_income_relationship_id IS DISTINCT FROM income_link.id
    OR income_link.valid_from > payroll_period.starts_on
    OR (income_link.valid_until IS NOT NULL AND income_link.valid_until <= payroll_period.ends_on)
    OR tax_profile.effective_from > payroll_period.starts_on
    OR (tax_profile.effective_to IS NOT NULL AND tax_profile.effective_to < payroll_period.ends_on)
    OR tax_profile.residence_country_code <> 'NL'
    OR tax_profile.wage_tax_table <> 'WHITE'
    OR tax_profile.herleiding_code <> 'STD'
    OR tax_profile.time_period <> 'MONTH'
    OR NOT tax_profile.regular_wage_only
    OR NOT tax_profile.full_period_only
    OR tax_profile.has_special_situation THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYROLL_INPUT_REFERENCE_CORE_SOURCE_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generic_payroll_input_reference_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.generic_payroll_input_references
  FOR EACH ROW EXECUTE FUNCTION public.guard_generic_payroll_input_reference();

CREATE OR REPLACE FUNCTION public.lock_payrun01_run(p_calculation_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  subject_lock_key text;
BEGIN
  SELECT run.payroll_administration_id::text || ':' || run.source_tenant_id::text || ':'
      || run.source_hr_group_id::text || ':' || run.source_administration_id::text || ':'
      || COALESCE(individual_ref.source_employment_id, generic_ref.source_employment_id)::text
    INTO subject_lock_key
    FROM public.calculation_runs AS run
    LEFT JOIN public.individual_payroll_input_references AS individual_ref
      ON individual_ref.calculation_input_set_id = run.calculation_input_set_id
     AND individual_ref.payroll_administration_id = run.payroll_administration_id
     AND individual_ref.source_tenant_id = run.source_tenant_id
     AND individual_ref.source_hr_group_id = run.source_hr_group_id
     AND individual_ref.source_administration_id = run.source_administration_id
    LEFT JOIN public.generic_payroll_input_references AS generic_ref
      ON generic_ref.calculation_input_set_id = run.calculation_input_set_id
     AND generic_ref.payroll_administration_id = run.payroll_administration_id
     AND generic_ref.source_tenant_id = run.source_tenant_id
     AND generic_ref.source_hr_group_id = run.source_hr_group_id
     AND generic_ref.source_administration_id = run.source_administration_id
    WHERE run.id = p_calculation_run_id
      AND run.run_type = 'INDIVIDUAL_PAYROLL'
      AND (individual_ref.id IS NOT NULL OR generic_ref.id IS NOT NULL);
  IF subject_lock_key IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payrun01:subject:' || subject_lock_key, 0));
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payrun01:run:' || p_calculation_run_id::text, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.payrun01_mark_succeeded_with_concept(
  p_payroll_administration_id uuid,
  p_source_tenant_id uuid,
  p_source_hr_group_id uuid,
  p_source_administration_id uuid,
  p_calculation_run_id uuid,
  p_payroll_period_id uuid,
  p_source_employment_id uuid,
  p_actor_user_id uuid,
  p_finished_at timestamptz,
  p_result_hash text,
  p_event_payload jsonb
)
RETURNS SETOF public.calculation_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_run public.calculation_runs%ROWTYPE;
  next_revision integer;
BEGIN
  PERFORM public.lock_payrun01_run(p_calculation_run_id);
  SELECT run.* INTO current_run
  FROM public.calculation_runs AS run
  WHERE run.id = p_calculation_run_id
    AND run.payroll_administration_id = p_payroll_administration_id
    AND run.source_tenant_id = p_source_tenant_id
    AND run.source_hr_group_id = p_source_hr_group_id
    AND run.source_administration_id = p_source_administration_id
    AND run.run_type = 'INDIVIDUAL_PAYROLL'
    AND run.status = 'RUNNING'
  FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(p_event_payload) IS DISTINCT FROM 'object'
    OR p_result_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 concept completion requires a scoped running individual payroll and valid result payload.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.calculation_input_sets AS input_set
    JOIN public.source_snapshots AS source_snapshot
      ON source_snapshot.id = input_set.source_snapshot_id
     AND source_snapshot.source_tenant_id = input_set.source_tenant_id
     AND source_snapshot.source_hr_group_id = input_set.source_hr_group_id
     AND source_snapshot.source_administration_id = input_set.source_administration_id
    WHERE input_set.id = current_run.calculation_input_set_id
      AND input_set.payroll_administration_id = p_payroll_administration_id
      AND input_set.source_tenant_id = p_source_tenant_id
      AND input_set.source_hr_group_id = p_source_hr_group_id
      AND input_set.source_administration_id = p_source_administration_id
      AND input_set.payroll_period_id = p_payroll_period_id
      AND source_snapshot.source_employment_id = p_source_employment_id
      AND (
        EXISTS (
          SELECT 1 FROM public.individual_payroll_input_references AS input_ref
          WHERE input_ref.calculation_input_set_id = input_set.id
            AND input_ref.payroll_administration_id = p_payroll_administration_id
            AND input_ref.source_tenant_id = p_source_tenant_id
            AND input_ref.source_hr_group_id = p_source_hr_group_id
            AND input_ref.source_administration_id = p_source_administration_id
            AND input_ref.source_employment_id = p_source_employment_id
        )
        OR EXISTS (
          SELECT 1 FROM public.generic_payroll_input_references AS input_ref
          WHERE input_ref.calculation_input_set_id = input_set.id
            AND input_ref.payroll_administration_id = p_payroll_administration_id
            AND input_ref.source_tenant_id = p_source_tenant_id
            AND input_ref.source_hr_group_id = p_source_hr_group_id
            AND input_ref.source_administration_id = p_source_administration_id
            AND input_ref.source_employment_id = p_source_employment_id
            AND input_ref.source_hash = source_snapshot.source_hash
            AND input_ref.input_hash = input_set.input_hash
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 concept completion input reference does not match its period and employment.';
  END IF;

  UPDATE public.calculation_runs AS run
  SET status = 'SUCCEEDED', finished_at = p_finished_at, result_hash = p_result_hash,
      updated_at = now(), updated_by_user_id = p_actor_user_id
  WHERE run.id = p_calculation_run_id
    AND run.payroll_administration_id = p_payroll_administration_id
    AND run.source_tenant_id = p_source_tenant_id
    AND run.source_hr_group_id = p_source_hr_group_id
    AND run.source_administration_id = p_source_administration_id;

  SELECT coalesce(max(event.revision), 0) + 1 INTO next_revision
  FROM public.individual_payroll_lifecycle_events AS event
  WHERE event.payroll_administration_id = p_payroll_administration_id
    AND event.source_tenant_id = p_source_tenant_id
    AND event.source_hr_group_id = p_source_hr_group_id
    AND event.source_administration_id = p_source_administration_id
    AND event.payroll_period_id = p_payroll_period_id
    AND event.source_employment_id = p_source_employment_id;

  INSERT INTO public.individual_payroll_lifecycle_events (
    payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id,
    payroll_period_id, source_employment_id, calculation_run_id, revision, event_sequence,
    event_type, event_payload, created_by_user_id
  ) VALUES (
    p_payroll_administration_id, p_source_tenant_id, p_source_hr_group_id, p_source_administration_id,
    p_payroll_period_id, p_source_employment_id, p_calculation_run_id, next_revision, 1,
    'CONCEPT', p_event_payload, p_actor_user_id
  );

  RETURN QUERY
  SELECT run.* FROM public.calculation_runs AS run
  WHERE run.id = p_calculation_run_id
    AND run.payroll_administration_id = p_payroll_administration_id
    AND run.source_tenant_id = p_source_tenant_id
    AND run.source_hr_group_id = p_source_hr_group_id
    AND run.source_administration_id = p_source_administration_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_individual_payroll_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  prior_event text;
  prior_run_id uuid;
  latest_revision integer;
  run_status text;
  run_type text;
  linked_employment_id uuid;
  linked_period_id uuid;
BEGIN
  PERFORM public.lock_payrun01_run(NEW.calculation_run_id);
  SELECT run.status, run.run_type,
      coalesce(individual_ref.source_employment_id, generic_ref.source_employment_id), input_set.payroll_period_id
    INTO run_status, run_type, linked_employment_id, linked_period_id
    FROM public.calculation_runs AS run
    LEFT JOIN public.individual_payroll_input_references AS individual_ref
      ON individual_ref.calculation_input_set_id = run.calculation_input_set_id
     AND individual_ref.payroll_administration_id = run.payroll_administration_id
     AND individual_ref.source_tenant_id = run.source_tenant_id
     AND individual_ref.source_hr_group_id = run.source_hr_group_id
     AND individual_ref.source_administration_id = run.source_administration_id
    LEFT JOIN public.generic_payroll_input_references AS generic_ref
      ON generic_ref.calculation_input_set_id = run.calculation_input_set_id
     AND generic_ref.payroll_administration_id = run.payroll_administration_id
     AND generic_ref.source_tenant_id = run.source_tenant_id
     AND generic_ref.source_hr_group_id = run.source_hr_group_id
     AND generic_ref.source_administration_id = run.source_administration_id
    JOIN public.calculation_input_sets AS input_set
      ON input_set.id = run.calculation_input_set_id
     AND input_set.source_tenant_id = run.source_tenant_id
     AND input_set.source_hr_group_id = run.source_hr_group_id
     AND input_set.source_administration_id = run.source_administration_id
    WHERE run.id = NEW.calculation_run_id
      AND run.payroll_administration_id = NEW.payroll_administration_id
      AND run.source_tenant_id = NEW.source_tenant_id
      AND run.source_hr_group_id = NEW.source_hr_group_id
      AND run.source_administration_id = NEW.source_administration_id
      AND (individual_ref.id IS NOT NULL OR generic_ref.id IS NOT NULL);
  IF NOT FOUND OR run_type <> 'INDIVIDUAL_PAYROLL'
    OR linked_employment_id IS DISTINCT FROM NEW.source_employment_id
    OR linked_period_id IS DISTINCT FROM NEW.payroll_period_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 lifecycle requires an individual payroll run in the same scope.';
  END IF;

  SELECT max(event.revision) INTO latest_revision
  FROM public.individual_payroll_lifecycle_events AS event
  WHERE event.payroll_administration_id = NEW.payroll_administration_id
    AND event.source_tenant_id = NEW.source_tenant_id
    AND event.source_hr_group_id = NEW.source_hr_group_id
    AND event.source_administration_id = NEW.source_administration_id
    AND event.payroll_period_id = NEW.payroll_period_id
    AND event.source_employment_id = NEW.source_employment_id;
  IF (NEW.event_sequence = 1 AND NEW.revision <> coalesce(latest_revision, 0) + 1)
    OR (NEW.event_sequence > 1 AND NEW.revision IS DISTINCT FROM latest_revision) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 lifecycle revisions must advance one at a time and transitions must use the latest revision.';
  END IF;

  SELECT event.event_type, event.calculation_run_id INTO prior_event, prior_run_id
  FROM public.individual_payroll_lifecycle_events AS event
  WHERE event.payroll_administration_id = NEW.payroll_administration_id
    AND event.source_tenant_id = NEW.source_tenant_id
    AND event.source_hr_group_id = NEW.source_hr_group_id
    AND event.source_administration_id = NEW.source_administration_id
    AND event.payroll_period_id = NEW.payroll_period_id
    AND event.source_employment_id = NEW.source_employment_id
    AND event.revision = NEW.revision
  ORDER BY event.event_sequence DESC LIMIT 1;

  IF NEW.event_type = 'BLOCKED' THEN
    IF NEW.event_sequence <> 1 OR prior_event IS NOT NULL OR run_status NOT IN ('FAILED', 'SUCCEEDED') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A blocked PAYRUN01 revision requires a terminal run and no prior lifecycle event.';
    END IF;
  ELSIF NEW.event_type = 'CONCEPT' THEN
    IF NEW.event_sequence <> 1 OR prior_event IS NOT NULL OR run_status <> 'SUCCEEDED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A PAYRUN01 concept requires a successful run and no prior lifecycle event.';
    END IF;
  ELSIF NEW.event_type = 'REVIEWED' THEN
    IF NEW.event_sequence <> 2 OR prior_event IS DISTINCT FROM 'CONCEPT'
      OR prior_run_id IS DISTINCT FROM NEW.calculation_run_id OR run_status <> 'SUCCEEDED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 review must follow a successful concept.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payroll_controls AS control
      WHERE control.calculation_run_id = NEW.calculation_run_id
        AND control.payroll_administration_id = NEW.payroll_administration_id
        AND control.source_tenant_id = NEW.source_tenant_id
        AND control.source_hr_group_id = NEW.source_hr_group_id
        AND control.source_administration_id = NEW.source_administration_id
        AND control.status = 'FAIL') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 cannot be reviewed while blocking controls fail.';
    END IF;
  ELSIF NEW.event_type = 'FINALIZED' THEN
    IF NEW.event_sequence <> 3 OR prior_event IS DISTINCT FROM 'REVIEWED'
      OR prior_run_id IS DISTINCT FROM NEW.calculation_run_id OR run_status <> 'SUCCEEDED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 finalization must follow a successful review.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payroll_controls AS control
      WHERE control.calculation_run_id = NEW.calculation_run_id
        AND control.payroll_administration_id = NEW.payroll_administration_id
        AND control.source_tenant_id = NEW.source_tenant_id
        AND control.source_hr_group_id = NEW.source_hr_group_id
        AND control.source_administration_id = NEW.source_administration_id
        AND control.status = 'FAIL') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYRUN01 cannot be finalized while blocking controls fail.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.lock_payrun01_run(uuid) SET search_path = '';
ALTER FUNCTION public.payrun01_mark_succeeded_with_concept(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, jsonb) SET search_path = '';
ALTER FUNCTION public.guard_individual_payroll_lifecycle_event() SET search_path = '';
REVOKE ALL ON FUNCTION public.guard_generic_payroll_input_reference() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.lock_payrun01_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_payrun01_run(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.payrun01_mark_succeeded_with_concept(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payrun01_mark_succeeded_with_concept(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, timestamptz, text, jsonb) TO service_role;

COMMIT;
