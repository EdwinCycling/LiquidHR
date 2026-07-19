insert into public.permissions (code, name, category, description)
values
  ('star-performer:read', 'Star performers bekijken', 'Stamtabellen', 'Bekijkt cruciale medewerkers, sterrenwaarderingen en expertise-tags binnen de actieve administratie.'),
  ('star-performer:write', 'Star performers beheren', 'Stamtabellen', 'Beheert cruciale medewerkers, sterrenwaarderingen en expertise-tags binnen de actieve administratie.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('star-performer:read', 'star-performer:write')
on conflict do nothing;

create table public.star_performer_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint star_performer_tags_tenant_id_id_key unique (tenant_id, id)
);

create unique index star_performer_tags_tenant_name_key
  on public.star_performer_tags (tenant_id, lower(btrim(name)));

create table public.star_performer_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  job_id uuid,
  job_group_id uuid,
  criticality_level integer not null check (criticality_level between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (((job_id is not null)::integer + (job_group_id is not null)::integer) = 1),
  foreign key (tenant_id, administration_id) references public.administrations(tenant_id, id) on delete cascade,
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, administration_id, job_id) references public.jobs(tenant_id, administration_id, id) on delete cascade,
  foreign key (tenant_id, administration_id, job_group_id) references public.job_groups(tenant_id, administration_id, id) on delete cascade,
  constraint star_performer_assessments_tenant_id_id_key unique (tenant_id, id)
);

create unique index star_performer_assessments_employee_job_key
  on public.star_performer_assessments (tenant_id, administration_id, employee_id, job_id)
  where job_id is not null;

create unique index star_performer_assessments_employee_group_key
  on public.star_performer_assessments (tenant_id, administration_id, employee_id, job_group_id)
  where job_group_id is not null;

create index star_performer_assessments_administration_idx
  on public.star_performer_assessments (administration_id, criticality_level desc, updated_at desc);

create index star_performer_assessments_employee_idx
  on public.star_performer_assessments (employee_id, updated_at desc);

create table public.star_performer_assessment_tags (
  tenant_id uuid not null,
  assessment_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (assessment_id, tag_id),
  foreign key (tenant_id, assessment_id) references public.star_performer_assessments(tenant_id, id) on delete cascade,
  foreign key (tenant_id, tag_id) references public.star_performer_tags(tenant_id, id) on delete restrict
);

create index star_performer_assessment_tags_tag_idx
  on public.star_performer_assessment_tags (tenant_id, tag_id);

create trigger set_star_performer_tags_updated_at
before update on public.star_performer_tags
for each row execute function internal_security.set_updated_at();

create trigger set_star_performer_assessments_updated_at
before update on public.star_performer_assessments
for each row execute function internal_security.set_updated_at();

