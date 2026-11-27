begin;

alter table public.performance_review_rounds
  add column if not exists additional_reviewer_enabled boolean not null default false;

alter table public.performance_review_dossiers
  add column if not exists additional_reviewer_employee_id uuid,
  add column if not exists additional_reviewer_workflow boolean not null default false,
  add column if not exists additional_reviewer_released_at timestamptz,
  add column if not exists additional_reviewer_released_by uuid references auth.users(id),
  add column if not exists reviewer_assignment_override boolean not null default false;

alter table public.performance_review_dossiers
  add constraint performance_review_dossiers_additional_reviewer_fk
    foreign key (tenant_id, hr_group_id, additional_reviewer_employee_id)
    references public.employees(tenant_id, hr_group_id, id),
  add constraint performance_review_dossiers_distinct_reviewers_check
    check (additional_reviewer_employee_id is null or (additional_reviewer_employee_id <> employee_id and additional_reviewer_employee_id <> reviewer_employee_id));

alter table public.performance_review_dossiers
  drop constraint performance_review_dossiers_phase_check;
alter table public.performance_review_dossiers
  add constraint performance_review_dossiers_phase_check check (phase in (
    'WAITING_EMPLOYEE', 'WAITING_ADDITIONAL_REVIEWER', 'WAITING_MANAGER',
    'WAITING_ACKNOWLEDGEMENT', 'WAITING_REVIEWER_CLOSE',
    'COMPLETED_AGREED', 'COMPLETED_DISAGREED'
  ));

create or replace function public.performance_review_guard_dossier()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tenant_id is distinct from old.tenant_id or new.hr_group_id is distinct from old.hr_group_id
    or new.round_id is distinct from old.round_id or new.employee_id is distinct from old.employee_id
    or new.administration_id is distinct from old.administration_id then
    raise exception 'PERFORMANCE_DOSSIER_IDENTITY_IMMUTABLE';
  end if;
  if exists (select 1 from public.performance_review_rounds review_round
    where review_round.id = old.round_id and review_round.status in ('CLOSED', 'CANCELLED')) then
    raise exception 'PERFORMANCE_ROUND_CLOSED';
  end if;
  if new.phase is distinct from old.phase and not (
    (old.phase = 'WAITING_EMPLOYEE' and new.phase in ('WAITING_ADDITIONAL_REVIEWER', 'WAITING_MANAGER')) or
    (old.phase = 'WAITING_ADDITIONAL_REVIEWER' and new.phase = 'WAITING_MANAGER') or
    (old.phase = 'WAITING_MANAGER' and new.phase = 'WAITING_ACKNOWLEDGEMENT') or
    (old.phase = 'WAITING_ACKNOWLEDGEMENT' and new.phase in ('WAITING_REVIEWER_CLOSE', 'COMPLETED_AGREED', 'COMPLETED_DISAGREED')) or
    (old.phase = 'WAITING_REVIEWER_CLOSE' and new.phase in ('COMPLETED_AGREED', 'COMPLETED_DISAGREED'))
  ) then
    raise exception 'PERFORMANCE_TRANSITION_FORBIDDEN';
  end if;
  return new;
end;
$$;

alter table public.performance_review_submissions
  drop constraint performance_review_submissions_kind_check;
alter table public.performance_review_submissions
  add constraint performance_review_submissions_kind_check
    check (kind in ('SELF', 'MANAGER', 'ADDITIONAL_REVIEWER'));
alter table public.performance_review_submissions
  add constraint performance_review_submissions_additional_no_score_check
    check (kind <> 'ADDITIONAL_REVIEWER' or (score is null and rating_explanation is null and meeting_date is null));

alter table public.performance_review_audit_events
  add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.performance_review_audit_events
  drop constraint performance_review_audit_events_action_check;
alter table public.performance_review_audit_events
  add constraint performance_review_audit_events_action_check check (action in (
    'ROUND_CREATED', 'ROUND_PUBLISHED', 'ROUND_ACTIVATED', 'ROUND_CANCELLED', 'ROUND_DRAFT_UPDATED',
    'DOSSIER_CREATED', 'REVIEWER_REASSIGNED', 'SELF_SAVED', 'SELF_SUBMITTED', 'MANAGER_SAVED',
    'MANAGER_SUBMITTED', 'ACKNOWLEDGED', 'PRIVATE_NOTE_SAVED', 'ATTACHMENT_ADDED',
    'ATTACHMENT_REMOVED', 'APPRAISAL_LINKED', 'ROUND_CLOSED',
    'ADDITIONAL_REVIEWER_ENABLED', 'ADDITIONAL_REVIEWER_ASSIGNED', 'ADDITIONAL_REVIEWER_REPLACED',
    'ADDITIONAL_REVIEWER_RELEASED', 'REVIEWERS_SWAPPED', 'REVIEWERS_BULK_SWAPPED',
    'ADDITIONAL_REVIEWER_SAVED', 'ADDITIONAL_REVIEWER_SUBMITTED', 'REVIEWER_CLOSED',
    'PMUX_RESTARTED_FOR_ROLE_CHANGE'
  ));

create table public.performance_review_draft_archives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dossier_id uuid not null,
  kind text not null check (kind in ('MANAGER', 'ADDITIONAL_REVIEWER')),
  author_user_id uuid not null references auth.users(id),
  body text not null,
  score integer,
  rating_explanation text,
  meeting_date date,
  version integer not null check (version > 0),
  archived_by uuid not null references auth.users(id),
  reason text not null check (length(btrim(reason)) > 0),
  archived_at timestamptz not null default now(),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id)
);

create table public.performance_review_closures (
  tenant_id uuid not null,
  dossier_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, dossier_id),
  foreign key (tenant_id, dossier_id) references public.performance_review_dossiers(tenant_id, id)
);

create table public.performance_review_role_flip_commands (
  tenant_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 160),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$'),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, actor_user_id, idempotency_key)
);

alter table public.performance_review_role_flip_commands enable row level security;
create policy performance_review_role_flip_commands_deny_direct
  on public.performance_review_role_flip_commands for all to authenticated using (false) with check (false);

create index performance_review_dossiers_additional_reviewer_idx
  on public.performance_review_dossiers (tenant_id, additional_reviewer_employee_id, phase)
  where additional_reviewer_employee_id is not null;
create index performance_review_draft_archives_dossier_idx
  on public.performance_review_draft_archives (tenant_id, dossier_id, archived_at desc);

-- V2 gebruikt dezelfde PMUX-engine met eigen, dossiergebonden deelnemers.
-- De bestaande performance-review-mvp-definitie blijft voor V1 ongewijzigd.
insert into public.process_definitions (
  tenant_id, hr_group_id, scope_type, key, title, description, status, business_type, business_category
)
select group_row.tenant_id, group_row.id, 'TENANT'::public.access_scope_type, variant.key,
  variant.title, variant.description, 'PUBLISHED'::public.process_definition_status, 'P_MUTATION', 'GENERAL'
from public.hr_groups group_row
cross join (values
  ('performance-review-additional-v2', '{"nl":"Gesprekscyclus met aanvullende beoordelaar","en":"Performance review with additional reviewer"}'::jsonb, '{"nl":"Dossiergebonden gesprek met aanvullende tekstuele bijdrage.","en":"Dossier-scoped review with an additional text contribution."}'::jsonb),
  ('performance-review-additional-v2-after-self', '{"nl":"Aanvullende beoordelaar in gesprekscyclus","en":"Additional reviewer in performance review"}'::jsonb, '{"nl":"Dossiergebonden gesprek met aanvullende tekstuele bijdrage.","en":"Dossier-scoped review with an additional text contribution."}'::jsonb)
) as variant(key, title, description)
where group_row.is_active
on conflict (tenant_id, hr_group_id, key) do nothing;

with definition_payloads as (
  select definition.tenant_id, definition.hr_group_id, definition.id as process_definition_id,
    definition.key,
    jsonb_build_object(
      'schemaVersion', 1,
      'key', definition.key,
      'startStepKey', case when definition.key = 'performance-review-additional-v2' then 'self-reflection' else 'additional-reviewer-feedback' end,
      'participants', jsonb_build_array(
        jsonb_build_object('key','employee','label',jsonb_build_object('nl','Medewerker','en','Employee'),'selector',jsonb_build_object('type','SUBJECT_EMPLOYEE','resolutionDatePolicy','STEP_ACTIVATED_AT'),'assignmentMode','EXACTLY_ONE','permission','self:process-task:act'),
        jsonb_build_object('key','additional-reviewer','label',jsonb_build_object('nl','Aanvullende beoordelaar','en','Additional reviewer'),'selector',jsonb_build_object('type','FORM_FIELD_PERSON','personFieldKey','additionalReviewerEmployeeId','resolutionDatePolicy','STEP_ACTIVATED_AT'),'assignmentMode','EXACTLY_ONE','permission','process-task:act'),
        jsonb_build_object('key','reviewer','label',jsonb_build_object('nl','Gespreksverantwoordelijke','en','Conversation lead'),'selector',jsonb_build_object('type','FORM_FIELD_PERSON','personFieldKey','reviewerEmployeeId','resolutionDatePolicy','STEP_ACTIVATED_AT'),'assignmentMode','EXACTLY_ONE','permission','process-task:act')
      ),
      'steps', jsonb_build_array(
        jsonb_build_object('key','self-reflection','type','FORM','title',jsonb_build_object('nl','Zelfreflectie','en','Self-reflection'),'participantKey','employee','allowedActions',jsonb_build_array('SUBMIT')),
        jsonb_build_object('key','additional-reviewer-feedback','type','FORM','title',jsonb_build_object('nl','Bijdrage aanvullende beoordelaar','en','Additional reviewer contribution'),'participantKey','additional-reviewer','allowedActions',jsonb_build_array('SUBMIT','RELEASE')),
        jsonb_build_object('key','manager-response','type','FORM','title',jsonb_build_object('nl','Reactie gespreksverantwoordelijke','en','Conversation lead response'),'participantKey','reviewer','allowedActions',jsonb_build_array('SUBMIT')),
        jsonb_build_object('key','employee-acknowledgement','type','FORM','title',jsonb_build_object('nl','Gesprek bevestigen','en','Acknowledge review'),'participantKey','employee','allowedActions',jsonb_build_array('SUBMIT')),
        jsonb_build_object('key','manager-close','type','FORM','title',jsonb_build_object('nl','Gesprek afsluiten','en','Close review'),'participantKey','reviewer','allowedActions',jsonb_build_array('SUBMIT')),
        jsonb_build_object('key','completed','type','END','title',jsonb_build_object('nl','Afgerond','en','Completed'),'allowedActions',jsonb_build_array(),'terminalOutcome','COMPLETED'),
        jsonb_build_object('key','cancelled','type','END','title',jsonb_build_object('nl','Geannuleerd','en','Cancelled'),'allowedActions',jsonb_build_array(),'terminalOutcome','CANCELLED')
      ),
      'transitions', jsonb_build_array(
        jsonb_build_object('key','self-submit','fromStepKey','self-reflection','toStepKey','additional-reviewer-feedback','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Zelfreflectie indienen','en','Submit self-reflection')),
        jsonb_build_object('key','additional-reviewer-submit','fromStepKey','additional-reviewer-feedback','toStepKey','manager-response','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Bijdrage indienen','en','Submit contribution')),
        jsonb_build_object('key','additional-reviewer-release','fromStepKey','additional-reviewer-feedback','toStepKey','manager-response','action','RELEASE','kind','FORWARD','label',jsonb_build_object('nl','Stap vrijgeven','en','Release step')),
        jsonb_build_object('key','manager-submit','fromStepKey','manager-response','toStepKey','employee-acknowledgement','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Reactie indienen','en','Submit response')),
        jsonb_build_object('key','employee-ack','fromStepKey','employee-acknowledgement','toStepKey','manager-close','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Bevestigen','en','Acknowledge')),
        jsonb_build_object('key','manager-close-submit','fromStepKey','manager-close','toStepKey','completed','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Afsluiten','en','Close review'))
      )
    ) as definition_json
  from public.process_definitions definition
  where definition.key in ('performance-review-additional-v2','performance-review-additional-v2-after-self')
),
version_payloads as (
  select payload.*, encode(extensions.digest(convert_to(payload.definition_json::text, 'UTF8'), 'sha256'), 'hex') as definition_hash
  from definition_payloads payload
)
insert into public.process_versions (
  tenant_id, hr_group_id, process_definition_id, version_number, schema_version,
  compiler_version, definition_json, definition_hash
)
select tenant_id, hr_group_id, process_definition_id, 1, 1, 'perf-v2-01', definition_json, definition_hash
from version_payloads
where not exists (
  select 1 from public.process_versions existing
  where existing.process_definition_id = version_payloads.process_definition_id
    and existing.version_number = 1
);

insert into public.process_definitions (
  tenant_id, hr_group_id, scope_type, key, title, description, status, business_type, business_category
)
select group_row.tenant_id, group_row.id, 'TENANT'::public.access_scope_type, variant.key,
  variant.title, variant.description, 'PUBLISHED'::public.process_definition_status, 'P_MUTATION', 'GENERAL'
