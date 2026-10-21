BEGIN;

-- Bindings keep the complete employer number, its registered suffix, and the
-- employee's separate IKV number as distinct source values.
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

-- The old key treated an employer's IKV number as globally unique across
-- employees. The corrected identity is per employee, administration, and
-- full employer number; the suffix is part of that full number.
DROP INDEX IF EXISTS public.income_relationships_full_lhnr_ikv_active_key;
DROP INDEX IF EXISTS public.income_relationships_ikv_employee_active_key;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.income_relationships
    WHERE deleted_at IS NULL AND payroll_tax_number IS NOT NULL
    GROUP BY tenant_id, administration_id, employee_id, payroll_tax_number, ikv_number
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM public.income_relationships
    WHERE deleted_at IS NULL AND payroll_tax_number IS NULL
    GROUP BY tenant_id, administration_id, employee_id, ikv_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PAYROLL_IKV_IDENTITY_CONFLICT' USING ERRCODE = '23505';
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX income_relationships_employer_employee_ikv_active_key
  ON public.income_relationships (tenant_id, administration_id, employee_id, payroll_tax_number, ikv_number)
  WHERE deleted_at IS NULL AND payroll_tax_number IS NOT NULL;
CREATE UNIQUE INDEX income_relationships_unbound_employee_ikv_active_key
  ON public.income_relationships (tenant_id, administration_id, employee_id, ikv_number)
  WHERE deleted_at IS NULL AND payroll_tax_number IS NULL;

CREATE OR REPLACE FUNCTION internal_security.is_scoped_payroll_admin(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_access AS assignment
    JOIN public.management_roles AS role ON role.id = assignment.management_role_id
    WHERE assignment.user_id = (SELECT auth.uid())
      AND assignment.tenant_id = requested_tenant_id
      AND assignment.is_active
      AND (
        (
          assignment.scope_type::text = 'TENANT'
          AND assignment.administration_id IS NULL
          AND (assignment.hr_group_id IS NULL OR assignment.hr_group_id = requested_hr_group_id)
        )
        OR (
          assignment.scope_type::text = 'ADMINISTRATION'
          AND assignment.hr_group_id = requested_hr_group_id
          AND assignment.administration_id = requested_administration_id
        )
      )
      AND (role.tenant_id IS NULL OR role.tenant_id = requested_tenant_id)
      AND role.is_active
      AND role.deleted_at IS NULL
      AND role.code IN ('HR_ADMIN', 'TENANT_ADMIN')
  );
$function$;

