-- CONCEPT: uitsluitend voor het onderzochte ACL-uitgangspunt (anon/authenticated
-- tabelbrede SELECT). Vergelijk vóór uitvoering de actuele tabel- en kolom-ACL's.
-- Na CONTRACT: herstel eerst bestaande tabelrechten en verwijder de expliciete
-- CONTRACT-kolomgrants; dit maakt metadata weer leesbaar binnen bestaande RLS.
BEGIN;
GRANT SELECT ON public.employment_payroll_tax_profiles, public.employment_payroll_tax_profile_audit TO anon, authenticated;
REVOKE SELECT (id,tenant_id,hr_group_id,administration_id,employee_id,employment_id,income_relationship_id,employment_income_relationship_id,residence_country_code,wage_tax_table,herleiding_code,time_period,regular_wage_only,full_period_only,has_special_situation,payroll_tax_credit_applies,source_classification,effective_from,effective_to,version_number,supersedes_profile_id,confirmed_at,created_at) ON public.employment_payroll_tax_profiles FROM authenticated;
REVOKE SELECT (id,tenant_id,hr_group_id,administration_id,employee_id,employment_id,income_relationship_id,tax_profile_id,action,audit_payload,recorded_at) ON public.employment_payroll_tax_profile_audit FROM authenticated;
COMMIT;
-- Pas nadat alle nieuwe applicatieruntimes zijn teruggedraaid:
-- DROP FUNCTION public.sec101_profile_metadata(uuid[]);
-- DROP FUNCTION public.sec101_provenance_key_fingerprint();
-- DROP TABLE internal_security.sec101_provenance_public_key;
