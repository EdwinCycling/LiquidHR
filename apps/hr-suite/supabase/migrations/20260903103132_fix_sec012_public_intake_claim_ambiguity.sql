-- SEC-012 forward fix: disambiguate claim-function locals from table columns.
-- This migration changes only the existing claim function; it is not applied remotely here.

create or replace function public.recruitment_claim_public_intake(
  requested_publication_id uuid,
  requested_bucket_key_hash text,
  requested_proof_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare publication public.recruitment_publications%rowtype;
declare v_window_started_at timestamptz;
declare v_issued_at timestamptz;
declare v_next_window_at timestamptz;
declare v_counter_id uuid;
declare v_proof_id uuid;
begin
  if requested_publication_id is null
    or requested_bucket_key_hash is null
    or requested_bucket_key_hash !~ '^[a-f0-9]{64}$'
    or requested_proof_hash is null
    or requested_proof_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'RECRUITMENT_PUBLIC_PROOF_INVALID' using errcode = '42501';
  end if;

  v_issued_at := clock_timestamp();
  v_window_started_at := date_bin(interval '15 minutes', v_issued_at, timestamptz '1970-01-01 00:00:00+00');
  v_next_window_at := v_window_started_at + interval '15 minutes';

  select * into publication
  from public.recruitment_publications row
  where row.id = requested_publication_id and row.status = 'OPEN'
  for share;
  if not found
    or not exists (
      select 1 from public.tenant_modules module
      where module.tenant_id = publication.tenant_id
        and module.module_code = 'RECRUITMENT'
        and module.is_enabled
      for share
    )
    or not exists (
      select 1 from public.recruitment_vacancies vacancy
      where vacancy.tenant_id = publication.tenant_id
        and vacancy.hr_group_id = publication.hr_group_id
        and vacancy.id = publication.vacancy_id
        and vacancy.status = 'ACTIVE'
      for share
    ) then
    raise exception 'RECRUITMENT_PUBLICATION_NOT_OPEN' using errcode = 'P0002';
  end if;

  insert into public.recruitment_public_intake_limits (
    publication_id, tenant_id, hr_group_id, bucket_key_hash, window_started_at, request_count, expires_at
  ) values (
    publication.id, publication.tenant_id, publication.hr_group_id, requested_bucket_key_hash,
    v_window_started_at, 1, v_next_window_at
  )
  on conflict (publication_id, bucket_key_hash, window_started_at)
  do update set
    request_count = public.recruitment_public_intake_limits.request_count + 1,
    expires_at = excluded.expires_at
  where public.recruitment_public_intake_limits.request_count < 5
  returning id into v_counter_id;

  if v_counter_id is null then
    return jsonb_build_object(
      'accepted', false,
      'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_next_window_at - clock_timestamp()))))::integer
    );
  end if;

  insert into public.recruitment_public_intake_proofs (
    publication_id, tenant_id, hr_group_id, bucket_key_hash, proof_hash,
    window_started_at, issued_at, expires_at
  ) values (
    publication.id, publication.tenant_id, publication.hr_group_id, requested_bucket_key_hash,
    requested_proof_hash, v_window_started_at, v_issued_at, v_issued_at + interval '10 minutes'
  ) returning id into v_proof_id;

  return jsonb_build_object(
    'accepted', true,
    'proofId', v_proof_id,
    'expiresAt', v_issued_at + interval '10 minutes'
  );
end;
$$;
