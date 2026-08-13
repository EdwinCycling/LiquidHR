-- Guided Recruitment stap 1: RLS/projecties, atomic lifecycle, publieke intakeproof en private Storage.

create schema if not exists internal_recruitment;
revoke all on schema internal_recruitment from public, anon, authenticated;

create or replace function internal_security.recruitment_hr_can(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_modules module
    where module.tenant_id = requested_tenant_id
      and module.module_code = 'RECRUITMENT'
      and module.is_enabled
  ) and internal_security.current_user_has_hr_group_permission(
    requested_tenant_id,
    requested_hr_group_id,
    requested_permission_code
  );
$$;

create or replace function internal_security.current_recruitment_employee_id(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id
  from public.employees employee
  where employee.auth_user_id = (select auth.uid())
    and employee.tenant_id = requested_tenant_id
    and employee.hr_group_id = requested_hr_group_id
    and employee.is_active
    and not employee.is_archived
    and employee.deleted_at is null
  limit 1;
$$;

create or replace function internal_security.recruitment_participant_can_read_application(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_application_id uuid,
  requested_capability text default 'APPLICATION_READ'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recruitment_applications application
    join public.recruitment_participations participation
      on participation.tenant_id = application.tenant_id
     and participation.hr_group_id = application.hr_group_id
     and participation.application_id = application.id
    where application.tenant_id = requested_tenant_id
      and application.hr_group_id = requested_hr_group_id
      and application.id = requested_application_id
      and application.terminal_outcome is null
      and participation.employee_id = internal_security.current_recruitment_employee_id(requested_tenant_id, requested_hr_group_id)
      and participation.status in ('ASSIGNED','ACTIVE')
      and requested_capability = any(participation.capabilities)
      and internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, 'recruitment-participation:read')
  );
$$;

create or replace function internal_security.recruitment_participant_can_read_assessment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_assessment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select assessment.*
    from public.recruitment_assessments assessment
    where assessment.tenant_id = requested_tenant_id
      and assessment.hr_group_id = requested_hr_group_id
      and assessment.id = requested_assessment_id
  ), actor as (
    select internal_security.current_recruitment_employee_id(requested_tenant_id, requested_hr_group_id) as employee_id
  )
  select exists (
    select 1
    from target
    cross join actor
    where internal_security.recruitment_participant_can_read_application(
      target.tenant_id,
      target.hr_group_id,
      target.application_id,
      'ASSESSMENT_READ'
    )
      and (
        target.reviewer_employee_id = actor.employee_id
        or exists (
          select 1
          from public.recruitment_assessments own_assessment
          where own_assessment.tenant_id = target.tenant_id
            and own_assessment.hr_group_id = target.hr_group_id
            and own_assessment.application_id = target.application_id
            and own_assessment.interview_id = target.interview_id
            and own_assessment.reviewer_employee_id = actor.employee_id
            and own_assessment.status in ('SUBMITTED','CORRECTED')
        )
      )
  );
$$;

revoke all on function internal_security.recruitment_hr_can(uuid,uuid,text) from public, anon;
revoke all on function internal_security.current_recruitment_employee_id(uuid,uuid) from public, anon;
revoke all on function internal_security.recruitment_participant_can_read_application(uuid,uuid,uuid,text) from public, anon;
revoke all on function internal_security.recruitment_participant_can_read_assessment(uuid,uuid,uuid) from public, anon;
grant execute on function internal_security.recruitment_hr_can(uuid,uuid,text) to authenticated;
grant execute on function internal_security.current_recruitment_employee_id(uuid,uuid) to authenticated;
grant execute on function internal_security.recruitment_participant_can_read_application(uuid,uuid,uuid,text) to authenticated;
grant execute on function internal_security.recruitment_participant_can_read_assessment(uuid,uuid,uuid) to authenticated;

create policy recruitment_settings_read on public.recruitment_settings for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-settings:manage'));
create policy recruitment_pipeline_stages_read on public.recruitment_pipeline_stages for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-vacancy:read')
  or internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-settings:manage'));
