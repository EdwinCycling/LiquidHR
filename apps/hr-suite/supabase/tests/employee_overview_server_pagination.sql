-- Read-only security and pagination regression checks against synthetic TEST personas.
-- The claim/role setup mirrors the existing Supabase SQL test harness. Each DO block
-- runs as authenticated and invokes the RPC; it does not mutate application rows.

do $b2_catalog$
#variable_conflict use_variable
declare
  function_oid regprocedure := 'public.list_employee_overviews_page(uuid,uuid,uuid,text,text,text,text,text,integer)'::regprocedure;
  function_owner text;
  function_config text[];
  function_is_definer boolean;
begin
  select pg_get_userbyid(proc.proowner), proc.proconfig, proc.prosecdef
    into function_owner, function_config, function_is_definer
  from pg_proc proc
  where proc.oid = function_oid;

  if function_owner <> 'postgres' or not function_is_definer then
    raise exception 'B2_RPC_OWNER_OR_SECURITY_MODE_INVALID';
  end if;
  if function_config is null or not function_config @> array['search_path=pg_catalog, public, internal_security, auth'] then
    raise exception 'B2_RPC_SEARCH_PATH_INVALID';
  end if;
  if not has_function_privilege('authenticated', function_oid, 'EXECUTE')
     or has_function_privilege('anon', function_oid, 'EXECUTE')
     or has_function_privilege('service_role', function_oid, 'EXECUTE') then
    raise exception 'B2_RPC_EXECUTE_GRANTS_INVALID';
  end if;
  if to_regprocedure('public.list_employee_overviews(uuid,uuid,date,text)') is null then
    raise exception 'B2_LEGACY_RPC_MISSING';
  end if;
  if not exists (
    select 1 from pg_collation coll
    join pg_namespace namespace on namespace.oid = coll.collnamespace
    where namespace.nspname = 'internal_security'
      and coll.collname = 'liquidhr_employee_name_nl_base'
      and coll.collprovider = 'i'
      and not coll.collisdeterministic
      and coll.collversion = pg_collation_actual_version(coll.oid)
  ) then
    raise exception 'B2_SORT_COLLATION_INVALID';
  end if;
end
$b2_catalog$;

do $b2_hr_admin$
#variable_conflict use_variable
declare
  actor_user uuid;
  tenant_id uuid;
  hr_group_id uuid;
  administration_id uuid;
  actor_employee_id uuid;
  today_utc date := (statement_timestamp() at time zone 'UTC')::date;
  total_count bigint;
  second_total bigint;
  page_one jsonb;
  page_two jsonb;
  page_out_of_range jsonb;
  expected_all bigint;
  expected_active bigint;
  expected_future bigint;
  expected_former bigint;
  expected_never bigint;
  actual_count bigint;