REVOKE ALL ON FUNCTION internal_security.is_scoped_payroll_admin(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal_security.is_scoped_payroll_admin(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS administration_payroll_tax_numbers_select_group ON public.administration_payroll_tax_numbers;
DROP POLICY IF EXISTS administration_payroll_tax_numbers_insert_group ON public.administration_payroll_tax_numbers;
DROP POLICY IF EXISTS administration_payroll_tax_numbers_update_group ON public.administration_payroll_tax_numbers;

CREATE POLICY administration_payroll_tax_numbers_select_salary_scoped
  ON public.administration_payroll_tax_numbers FOR SELECT TO authenticated
  USING (
    (
      SELECT internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read'::text)
        OR internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write'::text)
    ) IS TRUE
    AND (SELECT internal_security.has_hr_group_access(tenant_id, hr_group_id)) IS TRUE
    AND (SELECT internal_security.is_scoped_payroll_admin(tenant_id, hr_group_id, administration_id)) IS TRUE
  );

CREATE POLICY administration_payroll_tax_numbers_insert_salary_admin
  ON public.administration_payroll_tax_numbers FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write'::text)) IS TRUE
    AND (SELECT internal_security.has_hr_group_access(tenant_id, hr_group_id)) IS TRUE
    AND (SELECT internal_security.is_scoped_payroll_admin(tenant_id, hr_group_id, administration_id)) IS TRUE
    AND created_by_user_id = (SELECT auth.uid())
  );

CREATE POLICY administration_payroll_tax_numbers_update_salary_admin
  ON public.administration_payroll_tax_numbers FOR UPDATE TO authenticated
  USING (
    (SELECT internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write'::text)) IS TRUE
    AND (SELECT internal_security.has_hr_group_access(tenant_id, hr_group_id)) IS TRUE
    AND (SELECT internal_security.is_scoped_payroll_admin(tenant_id, hr_group_id, administration_id)) IS TRUE
  )
  WITH CHECK (
    (SELECT internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write'::text)) IS TRUE
    AND (SELECT internal_security.has_hr_group_access(tenant_id, hr_group_id)) IS TRUE
    AND (SELECT internal_security.is_scoped_payroll_admin(tenant_id, hr_group_id, administration_id)) IS TRUE
  );

CREATE OR REPLACE FUNCTION internal_security.guard_administration_payroll_tax_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_old_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF v_actor IS NULL
    OR internal_security.current_user_has_permission(
      NEW.tenant_id, NEW.administration_id, 'salary:write'::text
    ) IS NOT TRUE
    OR internal_security.has_hr_group_access(NEW.tenant_id, NEW.hr_group_id) IS NOT TRUE
    OR internal_security.is_scoped_payroll_admin(
      NEW.tenant_id, NEW.hr_group_id, NEW.administration_id
    ) IS NOT TRUE THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF NEW.payroll_tax_number !~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'
    OR (NEW.valid_until IS NOT NULL AND NEW.valid_until < NEW.valid_from) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_INPUT_INVALID' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by_user_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_PROVENANCE_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSE
    v_old_id := OLD.id;
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
      OR OLD.hr_group_id IS DISTINCT FROM NEW.hr_group_id
      OR OLD.administration_id IS DISTINCT FROM NEW.administration_id
      OR OLD.payroll_tax_number IS DISTINCT FROM NEW.payroll_tax_number
      OR OLD.is_primary IS DISTINCT FROM NEW.is_primary
      OR OLD.valid_from IS DISTINCT FROM NEW.valid_from
      OR OLD.created_at IS DISTINCT FROM NEW.created_at
      OR OLD.created_by_user_id IS DISTINCT FROM NEW.created_by_user_id
      OR OLD.valid_until IS NOT NULL
      OR NEW.valid_until IS NULL THEN
      RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.tenant_id::text || ':' || NEW.administration_id::text)::bigint
  );

  IF TG_OP = 'UPDATE' AND NEW.valid_until IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.income_relationships AS relationship
    WHERE relationship.tenant_id = OLD.tenant_id
      AND relationship.administration_id = OLD.administration_id
      AND relationship.payroll_tax_binding_hr_group_id = OLD.hr_group_id
      AND relationship.payroll_tax_binding_id = OLD.id
      AND relationship.payroll_tax_number = OLD.payroll_tax_number
      AND relationship.reporting_status IN ('READY', 'REPORTED')
      AND relationship.starts_on <= NEW.valid_until
      AND (relationship.ends_on IS NULL OR relationship.ends_on > NEW.valid_until)
  ) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_BOUND_IKV_PERIOD_CONFLICT' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.administration_payroll_tax_numbers AS existing
    WHERE existing.tenant_id = NEW.tenant_id
      AND existing.administration_id = NEW.administration_id
      AND (v_old_id IS NULL OR existing.id <> v_old_id)
      AND (
        (
          existing.payroll_tax_number = NEW.payroll_tax_number
          AND (existing.valid_until IS NULL OR existing.valid_until >= NEW.valid_from)
          AND (NEW.valid_until IS NULL OR existing.valid_from <= NEW.valid_until)
        )
        OR (
          existing.is_primary AND NEW.is_primary
          AND (existing.valid_until IS NULL OR existing.valid_until >= NEW.valid_from)
          AND (NEW.valid_until IS NULL OR existing.valid_from <= NEW.valid_until)
        )
      )
  ) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_CONFLICT' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION internal_security.guard_administration_payroll_tax_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_administration_payroll_tax_number ON public.administration_payroll_tax_numbers;
