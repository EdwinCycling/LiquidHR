begin;

alter table public.performance_review_dossiers
  add column if not exists process_instance_id uuid;

create unique index if not exists performance_review_dossiers_process_instance_idx
  on public.performance_review_dossiers (process_instance_id)
  where process_instance_id is not null;

-- Eén gepubliceerde PMUX-definitie per HR-groep. De ronde zelf blijft eigenaar
-- van de inhoud; PMUX beheert alleen de uitvoerbare fase-werktaken.
insert into public.process_definitions (tenant_id, hr_group_id, scope_type, key, title, description, status, business_type, business_category)
select group_row.tenant_id, group_row.id, 'TENANT'::public.access_scope_type,
  'performance-review-mvp',
  '{"nl":"Gesprekscyclus","en":"Performance review"}'::jsonb,
  '{"nl":"Gesprekscyclus voor medewerker, manager en bevestiging.","en":"Performance review workflow for employee, manager and acknowledgement."}'::jsonb,
  'PUBLISHED'::public.process_definition_status,
  'P_MUTATION',
  'GENERAL'
from public.hr_groups group_row
where group_row.is_active
on conflict (tenant_id, hr_group_id, key) do nothing;

insert into public.process_versions (tenant_id, hr_group_id, process_definition_id, version_number, schema_version, compiler_version, definition_json, definition_hash)
select definition.tenant_id, definition.hr_group_id, definition.id, 1, 1, 'perf-mvp-01',
  jsonb_build_object(
    'schemaVersion', 1,
    'key', 'performance-review-mvp',
    'startStepKey', 'self-reflection',
    'participants', jsonb_build_array(
      jsonb_build_object('key','employee','label',jsonb_build_object('nl','Medewerker','en','Employee'),'selector',jsonb_build_object('type','SUBJECT_EMPLOYEE','resolutionDatePolicy','STEP_ACTIVATED_AT'),'assignmentMode','EXACTLY_ONE','permission','self:process-task:act'),
      jsonb_build_object('key','manager','label',jsonb_build_object('nl','Manager','en','Manager'),'selector',jsonb_build_object('type','DIRECT_MANAGER_OF_SUBJECT','resolutionDatePolicy','BUSINESS_EFFECTIVE_DATE'),'assignmentMode','EXACTLY_ONE','permission','process-task:act')
    ),
    'steps', jsonb_build_array(
      jsonb_build_object('key','self-reflection','type','FORM','title',jsonb_build_object('nl','Zelfreflectie','en','Self-reflection'),'participantKey','employee','allowedActions',jsonb_build_array('SUBMIT','CANCEL')),
      jsonb_build_object('key','manager-response','type','FORM','title',jsonb_build_object('nl','Managerreactie','en','Manager response'),'participantKey','manager','allowedActions',jsonb_build_array('SUBMIT','CANCEL')),
      jsonb_build_object('key','employee-acknowledgement','type','ACKNOWLEDGEMENT','title',jsonb_build_object('nl','Gesprek bevestigen','en','Acknowledge review'),'participantKey','employee','allowedActions',jsonb_build_array('ACKNOWLEDGE','CANCEL')),
      jsonb_build_object('key','completed','type','END','title',jsonb_build_object('nl','Afgerond','en','Completed'),'allowedActions',jsonb_build_array(),'terminalOutcome','COMPLETED'),
      jsonb_build_object('key','cancelled','type','END','title',jsonb_build_object('nl','Geannuleerd','en','Cancelled'),'allowedActions',jsonb_build_array(),'terminalOutcome','CANCELLED')
    ),
    'transitions', jsonb_build_array(
      jsonb_build_object('key','self-submit','fromStepKey','self-reflection','toStepKey','manager-response','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Zelfreflectie indienen','en','Submit self-reflection')),
      jsonb_build_object('key','self-cancel','fromStepKey','self-reflection','toStepKey','cancelled','action','CANCEL','kind','FORWARD','label',jsonb_build_object('nl','Annuleren','en','Cancel')),
      jsonb_build_object('key','manager-submit','fromStepKey','manager-response','toStepKey','employee-acknowledgement','action','SUBMIT','kind','FORWARD','label',jsonb_build_object('nl','Reactie indienen','en','Submit response')),
      jsonb_build_object('key','manager-cancel','fromStepKey','manager-response','toStepKey','cancelled','action','CANCEL','kind','FORWARD','label',jsonb_build_object('nl','Annuleren','en','Cancel')),
      jsonb_build_object('key','employee-ack','fromStepKey','employee-acknowledgement','toStepKey','completed','action','ACKNOWLEDGE','kind','FORWARD','label',jsonb_build_object('nl','Bevestigen','en','Acknowledge')),
      jsonb_build_object('key','employee-cancel','fromStepKey','employee-acknowledgement','toStepKey','cancelled','action','CANCEL','kind','FORWARD','label',jsonb_build_object('nl','Annuleren','en','Cancel'))
    )
  ),
  encode(extensions.digest(convert_to((definition.id::text || ':performance-review-mvp:1'),'utf8'),'sha256'),'hex')
