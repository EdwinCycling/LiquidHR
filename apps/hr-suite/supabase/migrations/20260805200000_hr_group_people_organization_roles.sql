begin;

-- Stap 6 maakt personen, de operationele organisatie en roltoewijzingen
-- HR-groep-breed. Een dienstverband en iedere plaatsing blijven gekoppeld aan
-- de administratie waar zij daadwerkelijk werkzaam zijn.

-- Oude permissive policies mogen niet naast de nieuwe groepspolicies blijven
-- bestaan: permissive policies worden anders met OR gecombineerd.
drop policy if exists department_management_insert_scoped on public.department_management;
drop policy if exists department_management_select_scoped on public.department_management;
drop policy if exists department_management_update_scoped on public.department_management;
drop policy if exists departments_delete_tenant on public.departments;
drop policy if exists departments_insert_tenant on public.departments;
drop policy if exists departments_select_tenant on public.departments;
drop policy if exists departments_update_tenant on public.departments;
drop policy if exists employee_organizations_insert_scoped on public.employee_organizations;
drop policy if exists employee_organizations_select_scoped on public.employee_organizations;
drop policy if exists employee_organizations_update_scoped on public.employee_organizations;
drop policy if exists employees_delete_scoped on public.employees;
drop policy if exists employees_insert_scoped on public.employees;
drop policy if exists employees_select_scoped on public.employees;
drop policy if exists employees_update_scoped on public.employees;
drop policy if exists employments_insert_scoped on public.employments;
drop policy if exists employments_select_scoped on public.employments;
drop policy if exists employments_update_scoped on public.employments;
drop policy if exists job_group_jobs_delete_tenant on public.job_group_jobs;
drop policy if exists job_group_jobs_insert_tenant on public.job_group_jobs;
drop policy if exists job_group_jobs_read_tenant on public.job_group_jobs;
drop policy if exists job_group_jobs_update_tenant on public.job_group_jobs;
drop policy if exists job_groups_delete_tenant on public.job_groups;
drop policy if exists job_groups_insert_tenant on public.job_groups;
drop policy if exists job_groups_read_tenant on public.job_groups;
drop policy if exists job_groups_update_tenant on public.job_groups;
drop policy if exists job_revisions_delete_tenant on public.job_revisions;
drop policy if exists job_revisions_insert_tenant on public.job_revisions;
drop policy if exists job_revisions_read_tenant on public.job_revisions;
drop policy if exists job_revisions_update_tenant on public.job_revisions;
drop policy if exists jobs_delete_tenant on public.jobs;
drop policy if exists jobs_insert_tenant on public.jobs;
drop policy if exists jobs_read_tenant on public.jobs;
drop policy if exists jobs_update_tenant on public.jobs;

drop function if exists public.create_job_with_revision(uuid, jsonb);

drop trigger if exists validate_department_parent_before_write on public.departments;

alter table public.department_management
  drop constraint if exists department_management_administration_same_tenant_fkey,
  drop constraint if exists department_management_department_scope_fkey,
  drop constraint if exists department_management_scoped_assignment_no_overlap,
  drop constraint if exists department_management_tenant_assignment_no_overlap;

alter table public.departments
  drop constraint if exists departments_administration_same_tenant_fkey,
  drop constraint if exists departments_scope_type_check,
  drop constraint if exists departments_tenant_administration_id_key,
  drop constraint if exists departments_parent_same_tenant_fkey;

drop index if exists public.department_management_administration_id_idx;
drop index if exists public.department_management_tenant_administration_active_idx;
drop index if exists public.department_management_scoped_assignment_no_overlap;
drop index if exists public.department_management_tenant_assignment_no_overlap;
drop index if exists public.departments_administration_id_idx;
drop index if exists public.departments_tenant_administration_parent_idx;
drop index if exists public.departments_tenant_scope_idx;

alter table public.department_management
  drop column if exists administration_id;

alter table public.departments
  drop column if exists administration_id,
  drop column if exists scope_type;

