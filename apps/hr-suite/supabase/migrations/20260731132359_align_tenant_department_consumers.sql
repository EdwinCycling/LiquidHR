begin;

-- Departments are tenant-owned. Administration columns on operational target
-- records remain the employer/context of the reminder or document itself.
alter table public.reminder_targets
  drop constraint if exists reminder_targets_department_same_scope_fkey;
alter table public.reminder_targets
  add constraint reminder_targets_department_same_tenant_fkey
  foreign key (tenant_id, department_id)
  references public.departments(tenant_id, id)
  on delete cascade;

alter table public.document_audiences
  drop constraint if exists document_audiences_tenant_id_administration_id_target_depa_fkey;
alter table public.document_audiences
  add constraint document_audiences_tenant_id_target_department_id_fkey
  foreign key (tenant_id, target_department_id)
  references public.departments(tenant_id, id)
  on delete cascade;

alter table public.reminder_target_rules
  drop constraint if exists reminder_target_rules_tenant_id_administration_id_target_d_fkey;
alter table public.reminder_target_rules
  add constraint reminder_target_rules_tenant_id_target_department_id_fkey
  foreign key (tenant_id, target_department_id)
  references public.departments(tenant_id, id)
  on delete cascade;

create index if not exists document_audiences_tenant_department_idx
  on public.document_audiences(tenant_id, target_department_id)
  where target_department_id is not null;
create index if not exists reminder_target_rules_tenant_department_idx
  on public.reminder_target_rules(tenant_id, target_department_id)
  where target_department_id is not null;

create or replace function public.create_hr_reminder(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_title text,
  requested_description text,
  requested_remind_at timestamptz,
  requested_target_type public.reminder_target_type,
  requested_target_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  created_reminder_id uuid;
  inserted_target_count integer;
  expected_target_count integer := coalesce(cardinality(requested_target_ids), 0);
begin
  if not internal_security.current_user_has_permission(
    requested_tenant_id, requested_administration_id, 'reminder:write'
  ) then
    raise exception 'REMINDER_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_remind_at <= timezone('utc', now()) then
    raise exception 'REMINDER_IN_PAST' using errcode = '22023';
  end if;
  if requested_target_type not in ('EVERYONE', 'DEPARTMENTS', 'EMPLOYEES')
    or (requested_target_type = 'EVERYONE' and expected_target_count <> 0)
    or (requested_target_type in ('DEPARTMENTS', 'EMPLOYEES') and expected_target_count = 0) then
    raise exception 'REMINDER_TARGET_SCOPE_INVALID' using errcode = '22023';
  end if;

  insert into public.reminders (
    tenant_id, administration_id, created_by_user_id, reminder_type, target_type,
    title, description, remind_at, status
  ) values (
    requested_tenant_id, requested_administration_id, (select auth.uid()), 'HR', requested_target_type,
    btrim(requested_title), nullif(btrim(requested_description), ''), requested_remind_at, 'DRAFT'
  ) returning id into created_reminder_id;

  if requested_target_type = 'DEPARTMENTS' then
    insert into public.reminder_targets (
      tenant_id, administration_id, reminder_id, department_id
    )
    select requested_tenant_id, requested_administration_id, created_reminder_id, department.id
    from public.departments department
    where department.tenant_id = requested_tenant_id
      and department.id = any(requested_target_ids);
    get diagnostics inserted_target_count = row_count;
  elsif requested_target_type = 'EMPLOYEES' then
    insert into public.reminder_targets (
      tenant_id, administration_id, reminder_id, employee_id
    )
    select requested_tenant_id, requested_administration_id, created_reminder_id, employee.id
    from public.employees employee
    where employee.tenant_id = requested_tenant_id
      and employee.deleted_at is null
      and employee.id = any(requested_target_ids);
    get diagnostics inserted_target_count = row_count;
  else
    inserted_target_count := 0;
  end if;

  if inserted_target_count <> expected_target_count then
    raise exception 'REMINDER_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  return created_reminder_id;
end;
$$;

revoke all on function public.create_hr_reminder(uuid, uuid, text, text, timestamptz, public.reminder_target_type, uuid[]) from public, anon;
grant execute on function public.create_hr_reminder(uuid, uuid, text, text, timestamptz, public.reminder_target_type, uuid[]) to authenticated;

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
  if not internal_security.current_user_has_permission(
    employment_row.tenant_id, employment_row.administration_id,
    'organization-placement:write'
  ) then raise exception 'FORBIDDEN'; end if;

  if not exists (
    select 1 from public.departments department
    where department.id = requested_department_id
      and department.tenant_id = employment_row.tenant_id
      and department.is_active
  ) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;

  select revision.name into job_name
  from public.jobs job
  join public.job_revisions revision on revision.job_id = job.id and revision.tenant_id = job.tenant_id
  where job.id = requested_job_id
    and job.tenant_id = employment_row.tenant_id
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
    returning id into resulting_id;
    if resulting_id is null then raise exception 'PLACEMENT_NOT_FOUND'; end if;
    return resulting_id;
  end if;

  if requested_effective_on <= employment_row.starts_on
     or (
       employment_row.ends_on is not null
       and requested_effective_on > employment_row.ends_on
     ) then raise exception 'PLACEMENT_EFFECTIVE_DATE_INVALID'; end if;

  select placement.* into placement_row
  from public.employee_organizations placement
  where placement.employment_id = requested_employment_id
    and placement.effective_from < requested_effective_on
    and (
      placement.effective_to is null
      or placement.effective_to >= requested_effective_on
    )
  order by placement.effective_from desc
  limit 1
  for update;
  if placement_row.id is null then raise exception 'PLACEMENT_CHAIN_GAP'; end if;

  update public.employee_organizations
  set effective_to = requested_effective_on - 1
  where id = placement_row.id;

  insert into public.employee_organizations (
    tenant_id, administration_id, employee_id, employment_id,
    department_id, job_id, job_title, direct_manager_id,
    direct_manager_deputy_id, effective_from, effective_to
  ) values (
    employment_row.tenant_id, employment_row.administration_id,
    employment_row.employee_id, employment_row.id,
    requested_department_id, requested_job_id, job_name,
    placement_row.direct_manager_id, placement_row.direct_manager_deputy_id,
    requested_effective_on, placement_row.effective_to
  ) returning id into resulting_id;

  return resulting_id;
end;
$$;

revoke all on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) from public, anon;
grant execute on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) to authenticated;

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
           organization.administration_id,
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
           placement.administration_id
    from target_placements placement
    join public.departments department
      on department.id = placement.department_id
     and department.tenant_id = placement.tenant_id

    union

    select parent.id,
           parent.parent_id,
           tree.tenant_id,
           tree.administration_id
    from public.departments parent
    join target_department_tree tree on tree.parent_id = parent.id
    where parent.tenant_id = tree.tenant_id
  ),
  actors as (
    select employee.id, employee.tenant_id
    from public.employees employee
    where employee.auth_user_id = (select auth.uid())
      and employee.deleted_at is null
  )
  select exists (
    select 1
    from target_placements placement
    where internal_security.current_user_has_permission(
      placement.tenant_id,
      placement.administration_id,
      requested_permission_code
    )
  )
  or exists (
    select 1
    from target_placements placement
    join actors actor
      on actor.id = placement.direct_manager_id
     and actor.tenant_id = placement.tenant_id
    join public.management_roles role
      on role.code = 'DIRECT_MANAGER'
     and role.tenant_id is null
    join public.role_permissions role_permission on role_permission.management_role_id = role.id
    join public.permissions permission
      on permission.id = role_permission.permission_id
     and permission.code = requested_permission_code
    where internal_security.has_administration_access(
      placement.tenant_id,
      placement.administration_id
    )
  )
  or exists (
    select 1
    from public.department_management assignment
    join actors actor
      on actor.id = assignment.employee_id
     and actor.tenant_id = assignment.tenant_id
    join public.role_permissions role_permission
      on role_permission.management_role_id = assignment.management_role_id
    join public.permissions permission
      on permission.id = role_permission.permission_id
     and permission.code = requested_permission_code
    join target_department_tree tree
      on tree.department_id = assignment.department_id
     and tree.tenant_id = assignment.tenant_id
     and tree.administration_id = assignment.administration_id
    where assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
      and internal_security.has_administration_access(
        tree.tenant_id,
        tree.administration_id
      )
  );
