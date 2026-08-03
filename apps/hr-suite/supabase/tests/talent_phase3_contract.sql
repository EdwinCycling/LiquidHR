do $$
declare
  notification_policy_count integer;
  check_in_policy_count integer;
begin
  if to_regclass('public.talent_notifications') is null or to_regclass('public.talent_goal_check_ins') is null then
    raise exception 'P3 Talent tables are missing';
  end if;
  if not exists (select 1 from pg_class where oid = to_regclass('public.talent_notifications') and relrowsecurity)
    or not exists (select 1 from pg_class where oid = to_regclass('public.talent_goal_check_ins') and relrowsecurity) then
    raise exception 'P3 Talent RLS is disabled';
  end if;
  if has_table_privilege('anon', 'public.talent_notifications', 'SELECT')
    or has_table_privilege('anon', 'public.talent_goal_check_ins', 'SELECT') then
    raise exception 'Anonymous P3 Talent SELECT grant exists';
  end if;
  select count(*) into notification_policy_count from pg_policies where schemaname = 'public' and tablename = 'talent_notifications';
  select count(*) into check_in_policy_count from pg_policies where schemaname = 'public' and tablename = 'talent_goal_check_ins';
  if notification_policy_count < 3 or check_in_policy_count < 3 then
    raise exception 'P3 RLS policies are incomplete';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_notifications_dedupe_idx')
    or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'talent_goal_check_ins_goal_idx') then
    raise exception 'P3 dedupe or goal indexes are missing';
  end if;
  if not exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'create_talent_notification'
      and not procedure.prosecdef
  ) then
    raise exception 'Talent notification creation must remain SECURITY INVOKER';
  end if;
end;
$$;
