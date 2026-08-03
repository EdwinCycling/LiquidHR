begin;

-- Departments are tenant-owned by default. Keep administration_id as an
-- explicit-scope compatibility column for future legal-entity departments.
drop trigger if exists validate_department_parent_before_write on public.departments;

alter table public.employee_organizations
  drop constraint if exists employee_organizations_department_scope_fkey;

alter table public.departments
  drop constraint if exists departments_parent_same_administration_fkey,
  drop constraint if exists departments_administration_same_tenant_fkey,
  drop constraint if exists departments_tenant_administration_code_key;

create temporary table _department_scope_merge on commit drop as
select tenant_id, code, (array_agg(id order by id))[1] as keep_id
from public.departments
group by tenant_id, code
having count(*) > 1;

update public.departments child
set parent_id = merge.keep_id
from _department_scope_merge merge
where child.parent_id = merge.keep_id;

update public.employee_organizations placement
set department_id = merge.keep_id
from _department_scope_merge merge
where placement.department_id in (
  select duplicate.id
  from public.departments duplicate
  where duplicate.tenant_id = merge.tenant_id
    and duplicate.code = merge.code
    and duplicate.id <> merge.keep_id
);

update public.department_management assignment
set department_id = merge.keep_id
from _department_scope_merge merge
where assignment.department_id in (
  select duplicate.id
  from public.departments duplicate
  where duplicate.tenant_id = merge.tenant_id
    and duplicate.code = merge.code
    and duplicate.id <> merge.keep_id
);

update public.departments child
set parent_id = merge.keep_id
from _department_scope_merge merge
where child.parent_id in (
  select duplicate.id
  from public.departments duplicate
  where duplicate.tenant_id = merge.tenant_id
    and duplicate.code = merge.code
    and duplicate.id <> merge.keep_id
);

delete from public.departments duplicate
using _department_scope_merge merge
where duplicate.tenant_id = merge.tenant_id
  and duplicate.code = merge.code
  and duplicate.id <> merge.keep_id;

alter table public.departments
  add column if not exists scope_type text not null default 'TENANT',
  alter column administration_id drop not null;

update public.departments
set scope_type = 'TENANT', administration_id = null;

