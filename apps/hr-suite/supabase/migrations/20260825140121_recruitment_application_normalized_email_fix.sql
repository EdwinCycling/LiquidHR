-- Fix the existing applicant-create RPC where the PL/pgSQL variable and the
-- candidate column both used the normalized_email identifier.
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
declare calculated_normalized_email text;
declare duplicate_signal boolean;
begin
  select * into vacancy from public.recruitment_vacancies where id = requested_vacancy_id;
  if not found then raise exception 'RECRUITMENT_VACANCY_NOT_FOUND' using errcode = 'P0002'; end if;
  perform internal_recruitment.require_vacancy_scope(vacancy.tenant_id, vacancy.hr_group_id, 'recruitment-candidate:write');
  if vacancy.status in ('ARCHIVED','CLOSED') then raise exception 'RECRUITMENT_VACANCY_CLOSED' using errcode = 'P0002'; end if;
  calculated_normalized_email := nullif(lower(btrim(requested_private_email)), '');
  duplicate_signal := calculated_normalized_email is not null and exists (
    select 1
    from public.recruitment_candidates candidate
    where candidate.tenant_id = vacancy.tenant_id
      and candidate.hr_group_id = vacancy.hr_group_id
      and candidate.normalized_email = calculated_normalized_email
      and candidate.anonymized_at is null
  );
  stage_id := internal_recruitment.ensure_default_stage(vacancy.tenant_id, vacancy.hr_group_id);
  insert into public.recruitment_candidates (tenant_id, hr_group_id, first_name, last_name, private_email, normalized_email, phone, possible_duplicate)
  values (vacancy.tenant_id, vacancy.hr_group_id, btrim(requested_first_name), btrim(requested_last_name), calculated_normalized_email, calculated_normalized_email, nullif(btrim(requested_phone), ''), duplicate_signal)
  returning id into candidate_id;
  insert into public.recruitment_applications (tenant_id, hr_group_id, vacancy_id, candidate_id, active_stage_id, source, motivation, created_by_user_id, updated_by_user_id)
  values (vacancy.tenant_id, vacancy.hr_group_id, vacancy.id, candidate_id, stage_id, coalesce(requested_source, 'MANUAL'), nullif(btrim(requested_motivation), ''), (select auth.uid()), (select auth.uid()))
  returning id into application_id;
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, payload, actor_user_id)
  values (vacancy.tenant_id, vacancy.hr_group_id, application_id, 'APPLICATION_CREATED', jsonb_build_object('source', coalesce(requested_source, 'MANUAL')), (select auth.uid()));
  return jsonb_build_object('id', application_id, 'candidateId', candidate_id, 'possibleDuplicate', duplicate_signal, 'version', 1);
end;
$$;
