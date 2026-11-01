BEGIN;

-- A fiscal declaration is an immutable, effective-dated source record. It may
-- be recorded before the IKV is READY; the existing READY trigger and the
-- existing IKV transition service remain the only paths that can make the
-- relationship ready for filing or payroll.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.confirm_employment_payroll_tax_profile_v2(jsonb)'::pg_catalog.regprocedure
  ) INTO v_definition;

  IF v_definition IS NULL
    OR position('v_income.reporting_status = ''DRAFT''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_V2_DRAFT_GUARD_NOT_FOUND';
  END IF;

  v_definition := replace(
    replace(v_definition, chr(13) || chr(10), chr(10)),
    E'    OR v_income.reporting_status = ''DRAFT''\n',
    ''
  );
  EXECUTE v_definition;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS function_row
    JOIN pg_catalog.pg_namespace AS namespace_row ON namespace_row.oid = function_row.pronamespace
    WHERE namespace_row.nspname = 'public'
      AND function_row.oid = 'public.confirm_employment_payroll_tax_profile_v2(jsonb)'::pg_catalog.regprocedure
      AND function_row.prosecdef
  ) THEN
    RAISE EXCEPTION 'PAYROLL_TAX_PROFILE_V2_SECURITY_DEFINER_REQUIRED';
  END IF;
END;
$migration$;

REVOKE ALL ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) TO authenticated;

COMMENT ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) IS
  'Creates immutable, scope-checked, effective-dated fiscal profile versions from verified HR administration sources; READY remains a separate gated IKV transition.';

COMMIT;