from public.hr_groups group_row
cross join (values
  ('performance-review-assigned-v1', '{"nl":"Gesprekscyclus","en":"Performance review"}'::jsonb, '{"nl":"V1-gesprekscyclus met dossiergebonden gespreksverantwoordelijke.","en":"V1 review workflow with a dossier-scoped conversation lead."}'::jsonb),
  ('performance-review-assigned-v1-after-self', '{"nl":"Gesprekscyclus","en":"Performance review"}'::jsonb, '{"nl":"V1-gesprekscyclus met dossiergebonden gespreksverantwoordelijke.","en":"V1 review workflow with a dossier-scoped conversation lead."}'::jsonb)
) as variant(key, title, description)
where group_row.is_active
on conflict (tenant_id, hr_group_id, key) do nothing;

with definition_payloads as (
  select definition.tenant_id, definition.hr_group_id, definition.id as process_definition_id,
    definition.key,
    jsonb_build_object(
      'schemaVersion', 1,
      'key', definition.key,
      'startStepKey', case when definition.key = 'performance-review-assigned-v1' then 'self-reflection' else 'manager-response' end,
      'participants', jsonb_build_array(
        jsonb_build_object('key','employee','label',jsonb_build_object('nl','Medewerker','en','Employee'),'selector',jsonb_build_object('type','SUBJECT_EMPLOYEE','resolutionDatePolicy','STEP_ACTIVATED_AT'),'assignmentMode','EXACTLY_ONE','permission','self:process-task:act'),
        jsonb_build_object('key','manager','label',jsonb_build_object('nl','Gespreksverantwoordelijke','en','Conversation lead'),'selector',jsonb_build_object('type','FORM_FIELD_PERSON','personFieldKey','reviewerEmployeeId','resolutionDatePolicy','STEP_ACTIVATED_AT'),'assignmentMode','EXACTLY_ONE','permission','process-task:act')
      ),
      'steps', jsonb_build_array(
        jsonb_build_object('key','self-reflection','type','FORM','title',jsonb_build_object('nl','Zelfreflectie','en','Self-reflection'),'participantKey','employee','allowedActions',jsonb_build_array('SUBMIT')),
        jsonb_build_object('key','manager-response','type','FORM','title',jsonb_build_object('nl','Reactie gespreksverantwoordelijke','en','Conversation lead response'),'participantKey','manager','allowedActions',jsonb_build_array('SUBMIT')),
        jsonb_build_object('key','employee-acknowledgement','type','ACKNOWLEDGEMENT','title',jsonb_build_object('nl','Gesprek bevestigen','en','Acknowledge review'),'participantKey','employee','allowedActions',jsonb_build_array('ACKNOWLEDGE')),
        jsonb_build_object('key','completed','type','END','title',jsonb_build_object('nl','Afgerond','en','Completed'),'allowedActions',jsonb_build_array(),'terminalOutcome','COMPLETED'),
        jsonb_build_object('key','cancelled','type','END','title',jsonb_build_object('nl','Geannuleerd','en','Cancelled'),'allowedActions',jsonb_build_array(),'terminalOutcome','CANCELLED')
      ),
      'transitions', jsonb_build_array(
        jsonb_build_object('key','self-submit','fromStepKey','self-reflection','toStepKey','manager-response','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Zelfreflectie indienen','en','Submit self-reflection')),
        jsonb_build_object('key','manager-submit','fromStepKey','manager-response','toStepKey','employee-acknowledgement','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Reactie indienen','en','Submit response')),
        jsonb_build_object('key','employee-ack','fromStepKey','employee-acknowledgement','toStepKey','completed','action','ACKNOWLEDGE','kind','FORWARD','label',jsonb_build_object('nl','Bevestigen','en','Acknowledge'))
      )
    ) as definition_json
  from public.process_definitions definition
  where definition.key in ('performance-review-assigned-v1','performance-review-assigned-v1-after-self')
),
version_payloads as (
  select payload.*, encode(extensions.digest(convert_to(payload.definition_json::text, 'UTF8'), 'sha256'), 'hex') as definition_hash
  from definition_payloads payload
)
insert into public.process_versions (
  tenant_id, hr_group_id, process_definition_id, version_number, schema_version,
  compiler_version, definition_json, definition_hash
)
select tenant_id, hr_group_id, process_definition_id, 1, 1, 'perf-v2-01-v1-assigned', definition_json, definition_hash
from version_payloads
where not exists (
  select 1 from public.process_versions existing
  where existing.process_definition_id = version_payloads.process_definition_id
    and existing.version_number = 1
);

create or replace function internal_security.performance_review_can_read_dossier_v2(
  requested_tenant uuid,
  requested_hr_group uuid,
  requested_employee uuid,
  requested_reviewer uuid,
  requested_additional_reviewer uuid,
  requested_reviewer_override boolean
)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    internal_security.performance_review_can_manage(requested_tenant, requested_hr_group)
    or internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_employee
    or (
      internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_reviewer
      and (requested_reviewer_override or coalesce(internal_security.can_manage_employee(requested_employee, 'performance-review:team-read'), false))
    )
    or (
      requested_additional_reviewer is not null
      and internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_additional_reviewer
    ), false
  )
$$;

create or replace function internal_security.performance_review_target_eligible(
  requested_tenant uuid,
  requested_hr_group uuid,
  requested_administration uuid,
  requested_employee uuid,
  excluded_employee uuid,
  excluded_other_reviewer uuid default null
)
returns boolean
language sql stable security definer set search_path = '' as $$
  select requested_employee is not null
    and requested_employee <> excluded_employee
    and (excluded_other_reviewer is null or requested_employee <> excluded_other_reviewer)
    and exists (
      select 1 from public.employees employee
      where employee.tenant_id = requested_tenant
        and employee.hr_group_id = requested_hr_group
        and employee.id = requested_employee
        and employee.auth_user_id is not null
        and employee.is_active
        and not employee.is_archived
        and employee.deleted_at is null
    )
    and exists (
      select 1 from public.employee_organizations organization
      where organization.tenant_id = requested_tenant
        and organization.hr_group_id = requested_hr_group
        and organization.employee_id = requested_employee
        and organization.administration_id = requested_administration
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to >= current_date)
    )
$$;

revoke all on function internal_security.performance_review_can_read_dossier_v2(uuid, uuid, uuid, uuid, uuid, boolean) from public, anon;
revoke all on function internal_security.performance_review_target_eligible(uuid, uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function internal_security.performance_review_can_read_dossier_v2(uuid, uuid, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function internal_security.performance_review_target_eligible(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;

create or replace function internal_security.performance_review_set_pmux_due_date()
returns trigger language plpgsql security definer set search_path = '' as $$
declare due_date_value date; time_zone_value text;
begin
  select review_round.due_date, group_row.time_zone into due_date_value, time_zone_value
  from public.performance_review_dossiers dossier
  join public.process_instances instance on instance.tenant_id = dossier.tenant_id
    and instance.hr_group_id = dossier.hr_group_id and instance.id = new.process_instance_id
    and split_part(instance.idempotency_key, ':', 2) = dossier.id::text
  join public.performance_review_rounds review_round on review_round.tenant_id = dossier.tenant_id
    and review_round.id = dossier.round_id
  join public.hr_groups group_row on group_row.tenant_id = dossier.tenant_id
    and group_row.id = dossier.hr_group_id
  where review_round.status = 'ACTIVE';
  if due_date_value is not null then
    if time_zone_value is null or not exists (
      select 1 from pg_catalog.pg_timezone_names zone where zone.name = time_zone_value
    ) then
      raise exception 'PERFORMANCE_TIME_ZONE_INVALID';
    end if;
    new.deadline_at := (due_date_value + 1)::timestamp at time zone time_zone_value;
  end if;
  return new;
end;
$$;

create or replace function public.performance_review_seed_pmux_fields()
returns trigger
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare instance_row public.process_instances; definition_key text; dossier_row public.performance_review_dossiers;
begin
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = new.tenant_id and instance.hr_group_id = new.hr_group_id and instance.id = new.process_instance_id;
  select definition.key into definition_key
  from public.process_definitions definition
  where definition.tenant_id = instance_row.tenant_id and definition.hr_group_id = instance_row.hr_group_id
    and definition.id = instance_row.process_definition_id;
  if definition_key not in (
    'performance-review-additional-v2', 'performance-review-additional-v2-after-self',
    'performance-review-assigned-v1', 'performance-review-assigned-v1-after-self'
  ) then return new; end if;
  if instance_row.id is null or definition_key is null or split_part(instance_row.idempotency_key, ':', 1) <> 'performance-review' then raise exception 'PERFORMANCE_PMUX_DOSSIER_REQUIRED'; end if;
  select dossier.* into dossier_row
  from public.performance_review_dossiers dossier
  where dossier.tenant_id = instance_row.tenant_id
    and dossier.hr_group_id = instance_row.hr_group_id
    and dossier.id::text = split_part(instance_row.idempotency_key, ':', 2);
  if dossier_row.id is null then
    raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_REQUIRED';
  end if;
  if definition_key like 'performance-review-additional-v2%'
    and (not dossier_row.additional_reviewer_workflow or (dossier_row.additional_reviewer_employee_id is null and dossier_row.additional_reviewer_released_at is null)) then
    raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_REQUIRED';
  end if;
  if definition_key like 'performance-review-assigned-v1%' and dossier_row.additional_reviewer_workflow then
    raise exception 'PERFORMANCE_PMUX_DEFINITION_MISMATCH';
  end if;
  update public.process_instances
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb), '{fields}',
    coalesce(metadata->'fields', '{}'::jsonb) || jsonb_build_object(
      'reviewerEmployeeId', dossier_row.reviewer_employee_id::text,
      'additionalReviewerEmployeeId', dossier_row.additional_reviewer_employee_id::text
    ), true
  )
  where tenant_id = instance_row.tenant_id and hr_group_id = instance_row.hr_group_id and id = instance_row.id;
  return new;
end;
$$;

drop trigger if exists performance_review_seed_pmux_fields on public.process_step_instances;
create trigger performance_review_seed_pmux_fields
before insert on public.process_step_instances
for each row execute function public.performance_review_seed_pmux_fields();

revoke all on function public.performance_review_seed_pmux_fields() from public, anon, authenticated;

create or replace function internal_security.performance_review_start_pmux(requested_dossier uuid)
returns void
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_status text; definition_key text; definition_id uuid; process_result jsonb;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  if dossier_row.id is null or dossier_row.process_instance_id is not null then return; end if;
  select status into round_status from public.performance_review_rounds where id = dossier_row.round_id;
  if round_status <> 'ACTIVE' then return; end if;
  definition_key := case
    when dossier_row.additional_reviewer_workflow and dossier_row.phase in ('WAITING_MANAGER','WAITING_ADDITIONAL_REVIEWER') then 'performance-review-additional-v2-after-self'
    when dossier_row.additional_reviewer_workflow then 'performance-review-additional-v2'
    when dossier_row.reviewer_assignment_override and dossier_row.phase = 'WAITING_MANAGER' then 'performance-review-assigned-v1-after-self'
    when dossier_row.reviewer_assignment_override then 'performance-review-assigned-v1'
    else 'performance-review-mvp'
  end;
  select id into definition_id from public.process_definitions
  where tenant_id = dossier_row.tenant_id and hr_group_id = dossier_row.hr_group_id
    and key = definition_key and status = 'PUBLISHED';
  if definition_id is null then raise exception 'PERFORMANCE_PMUX_DEFINITION_MISSING'; end if;
  select public.start_process(definition_id, dossier_row.employee_id, null, current_date,
    'performance-review:' || dossier_row.id::text || ':v' || dossier_row.version::text, null) into process_result;
  update public.performance_review_dossiers
  set process_instance_id = (process_result->>'processInstanceId')::uuid
  where id = dossier_row.id and process_instance_id is null;
end;
$$;

create or replace function public.performance_review_attach_pmux()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
begin
  if coalesce(current_setting('liquidhr.performance_review.defer_pmux', true), '') <> 'on' then
    perform internal_security.performance_review_start_pmux(new.id);
  end if;
  return new;
end;
$$;

revoke all on function internal_security.performance_review_start_pmux(uuid) from public, anon, authenticated;
revoke all on function public.performance_review_attach_pmux() from public, anon, authenticated;

create or replace function internal_security.performance_review_sync_pmux_fields(requested_dossier uuid)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  if dossier_row.process_instance_id is null then return; end if;
  update public.process_instances
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb), '{fields}',
    coalesce(metadata->'fields', '{}'::jsonb) || jsonb_build_object(
      'reviewerEmployeeId', dossier_row.reviewer_employee_id::text,
      'additionalReviewerEmployeeId', dossier_row.additional_reviewer_employee_id::text
    ), true
  )
  where tenant_id = dossier_row.tenant_id and hr_group_id = dossier_row.hr_group_id and id = dossier_row.process_instance_id;
end;
$$;

