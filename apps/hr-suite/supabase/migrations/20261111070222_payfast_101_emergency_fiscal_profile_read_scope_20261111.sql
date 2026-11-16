DO $p0$
DECLARE
  current_expr text;
  policy_count integer;
BEGIN
  SELECT count(*), max(pg_get_expr(p.polqual,p.polrelid))
    INTO policy_count,current_expr
  FROM pg_policy p
  WHERE p.polrelid='public.employment_payroll_tax_profiles'::regclass AND p.polcmd='r';
  IF policy_count <> 1 OR current_expr <>
     '(internal_security.has_hr_group_access(tenant_id, hr_group_id) AND internal_security.current_user_has_permission(tenant_id, administration_id, ''salary:read''::text))' THEN
    RAISE EXCEPTION 'PAYFAST_101_PREFLIGHT_POLICY_DRIFT';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.employment_payroll_tax_profiles'::regclass) THEN
    RAISE EXCEPTION 'PAYFAST_101_RLS_NOT_ENABLED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.management_roles WHERE code='TENANT_ADMIN' AND is_active)
     OR NOT EXISTS (SELECT 1 FROM public.management_roles WHERE code='DIRECT_MANAGER' AND is_active) THEN
    RAISE EXCEPTION 'PAYFAST_101_ROLE_PREFLIGHT_FAILED';
  END IF;
END
$p0$;
DROP POLICY employment_payroll_tax_profiles_read ON public.employment_payroll_tax_profiles;
CREATE POLICY employment_payroll_tax_profiles_read ON public.employment_payroll_tax_profiles
FOR SELECT TO authenticated USING (
    internal_security.has_hr_group_access(tenant_id, hr_group_id)
    AND (
      (
        employee_id = internal_security.current_employee_id(tenant_id, hr_group_id)
        AND internal_security.current_employee_has_permission(tenant_id, hr_group_id, 'self:salary:read')
      )
      OR (
        internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:read')
        AND EXISTS (
          SELECT 1
          FROM public.user_access ua
          JOIN public.management_roles mr ON mr.id=ua.management_role_id
          WHERE ua.user_id=(SELECT auth.uid())
            AND ua.tenant_id=employment_payroll_tax_profiles.tenant_id
            AND ua.is_active
            AND mr.is_active
            AND mr.code='TENANT_ADMIN'
            AND (mr.tenant_id IS NULL OR mr.tenant_id=employment_payroll_tax_profiles.tenant_id)
            AND (
              (ua.scope_type='TENANT' AND (ua.hr_group_id IS NULL OR ua.hr_group_id=employment_payroll_tax_profiles.hr_group_id))
              OR
              (ua.scope_type='ADMINISTRATION' AND ua.administration_id=employment_payroll_tax_profiles.administration_id
                AND (ua.hr_group_id IS NULL OR ua.hr_group_id=employment_payroll_tax_profiles.hr_group_id))
            )
        )
      )
    )
  );