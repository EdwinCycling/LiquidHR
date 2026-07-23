do $$
declare
  target_tenant uuid;
  target_administration uuid;
  row_count integer;
  distinct_employee_count integer;
  malformed_history_count integer;
begin
  select administration.tenant_id, administration.id
    into target_tenant, target_administration
  from public.administrations administration
  where administration.is_active
  order by administration.name
  limit 1;

  if target_tenant is null or target_administration is null then
    raise exception 'EMPLOYEE_OVERVIEW_NO_ADMINISTRATION';
  end if;

  select count(*), count(distinct overview.id), count(*) filter (where jsonb_typeof(overview.employment_history) <> 'array')
    into row_count, distinct_employee_count, malformed_history_count
  from public.list_employee_overviews(target_tenant, target_administration, current_date, 'active') overview;

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
