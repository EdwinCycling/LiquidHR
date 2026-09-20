-- SEC-012 EXPAND: additive public Recruitment anti-abuse claim/proof lifecycle.
-- This migration is a local forward candidate and must not be applied remotely
-- until the migration-history gate receives separate explicit authorization.

create table public.recruitment_public_intake_proofs (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  bucket_key_hash text not null check (bucket_key_hash ~ '^[a-f0-9]{64}$'),
  proof_hash text not null unique check (proof_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, publication_id)
    references public.recruitment_publications(tenant_id, hr_group_id, id) on delete cascade,
  check (expires_at > issued_at),
  check (expires_at <= issued_at + interval '10 minutes'),
  check (consumed_at is null or consumed_at >= issued_at)
);

create index recruitment_public_intake_proofs_unconsumed_expiry_idx
  on public.recruitment_public_intake_proofs(expires_at)
  where consumed_at is null;
create index recruitment_public_intake_proofs_consumed_expiry_idx
  on public.recruitment_public_intake_proofs(consumed_at)
  where consumed_at is not null;
create index recruitment_public_intake_proofs_scope_window_idx
  on public.recruitment_public_intake_proofs(publication_id, bucket_key_hash, window_started_at);

alter table public.recruitment_public_intake_proofs enable row level security;
revoke all on table public.recruitment_public_intake_proofs from public, anon, authenticated;
create policy recruitment_public_intake_proofs_deny_all
  on public.recruitment_public_intake_proofs
  for all to anon, authenticated
  using (false)
  with check (false);

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
declare window_started_at timestamptz;
declare issued_at timestamptz;
declare next_window_at timestamptz;
declare counter_id uuid;
declare proof_id uuid;
begin
  if requested_publication_id is null
    or requested_bucket_key_hash is null
    or requested_bucket_key_hash !~ '^[a-f0-9]{64}$'
    or requested_proof_hash is null
    or requested_proof_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'RECRUITMENT_PUBLIC_PROOF_INVALID' using errcode = '42501';
  end if;

  issued_at := clock_timestamp();
  window_started_at := date_bin(interval '15 minutes', issued_at, timestamptz '1970-01-01 00:00:00+00');
  next_window_at := window_started_at + interval '15 minutes';

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
    window_started_at, 1, next_window_at
  )
  on conflict (publication_id, bucket_key_hash, window_started_at)
  do update set
    request_count = public.recruitment_public_intake_limits.request_count + 1,
    expires_at = excluded.expires_at
  where public.recruitment_public_intake_limits.request_count < 5
  returning id into counter_id;

  if counter_id is null then
    return jsonb_build_object(
      'accepted', false,
      'retryAfterSeconds', greatest(1, ceil(extract(epoch from (next_window_at - clock_timestamp()))))::integer
    );
  end if;

  insert into public.recruitment_public_intake_proofs (
    publication_id, tenant_id, hr_group_id, bucket_key_hash, proof_hash,
    window_started_at, issued_at, expires_at
  ) values (
    publication.id, publication.tenant_id, publication.hr_group_id, requested_bucket_key_hash,
    requested_proof_hash, window_started_at, issued_at, issued_at + interval '10 minutes'
  ) returning id into proof_id;

  return jsonb_build_object(
    'accepted', true,
    'proofId', proof_id,
    'expiresAt', issued_at + interval '10 minutes'
  );
end;
$$;

