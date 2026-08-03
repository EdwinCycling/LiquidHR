do $$
declare
  column_count integer;
begin
  select count(*)
    into column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'talent_employee_capability_records'
    and column_name in (
      'certificate_issuing_body',
      'certificate_code',
      'certificate_validity_months',
      'certificate_is_permanent',
      'certificate_renewal_required',
      'evidence_status',
      'qualification_responsible_user_id'
    );
  if column_count <> 7 then raise exception 'M22_QUALIFICATION_COLUMNS_MISSING'; end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'talent_employee_capability_records'
      and indexname = 'talent_employee_capability_records_active_certificate_code_key'
  ) then raise exception 'M22_DUPLICATE_GUARD_MISSING'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'validate_talent_employee_capability_record'
  ) then raise exception 'M22_VALIDATION_TRIGGER_MISSING'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_talent_employee_capability_records'
  ) then raise exception 'M22_AUDIT_TRIGGER_MISSING'; end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'talent_employee_capability_records'
      and grantee in ('anon', 'public')
  ) then raise exception 'M22_PUBLIC_GRANT_PRESENT'; end if;
end;
$$;