-- Group-aware parent keys and relationship keys. These are deliberately
-- composite: a UUID from another HR-groep must fail at the database boundary.
create unique index if not exists departments_tenant_hr_group_code_key
  on public.departments (tenant_id, hr_group_id, code);
create unique index if not exists jobs_tenant_hr_group_id_key
  on public.jobs (tenant_id, hr_group_id, id);
create unique index if not exists job_groups_tenant_hr_group_id_key
  on public.job_groups (tenant_id, hr_group_id, id);
create unique index if not exists job_revisions_tenant_hr_group_id_key
  on public.job_revisions (tenant_id, hr_group_id, id);
create unique index if not exists employments_tenant_hr_group_employee_id_key
  on public.employments (tenant_id, hr_group_id, employee_id, id);

alter table public.departments
  add constraint departments_parent_hr_group_fkey
    foreign key (tenant_id, hr_group_id, parent_id)
    references public.departments (tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.department_management
  add constraint department_management_department_hr_group_fkey
    foreign key (tenant_id, hr_group_id, department_id)
    references public.departments (tenant_id, hr_group_id, id)
    on delete cascade,
  add constraint department_management_employee_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees (tenant_id, hr_group_id, id)
    on delete cascade;

alter table public.employee_organizations
  add constraint employee_organizations_employee_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees (tenant_id, hr_group_id, id)
    on delete cascade,
  add constraint employee_organizations_department_hr_group_fkey
    foreign key (tenant_id, hr_group_id, department_id)
    references public.departments (tenant_id, hr_group_id, id)
    on delete restrict,
  add constraint employee_organizations_manager_hr_group_fkey
    foreign key (tenant_id, hr_group_id, direct_manager_id)
    references public.employees (tenant_id, hr_group_id, id)
    on delete restrict,
  add constraint employee_organizations_deputy_hr_group_fkey
    foreign key (tenant_id, hr_group_id, direct_manager_deputy_id)
    references public.employees (tenant_id, hr_group_id, id)
    on delete restrict,
  add constraint employee_organizations_job_hr_group_fkey
    foreign key (tenant_id, hr_group_id, job_id)
    references public.jobs (tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.employments
  add constraint employments_employee_hr_group_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees (tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.jobs
  add constraint jobs_job_group_hr_group_fkey
    foreign key (tenant_id, hr_group_id, job_group_id)
    references public.job_groups (tenant_id, hr_group_id, id)
    on delete restrict;

alter table public.job_revisions
  add constraint job_revisions_job_hr_group_fkey
    foreign key (tenant_id, hr_group_id, job_id)
    references public.jobs (tenant_id, hr_group_id, id)
    on delete cascade;

alter table public.job_group_jobs
  add constraint job_group_jobs_group_hr_group_fkey
    foreign key (tenant_id, hr_group_id, job_group_id)
    references public.job_groups (tenant_id, hr_group_id, id)
    on delete restrict,
  add constraint job_group_jobs_job_hr_group_fkey
    foreign key (tenant_id, hr_group_id, job_id)
    references public.jobs (tenant_id, hr_group_id, id)
    on delete cascade;

create index if not exists departments_tenant_hr_group_parent_idx
  on public.departments (tenant_id, hr_group_id, parent_id)
  where parent_id is not null;
create index if not exists department_management_group_department_idx
  on public.department_management (tenant_id, hr_group_id, department_id, effective_from);
create index if not exists department_management_group_employee_idx
  on public.department_management (tenant_id, hr_group_id, employee_id, effective_from);
create index if not exists department_management_group_role_idx
  on public.department_management (tenant_id, hr_group_id, management_role_id);
create index if not exists employee_organizations_group_employee_idx
  on public.employee_organizations (tenant_id, hr_group_id, employee_id, effective_from desc);
create index if not exists employee_organizations_group_department_idx
  on public.employee_organizations (tenant_id, hr_group_id, department_id);
create index if not exists employee_organizations_group_manager_idx
  on public.employee_organizations (tenant_id, hr_group_id, direct_manager_id)
  where direct_manager_id is not null;
create index if not exists employee_organizations_group_job_idx
  on public.employee_organizations (tenant_id, hr_group_id, job_id)
  where job_id is not null;
create index if not exists employments_group_employee_idx
  on public.employments (tenant_id, hr_group_id, employee_id, starts_on desc)
  where deleted_at is null;
create index if not exists job_groups_group_code_idx
  on public.job_groups (tenant_id, hr_group_id, code);
create index if not exists jobs_group_job_group_idx
  on public.jobs (tenant_id, hr_group_id, job_group_id);
create index if not exists job_revisions_group_job_idx
  on public.job_revisions (tenant_id, hr_group_id, job_id, valid_from desc);
create index if not exists job_group_jobs_group_job_idx
  on public.job_group_jobs (tenant_id, hr_group_id, job_id);

alter table public.department_management
  add constraint department_management_group_assignment_no_overlap
  exclude using gist (
    tenant_id with =,
    hr_group_id with =,
    department_id with =,
    employee_id with =,
    management_role_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  ) where (department_id is not null);

alter table public.department_management
  add constraint department_management_group_tenant_assignment_no_overlap
  exclude using gist (
    tenant_id with =,
    hr_group_id with =,
    employee_id with =,
    management_role_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  ) where (department_id is null);

create or replace function internal_security.current_employee_id(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id
  from public.employees employee
  where employee.auth_user_id = (select auth.uid())
    and employee.tenant_id = requested_tenant_id
    and employee.hr_group_id = requested_hr_group_id
    and employee.deleted_at is null
  order by employee.is_archived, employee.created_at, employee.id
  limit 1;
$$;

revoke all on function internal_security.current_employee_id(uuid, uuid) from public, anon, authenticated;
grant execute on function internal_security.current_employee_id(uuid, uuid) to authenticated;

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
      and parent.hr_group_id = new.hr_group_id
  ) then
    raise exception 'De parentafdeling moet binnen dezelfde HR-groep vallen.';
  end if;

  if exists (
    with recursive ancestors as (
      select parent.id, parent.parent_id
      from public.departments parent
      where parent.id = new.parent_id
        and parent.tenant_id = new.tenant_id
        and parent.hr_group_id = new.hr_group_id
      union
      select parent.id, parent.parent_id
      from public.departments parent
      join ancestors child on child.parent_id = parent.id
      where parent.tenant_id = new.tenant_id
        and parent.hr_group_id = new.hr_group_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'De afdelingenboom mag geen cyclus bevatten.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_department_parent_before_write on public.departments;
create trigger validate_department_parent_before_write
before insert or update of parent_id, tenant_id, hr_group_id on public.departments
for each row execute function internal_security.validate_department_parent();

create or replace function internal_security.guard_role_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.management_roles%rowtype;
begin
  select * into assigned_role
  from public.management_roles
  where id = new.management_role_id;

  if not found or assigned_role.is_active = false or assigned_role.deleted_at is not null then
    raise exception 'ROLE_ASSIGNMENT_ROLE_INVALID' using errcode = '23514';
  end if;
  if assigned_role.tenant_id is not null and assigned_role.tenant_id <> new.tenant_id then
    raise exception 'ROLE_ASSIGNMENT_TENANT_MISMATCH' using errcode = '23514';
  end if;
  if assigned_role.tenant_id is null and assigned_role.code in ('TENANT_ADMIN', 'EMPLOYEE') then
    raise exception 'ROLE_ASSIGNMENT_SYSTEM_ROLE_IMPLICIT' using errcode = '23514';
  end if;
  if assigned_role.is_organization_scoped <> (new.department_id is not null) then
    raise exception 'ROLE_ASSIGNMENT_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

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
  new_hr_group_id uuid;
  new_seniority_id uuid;
  new_is_active boolean;
  new_valid_until date;
  new_tenant_id uuid;
begin
  new_tenant_id := (to_jsonb(new)->>'tenant_id')::uuid;
  new_hr_group_id := (to_jsonb(new)->>'hr_group_id')::uuid;
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
     where current_job.tenant_id = new_tenant_id
       and current_job.hr_group_id = new_hr_group_id
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
     where revision.tenant_id = new_tenant_id
       and revision.hr_group_id = new_hr_group_id
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
       and revision.hr_group_id = job.hr_group_id
       and revision.job_id = job.id
       and revision.valid_until is null
     where job.tenant_id = new_tenant_id
       and job.hr_group_id = new_hr_group_id
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

create or replace function internal_security.can_manage_employee(
  target_employee_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive target_placements as (
    select organization.tenant_id,
           organization.hr_group_id,
           organization.department_id,
           organization.direct_manager_id
    from public.employee_organizations organization
    where organization.employee_id = target_employee_id
      and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to >= current_date)
  ),
  target_department_tree as (
    select department.id as department_id,
           department.parent_id,
           placement.tenant_id,
           placement.hr_group_id
    from target_placements placement
    join public.departments department
      on department.id = placement.department_id
     and department.tenant_id = placement.tenant_id
     and department.hr_group_id = placement.hr_group_id

    union

    select parent.id,
           parent.parent_id,
           tree.tenant_id,
           tree.hr_group_id
    from public.departments parent
    join target_department_tree tree
      on tree.parent_id = parent.id
     and parent.tenant_id = tree.tenant_id
     and parent.hr_group_id = tree.hr_group_id
  ),
  actors as (
    select employee.id, employee.tenant_id, employee.hr_group_id
    from public.employees employee
    where employee.auth_user_id = (select auth.uid())
      and employee.deleted_at is null
  )
  select exists (
    select 1
    from target_placements placement
    where internal_security.current_user_has_hr_group_permission(
      placement.tenant_id, placement.hr_group_id, requested_permission_code
    )
  )
  or exists (
    select 1
    from target_placements placement
    join actors actor
      on actor.id = placement.direct_manager_id
     and actor.tenant_id = placement.tenant_id
     and actor.hr_group_id = placement.hr_group_id
    join public.management_roles role
      on role.code = 'DIRECT_MANAGER'
     and role.tenant_id is null
     and role.is_active
     and role.deleted_at is null
    join public.role_permissions role_permission
      on role_permission.management_role_id = role.id
    join public.permissions permission
      on permission.id = role_permission.permission_id
     and permission.code = requested_permission_code
    where internal_security.has_hr_group_access(placement.tenant_id, placement.hr_group_id)
  )
  or exists (
    select 1
    from public.department_management assignment
    join actors actor
      on actor.id = assignment.employee_id
     and actor.tenant_id = assignment.tenant_id
     and actor.hr_group_id = assignment.hr_group_id
    join public.role_permissions role_permission
      on role_permission.management_role_id = assignment.management_role_id
    join public.permissions permission
      on permission.id = role_permission.permission_id
     and permission.code = requested_permission_code
    join target_department_tree tree
      on tree.department_id = assignment.department_id
     and tree.tenant_id = assignment.tenant_id
     and tree.hr_group_id = assignment.hr_group_id
    where assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
      and internal_security.has_hr_group_access(tree.tenant_id, tree.hr_group_id)
  );
$$;

revoke all on function internal_security.can_manage_employee(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.can_manage_employee(uuid, text) to authenticated;

create or replace function public.manage_employment_organization_timeline(
  requested_employment_id uuid,
  requested_placement_id uuid,
  requested_effective_on date,
  requested_department_id uuid,
  requested_job_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  job_name text;
  resulting_id uuid;
begin
  select employment.* into employment_row
  from public.employments employment
  where employment.id = requested_employment_id
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if not (
    internal_security.current_user_has_hr_group_permission(
      employment_row.tenant_id, employment_row.hr_group_id, 'organization-placement:write'
    )
    or internal_security.can_manage_employee(employment_row.employee_id, 'organization-placement:write')
  ) then raise exception 'FORBIDDEN'; end if;

  if not exists (
    select 1 from public.departments department
    where department.id = requested_department_id
      and department.tenant_id = employment_row.tenant_id
      and department.hr_group_id = employment_row.hr_group_id
      and department.is_active
  ) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;

  select revision.name into job_name
  from public.jobs job
  join public.job_revisions revision
    on revision.job_id = job.id
   and revision.tenant_id = job.tenant_id
   and revision.hr_group_id = job.hr_group_id
  where job.id = requested_job_id
    and job.tenant_id = employment_row.tenant_id
    and job.hr_group_id = employment_row.hr_group_id
    and job.is_active
    and revision.valid_from <= requested_effective_on
    and (revision.valid_until is null or revision.valid_until > requested_effective_on)
  order by revision.valid_from desc
  limit 1;
  if job_name is null then raise exception 'JOB_NOT_FOUND'; end if;

  if requested_placement_id is not null then
    update public.employee_organizations
    set department_id = requested_department_id,
        job_id = requested_job_id,
        job_title = job_name
    where id = requested_placement_id
      and employment_id = requested_employment_id
      and hr_group_id = employment_row.hr_group_id
    returning id into resulting_id;
    if resulting_id is null then raise exception 'PLACEMENT_NOT_FOUND'; end if;
    return resulting_id;
  end if;

  if requested_effective_on <= employment_row.starts_on
     or (employment_row.ends_on is not null and requested_effective_on > employment_row.ends_on) then
    raise exception 'PLACEMENT_EFFECTIVE_DATE_INVALID';
  end if;

  select placement.* into placement_row
  from public.employee_organizations placement
  where placement.employment_id = requested_employment_id
    and placement.hr_group_id = employment_row.hr_group_id
    and placement.effective_from < requested_effective_on
    and (placement.effective_to is null or placement.effective_to >= requested_effective_on)
  order by placement.effective_from desc
  limit 1
  for update;
  if placement_row.id is null then raise exception 'PLACEMENT_CHAIN_GAP'; end if;

  update public.employee_organizations
  set effective_to = requested_effective_on - 1
  where id = placement_row.id;

  insert into public.employee_organizations (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    department_id, job_id, job_title, direct_manager_id,
    direct_manager_deputy_id, cost_bearer, location_id, effective_from, effective_to
  ) values (
    employment_row.tenant_id, employment_row.hr_group_id, employment_row.administration_id,
    employment_row.employee_id, employment_row.id, requested_department_id, requested_job_id,
    job_name, placement_row.direct_manager_id, placement_row.direct_manager_deputy_id,
    placement_row.cost_bearer, placement_row.location_id, requested_effective_on, placement_row.effective_to
  ) returning id into resulting_id;

  return resulting_id;
end;
$$;

revoke all on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) from public, anon;
grant execute on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) to authenticated;

create or replace function public.create_job_with_revision(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  created_job_id uuid;
  requested_group_id uuid;
  requested_seniority_id uuid;
begin
  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'job-catalog:write'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
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
      and job_group.hr_group_id = requested_hr_group_id
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

  insert into public.jobs (tenant_id, hr_group_id, job_group_id, seniority_id, code)
  values (
    requested_tenant_id, requested_hr_group_id, requested_group_id, requested_seniority_id,
    upper(btrim(requested_payload->>'code'))
  ) returning id into created_job_id;

  insert into public.job_group_jobs (tenant_id, hr_group_id, job_group_id, job_id)
  values (requested_tenant_id, requested_hr_group_id, requested_group_id, created_job_id);

  insert into public.job_revisions (
    tenant_id, hr_group_id, job_id, name, description, valid_from, valid_until
  ) values (
    requested_tenant_id, requested_hr_group_id, created_job_id,
    btrim(requested_payload->>'name'),
    nullif(btrim(requested_payload->>'description'), ''), current_date, null
  );

  return created_job_id;
end;
$$;

revoke all on function public.create_job_with_revision(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_job_with_revision(uuid, uuid, jsonb) to authenticated;

-- Groepsgebonden RLS. De al bestaande restrictive *_hr_group_boundary policies
-- blijven de harde grens; onderstaande policies bepalen de functionele rol.
create policy department_management_select_group
on public.department_management for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'management-assignment:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'department:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);
create policy department_management_insert_group
on public.department_management for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'management-assignment:write')));
create policy department_management_update_group
on public.department_management for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'management-assignment:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'management-assignment:write')));
create policy department_management_delete_group
on public.department_management for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'management-assignment:write')));

