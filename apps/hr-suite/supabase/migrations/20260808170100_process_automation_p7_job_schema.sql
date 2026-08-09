begin;

create type public.workflow_job_type as enum ('PROCESS_REMINDER', 'PROCESS_DOCUMENT_OUTPUT');
create type public.workflow_job_status as enum ('READY', 'RUNNING', 'RETRY', 'SUCCEEDED', 'DEAD_LETTER');
create type public.process_output_status as enum ('PENDING', 'AVAILABLE', 'FAILED');

create table public.workflow_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid,
  process_instance_id uuid not null,
  step_instance_id uuid,
  work_item_id uuid,
  job_type public.workflow_job_type not null,
  status public.workflow_job_status not null default 'READY',
  available_at timestamptz not null default timezone('utc', now()),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  locked_by uuid,
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  result_reference_id uuid,
  idempotency_key text not null,
  correlation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, administration_id) references public.administrations(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, process_instance_id) references public.process_instances(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, process_instance_id, step_instance_id) references public.process_step_instances(tenant_id, hr_group_id, process_instance_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, work_item_id) references public.process_work_items(tenant_id, hr_group_id, id) on delete cascade,
  constraint workflow_jobs_attempts_check check (attempts >= 0 and max_attempts between 1 and 20),
  constraint workflow_jobs_key_check check (char_length(btrim(idempotency_key)) between 1 and 240),
  constraint workflow_jobs_payload_check check (
    jsonb_typeof(payload) = 'object'
    and not (payload ?| array['current', 'new', 'values', 'formValues', 'form_values', 'bsn', 'salary'])
  ),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, idempotency_key)
);

create table public.process_outputs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid,
  process_instance_id uuid not null,
  process_version_id uuid not null,
  subject_employee_id uuid not null,
  output_key text not null,
  title jsonb not null,
  output_format text not null,
  status public.process_output_status not null default 'PENDING',
  html_summary text,
  document_id uuid,
  last_error_code text,
  generated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id, process_instance_id) references public.process_instances(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, process_instance_id, process_version_id) references public.process_instances(tenant_id, hr_group_id, id, process_version_id) on delete restrict,
  foreign key (tenant_id, hr_group_id, subject_employee_id) references public.employees(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, administration_id) references public.administrations(tenant_id, hr_group_id, id) on delete restrict,
  constraint process_outputs_key_check check (output_key ~ '^[a-z][a-z0-9_-]*$'),
  constraint process_outputs_title_check check (jsonb_typeof(title) = 'object'),
  constraint process_outputs_format_check check (output_format in ('PDF', 'DOCX', 'JSON')),
  constraint process_outputs_html_size_check check (html_summary is null or char_length(html_summary) <= 500000),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, process_instance_id, output_key)
);

create table public.process_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  workflow_job_id uuid not null,
  process_instance_id uuid not null,
  step_instance_id uuid not null,
  reminder_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id, workflow_job_id) references public.workflow_jobs(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, process_instance_id) references public.process_instances(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, process_instance_id, step_instance_id) references public.process_step_instances(tenant_id, hr_group_id, process_instance_id, id) on delete cascade,
  foreign key (tenant_id, reminder_id) references public.reminders(tenant_id, id) on delete restrict,
  unique (tenant_id, hr_group_id, workflow_job_id),
  unique (tenant_id, hr_group_id, step_instance_id)
);

create index workflow_jobs_claim_idx on public.workflow_jobs(status, available_at, created_at) where status in ('READY', 'RETRY');
create index workflow_jobs_instance_idx on public.workflow_jobs(tenant_id, hr_group_id, process_instance_id, created_at desc);
create index workflow_jobs_dead_letter_idx on public.workflow_jobs(tenant_id, hr_group_id, status, last_error_at desc) where status = 'DEAD_LETTER';
create index process_outputs_instance_idx on public.process_outputs(tenant_id, hr_group_id, process_instance_id, created_at desc);

alter table public.workflow_jobs enable row level security;
alter table public.process_outputs enable row level security;
alter table public.process_reminder_deliveries enable row level security;

