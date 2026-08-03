begin;

alter table public.job_profile_versions
  add column if not exists updated_by_user_id uuid,
  add column if not exists activated_at timestamptz;

alter table public.job_profile_capability_requirements
  drop constraint if exists job_profile_capability_requirements_requirement_type_check;
update public.job_profile_capability_requirements
set requirement_type = 'IMPORTANT'
where requirement_type = 'PREFERRED';
alter table public.job_profile_capability_requirements
  add constraint job_profile_capability_requirements_requirement_type_check
  check (requirement_type in ('REQUIRED', 'IMPORTANT', 'OPTIONAL'));

alter table public.job_profile_versions
  drop constraint if exists job_profile_versions_check;
alter table public.job_profile_versions
  add constraint job_profile_versions_period_check
  check (valid_until is null or valid_from is null or valid_until > valid_from);

create unique index if not exists job_profile_versions_one_draft_per_profile_idx
  on public.job_profile_versions (tenant_id, job_profile_id)
  where status = 'DRAFT';

create or replace function internal_security.validate_talent_profile_requirement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  capability_kind text;
  capability_status text;
begin
  select capability_type, status into capability_kind, capability_status
  from public.talent_capabilities
  where tenant_id = new.tenant_id and id = new.capability_id;
  if capability_kind is null then
    raise exception 'CAPABILITY_NOT_FOUND' using errcode = 'P0001';
  end if;
  if capability_status <> 'ACTIVE' then
    raise exception 'CAPABILITY_INACTIVE' using errcode = 'P0001';
  end if;
  if new.requirement_type not in ('REQUIRED', 'IMPORTANT', 'OPTIONAL') then
    raise exception 'PROFILE_REQUIREMENT_TYPE_INVALID' using errcode = 'P0001';
  end if;
  if new.target_level_id is not null and capability_kind not in ('COMPETENCY', 'SKILL', 'KNOWLEDGE') then
    raise exception 'CAPABILITY_LEVEL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if new.target_level_id is not null and not exists (
    select 1 from public.talent_levels level
    where level.tenant_id = new.tenant_id and level.id = new.target_level_id
  ) then
    raise exception 'TALENT_LEVEL_NOT_FOUND' using errcode = 'P0001';
  end if;
  if new.language_level is not null and capability_kind <> 'LANGUAGE' then
    raise exception 'CAPABILITY_LANGUAGE_LEVEL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if new.certificate_details is not null and capability_kind <> 'CERTIFICATE' then
    raise exception 'CAPABILITY_CERTIFICATE_DETAILS_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if capability_kind = 'LANGUAGE' and new.target_level_id is not null then
    raise exception 'CAPABILITY_LEVEL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if capability_kind = 'CERTIFICATE' and new.target_level_id is not null then
    raise exception 'CAPABILITY_LEVEL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists talent_profile_requirement_validate on public.job_profile_capability_requirements;
create trigger talent_profile_requirement_validate
before insert or update of tenant_id, capability_id, requirement_type, target_level_id, language_level, certificate_details
on public.job_profile_capability_requirements
for each row execute function internal_security.validate_talent_profile_requirement();

create or replace function internal_security.prevent_talent_profile_period_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'ACTIVE' then
    if new.valid_from is null then
      raise exception 'TALENT_PROFILE_ACTIVE_DATE_REQUIRED' using errcode = 'P0001';
    end if;
    if exists (
      select 1
      from public.job_profile_versions other
      where other.tenant_id = new.tenant_id
        and other.job_profile_id = new.job_profile_id
        and other.status = 'ACTIVE'
        and other.id <> new.id
        and new.valid_from < coalesce(other.valid_until, date '9999-12-31')
        and other.valid_from < coalesce(new.valid_until, date '9999-12-31')
    ) then
      raise exception 'TALENT_PROFILE_PERIOD_OVERLAP' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists talent_profile_period_overlap_guard on public.job_profile_versions;
create constraint trigger talent_profile_period_overlap_guard
after insert or update of tenant_id, job_profile_id, status, valid_from, valid_until
on public.job_profile_versions
deferrable initially immediate
for each row execute function internal_security.prevent_talent_profile_period_overlap();

