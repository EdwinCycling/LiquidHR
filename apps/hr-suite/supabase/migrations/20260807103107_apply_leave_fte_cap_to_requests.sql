create or replace function public.confirm_group_leave_request(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_mode public.leave_request_mode,
  requested_priority_rule_id uuid,
  requested_leave_type_id uuid,
  requested_start_date date,
  requested_end_date date,
  requested_time_mode public.leave_request_time_mode,
  requested_specific_start time,
  requested_specific_end time,
  requested_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth
as $$
declare
  actor_id uuid := auth.uid();
  existing_request_id uuid;
  request_id uuid;
  employment_row public.employments;
  schedule_row public.employment_schedules;
  leave_type_row public.leave_types;
  bucket_row public.leave_balance_buckets;
  selected_day date;
  day_hours numeric := 0;
  planned_minutes integer := 0;
  total_minutes integer := 0;
  half_day_minutes integer := 240;
  requested_hours numeric := 0;
  remaining_hours numeric := 0;
  available_hours numeric := 0;
  allocated_hours numeric := 0;
  used_hours numeric := 0;
  annual_limit numeric;
  part_time_factor numeric;
  allocation_order smallint := 0;
  type_id uuid;
  type_ids uuid[];
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'LEAVE_AUTHENTICATION_REQUIRED'; end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'leave:request') then
    raise exception using errcode = '42501', message = 'LEAVE_REQUEST_PERMISSION_REQUIRED';
  end if;
  if requested_idempotency_key is null or length(btrim(requested_idempotency_key)) < 8 then raise exception using errcode = '23514', message = 'LEAVE_IDEMPOTENCY_KEY_REQUIRED'; end if;
  select id into existing_request_id from public.leave_requests request
  where request.tenant_id = requested_tenant_id and request.hr_group_id = requested_hr_group_id and request.idempotency_key = requested_idempotency_key;
  if existing_request_id is not null then return existing_request_id; end if;

  select * into employment_row from public.employments employment
  where employment.tenant_id = requested_tenant_id and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED' and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND'; end if;
  if requested_start_date < employment_row.starts_on
     or (employment_row.ends_on is not null and requested_start_date > employment_row.ends_on)
     or requested_end_date < requested_start_date
     or (employment_row.ends_on is not null and requested_end_date > employment_row.ends_on) then
    raise exception using errcode = '23514', message = 'LEAVE_EMPLOYMENT_DATE_INVALID';
  end if;
  if requested_time_mode = 'SPECIFIC_HOURS' and (requested_start_date <> requested_end_date or requested_specific_start is null or requested_specific_end is null or requested_specific_end <= requested_specific_start) then
    raise exception using errcode = '23514', message = 'LEAVE_TIME_SELECTION_INVALID';
  end if;
  select coalesce(settings.half_day_minutes, 240) into half_day_minutes
  from public.leave_settings settings
  where settings.tenant_id = requested_tenant_id and settings.hr_group_id = requested_hr_group_id;
  half_day_minutes := coalesce(half_day_minutes, 240);
  for selected_day in select generate_series(requested_start_date, requested_end_date, interval '1 day')::date loop
    select * into schedule_row from public.employment_schedules schedule
    where schedule.tenant_id = requested_tenant_id and schedule.administration_id = employment_row.administration_id
      and schedule.employee_id = requested_employee_id and schedule.employment_id = requested_employment_id
      and schedule.valid_from <= selected_day and (schedule.valid_until is null or schedule.valid_until >= selected_day)
    order by schedule.valid_from desc limit 1;
    day_hours := case extract(isodow from selected_day)::integer
      when 1 then coalesce(schedule_row.monday_hours, 0) when 2 then coalesce(schedule_row.tuesday_hours, 0)
      when 3 then coalesce(schedule_row.wednesday_hours, 0) when 4 then coalesce(schedule_row.thursday_hours, 0)
      when 5 then coalesce(schedule_row.friday_hours, 0) when 6 then coalesce(schedule_row.saturday_hours, 0)
      when 7 then coalesce(schedule_row.sunday_hours, 0) else 0 end;
    planned_minutes := planned_minutes + round(day_hours * 60)::integer;
    if requested_time_mode = 'FULL_DAY' then total_minutes := total_minutes + round(day_hours * 60)::integer;
    elsif requested_time_mode in ('MORNING', 'AFTERNOON') then total_minutes := total_minutes + least(half_day_minutes, round(day_hours * 60)::integer);
    else total_minutes := round(extract(epoch from (requested_specific_end - requested_specific_start)) / 60)::integer;
    end if;
  end loop;
  if total_minutes <= 0 then raise exception using errcode = '23514', message = 'LEAVE_NO_SCHEDULED_TIME'; end if;
  requested_hours := round((total_minutes::numeric / 60)::numeric, 4);

  select schedule.part_time_factor into part_time_factor
  from public.employment_schedules schedule
  where schedule.tenant_id = requested_tenant_id and schedule.administration_id = employment_row.administration_id
    and schedule.employee_id = requested_employee_id and schedule.employment_id = requested_employment_id
    and schedule.valid_from <= requested_start_date and (schedule.valid_until is null or schedule.valid_until >= requested_start_date)
  order by schedule.valid_from desc limit 1;

  if requested_mode = 'PRIORITY' then
    if requested_priority_rule_id is null or not exists (
      select 1 from public.leave_priority_rules rule
      where rule.id = requested_priority_rule_id and rule.tenant_id = requested_tenant_id and rule.hr_group_id = requested_hr_group_id
        and rule.is_active and rule.valid_from <= requested_start_date and (rule.valid_until is null or rule.valid_until >= requested_start_date)
    ) then raise exception using errcode = '23503', message = 'LEAVE_PRIORITY_RULE_NOT_FOUND'; end if;
    select array_agg(item.leave_type_id order by item.sort_order) into type_ids
    from public.leave_priority_rule_items item
    where item.tenant_id = requested_tenant_id and item.hr_group_id = requested_hr_group_id and item.priority_rule_id = requested_priority_rule_id;
    if type_ids is null or cardinality(type_ids) = 0 then raise exception using errcode = '23514', message = 'LEAVE_PRIORITY_RULE_EMPTY'; end if;
  else
    if requested_leave_type_id is null then raise exception using errcode = '23514', message = 'LEAVE_TYPE_REQUIRED'; end if;
    type_ids := array[requested_leave_type_id];
  end if;

  insert into public.leave_requests (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id, request_mode,
    priority_rule_id, leave_type_id, start_date, end_date, time_mode, specific_start, specific_end,
    requested_minutes, actor_user_id, idempotency_key
  ) values (
    requested_tenant_id, requested_hr_group_id, employment_row.administration_id, requested_employee_id, requested_employment_id,
    requested_mode, requested_priority_rule_id, requested_leave_type_id, requested_start_date, requested_end_date,
    requested_time_mode, requested_specific_start, requested_specific_end, total_minutes, actor_id, requested_idempotency_key
  ) returning id into request_id;

  remaining_hours := requested_hours;
  foreach type_id in array type_ids loop
    select * into leave_type_row from public.leave_types type
    where type.id = type_id and type.tenant_id = requested_tenant_id and type.hr_group_id = requested_hr_group_id and type.is_active;
    if leave_type_row.id is null then raise exception using errcode = '23503', message = 'LEAVE_TYPE_NOT_FOUND'; end if;
    if leave_type_row.entitlement_mode in ('ANNUAL_HOURS_CAP', 'ANNUAL_HOURS_FTE_CAP') then
      if leave_type_row.entitlement_mode = 'ANNUAL_HOURS_CAP' then
        annual_limit := leave_type_row.annual_hours_cap;
      elsif part_time_factor is null then
        raise exception using errcode = '23514', message = 'LEAVE_PART_TIME_FACTOR_REQUIRED';
      else
        annual_limit := leave_type_row.annual_hours_fte_cap * part_time_factor;
      end if;
      if annual_limit is not null then
        select coalesce(sum(abs(transaction.amount)), 0) into used_hours
        from public.leave_accrual_transactions transaction
        where transaction.tenant_id = requested_tenant_id and transaction.hr_group_id = requested_hr_group_id
          and transaction.employment_id = requested_employment_id and transaction.leave_type_id = type_id
          and transaction.transaction_type = 'TAKEN'
          and transaction.transaction_date between make_date(extract(year from requested_start_date)::integer, 1, 1) and make_date(extract(year from requested_start_date)::integer, 12, 31);
        if used_hours + remaining_hours > annual_limit then raise exception using errcode = '23514', message = 'LEAVE_ANNUAL_LIMIT_EXCEEDED'; end if;
      end if;
    end if;
    if leave_type_row.entitlement_mode = 'UNLIMITED' then
      allocation_order := allocation_order + 1;
      insert into public.leave_request_allocations (tenant_id, hr_group_id, administration_id, request_id, employee_id, employment_id, leave_type_id, bucket_id, allocated_hours, sort_order)
      values (requested_tenant_id, requested_hr_group_id, employment_row.administration_id, request_id, requested_employee_id, requested_employment_id, type_id, null, remaining_hours, allocation_order);
      remaining_hours := 0;
      exit;
    end if;
    for bucket_row in
      select * from public.leave_balance_buckets bucket
      where bucket.tenant_id = requested_tenant_id and bucket.hr_group_id = requested_hr_group_id
        and bucket.employee_id = requested_employee_id and bucket.employment_id = requested_employment_id and bucket.leave_type_id = type_id
        and bucket.expiration_date > requested_start_date and bucket.total_accrued > bucket.total_taken + bucket.total_expired
      order by bucket.expiration_date, bucket.accrual_year, bucket.id for update
    loop
      available_hours := bucket_row.total_accrued - bucket_row.total_taken - bucket_row.total_expired;
      allocated_hours := least(remaining_hours, available_hours);
      if allocated_hours > 0 then
        allocation_order := allocation_order + 1;
        insert into public.leave_request_allocations (tenant_id, hr_group_id, administration_id, request_id, employee_id, employment_id, leave_type_id, bucket_id, allocated_hours, sort_order)
        values (requested_tenant_id, requested_hr_group_id, bucket_row.administration_id, request_id, requested_employee_id, requested_employment_id, type_id, bucket_row.id, allocated_hours, allocation_order);
        update public.leave_balance_buckets set total_taken = total_taken + allocated_hours, updated_at = timezone('utc', now()) where id = bucket_row.id;
        insert into public.leave_accrual_transactions (tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id, transaction_type, amount, reason, actor_user_id, source_type, source_id, source_key, transaction_date)
        values (requested_tenant_id, requested_hr_group_id, bucket_row.administration_id, requested_employee_id, requested_employment_id, type_id, bucket_row.id, 'TAKEN', -allocated_hours, 'HR-admin verlofaanvraag', actor_id, 'HR_ADMIN_CALENDAR', request_id, request_id::text || ':' || bucket_row.id::text, requested_start_date);
        remaining_hours := remaining_hours - allocated_hours;
      end if;
      exit when remaining_hours <= 0;
    end loop;
    exit when remaining_hours <= 0;
  end loop;
  if remaining_hours > 0 then raise exception using errcode = '23514', message = 'LEAVE_INSUFFICIENT_BALANCE'; end if;
  return request_id;
end;
$$;