create or replace function internal_security.performance_review_assign_current_work_item(
  requested_dossier uuid,
  requested_employee uuid,
  requested_source text,
  requested_reason text
)
returns void language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; item_row public.process_work_items; target_row public.employees; next_revision integer;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  if dossier_row.id is null or dossier_row.process_instance_id is null then return; end if;
  select * into target_row from public.employees
  where tenant_id = dossier_row.tenant_id and hr_group_id = dossier_row.hr_group_id
    and id = requested_employee and auth_user_id is not null and is_active and not is_archived and deleted_at is null;
  if target_row.id is null then raise exception 'PERFORMANCE_ROLE_TARGET_INVALID'; end if;
  select * into item_row from public.process_work_items
  where tenant_id = dossier_row.tenant_id and hr_group_id = dossier_row.hr_group_id
    and process_instance_id = dossier_row.process_instance_id and status in ('OPEN','CLAIMED')
  order by created_at desc limit 1 for update;
  if item_row.id is null then return; end if;
  if item_row.assignee_employee_id = target_row.id and exists (
    select 1 from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id and candidate.employee_id = target_row.id
      and candidate.candidate_user_id = target_row.auth_user_id and candidate.is_eligible
      and candidate.resolution_revision = (select max(latest.resolution_revision) from public.process_work_item_candidates latest where latest.work_item_id = item_row.id)
  ) then return; end if;
  select coalesce(max(candidate.resolution_revision), 0) + 1 into next_revision
  from public.process_work_item_candidates candidate where candidate.tenant_id = item_row.tenant_id
    and candidate.hr_group_id = item_row.hr_group_id and candidate.work_item_id = item_row.id;
  insert into public.process_work_item_candidates (
    tenant_id, hr_group_id, work_item_id, employee_id, candidate_user_id, management_role_code,
    resolution_revision, resolution_policy, resolution_date, resolution_source, is_eligible, evidence
  ) values (
    dossier_row.tenant_id, dossier_row.hr_group_id, item_row.id, target_row.id, target_row.auth_user_id,
    'PERFORMANCE_REVIEW_ASSIGNED', next_revision, 'STEP_ACTIVATED_AT', current_date,
    requested_source, true,
    jsonb_build_object('dossierId', dossier_row.id, 'reason', requested_reason, 'previousEmployeeId', item_row.assignee_employee_id)
  );
  update public.process_work_items
  set assignee_employee_id = target_row.id, status = 'OPEN', claimed_by_user_id = null, claimed_at = null,
      expected_version = expected_version + 1, updated_at = timezone('utc', now())
  where id = item_row.id;
end;
$$;

create or replace function internal_security.performance_review_rebuild_pmux(requested_dossier uuid)
returns void language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds; old_instance public.process_instances;
  actor_employee uuid; definition_key text; definition_id uuid; process_result jsonb; new_instance_id uuid; start_key text;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  if dossier_row.id is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id;
  if round_row.status <> 'ACTIVE' then return; end if;
  if dossier_row.process_instance_id is null then
    perform internal_security.performance_review_start_pmux(dossier_row.id);
    return;
  end if;
  select * into old_instance from public.process_instances where id = dossier_row.process_instance_id for update;
  if old_instance.id is null then raise exception 'PERFORMANCE_PMUX_INSTANCE_NOT_FOUND'; end if;
  if old_instance.status not in ('RUNNING','WAITING','BLOCKED') then raise exception 'PERFORMANCE_PMUX_INSTANCE_CLOSED'; end if;
  if dossier_row.phase not in ('WAITING_EMPLOYEE','WAITING_MANAGER') then return; end if;
  definition_key := case
    when dossier_row.additional_reviewer_workflow and dossier_row.phase = 'WAITING_EMPLOYEE' then 'performance-review-additional-v2'
    when dossier_row.additional_reviewer_workflow then 'performance-review-additional-v2-after-self'
    when dossier_row.reviewer_assignment_override and dossier_row.phase = 'WAITING_EMPLOYEE' then 'performance-review-assigned-v1'
    when dossier_row.reviewer_assignment_override then 'performance-review-assigned-v1-after-self'
    else null
  end;
  if definition_key is null then return; end if;
  select id into definition_id from public.process_definitions where tenant_id = dossier_row.tenant_id
    and hr_group_id = dossier_row.hr_group_id and key = definition_key and status = 'PUBLISHED';
  if definition_id is null then raise exception 'PERFORMANCE_PMUX_DEFINITION_MISSING'; end if;
  update public.process_work_items set status = 'CANCELLED', claimed_by_user_id = null, claimed_at = null,
    expected_version = expected_version + 1, updated_at = timezone('utc', now())
  where process_instance_id = old_instance.id and status in ('OPEN','CLAIMED');
  update public.process_step_instances set status = 'CANCELLED', completed_at = timezone('utc', now()), expected_version = expected_version + 1
  where process_instance_id = old_instance.id and status in ('ACTIVE','PENDING');
  update public.process_instances set status = 'CANCELLED', current_step_key = null,
    completed_at = timezone('utc', now()), updated_at = timezone('utc', now()), instance_version = instance_version + 1
  where id = old_instance.id;
  actor_employee := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  start_key := 'performance-review:' || dossier_row.id::text || ':restart:' || dossier_row.version::text;
  select public.start_process(definition_id, dossier_row.employee_id, null, current_date, start_key, null) into process_result;
  new_instance_id := (process_result->>'processInstanceId')::uuid;
  update public.performance_review_dossiers set process_instance_id = new_instance_id where id = dossier_row.id;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, reason, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, 'PMUX_RESTARTED_FOR_ROLE_CHANGE',
    'Workflow is aangepast vóór definitieve beoordelaarsindiening.',
    jsonb_build_object('previousProcessInstanceId', old_instance.id, 'processInstanceId', new_instance_id,
      'actorEmployeeId', actor_employee, 'phase', dossier_row.phase, 'processDefinitionKey', definition_key));
end;
$$;

revoke all on function internal_security.performance_review_sync_pmux_fields(uuid) from public, anon, authenticated;
revoke all on function internal_security.performance_review_assign_current_work_item(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function internal_security.performance_review_rebuild_pmux(uuid) from public, anon, authenticated;

-- Role eligibility is bound to the dossier administration and current organization assignment.
create or replace function internal_security.performance_review_target_eligible(
  requested_tenant uuid,
  requested_hr_group uuid,
  requested_administration uuid,
  requested_employee uuid,
  excluded_employee uuid,
  excluded_other_reviewer uuid default null
)
returns boolean language sql stable security definer set search_path = '' as $$
  select requested_employee is not null
    and requested_employee <> excluded_employee
    and (excluded_other_reviewer is null or requested_employee <> excluded_other_reviewer)
    and exists (
      select 1 from public.employees employee
      where employee.tenant_id = requested_tenant and employee.hr_group_id = requested_hr_group
        and employee.id = requested_employee and employee.auth_user_id is not null
        and employee.is_active and not employee.is_archived and employee.deleted_at is null
    )
    and exists (
      select 1 from public.employee_organizations organization
      where organization.tenant_id = requested_tenant and organization.hr_group_id = requested_hr_group
        and organization.employee_id = requested_employee
        and organization.administration_id = requested_administration
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to >= current_date)
    )
$$;

create table public.performance_review_round_v2_commands (
  tenant_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 160),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$'),
  round_id uuid not null references public.performance_review_rounds(id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, actor_user_id, idempotency_key)
);

alter table public.performance_review_round_v2_commands enable row level security;
create policy performance_review_round_v2_commands_deny_direct
  on public.performance_review_round_v2_commands for all to authenticated using (false) with check (false);
revoke all on public.performance_review_round_v2_commands from anon, authenticated;

create table internal_security.performance_review_pmux_transition_commands (
  actor_user_id uuid not null,
  work_item_id uuid not null,
  action text not null check (action in ('SUBMIT', 'RELEASE', 'ACKNOWLEDGE')),
  created_at timestamptz not null default now(),
  primary key (actor_user_id, work_item_id, action)
);
alter table internal_security.performance_review_pmux_transition_commands enable row level security;
create policy performance_review_pmux_transition_commands_deny_direct
  on internal_security.performance_review_pmux_transition_commands for all to authenticated using (false) with check (false);
revoke all on internal_security.performance_review_pmux_transition_commands from public, anon, authenticated;

create or replace function internal_security.performance_review_queue_pmux_transition(
  requested_work_item uuid, requested_action text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or requested_action not in ('SUBMIT', 'RELEASE', 'ACKNOWLEDGE') then
    raise exception 'PERFORMANCE_DOMAIN_ACTION_REQUIRED';
  end if;
  insert into internal_security.performance_review_pmux_transition_commands (actor_user_id, work_item_id, action)
  values (auth.uid(), requested_work_item, requested_action);
end;
$$;

create or replace function internal_security.performance_review_consume_pmux_transition(
  requested_work_item uuid, requested_action text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare consumed_actor uuid;
begin
  if auth.uid() is null then return false; end if;
  delete from internal_security.performance_review_pmux_transition_commands command
  where command.actor_user_id = auth.uid() and command.work_item_id = requested_work_item
    and command.action = requested_action returning command.actor_user_id into consumed_actor;
  return consumed_actor is not null;
end;
$$;

revoke all on function internal_security.performance_review_queue_pmux_transition(uuid, text) from public, anon, authenticated;
revoke all on function internal_security.performance_review_consume_pmux_transition(uuid, text) from public, anon, authenticated;

create or replace function internal_security.performance_review_archive_drafts(
  requested_dossier uuid,
  requested_kind text,
  requested_archived_by uuid,
  requested_reason text
)
returns integer language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; draft_row public.performance_review_submissions; archived_count integer := 0;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  for draft_row in
    select * from public.performance_review_submissions
    where tenant_id = dossier_row.tenant_id and dossier_id = dossier_row.id
      and kind = requested_kind and submitted_at is null
    for update
  loop
    insert into public.performance_review_draft_archives (
      tenant_id, dossier_id, kind, author_user_id, body, score,
      rating_explanation, meeting_date, version, archived_by, reason
    ) values (
      draft_row.tenant_id, draft_row.dossier_id, draft_row.kind, draft_row.author_user_id,
      draft_row.body, draft_row.score, draft_row.rating_explanation, draft_row.meeting_date,
      draft_row.version, requested_archived_by, btrim(requested_reason)
    );
    perform set_config('liquidhr.performance_review.archive_draft', 'on', true);
    delete from public.performance_review_submissions where id = draft_row.id;
    archived_count := archived_count + 1;
  end loop;
  return archived_count;
end;
$$;

create or replace function public.performance_review_submission_immutable()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.submitted_at is not null then raise exception 'PERFORMANCE_SUBMISSION_IMMUTABLE'; end if;
    if coalesce(current_setting('liquidhr.performance_review.archive_draft', true), '') <> 'on' then
      raise exception 'PERFORMANCE_DRAFT_ARCHIVE_REQUIRED';
    end if;
    return old;
  end if;
  if old.submitted_at is not null then raise exception 'PERFORMANCE_SUBMISSION_IMMUTABLE'; end if;
  return new;
end;
$$;

drop trigger if exists performance_review_submission_immutable on public.performance_review_submissions;
create trigger performance_review_submission_immutable
before update or delete on public.performance_review_submissions
for each row execute function public.performance_review_submission_immutable();
revoke all on function public.performance_review_submission_immutable() from public, anon, authenticated;
revoke all on function internal_security.performance_review_archive_drafts(uuid, text, uuid, text) from public, anon, authenticated;

-- Replace the existing V1 row policies with the narrow V2 role-aware version.
drop policy performance_review_rounds_select on public.performance_review_rounds;
create policy performance_review_rounds_select on public.performance_review_rounds for select to authenticated using (
  internal_security.performance_review_can_manage(tenant_id, hr_group_id)
  or exists (
    select 1 from public.performance_review_dossiers dossier
    where dossier.tenant_id = performance_review_rounds.tenant_id and dossier.round_id = performance_review_rounds.id
      and internal_security.performance_review_can_read_dossier_v2(
        dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id,
        dossier.additional_reviewer_employee_id, dossier.reviewer_assignment_override
      )
  )
);

drop policy performance_review_dossiers_select on public.performance_review_dossiers;
create policy performance_review_dossiers_select on public.performance_review_dossiers for select to authenticated using (
  internal_security.performance_review_can_read_dossier_v2(
    tenant_id, hr_group_id, employee_id, reviewer_employee_id,
    additional_reviewer_employee_id, reviewer_assignment_override
  )
);

create or replace function internal_security.performance_review_employee_can_read_additional_submission(
  requested_tenant uuid, requested_dossier uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    auth.uid() is not null
    and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) = dossier.employee_id
    and exists (
      select 1 from public.performance_review_submissions manager_submission
      where manager_submission.tenant_id = dossier.tenant_id
        and manager_submission.dossier_id = dossier.id
        and manager_submission.kind = 'MANAGER'
        and manager_submission.submitted_at is not null
    ), false
  )
  from public.performance_review_dossiers dossier
  where dossier.tenant_id = requested_tenant and dossier.id = requested_dossier
$$;
revoke all on function internal_security.performance_review_employee_can_read_additional_submission(uuid, uuid) from public, anon;
grant execute on function internal_security.performance_review_employee_can_read_additional_submission(uuid, uuid) to authenticated;

drop policy performance_review_submissions_select on public.performance_review_submissions;
create policy performance_review_submissions_select on public.performance_review_submissions for select to authenticated using (
  exists (
    select 1 from public.performance_review_dossiers dossier
    where dossier.tenant_id = performance_review_submissions.tenant_id
      and dossier.id = performance_review_submissions.dossier_id
      and (
        (performance_review_submissions.author_user_id = auth.uid() and performance_review_submissions.submitted_at is null)
        or (
          performance_review_submissions.submitted_at is not null
          and internal_security.performance_review_can_read_dossier_v2(
            dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id,
            dossier.additional_reviewer_employee_id, dossier.reviewer_assignment_override
          )
          and (
            (performance_review_submissions.kind = 'ADDITIONAL_REVIEWER'
              and (
                internal_security.performance_review_can_manage(dossier.tenant_id, dossier.hr_group_id)
                or internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) = dossier.additional_reviewer_employee_id
                or internal_security.performance_review_employee_can_read_additional_submission(dossier.tenant_id, dossier.id)
                or (internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) = dossier.reviewer_employee_id
                  and (dossier.reviewer_assignment_override or coalesce(internal_security.can_manage_employee(dossier.employee_id, 'performance-review:team-read'), false)))
              ))
            or (performance_review_submissions.kind <> 'ADDITIONAL_REVIEWER'
              and (
                internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id
                or (performance_review_submissions.kind = 'SELF'
                  and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) = dossier.additional_reviewer_employee_id
                  and dossier.additional_reviewer_workflow)
              ))
          )
        )
      )
  )
);

