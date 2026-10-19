-- Payroll core reset: retain immutable salary revision history while allowing
-- a reviewed, source-backed correction to replace one effective publication.
-- Draft and published rows may share an effective date; only one published
-- revision per structure/date can be current. Finalized payroll evidence keeps
-- its references to the archived predecessor.

alter table public.salary_structure_revisions
  add column source_metadata jsonb,
  add column correction_of_revision_id uuid,
  add constraint salary_structure_revisions_source_metadata_object
    check (source_metadata is null or jsonb_typeof(source_metadata) = 'object'),
  add constraint salary_structure_revisions_not_self_correcting
    check (correction_of_revision_id is null or correction_of_revision_id <> id),
  add constraint salary_structure_revisions_correction_scope_key
    unique (tenant_id, hr_group_id, salary_structure_id, id);

alter table public.salary_structure_revisions
  add constraint salary_structure_revisions_correction_scope_fkey
    foreign key (tenant_id, hr_group_id, salary_structure_id, correction_of_revision_id)
    references public.salary_structure_revisions(tenant_id, hr_group_id, salary_structure_id, id)
    on delete restrict;

create index salary_structure_revisions_correction_idx
  on public.salary_structure_revisions (correction_of_revision_id)
  where correction_of_revision_id is not null;

alter table public.salary_structure_revisions
  drop constraint salary_structure_revisions_effective_key;

create unique index salary_structure_revisions_published_effective_key
  on public.salary_structure_revisions (tenant_id, hr_group_id, salary_structure_id, effective_from)
  where status = 'PUBLISHED';

create unique index salary_structure_revisions_draft_effective_key
  on public.salary_structure_revisions (tenant_id, hr_group_id, salary_structure_id, effective_from)
  where status = 'DRAFT';

-- This non-login role inherits the existing authenticated grants and RLS
-- policies, but cannot bypass row security. It owns only the functions that
-- need a private, transaction-scoped publication capability.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'liquidhr_salary_revision_publisher'
  ) then
    execute 'create role liquidhr_salary_revision_publisher nologin inherit nobypassrls';
  end if;
end;
$$;
alter role liquidhr_salary_revision_publisher nologin inherit nobypassrls;
grant authenticated to liquidhr_salary_revision_publisher;
grant usage on schema public, auth, internal_security to liquidhr_salary_revision_publisher;
grant create on schema public, internal_security to liquidhr_salary_revision_publisher;
-- Supabase's migration executor is a non-superuser CREATEROLE role. Give it
-- SET ROLE only for these ownership transfers, then revoke the membership
-- before the transaction commits. The publisher role remains NOLOGIN and
-- NOBYPASSRLS throughout.
grant liquidhr_salary_revision_publisher to postgres with set true;

create table internal_security.salary_revision_publish_context (
  transaction_id bigint not null,
  backend_pid integer not null,
  actor_user_id uuid not null,
  draft_revision_id uuid not null,
  predecessor_revision_id uuid,
  primary key (transaction_id, backend_pid, draft_revision_id)
);
alter table internal_security.salary_revision_publish_context enable row level security;
create policy salary_revision_publish_context_owner
  on internal_security.salary_revision_publish_context
  for all to liquidhr_salary_revision_publisher
  using (true) with check (true);
revoke all on table internal_security.salary_revision_publish_context from public, anon, authenticated;
grant select, insert, delete on table internal_security.salary_revision_publish_context to liquidhr_salary_revision_publisher;

