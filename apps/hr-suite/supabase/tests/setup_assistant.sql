begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['setup_guide_settings', 'setup_step_completion'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'SETUP_ASSISTANT_TABLE_MISSING_%', table_name;
    end if;
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'SETUP_ASSISTANT_RLS_MISSING_%', table_name;
    end if;
    if not exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = table_name
        and policy.roles = array['authenticated']::name[]
    ) then
      raise exception 'SETUP_ASSISTANT_POLICY_MISSING_%', table_name;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.setup_guide_settings', 'select')
     or has_table_privilege('anon', 'public.setup_step_completion', 'select') then
    raise exception 'SETUP_ASSISTANT_ANON_SELECT_GRANT_REMAINS';
  end if;
  if not has_table_privilege('authenticated', 'public.setup_guide_settings', 'select,insert,update,delete')
     or not has_table_privilege('authenticated', 'public.setup_step_completion', 'select,insert,update,delete') then
    raise exception 'SETUP_ASSISTANT_AUTHENTICATED_GRANT_MISSING';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'setup_guide_settings'
      and indexdef like '%(tenant_id, hr_group_id, guide_code)%'
  ) then
    raise exception 'SETUP_ASSISTANT_SETTINGS_KEY_MISSING';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'setup_step_completion'
      and indexdef like '%(tenant_id, hr_group_id, guide_code, step_key)%'
  ) then
    raise exception 'SETUP_ASSISTANT_COMPLETION_KEY_MISSING';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.setup_guide_settings'::regclass
      and tgname = 'audit_setup_guide_settings'
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.setup_step_completion'::regclass
      and tgname = 'audit_setup_step_completion'
  ) then
    raise exception 'SETUP_ASSISTANT_AUDIT_TRIGGER_MISSING';
  end if;
end;
$$;

rollback;