create policy recruitment_vacancies_read on public.recruitment_vacancies for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-vacancy:read'));
create policy recruitment_vacancy_sections_read on public.recruitment_vacancy_sections for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-vacancy:read'));
create policy recruitment_vacancy_questions_read on public.recruitment_vacancy_questions for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-vacancy:read'));
create policy recruitment_publications_read on public.recruitment_publications for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-vacancy:read'));
create policy recruitment_candidates_read on public.recruitment_candidates for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read'));
create policy recruitment_applications_read on public.recruitment_applications for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read'));
create policy recruitment_application_answers_read on public.recruitment_application_answers for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read'));
create policy recruitment_documents_read on public.recruitment_documents for select to authenticated
using (scan_status = 'CLEAN' and deleted_at is null
  and internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read'));
create policy recruitment_participations_read on public.recruitment_participations for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read')
  or (employee_id = internal_security.current_recruitment_employee_id(tenant_id, hr_group_id)
    and status in ('ASSIGNED','ACTIVE')
    and internal_security.recruitment_participant_can_read_application(tenant_id, hr_group_id, application_id, 'APPLICATION_READ')));
create policy recruitment_interviews_read on public.recruitment_interviews for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read'));
create policy recruitment_interview_participants_read on public.recruitment_interview_participants for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read'));
create policy recruitment_library_items_read on public.recruitment_library_items for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-assessment:read')
  or internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-settings:manage'));
create policy recruitment_library_item_states_read on public.recruitment_library_item_states for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-assessment:read')
  or internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-settings:manage'));
create policy recruitment_characteristics_read on public.recruitment_characteristics for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-assessment:read')
  or internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-settings:manage'));
create policy recruitment_sets_read on public.recruitment_sets for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-assessment:read')
  or internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-settings:manage'));
create policy recruitment_set_items_read on public.recruitment_set_items for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-assessment:read')
  or internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-settings:manage'));
create policy recruitment_assessments_read on public.recruitment_assessments for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-assessment:read')
  or internal_security.recruitment_participant_can_read_assessment(tenant_id, hr_group_id, id));
create policy recruitment_assessment_scores_read on public.recruitment_assessment_scores for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-assessment:read')
  or internal_security.recruitment_participant_can_read_assessment(tenant_id, hr_group_id, assessment_id));
create policy recruitment_events_read on public.recruitment_events for select to authenticated
using (internal_security.recruitment_hr_can(tenant_id, hr_group_id, 'recruitment-candidate:read'));

grant select on table
  public.recruitment_settings, public.recruitment_pipeline_stages, public.recruitment_vacancies,
  public.recruitment_vacancy_sections, public.recruitment_vacancy_questions, public.recruitment_publications,
  public.recruitment_candidates, public.recruitment_applications, public.recruitment_application_answers,
  public.recruitment_documents, public.recruitment_participations, public.recruitment_interviews,
  public.recruitment_interview_participants, public.recruitment_library_items,
  public.recruitment_library_item_states, public.recruitment_characteristics, public.recruitment_sets,
  public.recruitment_set_items, public.recruitment_assessments, public.recruitment_assessment_scores,
  public.recruitment_events
to authenticated;

grant all on table
  public.recruitment_settings, public.recruitment_pipeline_stages, public.recruitment_vacancies,
  public.recruitment_vacancy_sections, public.recruitment_vacancy_questions, public.recruitment_publications,
  public.recruitment_candidates, public.recruitment_applications, public.recruitment_application_answers,
  public.recruitment_documents, public.recruitment_participations, public.recruitment_interviews,
  public.recruitment_interview_participants, public.recruitment_library_items,
  public.recruitment_library_item_states, public.recruitment_characteristics, public.recruitment_sets,
  public.recruitment_set_items, public.recruitment_assessments, public.recruitment_assessment_scores,
  public.recruitment_events, public.recruitment_public_intake_limits
to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recruitment-documents', 'recruitment-documents', false, 10485760, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function internal_recruitment.transition_application(
  requested_application_id uuid,
  requested_stage_id uuid,
  expected_version integer,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare application public.recruitment_applications%rowtype;
