-- Herstelt de ondubbelzinnige variabelenaam in de publieke intakekernel.

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
