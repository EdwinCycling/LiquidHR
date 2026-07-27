-- Uit te voeren tegen een gekoppelde Supabase-database na migratie.
-- Dit contract voorkomt diagnosevelden, kruis-tenant records en open mutatie-tabeltoegang.
select has_table_privilege('anon', 'public.absence_cases', 'select') = false as anon_absence_cases_denied;
select has_table_privilege('authenticated', 'public.absence_cases', 'select') = true as authenticated_absence_cases_readable;
select has_table_privilege('authenticated', 'public.absence_mutations', 'select') = false as mutation_keys_not_readable;
select not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name like 'absence_%'
    and column_name in ('diagnosis', 'medical_cause', 'doctor_name', 'medical_note')
) as no_medical_cause_columns;
select exists (
  select 1 from pg_policies where schemaname = 'public' and tablename = 'absence_cases' and policyname = 'absence_cases_select'
) as absence_cases_have_rls_policy;