-- Published revisions remain immutable. A publication correction may change
-- only the lifecycle status and its audit/version columns; archived revisions
-- are immutable as well. The publishing RPC performs this transition in the
-- same transaction as publishing the validated successor. Its private,
-- transaction-scoped capability cannot be forged by an authenticated caller.
create or replace function internal_security.prevent_published_salary_revision_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = on
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'PUBLISHED' then
      raise exception 'SALARY_STRUCTURE_PUBLISH_RPC_REQUIRED' using errcode = '55000';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then
      raise exception 'SALARY_STRUCTURE_REVISION_IMMUTABLE' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.status = 'PUBLISHED' then
    if new.status = 'ARCHIVED'
       and exists (
         select 1 from internal_security.salary_revision_publish_context context
         where context.transaction_id = pg_catalog.txid_current()
           and context.backend_pid = pg_catalog.pg_backend_pid()
           and context.actor_user_id = auth.uid()
           and context.predecessor_revision_id = old.id
       )
       and (to_jsonb(new) - array['status', 'updated_by_user_id', 'updated_at', 'lock_version'])
         is not distinct from
           (to_jsonb(old) - array['status', 'updated_by_user_id', 'updated_at', 'lock_version']) then
      return new;
    end if;
    raise exception 'SALARY_STRUCTURE_REVISION_IMMUTABLE' using errcode = '55000';
  end if;

  if old.status = 'DRAFT' and new.status = 'PUBLISHED'
     and exists (
       select 1 from internal_security.salary_revision_publish_context context
       where context.transaction_id = pg_catalog.txid_current()
         and context.backend_pid = pg_catalog.pg_backend_pid()
         and context.actor_user_id = auth.uid()
         and context.draft_revision_id = old.id
         and context.predecessor_revision_id is not distinct from old.correction_of_revision_id
     )
     and (to_jsonb(new) - array['status', 'published_at', 'published_by_user_id', 'updated_by_user_id', 'updated_at', 'lock_version'])
       is not distinct from
         (to_jsonb(old) - array['status', 'published_at', 'published_by_user_id', 'updated_by_user_id', 'updated_at', 'lock_version']) then
    return new;
  elsif old.status = 'DRAFT' and new.status = 'PUBLISHED' then
    raise exception 'SALARY_STRUCTURE_PUBLISH_RPC_REQUIRED' using errcode = '55000';
  end if;

  if old.status = 'ARCHIVED' then
    raise exception 'SALARY_STRUCTURE_REVISION_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

alter function internal_security.prevent_published_salary_revision_mutation()
  owner to liquidhr_salary_revision_publisher;
revoke all on function internal_security.prevent_published_salary_revision_mutation()
  from public, anon, authenticated, service_role;

drop trigger prevent_published_salary_revision_mutation on public.salary_structure_revisions;
create trigger prevent_published_salary_revision_mutation
before insert or update or delete on public.salary_structure_revisions
for each row execute function internal_security.prevent_published_salary_revision_mutation();