drop policy performance_review_acknowledgements_select on public.performance_review_acknowledgements;
create policy performance_review_acknowledgements_select on public.performance_review_acknowledgements for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers dossier
    where dossier.tenant_id = performance_review_acknowledgements.tenant_id
      and dossier.id = performance_review_acknowledgements.dossier_id
      and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id
      and internal_security.performance_review_can_read_dossier_v2(
        dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id,
        dossier.additional_reviewer_employee_id, dossier.reviewer_assignment_override
      ))
);

drop policy performance_review_private_notes_select on public.performance_review_private_notes;
create policy performance_review_private_notes_select on public.performance_review_private_notes for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers dossier
    where dossier.tenant_id = performance_review_private_notes.tenant_id and dossier.id = performance_review_private_notes.dossier_id
      and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id
      and internal_security.performance_review_can_private(dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id))
);

drop policy performance_review_attachments_select on public.performance_review_attachments;
create policy performance_review_attachments_select on public.performance_review_attachments for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers dossier
    join public.performance_review_submissions manager_submission
      on manager_submission.tenant_id = dossier.tenant_id and manager_submission.dossier_id = dossier.id
       and manager_submission.kind = 'MANAGER' and manager_submission.submitted_at is not null
    where dossier.tenant_id = performance_review_attachments.tenant_id and dossier.id = performance_review_attachments.dossier_id
      and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id
      and internal_security.performance_review_can_read_dossier_v2(
        dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id,
        dossier.additional_reviewer_employee_id, dossier.reviewer_assignment_override
      ))
);

drop policy performance_review_appraisal_links_select on public.performance_review_appraisal_links;
create policy performance_review_appraisal_links_select on public.performance_review_appraisal_links for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers dossier
    where dossier.tenant_id = performance_review_appraisal_links.tenant_id and dossier.id = performance_review_appraisal_links.dossier_id
      and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id
      and internal_security.performance_review_can_read_dossier_v2(
        dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id,
        dossier.additional_reviewer_employee_id, dossier.reviewer_assignment_override
      ))
);

drop policy performance_review_storage_select on storage.objects;
create policy performance_review_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'performance-review-attachments' and exists (
    select 1 from public.performance_review_attachments attachment
    join public.performance_review_dossiers dossier on dossier.tenant_id = attachment.tenant_id and dossier.id = attachment.dossier_id
    join public.performance_review_submissions manager_submission on manager_submission.tenant_id = dossier.tenant_id
      and manager_submission.dossier_id = dossier.id and manager_submission.kind = 'MANAGER' and manager_submission.submitted_at is not null
    where attachment.storage_key = storage.objects.name
      and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id
      and internal_security.performance_review_can_read_dossier_v2(
        dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id,
        dossier.additional_reviewer_employee_id, dossier.reviewer_assignment_override
      )
  )
);

create policy performance_review_draft_archives_select on public.performance_review_draft_archives for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers dossier
    where dossier.tenant_id = performance_review_draft_archives.tenant_id and dossier.id = performance_review_draft_archives.dossier_id
      and (
        internal_security.performance_review_can_manage(dossier.tenant_id, dossier.hr_group_id)
        or (performance_review_draft_archives.author_user_id = auth.uid()
          and (performance_review_draft_archives.kind = 'ADDITIONAL_REVIEWER'
            or internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id))
      ))
);

create policy performance_review_closures_select on public.performance_review_closures for select to authenticated using (
  exists (select 1 from public.performance_review_dossiers dossier
    where dossier.tenant_id = performance_review_closures.tenant_id and dossier.id = performance_review_closures.dossier_id
      and internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id) is distinct from dossier.additional_reviewer_employee_id
      and internal_security.performance_review_can_read_dossier_v2(
        dossier.tenant_id, dossier.hr_group_id, dossier.employee_id, dossier.reviewer_employee_id,
        dossier.additional_reviewer_employee_id, dossier.reviewer_assignment_override
      ))
);

alter table public.performance_review_draft_archives enable row level security;
alter table public.performance_review_closures enable row level security;
grant select on public.performance_review_draft_archives, public.performance_review_closures to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.performance_review_draft_archives, public.performance_review_closures from anon, authenticated;
revoke all on public.performance_review_role_flip_commands from anon, authenticated;

create or replace function internal_security.performance_review_can_read_dossier_v2(
  requested_tenant uuid, requested_hr_group uuid, requested_employee uuid,
  requested_reviewer uuid, requested_additional_reviewer uuid, requested_reviewer_override boolean
)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    internal_security.performance_review_can_manage(requested_tenant, requested_hr_group)
    or internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_employee
    or (internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_reviewer
      and (requested_reviewer_override or coalesce(internal_security.can_manage_employee(requested_employee, 'performance-review:team-read'), false)))
    or (requested_additional_reviewer is not null
      and internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_additional_reviewer), false
  )
$$;

