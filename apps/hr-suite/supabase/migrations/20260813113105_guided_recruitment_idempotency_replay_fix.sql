-- Bewaart de oorspronkelijke mutation response voor historisch exacte idempotente replay.

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