declare replay_result jsonb;
declare mutation_result jsonb;
begin
  select * into application from public.recruitment_applications where id = requested_application_id for update;
  if not found then raise exception 'RECRUITMENT_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.recruitment_hr_can(application.tenant_id, application.hr_group_id, 'recruitment-candidate:write') then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_idempotency_key is null or char_length(requested_idempotency_key) < 8 then
    raise exception 'RECRUITMENT_IDEMPOTENCY_REQUIRED' using errcode = '22023';
  end if;
  select event.payload into replay_result from public.recruitment_events event
  where event.application_id = application.id and event.idempotency_key = requested_idempotency_key;
  if replay_result is not null then
    return replay_result || jsonb_build_object('idempotentReplay', true);
  end if;
  if application.version <> expected_version then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  if application.terminal_outcome is not null then raise exception 'RECRUITMENT_APPLICATION_TERMINAL' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.recruitment_pipeline_stages stage
    where stage.tenant_id = application.tenant_id and stage.hr_group_id = application.hr_group_id
      and stage.id = requested_stage_id and stage.is_active
  ) then raise exception 'RECRUITMENT_STAGE_INVALID' using errcode = '22023'; end if;

  update public.recruitment_applications
  set active_stage_id = requested_stage_id, version = version + 1, updated_by_user_id = (select auth.uid())
  where id = application.id returning * into application;
  mutation_result := jsonb_build_object('id', application.id, 'version', application.version, 'idempotentReplay', false);
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, idempotency_key, actor_user_id, payload)
  values (application.tenant_id, application.hr_group_id, application.id, 'APPLICATION_STAGE_CHANGED', requested_idempotency_key, (select auth.uid()), mutation_result);
  return mutation_result;
end;
$$;

create or replace function internal_recruitment.terminal_transition_application(
  requested_application_id uuid,
  requested_outcome text,
  requested_reason text,
  expected_version integer,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare application public.recruitment_applications%rowtype;
declare retention integer;
declare replay_result jsonb;
declare mutation_result jsonb;
begin
  if requested_outcome not in ('AFGEWEZEN','AANGENOMEN') then raise exception 'RECRUITMENT_OUTCOME_INVALID' using errcode = '22023'; end if;
  select * into application from public.recruitment_applications where id = requested_application_id for update;
  if not found then raise exception 'RECRUITMENT_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.recruitment_hr_can(application.tenant_id, application.hr_group_id, 'recruitment-candidate:write') then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_idempotency_key is null or char_length(requested_idempotency_key) < 8 then raise exception 'RECRUITMENT_IDEMPOTENCY_REQUIRED' using errcode = '22023'; end if;
  select event.payload into replay_result from public.recruitment_events event
  where event.application_id = application.id and event.idempotency_key = requested_idempotency_key;
  if replay_result is not null then
    return replay_result || jsonb_build_object('idempotentReplay', true);
  end if;
  if application.version <> expected_version then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  if application.terminal_outcome is not null then raise exception 'RECRUITMENT_APPLICATION_TERMINAL' using errcode = 'P0001'; end if;
  select coalesce(settings.retention_days, 28) into retention
  from public.recruitment_settings settings
  where settings.tenant_id = application.tenant_id and settings.hr_group_id = application.hr_group_id;
  retention := coalesce(retention, 28);

  update public.recruitment_applications
  set active_stage_id = null, terminal_outcome = requested_outcome, terminal_reason = requested_reason,
      terminal_at = timezone('utc', now()), retention_due_at = timezone('utc', now()) + make_interval(days => retention),
      version = version + 1, updated_by_user_id = (select auth.uid())
  where id = application.id returning * into application;
  update public.recruitment_participations
  set status = 'REVOKED', revoked_at = timezone('utc', now()), version = version + 1
  where application_id = application.id and status in ('ASSIGNED','ACTIVE');
  mutation_result := jsonb_build_object('id', application.id, 'version', application.version, 'outcome', requested_outcome, 'idempotentReplay', false);
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, idempotency_key, actor_user_id, payload)
  values (application.tenant_id, application.hr_group_id, application.id, 'APPLICATION_' || requested_outcome, requested_idempotency_key, (select auth.uid()), mutation_result);
  return mutation_result;
