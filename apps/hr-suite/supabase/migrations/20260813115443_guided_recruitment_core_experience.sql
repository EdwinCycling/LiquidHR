-- Guided Recruitment stap 2: vacancy/application/publication/hire-contracten.
-- Writes blijven via kleine SECURITY DEFINER-kernels lopen; directe table-writes
-- blijven ingetrokken uit stap 1.

alter table public.recruitment_vacancy_sections
  add column if not exists title text;

update public.recruitment_vacancy_sections
set title = case section_type
  when 'INTRODUCTION' then 'Over de functie'
  when 'ROLE' then 'Jouw rol'
  when 'PROFILE' then 'Wat breng je mee?'
  when 'OFFER' then 'Wat bieden wij?'
  when 'PROCESS' then 'Sollicitatieprocedure'
  when 'CONTACT' then 'Aanvullende informatie'
  else 'Vacature'
end
where title is null or char_length(btrim(title)) = 0;

alter table public.recruitment_vacancy_sections
  alter column title set default '',
  alter column title set not null;

alter table public.recruitment_vacancy_sections
  add constraint recruitment_vacancy_sections_title_check
  check (char_length(btrim(title)) between 1 and 180);

create or replace function internal_recruitment.ensure_default_stage(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare stage_id uuid;
begin
  select id into stage_id
  from public.recruitment_pipeline_stages
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and is_active
  order by sort_order, id
  limit 1;

  if stage_id is null then
    insert into public.recruitment_pipeline_stages (
      tenant_id, hr_group_id, code, name, sort_order, created_by_user_id, updated_by_user_id
    ) values (
      requested_tenant_id, requested_hr_group_id, 'APPLICATION', 'Sollicitatie', 0, (select auth.uid()), (select auth.uid())
    ) returning id into stage_id;
  end if;
  return stage_id;
end;
$$;

create or replace function internal_recruitment.require_vacancy_scope(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_permission text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not internal_security.recruitment_hr_can(requested_tenant_id, requested_hr_group_id, requested_permission) then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_recruitment_vacancy(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_title text,
  requested_job_id uuid,
  requested_location_label text,
  requested_work_mode text,
  requested_min_hours numeric,
  requested_max_hours numeric,
  requested_salary_min numeric,
  requested_salary_max numeric,
  requested_salary_visible boolean,
  requested_sections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare vacancy_id uuid;
declare stage_id uuid;
begin
  perform internal_recruitment.require_vacancy_scope(requested_tenant_id, requested_hr_group_id, 'recruitment-vacancy:write');
  if requested_sections is null or jsonb_typeof(requested_sections) <> 'array' then raise exception 'RECRUITMENT_VACANCY_SECTIONS_INVALID' using errcode = '22023'; end if;
  if (select count(*) from jsonb_array_elements(requested_sections)) <> 6 then raise exception 'RECRUITMENT_VACANCY_SECTIONS_INVALID' using errcode = '22023'; end if;
  stage_id := internal_recruitment.ensure_default_stage(requested_tenant_id, requested_hr_group_id);
  insert into public.recruitment_vacancies (
    tenant_id, hr_group_id, title, job_id, location_label, work_mode,
    min_hours, max_hours, salary_min, salary_max, salary_visible,
    status, created_by_user_id, updated_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, btrim(requested_title), requested_job_id, nullif(btrim(requested_location_label), ''), requested_work_mode,
    requested_min_hours, requested_max_hours, requested_salary_min, requested_salary_max, coalesce(requested_salary_visible, false),
    'DRAFT', (select auth.uid()), (select auth.uid())
  ) returning id into vacancy_id;
  insert into public.recruitment_vacancy_sections (tenant_id, hr_group_id, vacancy_id, section_type, title, content, sort_order, is_visible)
  select requested_tenant_id, requested_hr_group_id, vacancy_id, item.section_type, btrim(item.title), coalesce(item.content, ''), item.sort_order, coalesce(item.is_visible, true)
  from jsonb_to_recordset(requested_sections) as item(section_type text, title text, content text, sort_order integer, is_visible boolean);
  return jsonb_build_object('id', vacancy_id, 'version', 1, 'stageId', stage_id);
end;
$$;

create or replace function public.update_recruitment_vacancy(
  requested_vacancy_id uuid,
  requested_expected_version integer,
  requested_title text,
  requested_job_id uuid,
  requested_location_label text,
  requested_work_mode text,
  requested_min_hours numeric,
  requested_max_hours numeric,
  requested_salary_min numeric,
  requested_salary_max numeric,
  requested_salary_visible boolean,
  requested_sections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare vacancy public.recruitment_vacancies%rowtype;
declare new_version integer;
begin
  select * into vacancy from public.recruitment_vacancies where id = requested_vacancy_id for update;
  if not found then raise exception 'RECRUITMENT_VACANCY_NOT_FOUND' using errcode = 'P0002'; end if;
  perform internal_recruitment.require_vacancy_scope(vacancy.tenant_id, vacancy.hr_group_id, 'recruitment-vacancy:write');
  if vacancy.version <> requested_expected_version then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  if requested_sections is null or jsonb_typeof(requested_sections) <> 'array' or (select count(*) from jsonb_array_elements(requested_sections)) <> 6 then
    raise exception 'RECRUITMENT_VACANCY_SECTIONS_INVALID' using errcode = '22023';
  end if;
  new_version := vacancy.version + 1;
  update public.recruitment_vacancies set
    title = btrim(requested_title), job_id = requested_job_id, location_label = nullif(btrim(requested_location_label), ''),
    work_mode = requested_work_mode, min_hours = requested_min_hours, max_hours = requested_max_hours,
    salary_min = requested_salary_min, salary_max = requested_salary_max, salary_visible = coalesce(requested_salary_visible, false),
    version = new_version, updated_by_user_id = (select auth.uid())
  where id = vacancy.id;
  delete from public.recruitment_vacancy_sections where tenant_id = vacancy.tenant_id and hr_group_id = vacancy.hr_group_id and vacancy_id = vacancy.id;
  insert into public.recruitment_vacancy_sections (tenant_id, hr_group_id, vacancy_id, section_type, title, content, sort_order, is_visible)
  select vacancy.tenant_id, vacancy.hr_group_id, vacancy.id, item.section_type, btrim(item.title), coalesce(item.content, ''), item.sort_order, coalesce(item.is_visible, true)
  from jsonb_to_recordset(requested_sections) as item(section_type text, title text, content text, sort_order integer, is_visible boolean);
  return jsonb_build_object('id', vacancy.id, 'version', new_version);
end;
$$;

create or replace function public.create_recruitment_application(
  requested_vacancy_id uuid,
  requested_first_name text,
  requested_last_name text,
  requested_private_email text,
  requested_phone text,
  requested_motivation text,
  requested_source text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare vacancy public.recruitment_vacancies%rowtype;
declare candidate_id uuid;
declare application_id uuid;
declare stage_id uuid;
declare normalized_email text;
declare duplicate_signal boolean;
begin
  select * into vacancy from public.recruitment_vacancies where id = requested_vacancy_id;
  if not found then raise exception 'RECRUITMENT_VACANCY_NOT_FOUND' using errcode = 'P0002'; end if;
  perform internal_recruitment.require_vacancy_scope(vacancy.tenant_id, vacancy.hr_group_id, 'recruitment-candidate:write');
  if vacancy.status in ('ARCHIVED','CLOSED') then raise exception 'RECRUITMENT_VACANCY_CLOSED' using errcode = 'P0002'; end if;
  normalized_email := nullif(lower(btrim(requested_private_email)), '');
  duplicate_signal := normalized_email is not null and exists (
    select 1 from public.recruitment_candidates candidate
    where candidate.tenant_id = vacancy.tenant_id and candidate.hr_group_id = vacancy.hr_group_id
      and candidate.normalized_email = normalized_email and candidate.anonymized_at is null
  );
  stage_id := internal_recruitment.ensure_default_stage(vacancy.tenant_id, vacancy.hr_group_id);
  insert into public.recruitment_candidates (tenant_id, hr_group_id, first_name, last_name, private_email, normalized_email, phone, possible_duplicate)
  values (vacancy.tenant_id, vacancy.hr_group_id, btrim(requested_first_name), btrim(requested_last_name), normalized_email, normalized_email, nullif(btrim(requested_phone), ''), duplicate_signal)
  returning id into candidate_id;
  insert into public.recruitment_applications (tenant_id, hr_group_id, vacancy_id, candidate_id, active_stage_id, source, motivation, created_by_user_id, updated_by_user_id)
  values (vacancy.tenant_id, vacancy.hr_group_id, vacancy.id, candidate_id, stage_id, coalesce(requested_source, 'MANUAL'), nullif(btrim(requested_motivation), ''), (select auth.uid()), (select auth.uid()))
  returning id into application_id;
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, payload, actor_user_id)
  values (vacancy.tenant_id, vacancy.hr_group_id, application_id, 'APPLICATION_CREATED', jsonb_build_object('source', coalesce(requested_source, 'MANUAL')), (select auth.uid()));
  return jsonb_build_object('id', application_id, 'candidateId', candidate_id, 'possibleDuplicate', duplicate_signal, 'version', 1);
end;
$$;

create or replace function public.publish_recruitment_vacancy(
  requested_vacancy_id uuid,
  requested_status text,
  requested_slug text,
  requested_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare vacancy public.recruitment_vacancies%rowtype;
declare publication public.recruitment_publications%rowtype;
declare publication_id uuid;
begin
  select * into vacancy from public.recruitment_vacancies where id = requested_vacancy_id for update;
  if not found then raise exception 'RECRUITMENT_VACANCY_NOT_FOUND' using errcode = 'P0002'; end if;
  perform internal_recruitment.require_vacancy_scope(vacancy.tenant_id, vacancy.hr_group_id, 'recruitment-vacancy:publish');
  if requested_status not in ('OPEN','CLOSED','ARCHIVED') then raise exception 'RECRUITMENT_PUBLICATION_STATUS_INVALID' using errcode = '22023'; end if;
  if requested_status = 'OPEN' and (requested_slug is null or requested_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') then raise exception 'RECRUITMENT_PUBLICATION_SLUG_INVALID' using errcode = '22023'; end if;
  update public.recruitment_vacancies set status = case when requested_status = 'OPEN' then 'ACTIVE' when requested_status = 'ARCHIVED' then 'ARCHIVED' else status end, version = version + 1, updated_by_user_id = (select auth.uid()) where id = vacancy.id;
  select * into publication from public.recruitment_publications where tenant_id = vacancy.tenant_id and hr_group_id = vacancy.hr_group_id and vacancy_id = vacancy.id for update;
  if not found then
    insert into public.recruitment_publications (tenant_id, hr_group_id, vacancy_id, slug, status, published_title, published_location, published_payload, opened_at)
    values (vacancy.tenant_id, vacancy.hr_group_id, vacancy.id, coalesce(requested_slug, 'vacancy-' || left(vacancy.id::text, 8)), requested_status, vacancy.title, vacancy.location_label, coalesce(requested_payload, '{}'::jsonb), case when requested_status = 'OPEN' then timezone('utc', now()) else null end)
    returning id into publication_id;
  else
    update public.recruitment_publications set
      slug = coalesce(requested_slug, publication.slug), status = requested_status, published_title = vacancy.title,
      published_location = vacancy.location_label, published_payload = coalesce(requested_payload, publication.published_payload),
      opened_at = case when requested_status = 'OPEN' then coalesce(publication.opened_at, timezone('utc', now())) else publication.opened_at end,
      closed_at = case when requested_status = 'CLOSED' then timezone('utc', now()) else null end,
      archived_at = case when requested_status = 'ARCHIVED' then timezone('utc', now()) else null end,
      version = publication.version + 1, updated_at = timezone('utc', now())
    where id = publication.id returning id into publication_id;
  end if;
  return jsonb_build_object('id', publication_id, 'status', requested_status, 'slug', coalesce(requested_slug, publication.slug));
end;
$$;

create or replace function public.hire_recruitment_application(
  requested_application_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_expected_version integer,
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
  perform internal_recruitment.require_vacancy_scope(application.tenant_id, application.hr_group_id, 'recruitment-candidate:write');
  if not internal_security.current_user_has_hr_group_permission(application.tenant_id, application.hr_group_id, 'employee:match') then raise exception 'RECRUITMENT_EMPLOYEE_MATCH_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or char_length(requested_idempotency_key) < 8 then raise exception 'RECRUITMENT_IDEMPOTENCY_REQUIRED' using errcode = '22023'; end if;
  select payload into replay_result from public.recruitment_events where application_id = application.id and idempotency_key = requested_idempotency_key;
  if replay_result is not null then return replay_result || jsonb_build_object('idempotentReplay', true); end if;
  if application.version <> requested_expected_version then raise exception 'RECRUITMENT_VERSION_CONFLICT' using errcode = '40001'; end if;
  if application.terminal_outcome is not null then raise exception 'RECRUITMENT_APPLICATION_TERMINAL' using errcode = 'P0001'; end if;
  if requested_employee_id is null or requested_administration_id is null then raise exception 'RECRUITMENT_EMPLOYEE_CHOICE_REQUIRED' using errcode = '22023'; end if;
  if not exists (select 1 from public.employees employee where employee.tenant_id = application.tenant_id and employee.id = requested_employee_id) then raise exception 'RECRUITMENT_EMPLOYEE_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.recruitment_applications set
    administration_id = requested_administration_id, employee_id = requested_employee_id, employment_id = requested_employment_id,
    converted_at = timezone('utc', now()), converted_by_user_id = (select auth.uid()), active_stage_id = null,
    terminal_outcome = 'AANGENOMEN', terminal_at = timezone('utc', now()), retention_due_at = null,
    version = version + 1, updated_by_user_id = (select auth.uid())
  where id = application.id returning * into application;
  update public.recruitment_participations set status = 'REVOKED', revoked_at = timezone('utc', now()), version = version + 1 where application_id = application.id and status in ('ASSIGNED','ACTIVE');
  mutation_result := jsonb_build_object('id', application.id, 'version', application.version, 'outcome', 'AANGENOMEN', 'employeeId', application.employee_id, 'idempotentReplay', false);
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, idempotency_key, actor_user_id, payload)
  values (application.tenant_id, application.hr_group_id, application.id, 'APPLICATION_AANGENOMEN', requested_idempotency_key, (select auth.uid()), mutation_result);
  return mutation_result;
end;
$$;

create or replace function public.recruitment_public_vacancy_state(requested_publication_id uuid, requested_slug text)
returns table(publication_id uuid, slug text, status text, title text, location text)
language sql stable security definer set search_path = '' as $$
  select publication.id, publication.slug, publication.status, publication.published_title, publication.published_location
  from public.recruitment_publications publication
  join public.recruitment_vacancies vacancy
    on vacancy.tenant_id = publication.tenant_id and vacancy.hr_group_id = publication.hr_group_id and vacancy.id = publication.vacancy_id
  join public.tenant_modules module
    on module.tenant_id = publication.tenant_id and module.module_code = 'RECRUITMENT' and module.is_enabled
  where publication.id = requested_publication_id
    and publication.slug = requested_slug
    and publication.status in ('OPEN', 'CLOSED')
  limit 1;
$$;

revoke all on schema internal_recruitment from public, anon, authenticated;
revoke all on function internal_recruitment.ensure_default_stage(uuid,uuid) from public, anon, authenticated;
revoke all on function internal_recruitment.require_vacancy_scope(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.create_recruitment_vacancy(uuid,uuid,text,uuid,text,text,numeric,numeric,numeric,numeric,boolean,jsonb) from public, anon;
revoke all on function public.update_recruitment_vacancy(uuid,integer,text,uuid,text,text,numeric,numeric,numeric,numeric,boolean,jsonb) from public, anon;
revoke all on function public.create_recruitment_application(uuid,text,text,text,text,text,text) from public, anon;
revoke all on function public.publish_recruitment_vacancy(uuid,text,text,jsonb) from public, anon;
revoke all on function public.hire_recruitment_application(uuid,uuid,uuid,uuid,integer,text) from public, anon;
revoke all on function public.recruitment_public_vacancy_state(uuid,text) from public;
grant execute on function public.create_recruitment_vacancy(uuid,uuid,text,uuid,text,text,numeric,numeric,numeric,numeric,boolean,jsonb) to authenticated;
grant execute on function public.update_recruitment_vacancy(uuid,integer,text,uuid,text,text,numeric,numeric,numeric,numeric,boolean,jsonb) to authenticated;
grant execute on function public.create_recruitment_application(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.publish_recruitment_vacancy(uuid,text,text,jsonb) to authenticated;
grant execute on function public.hire_recruitment_application(uuid,uuid,uuid,uuid,integer,text) to authenticated;
grant execute on function public.recruitment_public_vacancy_state(uuid,text) to anon, authenticated;