create policy workflow_jobs_operator_read on public.workflow_jobs for select to authenticated using (
  (select internal_security.process_scope_has_permission(
    tenant_id, hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = workflow_jobs.process_instance_id),
    administration_id, 'process-operations:read'
  ))
);
create policy process_outputs_read on public.process_outputs for select to authenticated using (
  (select internal_security.process_instance_can_read(tenant_id, hr_group_id, process_instance_id))
  or (select internal_security.process_scope_has_permission(
    tenant_id, hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = process_outputs.process_instance_id),
    administration_id, 'process-operations:read'
  ))
);
create policy process_reminder_deliveries_operator_read on public.process_reminder_deliveries for select to authenticated using (
  (select internal_security.process_scope_has_permission(
    tenant_id, hr_group_id,
    (select instance.scope_type from public.process_instances instance where instance.id = process_reminder_deliveries.process_instance_id),
    (select instance.administration_id from public.process_instances instance where instance.id = process_reminder_deliveries.process_instance_id),
    'process-operations:read'
  ))
);
revoke all on table public.workflow_jobs, public.process_outputs, public.process_reminder_deliveries from public, anon, authenticated;

create or replace function internal_security.process_deadline_at(requested_started_at timestamptz, requested_sla jsonb)
returns timestamptz language plpgsql immutable as $$
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
revoke all on function internal_security.process_deadline_at(timestamptz, jsonb) from public, anon, authenticated;

create or replace function internal_security.set_process_step_deadline()
returns trigger language plpgsql security definer set search_path = '' as $$
declare definition_json jsonb; step_json jsonb;
begin
  if new.status <> 'ACTIVE'::public.process_step_instance_status or new.activated_at is null then return new; end if;
  select version.definition_json into definition_json from public.process_versions version where version.tenant_id = new.tenant_id and version.hr_group_id = new.hr_group_id and version.id = new.process_version_id;
  select value into step_json from pg_catalog.jsonb_array_elements(coalesce(definition_json -> 'steps', '[]'::jsonb)) value where value ->> 'key' = new.step_key limit 1;
  new.deadline_at := internal_security.process_deadline_at(new.activated_at, step_json -> 'sla');
  return new;
end;
$$;
revoke all on function internal_security.set_process_step_deadline() from public, anon, authenticated;
drop trigger if exists process_step_deadline_before on public.process_step_instances;
create trigger process_step_deadline_before before insert or update of status, activated_at, step_key, process_version_id on public.process_step_instances for each row execute function internal_security.set_process_step_deadline();

create or replace function internal_security.set_process_work_item_deadline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deadline_at is null then
    select step.deadline_at into new.deadline_at from public.process_step_instances step where step.tenant_id = new.tenant_id and step.hr_group_id = new.hr_group_id and step.process_instance_id = new.process_instance_id and step.id = new.step_instance_id;
  end if;
  return new;
end;
$$;
revoke all on function internal_security.set_process_work_item_deadline() from public, anon, authenticated;
drop trigger if exists process_work_item_deadline_before on public.process_work_items;
create trigger process_work_item_deadline_before before insert or update of step_instance_id, deadline_at on public.process_work_items for each row execute function internal_security.set_process_work_item_deadline();

