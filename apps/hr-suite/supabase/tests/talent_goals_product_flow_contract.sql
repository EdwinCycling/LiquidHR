do $$
declare
  goal_function_security_definer boolean;
  check_in_function_security_definer boolean;
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.talent_goal_check_ins'::regclass
      and conname = 'talent_goal_check_ins_follow_up_due_on_check'
  ) then
    raise exception 'Follow-up due-date constraint is missing';
  end if;

  select procedure.prosecdef into goal_function_security_definer
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'internal_security'
    and procedure.proname = 'validate_talent_development_goal';
  select procedure.prosecdef into check_in_function_security_definer
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'internal_security'
    and procedure.proname = 'validate_talent_goal_check_in';
  if goal_function_security_definer is distinct from true or check_in_function_security_definer is distinct from true then
    raise exception 'Talent status validation triggers must remain SECURITY DEFINER';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'talent_goal_check_ins'
      and policyname = 'talent_goal_check_ins_update'
      and policyname is not null
      and (qual::text like '%status = ''OPEN''%' or qual::text like '%status = ''OPEN''%')
  ) then
    raise exception 'Check-in update policy must be limited to open entries for non-HR actors';
  end if;
end;
$$;
