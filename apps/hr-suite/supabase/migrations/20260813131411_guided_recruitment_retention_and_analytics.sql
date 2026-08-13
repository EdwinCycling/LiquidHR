-- Guided Recruitment stap 3b: privacykernel, retention, analytics en instellingen.

insert into public.recruitment_settings (tenant_id, hr_group_id, retention_days, public_branding, publication_defaults)
select groups.tenant_id, groups.id, 28, '{}'::jsonb, '{}'::jsonb
from public.hr_groups groups
on conflict (tenant_id, hr_group_id) do nothing;

create or replace function internal_recruitment.recompute_retention_due_dates(requested_tenant_id uuid, requested_hr_group_id uuid, requested_retention_days integer)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare updated_count integer;
begin
  update public.recruitment_applications
  set retention_due_at = terminal_at + make_interval(days => requested_retention_days), updated_at = timezone('utc', now())
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and terminal_outcome is not null and terminal_at is not null and anonymized_at is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function internal_recruitment.recompute_retention_due_dates(uuid,uuid,integer) from public, anon, authenticated;

create or replace function public.update_recruitment_settings(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_retention_days integer,
  requested_public_branding jsonb,
  requested_publication_defaults jsonb,
  requested_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security, internal_recruitment
as $$
declare settings_row public.recruitment_settings;
declare recomputed integer;
begin
  if requested_retention_days not between 1 and 3650 then raise exception 'RECRUITMENT_RETENTION_INVALID' using errcode = '22023'; end if;
  if not internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, 'recruitment-settings:manage') then raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501'; end if;
  update public.recruitment_settings
  set retention_days = requested_retention_days, public_branding = requested_public_branding, publication_defaults = requested_publication_defaults,
      version = version + 1, updated_at = timezone('utc', now()), updated_by_user_id = auth.uid()
  where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and version = requested_expected_version
  returning * into settings_row;
  if not found then raise exception 'RECRUITMENT_SETTINGS_UPDATE_CONFLICT' using errcode = '40001'; end if;
  recomputed := internal_recruitment.recompute_retention_due_dates(requested_tenant_id, requested_hr_group_id, requested_retention_days);
  return jsonb_build_object('id', settings_row.id, 'version', settings_row.version, 'retentionDays', settings_row.retention_days, 'recomputedApplications', recomputed);
end;
$$;

create or replace function public.create_recruitment_pipeline_stage(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_code text,
  requested_name text,
  requested_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare stage_row public.recruitment_pipeline_stages;
begin
  if not internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, 'recruitment-settings:manage') then raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501'; end if;
  insert into public.recruitment_pipeline_stages (tenant_id, hr_group_id, code, name, sort_order, created_by_user_id, updated_by_user_id)
  values (requested_tenant_id, requested_hr_group_id, upper(btrim(requested_code)), btrim(requested_name), requested_sort_order, auth.uid(), auth.uid()) returning * into stage_row;
  return jsonb_build_object('id', stage_row.id, 'version', stage_row.version, 'name', stage_row.name, 'isActive', stage_row.is_active);
end;
$$;