revoke all on function internal_security.performance_review_can_read_dossier_v2(uuid, uuid, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function internal_security.performance_review_can_read_dossier_v2(uuid, uuid, uuid, uuid, uuid, boolean) to authenticated;

create or replace function internal_security.prepare_process_form_action(
  requested_work_item_id uuid, requested_action text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.process_work_items item
    join public.process_instances instance on instance.tenant_id = item.tenant_id
      and instance.hr_group_id = item.hr_group_id and instance.id = item.process_instance_id
    join public.process_definitions definition on definition.tenant_id = instance.tenant_id
      and definition.hr_group_id = instance.hr_group_id and definition.id = instance.process_definition_id
    where item.id = requested_work_item_id and definition.key = 'performance-review-mvp'
  ) then return; end if;
  if exists (
    select 1 from public.process_work_items item
    join public.process_instances instance on instance.tenant_id = item.tenant_id
      and instance.hr_group_id = item.hr_group_id and instance.id = item.process_instance_id
    join public.process_definitions definition on definition.tenant_id = instance.tenant_id
      and definition.hr_group_id = instance.hr_group_id and definition.id = instance.process_definition_id
    where item.id = requested_work_item_id and definition.key in (
      'performance-review-additional-v2', 'performance-review-additional-v2-after-self',
      'performance-review-assigned-v1', 'performance-review-assigned-v1-after-self'
    )
  ) then
    if not internal_security.performance_review_consume_pmux_transition(requested_work_item_id, requested_action) then
      raise exception 'PERFORMANCE_DOMAIN_ACTION_REQUIRED';
    end if;
    return;
  end if;
  perform internal_security.prepare_process_form_action_before_reviews(requested_work_item_id, requested_action);
end;
$$;

create or replace function internal_security.process_form_runtime_fields(requested_work_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.process_work_items item
    join public.process_instances instance on instance.tenant_id = item.tenant_id
      and instance.hr_group_id = item.hr_group_id and instance.id = item.process_instance_id
    join public.process_definitions definition on definition.tenant_id = instance.tenant_id
      and definition.hr_group_id = instance.hr_group_id and definition.id = instance.process_definition_id
    where item.id = requested_work_item_id and definition.key in (
      'performance-review-mvp',
      'performance-review-additional-v2', 'performance-review-additional-v2-after-self',
      'performance-review-assigned-v1', 'performance-review-assigned-v1-after-self'
    )
  ) then return '{}'::jsonb; end if;
  return internal_security.process_form_runtime_fields_before_reviews(requested_work_item_id);
end;
$$;

revoke all on function internal_security.prepare_process_form_action(uuid, text) from public, anon, authenticated;
revoke all on function internal_security.process_form_runtime_fields(uuid) from public, anon, authenticated;

create or replace function public.save_performance_review_self(
  requested_dossier uuid, requested_body text, expected_version integer, submit_now boolean default false
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  submission_row public.performance_review_submissions; actor uuid; next_phase text;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  if dossier_row.id is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  if actor is distinct from dossier_row.employee_id then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if round_row.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if dossier_row.phase <> 'WAITING_EMPLOYEE' or dossier_row.version <> expected_version then
    raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT';
  end if;
  if length(btrim(coalesce(requested_body, ''))) = 0 then raise exception 'PERFORMANCE_SELF_REQUIRED'; end if;
  insert into public.performance_review_submissions (tenant_id, dossier_id, kind, author_user_id, body, submitted_at)
  values (dossier_row.tenant_id, dossier_row.id, 'SELF', auth.uid(), btrim(requested_body), case when submit_now then now() end)
  on conflict (tenant_id, dossier_id, kind) do update set body = excluded.body, submitted_at = excluded.submitted_at,
    version = public.performance_review_submissions.version + 1
  where public.performance_review_submissions.submitted_at is null returning * into submission_row;
  if submission_row.id is null then raise exception 'PERFORMANCE_SUBMISSION_IMMUTABLE'; end if;
  next_phase := case when dossier_row.additional_reviewer_workflow then 'WAITING_ADDITIONAL_REVIEWER' else 'WAITING_MANAGER' end;
  update public.performance_review_dossiers set phase = case when submit_now then next_phase else phase end,
    version = version + 1 where id = dossier_row.id and version = expected_version returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, case when submit_now then 'SELF_SUBMITTED' else 'SELF_SAVED' end);
  return dossier_row;
end;
$$;

create or replace function public.performance_review_advance_pmux()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; item_row public.process_work_items;
  step_version bigint; definition_key text;
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then return new; end if;
  select dossier.* into dossier_row from public.performance_review_dossiers dossier
  where dossier.tenant_id = new.tenant_id and dossier.id = new.dossier_id;
  if dossier_row.process_instance_id is null then return new; end if;
  select definition.key into definition_key from public.process_instances instance
  join public.process_definitions definition on definition.tenant_id = instance.tenant_id
    and definition.hr_group_id = instance.hr_group_id and definition.id = instance.process_definition_id
  where instance.tenant_id = dossier_row.tenant_id and instance.hr_group_id = dossier_row.hr_group_id
    and instance.id = dossier_row.process_instance_id;
  select item.* into item_row from public.process_work_items item
  where item.tenant_id = dossier_row.tenant_id and item.hr_group_id = dossier_row.hr_group_id
    and item.process_instance_id = dossier_row.process_instance_id and item.status in ('OPEN', 'CLAIMED')
  order by item.created_at limit 1 for update;
  if item_row.id is null then return new; end if;
  if item_row.status = 'OPEN' then
    perform public.claim_process_work_item(item_row.id, item_row.expected_version);
    select item.* into item_row from public.process_work_items item where item.id = item_row.id;
  end if;
  select step.expected_version into step_version from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id and step.hr_group_id = item_row.hr_group_id and step.id = item_row.step_instance_id;
  if definition_key in ('performance-review-additional-v2', 'performance-review-additional-v2-after-self',
      'performance-review-assigned-v1', 'performance-review-assigned-v1-after-self') then
    perform internal_security.performance_review_queue_pmux_transition(item_row.id, 'SUBMIT');
  end if;
  perform public.perform_process_work_item_action(item_row.id, 'SUBMIT', item_row.expected_version, step_version,
    'performance-review-submission:' || new.id::text, null);
  return new;
end;
$$;

create or replace function public.performance_review_advance_pmux_ack()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; item_row public.process_work_items; step_version bigint; definition_key text; action_name text;
begin
  select dossier.* into dossier_row from public.performance_review_dossiers dossier
  where dossier.tenant_id = new.tenant_id and dossier.id = new.dossier_id;
  if dossier_row.process_instance_id is null then return new; end if;
  select definition.key into definition_key from public.process_instances instance
    join public.process_definitions definition on definition.tenant_id = instance.tenant_id
      and definition.hr_group_id = instance.hr_group_id and definition.id = instance.process_definition_id
    where instance.id = dossier_row.process_instance_id;
  select item.* into item_row from public.process_work_items item
  where item.tenant_id = dossier_row.tenant_id and item.hr_group_id = dossier_row.hr_group_id
    and item.process_instance_id = dossier_row.process_instance_id and item.status in ('OPEN', 'CLAIMED')
  order by item.created_at limit 1 for update;
  if item_row.id is null then return new; end if;
  if item_row.status = 'OPEN' then
    perform public.claim_process_work_item(item_row.id, item_row.expected_version);
    select item.* into item_row from public.process_work_items item where item.id = item_row.id;
  end if;
  select step.expected_version into step_version from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id and step.hr_group_id = item_row.hr_group_id and step.id = item_row.step_instance_id;
  if definition_key like 'performance-review-additional-v2%' then
    action_name := 'SUBMIT';
  else
    action_name := 'ACKNOWLEDGE';
  end if;
  if definition_key in ('performance-review-additional-v2', 'performance-review-additional-v2-after-self',
      'performance-review-assigned-v1', 'performance-review-assigned-v1-after-self') then
    perform internal_security.performance_review_queue_pmux_transition(item_row.id, action_name);
  end if;
  perform public.perform_process_work_item_action(item_row.id, action_name, item_row.expected_version, step_version,
    'performance-review-acknowledgement:' || new.dossier_id::text, null);
  return new;
end;
$$;

create or replace function public.performance_review_advance_pmux_closure()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; item_row public.process_work_items; step_version bigint;
begin
  select dossier.* into dossier_row from public.performance_review_dossiers dossier
  where dossier.tenant_id = new.tenant_id and dossier.id = new.dossier_id;
  if dossier_row.process_instance_id is null then return new; end if;
  select item.* into item_row from public.process_work_items item
  where item.tenant_id = dossier_row.tenant_id and item.hr_group_id = dossier_row.hr_group_id
    and item.process_instance_id = dossier_row.process_instance_id and item.status in ('OPEN', 'CLAIMED')
  order by item.created_at limit 1 for update;
  if item_row.id is null then return new; end if;
  if item_row.status = 'OPEN' then
    perform public.claim_process_work_item(item_row.id, item_row.expected_version);
    select item.* into item_row from public.process_work_items item where item.id = item_row.id;
  end if;
  select step.expected_version into step_version from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id and step.hr_group_id = item_row.hr_group_id and step.id = item_row.step_instance_id;
  perform internal_security.performance_review_queue_pmux_transition(item_row.id, 'SUBMIT');
  perform public.perform_process_work_item_action(item_row.id, 'SUBMIT', item_row.expected_version, step_version,
    'performance-review-close:' || new.dossier_id::text, null);
  return new;
end;
$$;

drop trigger if exists performance_review_advance_pmux_closure on public.performance_review_closures;
create trigger performance_review_advance_pmux_closure after insert on public.performance_review_closures
for each row execute function public.performance_review_advance_pmux_closure();

create or replace function public.performance_review_stop_round_tasks()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if new.status in ('CLOSED', 'CANCELLED') and old.status is distinct from new.status then
    update public.process_work_items item set status = 'CANCELLED', claimed_by_user_id = null,
      claimed_at = null, expected_version = item.expected_version + 1, updated_at = timezone('utc', now())
    where item.process_instance_id in (select dossier.process_instance_id from public.performance_review_dossiers dossier
      where dossier.tenant_id = new.tenant_id and dossier.round_id = new.id and dossier.process_instance_id is not null)
      and item.status in ('OPEN', 'CLAIMED');
    update public.process_step_instances step set status = 'CANCELLED', completed_at = timezone('utc', now()),
      expected_version = step.expected_version + 1
    where step.process_instance_id in (select dossier.process_instance_id from public.performance_review_dossiers dossier
      where dossier.tenant_id = new.tenant_id and dossier.round_id = new.id and dossier.process_instance_id is not null)
      and step.status in ('ACTIVE', 'PENDING');
    update public.process_instances instance set status = 'CANCELLED', current_step_key = null,
      completed_at = timezone('utc', now()), updated_at = timezone('utc', now()), instance_version = instance.instance_version + 1
    where instance.id in (select dossier.process_instance_id from public.performance_review_dossiers dossier
      where dossier.tenant_id = new.tenant_id and dossier.round_id = new.id and dossier.process_instance_id is not null)
      and instance.status in ('RUNNING', 'WAITING', 'BLOCKED');
  end if;
  return new;
end;
$$;

drop trigger if exists performance_review_stop_round_tasks on public.performance_review_rounds;
create trigger performance_review_stop_round_tasks after update of status on public.performance_review_rounds
for each row execute function public.performance_review_stop_round_tasks();
revoke all on function public.performance_review_advance_pmux_closure() from public, anon, authenticated;
revoke all on function public.performance_review_stop_round_tasks() from public, anon, authenticated;

create or replace function public.create_performance_review_round_v2(
  requested_hr_group uuid,
  requested_title text,
  requested_introduction text,
  requested_round_type text,
  requested_period_start date,
  requested_period_end date,
  requested_start_date date,
  requested_due_date date,
  requested_rating_snapshot jsonb,
  requested_additional_reviewer_enabled boolean default false,
  requested_idempotency_key text default null
)
returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds; tenant_value uuid; request_hash text; previous_round uuid;
begin
  if auth.uid() is null then raise exception 'PERFORMANCE_AUTH_REQUIRED'; end if;
  select group_row.tenant_id into tenant_value from public.hr_groups group_row
  where group_row.id = requested_hr_group and group_row.is_active;
  if tenant_value is null or not internal_security.performance_review_can_manage(tenant_value, requested_hr_group) then
    raise exception 'PERFORMANCE_FORBIDDEN';
  end if;
  request_hash := md5(concat_ws('|', requested_hr_group::text, requested_title, requested_introduction,
    requested_round_type, requested_period_start::text, requested_period_end::text, requested_start_date::text,
    requested_due_date::text, requested_rating_snapshot::text, requested_additional_reviewer_enabled::text));
  if requested_idempotency_key is not null then
    perform internal_security.performance_review_lock_idempotency('ROUND_CREATED_V2', requested_idempotency_key);
    select command.round_id into previous_round from public.performance_review_round_v2_commands command
    where command.tenant_id = tenant_value and command.actor_user_id = auth.uid()
      and command.idempotency_key = requested_idempotency_key for update;
    if previous_round is not null then
      if not exists (select 1 from public.performance_review_round_v2_commands command
        where command.tenant_id = tenant_value and command.actor_user_id = auth.uid()
          and command.idempotency_key = requested_idempotency_key and command.request_hash = request_hash) then
        raise exception 'PERFORMANCE_IDEMPOTENCY_CONFLICT';
      end if;
      select * into result_row from public.performance_review_rounds where id = previous_round;
      return result_row;
    end if;
  end if;
  select * into result_row from public.create_performance_review_round(
    requested_hr_group, requested_title, requested_introduction, requested_period_start, requested_period_end,
    requested_start_date, requested_due_date, requested_rating_snapshot, requested_idempotency_key, requested_round_type
  );
  update public.performance_review_rounds set additional_reviewer_enabled = requested_additional_reviewer_enabled
  where id = result_row.id returning * into result_row;
  if requested_idempotency_key is not null then
    insert into public.performance_review_round_v2_commands (tenant_id, actor_user_id, idempotency_key, request_hash, round_id)
    values (tenant_value, auth.uid(), requested_idempotency_key, request_hash, result_row.id);
  end if;
  if requested_additional_reviewer_enabled then
    insert into public.performance_review_audit_events (tenant_id, round_id, action, reason, details)
    values (tenant_value, result_row.id, 'ADDITIONAL_REVIEWER_ENABLED', 'Aanvullende beoordelaar ingeschakeld voor deze ronde.',
      jsonb_build_object('enabled', true));
  end if;
  return result_row;
end;
$$;

create or replace function public.update_performance_review_round_v2(
  requested_round uuid,
  requested_title text,
  requested_introduction text,
  requested_round_type text,
  requested_period_start date,
  requested_period_end date,
  requested_start_date date,
  requested_due_date date,
  requested_rating_snapshot jsonb,
  requested_additional_reviewer_enabled boolean,
  expected_version integer
)
returns public.performance_review_rounds
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare result_row public.performance_review_rounds; prior_enabled boolean;
begin
  select round_row.additional_reviewer_enabled into prior_enabled
  from public.performance_review_rounds round_row where round_row.id = requested_round for update;
  if prior_enabled is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  select * into result_row from public.update_performance_review_round(
    requested_round, requested_title, requested_introduction, requested_round_type, requested_period_start,
    requested_period_end, requested_start_date, requested_due_date, requested_rating_snapshot, expected_version
  );
  update public.performance_review_rounds set additional_reviewer_enabled = requested_additional_reviewer_enabled
  where id = requested_round and version = result_row.version returning * into result_row;
  if prior_enabled is distinct from requested_additional_reviewer_enabled then
    insert into public.performance_review_audit_events (tenant_id, round_id, action, reason, details)
    values (result_row.tenant_id, result_row.id, 'ADDITIONAL_REVIEWER_ENABLED',
      case when requested_additional_reviewer_enabled then 'Aanvullende beoordelaar ingeschakeld.' else 'Aanvullende beoordelaar uitgeschakeld.' end,
      jsonb_build_object('enabled', requested_additional_reviewer_enabled));
  end if;
  return result_row;
end;
$$;

create or replace function public.add_performance_review_dossier_v2(
  requested_round uuid,
  requested_employee uuid,
  requested_reviewer uuid,
  requested_additional_reviewer uuid default null,
  requested_administration uuid default null,
  requested_idempotency_key text default null
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare round_row public.performance_review_rounds; result_row public.performance_review_dossiers; previous_id uuid;
  request_hash text; employee_row public.employees; existing_row public.performance_review_dossiers;
begin
  if auth.uid() is null then raise exception 'PERFORMANCE_AUTH_REQUIRED'; end if;
  select * into round_row from public.performance_review_rounds where id = requested_round for update;
  if round_row.id is null or round_row.status not in ('DRAFT', 'SCHEDULED', 'ACTIVE') then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if not internal_security.performance_review_can_manage(round_row.tenant_id, round_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if not round_row.additional_reviewer_enabled and requested_additional_reviewer is not null then
    raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_DISABLED';
  end if;
  select * into employee_row from public.employees employee where employee.tenant_id = round_row.tenant_id
    and employee.hr_group_id = round_row.hr_group_id and employee.id = requested_employee
    and employee.is_active and not employee.is_archived and employee.deleted_at is null;
  if employee_row.id is null then raise exception 'PERFORMANCE_SCOPE_INVALID'; end if;
  if requested_administration is null or not exists (select 1 from public.administrations administration
    where administration.tenant_id = round_row.tenant_id and administration.hr_group_id = round_row.hr_group_id
      and administration.id = requested_administration and administration.is_active) then
    raise exception 'PERFORMANCE_ADMINISTRATION_INVALID';
  end if;
  if not internal_security.performance_review_target_eligible(round_row.tenant_id, round_row.hr_group_id,
      requested_administration, requested_reviewer, requested_employee, requested_additional_reviewer) then
    raise exception 'PERFORMANCE_REVIEWER_INVALID';
  end if;
  if requested_additional_reviewer is not null and not internal_security.performance_review_target_eligible(
      round_row.tenant_id, round_row.hr_group_id, requested_administration, requested_additional_reviewer,
      requested_employee, requested_reviewer) then raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_INVALID'; end if;
  if not exists (select 1 from public.employee_organizations organization
    where organization.tenant_id = round_row.tenant_id and organization.hr_group_id = round_row.hr_group_id
      and organization.employee_id = requested_employee and organization.administration_id = requested_administration
      and organization.effective_from <= current_date and (organization.effective_to is null or organization.effective_to >= current_date)) then
    raise exception 'PERFORMANCE_ADMINISTRATION_INVALID';
  end if;
  request_hash := md5(concat_ws('|', requested_round::text, requested_employee::text, requested_reviewer::text,
    requested_additional_reviewer::text, requested_administration::text));
  if requested_idempotency_key is not null then
    perform internal_security.performance_review_lock_idempotency('DOSSIER_CREATED_V2', requested_idempotency_key);
    previous_id := internal_security.performance_review_previous_result(round_row.tenant_id, 'DOSSIER_CREATED_V2', requested_idempotency_key, request_hash);
    if previous_id is not null then select * into result_row from public.performance_review_dossiers where id = previous_id; return result_row; end if;
  end if;
  select * into existing_row from public.performance_review_dossiers dossier
  where dossier.round_id = requested_round and dossier.employee_id = requested_employee for update;
  if existing_row.id is not null then
    if existing_row.reviewer_employee_id is distinct from requested_reviewer
      or existing_row.additional_reviewer_employee_id is distinct from requested_additional_reviewer then
      raise exception 'PERFORMANCE_DOSSIER_ALREADY_EXISTS';
    end if;
    return existing_row;
  end if;
  insert into public.performance_review_dossiers (
    tenant_id, round_id, hr_group_id, administration_id, employee_id, reviewer_employee_id,
    additional_reviewer_employee_id, additional_reviewer_workflow, reviewer_assignment_override
  ) values (
    round_row.tenant_id, round_row.id, round_row.hr_group_id, requested_administration, requested_employee,
    requested_reviewer, requested_additional_reviewer,
    round_row.additional_reviewer_enabled and requested_additional_reviewer is not null, true
  ) returning * into result_row;
  if requested_idempotency_key is not null then
    insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version)
    values (round_row.tenant_id, auth.uid(), 'DOSSIER_CREATED_V2', requested_idempotency_key, request_hash, result_row.id, result_row.version);
  end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, reason, details)
  values (result_row.tenant_id, result_row.round_id, result_row.id, 'DOSSIER_CREATED',
    'Deelnemer en gespreksverantwoordelijke toegewezen door HR Admin.',
    jsonb_build_object('reviewerEmployeeId', requested_reviewer, 'additionalReviewerEmployeeId', requested_additional_reviewer,
      'additionalReviewerWorkflow', result_row.additional_reviewer_workflow));
  return result_row;
end;
$$;

create or replace function public.search_performance_review_role_candidates(requested_dossier uuid, requested_search text default '')
returns table(employee_id uuid, first_name text, birth_name text, employee_number text)
language plpgsql stable security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  if dossier_row.id is null or not internal_security.performance_review_can_manage(dossier_row.tenant_id, dossier_row.hr_group_id) then
    raise exception 'PERFORMANCE_FORBIDDEN';
  end if;
  return query
  select distinct employee.id, employee.first_name, employee.birth_name, employee.employee_number
  from public.employees employee
  join public.employee_organizations organization on organization.tenant_id = employee.tenant_id
    and organization.hr_group_id = employee.hr_group_id and organization.employee_id = employee.id
  where employee.tenant_id = dossier_row.tenant_id and employee.hr_group_id = dossier_row.hr_group_id
    and employee.id <> dossier_row.employee_id and employee.auth_user_id is not null
    and employee.is_active and not employee.is_archived and employee.deleted_at is null
    and organization.administration_id = dossier_row.administration_id and organization.effective_from <= current_date
    and (organization.effective_to is null or organization.effective_to >= current_date)
    and (coalesce(btrim(requested_search), '') = '' or
      concat_ws(' ', employee.first_name, employee.birth_name, employee.employee_number) ilike '%' || btrim(requested_search) || '%')
  order by employee.birth_name, employee.first_name, employee.employee_number
  limit 500;
end;
$$;

revoke all on function public.create_performance_review_round_v2(uuid, text, text, text, date, date, date, date, jsonb, boolean, text) from public, anon;
grant execute on function public.create_performance_review_round_v2(uuid, text, text, text, date, date, date, date, jsonb, boolean, text) to authenticated;
revoke all on function public.update_performance_review_round_v2(uuid, text, text, text, date, date, date, date, jsonb, boolean, integer) from public, anon;
grant execute on function public.update_performance_review_round_v2(uuid, text, text, text, date, date, date, date, jsonb, boolean, integer) to authenticated;
revoke all on function public.add_performance_review_dossier_v2(uuid, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.add_performance_review_dossier_v2(uuid, uuid, uuid, uuid, uuid, text) to authenticated;
revoke all on function public.search_performance_review_role_candidates(uuid, text) from public, anon;
grant execute on function public.search_performance_review_role_candidates(uuid, text) to authenticated;

create or replace function public.search_performance_review_candidate_employees(
  requested_employee uuid, requested_administration uuid, requested_search text default ''
)
returns table(employee_id uuid, first_name text, birth_name text, employee_number text)
language plpgsql stable security definer set search_path = public, internal_security, auth, pg_temp as $$
declare subject public.employees;
begin
  select * into subject from public.employees employee where employee.id = requested_employee;
  if subject.id is null or not internal_security.performance_review_can_manage(subject.tenant_id, subject.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if not exists (select 1 from public.employee_organizations organization
    where organization.tenant_id = subject.tenant_id and organization.hr_group_id = subject.hr_group_id
      and organization.employee_id = subject.id and organization.administration_id = requested_administration
      and organization.effective_from <= current_date and (organization.effective_to is null or organization.effective_to >= current_date)) then
    raise exception 'PERFORMANCE_ADMINISTRATION_INVALID';
  end if;
  return query select distinct candidate.id, candidate.first_name, candidate.birth_name, candidate.employee_number
    from public.employees candidate
    join public.employee_organizations organization on organization.tenant_id = candidate.tenant_id
      and organization.hr_group_id = candidate.hr_group_id and organization.employee_id = candidate.id
    where candidate.tenant_id = subject.tenant_id and candidate.hr_group_id = subject.hr_group_id
      and candidate.id <> subject.id and candidate.auth_user_id is not null and candidate.is_active
      and not candidate.is_archived and candidate.deleted_at is null
      and organization.administration_id = requested_administration and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to >= current_date)
      and (coalesce(btrim(requested_search), '') = '' or concat_ws(' ', candidate.first_name, candidate.birth_name, candidate.employee_number)
        ilike '%' || btrim(requested_search) || '%')
    order by candidate.birth_name, candidate.first_name, candidate.employee_number limit 500;
end;
$$;

create or replace function internal_security.performance_review_can_private(
  requested_tenant uuid, requested_hr_group uuid, requested_employee uuid, requested_reviewer uuid,
  requested_write boolean default false
)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    internal_security.performance_review_can_manage(requested_tenant, requested_hr_group)
    or (
      internal_security.current_employee_id(requested_tenant, requested_hr_group) = requested_reviewer
      and not exists (
        select 1 from public.performance_review_dossiers dossier
        where dossier.tenant_id = requested_tenant and dossier.hr_group_id = requested_hr_group
          and dossier.employee_id = requested_employee and dossier.reviewer_employee_id = requested_reviewer
          and dossier.additional_reviewer_workflow and dossier.additional_reviewer_employee_id = requested_reviewer
      )
      and coalesce(internal_security.can_manage_employee(requested_employee,
        case when requested_write then 'performance-review:private-write' else 'performance-review:private-read' end), false)
    ), false
  )
$$;

create or replace function public.performance_review_deny_additional_reviewer_private_write()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers;
begin
  select * into dossier_row from public.performance_review_dossiers dossier
  where dossier.tenant_id = new.tenant_id and dossier.id = new.dossier_id;
  if dossier_row.id is not null
    and internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id) = dossier_row.additional_reviewer_employee_id
    and not internal_security.performance_review_can_manage(dossier_row.tenant_id, dossier_row.hr_group_id) then
    raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists performance_review_deny_additional_reviewer_appraisal_write on public.performance_review_appraisal_links;