create or replace function internal_security.validate_department_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Een afdeling kan niet zijn eigen parent zijn.';
  end if;

  if not exists (
    select 1
    from public.departments parent
    where parent.id = new.parent_id
      and parent.tenant_id = new.tenant_id
      and (
        new.scope_type = 'TENANT'
        or (new.scope_type = 'ADMINISTRATION'
          and parent.scope_type = 'ADMINISTRATION'
          and parent.administration_id = new.administration_id)
      )
  ) then
    raise exception 'De parentafdeling moet binnen dezelfde scope vallen.';
  end if;

  if exists (
    with recursive ancestors as (
      select parent.id, parent.parent_id
      from public.departments parent
      where parent.id = new.parent_id
      union
      select parent.id, parent.parent_id
      from public.departments parent
      join ancestors child on child.parent_id = parent.id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'De afdelingenboom mag geen cyclus bevatten.';
  end if;

  return new;
end;
$$;

create trigger validate_department_parent_before_write
before insert or update of parent_id, tenant_id, administration_id, scope_type on public.departments
for each row execute function internal_security.validate_department_parent();

alter table public.departments
  add constraint departments_scope_type_check
    check (
      (scope_type = 'TENANT' and administration_id is null)
      or (scope_type = 'ADMINISTRATION' and administration_id is not null)
    ),
  add constraint departments_tenant_id_id_key unique (tenant_id, id),
  add constraint departments_parent_same_tenant_fkey
    foreign key (tenant_id, parent_id)
    references public.departments(tenant_id, id) on delete restrict,
  add constraint departments_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade;

alter table public.employee_organizations
  add constraint employee_organizations_department_tenant_fkey
    foreign key (tenant_id, department_id)
    references public.departments(tenant_id, id) on delete restrict;

create index if not exists departments_tenant_scope_idx
  on public.departments (tenant_id, scope_type, administration_id, code);

-- Jobs, groups, revisions and their junction are tenant-owned. The existing
-- administration_id columns remain nullable compatibility fields until the
-- final cleanup migration, but no canonical key or policy uses them.
alter table public.star_performer_assessments
  drop constraint if exists star_performer_assessments_tenant_id_administration_id_job_fkey,
  drop constraint if exists star_performer_assessments_tenant_id_administration_id_jo_fkey1;

alter table public.job_group_jobs
  drop constraint if exists job_group_jobs_group_scope_fkey,
  drop constraint if exists job_group_jobs_job_scope_fkey;

alter table public.employee_organizations
  drop constraint if exists employee_organizations_job_fkey;

alter table public.job_revisions
  drop constraint if exists job_revisions_tenant_id_administration_id_job_id_fkey,
  drop constraint if exists job_revisions_tenant_id_administration_id_job_id_daterange_excl,
  drop constraint if exists job_revisions_tenant_id_administration_id_id_key;

alter table public.jobs
  drop constraint if exists jobs_tenant_id_administration_id_job_group_id_fkey,
  drop constraint if exists jobs_tenant_id_administration_id_code_key,
  drop constraint if exists jobs_tenant_id_administration_id_id_key;

alter table public.job_groups
  drop constraint if exists job_groups_tenant_id_administration_id_fkey,
  drop constraint if exists job_groups_tenant_id_administration_id_code_key,
  drop constraint if exists job_groups_tenant_id_administration_id_id_key;

alter table public.job_groups
  alter column administration_id drop not null;

alter table public.jobs
  alter column administration_id drop not null;

alter table public.job_revisions
  alter column administration_id drop not null;

alter table public.job_group_jobs
  alter column administration_id drop not null;

alter table public.job_groups
  add constraint job_groups_tenant_id_id_key unique (tenant_id, id),
  add constraint job_groups_tenant_code_key unique (tenant_id, code),
  add constraint job_groups_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete set null;

alter table public.jobs
  add constraint jobs_tenant_id_id_key unique (tenant_id, id),
  add constraint jobs_tenant_code_key unique (tenant_id, code),
  add constraint jobs_job_group_tenant_fkey
    foreign key (tenant_id, job_group_id)
    references public.job_groups(tenant_id, id) on delete restrict,
  add constraint jobs_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete set null;

alter table public.job_revisions
  add constraint job_revisions_tenant_id_id_key unique (tenant_id, id),
  add constraint job_revisions_job_tenant_fkey
    foreign key (tenant_id, job_id)
    references public.jobs(tenant_id, id) on delete cascade,
  add constraint job_revisions_no_overlap
    exclude using gist (
      tenant_id with =,
      job_id with =,
      daterange(valid_from, valid_until, '[)') with &&
    ),
  add constraint job_revisions_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete set null;

alter table public.job_group_jobs
  add constraint job_group_jobs_group_tenant_fkey
    foreign key (tenant_id, job_group_id)
    references public.job_groups(tenant_id, id) on delete restrict,
  add constraint job_group_jobs_job_tenant_fkey
    foreign key (tenant_id, job_id)
    references public.jobs(tenant_id, id) on delete cascade;

alter table public.employee_organizations
  add constraint employee_organizations_job_tenant_fkey
    foreign key (tenant_id, job_id)
    references public.jobs(tenant_id, id) on delete restrict;

alter table public.star_performer_assessments
  add constraint star_performer_assessments_job_tenant_fkey
    foreign key (tenant_id, job_id)
    references public.jobs(tenant_id, id) on delete cascade,
  add constraint star_performer_assessments_group_tenant_fkey
    foreign key (tenant_id, job_group_id)
    references public.job_groups(tenant_id, id) on delete cascade;

create index if not exists job_group_jobs_tenant_job_idx
  on public.job_group_jobs (tenant_id, job_id);
create index if not exists job_group_jobs_tenant_group_idx
  on public.job_group_jobs (tenant_id, job_group_id);
create index if not exists job_revisions_tenant_job_idx
  on public.job_revisions (tenant_id, job_id, valid_from desc);
create index if not exists employee_organizations_tenant_job_idx
  on public.employee_organizations (tenant_id, job_id)
  where job_id is not null;

drop policy if exists departments_select_scoped on public.departments;
drop policy if exists departments_insert_scoped on public.departments;
drop policy if exists departments_update_scoped on public.departments;
drop policy if exists departments_delete_scoped on public.departments;

create policy departments_select_tenant
on public.departments for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'department:read'))
);

create policy departments_insert_tenant
on public.departments for insert to authenticated
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'department:write'))
);

create policy departments_update_tenant
on public.departments for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'department:write'))
)
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'department:write'))
);

create policy departments_delete_tenant
on public.departments for delete to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'department:write'))
);