end;
$$;

create or replace function internal_recruitment.reopen_application(
  requested_application_id uuid,
  requested_stage_id uuid,
  expected_version integer,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare application public.recruitment_applications%rowtype;
declare replay_result jsonb;
declare mutation_result jsonb;
begin
  select * into application from public.recruitment_applications where id = requested_application_id for update;
  if not found then raise exception 'RECRUITMENT_APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.recruitment_hr_can(application.tenant_id, application.hr_group_id, 'recruitment-candidate:write') then raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501'; end if;
  if requested_idempotency_key is null or char_length(requested_idempotency_key) < 8 then raise exception 'RECRUITMENT_IDEMPOTENCY_REQUIRED' using errcode = '22023'; end if;
  select event.payload into replay_result from public.recruitment_events event
  where event.application_id = application.id and event.idempotency_key = requested_idempotency_key;
  if replay_result is not null then
    return replay_result || jsonb_build_object('idempotentReplay', true);
  end if;
  if application.version <> expected_version then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  if application.terminal_outcome is null then raise exception 'RECRUITMENT_APPLICATION_NOT_TERMINAL' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.recruitment_pipeline_stages stage where stage.tenant_id = application.tenant_id and stage.hr_group_id = application.hr_group_id and stage.id = requested_stage_id and stage.is_active) then raise exception 'RECRUITMENT_STAGE_INVALID' using errcode = '22023'; end if;

  update public.recruitment_applications
  set active_stage_id = requested_stage_id, terminal_outcome = null, terminal_reason = null, terminal_note = null,
      terminal_at = null, retention_due_at = null, version = version + 1, updated_by_user_id = (select auth.uid())
  where id = application.id returning * into application;
  mutation_result := jsonb_build_object('id', application.id, 'version', application.version, 'idempotentReplay', false, 'participantsRestored', false);
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, idempotency_key, actor_user_id, payload)
  values (application.tenant_id, application.hr_group_id, application.id, 'APPLICATION_REOPENED', requested_idempotency_key, (select auth.uid()), mutation_result);
  return mutation_result;
end;
$$;

create or replace function internal_recruitment.set_pipeline_stage_active(
  requested_stage_id uuid,
  requested_is_active boolean,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare stage public.recruitment_pipeline_stages%rowtype;
begin
  select * into stage
  from public.recruitment_pipeline_stages
  where id = requested_stage_id
  for update;
  if not found then raise exception 'RECRUITMENT_STAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.recruitment_hr_can(stage.tenant_id, stage.hr_group_id, 'recruitment-settings:manage') then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if stage.version <> expected_version then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  if stage.is_active and not requested_is_active and (
    select count(*) from public.recruitment_pipeline_stages other
    where other.tenant_id = stage.tenant_id and other.hr_group_id = stage.hr_group_id and other.is_active
  ) <= 1 then
    raise exception 'RECRUITMENT_PIPELINE_REQUIRES_ACTIVE_STAGE' using errcode = '23514';
  end if;
  update public.recruitment_pipeline_stages
  set is_active = requested_is_active, version = version + 1, updated_by_user_id = (select auth.uid())
  where id = stage.id
  returning * into stage;
  return jsonb_build_object('id', stage.id, 'version', stage.version, 'isActive', stage.is_active);
end;
$$;