create or replace function public.save_salary_structure_import_draft(
  requested_structure_id uuid,
  requested_draft_id uuid,
  requested_expected_lock_version integer,
  requested_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set row_security = on
as $$
declare
  metadata jsonb := requested_payload -> 'sourceMetadata';
  correction_id uuid := nullif(requested_payload ->> 'correctionOfRevisionId', '')::uuid;
  saved jsonb;
  structure_row public.salary_structures%rowtype;
  revision_row public.salary_structure_revisions%rowtype;
  predecessor_row public.salary_structure_revisions%rowtype;
  effective_date date := (requested_payload ->> 'effectiveFrom')::date;
  existing_published_id uuid;
begin
  if auth.uid() is null then
    raise exception 'SALARY_STRUCTURE_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select * into structure_row
  from public.salary_structures structure
  where structure.id = requested_structure_id
    and structure.is_active
  for update;
  if not found then
    raise exception 'SALARY_STRUCTURE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    structure_row.tenant_id, structure_row.hr_group_id, 'salary-structure:write'
  ) or not internal_security.current_user_has_hr_group_permission(
    structure_row.tenant_id, structure_row.hr_group_id, 'salary:write'
  ) then
    raise exception 'SALARY_STRUCTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if metadata is null or jsonb_typeof(metadata) is distinct from 'object'
     or nullif(btrim(metadata ->> 'title'), '') is null
     or nullif(btrim(metadata ->> 'version'), '') is null
     or nullif(btrim(metadata ->> 'fileName'), '') is null
     or nullif(btrim(metadata ->> 'url'), '') is null
     or metadata ->> 'url' !~ '^https://[^[:space:]]+$'
     or coalesce(metadata ->> 'sha256', '') !~ '^[a-fA-F0-9]{64}$'
     or coalesce(metadata ->> 'effectiveFrom', '') <> requested_payload ->> 'effectiveFrom'
     or coalesce(metadata ->> 'effectiveTo', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or (metadata ->> 'effectiveTo')::date < effective_date
     or coalesce(metadata ->> 'rowCount', '') !~ '^\d+$'
     or (metadata ->> 'rowCount')::integer <= 0 then
    raise exception 'SALARY_STRUCTURE_IMPORT_SOURCE_INVALID' using errcode = '22023';
  end if;

  select revision.id into existing_published_id
  from public.salary_structure_revisions revision
  where revision.tenant_id = structure_row.tenant_id
    and revision.hr_group_id = structure_row.hr_group_id
    and revision.salary_structure_id = requested_structure_id
    and revision.effective_from = effective_date
    and revision.status = 'PUBLISHED';

  if correction_id is null and existing_published_id is not null then
    raise exception 'SALARY_STRUCTURE_CORRECTION_REQUIRED' using errcode = '23505';
  end if;
  if correction_id is not null then
    select * into predecessor_row
    from public.salary_structure_revisions revision
    where revision.id = correction_id
      and revision.tenant_id = structure_row.tenant_id
      and revision.hr_group_id = structure_row.hr_group_id
      and revision.salary_structure_id = requested_structure_id
      and revision.effective_from = effective_date
      and revision.status = 'PUBLISHED'
    for update;
    if not found or predecessor_row.id <> existing_published_id then
      raise exception 'SALARY_STRUCTURE_CORRECTION_STALE' using errcode = '40001';
    end if;
  end if;

  saved := public.save_salary_structure_draft(
    requested_structure_id,
    requested_draft_id,
    requested_expected_lock_version,
    requested_payload
  );

  update public.salary_structure_revisions revision
  set source_metadata = jsonb_set(
        jsonb_set(
          jsonb_set(metadata, '{sourceValidationStatus}', '"REFERENCE_ONLY"'::jsonb, true),
          '{capturedBy}', to_jsonb(auth.uid()::text), true
        ),
        '{capturedAt}', to_jsonb(timezone('utc', now())::text), true
      ),
      correction_of_revision_id = correction_id
  where revision.id = (saved ->> 'id')::uuid
    and revision.status = 'DRAFT'
  returning * into revision_row;
  if not found then
    raise exception 'SALARY_STRUCTURE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return saved || jsonb_build_object(
    'sourceValidationStatus', 'REFERENCE_ONLY',
    'correctionOfRevisionId', revision_row.correction_of_revision_id
  );
end;
$$;

