create function public.apply_combined_employment_timeline_mutation(
  requested_employment_id uuid,
  requested_effective_on date,
  requested_mutations jsonb,
  requested_reason text,
  requested_warning_codes text[] default '{}',
  requested_acknowledgements jsonb default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment public.employments%rowtype;
  change_id uuid;
  mutation jsonb;
  requested_timeline text;
  requested_payload jsonb;
  requested_domains text[];
  next_date date;
  allocation_count integer;
  allocation_total numeric;
  allocation jsonb;
begin
  if jsonb_typeof(requested_mutations) <> 'array' or jsonb_array_length(requested_mutations) < 2 then
    raise exception 'COMBINED_TIMELINE_MINIMUM_REQUIRED';
  end if;
  if jsonb_typeof(requested_acknowledgements) <> 'object' then
    raise exception 'ACKNOWLEDGEMENTS_INVALID';
  end if;

  select array_agg(value ->> 'timeline' order by value ->> 'timeline')
    into requested_domains
    from jsonb_array_elements(requested_mutations);
  if exists (
    select 1 from unnest(requested_domains) as domain
    where domain not in ('LABOR_CONDITIONS', 'SCHEDULE', 'SALARY', 'COST_ALLOCATION')
  ) then raise exception 'TIMELINE_UNKNOWN'; end if;
  if cardinality(requested_domains) <> cardinality(array(select distinct unnest(requested_domains))) then
    raise exception 'COMBINED_TIMELINE_DUPLICATE';
  end if;

  select * into employment from public.employments
    where id = requested_employment_id and deleted_at is null
    for update;
  if employment.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if requested_effective_on < employment.starts_on
     or (employment.ends_on is not null and requested_effective_on > employment.ends_on) then
    raise exception 'TIMELINE_DATE_OUTSIDE_EMPLOYMENT';
  end if;
  if not internal_security.current_user_has_permission(
    employment.tenant_id, employment.administration_id, 'contract:write'
  ) then raise exception 'FORBIDDEN'; end if;
  if 'SALARY' = any(requested_domains) and not internal_security.current_user_has_permission(
    employment.tenant_id, employment.administration_id, 'salary:write'
  ) then raise exception 'FORBIDDEN'; end if;

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on,
    reason, domains, warning_codes, acknowledgements
  ) values (
    employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
    requested_effective_on, requested_reason, requested_domains,
    requested_warning_codes, requested_acknowledgements
  ) returning id into change_id;
  perform set_config('app.change_set_id', change_id::text, true);

  for mutation in select value from jsonb_array_elements(requested_mutations) loop
    requested_timeline := mutation ->> 'timeline';
    requested_payload := mutation -> 'payload';
    if requested_payload is null or jsonb_typeof(requested_payload) <> 'object' then
      raise exception 'TIMELINE_PAYLOAD_INVALID';
    end if;

    if requested_timeline = 'LABOR_CONDITIONS' then
      if nullif(requested_payload ->> 'conditionGroup', '') is null then raise exception 'TIMELINE_PAYLOAD_INVALID'; end if;
      if exists (select 1 from public.employment_labor_conditions where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_labor_conditions where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_labor_conditions set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      insert into public.employment_labor_conditions (tenant_id, administration_id, employee_id, employment_id, condition_group, valid_from, valid_until, change_set_id)
      values (employment.tenant_id, employment.administration_id, employment.employee_id, employment.id, requested_payload ->> 'conditionGroup', requested_effective_on, next_date, change_id);

    elsif requested_timeline = 'SCHEDULE' then
      if exists (select 1 from public.employment_schedules where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_schedules where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_schedules set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      insert into public.employment_schedules (
        tenant_id, administration_id, employee_id, employment_id, schedule_type, start_week,
        average_days_per_week, average_hours_per_week, part_time_factor, time_for_time_accrual,
        monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours,
        valid_from, valid_until, change_set_id
      ) values (
        employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
        (requested_payload ->> 'scheduleType')::public.schedule_type, coalesce((requested_payload ->> 'startWeek')::smallint, 1),
        (requested_payload ->> 'averageDaysPerWeek')::numeric, (requested_payload ->> 'averageHoursPerWeek')::numeric,
        (requested_payload ->> 'partTimeFactor')::numeric, coalesce((requested_payload ->> 'timeForTimeAccrual')::numeric, 0),
        nullif(requested_payload ->> 'mondayHours', '')::numeric, nullif(requested_payload ->> 'tuesdayHours', '')::numeric,
        nullif(requested_payload ->> 'wednesdayHours', '')::numeric, nullif(requested_payload ->> 'thursdayHours', '')::numeric,
        nullif(requested_payload ->> 'fridayHours', '')::numeric, nullif(requested_payload ->> 'saturdayHours', '')::numeric,
        nullif(requested_payload ->> 'sundayHours', '')::numeric, requested_effective_on, next_date, change_id
      );

    elsif requested_timeline = 'SALARY' then
      if exists (select 1 from public.employment_salaries where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_salaries where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_salaries set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      insert into public.employment_salaries (
        tenant_id, administration_id, employee_id, employment_id, payment_type, payment_frequency, salary_basis,
        fulltime_amount, hourly_rate, currency_code, salary_scale_step_id, cao_scale_name, cao_step_name,
        valid_from, valid_until, change_set_id
      ) values (
        employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
        (requested_payload ->> 'paymentType')::public.salary_payment_type, (requested_payload ->> 'paymentFrequency')::public.salary_frequency,
        (requested_payload ->> 'salaryBasis')::public.salary_basis, nullif(requested_payload ->> 'fulltimeAmount', '')::numeric,
        nullif(requested_payload ->> 'hourlyRate', '')::numeric, coalesce(requested_payload ->> 'currencyCode', 'EUR'),
        nullif(requested_payload ->> 'salaryScaleStepId', '')::uuid, nullif(requested_payload ->> 'caoScaleName', ''),
        nullif(requested_payload ->> 'caoStepName', ''), requested_effective_on, next_date, change_id
      );

    else
      select count(*), coalesce(sum((value ->> 'percentage')::numeric), 0)
        into allocation_count, allocation_total from jsonb_array_elements(requested_payload -> 'allocations');
      if allocation_count = 0 or allocation_total <> 100 then raise exception 'COST_ALLOCATION_TOTAL_INVALID'; end if;
      if exists (select 1 from public.employment_cost_allocations where employment_id = employment.id and valid_from = requested_effective_on) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;
      select min(valid_from) into next_date from public.employment_cost_allocations where employment_id = employment.id and valid_from > requested_effective_on;
      update public.employment_cost_allocations set valid_until = requested_effective_on
        where employment_id = employment.id and valid_from < requested_effective_on and (valid_until is null or valid_until > requested_effective_on);
      for allocation in select value from jsonb_array_elements(requested_payload -> 'allocations') loop
        insert into public.employment_cost_allocations (
          tenant_id, administration_id, employee_id, employment_id, cost_center_id,
          percentage, valid_from, valid_until, change_set_id
        ) values (
          employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
          (allocation ->> 'costCenterId')::uuid, (allocation ->> 'percentage')::numeric,
          requested_effective_on, next_date, change_id
        );
      end loop;
    end if;
  end loop;

  update public.employment_change_sets set status = 'APPLIED', applied_at = timezone('utc', now()) where id = change_id;
  return change_id;
end;
$$;

revoke all on function public.apply_combined_employment_timeline_mutation(uuid, date, jsonb, text, text[], jsonb) from public, anon;
grant execute on function public.apply_combined_employment_timeline_mutation(uuid, date, jsonb, text, text[], jsonb) to authenticated;
