create function internal_security.normalize_employment_labor_condition()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.employment_contract_id is null then
    select contract.id into new.employment_contract_id
    from public.employment_contracts contract
    where contract.employment_id = new.employment_id
      and contract.starts_on <= new.valid_from
      and (contract.ends_on is null or contract.ends_on >= new.valid_from)
    order by contract.starts_on desc
    limit 1;
  end if;
  if new.employment_contract_id is null then raise exception 'CONTRACT_NOT_FOUND'; end if;
  return new;
end;
$$;

create trigger normalize_employment_labor_condition
before insert on public.employment_labor_conditions
for each row execute function internal_security.normalize_employment_labor_condition();

create function internal_security.normalize_employment_schedule()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  roster_total numeric;
begin
  if not new.is_on_call then
    new.on_call_obligation := null;
    new.work_scope := case when new.part_time_factor = 1
      then 'FULL_TIME'::public.employment_work_scope
      else 'PART_TIME'::public.employment_work_scope
    end;
  end if;
  roster_total := coalesce(new.monday_hours, 0) + coalesce(new.tuesday_hours, 0)
    + coalesce(new.wednesday_hours, 0) + coalesce(new.thursday_hours, 0)
    + coalesce(new.friday_hours, 0) + coalesce(new.saturday_hours, 0)
    + coalesce(new.sunday_hours, 0);
  if roster_total = 0 and new.average_hours_per_week > 0 then
    new.monday_hours := new.average_hours_per_week / 5;
    new.tuesday_hours := new.average_hours_per_week / 5;
    new.wednesday_hours := new.average_hours_per_week / 5;
    new.thursday_hours := new.average_hours_per_week / 5;
    new.friday_hours := new.average_hours_per_week / 5;
  end if;
  return new;
end;
$$;

create trigger normalize_employment_schedule
before insert on public.employment_schedules
for each row execute function internal_security.normalize_employment_schedule();

create function internal_security.normalize_employment_salary()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  factor numeric := 1;
begin
  if new.salary_frequency_id is null then
    select frequency.id into new.salary_frequency_id
    from public.salary_frequencies frequency
    where frequency.tenant_id = new.tenant_id
      and frequency.administration_id = new.administration_id
      and frequency.code = new.payment_frequency::text
      and frequency.is_active
    order by frequency.created_at
    limit 1;
  end if;
  if new.parttime_amount is null and new.fulltime_amount is not null then
    select schedule.part_time_factor into factor
    from public.employment_schedules schedule
    where schedule.employment_id = new.employment_id
      and schedule.valid_from <= new.valid_from
      and (schedule.valid_until is null or schedule.valid_until > new.valid_from)
    order by schedule.valid_from desc
    limit 1;
    new.parttime_amount := round(new.fulltime_amount * coalesce(factor, 1), 2);
  end if;
  return new;
end;
$$;

create trigger normalize_employment_salary
before insert on public.employment_salaries
for each row execute function internal_security.normalize_employment_salary();

create function internal_security.normalize_employment_cost_allocation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.cost_carrier_id is null then
    select carrier.id into new.cost_carrier_id
    from public.cost_carriers carrier
    where carrier.tenant_id = new.tenant_id
      and carrier.administration_id = new.administration_id
      and carrier.is_active
    order by (carrier.code = 'GENERAL') desc, carrier.code
    limit 1;
  end if;
  if new.cost_carrier_id is null then raise exception 'COST_CARRIER_NOT_FOUND'; end if;
  return new;
end;
$$;

create trigger normalize_employment_cost_allocation
before insert on public.employment_cost_allocations
for each row execute function internal_security.normalize_employment_cost_allocation();

create function public.apply_employment_cost_allocation(
  requested_employment_id uuid,
  requested_effective_on date,
  requested_payload jsonb,
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
  next_date date;
  allocation_count integer;
  allocation_total numeric;
  allocation jsonb;
begin
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

  select count(*), coalesce(sum((value ->> 'percentage')::numeric), 0)
    into allocation_count, allocation_total
  from jsonb_array_elements(requested_payload -> 'allocations');
  if allocation_count = 0 or allocation_total <> 100 then
    raise exception 'COST_ALLOCATION_TOTAL_INVALID';
  end if;
  if exists (
    select 1 from public.employment_cost_allocations
    where employment_id = employment.id and valid_from = requested_effective_on
  ) then raise exception 'TIMELINE_EFFECTIVE_DATE_CONFLICT'; end if;

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on,
    reason, domains, warning_codes, acknowledgements
  ) values (
    employment.tenant_id, employment.administration_id, employment.employee_id,
    employment.id, requested_effective_on, requested_reason,
    array['COST_ALLOCATION'], requested_warning_codes, requested_acknowledgements
  ) returning id into change_id;
  perform set_config('app.change_set_id', change_id::text, true);

  select min(valid_from) into next_date
  from public.employment_cost_allocations
  where employment_id = employment.id and valid_from > requested_effective_on;
  update public.employment_cost_allocations set valid_until = requested_effective_on
  where employment_id = employment.id and valid_from < requested_effective_on
    and (valid_until is null or valid_until > requested_effective_on);

  for allocation in
    select value from jsonb_array_elements(requested_payload -> 'allocations')
  loop
    insert into public.employment_cost_allocations (
      tenant_id, administration_id, employee_id, employment_id,
      cost_center_id, cost_carrier_id, percentage, valid_from,
      valid_until, change_set_id
    ) values (
      employment.tenant_id, employment.administration_id, employment.employee_id,
      employment.id, (allocation ->> 'costCenterId')::uuid,
      (allocation ->> 'costCarrierId')::uuid,
      (allocation ->> 'percentage')::numeric,
      requested_effective_on, next_date, change_id
    );
  end loop;
  update public.employment_change_sets
  set status = 'APPLIED', applied_at = timezone('utc', now())
  where id = change_id;
  return change_id;
end;
$$;

revoke all on function public.apply_employment_cost_allocation(
  uuid, date, jsonb, text, text[], jsonb
) from public, anon;
grant execute on function public.apply_employment_cost_allocation(
  uuid, date, jsonb, text, text[], jsonb
) to authenticated;