create policy departments_select_group
on public.departments for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'department:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);
create policy departments_insert_group
on public.departments for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'department:write')));
create policy departments_update_group
on public.departments for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'department:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'department:write')));
create policy departments_delete_group
on public.departments for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'department:write')));

create policy employees_select_group
on public.employees for select to authenticated
using (
  (
    id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or (select internal_security.can_manage_employee(id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);
create policy employees_insert_group
on public.employees for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:write')));
create policy employees_update_group
on public.employees for update to authenticated
using (
  (
    id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission('self:employee:write'))
  )
  or (select internal_security.can_manage_employee(id, 'employee:write'))
)
with check (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (
      id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
      and (select internal_security.current_employee_has_permission('self:employee:write'))
    )
    or (select internal_security.can_manage_employee(id, 'employee:write'))
  )
);
create policy employees_delete_group
on public.employees for delete to authenticated
using (
  (select internal_security.can_manage_employee(id, 'employee:delete'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:delete'))
);

create policy employments_select_group
on public.employments for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission('self:contract:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'contract:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:read'))
);
create policy employments_insert_group
on public.employments for insert to authenticated
with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:write'))
  and exists (
    select 1 from public.administrations administration
    where administration.tenant_id = employments.tenant_id
      and administration.hr_group_id = employments.hr_group_id
      and administration.id = employments.administration_id
      and administration.is_active
  )
);
create policy employments_update_group
on public.employments for update to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:write'))
  or (select internal_security.can_manage_employee(employee_id, 'contract:write'))
)
with check (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:write'))
    or (select internal_security.can_manage_employee(employee_id, 'contract:write'))
  )
);

