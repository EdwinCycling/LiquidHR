do $$
declare
  table_name text;
  policy_count integer;
begin
  foreach table_name in array array['talent_review_campaigns', 'talent_review_assignments', 'talent_review_assignment_members', 'talent_review_scores'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing Talent review table: %', table_name;
    end if;
    if not exists (
      select 1 from pg_class
      where oid = to_regclass('public.' || table_name)
        and relrowsecurity
    ) then
      raise exception 'RLS is disabled on %', table_name;
    end if;
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT')
      or has_table_privilege('public', 'public.' || table_name, 'SELECT') then
      raise exception 'Anonymous/public SELECT grant exists on %', table_name;
    end if;
  end loop;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('talent_review_campaigns', 'talent_review_assignments', 'talent_review_assignment_members', 'talent_review_scores');
  if policy_count < 9 then
    raise exception 'Expected scoped Talent review policies, found %', policy_count;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.talent_review_assignment_members'::regclass
      and conname = 'talent_review_assignment_members_no_self_check'
  ) then
    raise exception 'Missing assignment member self-scope constraint';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.talent_review_scores'::regclass
      and conname = 'talent_review_scores_no_self_check'
  ) then
    raise exception 'Missing score self-scope constraint';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'talent_review_assignment_members'
      and policyname = 'talent_review_assignment_members_select'
      and qual ilike '%employee_id <>%current_employee_id%'
  ) then
    raise exception 'Missing assignment member self-scope policy';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'talent_review_scores'
      and policyname = 'talent_review_scores_select'
      and qual ilike '%employee_id <>%current_employee_id%'
  ) then
    raise exception 'Missing score self-scope policy';
  end if;

  if not has_function_privilege('authenticated', 'public.start_talent_review_campaign(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.close_talent_review_campaign(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.reopen_talent_review_campaign(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.activate_due_talent_review_campaigns(uuid)', 'EXECUTE') then
    raise exception 'Authenticated Talent review command grants are missing';
  end if;
  if has_function_privilege('anon', 'public.start_talent_review_campaign(uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.start_talent_review_campaign(uuid)', 'EXECUTE') then
    raise exception 'Anonymous/public Talent review command grant exists';
  end if;

  if not exists (select 1 from public.permissions where code = 'talent-review:manage')
    or not exists (select 1 from public.permissions where code = 'talent-review:read')
    or not exists (select 1 from public.permissions where code = 'talent-review:write') then
    raise exception 'Talent review permissions are missing';
  end if;
end;
$$;