create or replace function public.recruitment_submit_public_application(
  requested_publication_id uuid,
  requested_slug text,
  requested_payload jsonb,
  requested_intake_proof text,
  requested_bucket_key_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare publication public.recruitment_publications%rowtype;
declare proof public.recruitment_public_intake_proofs%rowtype;
declare stage_id uuid;
declare candidate_id uuid;
declare application_id uuid;
declare candidate_normalized_email text;
declare duplicate_signal boolean;
begin
  if jsonb_typeof(requested_payload) <> 'object' then raise exception 'RECRUITMENT_PUBLIC_INPUT_INVALID' using errcode = '22023'; end if;
  if requested_intake_proof is null or char_length(requested_intake_proof) < 32 then raise exception 'RECRUITMENT_PUBLIC_PROOF_REQUIRED' using errcode = '42501'; end if;
  if requested_bucket_key_hash is null or requested_bucket_key_hash !~ '^[a-f0-9]{64}$' then raise exception 'RECRUITMENT_PUBLIC_PROOF_INVALID' using errcode = '42501'; end if;
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
  select * into proof from public.recruitment_public_intake_proofs intake
  where intake.publication_id = publication.id
    and intake.tenant_id = publication.tenant_id
    and intake.hr_group_id = publication.hr_group_id
    and intake.bucket_key_hash = requested_bucket_key_hash
    and intake.proof_hash = encode(extensions.digest(requested_intake_proof, 'sha256'), 'hex')
    and intake.expires_at > clock_timestamp()
    and intake.consumed_at is null
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
  update public.recruitment_public_intake_proofs
  set consumed_at = clock_timestamp()
  where id = proof.id and consumed_at is null;
  if not found then raise exception 'RECRUITMENT_PUBLIC_PROOF_INVALID' using errcode = '42501'; end if;
  insert into public.recruitment_events (tenant_id, hr_group_id, application_id, event_type, payload)
  values (publication.tenant_id, publication.hr_group_id, application_id, 'PUBLIC_APPLICATION_CREATED', jsonb_build_object('source','PUBLIC'));
  return application_id;
end;
$$;

create or replace function public.recruitment_cleanup_public_intake(requested_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare batch_limit integer := greatest(1, least(coalesce(requested_limit, 100), 1000));
declare proofs_removed integer := 0;
declare counters_removed integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'RECRUITMENT_FORBIDDEN' using errcode = '42501';
  end if;

  with candidates as (
    select proof.id
    from public.recruitment_public_intake_proofs proof
    where (proof.consumed_at is null and proof.expires_at < clock_timestamp() - interval '1 hour')
       or (proof.consumed_at is not null and proof.consumed_at < clock_timestamp() - interval '1 hour')
    order by coalesce(proof.consumed_at, proof.expires_at), proof.id
    limit batch_limit
    for update skip locked
  )
  delete from public.recruitment_public_intake_proofs proof
  using candidates
  where proof.id = candidates.id;
  get diagnostics proofs_removed = row_count;

  with candidates as (
    select counter.id
    from public.recruitment_public_intake_limits counter
    where counter.window_started_at < clock_timestamp() - interval '2 hours'
      and not exists (
        select 1
        from public.recruitment_public_intake_proofs proof
        where proof.publication_id = counter.publication_id
          and proof.bucket_key_hash = counter.bucket_key_hash
          and proof.window_started_at = counter.window_started_at
          and proof.expires_at > clock_timestamp()
      )
    order by counter.window_started_at, counter.id
    limit batch_limit
    for update skip locked
  )
  delete from public.recruitment_public_intake_limits counter
  using candidates
  where counter.id = candidates.id;
  get diagnostics counters_removed = row_count;

  return jsonb_build_object('proofsRemoved', proofs_removed, 'countersRemoved', counters_removed);
end;
$$;

revoke all on function public.recruitment_claim_public_intake(uuid, text, text) from public, anon, authenticated;
grant execute on function public.recruitment_claim_public_intake(uuid, text, text) to service_role;

revoke all on function public.recruitment_submit_public_application(uuid, text, jsonb, text, text) from public;
grant execute on function public.recruitment_submit_public_application(uuid, text, jsonb, text, text) to anon, authenticated, service_role;

revoke all on function public.recruitment_cleanup_public_intake(integer) from public, anon, authenticated;
grant execute on function public.recruitment_cleanup_public_intake(integer) to service_role;