create trigger performance_review_deny_additional_reviewer_appraisal_write before insert on public.performance_review_appraisal_links
for each row execute function public.performance_review_deny_additional_reviewer_private_write();
revoke all on function public.performance_review_deny_additional_reviewer_private_write() from public, anon, authenticated;

create or replace function public.add_performance_review_attachment(
  requested_dossier uuid, requested_storage_key text, requested_filename text,
  requested_content_type text, requested_size bigint, requested_checksum text,
  requested_idempotency_key text default null
)
returns public.performance_review_attachments
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  result_row public.performance_review_attachments; actor uuid; previous_id uuid; request_hash text;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  if dossier_row.id is null or actor is distinct from dossier_row.reviewer_employee_id
    or dossier_row.phase <> 'WAITING_MANAGER'
    or (not dossier_row.reviewer_assignment_override and not coalesce(internal_security.can_manage_employee(dossier_row.employee_id, 'performance-review:team-submit'), false)) then
    raise exception 'PERFORMANCE_ATTACHMENT_FORBIDDEN';
  end if;
  if not exists (select 1 from public.performance_review_rounds where id = dossier_row.round_id and status = 'ACTIVE') then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if requested_content_type not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    or requested_size > 26214400 or requested_checksum !~ '^[0-9a-f]{64}$' then raise exception 'PERFORMANCE_ATTACHMENT_INVALID'; end if;
  if requested_idempotency_key is null or length(btrim(requested_idempotency_key)) not between 8 and 160 then raise exception 'PERFORMANCE_IDEMPOTENCY_KEY_REQUIRED'; end if;
  request_hash := md5(concat_ws('|', dossier_row.id::text, btrim(requested_filename), requested_content_type, requested_size::text, requested_checksum));
  perform internal_security.performance_review_lock_idempotency('ATTACHMENT_CREATED', requested_idempotency_key);
  previous_id := internal_security.performance_review_previous_result(dossier_row.tenant_id, 'ATTACHMENT_CREATED', requested_idempotency_key, request_hash);
  if previous_id is not null then
    select * into result_row from public.performance_review_attachments
    where tenant_id = dossier_row.tenant_id and id = previous_id and dossier_id = dossier_row.id;
    if result_row.id is null then raise exception 'PERFORMANCE_ATTACHMENT_NOT_FOUND'; end if;
    return result_row;
  end if;
  insert into public.performance_review_attachments (tenant_id, dossier_id, uploaded_by, storage_key, original_filename, content_type, file_size, checksum_sha256)
  values (dossier_row.tenant_id, dossier_row.id, auth.uid(), requested_storage_key, btrim(requested_filename), requested_content_type, requested_size, requested_checksum)
  returning * into result_row;
  insert into public.performance_review_command_results (tenant_id, actor_user_id, operation, idempotency_key, request_hash, result_id, result_version)
  values (dossier_row.tenant_id, auth.uid(), 'ATTACHMENT_CREATED', requested_idempotency_key, request_hash, result_row.id, null);
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action) values (dossier_row.tenant_id, dossier_row.id, 'ATTACHMENT_ADDED');
  return result_row;
end;
$$;

revoke all on function public.search_performance_review_candidate_employees(uuid, uuid, text) from public, anon;
grant execute on function public.search_performance_review_candidate_employees(uuid, uuid, text) to authenticated;

create or replace function public.configure_performance_review_reviewers(
  requested_dossier uuid,
  requested_reviewer uuid,
  requested_additional_reviewer uuid,
  expected_version integer,
  requested_reason text,
  requested_preserve_drafts boolean default false
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  manager_submission public.performance_review_submissions; additional_submission public.performance_review_submissions;
  old_reviewer uuid; old_additional uuid; old_workflow boolean; manager_archives integer := 0; additional_archives integer := 0;
  changed boolean; audit_action text;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  if dossier_row.id is null or not internal_security.performance_review_can_manage(dossier_row.tenant_id, dossier_row.hr_group_id) then
    raise exception 'PERFORMANCE_FORBIDDEN';
  end if;
  if length(btrim(coalesce(requested_reason, ''))) not between 1 and 500 then raise exception 'PERFORMANCE_REASON_REQUIRED'; end if;
  if dossier_row.version <> expected_version then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  if round_row.status not in ('DRAFT', 'SCHEDULED', 'ACTIVE') then raise exception 'PERFORMANCE_ROUND_CLOSED'; end if;
  if dossier_row.phase not in ('WAITING_EMPLOYEE', 'WAITING_ADDITIONAL_REVIEWER', 'WAITING_MANAGER') then
    raise exception 'PERFORMANCE_REVIEWER_CHANGE_LOCKED';
  end if;
  if requested_additional_reviewer is not null and not round_row.additional_reviewer_enabled then
    raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_DISABLED';
  end if;
  if requested_reviewer is null or not internal_security.performance_review_target_eligible(
    dossier_row.tenant_id, dossier_row.hr_group_id, dossier_row.administration_id,
    requested_reviewer, dossier_row.employee_id, requested_additional_reviewer
  ) then raise exception 'PERFORMANCE_REVIEWER_INVALID'; end if;
  if requested_additional_reviewer is not null and not internal_security.performance_review_target_eligible(
    dossier_row.tenant_id, dossier_row.hr_group_id, dossier_row.administration_id,
    requested_additional_reviewer, dossier_row.employee_id, requested_reviewer
  ) then raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_INVALID'; end if;
  select * into manager_submission from public.performance_review_submissions submission
  where submission.tenant_id = dossier_row.tenant_id and submission.dossier_id = dossier_row.id and submission.kind = 'MANAGER';
  select * into additional_submission from public.performance_review_submissions submission
  where submission.tenant_id = dossier_row.tenant_id and submission.dossier_id = dossier_row.id and submission.kind = 'ADDITIONAL_REVIEWER';
  if manager_submission.submitted_at is not null or additional_submission.submitted_at is not null then
    raise exception 'PERFORMANCE_SUBMITTED_REVIEWER_IMMUTABLE';
  end if;
  old_reviewer := dossier_row.reviewer_employee_id;
  old_additional := dossier_row.additional_reviewer_employee_id;
  old_workflow := dossier_row.additional_reviewer_workflow;
  changed := old_reviewer is distinct from requested_reviewer or old_additional is distinct from requested_additional_reviewer;
  if not changed then return dossier_row; end if;
  if old_workflow and requested_additional_reviewer is null then raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_RELEASE_REQUIRED'; end if;
  if dossier_row.additional_reviewer_released_at is not null then raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_ALREADY_RELEASED'; end if;
  if old_reviewer is distinct from requested_reviewer and manager_submission.id is not null and manager_submission.submitted_at is null then
    if not requested_preserve_drafts then raise exception 'PERFORMANCE_DRAFTS_REQUIRE_CONFIRMATION'; end if;
    select internal_security.performance_review_archive_drafts(dossier_row.id, 'MANAGER', auth.uid(), requested_reason) into manager_archives;
  end if;
  if old_additional is distinct from requested_additional_reviewer and additional_submission.id is not null and additional_submission.submitted_at is null then
    if not requested_preserve_drafts then raise exception 'PERFORMANCE_DRAFTS_REQUIRE_CONFIRMATION'; end if;
    select internal_security.performance_review_archive_drafts(dossier_row.id, 'ADDITIONAL_REVIEWER', auth.uid(), requested_reason) into additional_archives;
  end if;
  update public.performance_review_dossiers set
    reviewer_employee_id = requested_reviewer,
    additional_reviewer_employee_id = requested_additional_reviewer,
    additional_reviewer_workflow = round_row.additional_reviewer_enabled and requested_additional_reviewer is not null,
    reviewer_assignment_override = true,
    additional_reviewer_released_at = null,
    additional_reviewer_released_by = null,
    version = version + 1
  where id = dossier_row.id and version = expected_version returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  perform internal_security.performance_review_sync_pmux_fields(dossier_row.id);
  if round_row.status = 'ACTIVE' then
    if dossier_row.process_instance_id is null then
      perform internal_security.performance_review_start_pmux(dossier_row.id);
    elsif old_workflow is distinct from dossier_row.additional_reviewer_workflow then
      perform internal_security.performance_review_rebuild_pmux(dossier_row.id);
    elsif dossier_row.phase = 'WAITING_ADDITIONAL_REVIEWER' and old_additional is distinct from requested_additional_reviewer then
      perform internal_security.performance_review_assign_current_work_item(dossier_row.id, requested_additional_reviewer,
        'PERFORMANCE_REVIEWER_ADMIN', requested_reason);
    elsif dossier_row.phase = 'WAITING_MANAGER' and old_reviewer is distinct from requested_reviewer then
      perform internal_security.performance_review_assign_current_work_item(dossier_row.id, requested_reviewer,
        'PERFORMANCE_REVIEWER_ADMIN', requested_reason);
    end if;
  end if;
  audit_action := case
    when old_reviewer is distinct from requested_reviewer and old_additional is distinct from requested_additional_reviewer then 'REVIEWERS_SWAPPED'
    when old_additional is null and requested_additional_reviewer is not null then 'ADDITIONAL_REVIEWER_ASSIGNED'
    when old_additional is not null and requested_additional_reviewer is null then 'ADDITIONAL_REVIEWER_RELEASED'
    when old_additional is distinct from requested_additional_reviewer then 'ADDITIONAL_REVIEWER_REPLACED'
    else 'REVIEWER_REASSIGNED'
  end;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, reason, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, audit_action, btrim(requested_reason),
    jsonb_build_object('previousReviewerEmployeeId', old_reviewer, 'reviewerEmployeeId', requested_reviewer,
      'previousAdditionalReviewerEmployeeId', old_additional, 'additionalReviewerEmployeeId', requested_additional_reviewer,
      'additionalReviewerWorkflow', dossier_row.additional_reviewer_workflow,
      'managerDraftsArchived', manager_archives, 'additionalReviewerDraftsArchived', additional_archives));
  return dossier_row;
