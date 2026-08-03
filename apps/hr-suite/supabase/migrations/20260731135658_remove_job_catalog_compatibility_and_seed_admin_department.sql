begin;

-- The catalog is tenant-owned. Administration identifiers were temporary
-- compatibility columns and are removed now that all callers use tenant scope.
drop function if exists public.create_job_with_revision(uuid, jsonb);

drop index if exists public.job_group_jobs_job_scope_idx;
drop index if exists public.job_group_jobs_group_scope_idx;
drop index if exists public.job_revisions_job_scope_idx;
drop index if exists public.jobs_group_scope_idx;

alter table public.jobs
  drop constraint if exists jobs_administration_same_tenant_fkey,
  drop column if exists administration_id;

alter table public.job_groups
  drop constraint if exists job_groups_administration_same_tenant_fkey,
  drop column if exists administration_id;

alter table public.job_revisions
  drop constraint if exists job_revisions_administration_same_tenant_fkey,
  drop column if exists administration_id;

alter table public.job_group_jobs
  drop constraint if exists job_group_jobs_administration_same_tenant_fkey,
  drop column if exists administration_id;

-- Blueprint rule: every job belongs to exactly one tenant job group.
create unique index if not exists job_group_jobs_tenant_job_unique
  on public.job_group_jobs (tenant_id, job_id);

create or replace function public.create_job_with_revision(
  requested_tenant_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  created_job_id uuid;
  requested_group_id uuid;
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

  insert into public.jobs (tenant_id, job_group_id, code)
  values (requested_tenant_id, requested_group_id, upper(btrim(requested_payload->>'code')))
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
$function$;

revoke all on function public.create_job_with_revision(uuid, jsonb) from public, anon;
grant execute on function public.create_job_with_revision(uuid, jsonb) to authenticated;

-- Keep one explicit administration-scoped demo department so the two scopes
-- remain testable without manufacturing a second domain model.
insert into public.departments (
  id,
  tenant_id,
  administration_id,
  scope_type,
  parent_id,
  code,
  name,
  description,
  is_active
) values (
  '9d9e0fcb-4c33-4b3a-9f17-60fd79c19041'::uuid,
  '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid,
  '2057f6ec-cd3e-3c28-9126-c41235d4ffae'::uuid,
  'ADMINISTRATION',
  null,
  'LEGAL-DEMO',
  'Juridische entiteit - Demo Holding',
  'Demo-afdeling op administratie-niveau voor scope- en RLS-tests.',
  true
)
on conflict on constraint departments_tenant_administration_id_key
do update set
  scope_type = excluded.scope_type,
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

commit;