begin
  select employee.auth_user_id, employee.id, tenant.id, hr_group.id
    into actor_user, actor_employee_id, tenant_id, hr_group_id
  from public.employees employee
  join public.tenants tenant on tenant.id = employee.tenant_id
  join public.hr_groups hr_group on hr_group.tenant_id = tenant.id and hr_group.id = employee.hr_group_id
  where employee.employee_number = 'DEMO-001'
    and tenant.slug = 'liquid-hr-demo-holding'
    and hr_group.code = 'DEFAULT'
    and employee.deleted_at is null;
  select employment.administration_id into administration_id
  from public.employments employment
  where employment.employee_id = actor_employee_id
    and employment.tenant_id = tenant_id
    and employment.hr_group_id = hr_group_id
    and employment.deleted_at is null
    and employment.record_status <> 'CANCELLED'
  order by employment.starts_on desc, employment.id
  limit 1;
  if actor_user is null or administration_id is null then raise exception 'B2_HR_ADMIN_FIXTURE_MISSING'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if current_user <> 'authenticated' then raise exception 'B2_AUTHENTICATED_ROLE_REQUIRED'; end if;

  select count(*) into expected_all
  from public.list_employee_overviews(tenant_id, hr_group_id, today_utc, 'all');
  select
    count(*) filter (where status = 'ACTIVE_EMPLOYEE'),
    count(*) filter (where status = 'FUTURE_EMPLOYEE'),
    count(*) filter (where status = 'FORMER_EMPLOYEE'),
    count(*) filter (where status = 'NEVER_EMPLOYED')
    into expected_active, expected_future, expected_former, expected_never
  from (
    select overview.id,
      case
        when exists (
          select 1 from jsonb_array_elements(overview.employment_history) period
          where period ->> 'record_status' <> 'CANCELLED'
            and period ->> 'starts_on' <= today_utc::text
            and (period ->> 'ends_on' is null or period ->> 'ends_on' >= today_utc::text)
        ) then 'ACTIVE_EMPLOYEE'
        when exists (
          select 1 from jsonb_array_elements(overview.employment_history) period
          where period ->> 'record_status' <> 'CANCELLED'
            and period ->> 'starts_on' > today_utc::text
        ) then 'FUTURE_EMPLOYEE'
        when exists (
          select 1 from jsonb_array_elements(overview.employment_history) period
          where period ->> 'record_status' <> 'CANCELLED'
        ) then 'FORMER_EMPLOYEE'
        else 'NEVER_EMPLOYED'
      end as status
    from public.list_employee_overviews(tenant_id, hr_group_id, today_utc, 'all') overview
  ) classified;

  select result.total_count, result.employees into total_count, page_one
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'all', 'all', '', 'last-name', 'all', 1) result;
  select result.total_count, result.employees into second_total, page_two
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'all', 'all', '', 'last-name', 'all', 2) result;
  if total_count <> expected_all or second_total <> expected_all then raise exception 'B2_EXACT_TOTAL_MISMATCH'; end if;
  if jsonb_array_length(page_one) <> least(50, expected_all) then raise exception 'B2_FIRST_PAGE_SIZE_INVALID'; end if;
  if jsonb_array_length(page_two) <> least(50, greatest(expected_all - 50, 0)) then raise exception 'B2_SECOND_PAGE_SIZE_INVALID'; end if;
  if exists (
    select 1
    from jsonb_array_elements(page_one) first_page
    join jsonb_array_elements(page_two) second_page
      on first_page ->> 'id' = second_page ->> 'id'
  ) then raise exception 'B2_DUPLICATE_BETWEEN_PAGES'; end if;
  if (select count(distinct item ->> 'id') from jsonb_array_elements(page_one || page_two) item)
     <> jsonb_array_length(page_one) + jsonb_array_length(page_two) then
    raise exception 'B2_DUPLICATE_EMPLOYEE_ROWS';
  end if;

  select result.total_count into actual_count
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'ACTIVE_EMPLOYEE', '', 'last-name', 'all', 1) result;
  if actual_count <> expected_active then raise exception 'B2_ACTIVE_STATUS_MISMATCH'; end if;
  select result.total_count into actual_count
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'FUTURE_EMPLOYEE', '', 'last-name', 'all', 1) result;
  if actual_count <> expected_future then raise exception 'B2_FUTURE_STATUS_MISMATCH'; end if;
  select result.total_count into actual_count
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'FORMER_EMPLOYEE', '', 'last-name', 'all', 1) result;
  if actual_count <> expected_former then raise exception 'B2_FORMER_STATUS_MISMATCH'; end if;
  select result.total_count into actual_count
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'NEVER_EMPLOYED', '', 'last-name', 'all', 1) result;
  if actual_count <> expected_never then raise exception 'B2_NEVER_EMPLOYED_STATUS_MISMATCH'; end if;
  select result.total_count into actual_count
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'ACTIVE_FUTURE_EXTERNAL', '', 'last-name', 'all', 1) result;
  if actual_count <> expected_active + expected_future + expected_never then raise exception 'B2_COMBINED_STATUS_MISMATCH'; end if;
  select result.total_count into actual_count
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'archived', 'all', '', 'last-name', 'all', 1) result;
  if actual_count <> (select count(*) from public.list_employee_overviews(tenant_id, hr_group_id, today_utc, 'archived')) then
    raise exception 'B2_ARCHIVE_FILTER_MISMATCH';
  end if;
  select result.employees into page_out_of_range
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'all', 'all', '', 'last-name', 'all', 1000000) result;
  if jsonb_array_length(page_out_of_range) <> 0 then raise exception 'B2_OUT_OF_RANGE_PAGE_NOT_EMPTY'; end if;
end
$b2_hr_admin$;
reset role;
select set_config('request.jwt.claims', '{}', true);

do $b2_manager$
#variable_conflict use_variable
declare
  actor_user uuid;
  actor_employee_id uuid;
  tenant_id uuid;
  hr_group_id uuid;
  administration_id uuid;
  today_utc date := (statement_timestamp() at time zone 'UTC')::date;
  expected_team bigint;
  expected_all bigint;
  team_total bigint;
  all_total bigint;
  team_rows jsonb;
  all_rows jsonb;
