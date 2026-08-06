-- Stap 6: directory en complete employment volgen de HR-groep als persoonsgrens.
-- De administratie blijft een employment/payroll-eigenschap; zij begrenst niet
-- de groepsbrede medewerkerlijst.

drop function if exists public.list_employee_overviews(uuid, uuid, date, text);

create function public.list_employee_overviews(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_as_of date default current_date,
  requested_archive_filter text default 'active'
)
returns table(
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
set search_path = public, internal_security, auth
as $$
begin
  if not (
    internal_security.current_user_has_hr_group_permission(
      requested_tenant_id, requested_hr_group_id, 'employee:read'
    )
    or internal_security.current_user_has_hr_group_permission(
      requested_tenant_id, requested_hr_group_id, 'employee-directory:read'
    )
  ) then
    raise exception 'insufficient employee directory permission' using errcode = '42501';
  end if;

  return query
  with scoped_employees as (
    select employee.id
    from public.employees employee
    where employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.deleted_at is null
      and (
        internal_security.current_user_has_hr_group_permission(
          requested_tenant_id, requested_hr_group_id, 'employee-directory:read'
        )
        or internal_security.current_user_has_hr_group_permission(
          requested_tenant_id, requested_hr_group_id, 'employee:read'
        )
        or internal_security.can_manage_employee(employee.id, 'employee:read')
      )
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
  join public.employees employee on employee.id = scoped.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'starts_on', employment.starts_on,
        'ends_on', employment.ends_on,
        'record_status', employment.record_status
      ) order by employment.starts_on
    ) as periods
    from public.employments employment
    where employment.tenant_id = requested_tenant_id
      and employment.hr_group_id = requested_hr_group_id
      and employment.employee_id = employee.id
      and employment.deleted_at is null
  ) employment_history on true
  left join lateral (
    select department.name as department_name, organization.job_title
    from public.employee_organizations organization
    left join public.departments department
      on department.tenant_id = organization.tenant_id
     and department.hr_group_id = organization.hr_group_id
     and department.id = organization.department_id
    where organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
      and organization.employee_id = employee.id
      and organization.effective_from <= requested_as_of
      and (organization.effective_to is null or organization.effective_to >= requested_as_of)
    order by organization.effective_from desc
    limit 1
  ) placement on true
  where requested_archive_filter = 'all'
     or (requested_archive_filter = 'archived' and employee.is_archived)
     or (requested_archive_filter = 'active' and not employee.is_archived)
  order by employee.birth_name, employee.first_name;
end;
$$;

revoke all on function public.list_employee_overviews(uuid, uuid, date, text) from public, anon;
grant execute on function public.list_employee_overviews(uuid, uuid, date, text) to authenticated;