create or replace function public.update_recruitment_pipeline_stage(
  requested_stage_id uuid,
  requested_name text,
  requested_sort_order integer,
  requested_is_active boolean,
  requested_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare stage_row public.recruitment_pipeline_stages;
declare active_count integer;
begin
  select stage.* into stage_row from public.recruitment_pipeline_stages stage where stage.id = requested_stage_id;
  if not found or not internal_security.recruitment_hr_can(stage_row.tenant_id, stage_row.hr_group_id, 'recruitment-settings:manage') then raise exception 'RECRUITMENT_STAGE_NOT_FOUND' using errcode = '42501'; end if;
  if stage_row.is_active and not requested_is_active then
    select count(*) into active_count from public.recruitment_pipeline_stages where tenant_id = stage_row.tenant_id and hr_group_id = stage_row.hr_group_id and is_active;
    if active_count <= 1 then raise exception 'RECRUITMENT_LAST_ACTIVE_STAGE' using errcode = '22023'; end if;
  end if;
  update public.recruitment_pipeline_stages set name = btrim(requested_name), sort_order = requested_sort_order, is_active = requested_is_active, version = version + 1, updated_at = timezone('utc', now()), updated_by_user_id = auth.uid() where id = requested_stage_id and version = requested_expected_version returning * into stage_row;
  if not found then raise exception 'RECRUITMENT_STAGE_UPDATE_CONFLICT' using errcode = '40001'; end if;
  return jsonb_build_object('id', stage_row.id, 'version', stage_row.version, 'name', stage_row.name, 'isActive', stage_row.is_active);
end;
$$;

create or replace function internal_recruitment.anonymize_application(requested_application_id uuid, requested_category text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare application_row public.recruitment_applications;
declare candidate_id uuid;
declare storage_keys jsonb;
begin
  select application.* into application_row from public.recruitment_applications application where application.id = requested_application_id and application.anonymized_at is null;
  if not found then return jsonb_build_object('processed', false, 'storageKeys', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(document.storage_key), '[]'::jsonb) into storage_keys from public.recruitment_documents document where document.application_id = application_row.id;
  candidate_id := application_row.candidate_id;
  delete from public.recruitment_documents where application_id = application_row.id;
  delete from public.recruitment_application_answers where application_id = application_row.id;
  delete from public.recruitment_assessment_scores where assessment_id in (select id from public.recruitment_assessments where application_id = application_row.id);
  delete from public.recruitment_assessments where application_id = application_row.id;
  delete from public.recruitment_interview_participants where interview_id in (select id from public.recruitment_interviews where application_id = application_row.id);
  delete from public.recruitment_participations where application_id = application_row.id;
  delete from public.recruitment_interviews where application_id = application_row.id;
  update public.recruitment_applications
  set motivation = null, terminal_reason = null, terminal_note = null, anonymized_at = timezone('utc', now()), retention_due_at = null, updated_at = timezone('utc', now())
  where id = application_row.id;
  if not exists (select 1 from public.recruitment_applications other where other.candidate_id = candidate_id and other.id <> application_row.id and other.anonymized_at is null) then
    update public.recruitment_candidates set first_name = 'Verwijderd', last_name = 'Kandidaat', private_email = null, normalized_email = null, phone = null, updated_at = timezone('utc', now()) where id = candidate_id;
  end if;
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, actor_user_id, payload)
  values (application_row.tenant_id, application_row.hr_group_id, application_row.id, 'RECRUITMENT_DATA_ANONYMIZED', auth.uid(), jsonb_build_object('category', requested_category, 'processedAt', timezone('utc', now())));
  return jsonb_build_object('processed', true, 'applicationId', application_row.id, 'storageKeys', storage_keys);
end;
$$;

create or replace function public.recruitment_anonymize_application(requested_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security, internal_recruitment
as $$
declare application_row public.recruitment_applications;
begin
  select application.* into application_row from public.recruitment_applications application where application.id = requested_application_id;
  if not found or not internal_security.recruitment_hr_can(application_row.tenant_id, application_row.hr_group_id, 'recruitment-settings:manage') then raise exception 'RECRUITMENT_DELETE_FORBIDDEN' using errcode = '42501'; end if;
  return internal_recruitment.anonymize_application(requested_application_id, 'MANUAL_HR_ACTION');
end;
$$;

create or replace function public.recruitment_run_retention(requested_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_recruitment, internal_security
as $$
declare application_row record;
declare processed integer := 0;
declare storage_keys jsonb := '[]'::jsonb;
declare result_row jsonb;
declare is_service_role boolean;
begin
  is_service_role := current_setting('request.jwt.claim.role', true) = 'service_role';
  if not is_service_role and not exists (select 1 from public.recruitment_settings settings where internal_security.recruitment_hr_can(settings.tenant_id, settings.hr_group_id, 'recruitment-settings:manage')) then raise exception 'RECRUITMENT_RETENTION_FORBIDDEN' using errcode = '42501'; end if;
  for application_row in
    select application.id from public.recruitment_applications application where application.terminal_outcome is not null and application.retention_due_at <= timezone('utc', now()) and application.anonymized_at is null order by application.retention_due_at limit greatest(requested_limit, 1)
  loop
    result_row := internal_recruitment.anonymize_application(application_row.id, case when is_service_role then 'CRON_RETENTION' else 'MANUAL_RETENTION' end);
    processed := processed + 1;
    storage_keys := storage_keys || coalesce(result_row->'storageKeys', '[]'::jsonb);
  end loop;
  return jsonb_build_object('processed', processed, 'storageKeys', storage_keys);
end;
$$;

create or replace function public.recruitment_analytics_projection(requested_tenant_id uuid, requested_hr_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, internal_security
as $$
declare result jsonb;
begin
  if not internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, 'recruitment-candidate:read') then raise exception 'RECRUITMENT_ANALYTICS_FORBIDDEN' using errcode = '42501'; end if;
  select jsonb_build_object(
    'global', jsonb_build_object(
      'openVacancies', (select count(*) from public.recruitment_vacancies where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and status = 'ACTIVE'),
      'activeApplications', (select count(*) from public.recruitment_applications where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and terminal_outcome is null and anonymized_at is null),
      'newApplications', (select count(*) from public.recruitment_applications where tenant_id = requested_tenant_id and hr_group_id = requested_hr_group_id and terminal_outcome is null and anonymized_at is null and created_at >= timezone('utc', now()) - interval '7 days')
    ),
    'byVacancy', coalesce((select jsonb_agg(jsonb_build_object(
      'vacancyId', vacancy.id,
      'totalApplications', (select count(*) from public.recruitment_applications application where application.vacancy_id = vacancy.id and application.anonymized_at is null),
      'newApplications', (select count(*) from public.recruitment_applications application where application.vacancy_id = vacancy.id and application.terminal_outcome is null and application.anonymized_at is null),
      'rejected', (select count(*) from public.recruitment_applications application where application.vacancy_id = vacancy.id and application.terminal_outcome = 'AFGEWEZEN' and application.anonymized_at is null),
      'hired', (select count(*) from public.recruitment_applications application where application.vacancy_id = vacancy.id and application.terminal_outcome = 'AANGENOMEN' and application.anonymized_at is null)
    ) order by vacancy.title) from public.recruitment_vacancies vacancy where vacancy.tenant_id = requested_tenant_id and vacancy.hr_group_id = requested_hr_group_id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.update_recruitment_settings(uuid,uuid,integer,jsonb,jsonb,integer) from public, anon;
revoke all on function public.create_recruitment_pipeline_stage(uuid,uuid,text,text,integer) from public, anon;
revoke all on function public.update_recruitment_pipeline_stage(uuid,text,integer,boolean,integer) from public, anon;
revoke all on function public.recruitment_anonymize_application(uuid) from public, anon;
revoke all on function public.recruitment_run_retention(integer) from public, anon;
revoke all on function public.recruitment_analytics_projection(uuid,uuid) from public, anon;
grant execute on function public.update_recruitment_settings(uuid,uuid,integer,jsonb,jsonb,integer) to authenticated;
grant execute on function public.create_recruitment_pipeline_stage(uuid,uuid,text,text,integer) to authenticated;
grant execute on function public.update_recruitment_pipeline_stage(uuid,text,integer,boolean,integer) to authenticated;
grant execute on function public.recruitment_anonymize_application(uuid) to authenticated;
grant execute on function public.recruitment_run_retention(integer) to authenticated, service_role;
grant execute on function public.recruitment_analytics_projection(uuid,uuid) to authenticated;