create policy employee_organizations_select_group
on public.employee_organizations for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-placement:read'))
);
create policy employee_organizations_insert_group
on public.employee_organizations for insert to authenticated
with check (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-placement:write'))
  or (select internal_security.can_manage_employee(employee_id, 'organization-placement:write'))
);
create policy employee_organizations_update_group
on public.employee_organizations for update to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-placement:write'))
  or (select internal_security.can_manage_employee(employee_id, 'organization-placement:write'))
)
with check (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-placement:write'))
    or (select internal_security.can_manage_employee(employee_id, 'organization-placement:write'))
  )
);

create policy job_groups_select_group
on public.job_groups for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);
create policy job_groups_insert_group
on public.job_groups for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy job_groups_update_group
on public.job_groups for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy job_groups_delete_group
on public.job_groups for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));

create policy jobs_select_group
on public.jobs for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);
create policy jobs_insert_group
on public.jobs for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy jobs_update_group
on public.jobs for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy jobs_delete_group
on public.jobs for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));

create policy job_revisions_select_group
on public.job_revisions for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);
create policy job_revisions_insert_group
on public.job_revisions for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy job_revisions_update_group
on public.job_revisions for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy job_revisions_delete_group
on public.job_revisions for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));

create policy job_group_jobs_select_group
on public.job_group_jobs for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);
create policy job_group_jobs_insert_group
on public.job_group_jobs for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy job_group_jobs_update_group
on public.job_group_jobs for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));
create policy job_group_jobs_delete_group
on public.job_group_jobs for delete to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'job-catalog:write')));