end;
$$;

create or replace function public.save_performance_review_additional_reviewer(
  requested_dossier uuid, requested_body text, expected_version integer, submit_now boolean default false
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  submission_row public.performance_review_submissions; actor uuid;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  if dossier_row.id is null or actor is distinct from dossier_row.additional_reviewer_employee_id then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if not dossier_row.additional_reviewer_workflow or dossier_row.additional_reviewer_released_at is not null then raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_DISABLED'; end if;
  if dossier_row.phase <> 'WAITING_ADDITIONAL_REVIEWER' or dossier_row.version <> expected_version then raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT'; end if;
  if round_row.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if length(btrim(coalesce(requested_body, ''))) not between 1 and 10000 then raise exception 'PERFORMANCE_ADDITIONAL_REVIEWER_REQUIRED'; end if;
  if submit_now then perform set_config('liquidhr.performance_review.domain_transition', 'on', true); end if;
  insert into public.performance_review_submissions (
    tenant_id, dossier_id, kind, author_user_id, body, score, rating_explanation, meeting_date, submitted_at
  ) values (
    dossier_row.tenant_id, dossier_row.id, 'ADDITIONAL_REVIEWER', auth.uid(), btrim(requested_body), null, null, null,
    case when submit_now then now() end
  ) on conflict (tenant_id, dossier_id, kind) do update set
    body = excluded.body, submitted_at = excluded.submitted_at, version = public.performance_review_submissions.version + 1
  where public.performance_review_submissions.submitted_at is null returning * into submission_row;
  if submission_row.id is null then raise exception 'PERFORMANCE_SUBMISSION_IMMUTABLE'; end if;
  update public.performance_review_dossiers set phase = case when submit_now then 'WAITING_MANAGER' else phase end,
    version = version + 1 where id = dossier_row.id and version = expected_version returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id,
    case when submit_now then 'ADDITIONAL_REVIEWER_SUBMITTED' else 'ADDITIONAL_REVIEWER_SAVED' end,
    jsonb_build_object('submissionVersion', submission_row.version));
  return dossier_row;
end;
$$;

create or replace function public.save_performance_review_manager(
  requested_dossier uuid, requested_body text, requested_meeting_date date, requested_score integer,
  requested_rating_explanation text, expected_version integer, submit_now boolean default false
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  actor uuid; submission_row public.performance_review_submissions; is_domain_pmux boolean;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  if dossier_row.id is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  if actor is distinct from dossier_row.reviewer_employee_id
    or (not dossier_row.reviewer_assignment_override and not coalesce(internal_security.can_manage_employee(dossier_row.employee_id, 'performance-review:team-submit'), false)) then
    raise exception 'PERFORMANCE_FORBIDDEN';
  end if;
  if dossier_row.phase <> 'WAITING_MANAGER' or dossier_row.version <> expected_version then raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT'; end if;
  if round_row.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if length(btrim(coalesce(requested_body, ''))) not between 1 and 10000 then raise exception 'PERFORMANCE_MANAGER_REQUIRED'; end if;
  if round_row.rating_snapshot is null and (requested_score is not null or requested_rating_explanation is not null) then raise exception 'PERFORMANCE_RATING_NOT_ALLOWED'; end if;
  if round_row.rating_snapshot is not null and (requested_score is null
    or not exists (select 1 from jsonb_array_elements(round_row.rating_snapshot->'options') item where (item->>'score')::integer = requested_score)
    or length(btrim(coalesce(requested_rating_explanation, ''))) = 0) then raise exception 'PERFORMANCE_RATING_REQUIRED'; end if;
  is_domain_pmux := dossier_row.additional_reviewer_workflow or dossier_row.reviewer_assignment_override;
  if submit_now and is_domain_pmux then perform set_config('liquidhr.performance_review.domain_transition', 'on', true); end if;
  insert into public.performance_review_submissions (
    tenant_id, dossier_id, kind, author_user_id, body, score, rating_explanation, meeting_date, submitted_at
  ) values (
    dossier_row.tenant_id, dossier_row.id, 'MANAGER', auth.uid(), btrim(requested_body), requested_score,
    nullif(btrim(requested_rating_explanation), ''), requested_meeting_date, case when submit_now then now() end
  ) on conflict (tenant_id, dossier_id, kind) do update set body = excluded.body, score = excluded.score,
    rating_explanation = excluded.rating_explanation, meeting_date = excluded.meeting_date,
    submitted_at = excluded.submitted_at, version = public.performance_review_submissions.version + 1
  where public.performance_review_submissions.submitted_at is null returning * into submission_row;
  if submission_row.id is null then raise exception 'PERFORMANCE_SUBMISSION_IMMUTABLE'; end if;
  update public.performance_review_dossiers set phase = case when submit_now then 'WAITING_ACKNOWLEDGEMENT' else phase end,
    version = version + 1 where id = dossier_row.id and version = expected_version returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, case when submit_now then 'MANAGER_SUBMITTED' else 'MANAGER_SAVED' end);
  return dossier_row;
end;
$$;

create or replace function public.acknowledge_performance_review(
  requested_dossier uuid, requested_decision text, requested_reason text, expected_version integer
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds; actor uuid;
  next_phase text; is_v2 boolean;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  if dossier_row.id is null or actor is distinct from dossier_row.employee_id
    or dossier_row.phase <> 'WAITING_ACKNOWLEDGEMENT' or dossier_row.version <> expected_version then
    raise exception 'PERFORMANCE_FORBIDDEN_OR_CONFLICT';
  end if;
  if round_row.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  if requested_decision not in ('AGREE', 'DISAGREE')
    or (requested_decision = 'DISAGREE' and length(btrim(coalesce(requested_reason, ''))) = 0)
    or (requested_decision = 'AGREE' and requested_reason is not null) then raise exception 'PERFORMANCE_ACK_INVALID'; end if;
  is_v2 := dossier_row.additional_reviewer_workflow;
  if is_v2 then perform set_config('liquidhr.performance_review.domain_transition', 'on', true); end if;
  insert into public.performance_review_acknowledgements (tenant_id, dossier_id, actor_user_id, decision, reason)
  values (dossier_row.tenant_id, dossier_row.id, auth.uid(), requested_decision, nullif(btrim(requested_reason), ''));
  next_phase := case when is_v2 then 'WAITING_REVIEWER_CLOSE'
    when requested_decision = 'AGREE' then 'COMPLETED_AGREED' else 'COMPLETED_DISAGREED' end;
  update public.performance_review_dossiers set phase = next_phase, version = version + 1
  where id = dossier_row.id and version = expected_version returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, 'ACKNOWLEDGED', jsonb_build_object('decision', requested_decision));
  return dossier_row;
end;
$$;

create or replace function public.close_performance_review_dossier_v2(requested_dossier uuid, expected_version integer)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  actor uuid; acknowledgement_row public.performance_review_acknowledgements;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  actor := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  if dossier_row.id is null or not dossier_row.additional_reviewer_workflow or actor is distinct from dossier_row.reviewer_employee_id
    or (not dossier_row.reviewer_assignment_override and not coalesce(internal_security.can_manage_employee(dossier_row.employee_id, 'performance-review:team-submit'), false)) then
    raise exception 'PERFORMANCE_FORBIDDEN';
  end if;
  if dossier_row.phase <> 'WAITING_REVIEWER_CLOSE' or dossier_row.version <> expected_version then raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT'; end if;
  if round_row.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  select * into acknowledgement_row from public.performance_review_acknowledgements acknowledgement
  where acknowledgement.tenant_id = dossier_row.tenant_id and acknowledgement.dossier_id = dossier_row.id;
  if acknowledgement_row.dossier_id is null then raise exception 'PERFORMANCE_ACK_REQUIRED'; end if;
  insert into public.performance_review_closures (tenant_id, dossier_id, actor_user_id)
  values (dossier_row.tenant_id, dossier_row.id, auth.uid());
  update public.performance_review_dossiers set phase = case when acknowledgement_row.decision = 'AGREE'
    then 'COMPLETED_AGREED' else 'COMPLETED_DISAGREED' end, version = version + 1
  where id = dossier_row.id and version = expected_version returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, 'REVIEWER_CLOSED',
    jsonb_build_object('closureId', acknowledgement_row.dossier_id, 'decision', acknowledgement_row.decision));
  return dossier_row;
end;
$$;

revoke all on function public.configure_performance_review_reviewers(uuid, uuid, uuid, integer, text, boolean) from public, anon;
grant execute on function public.configure_performance_review_reviewers(uuid, uuid, uuid, integer, text, boolean) to authenticated;
revoke all on function public.save_performance_review_additional_reviewer(uuid, text, integer, boolean) from public, anon;
grant execute on function public.save_performance_review_additional_reviewer(uuid, text, integer, boolean) to authenticated;
revoke all on function public.save_performance_review_manager(uuid, text, date, integer, text, integer, boolean) from public, anon;
grant execute on function public.save_performance_review_manager(uuid, text, date, integer, text, integer, boolean) to authenticated;
revoke all on function public.acknowledge_performance_review(uuid, text, text, integer) from public, anon;
grant execute on function public.acknowledge_performance_review(uuid, text, text, integer) to authenticated;
revoke all on function public.close_performance_review_dossier_v2(uuid, integer) from public, anon;
grant execute on function public.close_performance_review_dossier_v2(uuid, integer) to authenticated;

