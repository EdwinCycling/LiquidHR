BEGIN;

-- Reconcile the tracked schema with the existing explicit payroll-tax binding
-- columns. Existing TEST has these fields and constraints; fresh migration
-- chains need the same source model before the readiness validator is created.
ALTER TABLE public.income_relationships
  ADD COLUMN IF NOT EXISTS payroll_tax_number text,
  ADD COLUMN IF NOT EXISTS payroll_tax_binding_hr_group_id uuid,
  ADD COLUMN IF NOT EXISTS payroll_tax_binding_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS administration_payroll_tax_numbers_scope_id_key
  ON public.administration_payroll_tax_numbers (tenant_id, hr_group_id, administration_id, id);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.income_relationships'::regclass
      AND conname = 'income_relationships_payroll_tax_binding_pair_check'
  ) THEN
    ALTER TABLE public.income_relationships
      ADD CONSTRAINT income_relationships_payroll_tax_binding_pair_check
      CHECK (
        (payroll_tax_number IS NULL AND payroll_tax_binding_hr_group_id IS NULL AND payroll_tax_binding_id IS NULL)
        OR (payroll_tax_number IS NOT NULL AND payroll_tax_binding_hr_group_id IS NOT NULL AND payroll_tax_binding_id IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.income_relationships'::regclass
      AND conname = 'income_relationships_payroll_tax_binding_scope_fkey'
  ) THEN
    ALTER TABLE public.income_relationships
      ADD CONSTRAINT income_relationships_payroll_tax_binding_scope_fkey
      FOREIGN KEY (tenant_id, payroll_tax_binding_hr_group_id, administration_id, payroll_tax_binding_id)
      REFERENCES public.administration_payroll_tax_numbers (tenant_id, hr_group_id, administration_id, id)
      ON DELETE RESTRICT;
  END IF;
END;
$migration$;

CREATE FUNCTION internal_security.validate_income_relationship_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_hr_group_id uuid;
  v_employee_number text;
  v_has_bsn boolean := false;
  v_tax_number_count integer := 0;
  v_link_count integer := 0;
  v_invalid_link_count integer := 0;
  v_link record;
  v_contract record;
  v_covered_until date;
  v_required_end_exclusive date;
BEGIN
  IF OLD.reporting_status IS NOT DISTINCT FROM NEW.reporting_status
    OR OLD.reporting_status <> 'DRAFT'
    OR NEW.reporting_status <> 'READY' THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL
    OR internal_security.has_hr_group_access(NEW.tenant_id, (
      SELECT administration.hr_group_id
      FROM public.administrations AS administration
      WHERE administration.tenant_id = NEW.tenant_id
        AND administration.id = NEW.administration_id
    )) IS NOT TRUE
    OR internal_security.current_user_has_permission(
      NEW.tenant_id, NEW.administration_id, 'salary:write'::text
    ) IS NOT TRUE
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_access AS assignment
      JOIN public.management_roles AS role ON role.id = assignment.management_role_id
      WHERE assignment.user_id = v_actor
        AND assignment.tenant_id = NEW.tenant_id
        AND assignment.is_active
        AND (
          (assignment.scope_type = 'TENANT' AND assignment.administration_id IS NULL)
          OR (assignment.scope_type = 'ADMINISTRATION' AND assignment.administration_id = NEW.administration_id)
        )
        AND (role.tenant_id IS NULL OR role.tenant_id = NEW.tenant_id)
        AND role.is_active
        AND role.deleted_at IS NULL
        AND role.code IN ('HR_ADMIN', 'TENANT_ADMIN')
    ) THEN
    RAISE EXCEPTION 'PAYROLL_IKV_READY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF NEW.relationship_type <> 'EMPLOYMENT'
    OR NEW.deleted_at IS NOT NULL
    OR NEW.ikv_number NOT BETWEEN 1 AND 99
    OR NEW.payroll_tax_subnumber !~ '^(L)?(0[1-9]|[1-9][0-9])$'
    OR (NEW.ends_on IS NOT NULL AND NEW.ends_on < NEW.starts_on) THEN
    RAISE EXCEPTION 'PAYROLL_IKV_SOURCE_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT administration.hr_group_id
    INTO v_hr_group_id
  FROM public.administrations AS administration
  WHERE administration.tenant_id = NEW.tenant_id
    AND administration.id = NEW.administration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_IKV_ADMINISTRATION_INVALID' USING ERRCODE = '23503';
  END IF;

  SELECT employee.employee_number
    INTO v_employee_number
  FROM public.employees AS employee
  WHERE employee.tenant_id = NEW.tenant_id
    AND employee.id = NEW.employee_id
    AND employee.hr_group_id = v_hr_group_id
    AND employee.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYEE_INVALID' USING ERRCODE = '23503';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.employee_secure_identifiers AS identifier
    WHERE identifier.tenant_id = NEW.tenant_id
      AND identifier.employee_id = NEW.employee_id
      AND identifier.bsn_fingerprint IS NOT NULL
  ) INTO v_has_bsn;
  IF NULLIF(btrim(v_employee_number), '') IS NULL AND NOT v_has_bsn THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYEE_IDENTIFIER_REQUIRED' USING ERRCODE = '23514';
  END IF;

  -- The IKV must point to its exact registered number, within this
  -- administration and HR group, and that number must cover the full period.
  IF NEW.payroll_tax_binding_id IS NULL
    OR NEW.payroll_tax_binding_hr_group_id IS DISTINCT FROM v_hr_group_id
    OR NULLIF(btrim(NEW.payroll_tax_number), '') IS NULL THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYER_TAX_NUMBER_REQUIRED' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
    INTO v_tax_number_count
  FROM public.administration_payroll_tax_numbers AS tax_number
  WHERE tax_number.tenant_id = NEW.tenant_id
    AND tax_number.hr_group_id = v_hr_group_id
    AND tax_number.administration_id = NEW.administration_id
    AND tax_number.id = NEW.payroll_tax_binding_id
    AND tax_number.payroll_tax_number = NEW.payroll_tax_number
    AND right(tax_number.payroll_tax_number, char_length(NEW.payroll_tax_subnumber)) = NEW.payroll_tax_subnumber
    AND tax_number.valid_from <= NEW.starts_on
    AND (
      (NEW.ends_on IS NULL AND tax_number.valid_until IS NULL)
      OR (NEW.ends_on IS NOT NULL AND (tax_number.valid_until IS NULL OR tax_number.valid_until >= NEW.ends_on))
    );
  IF v_tax_number_count = 0 THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYER_TAX_NUMBER_BINDING_INVALID' USING ERRCODE = '23514';
  ELSIF v_tax_number_count > 1 THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYER_TAX_NUMBER_AMBIGUOUS' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
    INTO v_link_count
  FROM public.employment_income_relationships AS link
  WHERE link.tenant_id = NEW.tenant_id
    AND link.administration_id = NEW.administration_id
    AND link.employee_id = NEW.employee_id
    AND link.income_relationship_id = NEW.id;
  IF v_link_count = 0 THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYMENT_LINK_REQUIRED' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
    INTO v_invalid_link_count
  FROM public.employment_income_relationships AS link
  LEFT JOIN public.employments AS employment
    ON employment.tenant_id = link.tenant_id
   AND employment.administration_id = link.administration_id
   AND employment.employee_id = link.employee_id
   AND employment.id = link.employment_id
  WHERE link.tenant_id = NEW.tenant_id
    AND link.administration_id = NEW.administration_id
    AND link.employee_id = NEW.employee_id
    AND link.income_relationship_id = NEW.id
    AND (
      employment.id IS NULL
      OR employment.deleted_at IS NOT NULL
      OR employment.record_status <> 'CONFIRMED'
      OR link.valid_from < NEW.starts_on
      OR (NEW.ends_on IS NOT NULL AND (link.valid_until IS NULL OR link.valid_until > NEW.ends_on + 1))
      OR employment.starts_on > link.valid_from
      OR (employment.ends_on IS NOT NULL AND (link.valid_until IS NULL OR link.valid_until > employment.ends_on + 1))
    );
  IF v_invalid_link_count > 0 THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYMENT_SOURCE_INVALID' USING ERRCODE = '23514';
  END IF;

  -- A confirmed employment can have several consecutive contracts. Their
  -- union must cover each IKV link; requiring one contract to span the entire
  -- link would reject a valid, uninterrupted contract chain.
  FOR v_link IN
    SELECT link.valid_from, link.valid_until, link.employment_id
    FROM public.employment_income_relationships AS link
    WHERE link.tenant_id = NEW.tenant_id
      AND link.administration_id = NEW.administration_id
      AND link.employee_id = NEW.employee_id
      AND link.income_relationship_id = NEW.id
    ORDER BY link.valid_from, link.valid_until NULLS LAST
  LOOP
    v_covered_until := v_link.valid_from;
    FOR v_contract IN
      SELECT contract.starts_on, contract.ends_on
      FROM public.employment_contracts AS contract
      WHERE contract.tenant_id = NEW.tenant_id
        AND contract.administration_id = NEW.administration_id
        AND contract.employee_id = NEW.employee_id
        AND contract.employment_id = v_link.employment_id
      ORDER BY contract.starts_on, contract.ends_on NULLS LAST
    LOOP
      IF v_covered_until IS NULL THEN
        EXIT;
      END IF;
      IF v_contract.starts_on > v_covered_until THEN
        EXIT;
      END IF;
      IF v_contract.ends_on IS NULL THEN
        v_covered_until := NULL;
        EXIT;
      END IF;
      IF v_contract.ends_on + 1 > v_covered_until THEN
        v_covered_until := v_contract.ends_on + 1;
      END IF;
      IF v_link.valid_until IS NOT NULL AND v_covered_until >= v_link.valid_until THEN
        EXIT;
      END IF;
    END LOOP;
    IF (v_link.valid_until IS NULL AND v_covered_until IS NOT NULL)
      OR (v_link.valid_until IS NOT NULL AND v_covered_until < v_link.valid_until) THEN
      RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYMENT_SOURCE_INVALID' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  v_covered_until := NEW.starts_on;
  v_required_end_exclusive := CASE WHEN NEW.ends_on IS NULL THEN NULL ELSE NEW.ends_on + 1 END;
  FOR v_link IN
    SELECT link.valid_from, link.valid_until
    FROM public.employment_income_relationships AS link
    WHERE link.tenant_id = NEW.tenant_id
      AND link.administration_id = NEW.administration_id
      AND link.employee_id = NEW.employee_id
      AND link.income_relationship_id = NEW.id
    ORDER BY link.valid_from, link.valid_until NULLS LAST
  LOOP
    IF v_link.valid_from > v_covered_until THEN
      RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYMENT_LINK_GAP' USING ERRCODE = '23514';
    END IF;
    IF v_link.valid_until IS NULL THEN
      v_covered_until := NULL;
      EXIT;
    END IF;
    IF v_link.valid_until > v_covered_until THEN
      v_covered_until := v_link.valid_until;
    END IF;
    IF v_required_end_exclusive IS NOT NULL AND v_covered_until >= v_required_end_exclusive THEN
      EXIT;
    END IF;
  END LOOP;
  IF (v_required_end_exclusive IS NULL AND v_covered_until IS NOT NULL)
    OR (v_required_end_exclusive IS NOT NULL AND v_covered_until < v_required_end_exclusive) THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYMENT_LINK_GAP' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION internal_security.validate_income_relationship_ready() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_income_relationship_ready
  BEFORE UPDATE OF reporting_status ON public.income_relationships
  FOR EACH ROW EXECUTE FUNCTION internal_security.validate_income_relationship_ready();

CREATE TRIGGER audit_income_relationship_reporting_status
  AFTER UPDATE OF reporting_status ON public.income_relationships
  FOR EACH ROW
  WHEN (OLD.reporting_status IS DISTINCT FROM NEW.reporting_status)
  EXECUTE FUNCTION internal_security.audit_hr_change('income_relationship');

COMMIT;