begin
  select employee.auth_user_id, employee.id, tenant.id, employee.hr_group_id
    into actor_user, actor_employee_id, tenant_id, hr_group_id
  from public.employees employee
  join public.tenants tenant on tenant.id = employee.tenant_id
  where employee.employee_number = 'DEMO-028'
    and tenant.slug = 'liquid-hr-demo-holding'
    and employee.deleted_at is null;
  select employment.administration_id into administration_id
  from public.employments employment
  where employment.employee_id = actor_employee_id
    and employment.tenant_id = tenant_id
    and employment.hr_group_id = hr_group_id
    and employment.deleted_at is null
    and employment.record_status <> 'CANCELLED'
  order by employment.starts_on desc, employment.id limit 1;
  if actor_user is null or administration_id is null then raise exception 'B2_MANAGER_FIXTURE_MISSING'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if current_user <> 'authenticated' then raise exception 'B2_AUTHENTICATED_ROLE_REQUIRED'; end if;

  select count(*) into expected_all
  from public.list_employee_overviews(tenant_id, hr_group_id, today_utc, 'active');
  select count(*) into expected_team
  from public.list_employee_overviews(tenant_id, hr_group_id, today_utc, 'active') employee
  where exists (
    select 1 from public.employee_organizations organization
    where organization.tenant_id = tenant_id
      and organization.hr_group_id = hr_group_id
      and organization.administration_id = administration_id
      and organization.employee_id = employee.id
      and organization.direct_manager_id = actor_employee_id
      and organization.employee_id <> actor_employee_id
      and organization.effective_from <= today_utc
      and (organization.effective_to is null or organization.effective_to >= today_utc)
  );
  select result.total_count, result.employees into team_total, team_rows
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'all', '', 'last-name', 'team', 1) result;
  select result.total_count, result.employees into all_total, all_rows
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'all', '', 'last-name', 'all', 1) result;
  if team_total <> expected_team then raise exception 'B2_MANAGER_TEAM_SCOPE_MISMATCH'; end if;
  if all_total <> expected_all then raise exception 'B2_MANAGER_FULL_SCOPE_MISMATCH'; end if;
  if exists (
    select 1 from jsonb_array_elements(team_rows) item
    where (item ->> 'limited_detail')::boolean
  ) then raise exception 'B2_MANAGER_TEAM_DETAILS_WRONGLY_LIMITED'; end if;
  if expected_all > expected_team and not exists (
    select 1 from jsonb_array_elements(all_rows) item
    where (item ->> 'limited_detail')::boolean and item -> 'employee_number' = 'null'::jsonb
  ) then raise exception 'B2_MANAGER_NON_TEAM_DETAILS_NOT_MASKED'; end if;
end
$b2_manager$;
reset role;
select set_config('request.jwt.claims', '{}', true);

do $b2_directory_and_denials$
#variable_conflict use_variable
declare
  actor_user uuid;
  actor_employee_id uuid;
  tenant_id uuid;
  hr_group_id uuid;
  administration_id uuid;
  wrong_tenant_id uuid;
  wrong_group_id uuid;
  wrong_administration_id uuid;
  total_count bigint;
  rows jsonb;
  unauthorized_actor uuid := '00000000-0000-0000-0000-000000000099';
  caught_denial boolean;