create or replace function internal_recruitment.update_retention_settings(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_retention_days integer,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare settings public.recruitment_settings%rowtype;
declare changed_count integer;
begin
  if requested_retention_days not between 1 and 3650 then
    raise exception 'RECRUITMENT_RETENTION_INVALID' using errcode = '22023';
  end if;
  if not internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, 'recruitment-settings:manage') then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;
  select * into settings
  from public.recruitment_settings row
  where row.tenant_id = requested_tenant_id and row.hr_group_id = requested_hr_group_id
  for update;
  if not found then
    if expected_version <> 0 then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
    insert into public.recruitment_settings (
      tenant_id, hr_group_id, retention_days, created_by_user_id, updated_by_user_id
    ) values (
      requested_tenant_id, requested_hr_group_id, requested_retention_days, (select auth.uid()), (select auth.uid())
    ) returning * into settings;
  else
    if settings.version <> expected_version then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
    update public.recruitment_settings
    set retention_days = requested_retention_days, version = version + 1, updated_by_user_id = (select auth.uid())
    where id = settings.id
    returning * into settings;
  end if;
  update public.recruitment_applications application
  set retention_due_at = application.terminal_at + make_interval(days => requested_retention_days),
      version = application.version + 1,
      updated_by_user_id = (select auth.uid())
  where application.tenant_id = requested_tenant_id
    and application.hr_group_id = requested_hr_group_id
    and application.terminal_outcome is not null
    and application.terminal_at is not null
    and application.anonymized_at is null;
  get diagnostics changed_count = row_count;
  return jsonb_build_object(
    'id', settings.id,
    'version', settings.version,
    'retentionDays', settings.retention_days,
    'recomputedApplications', changed_count,
    'requiresLongRetentionWarning', settings.retention_days > 365
  );
end;
$$;

create or replace function public.transition_recruitment_application(requested_application_id uuid, requested_stage_id uuid, expected_version integer, requested_idempotency_key text)
returns jsonb language sql security definer set search_path = '' as $$
  select internal_recruitment.transition_application(requested_application_id, requested_stage_id, expected_version, requested_idempotency_key);
$$;
create or replace function public.terminal_transition_recruitment_application(requested_application_id uuid, requested_outcome text, requested_reason text, expected_version integer, requested_idempotency_key text)
returns jsonb language sql security definer set search_path = '' as $$
  select internal_recruitment.terminal_transition_application(requested_application_id, requested_outcome, requested_reason, expected_version, requested_idempotency_key);
$$;
create or replace function public.reopen_recruitment_application(requested_application_id uuid, requested_stage_id uuid, expected_version integer, requested_idempotency_key text)
returns jsonb language sql security definer set search_path = '' as $$
  select internal_recruitment.reopen_application(requested_application_id, requested_stage_id, expected_version, requested_idempotency_key);
$$;
create or replace function public.set_recruitment_pipeline_stage_active(requested_stage_id uuid, requested_is_active boolean, expected_version integer)
returns jsonb language sql security definer set search_path = '' as $$
  select internal_recruitment.set_pipeline_stage_active(requested_stage_id, requested_is_active, expected_version);
$$;
create or replace function public.update_recruitment_retention_settings(requested_tenant_id uuid, requested_hr_group_id uuid, requested_retention_days integer, expected_version integer)
returns jsonb language sql security definer set search_path = '' as $$
  select internal_recruitment.update_retention_settings(requested_tenant_id, requested_hr_group_id, requested_retention_days, expected_version);
$$;

create or replace function public.recruitment_participant_application_projection(requested_application_id uuid)
returns table(
  application_id uuid,
  vacancy_title text,
  candidate_first_name text,
  candidate_last_name text,
  stage_id uuid,
  stage_name text,
  interview_id uuid,
  interview_title text,
  interview_scheduled_at timestamptz,
  capabilities text[],
  version integer
)
language sql stable security definer set search_path = '' as $$
  select application.id, vacancy.title, candidate.first_name, candidate.last_name,
    stage.id, stage.name, interview.id, interview.title, interview.scheduled_at,
    participation.capabilities, application.version
  from public.recruitment_applications application
  join public.recruitment_candidates candidate
    on candidate.tenant_id = application.tenant_id and candidate.hr_group_id = application.hr_group_id and candidate.id = application.candidate_id
  join public.recruitment_vacancies vacancy
    on vacancy.tenant_id = application.tenant_id and vacancy.hr_group_id = application.hr_group_id and vacancy.id = application.vacancy_id
  join public.recruitment_pipeline_stages stage
    on stage.tenant_id = application.tenant_id and stage.hr_group_id = application.hr_group_id and stage.id = application.active_stage_id
  join public.recruitment_participations participation
    on participation.tenant_id = application.tenant_id and participation.hr_group_id = application.hr_group_id
    and participation.application_id = application.id
    and participation.employee_id = internal_security.current_recruitment_employee_id(application.tenant_id, application.hr_group_id)
    and participation.status in ('ASSIGNED','ACTIVE')
    and 'APPLICATION_READ' = any(participation.capabilities)
  left join public.recruitment_interviews interview
    on interview.tenant_id = participation.tenant_id and interview.hr_group_id = participation.hr_group_id and interview.id = participation.interview_id
  where application.id = requested_application_id
    and application.terminal_outcome is null
    and internal_security.recruitment_hr_can(application.tenant_id, application.hr_group_id, 'recruitment-participation:read')
  order by interview.scheduled_at nulls last, participation.id
  limit 1;
