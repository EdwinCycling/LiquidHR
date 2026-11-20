-- CONTRACT: alleen na gezamenlijke app-cutover en verificatie van actieve runtimes.
BEGIN;
REVOKE SELECT ON public.employment_payroll_tax_profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.employment_payroll_tax_profile_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id,
  income_relationship_id, employment_income_relationship_id, residence_country_code,
  wage_tax_table, herleiding_code, time_period, regular_wage_only, full_period_only,
  has_special_situation, payroll_tax_credit_applies, source_classification,
  effective_from, effective_to, version_number, supersedes_profile_id,
  confirmed_at, created_at) ON public.employment_payroll_tax_profiles TO authenticated;
GRANT SELECT (id, tenant_id, hr_group_id, administration_id, employee_id, employment_id,
  income_relationship_id, tax_profile_id, action, audit_payload, recorded_at)
  ON public.employment_payroll_tax_profile_audit TO authenticated;
COMMIT;
