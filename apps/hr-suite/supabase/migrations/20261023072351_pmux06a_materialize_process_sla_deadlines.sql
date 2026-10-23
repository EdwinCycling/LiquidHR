begin;

-- Process deadlines use a first-class HR-group timezone. The AI credit policy
-- timezone is intentionally separate and must not determine HR deadlines.
alter table public.hr_groups
  add column if not exists time_zone text not null default 'Europe/Amsterdam';

comment on column public.hr_groups.time_zone is
  'IANA timezone used to calculate and display HR-group process deadlines.';

-- Deadlines are calculated once from the immutable process version when its
-- step becomes active. The stored timestamp is never recalculated on reads or
-- when a later draft is edited.
create or replace function internal_security.materialize_process_step_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
  definition_content jsonb;
  step_definition jsonb;
  sla_definition jsonb;
  duration_amount integer;
  duration_unit text;
  business_days boolean;
  group_time_zone text;
begin
  if new.status::text <> 'ACTIVE' then
    new.deadline_at := null;
    return new;
  end if;

  if new.activated_at is null then
    raise exception 'PROCESS_STEP_ACTIVATION_TIME_REQUIRED' using errcode = 'P0001';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = new.tenant_id
    and instance.hr_group_id = new.hr_group_id
    and instance.id = new.process_instance_id
    and instance.process_version_id = new.process_version_id;
  if instance_row.id is null then
    raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select version.definition_json into definition_content
  from public.process_versions version
  where version.tenant_id = new.tenant_id
    and version.hr_group_id = new.hr_group_id
    and version.process_definition_id = instance_row.process_definition_id
    and version.id = new.process_version_id;
  if definition_content is null then
    raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select step.value into step_definition
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) as step(value)
  where step.value ->> 'key' = new.step_key
  limit 1;
  if step_definition is null then
    raise exception 'STEP_NOT_FOUND' using errcode = 'P0001';
  end if;

  sla_definition := step_definition -> 'sla';
  if sla_definition is null or sla_definition = 'null'::jsonb then
    new.deadline_at := null;
    return new;
  end if;

  duration_amount := (sla_definition #>> '{duration,amount}')::integer;
  duration_unit := sla_definition #>> '{duration,unit}';
  business_days := coalesce((sla_definition ->> 'businessDays')::boolean, false);

  if duration_amount is null or duration_amount < 1 or duration_unit not in ('MINUTES', 'HOURS', 'DAYS') then
    raise exception 'PROCESS_SLA_CONFIGURATION_INVALID' using errcode = 'P0001';
  end if;

  -- A workday deadline requires a process-level calendar binding. Existing
  -- employment schedules and holiday lists are scoped to a person or country
  -- and cannot safely resolve a shared process participant. Do not create an
  -- active task that appears to have no SLA; return a stable blocker instead.
  if business_days then
    raise exception 'SLA_WORKDAY_CALENDAR_REQUIRED' using errcode = 'P0001';
  end if;

  if duration_unit = 'MINUTES' then
    new.deadline_at := new.activated_at + pg_catalog.make_interval(mins => duration_amount);
    return new;
  end if;

  if duration_unit = 'HOURS' then
    new.deadline_at := new.activated_at + pg_catalog.make_interval(hours => duration_amount);
    return new;
  end if;

  select group_row.time_zone into group_time_zone
  from public.hr_groups group_row
  where group_row.tenant_id = new.tenant_id
    and group_row.id = new.hr_group_id;
  if group_time_zone is null or pg_catalog.btrim(group_time_zone) = '' then
    raise exception 'SLA_TIME_ZONE_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  -- Calendar days preserve the activation's local wall-clock time. PostgreSQL
  -- resolves DST gaps/overlaps using the configured IANA zone; the stored
  -- timestamptz then remains stable if the group zone or process draft changes.
  new.deadline_at := (
    (new.activated_at at time zone group_time_zone)
    + pg_catalog.make_interval(days => duration_amount)
  ) at time zone group_time_zone;
  return new;
end;
$$;

revoke all on function internal_security.materialize_process_step_deadline() from public, anon, authenticated;

create trigger process_step_instances_materialize_deadline
before insert on public.process_step_instances
for each row execute function internal_security.materialize_process_step_deadline();

create or replace function internal_security.copy_process_step_deadline_to_work_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select step.deadline_at into new.deadline_at
  from public.process_step_instances step
  where step.tenant_id = new.tenant_id
    and step.hr_group_id = new.hr_group_id
    and step.process_instance_id = new.process_instance_id
    and step.process_version_id = new.process_version_id
    and step.id = new.step_instance_id
    and step.step_key = new.step_key
    and step.status::text = 'ACTIVE';

  if not found then
    raise exception 'PROCESS_STEP_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.copy_process_step_deadline_to_work_item() from public, anon, authenticated;

create trigger process_work_items_copy_step_deadline
before insert on public.process_work_items
for each row execute function internal_security.copy_process_step_deadline_to_work_item();

comment on column public.process_step_instances.deadline_at is
  'Deadline materialized once at activation from the immutable process version; calendar-day SLAs preserve the HR-group local activation time.';

comment on column public.process_work_items.deadline_at is
  'Deadline copied from the active process step at work-item creation; it is not recalculated after activation.';

commit;
