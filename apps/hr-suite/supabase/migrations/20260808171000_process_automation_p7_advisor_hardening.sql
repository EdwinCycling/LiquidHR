begin;

create or replace function internal_security.process_localized_text(
  requested_value jsonb,
  requested_language text,
  requested_fallback text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    requested_value ->> case when requested_language = 'en' then 'en' else 'nl' end,
    requested_value ->> 'nl',
    requested_value ->> 'en',
    requested_fallback
  );
$$;

create or replace function internal_security.process_work_item_assignment_explanation(
  requested_snapshot jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'assignmentMode', requested_snapshot -> 'resolution' ->> 'assignmentMode',
    'source', requested_snapshot -> 'resolution' ->> 'source',
    'resolutionPolicy', requested_snapshot -> 'resolution' ->> 'resolutionDatePolicy',
    'resolutionDate', requested_snapshot -> 'resolution' ->> 'asOfDate',
    'roleCode', requested_snapshot -> 'candidate' ->> 'managementRoleCode'
  ));
$$;

create or replace function internal_security.process_deadline_at(requested_started_at timestamptz, requested_sla jsonb)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  amount integer := nullif(requested_sla -> 'duration' ->> 'amount', '')::integer;
  unit_name text := requested_sla -> 'duration' ->> 'unit';
  business_days boolean := coalesce((requested_sla ->> 'businessDays')::boolean, false);
  candidate timestamptz := requested_started_at;
  remaining integer := amount;
begin
  if jsonb_typeof(requested_sla) <> 'object' or amount is null or amount <= 0 then return null; end if;
  if not business_days or unit_name <> 'DAYS' then
    return candidate + case unit_name when 'MINUTES' then make_interval(mins => amount) when 'HOURS' then make_interval(hours => amount) else make_interval(days => amount) end;
  end if;
  while remaining > 0 loop
    candidate := candidate + interval '1 day';
    if extract(isodow from candidate) between 1 and 5 then remaining := remaining - 1; end if;
  end loop;
  return candidate;
end;
$$;

create index if not exists workflow_jobs_administration_fk_idx
  on public.workflow_jobs (tenant_id, hr_group_id, administration_id);
create index if not exists workflow_jobs_step_fk_idx
  on public.workflow_jobs (tenant_id, hr_group_id, process_instance_id, step_instance_id);
create index if not exists workflow_jobs_work_item_fk_idx
  on public.workflow_jobs (tenant_id, hr_group_id, work_item_id);
create index if not exists process_outputs_administration_fk_idx
  on public.process_outputs (tenant_id, hr_group_id, administration_id);
create index if not exists process_outputs_version_fk_idx
  on public.process_outputs (tenant_id, hr_group_id, process_instance_id, process_version_id);
create index if not exists process_outputs_subject_employee_fk_idx
  on public.process_outputs (tenant_id, hr_group_id, subject_employee_id);
create index if not exists process_reminder_deliveries_instance_fk_idx
  on public.process_reminder_deliveries (tenant_id, hr_group_id, process_instance_id);
create index if not exists process_reminder_deliveries_step_fk_idx
  on public.process_reminder_deliveries (tenant_id, hr_group_id, process_instance_id, step_instance_id);
create index if not exists process_reminder_deliveries_reminder_fk_idx
  on public.process_reminder_deliveries (tenant_id, reminder_id);

commit;
