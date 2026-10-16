-- Cover every child-side fiscal profile foreign key and keep the scoped write RPC user-bound.
BEGIN;

CREATE INDEX IF NOT EXISTS employment_payroll_tax_profile_audit_actor_idx
  ON public.employment_payroll_tax_profile_audit (actor_user_id);
CREATE INDEX IF NOT EXISTS employment_payroll_tax_profile_audit_scope_idx
  ON public.employment_payroll_tax_profile_audit (
    tax_profile_id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id
  );
CREATE INDEX IF NOT EXISTS employment_payroll_tax_profiles_confirmed_by_idx
  ON public.employment_payroll_tax_profiles (confirmed_by_user_id);
CREATE INDEX IF NOT EXISTS employment_payroll_tax_profiles_employment_scope_fk_idx
  ON public.employment_payroll_tax_profiles (tenant_id, administration_id, employee_id, employment_id);
CREATE INDEX IF NOT EXISTS employment_payroll_tax_profiles_income_link_fk_idx
  ON public.employment_payroll_tax_profiles (employment_income_relationship_id);
CREATE INDEX IF NOT EXISTS employment_payroll_tax_profiles_income_scope_fk_idx
  ON public.employment_payroll_tax_profiles (tenant_id, administration_id, employee_id, income_relationship_id);
CREATE INDEX IF NOT EXISTS employment_payroll_tax_profiles_supersedes_scope_fk_idx
  ON public.employment_payroll_tax_profiles (
    supersedes_profile_id, tenant_id, hr_group_id, administration_id, employment_id, income_relationship_id
  );

REVOKE ALL ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_employment_payroll_tax_profile_v2(jsonb) TO authenticated;

COMMIT;