create or replace function public.release_performance_review_additional_reviewer(
  requested_dossier uuid, expected_version integer, requested_reason text
)
returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_row public.performance_review_rounds;
  actor_employee uuid; item_row public.process_work_items; step_version bigint; submission_row public.performance_review_submissions;
  previous_additional_employee uuid; archived_drafts integer := 0;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  select * into round_row from public.performance_review_rounds where id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier for update;
  previous_additional_employee := dossier_row.additional_reviewer_employee_id;
  if dossier_row.id is null or not internal_security.performance_review_can_manage(dossier_row.tenant_id, dossier_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if length(btrim(coalesce(requested_reason, ''))) not between 1 and 500 then raise exception 'PERFORMANCE_REASON_REQUIRED'; end if;
  if dossier_row.version <> expected_version or dossier_row.phase <> 'WAITING_ADDITIONAL_REVIEWER'
    or not dossier_row.additional_reviewer_workflow or dossier_row.additional_reviewer_released_at is not null then
    raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT';
  end if;
  if round_row.status <> 'ACTIVE' then raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE'; end if;
  select * into submission_row from public.performance_review_submissions submission
  where submission.tenant_id = dossier_row.tenant_id and submission.dossier_id = dossier_row.id
    and submission.kind = 'ADDITIONAL_REVIEWER';
  if submission_row.submitted_at is not null then raise exception 'PERFORMANCE_SUBMITTED_REVIEWER_IMMUTABLE'; end if;
  if submission_row.id is not null then
    select internal_security.performance_review_archive_drafts(dossier_row.id, 'ADDITIONAL_REVIEWER', auth.uid(), requested_reason)
    into archived_drafts;
  end if;
  actor_employee := internal_security.current_employee_id(dossier_row.tenant_id, dossier_row.hr_group_id);
  if actor_employee is null then raise exception 'PERFORMANCE_HR_EMPLOYEE_LINK_REQUIRED'; end if;
  update public.performance_review_dossiers set additional_reviewer_employee_id = null,
    additional_reviewer_released_at = timezone('utc', now()), additional_reviewer_released_by = auth.uid(),
    phase = 'WAITING_MANAGER', version = version + 1
  where id = dossier_row.id and version = expected_version returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  perform internal_security.performance_review_sync_pmux_fields(dossier_row.id);
  perform internal_security.performance_review_assign_current_work_item(dossier_row.id, actor_employee,
    'PERFORMANCE_REVIEW_HR_RELEASE', requested_reason);
  select item.* into item_row from public.process_work_items item
  where item.tenant_id = dossier_row.tenant_id and item.hr_group_id = dossier_row.hr_group_id
    and item.process_instance_id = dossier_row.process_instance_id and item.status in ('OPEN', 'CLAIMED')
  order by item.created_at limit 1 for update;
  if item_row.id is null then raise exception 'PERFORMANCE_PMUX_TASK_NOT_FOUND'; end if;
  if item_row.status = 'OPEN' then
    perform public.claim_process_work_item(item_row.id, item_row.expected_version);
    select item.* into item_row from public.process_work_items item where item.id = item_row.id;
  end if;
  select step.expected_version into step_version from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id and step.hr_group_id = item_row.hr_group_id and step.id = item_row.step_instance_id;
  perform internal_security.performance_review_queue_pmux_transition(item_row.id, 'RELEASE');
  perform public.perform_process_work_item_action(item_row.id, 'RELEASE', item_row.expected_version, step_version,
    'performance-review-release:' || dossier_row.id::text, null);
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, reason, details)
  values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, 'ADDITIONAL_REVIEWER_RELEASED', btrim(requested_reason),
    jsonb_build_object('releasedBy', auth.uid(), 'previousAdditionalReviewerEmployeeId', previous_additional_employee,
      'archivedDraftCount', archived_drafts, 'phase', dossier_row.phase, 'processInstanceId', dossier_row.process_instance_id));
  return dossier_row;
end;
$$;

create or replace function internal_security.performance_review_role_flip_snapshot(requested_round uuid, requested_ids uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'dossierId', dossier.id,
    'employeeId', dossier.employee_id,
    'reviewerEmployeeId', dossier.reviewer_employee_id,
    'additionalReviewerEmployeeId', dossier.additional_reviewer_employee_id,
    'workflowEnabled', dossier.additional_reviewer_workflow,
    'reviewerOverride', dossier.reviewer_assignment_override,
    'phase', dossier.phase,
    'version', dossier.version,
    'roundStatus', round_row.status,
    'managerSubmittedAt', manager_submission.submitted_at,
    'additionalReviewerSubmittedAt', additional_submission.submitted_at,
    'managerDraftVersion', case when manager_submission.submitted_at is null then manager_submission.version else null end,
    'additionalReviewerDraftVersion', case when additional_submission.submitted_at is null then additional_submission.version else null end,
    'currentTaskStep', task.step_key,
    'currentTaskStatus', task.status,
    'currentTaskAssignee', task.assignee_employee_id,
    'blockReason', case
      when round_row.status in ('CLOSED', 'CANCELLED') then 'ROUND_CLOSED'
      when dossier.phase not in ('WAITING_EMPLOYEE', 'WAITING_ADDITIONAL_REVIEWER', 'WAITING_MANAGER') then 'REVIEWER_SUBMITTED'
      when manager_submission.submitted_at is not null or additional_submission.submitted_at is not null then 'REVIEWER_SUBMITTED'
      when dossier.additional_reviewer_employee_id is null then 'MISSING_ADDITIONAL_REVIEWER'
      when dossier.employee_id = dossier.reviewer_employee_id
        or dossier.employee_id = dossier.additional_reviewer_employee_id
        or dossier.reviewer_employee_id = dossier.additional_reviewer_employee_id then 'INVALID_ASSIGNMENT'
      else null end,
    'hasDrafts', (manager_submission.id is not null and manager_submission.submitted_at is null)
      or (additional_submission.id is not null and additional_submission.submitted_at is null)
  ) order by dossier.id), '[]'::jsonb)
  from public.performance_review_dossiers dossier
  join public.performance_review_rounds round_row on round_row.tenant_id = dossier.tenant_id and round_row.id = dossier.round_id
  left join public.performance_review_submissions manager_submission on manager_submission.tenant_id = dossier.tenant_id
    and manager_submission.dossier_id = dossier.id and manager_submission.kind = 'MANAGER'
  left join public.performance_review_submissions additional_submission on additional_submission.tenant_id = dossier.tenant_id
    and additional_submission.dossier_id = dossier.id and additional_submission.kind = 'ADDITIONAL_REVIEWER'
  left join lateral (
    select work_item.step_key, work_item.status, work_item.assignee_employee_id
    from public.process_work_items work_item where work_item.tenant_id = dossier.tenant_id
      and work_item.hr_group_id = dossier.hr_group_id and work_item.process_instance_id = dossier.process_instance_id
      and work_item.status in ('OPEN', 'CLAIMED') order by work_item.created_at limit 1
  ) task on true
  where dossier.round_id = requested_round and (requested_ids is null or dossier.id = any(requested_ids))
$$;

create or replace function public.preview_performance_review_role_flip(
  requested_round uuid, requested_scope text, requested_ids uuid[] default null
)
returns jsonb language plpgsql stable security definer set search_path = public, internal_security, auth, pg_temp as $$
declare round_row public.performance_review_rounds; normalized_ids uuid[]; snapshot_rows jsonb; preview_hash text;
begin
  select * into round_row from public.performance_review_rounds where id = requested_round;
  if round_row.id is null or not internal_security.performance_review_can_manage(round_row.tenant_id, round_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if requested_scope not in ('ALL', 'FILTERED', 'SELECTED') then raise exception 'PERFORMANCE_SCOPE_INVALID'; end if;
  if requested_scope = 'ALL' then
    normalized_ids := null;
  else
    if requested_ids is null or cardinality(requested_ids) = 0 then raise exception 'PERFORMANCE_SELECTION_REQUIRED'; end if;
    select array_agg(distinct id order by id) into normalized_ids from unnest(requested_ids) as requested(id);
    if exists (select 1 from unnest(normalized_ids) requested(id)
      where not exists (select 1 from public.performance_review_dossiers dossier where dossier.round_id = requested_round and dossier.id = requested.id)) then
      raise exception 'PERFORMANCE_SCOPE_INVALID';
    end if;
  end if;
  snapshot_rows := internal_security.performance_review_role_flip_snapshot(requested_round, normalized_ids);
  preview_hash := md5(snapshot_rows::text);
  return jsonb_build_object(
    'roundId', requested_round, 'scope', requested_scope, 'previewHash', preview_hash,
    'total', jsonb_array_length(snapshot_rows),
    'eligible', (select count(*) from jsonb_array_elements(snapshot_rows) item where item->>'blockReason' is null),
    'blocked', (select count(*) from jsonb_array_elements(snapshot_rows) item where item->>'blockReason' is not null),
    'draftCount', (select count(*) from jsonb_array_elements(snapshot_rows) item where item->>'hasDrafts' = 'true'),
    'items', snapshot_rows
  );
end;
$$;

create or replace function public.apply_performance_review_role_flip(
  requested_round uuid,
  requested_ids uuid[],
  requested_preview_hash text,
  requested_reason text,
  requested_preserve_drafts boolean,
  requested_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare round_row public.performance_review_rounds; normalized_ids uuid[]; current_rows jsonb; current_hash text;
  request_hash text; previous_hash text; previous_result jsonb; result_row jsonb; item jsonb; changed_count integer := 0;
  blocked_items jsonb; changed_ids jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'PERFORMANCE_AUTH_REQUIRED'; end if;
  if length(btrim(coalesce(requested_reason, ''))) not between 1 and 500 then raise exception 'PERFORMANCE_REASON_REQUIRED'; end if;
  if requested_ids is null or cardinality(requested_ids) = 0 then raise exception 'PERFORMANCE_SELECTION_REQUIRED'; end if;
  if requested_idempotency_key is null or length(btrim(requested_idempotency_key)) not between 8 and 160 then raise exception 'PERFORMANCE_IDEMPOTENCY_KEY_INVALID'; end if;
  select * into round_row from public.performance_review_rounds where id = requested_round for update;
  if round_row.id is null or not internal_security.performance_review_can_manage(round_row.tenant_id, round_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  select array_agg(distinct id order by id) into normalized_ids from unnest(requested_ids) as requested(id);
  if exists (select 1 from unnest(normalized_ids) requested(id)
    where not exists (select 1 from public.performance_review_dossiers dossier where dossier.round_id = requested_round and dossier.id = requested.id)) then
    raise exception 'PERFORMANCE_SCOPE_INVALID';
  end if;
  request_hash := md5(concat_ws('|', requested_round::text, array_to_string(normalized_ids, ','), requested_preview_hash,
    btrim(requested_reason), requested_preserve_drafts::text));
  perform internal_security.performance_review_lock_idempotency('REVIEWERS_BULK_SWAPPED', requested_idempotency_key);
  select command.request_hash, command.result into previous_hash, previous_result
  from public.performance_review_role_flip_commands command
  where command.tenant_id = round_row.tenant_id and command.actor_user_id = auth.uid()
    and command.idempotency_key = requested_idempotency_key for update;
  if previous_hash is not null then
    if previous_hash <> request_hash then raise exception 'PERFORMANCE_IDEMPOTENCY_CONFLICT'; end if;
    return previous_result;
  end if;
  perform dossier.id from public.performance_review_dossiers dossier
  where dossier.round_id = requested_round and dossier.id = any(normalized_ids) order by dossier.id for update;
  current_rows := internal_security.performance_review_role_flip_snapshot(requested_round, normalized_ids);
  current_hash := md5(current_rows::text);
  if current_hash <> requested_preview_hash then raise exception 'PERFORMANCE_PREVIEW_STALE'; end if;
  if not requested_preserve_drafts and exists (select 1 from jsonb_array_elements(current_rows) draft_item where draft_item->>'blockReason' is null and draft_item->>'hasDrafts' = 'true') then
    raise exception 'PERFORMANCE_DRAFTS_REQUIRE_CONFIRMATION';
  end if;
  for item in select value from jsonb_array_elements(current_rows) value where value->>'blockReason' is null
  loop
    perform public.configure_performance_review_reviewers(
      (item->>'dossierId')::uuid,
      (item->>'additionalReviewerEmployeeId')::uuid,
      (item->>'reviewerEmployeeId')::uuid,
      (item->>'version')::integer,
      btrim(requested_reason),
      requested_preserve_drafts
    );
    changed_count := changed_count + 1;
    changed_ids := changed_ids || jsonb_build_array(item->>'dossierId');
  end loop;
  select coalesce(jsonb_agg(blocked_item order by blocked_item->>'dossierId'), '[]'::jsonb) into blocked_items
  from jsonb_array_elements(current_rows) blocked_item where blocked_item->>'blockReason' is not null;
  result_row := jsonb_build_object('roundId', requested_round, 'changed', changed_count,
    'blocked', jsonb_array_length(blocked_items), 'changedIds', changed_ids, 'exceptions', blocked_items,
    'previewHash', current_hash, 'draftsPreserved', requested_preserve_drafts);
  insert into public.performance_review_role_flip_commands (tenant_id, actor_user_id, idempotency_key, request_hash, result)
  values (round_row.tenant_id, auth.uid(), requested_idempotency_key, request_hash, result_row);
  insert into public.performance_review_audit_events (tenant_id, round_id, action, reason, details)
  values (round_row.tenant_id, requested_round, 'REVIEWERS_BULK_SWAPPED', btrim(requested_reason),
    jsonb_build_object('changed', changed_count, 'blocked', jsonb_array_length(blocked_items),
      'selectedDossierIds', to_jsonb(normalized_ids), 'changedDossierIds', changed_ids, 'previewHash', current_hash));
  return result_row;
end;
$$;

revoke all on function internal_security.performance_review_role_flip_snapshot(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.release_performance_review_additional_reviewer(uuid, integer, text) from public, anon;
grant execute on function public.release_performance_review_additional_reviewer(uuid, integer, text) to authenticated;
revoke all on function public.preview_performance_review_role_flip(uuid, text, uuid[]) from public, anon;
grant execute on function public.preview_performance_review_role_flip(uuid, text, uuid[]) to authenticated;
revoke all on function public.apply_performance_review_role_flip(uuid, uuid[], text, text, boolean, text) from public, anon;
grant execute on function public.apply_performance_review_role_flip(uuid, uuid[], text, text, boolean, text) to authenticated;

commit;