$$;

create or replace function public.recruitment_document_download_claim(requested_document_id uuid)
returns table(document_id uuid)
language sql stable security definer set search_path = '' as $$
  select document.id
  from public.recruitment_documents document
  where document.id = requested_document_id
    and document.scan_status = 'CLEAN'
    and document.deleted_at is null
    and (
      internal_security.recruitment_hr_can(document.tenant_id, document.hr_group_id, 'recruitment-candidate:read')
      or internal_security.recruitment_participant_can_read_application(document.tenant_id, document.hr_group_id, document.application_id, 'DOCUMENT_READ')
    )
  limit 1;
$$;

create or replace function public.recruitment_public_vacancy(requested_publication_id uuid, requested_slug text)
returns table(publication_id uuid, slug text, title text, location text, content jsonb)
language sql stable security definer set search_path = '' as $$
  select publication.id, publication.slug, publication.published_title, publication.published_location, publication.published_payload
  from public.recruitment_publications publication
  join public.recruitment_vacancies vacancy
    on vacancy.tenant_id = publication.tenant_id and vacancy.hr_group_id = publication.hr_group_id and vacancy.id = publication.vacancy_id
  join public.tenant_modules module on module.tenant_id = publication.tenant_id and module.module_code = 'RECRUITMENT' and module.is_enabled
  where publication.id = requested_publication_id and publication.slug = requested_slug
    and publication.status = 'OPEN' and vacancy.status = 'ACTIVE'
  limit 1;
$$;

