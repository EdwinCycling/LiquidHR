DO $p0$
DECLARE old_expr text; n integer;
BEGIN
 SELECT count(*),max(pg_get_expr(polqual,polrelid)) INTO n,old_expr
 FROM pg_policy WHERE polrelid='public.employment_payroll_tax_profile_audit'::regclass AND polcmd='r';
 IF n<>1 OR old_expr <> '(internal_security.has_hr_group_access(tenant_id, hr_group_id) AND internal_security.current_user_has_permission(tenant_id, administration_id, ''salary:read''::text))'
 THEN RAISE EXCEPTION 'PAYFAST_101_AUDIT_POLICY_DRIFT'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.employment_payroll_tax_profile_audit'::regclass)
 THEN RAISE EXCEPTION 'PAYFAST_101_AUDIT_RLS_MISSING'; END IF;
END $p0$;
DROP POLICY employment_payroll_tax_profile_audit_read ON public.employment_payroll_tax_profile_audit;
CREATE POLICY employment_payroll_tax_profile_audit_read ON public.employment_payroll_tax_profile_audit
FOR SELECT TO authenticated USING (
 internal_security.has_hr_group_access(tenant_id,hr_group_id)
 AND internal_security.current_user_has_permission(tenant_id,administration_id,'salary:read')
 AND EXISTS (
  SELECT 1 FROM public.user_access ua
  JOIN public.management_roles mr ON mr.id=ua.management_role_id
  WHERE ua.user_id=(SELECT auth.uid())
    AND ua.tenant_id=employment_payroll_tax_profile_audit.tenant_id
    AND ua.is_active AND mr.is_active AND mr.code='TENANT_ADMIN'
    AND (mr.tenant_id IS NULL OR mr.tenant_id=employment_payroll_tax_profile_audit.tenant_id)
    AND (
      (ua.scope_type='TENANT' AND (ua.hr_group_id IS NULL OR ua.hr_group_id=employment_payroll_tax_profile_audit.hr_group_id))
      OR
      (ua.scope_type='ADMINISTRATION' AND ua.administration_id=employment_payroll_tax_profile_audit.administration_id
        AND (ua.hr_group_id IS NULL OR ua.hr_group_id=employment_payroll_tax_profile_audit.hr_group_id))
    )
 )
);