begin
  select employee.auth_user_id, employee.id, tenant.id, employee.hr_group_id
    into actor_user, actor_employee_id, tenant_id, hr_group_id
  from public.employees employee
  join public.tenants tenant on tenant.id = employee.tenant_id
  where employee.employee_number = 'DEMO-035'
    and tenant.slug = 'liquid-hr-demo-holding'
    and employee.deleted_at is null;
  select employment.administration_id into administration_id
  from public.employments employment
  where employment.employee_id = actor_employee_id
    and employment.tenant_id = tenant_id
    and employment.hr_group_id = hr_group_id
    and employment.deleted_at is null
  order by employment.starts_on desc, employment.id limit 1;
  select tenant.id into wrong_tenant_id from public.tenants tenant where tenant.slug = 'noorderlicht-zorggroep';
  select group_row.id into wrong_group_id from public.hr_groups group_row where group_row.tenant_id = tenant_id and group_row.code = 'TEST-BOUNDARY';
  select administration.id into wrong_administration_id
  from public.administrations administration where administration.tenant_id = wrong_tenant_id and administration.is_active limit 1;
  if actor_user is null or administration_id is null or wrong_tenant_id is null or wrong_group_id is null or wrong_administration_id is null then
    raise exception 'B2_NEGATIVE_TEST_FIXTURE_MISSING: actor %, admin %, tenant %, group %, wrong admin %', actor_user is null, administration_id is null, wrong_tenant_id is null, wrong_group_id is null, wrong_administration_id is null;
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if current_user <> 'authenticated' then raise exception 'B2_AUTHENTICATED_ROLE_REQUIRED'; end if;

  select result.total_count into total_count
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'all', 'all', 'DEMO-001', 'last-name', 'all', 1) result;
  if total_count <> 0 then raise exception 'B2_DIRECTORY_SEARCH_EXPOSED_EMPLOYEE_NUMBER'; end if;
  select result.total_count, result.employees into total_count, rows
  from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'all', 'all', '', 'last-name', 'all', 1) result;
  if exists (
    select 1 from jsonb_array_elements(rows) item
    where item -> 'employee_number' <> 'null'::jsonb
       or item ->> 'status' <> 'ACTIVE_EMPLOYEE'
       or (item ->> 'is_archived')::boolean
  ) then raise exception 'B2_DIRECTORY_FIELDS_OR_STATUS_NOT_RESTRICTED'; end if;
  if exists (
    select 1
    from jsonb_array_elements(rows) item
    where not exists (
      select 1
      from public.employees listed_employee
      join public.employments active_employment
        on active_employment.tenant_id = listed_employee.tenant_id
       and active_employment.hr_group_id = listed_employee.hr_group_id
       and active_employment.employee_id = listed_employee.id
       and active_employment.administration_id = administration_id
       and active_employment.record_status = 'CONFIRMED'
       and active_employment.deleted_at is null
       and active_employment.starts_on <= today_utc
       and (active_employment.ends_on is null or active_employment.ends_on >= today_utc)
      where listed_employee.id = (item ->> 'id')::uuid
        and listed_employee.tenant_id = tenant_id
        and listed_employee.hr_group_id = hr_group_id
        and listed_employee.deleted_at is null
    )
  ) then raise exception 'B2_DIRECTORY_EMPLOYEE_OUTSIDE_ACTIVE_ADMINISTRATION'; end if;

  caught_denial := false;
  begin
    perform * from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'ACTIVE_EMPLOYEE', '', 'last-name', 'team', 1);
  exception when insufficient_privilege then caught_denial := true;
  end;
  if not caught_denial then raise exception 'B2_FORGED_MANAGER_SCOPE_ACCEPTED'; end if;

  caught_denial := false;
  begin
    perform * from public.list_employee_overviews_page(wrong_tenant_id, hr_group_id, administration_id, 'active', 'all', '', 'last-name', 'all', 1);
  exception when insufficient_privilege then caught_denial := true;
  end;
  if not caught_denial then raise exception 'B2_CROSS_TENANT_REQUEST_ACCEPTED'; end if;

  caught_denial := false;
  begin
    perform * from public.list_employee_overviews_page(tenant_id, wrong_group_id, administration_id, 'active', 'all', '', 'last-name', 'all', 1);
  exception when insufficient_privilege then caught_denial := true;
  end;
  if not caught_denial then raise exception 'B2_CROSS_GROUP_REQUEST_ACCEPTED'; end if;

  caught_denial := false;
  begin
    perform * from public.list_employee_overviews_page(tenant_id, hr_group_id, wrong_administration_id, 'active', 'all', '', 'last-name', 'all', 1);
  exception when insufficient_privilege then caught_denial := true;
  end;
  if not caught_denial then raise exception 'B2_CROSS_ADMINISTRATION_REQUEST_ACCEPTED'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', unauthorized_actor, 'role', 'authenticated')::text, true);
  caught_denial := false;
  begin
    perform * from public.list_employee_overviews_page(tenant_id, hr_group_id, administration_id, 'active', 'all', '', 'last-name', 'all', 1);
  exception when insufficient_privilege then caught_denial := true;
  end;
  if not caught_denial then raise exception 'B2_UNAUTHORIZED_DIRECT_RPC_ACCEPTED'; end if;
end
$b2_directory_and_denials$;
reset role;
select set_config('request.jwt.claims', '{}', true);