create function public.upsert_star_performer_assessment(
  requested_administration_id uuid,
  requested_payload jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  context_tenant_id uuid;
  subject_job_id uuid;
  subject_job_group_id uuid;
  target_employee_id uuid;
  target_criticality_level integer;
  assessment_record_id uuid;
  requested_tag_ids uuid[] := '{}';
  valid_tag_count integer := 0;
begin
  select administration.tenant_id
    into context_tenant_id
  from public.administrations administration
  where administration.id = requested_administration_id;

  if context_tenant_id is null
     or not internal_security.current_user_has_permission(context_tenant_id, requested_administration_id, 'star-performer:write') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  target_employee_id := (requested_payload->>'employeeId')::uuid;
  subject_job_id := nullif(requested_payload->>'jobId', '')::uuid;
  subject_job_group_id := nullif(requested_payload->>'jobGroupId', '')::uuid;
  target_criticality_level := (requested_payload->>'criticalityLevel')::integer;

  if target_employee_id is null then
    raise exception 'STAR_PERFORMER_EMPLOYEE_REQUIRED' using errcode = 'P0001';
  end if;

  if target_criticality_level is null or target_criticality_level < 1 or target_criticality_level > 5 then
    raise exception 'STAR_PERFORMER_LEVEL_INVALID' using errcode = 'P0001';
  end if;

  if ((subject_job_id is not null)::integer + (subject_job_group_id is not null)::integer) <> 1 then
    raise exception 'STAR_PERFORMER_SCOPE_INVALID' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.employees employee
    where employee.id = target_employee_id
      and employee.tenant_id = context_tenant_id
      and employee.deleted_at is null
  ) then
    raise exception 'STAR_PERFORMER_EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if subject_job_id is not null and not exists (
    select 1
    from public.jobs job
    where job.id = subject_job_id
      and job.tenant_id = context_tenant_id
      and job.administration_id = requested_administration_id
  ) then
    raise exception 'STAR_PERFORMER_JOB_NOT_FOUND' using errcode = 'P0001';
  end if;

  if subject_job_group_id is not null and not exists (
    select 1
    from public.job_groups job_group
    where job_group.id = subject_job_group_id
      and job_group.tenant_id = context_tenant_id
      and job_group.administration_id = requested_administration_id
  ) then
    raise exception 'STAR_PERFORMER_JOB_GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct tag_id), '{}')
    into requested_tag_ids
  from (
    select value::text::uuid as tag_id
    from jsonb_array_elements_text(coalesce(requested_payload->'tagIds', '[]'::jsonb))
  ) requested_tags;

  if coalesce(array_length(requested_tag_ids, 1), 0) > 0 then
    select count(*)
      into valid_tag_count
    from public.star_performer_tags tag
    where tag.tenant_id = context_tenant_id
      and tag.id = any(requested_tag_ids)
      and tag.is_active = true;

    if valid_tag_count <> array_length(requested_tag_ids, 1) then
      raise exception 'STAR_PERFORMER_TAG_NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  if subject_job_id is not null then
    select assessment.id
      into assessment_record_id
    from public.star_performer_assessments assessment
    where assessment.tenant_id = context_tenant_id
      and assessment.administration_id = requested_administration_id
      and assessment.employee_id = target_employee_id
      and assessment.job_id = subject_job_id
    for update;
  else
    select assessment.id
      into assessment_record_id
    from public.star_performer_assessments assessment
    where assessment.tenant_id = context_tenant_id
      and assessment.administration_id = requested_administration_id
      and assessment.employee_id = target_employee_id
      and assessment.job_group_id = subject_job_group_id
    for update;
  end if;

  if assessment_record_id is null then
    insert into public.star_performer_assessments (
      tenant_id,
      administration_id,
      employee_id,
      job_id,
      job_group_id,
      criticality_level
    ) values (
      context_tenant_id,
      requested_administration_id,
      target_employee_id,
      subject_job_id,
      subject_job_group_id,
      target_criticality_level
    )
    returning id into assessment_record_id;
  else
    update public.star_performer_assessments
    set criticality_level = target_criticality_level
    where id = assessment_record_id;
  end if;

  delete from public.star_performer_assessment_tags
  where assessment_id = assessment_record_id;

  if coalesce(array_length(requested_tag_ids, 1), 0) > 0 then
    insert into public.star_performer_assessment_tags (tenant_id, assessment_id, tag_id)
    select context_tenant_id, assessment_record_id, tag_id
    from unnest(requested_tag_ids) as tag_id;
  end if;

  return assessment_record_id;
end;
$$;

revoke all on function public.upsert_star_performer_assessment(uuid, jsonb) from public, anon;
grant execute on function public.upsert_star_performer_assessment(uuid, jsonb) to authenticated;

alter table public.star_performer_tags enable row level security;
alter table public.star_performer_assessments enable row level security;
alter table public.star_performer_assessment_tags enable row level security;

create policy star_performer_tags_read
on public.star_performer_tags
for select
to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'star-performer:read')));

create policy star_performer_tags_write
on public.star_performer_tags
for all
to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'star-performer:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'star-performer:write')));

create policy star_performer_assessments_read
on public.star_performer_assessments
for select
to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'star-performer:read')));

create policy star_performer_assessments_write
on public.star_performer_assessments
for all
to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'star-performer:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'star-performer:write')));

create policy star_performer_assessment_tags_read
on public.star_performer_assessment_tags
for select
to authenticated
using (
  exists (
    select 1
    from public.star_performer_assessments assessment
    where assessment.id = assessment_id
      and assessment.tenant_id = tenant_id
      and internal_security.current_user_has_permission(assessment.tenant_id, assessment.administration_id, 'star-performer:read')
  )
);

create policy star_performer_assessment_tags_write
on public.star_performer_assessment_tags
for all
to authenticated
using (
  exists (
    select 1
    from public.star_performer_assessments assessment
    where assessment.id = assessment_id
      and assessment.tenant_id = tenant_id
      and internal_security.current_user_has_permission(assessment.tenant_id, assessment.administration_id, 'star-performer:write')
  )
)
with check (
  exists (
    select 1
    from public.star_performer_assessments assessment
    where assessment.id = assessment_id
      and assessment.tenant_id = tenant_id
      and internal_security.current_user_has_permission(assessment.tenant_id, assessment.administration_id, 'star-performer:write')
  )
);

grant select, insert, update, delete
on public.star_performer_tags, public.star_performer_assessments, public.star_performer_assessment_tags
to authenticated;
