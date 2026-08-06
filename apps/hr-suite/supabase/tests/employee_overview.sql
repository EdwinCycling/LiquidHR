do $$
declare
  target_tenant uuid;
  target_hr_group uuid;
  actor uuid;
  row_count integer;
  distinct_employee_count integer;
  malformed_history_count integer;
begin
  select group_row.tenant_id, group_row.id
    into target_tenant, target_hr_group
  from public.hr_groups group_row
  join public.tenants tenant on tenant.id=group_row.tenant_id
  where group_row.code='DEFAULT' and group_row.is_active
  order by tenant.name
  limit 1;
  select id into actor from auth.users where lower(email)='edwin@editsolutions.nl' limit 1;

  if target_tenant is null or target_hr_group is null or actor is null then
    raise exception 'EMPLOYEE_OVERVIEW_NO_HR_GROUP';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub',actor,'role','authenticated')::text, true);

  select count(*), count(distinct overview.id), count(*) filter (where jsonb_typeof(overview.employment_history) <> 'array')
    into row_count, distinct_employee_count, malformed_history_count
  from public.list_employee_overviews(target_tenant, target_hr_group, current_date, 'active') overview;

  if row_count = 0 then
    raise exception 'EMPLOYEE_OVERVIEW_EMPTY';
  end if;
  if row_count <> distinct_employee_count then
    raise exception 'EMPLOYEE_OVERVIEW_DUPLICATE_ROWS';
  end if;
  if malformed_history_count <> 0 then
    raise exception 'EMPLOYEE_OVERVIEW_HISTORY_INVALID';
  end if;
end;
$$;