$$;

revoke all on function internal_security.can_manage_employee(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.can_manage_employee(uuid, text) to authenticated;

create or replace function public.list_employee_overviews(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_as_of date default current_date,
  requested_archive_filter text default 'active'
)
returns table (
  id uuid,
  employee_number text,
  first_name text,
  birth_name_prefix text,
  birth_name text,
  work_email text,
  avatar_url text,
  is_archived boolean,
  employment_history jsonb,
  department_name text,
  job_title text
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped_employees as (
    select distinct on (assignment.employee_id)
      assignment.employee_id
    from public.employee_administration_assignments assignment
    where assignment.tenant_id = requested_tenant_id
      and assignment.administration_id = requested_administration_id
      and assignment.effective_from <= requested_as_of
      and (assignment.effective_to is null or assignment.effective_to >= requested_as_of)
    order by assignment.employee_id, assignment.effective_from desc
  )
  select
    employee.id,
    employee.employee_number,
    employee.first_name,
    employee.birth_name_prefix,
    employee.birth_name,
    employee.work_email,
    employee.avatar_url,
    employee.is_archived,
    coalesce(employment_history.periods, '[]'::jsonb) as employment_history,
    placement.department_name,
    placement.job_title
  from scoped_employees scoped
  join public.employees employee
    on employee.tenant_id = requested_tenant_id
   and employee.id = scoped.employee_id
   and employee.deleted_at is null
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'starts_on', employment.starts_on,
        'ends_on', employment.ends_on,
        'record_status', employment.record_status
      )
      order by employment.starts_on
    ) as periods
    from public.employments employment
    where employment.tenant_id = requested_tenant_id
      and employment.employee_id = employee.id
      and employment.deleted_at is null
  ) employment_history on true
  left join lateral (
    select
      department.name as department_name,
      organization.job_title
    from public.employee_organizations organization
    left join public.departments department
      on department.tenant_id = organization.tenant_id
     and department.id = organization.department_id
    where organization.tenant_id = requested_tenant_id
      and organization.administration_id = requested_administration_id
      and organization.employee_id = employee.id
      and organization.effective_from <= requested_as_of
      and (organization.effective_to is null or organization.effective_to >= requested_as_of)
    order by organization.effective_from desc
    limit 1
  ) placement on true
  where requested_archive_filter = 'all'
     or (requested_archive_filter = 'archived' and employee.is_archived)
     or (requested_archive_filter = 'active' and not employee.is_archived)
  order by employee.birth_name, employee.first_name
  limit 500;
$$;

revoke all on function public.list_employee_overviews(uuid, uuid, date, text) from public;
grant execute on function public.list_employee_overviews(uuid, uuid, date, text) to authenticated;

commit;