drop policy if exists job_groups_read on public.job_groups;
drop policy if exists job_groups_write on public.job_groups;
drop policy if exists job_groups_insert on public.job_groups;
drop policy if exists job_groups_update on public.job_groups;
drop policy if exists job_groups_delete on public.job_groups;
drop policy if exists jobs_read on public.jobs;
drop policy if exists jobs_write on public.jobs;
drop policy if exists jobs_insert on public.jobs;
drop policy if exists jobs_update on public.jobs;
drop policy if exists jobs_delete on public.jobs;
drop policy if exists job_revisions_read on public.job_revisions;
drop policy if exists job_revisions_write on public.job_revisions;
drop policy if exists job_revisions_insert on public.job_revisions;
drop policy if exists job_revisions_update on public.job_revisions;
drop policy if exists job_revisions_delete on public.job_revisions;
drop policy if exists job_group_jobs_read on public.job_group_jobs;
drop policy if exists job_group_jobs_write on public.job_group_jobs;
drop policy if exists job_group_jobs_insert on public.job_group_jobs;
drop policy if exists job_group_jobs_update on public.job_group_jobs;
drop policy if exists job_group_jobs_delete on public.job_group_jobs;

create policy job_groups_read_tenant
on public.job_groups for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read')));
create policy job_groups_insert_tenant
on public.job_groups for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy job_groups_update_tenant
on public.job_groups for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy job_groups_delete_tenant
on public.job_groups for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));

create policy jobs_read_tenant
on public.jobs for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read')));
create policy jobs_insert_tenant
on public.jobs for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy jobs_update_tenant
on public.jobs for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy jobs_delete_tenant
on public.jobs for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));

create policy job_revisions_read_tenant
on public.job_revisions for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read')));
create policy job_revisions_insert_tenant
on public.job_revisions for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy job_revisions_update_tenant
on public.job_revisions for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy job_revisions_delete_tenant
on public.job_revisions for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));

create policy job_group_jobs_read_tenant
on public.job_group_jobs for select to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read')));
create policy job_group_jobs_insert_tenant
on public.job_group_jobs for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy job_group_jobs_update_tenant
on public.job_group_jobs for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));
create policy job_group_jobs_delete_tenant
on public.job_group_jobs for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:write')));

create or replace function public.create_job_with_revision(
  requested_administration_id uuid,
  requested_payload jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  context_tenant_id uuid;
  created_job_id uuid;
  group_ids uuid[];
  compatibility_administration_id uuid;
begin
  select tenant.id into context_tenant_id
  from public.tenants tenant
  where tenant.id = requested_administration_id;

  if context_tenant_id is null then
    select administration.tenant_id into context_tenant_id
    from public.administrations administration
    where administration.id = requested_administration_id;
  end if;

  if context_tenant_id is null or not internal_security.current_user_has_permission(context_tenant_id, null, 'job-catalog:write') then
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
      and job_group.is_active
    where job_group.id is null
  ) then
    raise exception 'JOB_GROUP_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select min(administration.id) into compatibility_administration_id
  from public.administrations administration
  where administration.tenant_id = context_tenant_id;

  insert into public.jobs (tenant_id, administration_id, job_group_id, code)
  values (context_tenant_id, compatibility_administration_id, group_ids[1], upper(btrim(requested_payload->>'code')))
  returning id into created_job_id;

  insert into public.job_group_jobs (tenant_id, administration_id, job_group_id, job_id)
  select context_tenant_id, compatibility_administration_id, requested_group_id, created_job_id
  from unnest(group_ids) requested_group_id;

  insert into public.job_revisions (tenant_id, administration_id, job_id, name, description, valid_from, valid_until)
  values (context_tenant_id, compatibility_administration_id, created_job_id, btrim(requested_payload->>'name'), nullif(btrim(requested_payload->>'description'), ''), current_date, null);
  return created_job_id;
end; $$;

revoke all on function public.create_job_with_revision(uuid, jsonb) from public, anon;
grant execute on function public.create_job_with_revision(uuid, jsonb) to authenticated;

comment on column public.jobs.administration_id is 'Deprecated compatibility value; jobs are tenant-owned. Use tenant_id for scope.';
comment on column public.job_groups.administration_id is 'Deprecated compatibility value; job groups are tenant-owned. Use tenant_id for scope.';
comment on column public.job_revisions.administration_id is 'Deprecated compatibility value; job revisions are tenant-owned. Use tenant_id for scope.';
comment on column public.departments.scope_type is 'TENANT for shared organization structure; ADMINISTRATION only for explicitly legal-entity-bound departments.';

commit;