create or replace function public.publish_salary_structure_revision(
  requested_revision_id uuid,
  requested_expected_lock_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = on
as $$
declare
  revision_row public.salary_structure_revisions%rowtype;
  predecessor_row public.salary_structure_revisions%rowtype;
  structure_row public.salary_structures%rowtype;
  existing_published_id uuid;
  overlapping_revision_id uuid;
  candidate_effective_to date;
begin
  if auth.uid() is null then
    raise exception 'SALARY_STRUCTURE_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  -- Read the structure key first, then lock in the same order as draft saves:
  -- structure, draft revision, predecessor. This avoids an importer/publisher
  -- lock inversion while keeping the effective-date switch atomic.
  select * into revision_row
  from public.salary_structure_revisions
  where id = requested_revision_id;
  if not found or revision_row.status <> 'DRAFT' then
    raise exception 'SALARY_STRUCTURE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into structure_row
  from public.salary_structures structure
  where structure.id = revision_row.salary_structure_id
    and structure.tenant_id = revision_row.tenant_id
    and structure.hr_group_id = revision_row.hr_group_id
    and structure.is_active
  for update;
  if not found then
    raise exception 'SALARY_STRUCTURE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into revision_row
  from public.salary_structure_revisions revision
  where revision.id = requested_revision_id
    and revision.tenant_id = structure_row.tenant_id
    and revision.hr_group_id = structure_row.hr_group_id
    and revision.salary_structure_id = structure_row.id
  for update;
  if not found or revision_row.status <> 'DRAFT' then
    raise exception 'SALARY_STRUCTURE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(
    revision_row.tenant_id, revision_row.hr_group_id, 'salary-structure:write'
  ) or not internal_security.current_user_has_hr_group_permission(
    revision_row.tenant_id, revision_row.hr_group_id, 'salary:write'
  ) then
    raise exception 'SALARY_STRUCTURE_FORBIDDEN' using errcode = '42501';
  end if;
  if revision_row.lock_version <> requested_expected_lock_version then
    raise exception 'SALARY_STRUCTURE_DRAFT_CONFLICT' using errcode = '40001';
  end if;

  select revision.id into existing_published_id
  from public.salary_structure_revisions revision
  where revision.tenant_id = revision_row.tenant_id
    and revision.hr_group_id = revision_row.hr_group_id
    and revision.salary_structure_id = revision_row.salary_structure_id
    and revision.effective_from = revision_row.effective_from
    and revision.status = 'PUBLISHED';

  if revision_row.source_metadata is not null then
    if jsonb_typeof(revision_row.source_metadata) is distinct from 'object'
       or nullif(btrim(revision_row.source_metadata ->> 'title'), '') is null
       or char_length(revision_row.source_metadata ->> 'title') > 180
       or nullif(btrim(revision_row.source_metadata ->> 'version'), '') is null
       or char_length(revision_row.source_metadata ->> 'version') > 80
       or nullif(btrim(revision_row.source_metadata ->> 'fileName'), '') is null
       or char_length(revision_row.source_metadata ->> 'fileName') > 260
       or nullif(btrim(revision_row.source_metadata ->> 'url'), '') is null
       or char_length(revision_row.source_metadata ->> 'url') > 500
       or revision_row.source_metadata ->> 'url' !~ '^https://[^[:space:]]+$'
       or coalesce(revision_row.source_metadata ->> 'sha256', '') !~ '^[a-fA-F0-9]{64}$'
       or revision_row.source_metadata ->> 'effectiveFrom' is distinct from to_char(revision_row.effective_from, 'YYYY-MM-DD')
       or coalesce(revision_row.source_metadata ->> 'effectiveTo', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or (revision_row.source_metadata ->> 'effectiveTo')::date < revision_row.effective_from
       or coalesce(revision_row.source_metadata ->> 'rowCount', '') !~ '^\d+$'
       or (revision_row.source_metadata ->> 'rowCount')::integer not between 1 and 10000
       or revision_row.source_metadata ->> 'sourceValidationStatus' is distinct from 'REFERENCE_ONLY'
       or revision_row.source_metadata ->> 'capturedBy' is distinct from auth.uid()::text
       or nullif(btrim(revision_row.source_metadata ->> 'capturedAt'), '') is null then
      raise exception 'SALARY_STRUCTURE_IMPORT_SOURCE_INVALID' using errcode = '23514';
    end if;
  end if;

  if revision_row.correction_of_revision_id is null then
    if existing_published_id is not null then
      raise exception 'SALARY_STRUCTURE_CORRECTION_REQUIRED' using errcode = '23505';
    end if;
  else
    if revision_row.source_metadata is null then
      raise exception 'SALARY_STRUCTURE_IMPORT_SOURCE_REQUIRED' using errcode = '23514';
    end if;
    select * into predecessor_row
    from public.salary_structure_revisions revision
    where revision.id = revision_row.correction_of_revision_id
      and revision.tenant_id = revision_row.tenant_id
      and revision.hr_group_id = revision_row.hr_group_id
      and revision.salary_structure_id = revision_row.salary_structure_id
      and revision.effective_from = revision_row.effective_from
      and revision.status = 'PUBLISHED'
    for update;
    if not found or predecessor_row.id <> existing_published_id then
      raise exception 'SALARY_STRUCTURE_CORRECTION_STALE' using errcode = '40001';
    end if;
  end if;

  -- Effective periods in the existing model are represented by their start
  -- date; a later publication normally bounds a legacy row. Source-backed
  -- imports also carry an explicit inclusive end date. Reject a publication
  -- whose source interval overlaps another published interval. For a
  -- correction, the predecessor is excluded because it is archived below in
  -- this same transaction.
  candidate_effective_to := coalesce(
    case
      when revision_row.source_metadata ->> 'effectiveTo' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        then (revision_row.source_metadata ->> 'effectiveTo')::date
    end,
    (
      select min(next_revision.effective_from) - 1
      from public.salary_structure_revisions next_revision
      where next_revision.tenant_id = revision_row.tenant_id
        and next_revision.hr_group_id = revision_row.hr_group_id
        and next_revision.salary_structure_id = revision_row.salary_structure_id
        and next_revision.status = 'PUBLISHED'
        and next_revision.effective_from > revision_row.effective_from
        and next_revision.id is distinct from revision_row.correction_of_revision_id
    ),
    DATE '9999-12-31'
  );

  select existing_revision.id into overlapping_revision_id
  from public.salary_structure_revisions existing_revision
  where existing_revision.tenant_id = revision_row.tenant_id
    and existing_revision.hr_group_id = revision_row.hr_group_id
    and existing_revision.salary_structure_id = revision_row.salary_structure_id
    and existing_revision.status = 'PUBLISHED'
    and existing_revision.id is distinct from revision_row.correction_of_revision_id
    and existing_revision.effective_from <= candidate_effective_to
    and coalesce(
      case
        when existing_revision.source_metadata ->> 'effectiveTo' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then (existing_revision.source_metadata ->> 'effectiveTo')::date
      end,
      (
        select min(next_start.effective_from) - 1
        from (
          select later_revision.effective_from
          from public.salary_structure_revisions later_revision
          where later_revision.tenant_id = existing_revision.tenant_id
            and later_revision.hr_group_id = existing_revision.hr_group_id
            and later_revision.salary_structure_id = existing_revision.salary_structure_id
            and later_revision.status = 'PUBLISHED'
            and later_revision.effective_from > existing_revision.effective_from
            and later_revision.id is distinct from revision_row.correction_of_revision_id
          union all
          select revision_row.effective_from
          where revision_row.effective_from > existing_revision.effective_from
        ) next_start
      ),
      DATE '9999-12-31'
    ) >= revision_row.effective_from
  limit 1;
  if overlapping_revision_id is not null then
    raise exception 'SALARY_STRUCTURE_VERSION_PERIOD_OVERLAP' using errcode = '23514';
  end if;

  perform internal_security.validate_salary_structure_revision(requested_revision_id);

  insert into internal_security.salary_revision_publish_context (
    transaction_id, backend_pid, actor_user_id, draft_revision_id, predecessor_revision_id
  ) values (
    pg_catalog.txid_current(), pg_catalog.pg_backend_pid(), auth.uid(),
    requested_revision_id, revision_row.correction_of_revision_id
  );

  if revision_row.correction_of_revision_id is not null then
    update public.salary_structure_revisions
    set status = 'ARCHIVED',
        updated_by_user_id = auth.uid(),
        updated_at = timezone('utc', now()),
        lock_version = lock_version + 1
    where id = predecessor_row.id
      and status = 'PUBLISHED';
    if not found then
      raise exception 'SALARY_STRUCTURE_CORRECTION_STALE' using errcode = '40001';
    end if;
  end if;

  update public.salary_structure_revisions
  set status = 'PUBLISHED',
      published_at = timezone('utc', now()),
      published_by_user_id = auth.uid(),
      updated_by_user_id = auth.uid(),
      updated_at = timezone('utc', now()),
      lock_version = lock_version + 1
  where id = requested_revision_id;

  delete from internal_security.salary_revision_publish_context
  where transaction_id = pg_catalog.txid_current()
    and backend_pid = pg_catalog.pg_backend_pid()
    and actor_user_id = auth.uid()
    and draft_revision_id = requested_revision_id;

  return jsonb_build_object(
    'id', requested_revision_id,
    'status', 'PUBLISHED',
    'lockVersion', requested_expected_lock_version + 1,
    'correctionOfRevisionId', revision_row.correction_of_revision_id
  );
end;
$$;

alter function public.publish_salary_structure_revision(uuid, integer)
  owner to liquidhr_salary_revision_publisher;
revoke liquidhr_salary_revision_publisher from postgres;
revoke create on schema public, internal_security from liquidhr_salary_revision_publisher;

revoke all on function public.save_salary_structure_import_draft(uuid, uuid, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_salary_structure_import_draft(uuid, uuid, integer, jsonb) to authenticated;
revoke all on function public.publish_salary_structure_revision(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_salary_structure_revision(uuid, integer) to authenticated;

comment on column public.salary_structure_revisions.source_metadata is
  'Captured salary source metadata. REFERENCE_ONLY means the source was recorded but has not received independent source validation.';
comment on column public.salary_structure_revisions.correction_of_revision_id is
  'The published predecessor replaced atomically when this reviewed correction is published.';