from public.process_definitions definition
where definition.key = 'performance-review-mvp'
on conflict (tenant_id, hr_group_id, process_definition_id, version_number) do nothing;

insert into public.permissions (code, name, category, description) values
  ('process-instance:start', 'Gespreksproces starten', 'Workforce', 'Start een gespreksdossier in PMUX.'),
  ('self:process-instance:start', 'Eigen gespreksproces starten', 'Persoonlijk', 'Start een eigen gespreksdossier in PMUX.'),
  ('process-task:act', 'Gesprekstaak uitvoeren', 'Workforce', 'Voert een toegewezen gespreksstap uit.'),
  ('self:process-task:act', 'Eigen gesprekstaak uitvoeren', 'Persoonlijk', 'Voert de eigen gespreksstap uit.'),
  ('process-task:reassign', 'Gesprekstaak opnieuw toewijzen', 'Workforce', 'Wijst een open gespreksstap opnieuw toe aan een bevoegde reviewer.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is not null
  and permission.code in ('process-instance:start','process-task:act','process-task:reassign')
  and exists (
    select 1
    from public.role_permissions existing_rp
    join public.permissions existing_permission on existing_permission.id = existing_rp.permission_id
    where existing_rp.management_role_id = role.id
      and existing_permission.code = 'hr-group:manage'
  )
on conflict do nothing;
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code = 'HR_ADMIN' and permission.code in ('process-task:reassign') on conflict do nothing;
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code = 'DIRECT_MANAGER' and permission.code = 'process-task:act' on conflict do nothing;
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code = 'EMPLOYEE' and permission.code in ('self:process-instance:start','self:process-task:act') on conflict do nothing;

create or replace function public.reassign_performance_review_reviewer(
  requested_dossier uuid,
  requested_reviewer uuid,
  expected_version integer
) returns public.performance_review_dossiers
language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare
  dossier_row public.performance_review_dossiers;
  round_row public.performance_review_rounds;
  target public.employees;
  work_item public.process_work_items;
  next_revision integer;
  old_reviewer uuid;
begin
  select * into dossier_row from public.performance_review_dossiers where id = requested_dossier;
  if dossier_row.id is null then raise exception 'PERFORMANCE_NOT_FOUND'; end if;
  select * into round_row from public.performance_review_rounds where tenant_id = dossier_row.tenant_id and id = dossier_row.round_id for update;
  select * into dossier_row from public.performance_review_dossiers where tenant_id = round_row.tenant_id and id = requested_dossier for update;
  if not internal_security.performance_review_can_manage(dossier_row.tenant_id, dossier_row.hr_group_id) then raise exception 'PERFORMANCE_FORBIDDEN'; end if;
  if round_row.status <> 'ACTIVE' or dossier_row.phase <> 'WAITING_MANAGER' or dossier_row.version <> expected_version then
    raise exception 'PERFORMANCE_VERSION_OR_PHASE_CONFLICT';
  end if;
  old_reviewer := dossier_row.reviewer_employee_id;
  if requested_reviewer = old_reviewer then return dossier_row; end if;
  select employee.* into target from public.employees employee
   where employee.tenant_id = dossier_row.tenant_id and employee.hr_group_id = dossier_row.hr_group_id
     and employee.id = requested_reviewer and employee.is_active and not employee.is_archived
     and employee.deleted_at is null and employee.auth_user_id is not null;
  if target.id is null then raise exception 'PERFORMANCE_REVIEWER_INVALID'; end if;
  if not exists (
    select 1 from public.employee_organizations organization
     where organization.tenant_id = dossier_row.tenant_id and organization.hr_group_id = dossier_row.hr_group_id
       and organization.employee_id = dossier_row.employee_id
       and requested_reviewer in (organization.direct_manager_id, organization.direct_manager_deputy_id)
       and organization.effective_from <= current_date and (organization.effective_to is null or organization.effective_to >= current_date)
  ) then raise exception 'PERFORMANCE_REVIEWER_NOT_CURRENT_MANAGER'; end if;
  if not exists (
    select 1 from public.employments employment
     where employment.tenant_id = dossier_row.tenant_id and employment.hr_group_id = dossier_row.hr_group_id
       and employment.employee_id = target.id and employment.is_primary and employment.deleted_at is null
       and employment.record_status = 'CONFIRMED' and employment.starts_on <= current_date
       and (employment.ends_on is null or employment.ends_on >= current_date)
  ) or not exists (
    select 1 from public.employee_organizations organization
     where organization.tenant_id = dossier_row.tenant_id and organization.hr_group_id = dossier_row.hr_group_id
       and organization.employee_id = target.id and organization.effective_from <= current_date
       and (organization.effective_to is null or organization.effective_to >= current_date)
  ) then raise exception 'PERFORMANCE_REVIEWER_NOT_CURRENT_EMPLOYEE'; end if;
  select item.* into work_item from public.process_work_items item
   where item.process_instance_id = dossier_row.process_instance_id and item.tenant_id = dossier_row.tenant_id
     and item.hr_group_id = dossier_row.hr_group_id and item.participant_key = 'manager' and item.step_key = 'manager-response'
     and item.status in ('OPEN', 'CLAIMED') for update;
  if work_item.id is null then raise exception 'PERFORMANCE_PMUX_TASK_NOT_OPEN'; end if;
  select coalesce(max(candidate.resolution_revision), 0) + 1 into next_revision
    from public.process_work_item_candidates candidate where candidate.work_item_id = work_item.id;
  insert into public.process_work_item_candidates (
    tenant_id, hr_group_id, work_item_id, employee_id, candidate_user_id, management_role_code,
    resolution_revision, resolution_policy, resolution_date, resolution_source, is_eligible,
    evidence
  ) values (
    dossier_row.tenant_id, dossier_row.hr_group_id, work_item.id, target.id, target.auth_user_id,
    case when exists (
      select 1 from public.employee_organizations organization
       where organization.tenant_id = dossier_row.tenant_id and organization.hr_group_id = dossier_row.hr_group_id
         and organization.employee_id = dossier_row.employee_id and organization.direct_manager_id = requested_reviewer
         and organization.effective_from <= current_date and (organization.effective_to is null or organization.effective_to >= current_date)
    ) then 'DIRECT_MANAGER' else 'DIRECT_MANAGER_DEPUTY' end,
    next_revision, 'BUSINESS_EFFECTIVE_DATE', current_date,
    'performance-review-reviewer-reassignment', true,
    jsonb_build_object('dossierId', dossier_row.id, 'previousReviewerEmployeeId', old_reviewer)
  );
  perform public.reassign_process_work_item(work_item.id, work_item.expected_version, target.id);
  update public.performance_review_dossiers set reviewer_employee_id = target.id, version = version + 1
   where tenant_id = dossier_row.tenant_id and id = dossier_row.id and version = expected_version
   returning * into dossier_row;
  if dossier_row.id is null then raise exception 'PERFORMANCE_VERSION_CONFLICT'; end if;
  insert into public.performance_review_audit_events (tenant_id, round_id, dossier_id, action, reason)
   values (dossier_row.tenant_id, dossier_row.round_id, dossier_row.id, 'REVIEWER_REASSIGNED', old_reviewer::text || ' -> ' || target.id::text);
  return dossier_row;
end;
$$;

revoke all on function public.reassign_performance_review_reviewer(uuid, uuid, integer) from public, anon;
grant execute on function public.reassign_performance_review_reviewer(uuid, uuid, integer) to authenticated;

create or replace function internal_security.performance_review_start_pmux(requested_dossier uuid)
returns void language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row public.performance_review_dossiers; round_status text; definition_id uuid; process_result jsonb;
begin
  select d.* into dossier_row from public.performance_review_dossiers d where d.id = requested_dossier for update;
  if dossier_row.id is null or dossier_row.process_instance_id is not null then return; end if;
  select status into round_status from public.performance_review_rounds where id = dossier_row.round_id;
  -- Draft and future-scheduled rounds have no runnable PMUX work until publish/activation.
  if round_status <> 'ACTIVE' then return; end if;
  select id into definition_id from public.process_definitions where tenant_id = dossier_row.tenant_id and hr_group_id = dossier_row.hr_group_id and key = 'performance-review-mvp' and status = 'PUBLISHED';
  if definition_id is null then raise exception 'PERFORMANCE_PMUX_DEFINITION_MISSING'; end if;
  select public.start_process(definition_id, dossier_row.employee_id, null, current_date, 'performance-review:' || dossier_row.id::text, null) into process_result;
  update public.performance_review_dossiers set process_instance_id = (process_result->>'processInstanceId')::uuid where id = dossier_row.id;
end;
$$;

create or replace function public.performance_review_attach_pmux()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
begin
  perform internal_security.performance_review_start_pmux(new.id);
  return new;
end;
$$;

create or replace function public.performance_review_start_pmux_on_activation()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
declare dossier_row record;
begin
  if new.status = 'ACTIVE' and old.status is distinct from new.status then
    for dossier_row in select d.id from public.performance_review_dossiers d where d.round_id = new.id and d.process_instance_id is null loop
      perform internal_security.performance_review_start_pmux(dossier_row.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger performance_review_attach_pmux
after insert on public.performance_review_dossiers
for each row execute function public.performance_review_attach_pmux();

drop trigger if exists performance_review_start_pmux_on_activation on public.performance_review_rounds;
create trigger performance_review_start_pmux_on_activation
after update of status on public.performance_review_rounds
for each row execute function public.performance_review_start_pmux_on_activation();

-- The existing PMUX step insert trigger enqueues its idempotent reminder job
-- from deadline_at. Apply the round deadline after PMUX/work-calendar deadline
-- materialization so all three phases receive the same local end-of-day limit.
create or replace function internal_security.performance_review_set_pmux_due_date()
returns trigger language plpgsql security definer set search_path = '' as $$
declare due_date_value date; time_zone_value text;
begin
  select r.due_date, group_row.time_zone into due_date_value, time_zone_value
    from public.performance_review_dossiers d
    join public.process_instances instance on instance.tenant_id = d.tenant_id and instance.hr_group_id = d.hr_group_id
      and instance.id = new.process_instance_id and instance.idempotency_key = 'performance-review:' || d.id::text
    join public.performance_review_rounds r on r.tenant_id = d.tenant_id and r.id = d.round_id
    join public.hr_groups group_row on group_row.tenant_id = d.tenant_id and group_row.id = d.hr_group_id
   where r.status = 'ACTIVE';
  if due_date_value is not null then
    if time_zone_value is null or not exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = time_zone_value) then
      raise exception 'PERFORMANCE_TIME_ZONE_INVALID';
    end if;
    new.deadline_at := (due_date_value + 1)::timestamp at time zone time_zone_value;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_performance_review_pmux_due_date on public.process_step_instances;
create trigger zz_performance_review_pmux_due_date
before insert or update of status, activated_at on public.process_step_instances
for each row execute function internal_security.performance_review_set_pmux_due_date();

-- The performance-review RPCs remain the source of truth for dossier data.
-- These triggers mirror each final submission into the already-running PMUX
-- instance so the workflow has real, auditable work-item transitions.
create or replace function public.performance_review_advance_pmux()
returns trigger language plpgsql security definer
set search_path = public, internal_security, auth, pg_temp as $$
declare
  dossier_row public.performance_review_dossiers;
  item_row public.process_work_items;
  step_version bigint;
  action_key text;
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' then
    if old.submitted_at is not null then return new; end if;
  end if;
  select d.* into dossier_row
    from public.performance_review_dossiers d
   where d.tenant_id = new.tenant_id and d.id = new.dossier_id;
  if dossier_row.process_instance_id is null then return new; end if;
  select item.* into item_row
    from public.process_work_items item
   where item.tenant_id = dossier_row.tenant_id
     and item.hr_group_id = dossier_row.hr_group_id
     and item.process_instance_id = dossier_row.process_instance_id
     and item.status in ('OPEN', 'CLAIMED')
   order by item.created_at
   limit 1;
  if item_row.id is null then return new; end if;
  select step.expected_version into step_version
    from public.process_step_instances step
   where step.tenant_id = item_row.tenant_id
     and step.hr_group_id = item_row.hr_group_id
     and step.id = item_row.step_instance_id;
  action_key := case new.kind when 'SELF' then 'SUBMIT' else 'SUBMIT' end;
  perform public.perform_process_work_item_action(
    item_row.id, action_key, item_row.expected_version, step_version,
    'performance-review-submission:' || new.id::text, null
  );
  return new;
end;
$$;

drop trigger if exists performance_review_advance_pmux_submission on public.performance_review_submissions;
create trigger performance_review_advance_pmux_submission
after insert or update of submitted_at on public.performance_review_submissions
for each row execute function public.performance_review_advance_pmux();

create or replace function public.performance_review_advance_pmux_ack()
returns trigger language plpgsql security definer
set search_path = public, internal_security, auth, pg_temp as $$
declare
  dossier_row public.performance_review_dossiers;
  item_row public.process_work_items;
  step_version bigint;
begin
  select d.* into dossier_row
    from public.performance_review_dossiers d
   where d.tenant_id = new.tenant_id and d.id = new.dossier_id;
  if dossier_row.process_instance_id is null then return new; end if;
  select item.* into item_row
    from public.process_work_items item
   where item.tenant_id = dossier_row.tenant_id
     and item.hr_group_id = dossier_row.hr_group_id
     and item.process_instance_id = dossier_row.process_instance_id
     and item.status in ('OPEN', 'CLAIMED')
   order by item.created_at
   limit 1;
  if item_row.id is null then return new; end if;
  select step.expected_version into step_version
    from public.process_step_instances step
   where step.tenant_id = item_row.tenant_id
     and step.hr_group_id = item_row.hr_group_id
     and step.id = item_row.step_instance_id;
  perform public.perform_process_work_item_action(
    item_row.id, 'ACKNOWLEDGE', item_row.expected_version, step_version,
    'performance-review-acknowledgement:' || new.dossier_id::text, null
  );
  return new;
end;
$$;

drop trigger if exists performance_review_advance_pmux_ack on public.performance_review_acknowledgements;
create trigger performance_review_advance_pmux_ack
after insert on public.performance_review_acknowledgements
for each row execute function public.performance_review_advance_pmux_ack();

create or replace function public.performance_review_cancel_pmux_on_close()
returns trigger language plpgsql security definer set search_path = public, internal_security, auth, pg_temp as $$
begin
  if new.status in ('CLOSED', 'CANCELLED') and old.status not in ('CLOSED', 'CANCELLED') then
    update public.process_instances set status = 'CANCELLED', completed_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id in (select process_instance_id from public.performance_review_dossiers where round_id = new.id and process_instance_id is not null)
      and status in ('RUNNING','WAITING','BLOCKED');
    update public.process_work_items set status = 'CANCELLED', updated_at = timezone('utc', now())
    where process_instance_id in (select process_instance_id from public.performance_review_dossiers where round_id = new.id and process_instance_id is not null)
      and status in ('OPEN','CLAIMED');
  end if;
  return new;
end;
$$;

create trigger performance_review_cancel_pmux_on_close
after update of status on public.performance_review_rounds
for each row execute function public.performance_review_cancel_pmux_on_close();

revoke all on function public.performance_review_attach_pmux() from public, anon, authenticated;
revoke all on function internal_security.performance_review_start_pmux(uuid) from public, anon, authenticated;
revoke all on function public.performance_review_start_pmux_on_activation() from public, anon, authenticated;
revoke all on function internal_security.performance_review_set_pmux_due_date() from public, anon, authenticated;
revoke all on function public.performance_review_cancel_pmux_on_close() from public, anon, authenticated;
revoke all on function public.performance_review_advance_pmux() from public, anon, authenticated;
revoke all on function public.performance_review_advance_pmux_ack() from public, anon, authenticated;

commit;
