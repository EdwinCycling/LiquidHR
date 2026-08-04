insert into public.permissions (code, name, category, description)
values
  ('employee-directory:read', 'Medewerkerslijst lezen', 'Persoonlijk', 'Leest de medewerkerslijst zonder algemene beheertoegang tot medewerkergegevens.'),
  ('start-page:read', 'Startpagina lezen', 'Navigatie & werkruimte', 'Opent de bedrijfs- of teamsamenvatting op de startpagina.'),
  ('dashboard:read', 'Dashboard lezen', 'Navigatie & werkruimte', 'Opent het persoonlijke of beheerdashboard.'),
  ('workforce:read', 'Workforce lezen', 'Navigatie & werkruimte', 'Opent de workforce-werkruimte en de bijbehorende talentfuncties.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission
  on permission.code = 'employee-directory:read'
where management_role.code = 'EMPLOYEE'
  and management_role.tenant_id is null
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission
  on permission.code in ('start-page:read', 'dashboard:read', 'workforce:read')
where management_role.code in ('DIRECT_MANAGER', 'TENANT_ADMIN')
  and management_role.tenant_id is null
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission
  on permission.code in ('start-page:read', 'dashboard:read', 'workforce:read')
join public.tenants tenant
  on tenant.id = management_role.tenant_id
 and tenant.slug = 'liquid-hr-demo-holding'
where management_role.code = 'TENANT_ADMIN'
on conflict do nothing;

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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee:read')
    or internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee-directory:read')
  ) then
    raise exception 'insufficient employee directory permission' using errcode = '42501';
  end if;

  return query
  with scoped_employees as (
    select distinct on (assignment.employee_id)
      assignment.employee_id
    from public.employee_administration_assignments assignment
    where assignment.tenant_id = requested_tenant_id
      and assignment.administration_id = requested_administration_id
      and assignment.effective_from <= requested_as_of
      and (assignment.effective_to is null or assignment.effective_to >= requested_as_of)
      and internal_security.can_manage_employee(assignment.employee_id, 'employee:read')
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
end;
$$;

revoke all on function public.list_employee_overviews(uuid, uuid, date, text) from public;
grant execute on function public.list_employee_overviews(uuid, uuid, date, text) to authenticated;
