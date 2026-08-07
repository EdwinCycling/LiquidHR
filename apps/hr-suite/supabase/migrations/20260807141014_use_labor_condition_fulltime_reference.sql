-- The labor-condition set is the authoritative full-time reference for every
-- employment schedule. Store a snapshot on the schedule so historical leave
-- and FTE calculations remain stable when master data is later versioned.
alter table public.employment_schedules
  add column fulltime_hours_per_week numeric(6,2);

with schedule_references as (
  select
    schedule.id,
    condition_set.standard_hours_per_week
  from public.employment_schedules schedule
  join lateral (
    select contract.labor_condition_set_id
    from public.employment_contracts contract
    where contract.tenant_id = schedule.tenant_id
      and contract.administration_id = schedule.administration_id
      and contract.employee_id = schedule.employee_id
      and contract.employment_id = schedule.employment_id
      and contract.starts_on <= schedule.valid_from
      and (contract.ends_on is null or contract.ends_on >= schedule.valid_from)
    order by contract.starts_on desc, contract.sequence_number desc
    limit 1
  ) active_contract on true
  join public.labor_condition_sets condition_set
    on condition_set.tenant_id = schedule.tenant_id
   and condition_set.administration_id = schedule.administration_id
   and condition_set.id = active_contract.labor_condition_set_id
)
update public.employment_schedules schedule
set
  fulltime_hours_per_week = reference.standard_hours_per_week,
  part_time_factor = least(
    1,
    greatest(0, schedule.average_hours_per_week / nullif(reference.standard_hours_per_week, 0))
  )
from schedule_references reference
where reference.id = schedule.id;

do $$
begin
  if exists (
    select 1
    from public.employment_schedules
    where fulltime_hours_per_week is null
  ) then
    raise exception 'EMPLOYMENT_SCHEDULE_LABOR_CONDITION_REQUIRED';
  end if;
end;
$$;

alter table public.employment_schedules
  alter column fulltime_hours_per_week set default 40,
  alter column fulltime_hours_per_week set not null,
  alter column work_scope drop not null,
  add constraint employment_schedules_fulltime_hours_valid
    check (fulltime_hours_per_week > 0 and fulltime_hours_per_week <= 60);

alter table public.employment_schedules
  drop constraint if exists employment_schedules_part_time_factor_check,
  add constraint employment_schedules_part_time_factor_cap_check
    check (part_time_factor between 0 and 1);

create or replace function internal_security.normalize_employment_schedule()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  fulltime_hours numeric;
  roster_total numeric;
begin
  select condition_set.standard_hours_per_week
    into fulltime_hours
  from public.employment_contracts contract
  join public.labor_condition_sets condition_set
    on condition_set.tenant_id = contract.tenant_id
   and condition_set.administration_id = contract.administration_id
   and condition_set.id = contract.labor_condition_set_id
  where contract.tenant_id = new.tenant_id
    and contract.administration_id = new.administration_id
    and contract.employee_id = new.employee_id
    and contract.employment_id = new.employment_id
    and contract.starts_on <= new.valid_from
    and (contract.ends_on is null or contract.ends_on >= new.valid_from)
  order by contract.starts_on desc, contract.sequence_number desc
  limit 1;

  if fulltime_hours is null then
    raise exception 'EMPLOYMENT_SCHEDULE_LABOR_CONDITION_REQUIRED';
  end if;

  new.fulltime_hours_per_week := fulltime_hours;
  new.part_time_factor := least(
    1,
    greatest(0, new.average_hours_per_week / nullif(fulltime_hours, 0))
  );

  if new.is_on_call then
    new.on_call_obligation := coalesce(new.on_call_obligation, false);
    new.work_scope := null;
  else
    new.on_call_obligation := null;
    new.work_scope := case
      when new.average_hours_per_week >= fulltime_hours
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

drop trigger if exists normalize_employment_schedule on public.employment_schedules;
create trigger normalize_employment_schedule
before insert or update on public.employment_schedules
for each row execute function internal_security.normalize_employment_schedule();
