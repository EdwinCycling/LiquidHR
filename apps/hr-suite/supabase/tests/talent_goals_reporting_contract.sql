do $$
declare
  goal_policy_count integer;
begin
  if to_regclass('public.talent_development_goals') is null then
    raise exception 'Missing Talent development goals table';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = to_regclass('public.talent_development_goals')
      and relrowsecurity
  ) then
    raise exception 'Talent development goals RLS is disabled';
  end if;
  if has_table_privilege('anon', 'public.talent_development_goals', 'SELECT')
    or has_table_privilege('public', 'public.talent_development_goals', 'SELECT') then
    raise exception 'Anonymous/public goal SELECT grant exists';
  end if;

  select count(*) into goal_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'talent_development_goals';
  if goal_policy_count < 3 then
    raise exception 'Expected goal select/insert/update policies, found %', goal_policy_count;
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_development_goals_employee_idx')
    or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_development_goals_status_idx') then
    raise exception 'Goal scope/status indexes are missing';
  end if;

  if not exists (select 1 from public.permissions where code = 'talent-goal:manage')
    or not exists (select 1 from public.permissions where code = 'self:talent-goal:write')
    or not exists (select 1 from public.permissions where code = 'talent-report:read')
    or not exists (select 1 from public.permissions where code = 'talent-export:read')
    or not exists (select 1 from public.permissions where code = 'self:talent-export:read') then
    raise exception 'Goal/report/export permissions are missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_action_check'
      and pg_get_constraintdef(oid) like '%EXPORT%'
  ) then
    raise exception 'Audit EXPORT action constraint is missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'audit_logs_insert_authorized_events'
  ) then
    raise exception 'Talent export audit policy is missing';
  end if;
  if has_table_privilege('anon', 'public.audit_logs', 'INSERT')
    or has_table_privilege('public', 'public.audit_logs', 'INSERT') then
    raise exception 'Anonymous/public audit INSERT grant exists';
  end if;
end;
$$;
