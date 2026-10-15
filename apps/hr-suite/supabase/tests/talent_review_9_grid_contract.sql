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
    or not has_function_privilege('authenticated', 'public.reopen_talent_review_campaign(uuid,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.reopen_talent_review_campaign(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.activate_due_talent_review_campaigns(uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.activate_due_talent_review_campaigns(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.submit_talent_review_assignment(uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.return_talent_review_assignment(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Authenticated Talent review command grants are missing';
  end if;
  if to_regprocedure('public.reopen_talent_review_campaign(uuid)') is null
    or to_regprocedure('public.activate_due_talent_review_campaigns(uuid)') is null then
    raise exception 'Pre-V2 Talent review RPC compatibility signatures are missing';
  end if;
  if (select prosecdef from pg_proc where oid = to_regprocedure('public.reopen_talent_review_campaign(uuid)'))
    or (select prosecdef from pg_proc where oid = to_regprocedure('public.activate_due_talent_review_campaigns(uuid)')) then
    raise exception 'Pre-V2 compatibility RPCs must not bypass caller RLS';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.activate_due_talent_review_campaigns(uuid)')
      and pg_get_functiondef(oid) ilike '%activate_due_talent_review_campaigns(requested_tenant_id, target_administration_id)%'
  ) or not exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.reopen_talent_review_campaign(uuid)')
      and pg_get_functiondef(oid) ilike '%Legacy client requested reopen without a supplied reason.%'
  ) then
    raise exception 'Pre-V2 RPC wrappers must preserve administration scope and truthful audit provenance';
  end if;
  if has_function_privilege('anon', 'public.start_talent_review_campaign(uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.start_talent_review_campaign(uuid)', 'EXECUTE') then
    raise exception 'Anonymous/public Talent review command grant exists';
  end if;
  if has_function_privilege('anon', 'public.reopen_talent_review_campaign(uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.reopen_talent_review_campaign(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.activate_due_talent_review_campaigns(uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.activate_due_talent_review_campaigns(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.reopen_talent_review_campaign(uuid,text)', 'EXECUTE')
    or has_function_privilege('public', 'public.reopen_talent_review_campaign(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.activate_due_talent_review_campaigns(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.activate_due_talent_review_campaigns(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.close_talent_review_campaign(uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.close_talent_review_campaign(uuid)', 'EXECUTE') then
    raise exception 'Anonymous/public Talent review compatibility RPC grant exists';
  end if;
  if has_function_privilege('anon', 'public.submit_talent_review_assignment(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('public', 'public.submit_talent_review_assignment(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.return_talent_review_assignment(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('public', 'public.return_talent_review_assignment(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Anonymous/public Talent review transition grant exists';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'talent_review_campaigns'
      and column_name = 'review_mode'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'talent_review_assignments'
      and column_name in ('return_reason', 'returned_at', 'returned_by_user_id')
    group by table_name having count(*) = 3
  ) then
    raise exception 'V2 review-mode or return-audit columns are missing';
  end if;
  if to_regclass('public.talent_review_assignments_returned_by_user_id_idx') is null then
    raise exception 'Returned-by-user foreign key index is missing';
  end if;
  if has_column_privilege('authenticated', 'public.talent_review_scores', 'status', 'UPDATE')
    or has_column_privilege('authenticated', 'public.talent_review_assignments', 'status', 'UPDATE') then
    raise exception 'Submission lifecycle columns must be RPC-only';
  end if;

  if not exists (
    select 1
    from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname = 'start_talent_review_campaign'
      and pg_get_function_identity_arguments(function_row.oid) = 'requested_campaign_id uuid'
      and function_row.prosecdef
  ) then
    raise exception 'Start command must be SECURITY DEFINER for assignment materialization';
  end if;
  if not exists (
    select 1
    from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname = 'start_talent_review_campaign'
      and pg_get_function_identity_arguments(function_row.oid) = 'requested_campaign_id uuid'
      and pg_get_functiondef(function_row.oid) ilike '%distinct on (placement.employee_id)%'
  ) then
    raise exception 'Start command must materialize one current placement per employee';
  end if;
  if not exists (
    select 1
    from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname = 'start_talent_review_campaign'
      and pg_get_function_identity_arguments(function_row.oid) = 'requested_campaign_id uuid'
      and pg_get_functiondef(function_row.oid) ilike '%with current_placements as%'
      and length(pg_get_functiondef(function_row.oid)) - length(replace(lower(pg_get_functiondef(function_row.oid)), 'with current_placements as', '')) >= 2
  ) then
    raise exception 'Start command must deduplicate current placements before assignment and member materialization';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'talent_review_campaigns'
      and policyname = 'talent_review_campaigns_select'
      and qual ilike '%review_mode <> ''HR_ONLY''%'
      and qual ilike '%current_user_has_permission%'
  ) then
    raise exception 'Manager campaign read policy must honor HR_ONLY and administration permissions';
  end if;
  if not exists (
    select 1 from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname = 'submit_talent_review_assignment'
      and pg_get_function_identity_arguments(function_row.oid) = 'requested_campaign_id uuid, requested_assignment_id uuid'
      and function_row.prosecdef
      and pg_get_functiondef(function_row.oid) ilike '%submitted_by_user_id%'
      and pg_get_functiondef(function_row.oid) ilike '%review_mode%'
  ) then
    raise exception 'Atomic mode-aware submission RPC with actor provenance is missing';
  end if;
  if not exists (
    select 1 from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'internal_security'
      and function_row.proname = 'validate_talent_review_score'
      and pg_get_functiondef(function_row.oid) ilike '%is_closing%'
      and pg_get_functiondef(function_row.oid) ilike '%assignment_row.status = ''SUBMITTED'' and not is_closing%'
  ) then
    raise exception 'Submitted scores must support the authorized close transition';
  end if;
  if not exists (
    select 1 from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname = 'return_talent_review_assignment'
      and function_row.prosecdef
      and pg_get_functiondef(function_row.oid) ilike '%return_reason%'
      and pg_get_functiondef(function_row.oid) ilike '%returned_by_user_id%'
  ) then
    raise exception 'Audited return-for-correction RPC is missing';
  end if;

  if not exists (select 1 from public.permissions where code = 'talent-review:manage')
    or not exists (select 1 from public.permissions where code = 'talent-review:read')
    or not exists (select 1 from public.permissions where code = 'talent-review:write') then
    raise exception 'Talent review permissions are missing';
  end if;
end;
$$;