-- Explicit grants are separate from RLS and blijven daarom onderdeel van de
-- contractwijziging. Anon krijgt geen directe toegang tot deze HR-data.
revoke all on table public.employees, public.employments, public.departments,
  public.department_management, public.employee_organizations, public.job_groups,
  public.jobs, public.job_revisions, public.job_group_jobs from anon;
grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.employments to authenticated;
grant select, insert, update, delete on table public.departments to authenticated;
grant select, insert, update, delete on table public.department_management to authenticated;
grant select, insert, update, delete on table public.employee_organizations to authenticated;
grant select, insert, update, delete on table public.job_groups to authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;
grant select, insert, update, delete on table public.job_revisions to authenticated;
grant select, insert, update, delete on table public.job_group_jobs to authenticated;

drop trigger if exists audit_employments on public.employments;
create trigger audit_employments
after insert or update or delete on public.employments
for each row execute function internal_security.audit_hr_change('employments');

-- Gecontroleerde Stap-6-testdata. TEST-BOUNDARY blijft bewust leeg; de
-- tweede groep maakt de twee-groepen-autorisatie reproduceerbaar zonder de
-- bestaande groepsgrensfixture te vervuilen.
do $$
declare
  source_employee public.employees%rowtype;
  target_tenant_id uuid;
  target_group_id uuid;
  target_admin_id uuid;
  target_department_id uuid;
  target_employee_id uuid;
  direct_manager_role_id uuid;