create or replace function internal_security.enqueue_process_workflow_jobs()
returns trigger language plpgsql security definer set search_path = '' as $$
declare instance_row public.process_instances%rowtype; version_json jsonb; output_json jsonb;
begin
  if TG_TABLE_NAME = 'process_step_instances' then
    if new.status = 'ACTIVE'::public.process_step_instance_status and new.deadline_at is not null then
      select instance.* into instance_row from public.process_instances instance where instance.tenant_id = new.tenant_id and instance.hr_group_id = new.hr_group_id and instance.id = new.process_instance_id;
      insert into public.workflow_jobs (tenant_id, hr_group_id, administration_id, process_instance_id, step_instance_id, job_type, available_at, idempotency_key, correlation_id, payload)
      values (new.tenant_id, new.hr_group_id, instance_row.administration_id, new.process_instance_id, new.id, 'PROCESS_REMINDER'::public.workflow_job_type, new.deadline_at, 'process-reminder:' || new.id::text, instance_row.correlation_id, jsonb_build_object('processInstanceId', new.process_instance_id, 'stepInstanceId', new.id))
      on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
    end if;
    return new;
  end if;
  if TG_TABLE_NAME = 'process_instances' and new.status in ('COMPLETED'::public.process_instance_status, 'REJECTED'::public.process_instance_status, 'CANCELLED'::public.process_instance_status) and old.status is distinct from new.status then
    select version.definition_json into version_json from public.process_versions version where version.tenant_id = new.tenant_id and version.hr_group_id = new.hr_group_id and version.id = new.process_version_id;
    output_json := version_json -> 'output';
    if jsonb_typeof(output_json) = 'object' and output_json ->> 'format' = 'PDF' and nullif(output_json ->> 'dossierCategoryKey', '') is not null then
      insert into public.workflow_jobs (tenant_id, hr_group_id, administration_id, process_instance_id, job_type, available_at, idempotency_key, correlation_id, payload)
      values (new.tenant_id, new.hr_group_id, new.administration_id, new.id, 'PROCESS_DOCUMENT_OUTPUT'::public.workflow_job_type, timezone('utc', now()), 'process-output:' || new.id::text || ':' || (output_json ->> 'key'), new.correlation_id, jsonb_build_object('processInstanceId', new.id))
      on conflict (tenant_id, hr_group_id, idempotency_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function internal_security.enqueue_process_workflow_jobs() from public, anon, authenticated;
drop trigger if exists enqueue_process_step_workflow_jobs on public.process_step_instances;
create trigger enqueue_process_step_workflow_jobs after insert or update of status, deadline_at on public.process_step_instances for each row execute function internal_security.enqueue_process_workflow_jobs();
drop trigger if exists enqueue_process_instance_workflow_jobs on public.process_instances;
create trigger enqueue_process_instance_workflow_jobs after update of status on public.process_instances for each row execute function internal_security.enqueue_process_workflow_jobs();

create or replace function internal_security.audit_process_automation_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tenant_id_value uuid := coalesce(new.tenant_id, old.tenant_id); administration_id_value uuid := coalesce(new.administration_id, old.administration_id); entity_id_value uuid := coalesce(new.id, old.id); correlation_id_value uuid := coalesce(new.correlation_id, old.correlation_id); changes_value jsonb;
begin
  if TG_TABLE_NAME = 'workflow_jobs' then changes_value := jsonb_build_object('jobType', coalesce(new.job_type, old.job_type), 'status', coalesce(new.status, old.status), 'attempts', coalesce(new.attempts, old.attempts), 'lastErrorCode', coalesce(new.last_error_code, old.last_error_code), 'correlationId', correlation_id_value);
  elsif TG_TABLE_NAME = 'process_outputs' then changes_value := jsonb_build_object('outputKey', coalesce(new.output_key, old.output_key), 'status', coalesce(new.status, old.status), 'documentId', coalesce(new.document_id, old.document_id), 'lastErrorCode', coalesce(new.last_error_code, old.last_error_code));
  else return new; end if;
  insert into public.audit_logs (tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes, correlation_id) values (tenant_id_value, administration_id_value, TG_TABLE_NAME, entity_id_value, auth.uid(), case when TG_OP = 'INSERT' then 'CREATE' else 'UPDATE' end, changes_value, correlation_id_value);
  return new;
end;
$$;
revoke all on function internal_security.audit_process_automation_change() from public, anon, authenticated;
drop trigger if exists audit_workflow_jobs on public.workflow_jobs;
create trigger audit_workflow_jobs after insert or update on public.workflow_jobs for each row execute function internal_security.audit_process_automation_change();
drop trigger if exists audit_process_outputs on public.process_outputs;
create trigger audit_process_outputs after insert or update on public.process_outputs for each row execute function internal_security.audit_process_automation_change();
create trigger process_workflow_jobs_updated_at before update on public.workflow_jobs for each row execute function internal_security.set_updated_at();
create trigger process_outputs_updated_at before update on public.process_outputs for each row execute function internal_security.set_updated_at();
create trigger process_reminder_deliveries_append_only before update or delete on public.process_reminder_deliveries for each row execute function internal_security.prevent_process_append_only_mutation();

commit;
