-- Forward-only PMUX deadline correction for newly materialized WVP week-42 steps.
-- Article 38 ZW sets the first day after 42 complete weeks; this long-term deadline
-- is not extended when that calendar day is a weekend or a generally recognized holiday.
-- Existing activated process_step_instances and their immutable snapshots are untouched.
create or replace function internal_security.wvp_materialize_deadline()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  absence_case public.absence_cases%rowtype;
  boundary date;
  milestone_code text;
  case_time_zone text;
begin
  select c.*
    into absence_case
  from public.absence_cases c
  join public.process_instances i
    on i.tenant_id = c.tenant_id
   and i.hr_group_id = c.hr_group_id
   and i.idempotency_key = 'wvp01:' || c.id::text
  where i.id = new.process_instance_id;

  if absence_case.id is null then
    return new;
  end if;

  milestone_code := upper(replace(new.step_key, '-', '_'));
  if milestone_code = 'WVP_WEEK_42' then
    -- Use the canonical effective clock directly so application, absence task,
    -- and new PMUX work-item deadlines share the same calendar date.
    boundary := absence_case.effective_clock_start_on + 294;
  else
    select task.due_on
      into boundary
    from public.absence_tasks task
    where task.tenant_id = absence_case.tenant_id
      and task.hr_group_id = absence_case.hr_group_id
      and task.case_id = absence_case.id
      and task.milestone_code = milestone_code;

    if boundary is null and milestone_code = 'WVP_WEEK_6' then
      boundary := absence_case.effective_clock_start_on + 42;
    end if;
  end if;

  if boundary is null and new.step_key <> 'guidance' then
    raise exception 'WVP_MILESTONE_NOT_FOUND';
  end if;

  select group_row.time_zone
    into case_time_zone
  from public.hr_groups group_row
  where group_row.tenant_id = absence_case.tenant_id
    and group_row.id = absence_case.hr_group_id;

  if case_time_zone is null then
    raise exception 'WVP_HR_GROUP_TIME_ZONE_NOT_FOUND';
  end if;

  new.deadline_at := (boundary + 1)::timestamp at time zone case_time_zone;
  return new;
end;
$$;

revoke all on function internal_security.wvp_materialize_deadline() from public, anon, authenticated;