create or replace function public.copy_job_profile_version_to_draft(
  requested_tenant_id uuid,
  requested_profile_id uuid,
  requested_source_version_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  existing_draft uuid;
  source_version public.job_profile_versions%rowtype;
  next_version integer;
  new_version uuid;
begin
  if not internal_security.current_user_has_permission(requested_tenant_id, null, 'talent:manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select id into existing_draft
  from public.job_profile_versions
  where tenant_id = requested_tenant_id
    and job_profile_id = requested_profile_id
    and status = 'DRAFT'
  for update;
  if existing_draft is not null then
    return existing_draft;
  end if;

  select * into source_version
  from public.job_profile_versions
  where tenant_id = requested_tenant_id
    and job_profile_id = requested_profile_id
    and (requested_source_version_id is null or id = requested_source_version_id)
  order by case when id = requested_source_version_id then 0 when status = 'ACTIVE' then 1 else 2 end,
    version_number desc
  limit 1;
  if source_version.id is null then
    raise exception 'TALENT_PROFILE_VERSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.job_profile_versions
  where tenant_id = requested_tenant_id and job_profile_id = requested_profile_id;

  insert into public.job_profile_versions (
    tenant_id, job_profile_id, version_number, status, purpose, summary,
    organizational_context, tasks, responsibilities, result_areas,
    created_by_user_id, updated_by_user_id
  ) values (
    requested_tenant_id, requested_profile_id, next_version, 'DRAFT', source_version.purpose,
    source_version.summary, source_version.organizational_context, source_version.tasks,
    source_version.responsibilities, source_version.result_areas, auth.uid(), auth.uid()
  ) returning id into new_version;

  insert into public.job_profile_capability_requirements (
    tenant_id, profile_version_id, capability_id, requirement_type, target_level_id,
    language_level, certificate_details, rationale, sort_order
  )
  select requested_tenant_id, new_version, capability_id, requirement_type, target_level_id,
    language_level, certificate_details, rationale, sort_order
  from public.job_profile_capability_requirements
  where tenant_id = requested_tenant_id and profile_version_id = source_version.id;

  return new_version;
end;
$$;

revoke all on function public.copy_job_profile_version_to_draft(uuid, uuid, uuid) from public, anon;
grant execute on function public.copy_job_profile_version_to_draft(uuid, uuid, uuid) to authenticated;

create or replace function public.activate_job_profile_version(
  requested_tenant_id uuid,
  requested_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_profile_id uuid;
  target_valid_from date;
  target_valid_until date;
  current_version_id uuid;
begin
  if not internal_security.current_user_has_permission(requested_tenant_id, null, 'talent:manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select job_profile_id, valid_from, valid_until
    into target_profile_id, target_valid_from, target_valid_until
  from public.job_profile_versions
  where tenant_id = requested_tenant_id and id = requested_version_id
  for update;
  if target_profile_id is null then
    raise exception 'TALENT_PROFILE_VERSION_NOT_FOUND' using errcode = 'P0001';
  end if;
  target_valid_from := coalesce(target_valid_from, current_date);
  if target_valid_until is not null and target_valid_until <= target_valid_from then
    raise exception 'TALENT_PROFILE_PERIOD_INVALID' using errcode = 'P0001';
  end if;

  select id into current_version_id
  from public.job_profile_versions
  where tenant_id = requested_tenant_id
    and job_profile_id = target_profile_id
    and status = 'ACTIVE'
    and id <> requested_version_id
    and valid_from <= target_valid_from
    and (valid_until is null or valid_until > target_valid_from)
  order by valid_from desc
  limit 1
  for update;

  if current_version_id is not null then
    update public.job_profile_versions
    set valid_until = target_valid_from,
        status = case when target_valid_from > current_date then 'ACTIVE' else 'INACTIVE' end,
        updated_by_user_id = auth.uid(),
        updated_at = timezone('utc', now())
    where tenant_id = requested_tenant_id and id = current_version_id;
  end if;

  update public.job_profile_versions
  set status = 'ACTIVE', valid_from = target_valid_from,
      activated_by_user_id = auth.uid(), activated_at = timezone('utc', now()),
      updated_by_user_id = auth.uid(), updated_at = timezone('utc', now())
  where tenant_id = requested_tenant_id and id = requested_version_id;

  return requested_version_id;
end;
$$;

revoke all on function public.activate_job_profile_version(uuid, uuid) from public, anon;
grant execute on function public.activate_job_profile_version(uuid, uuid) to authenticated;

commit;
