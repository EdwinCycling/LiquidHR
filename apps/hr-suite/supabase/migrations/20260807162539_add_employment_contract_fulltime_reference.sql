-- Keep the full-time norm on the contract as a historical snapshot. The
-- selected labor-condition set remains the source for new contracts, while a
-- later edit of that catalog record cannot change an existing employment.
alter table public.employment_contracts
  add column fulltime_hours_per_week numeric(6,2);

update public.employment_contracts contract
set fulltime_hours_per_week = condition_set.standard_hours_per_week
from public.labor_condition_sets condition_set
where condition_set.tenant_id = contract.tenant_id
  and condition_set.administration_id = contract.administration_id
  and condition_set.id = contract.labor_condition_set_id;

do $$
begin
  if exists (
    select 1
    from public.employment_contracts
    where fulltime_hours_per_week is null
  ) then
    raise exception 'EMPLOYMENT_CONTRACT_LABOR_CONDITION_REQUIRED';
  end if;
end;
$$;

alter table public.employment_contracts
  alter column fulltime_hours_per_week set default 40,
  alter column fulltime_hours_per_week set not null,
  add constraint employment_contracts_fulltime_hours_valid
    check (fulltime_hours_per_week > 0 and fulltime_hours_per_week <= 60);

create or replace function internal_security.normalize_employment_contract()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  fulltime_hours numeric;
begin
  if tg_op = 'UPDATE'
     and new.labor_condition_set_id is not distinct from old.labor_condition_set_id then
    new.fulltime_hours_per_week := old.fulltime_hours_per_week;
    return new;
  end if;

  select condition_set.standard_hours_per_week
    into fulltime_hours
  from public.labor_condition_sets condition_set
  where condition_set.tenant_id = new.tenant_id
    and condition_set.administration_id = new.administration_id
    and condition_set.id = new.labor_condition_set_id;

  if fulltime_hours is null then
    raise exception 'EMPLOYMENT_CONTRACT_LABOR_CONDITION_REQUIRED';
  end if;

  new.fulltime_hours_per_week := fulltime_hours;
  return new;
end;
$$;

revoke all on function internal_security.normalize_employment_contract() from public, anon, authenticated;

drop trigger if exists normalize_employment_contract on public.employment_contracts;
create trigger normalize_employment_contract
before insert or update on public.employment_contracts
for each row execute function internal_security.normalize_employment_contract();

-- New rosters use the contract snapshot, not a mutable catalog value.
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
  select contract.fulltime_hours_per_week
    into fulltime_hours
  from public.employment_contracts contract
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

revoke all on function internal_security.normalize_employment_schedule() from public, anon, authenticated;
