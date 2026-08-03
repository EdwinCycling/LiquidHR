do $$
declare
  table_exists boolean;
  rls_enabled boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'talent_employee_capability_records'
  ) into table_exists;
  if not table_exists then raise exception 'M21_TABLE_MISSING'; end if;

  select relrowsecurity
    into rls_enabled
  from pg_class
  join pg_namespace on pg_namespace.oid = pg_class.relnamespace
  where pg_namespace.nspname = 'public'
    and pg_class.relname = 'talent_employee_capability_records';
  if not rls_enabled then raise exception 'M21_RLS_DISABLED'; end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'talent_employee_capability_records'
      and grantee in ('anon', 'public')
  ) then raise exception 'M21_PUBLIC_GRANT_PRESENT'; end if;

  if not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'talent_employee_capability_records'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ) then raise exception 'M21_AUTHENTICATED_SELECT_MISSING'; end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'talent_employee_capability_records' and policyname = 'talent_employee_capability_records_select') then raise exception 'M21_SELECT_POLICY_MISSING'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'talent_employee_capability_records' and policyname = 'talent_employee_capability_records_insert') then raise exception 'M21_INSERT_POLICY_MISSING'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'talent_employee_capability_records' and policyname = 'talent_employee_capability_records_update') then raise exception 'M21_UPDATE_POLICY_MISSING'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_talent_employee_capability_records') then raise exception 'M21_AUDIT_TRIGGER_MISSING'; end if;
  if not exists (select 1 from public.permissions where code in ('talent-record:read', 'talent-record:write', 'self:talent-record:read', 'self:talent-record:write') group by category having count(*) = 4) then raise exception 'M21_PERMISSION_SEED_MISSING'; end if;
end;
$$;