CREATE TRIGGER guard_administration_payroll_tax_number
  BEFORE INSERT OR UPDATE OR DELETE ON public.administration_payroll_tax_numbers
  FOR EACH ROW EXECUTE FUNCTION internal_security.guard_administration_payroll_tax_number();

DROP TRIGGER IF EXISTS audit_administration_payroll_tax_numbers ON public.administration_payroll_tax_numbers;
DROP TRIGGER IF EXISTS audit_administration_payroll_tax_number_insert ON public.administration_payroll_tax_numbers;
DROP TRIGGER IF EXISTS audit_administration_payroll_tax_number_update ON public.administration_payroll_tax_numbers;
CREATE TRIGGER audit_administration_payroll_tax_number_insert
  AFTER INSERT ON public.administration_payroll_tax_numbers
  FOR EACH ROW EXECUTE FUNCTION internal_security.audit_hr_change('administration_payroll_tax_number');
CREATE TRIGGER audit_administration_payroll_tax_number_update
  AFTER UPDATE OF valid_until ON public.administration_payroll_tax_numbers
  FOR EACH ROW EXECUTE FUNCTION internal_security.audit_hr_change('administration_payroll_tax_number');

CREATE OR REPLACE FUNCTION public.register_administration_payroll_tax_number(
  requested_administration_id uuid,
  requested_payroll_tax_number text,
  requested_valid_from date,
  requested_valid_until date,
  requested_is_primary boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_hr_group_id uuid;
  v_existing public.administration_payroll_tax_numbers%ROWTYPE;
  v_primary public.administration_payroll_tax_numbers%ROWTYPE;
  v_id uuid;
BEGIN
  IF requested_payroll_tax_number !~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'
    OR requested_valid_from IS NULL
    OR (requested_valid_until IS NOT NULL AND requested_valid_until < requested_valid_from)
    OR requested_is_primary IS NULL THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT administration.tenant_id, administration.hr_group_id
    INTO v_tenant_id, v_hr_group_id
  FROM public.administrations AS administration
  WHERE administration.id = requested_administration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_actor IS NULL
    OR internal_security.current_user_has_permission(
      v_tenant_id, requested_administration_id, 'salary:write'::text
    ) IS NOT TRUE
    OR internal_security.has_hr_group_access(v_tenant_id, v_hr_group_id) IS NOT TRUE
    OR internal_security.is_scoped_payroll_admin(
      v_tenant_id, v_hr_group_id, requested_administration_id
    ) IS NOT TRUE THEN
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_tenant_id::text || ':' || requested_administration_id::text)::bigint
  );

  SELECT * INTO v_existing
  FROM public.administration_payroll_tax_numbers AS number
  WHERE number.tenant_id = v_tenant_id
    AND number.hr_group_id = v_hr_group_id
    AND number.administration_id = requested_administration_id
    AND number.payroll_tax_number = requested_payroll_tax_number
    AND number.valid_from = requested_valid_from
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.is_primary IS DISTINCT FROM requested_is_primary THEN
      RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_CONFLICT' USING ERRCODE = '23505';
    END IF;
    IF v_existing.valid_until IS NOT DISTINCT FROM requested_valid_until THEN
      RETURN v_existing.id;
    END IF;
    IF v_existing.valid_until IS NULL AND requested_valid_until IS NOT NULL THEN
      UPDATE public.administration_payroll_tax_numbers AS number
        SET valid_until = requested_valid_until
      WHERE number.id = v_existing.id;
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_CONFLICT' USING ERRCODE = '23505';
  END IF;

  IF requested_is_primary THEN
    SELECT * INTO v_primary
    FROM public.administration_payroll_tax_numbers AS number
    WHERE number.tenant_id = v_tenant_id
      AND number.hr_group_id = v_hr_group_id
      AND number.administration_id = requested_administration_id
      AND number.is_primary
      AND number.valid_until IS NULL
    ORDER BY number.valid_from DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF requested_valid_from <= v_primary.valid_from THEN
        RAISE EXCEPTION 'PAYROLL_TAX_NUMBER_CONFLICT' USING ERRCODE = '23505';
      END IF;
      UPDATE public.administration_payroll_tax_numbers AS number
        SET valid_until = requested_valid_from - 1
      WHERE number.id = v_primary.id;
    END IF;
  END IF;

  INSERT INTO public.administration_payroll_tax_numbers (
    tenant_id, hr_group_id, administration_id, payroll_tax_number,
    is_primary, valid_from, valid_until, created_by_user_id
  ) VALUES (
    v_tenant_id, v_hr_group_id, requested_administration_id, requested_payroll_tax_number,
    requested_is_primary, requested_valid_from, requested_valid_until, v_actor
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.register_administration_payroll_tax_number(uuid, text, date, date, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_administration_payroll_tax_number(uuid, text, date, date, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION internal_security.validate_income_relationship_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_hr_group_id uuid;
  v_tax_number_count integer := 0;
  v_link_count integer := 0;
  v_invalid_link_count integer := 0;
  v_link record;
  v_contract record;
  v_covered_until date;
  v_required_end_exclusive date;
  v_has_bsn boolean := false;
  v_validate boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_validate := NEW.reporting_status = 'READY';
  ELSE
    v_validate := NEW.reporting_status = 'READY' AND (
      OLD.reporting_status IS DISTINCT FROM NEW.reporting_status
      OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
      OR OLD.administration_id IS DISTINCT FROM NEW.administration_id
      OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
      OR OLD.relationship_type IS DISTINCT FROM NEW.relationship_type
      OR OLD.starts_on IS DISTINCT FROM NEW.starts_on
      OR OLD.ends_on IS DISTINCT FROM NEW.ends_on
      OR OLD.ikv_number IS DISTINCT FROM NEW.ikv_number
      OR OLD.payroll_tax_subnumber IS DISTINCT FROM NEW.payroll_tax_subnumber
      OR OLD.payroll_tax_number IS DISTINCT FROM NEW.payroll_tax_number
      OR OLD.payroll_tax_binding_hr_group_id IS DISTINCT FROM NEW.payroll_tax_binding_hr_group_id
      OR OLD.payroll_tax_binding_id IS DISTINCT FROM NEW.payroll_tax_binding_id
      OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
    );
  END IF;
  IF NOT v_validate THEN
    RETURN NEW;
  END IF;

  SELECT administration.hr_group_id INTO v_hr_group_id
  FROM public.administrations AS administration
  WHERE administration.tenant_id = NEW.tenant_id
    AND administration.id = NEW.administration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_IKV_ADMINISTRATION_INVALID' USING ERRCODE = '23503';
  END IF;

  IF v_actor IS NULL
    OR internal_security.current_user_has_permission(
      NEW.tenant_id, NEW.administration_id, 'salary:write'::text
    ) IS NOT TRUE
    OR internal_security.has_hr_group_access(NEW.tenant_id, v_hr_group_id) IS NOT TRUE
    OR internal_security.is_scoped_payroll_admin(
      NEW.tenant_id, v_hr_group_id, NEW.administration_id
    ) IS NOT TRUE THEN
    RAISE EXCEPTION 'PAYROLL_IKV_READY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.tenant_id::text || ':' || NEW.administration_id::text)::bigint
  );

  IF NEW.relationship_type <> 'EMPLOYMENT'
    OR NEW.deleted_at IS NOT NULL
    OR NEW.ikv_number NOT BETWEEN 1 AND 99
    OR NEW.payroll_tax_subnumber !~ '^L(0[1-9]|[1-9][0-9])$'
    OR (NEW.ends_on IS NOT NULL AND NEW.ends_on < NEW.starts_on) THEN
    RAISE EXCEPTION 'PAYROLL_IKV_SOURCE_INVALID' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees AS employee
    WHERE employee.tenant_id = NEW.tenant_id
      AND employee.hr_group_id = v_hr_group_id
      AND employee.id = NEW.employee_id
      AND employee.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYEE_INVALID' USING ERRCODE = '23503';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.employee_secure_identifiers AS identifier
    WHERE identifier.tenant_id = NEW.tenant_id
      AND identifier.employee_id = NEW.employee_id
      AND identifier.bsn_fingerprint IS NOT NULL
  ) INTO v_has_bsn;
  IF NOT v_has_bsn THEN
    RAISE EXCEPTION 'PAYROLL_IKV_BSN_REQUIRED' USING ERRCODE = '23514';
  END IF;

  IF NEW.payroll_tax_binding_id IS NULL
    OR NEW.payroll_tax_binding_hr_group_id IS DISTINCT FROM v_hr_group_id
    OR NEW.payroll_tax_number IS NULL
    OR NEW.payroll_tax_number !~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'
    OR right(NEW.payroll_tax_number, 3) IS DISTINCT FROM NEW.payroll_tax_subnumber THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYER_TAX_NUMBER_REQUIRED' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer INTO v_tax_number_count
  FROM public.administration_payroll_tax_numbers AS tax_number
  WHERE tax_number.tenant_id = NEW.tenant_id
    AND tax_number.hr_group_id = v_hr_group_id
    AND tax_number.administration_id = NEW.administration_id
    AND tax_number.id = NEW.payroll_tax_binding_id
    AND tax_number.payroll_tax_number = NEW.payroll_tax_number
    AND right(tax_number.payroll_tax_number, 3) = NEW.payroll_tax_subnumber
    AND tax_number.valid_from <= NEW.starts_on
    AND (
      (NEW.ends_on IS NULL AND tax_number.valid_until IS NULL)
      OR (NEW.ends_on IS NOT NULL AND (tax_number.valid_until IS NULL OR tax_number.valid_until >= NEW.ends_on))
    );
  IF v_tax_number_count <> 1 THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYER_TAX_NUMBER_BINDING_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer INTO v_link_count
  FROM public.employment_income_relationships AS link
  WHERE link.tenant_id = NEW.tenant_id
    AND link.administration_id = NEW.administration_id
    AND link.employee_id = NEW.employee_id
    AND link.income_relationship_id = NEW.id;
  IF v_link_count = 0 THEN
    RAISE EXCEPTION 'PAYROLL_IKV_EMPLOYMENT_LINK_REQUIRED' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer INTO v_invalid_link_count
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
      IF v_covered_until IS NULL OR v_contract.starts_on > v_covered_until THEN
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

DROP TRIGGER IF EXISTS validate_income_relationship_ready ON public.income_relationships;
CREATE TRIGGER validate_income_relationship_ready
  BEFORE INSERT OR UPDATE OF reporting_status, tenant_id, administration_id, employee_id,
    relationship_type, starts_on, ends_on, ikv_number, payroll_tax_subnumber,
    payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id, deleted_at
  ON public.income_relationships
  FOR EACH ROW EXECUTE FUNCTION internal_security.validate_income_relationship_ready();

DROP TRIGGER IF EXISTS audit_income_relationship_reporting_status ON public.income_relationships;
DROP TRIGGER IF EXISTS audit_income_relationship_payroll_readiness ON public.income_relationships;
DROP TRIGGER IF EXISTS audit_income_relationship_payroll_readiness_insert ON public.income_relationships;
DROP TRIGGER IF EXISTS audit_income_relationship_payroll_readiness_update ON public.income_relationships;
CREATE TRIGGER audit_income_relationship_payroll_readiness_insert
  AFTER INSERT ON public.income_relationships
  FOR EACH ROW EXECUTE FUNCTION internal_security.audit_hr_change('income_relationship');
CREATE TRIGGER audit_income_relationship_payroll_readiness_update
  AFTER UPDATE OF reporting_status, administration_id, employee_id,
    relationship_type, starts_on, ends_on, ikv_number, payroll_tax_subnumber,
    payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id, deleted_at
  ON public.income_relationships
  FOR EACH ROW EXECUTE FUNCTION internal_security.audit_hr_change('income_relationship');

COMMIT;