create or replace function public.recruitment_submit_public_application(
  requested_publication_id uuid,
  requested_slug text,
  requested_payload jsonb,
  requested_intake_proof text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare publication public.recruitment_publications%rowtype;
declare proof public.recruitment_public_intake_limits%rowtype;
declare stage_id uuid;
declare candidate_id uuid;
declare application_id uuid;
declare candidate_normalized_email text;
declare duplicate_signal boolean;
begin
  if jsonb_typeof(requested_payload) <> 'object' then raise exception 'RECRUITMENT_PUBLIC_INPUT_INVALID' using errcode = '22023'; end if;
  if requested_intake_proof is null or char_length(requested_intake_proof) < 32 then raise exception 'RECRUITMENT_PUBLIC_PROOF_REQUIRED' using errcode = '42501'; end if;
  select * into publication from public.recruitment_publications row
  where row.id = requested_publication_id and row.slug = requested_slug and row.status = 'OPEN' for share;
  if not found
    or not exists (select 1 from public.tenant_modules module where module.tenant_id = publication.tenant_id and module.module_code = 'RECRUITMENT' and module.is_enabled)
    or not exists (
      select 1 from public.recruitment_vacancies vacancy
      where vacancy.tenant_id = publication.tenant_id and vacancy.hr_group_id = publication.hr_group_id
        and vacancy.id = publication.vacancy_id and vacancy.status = 'ACTIVE'
    ) then
    raise exception 'RECRUITMENT_PUBLICATION_NOT_OPEN' using errcode = 'P0002';
  end if;
  select * into proof from public.recruitment_public_intake_limits intake
  where intake.publication_id = publication.id
    and intake.proof_hash = encode(extensions.digest(requested_intake_proof, 'sha256'), 'hex')
    and intake.verified_at is not null and intake.expires_at > timezone('utc', now()) and intake.consumed_at is null
  for update;
  if not found then raise exception 'RECRUITMENT_PUBLIC_PROOF_INVALID' using errcode = '42501'; end if;
  select stage.id into stage_id from public.recruitment_pipeline_stages stage
  where stage.tenant_id = publication.tenant_id and stage.hr_group_id = publication.hr_group_id and stage.is_active
  order by stage.sort_order, stage.id limit 1;
  if stage_id is null then raise exception 'RECRUITMENT_PIPELINE_EMPTY' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(requested_payload->>'firstName',''))) = 0 or char_length(btrim(coalesce(requested_payload->>'lastName',''))) = 0 then
    raise exception 'RECRUITMENT_PUBLIC_INPUT_INVALID' using errcode = '22023';
  end if;
  candidate_normalized_email := nullif(lower(btrim(requested_payload->>'email')), '');
  duplicate_signal := candidate_normalized_email is not null and exists (
    select 1 from public.recruitment_candidates candidate
    where candidate.tenant_id = publication.tenant_id and candidate.hr_group_id = publication.hr_group_id
      and candidate.normalized_email = candidate_normalized_email and candidate.anonymized_at is null
  );
  insert into public.recruitment_candidates (tenant_id, hr_group_id, first_name, last_name, private_email, normalized_email, phone, possible_duplicate)
  values (publication.tenant_id, publication.hr_group_id, btrim(requested_payload->>'firstName'), btrim(requested_payload->>'lastName'), candidate_normalized_email, candidate_normalized_email, nullif(btrim(requested_payload->>'phone'), ''), duplicate_signal)
  returning id into candidate_id;
  insert into public.recruitment_applications (tenant_id, hr_group_id, vacancy_id, candidate_id, active_stage_id, source, motivation)
  values (publication.tenant_id, publication.hr_group_id, publication.vacancy_id, candidate_id, stage_id, 'PUBLIC', nullif(requested_payload->>'motivation', ''))
  returning id into application_id;
  update public.recruitment_public_intake_limits set consumed_at = timezone('utc', now()) where id = proof.id;
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, payload)
  values (publication.tenant_id, publication.hr_group_id, application_id, 'PUBLIC_APPLICATION_CREATED', jsonb_build_object('source','PUBLIC'));
  return application_id;
end;
$$;

revoke all on all functions in schema internal_recruitment from public, anon, authenticated;
revoke all on function public.transition_recruitment_application(uuid,uuid,integer,text) from public, anon;
revoke all on function public.terminal_transition_recruitment_application(uuid,text,text,integer,text) from public, anon;
revoke all on function public.reopen_recruitment_application(uuid,uuid,integer,text) from public, anon;
revoke all on function public.set_recruitment_pipeline_stage_active(uuid,boolean,integer) from public, anon;
revoke all on function public.update_recruitment_retention_settings(uuid,uuid,integer,integer) from public, anon;
revoke all on function public.recruitment_participant_application_projection(uuid) from public, anon;
revoke all on function public.recruitment_document_download_claim(uuid) from public, anon;
revoke all on function public.recruitment_public_vacancy(uuid,text) from public;
revoke all on function public.recruitment_submit_public_application(uuid,text,jsonb,text) from public;
grant execute on function public.transition_recruitment_application(uuid,uuid,integer,text) to authenticated;
grant execute on function public.terminal_transition_recruitment_application(uuid,text,text,integer,text) to authenticated;
grant execute on function public.reopen_recruitment_application(uuid,uuid,integer,text) to authenticated;
grant execute on function public.set_recruitment_pipeline_stage_active(uuid,boolean,integer) to authenticated;
grant execute on function public.update_recruitment_retention_settings(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.recruitment_participant_application_projection(uuid) to authenticated;
grant execute on function public.recruitment_document_download_claim(uuid) to authenticated;
grant execute on function public.recruitment_public_vacancy(uuid,text) to anon, authenticated;
grant execute on function public.recruitment_submit_public_application(uuid,text,jsonb,text) to anon, authenticated;