begin
  select employee.* into source_employee
  from public.employees employee
  join public.hr_groups group_row
    on group_row.tenant_id = employee.tenant_id
   and group_row.id = employee.hr_group_id
  where employee.employee_number = 'DEMO-028'
    and group_row.code = 'DEFAULT'
  order by employee.created_at
  limit 1;

  if source_employee.id is null or source_employee.auth_user_id is null then
    raise exception 'STAP6_MANAGER_FIXTURE_SOURCE_MISSING';
  end if;

  select tenant.id into target_tenant_id
  from public.tenants tenant
  where tenant.slug = 'liquid-hr-demo-holding'
  limit 1;

  select group_row.id into target_group_id
  from public.hr_groups group_row
  where group_row.tenant_id = target_tenant_id
    and group_row.code = 'TEST-MULTIGROUP';

  if target_group_id is null then
    insert into public.hr_groups (tenant_id, code, name, description)
    values (
      target_tenant_id,
      'TEST-MULTIGROUP',
      'Stap 6 testgroep meerdere autorisaties',
      'Gecontroleerde testgroep voor dezelfde leidinggevende in meerdere HR-groepen.'
    )
    returning id into target_group_id;
  end if;

  select administration.id into target_admin_id
  from public.administrations administration
  where administration.tenant_id = target_tenant_id
    and administration.hr_group_id = target_group_id
    and administration.code = 'TEST-MULTIGROUP-ADMIN';

  if target_admin_id is null then
    insert into public.administrations (
      tenant_id, hr_group_id, code, name, administration_number
    ) values (
      target_tenant_id, target_group_id, 'TEST-MULTIGROUP-ADMIN',
      'Stap 6 testadministratie meerdere groepen', 'TEST-MULTIGROUP-001'
    ) returning id into target_admin_id;
  end if;

  select department.id into target_department_id
  from public.departments department
  where department.tenant_id = target_tenant_id
    and department.hr_group_id = target_group_id
    and department.code = 'TEST-MULTIGROUP-ROOT';

  if target_department_id is null then
    insert into public.departments (tenant_id, hr_group_id, code, name, description, is_active)
    values (
      target_tenant_id, target_group_id, 'TEST-MULTIGROUP-ROOT',
      'Stap 6 testafdeling', 'Gecontroleerde afdeling voor groepsroltests.', true
    ) returning id into target_department_id;
  end if;

  select employee.id into target_employee_id
  from public.employees employee
  where employee.tenant_id = target_tenant_id
    and employee.hr_group_id = target_group_id
    and employee.employee_number = 'TEST-MULTIGROUP-MANAGER';

  if target_employee_id is null then
    insert into public.employees (
      tenant_id, hr_group_id, auth_user_id, employee_number, first_name,
      birth_name, name_usage, gender, birth_date, nationality, preferred_language
    ) values (
      target_tenant_id, target_group_id, source_employee.auth_user_id,
      'TEST-MULTIGROUP-MANAGER', source_employee.first_name, source_employee.birth_name,
      source_employee.name_usage, source_employee.gender, source_employee.birth_date,
      source_employee.nationality, source_employee.preferred_language
    ) returning id into target_employee_id;
  end if;

  if not exists (
    select 1 from public.employments employment
    where employment.tenant_id = target_tenant_id
      and employment.hr_group_id = target_group_id
      and employment.employee_id = target_employee_id
  ) then
    insert into public.employments (
      tenant_id, hr_group_id, administration_id, employee_id, employment_number,
      employment_type, contract_type, record_status, starts_on, seniority_date,
      original_hire_date, is_primary, country_code
    ) values (
      target_tenant_id, target_group_id, target_admin_id, target_employee_id,
      'TEST-MULTIGROUP-MANAGER-001', 'EMPLOYEE', 'INDEFINITE', 'CONFIRMED',
      date '2024-01-01', date '2024-01-01', date '2024-01-01', true, 'NL'
    );
  end if;

  select role.id into direct_manager_role_id
  from public.management_roles role
  where role.code = 'DIRECT_MANAGER'
    and role.tenant_id is null
  limit 1;

  if not exists (
    select 1 from public.department_management assignment
    where assignment.tenant_id = target_tenant_id
      and assignment.hr_group_id = target_group_id
      and assignment.department_id = target_department_id
      and assignment.management_role_id = direct_manager_role_id
      and assignment.employee_id = target_employee_id
      and assignment.effective_from = date '2024-01-01'
  ) then
    insert into public.department_management (
      tenant_id, hr_group_id, department_id, management_role_id,
      employee_id, effective_from
    ) values (
      target_tenant_id, target_group_id, target_department_id,
      direct_manager_role_id, target_employee_id, date '2024-01-01'
    );
  end if;

  insert into public.user_hr_group_access (user_id, tenant_id, hr_group_id, management_role_id)
  values (source_employee.auth_user_id, target_tenant_id, target_group_id, direct_manager_role_id)
  on conflict (user_id, tenant_id, hr_group_id, management_role_id)
  do update set is_active = true, updated_at = timezone('utc', now());

  -- Twee managers op dezelfde afdeling binnen één groep; de tweede manager
  -- is een bestaande niet-geauthenticeerde demo-medewerker.
  insert into public.department_management (
    tenant_id, hr_group_id, department_id, management_role_id, employee_id, effective_from
  )
  select employee.tenant_id, employee.hr_group_id, department.id, direct_manager_role_id,
         employee.id, date '2024-01-01'
  from public.employees employee
  join public.departments department
    on department.tenant_id = employee.tenant_id
   and department.hr_group_id = employee.hr_group_id
   and department.code = 'RICH-02'
  where employee.employee_number = 'OPS-TEST-002'
    and employee.tenant_id = target_tenant_id
    and not exists (
      select 1 from public.department_management existing
      where existing.tenant_id = employee.tenant_id
        and existing.hr_group_id = employee.hr_group_id
        and existing.department_id = department.id
        and existing.management_role_id = direct_manager_role_id
        and existing.employee_id = employee.id
    );
end;
$$;

-- Contractuele invarianten voor de slice.
do $$
begin
  if exists (
    select 1
    from public.department_management assignment
    join public.departments department
      on department.tenant_id = assignment.tenant_id
     and department.hr_group_id = assignment.hr_group_id
     and department.id = assignment.department_id
    where assignment.tenant_id <> department.tenant_id
       or assignment.hr_group_id <> department.hr_group_id
  ) then
    raise exception 'STAP6_DEPARTMENT_MANAGEMENT_GROUP_MISMATCH';
  end if;

  if exists (
    select 1
    from public.employee_organizations placement
    join public.employees employee
      on employee.tenant_id = placement.tenant_id
     and employee.hr_group_id = placement.hr_group_id
     and employee.id = placement.employee_id
    where placement.tenant_id <> employee.tenant_id
       or placement.hr_group_id <> employee.hr_group_id
  ) then
    raise exception 'STAP6_PLACEMENT_GROUP_MISMATCH';
  end if;
end;
$$;

commit;
