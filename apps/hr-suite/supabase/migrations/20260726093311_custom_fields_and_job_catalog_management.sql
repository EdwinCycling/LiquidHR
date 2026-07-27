alter table public.custom_field_definitions
  add column country_code text not null default 'NL'
    check (country_code ~ '^[A-Z]{2}$');

grant select, insert, update, delete on public.custom_field_definitions to authenticated;

create table public.job_group_jobs (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  job_group_id uuid not null,
  job_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint job_group_jobs_pk primary key (job_group_id, job_id),
  constraint job_group_jobs_group_scope_fkey
    foreign key (tenant_id, administration_id, job_group_id)
    references public.job_groups(tenant_id, administration_id, id) on delete restrict,
  constraint job_group_jobs_job_scope_fkey
    foreign key (tenant_id, administration_id, job_id)
    references public.jobs(tenant_id, administration_id, id) on delete cascade
);

create index job_group_jobs_job_scope_idx
  on public.job_group_jobs (tenant_id, administration_id, job_id);

insert into public.job_group_jobs (tenant_id, administration_id, job_group_id, job_id)
select tenant_id, administration_id, job_group_id, id
from public.jobs
where job_group_id is not null
on conflict do nothing;

create function internal_security.guard_job_group_delete_when_used()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.job_group_jobs relation
    where relation.tenant_id = old.tenant_id
      and relation.administration_id = old.administration_id
      and relation.job_group_id = old.id
  ) then
    raise exception 'JOB_GROUP_IN_USE' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger guard_job_group_delete_when_used
before delete on public.job_groups
for each row execute function internal_security.guard_job_group_delete_when_used();

alter table public.job_group_jobs enable row level security;

create policy job_group_jobs_read
on public.job_group_jobs for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:read')));

create policy job_group_jobs_write
on public.job_group_jobs for all to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')));

grant select, insert, update, delete on public.job_group_jobs to authenticated;

create or replace function public.create_job_with_revision(
  requested_administration_id uuid,
  requested_payload jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  context_tenant_id uuid;
  created_job_id uuid;
  group_ids uuid[];
  group_id uuid;
begin
  select administration.tenant_id into context_tenant_id
  from public.administrations administration where administration.id = requested_administration_id;
  if context_tenant_id is null or not internal_security.current_user_has_permission(context_tenant_id, requested_administration_id, 'job-catalog:write') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select array_agg(distinct value::uuid order by value::uuid)
    into group_ids
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(requested_payload->'jobGroupIds') = 'array' then requested_payload->'jobGroupIds'
      else jsonb_build_array(requested_payload->>'jobGroupId')
    end
  );

  if group_ids is null or cardinality(group_ids) = 0 then
    raise exception 'JOB_GROUP_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from unnest(group_ids) requested_group_id
    left join public.job_groups job_group
      on job_group.id = requested_group_id
      and job_group.tenant_id = context_tenant_id
      and job_group.administration_id = requested_administration_id
      and job_group.is_active
    where job_group.id is null
  ) then
    raise exception 'JOB_GROUP_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  insert into public.jobs (tenant_id, administration_id, job_group_id, code)
  values (context_tenant_id, requested_administration_id, group_ids[1], upper(btrim(requested_payload->>'code')))
  returning id into created_job_id;

  insert into public.job_group_jobs (tenant_id, administration_id, job_group_id, job_id)
  select context_tenant_id, requested_administration_id, requested_group_id, created_job_id
  from unnest(group_ids) requested_group_id;

  insert into public.job_revisions (tenant_id, administration_id, job_id, name, description, valid_from, valid_until)
  values (context_tenant_id, requested_administration_id, created_job_id, btrim(requested_payload->>'name'), nullif(btrim(requested_payload->>'description'), ''), current_date, null);
  return created_job_id;
end; $$;

revoke all on function public.create_job_with_revision(uuid, jsonb) from public, anon;
grant execute on function public.create_job_with_revision(uuid, jsonb) to authenticated;
