-- DEV-only forward correction for the existing Employee Wizard salary-create path.
-- administration_hr_settings is scoped by tenant_id + administration_id; it has
-- no hr_group_id column. Keep the RPC SECURITY INVOKER and authorization guards.
do $$
declare
  function_oid oid;
  function_definition text;
  updated_definition text;
begin
  select p.oid, pg_get_functiondef(p.oid)
    into function_oid, function_definition
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'publish_complete_salary_application_employment'
    and pg_get_function_identity_arguments(p.oid) =
      'requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb';

  if function_oid is null then
    raise exception 'SALARY_APPLICATION_EMPLOYMENT_RPC_NOT_FOUND';
  end if;

  if (select prosecdef from pg_proc where oid = function_oid) then
    raise exception 'SALARY_APPLICATION_EMPLOYMENT_RPC_MUST_REMAIN_SECURITY_INVOKER';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'administration_hr_settings'
      and column_name = 'tenant_id'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'administration_hr_settings'
      and column_name = 'administration_id'
  ) then
    raise exception 'ADMINISTRATION_HR_SETTINGS_SCOPE_NOT_RECOGNIZED';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'administration_hr_settings'
      and column_name = 'hr_group_id'
  ) then
    raise exception 'ADMINISTRATION_HR_SETTINGS_ALREADY_HAS_HR_GROUP_SCOPE';
  end if;

  if length(function_definition) - length(
    replace(function_definition, 'settings.hr_group_id = employee_row.hr_group_id', '')
  ) = 0 then
    raise exception 'SALARY_APPLICATION_SETTINGS_HR_GROUP_PREDICATE_NOT_FOUND';
  end if;

  updated_definition := replace(
    function_definition,
    '    and settings.hr_group_id = employee_row.hr_group_id' || chr(10),
    ''
  );

  if updated_definition = function_definition then
    raise exception 'SALARY_APPLICATION_SETTINGS_HR_GROUP_PREDICATE_NOT_REPLACED';
  end if;

  execute updated_definition;

  select pg_get_functiondef(p.oid)
    into function_definition
  from pg_proc p
  where p.oid = function_oid;

  if position('settings.hr_group_id' in function_definition) > 0 then
    raise exception 'SALARY_APPLICATION_SETTINGS_HR_GROUP_PREDICATE_REMAINS';
  end if;

  if (select prosecdef from pg_proc where oid = function_oid) then
    raise exception 'SALARY_APPLICATION_EMPLOYMENT_RPC_BECAME_SECURITY_DEFINER';
  end if;
end;
$$;
