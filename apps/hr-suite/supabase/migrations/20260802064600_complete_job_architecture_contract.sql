-- Complete the optional family/seniority contract for the tenant-owned job architecture.

create or replace function internal_security.validate_job_function_business_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_name text;
  new_job_id uuid;
  new_group_id uuid;
  new_seniority_id uuid;
  new_is_active boolean;
  new_valid_until date;
begin
  new_job_id := (to_jsonb(new)->>'id')::uuid;
  if tg_table_name = 'job_revisions' then
    new_job_id := (to_jsonb(new)->>'job_id')::uuid;
    new_valid_until := (to_jsonb(new)->>'valid_until')::date;
    if new_valid_until is not null then
      return new;
    end if;
    candidate_name := lower(regexp_replace(btrim(to_jsonb(new)->>'name'), '\s+', ' ', 'g'));
    select current_job.job_group_id, current_job.seniority_id
      into new_group_id, new_seniority_id
      from public.jobs current_job
     where current_job.tenant_id = (to_jsonb(new)->>'tenant_id')::uuid
       and current_job.id = new_job_id;
  else
    new_group_id := (to_jsonb(new)->>'job_group_id')::uuid;
    new_seniority_id := (to_jsonb(new)->>'seniority_id')::uuid;
    new_is_active := coalesce((to_jsonb(new)->>'is_active')::boolean, true);
    if not new_is_active then
      return new;
    end if;
    select lower(regexp_replace(btrim(revision.name), '\s+', ' ', 'g'))
      into candidate_name
      from public.job_revisions revision
     where revision.tenant_id = new.tenant_id
       and revision.job_id = new_job_id
       and revision.valid_until is null
     order by revision.valid_from desc
     limit 1;
    if candidate_name is null then
      return new;
    end if;
  end if;

  if exists (
    select 1
      from public.jobs job
      join public.job_revisions revision
        on revision.tenant_id = job.tenant_id
       and revision.job_id = job.id
       and revision.valid_until is null
     where job.tenant_id = (to_jsonb(new)->>'tenant_id')::uuid
       and job.job_group_id = new_group_id
       and job.seniority_id is not distinct from new_seniority_id
       and job.is_active
       and lower(regexp_replace(btrim(revision.name), '\s+', ' ', 'g')) = candidate_name
       and job.id <> new_job_id
  ) then
    raise exception 'JOB_DUPLICATE_NAME_SENIORITY' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_job_function_business_key_on_job on public.jobs;
create trigger validate_job_function_business_key_on_job
before insert or update of job_group_id, seniority_id, is_active on public.jobs
for each row execute function internal_security.validate_job_function_business_key();

drop trigger if exists validate_job_function_business_key_on_revision on public.job_revisions;
create trigger validate_job_function_business_key_on_revision
before insert or update of name, valid_from, valid_until on public.job_revisions
for each row execute function internal_security.validate_job_function_business_key();

create or replace function public.create_job_with_revision(requested_tenant_id uuid, requested_payload jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  created_job_id uuid;
  requested_group_id uuid;
  requested_seniority_id uuid;
begin
  if not exists (
    select 1 from public.tenants tenant where tenant.id = requested_tenant_id
  ) or not internal_security.current_user_has_permission(
    requested_tenant_id, null, 'job-catalog:write'
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  requested_group_id := coalesce(
    requested_payload->'jobGroupIds'->>0,
    requested_payload->>'jobGroupId'
  )::uuid;
  requested_seniority_id := nullif(requested_payload->>'seniorityId', '')::uuid;

  if requested_group_id is null then
    raise exception 'JOB_GROUP_REQUIRED' using errcode = 'P0001';
  end if;
  if jsonb_typeof(requested_payload->'jobGroupIds') = 'array'
    and jsonb_array_length(requested_payload->'jobGroupIds') <> 1 then
    raise exception 'JOB_GROUP_EXACTLY_ONE_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.job_groups job_group
    where job_group.id = requested_group_id
      and job_group.tenant_id = requested_tenant_id
      and job_group.is_active
  ) then
    raise exception 'JOB_GROUP_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if requested_seniority_id is not null and not exists (
    select 1 from public.talent_seniorities seniority
    where seniority.id = requested_seniority_id
      and seniority.tenant_id = requested_tenant_id
      and seniority.status = 'ACTIVE'
  ) then
    raise exception 'SENIORITY_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  insert into public.jobs (tenant_id, job_group_id, seniority_id, code)
  values (requested_tenant_id, requested_group_id, requested_seniority_id, upper(btrim(requested_payload->>'code')))
  returning id into created_job_id;

  insert into public.job_group_jobs (tenant_id, job_group_id, job_id)
  values (requested_tenant_id, requested_group_id, created_job_id);

  insert into public.job_revisions (
    tenant_id, job_id, name, description, valid_from, valid_until
  ) values (
    requested_tenant_id,
    created_job_id,
    btrim(requested_payload->>'name'),
    nullif(btrim(requested_payload->>'description'), ''),
    current_date,
    null
  );

  return created_job_id;
end;
$$;

revoke execute on function internal_security.validate_job_function_business_key() from public, anon, authenticated;
